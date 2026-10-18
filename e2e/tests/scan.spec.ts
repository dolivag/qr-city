import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { decode, downscale, readPng } from './scan';

const STYLES = ['moderna', 'costera', 'ciberpunk', 'nevada'] as const;

const PAYLOADS = {
  url: 'https://danioliva.dev',
  long: 'https://example.com/a/very/long/path?with=query&and=more&params=1234567890&token=abcdefghijklmnopqrstuvwxyz0123456789',
  utf8: 'Ñandú ☃ — café ¿qué tal? 日本語',
} as const;

/** Mounts a city and returns its top-down view. */
async function topDown(page: Page, options: Record<string, unknown>) {
  await page.goto('/');
  await page.evaluate((o) => window.qrcity.mount(o as never), options);
  return readPng(await page.evaluate(() => window.qrcity.topDownPng()));
}

// The point of the library: whatever the style or the text, a phone pointed at the top-down view
// must read the code, both on the raw render and after a camera-like reduction (cameras average
// light over their pixels, so modules end up only a few pixels wide).
for (const style of STYLES) {
  for (const [name, data] of Object.entries(PAYLOADS)) {
    test(`${style} · ${name}: the top-down view scans back to its data`, async ({ page }) => {
      const img = await topDown(page, { data, style });
      expect(img.width).toBeGreaterThan(300);
      // Full resolution (the strictest case) and a camera-like reduction to about 4–6 px per module.
      for (const factor of [1, 3, 4]) {
        expect(decode(downscale(img, factor)), `reduced ×${factor}`).toBe(data);
      }
    });
  }
}

test('low quality keeps the code readable', async ({ page }) => {
  const img = await topDown(page, { data: PAYLOADS.url, style: 'moderna', quality: 'low' });
  expect(decode(downscale(img, 3))).toBe(PAYLOADS.url);
});

test('ultra quality keeps the code readable', async ({ page }) => {
  const img = await topDown(page, { data: PAYLOADS.url, style: 'costera', quality: 'ultra' });
  expect(decode(downscale(img, 3))).toBe(PAYLOADS.url);
});

test('revealing the QR while zoomed in brings back the whole code, centred', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.qrcity.mount({ data: 'https://danioliva.dev', style: 'moderna' }));
  // Zoom deep into a corner of the city, then reveal the QR.
  await page.evaluate(() => window.qrcity.controller?.setZoom(6, { immediate: true, at: { x: 0.2, y: 0.8 } }));
  const img = readPng(await page.evaluate(() => window.qrcity.topDownPng()));
  expect(await page.evaluate(() => window.qrcity.controller?.zoom)).toBe(1);
  expect(decode(downscale(img, 3))).toBe('https://danioliva.dev');
});

test('flyover: the camera sweeps over the city, can be skipped, and ends on a scannable city', async ({ page }) => {
  await page.goto('/');
  const mounted = page.evaluate(() => window.qrcity.mount({ data: 'https://danioliva.dev', style: 'costera', intro: 'flyover', animate: true }));
  await expect.poll(() => page.evaluate(() => window.qrcity.controller?.stage)).toBe('flying');
  await page.evaluate(() => window.qrcity.controller?.skipIntro());
  await mounted;
  expect(await page.evaluate(() => window.qrcity.controller?.stage)).toBe('done');
  const img = readPng(await page.evaluate(() => window.qrcity.topDownPng()));
  expect(decode(downscale(img, 3))).toBe('https://danioliva.dev');
});

// Night: the same code, lit differently. The ground only looks dim from the side; from above it is
// as light as by day, and the roofs are the same, so the scan must not change.
for (const style of STYLES) {
  test(`${style} · night: the top-down view still scans`, async ({ page }) => {
    for (const [name, data] of Object.entries(PAYLOADS)) {
      const img = await topDown(page, { data, style, time: 'night' });
      for (const factor of [1, 3, 4]) expect(decode(downscale(img, factor)), `${name} reduced ×${factor}`).toBe(data);
    }
  });
}

test('night is really darker from the side, and brings the stars', async ({ page }) => {
  const shot = async (time: 'day' | 'night') => {
    await page.goto('/');
    await page.evaluate((o) => window.qrcity.mount(o as never), { data: PAYLOADS.url, style: 'moderna', time });
    return readPng((await page.locator('#host').screenshot()).toString('base64'));
  };
  const mean = (img: ReturnType<typeof readPng>) => {
    let sum = 0;
    for (let i = 0; i < img.data.length; i += 4) sum += 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
    return sum / (img.data.length / 4);
  };
  expect(mean(await shot('night'))).toBeLessThan(mean(await shot('day')) * 0.5);
});

test('switching to night and back with update() rebuilds the city, and it still scans', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((o) => window.qrcity.mount(o as never), { data: PAYLOADS.url, style: 'costera' });
  await page.evaluate(() => window.qrcity.controller?.update({ time: 'night' }));
  const night = readPng(await page.evaluate(() => window.qrcity.topDownPng()));
  expect(decode(downscale(night, 3))).toBe(PAYLOADS.url);
  await page.evaluate(() => window.qrcity.controller?.update({ time: 'day' }));
  const day = readPng(await page.evaluate(() => window.qrcity.topDownPng()));
  expect(decode(downscale(day, 3))).toBe(PAYLOADS.url);
});

// The plaza covers the middle of the code: error correction 'H' has to rebuild it, whatever
// the style, the text, the pattern or the picture (here a busy, colourful one), up to the largest size.
for (const style of STYLES) {
  test(`${style} · plaza: the top-down view with the plaza still scans`, async ({ page }) => {
    for (const [name, data] of Object.entries(PAYLOADS)) {
      const img = await topDown(page, { data, style, plaza: { size: 0.25 } });
      for (const factor of [1, 3]) expect(decode(downscale(img, factor)), `${name} reduced ×${factor}`).toBe(data);
    }
  });
}

test('plaza with a picture: it is painted in the plaza and the code still scans', async ({ page }) => {
  await page.goto('/');
  const image = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    for (let i = 0; i < 64; i += 8) {
      for (let j = 0; j < 64; j += 8) {
        g.fillStyle = `hsl(${(i * 7 + j * 13) % 360} 80% ${(i + j) % 16 ? 30 : 70}%)`;
        g.fillRect(i, j, 8, 8);
      }
    }
    return c.toDataURL('image/png');
  });
  for (const data of [PAYLOADS.url, PAYLOADS.long]) {
    await page.evaluate((o) => window.qrcity.mount(o as never), { data, style: 'moderna', plaza: { image, size: 0.25 } });
    await page.waitForTimeout(300); // the picture is painted when it has loaded
    const img = readPng(await page.evaluate(() => window.qrcity.topDownPng()));
    for (const factor of [1, 3]) expect(decode(downscale(img, factor)), `${data} reduced ×${factor}`).toBe(data);
  }
});

// ---- Accessibility: where the code leads, and the whole thing usable with a keyboard
test('the canvas is described by the destination, and a web address is a real link in the tab order', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((o) => window.qrcity.mount(o as never), { data: PAYLOADS.url, style: 'moderna', destinationLabel: 'Destino:' });
  const canvas = page.locator('#host canvas');
  const id = await canvas.getAttribute('aria-describedby');
  expect(id).toBeTruthy();
  await expect(page.locator(`#${id}`)).toHaveText(`Destino: ${PAYLOADS.url}`);
  const link = page.locator(`#${id} a`);
  await expect(link).toHaveAttribute('href', PAYLOADS.url);
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  // Hidden until it is reached with the keyboard: canvas first, then the link
  const box = page.locator(`#${id}`);
  expect((await box.boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
  await canvas.focus();
  await page.keyboard.press('Tab');
  await expect(link).toBeFocused();
  expect((await box.boundingBox())?.width ?? 0).toBeGreaterThan(60);
  await page.keyboard.press('Tab');
  expect((await box.boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
});

test('text that is not a web address is only described, never turned into a link (no javascript: links)', async ({ page }) => {
  await page.goto('/');
  for (const data of ['javascript:alert(1)', 'WIFI:S:casa;T:WPA;P:secreto;;', 'hola mundo']) {
    await page.evaluate((o) => window.qrcity.mount(o as never), { data, style: 'moderna' });
    const id = await page.locator('#host canvas').getAttribute('aria-describedby');
    await expect(page.locator(`#${id}`)).toHaveText(`Destination: ${data}`);
    await expect(page.locator(`#${id} a`)).toHaveCount(0);
  }
});

test('the description follows the data when it changes with update()', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((o) => window.qrcity.mount(o as never), { data: PAYLOADS.url, style: 'moderna' });
  await page.evaluate(() => window.qrcity.controller?.update({ data: 'https://example.com/otra' }));
  const id = await page.locator('#host canvas').getAttribute('aria-describedby');
  await expect(page.locator(`#${id} a`)).toHaveAttribute('href', 'https://example.com/otra');
  await page.evaluate(() => window.qrcity.controller?.update({ data: 'solo texto' }));
  await expect(page.locator(`#${id} a`)).toHaveCount(0);
  await expect(page.locator(`#${id}`)).toHaveText('Destination: solo texto');
});

test('everything works with the keyboard: reveal the QR, zoom, move around and come back', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((o) => window.qrcity.mount(o as never), { data: PAYLOADS.url, style: 'moderna' });
  const view = () => page.evaluate(() => window.qrcity.controller?.view);
  const zoom = () => page.evaluate(() => window.qrcity.controller?.zoom ?? 1);
  await page.locator('#host canvas').focus();
  await page.keyboard.press('Enter');
  expect(await view()).toBe('qr');
  await page.keyboard.press('Space');
  expect(await view()).toBe('city');
  await page.keyboard.press('+');
  expect(await zoom()).toBeGreaterThan(1);
  await page.keyboard.press('+');
  const zoomed = await zoom();
  expect(zoomed).toBeGreaterThan(2);
  const before = await page.locator('#host').screenshot();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  expect((await page.locator('#host').screenshot()).equals(before)).toBe(false); // the map moved
  await page.keyboard.press('-');
  expect(await zoom()).toBeLessThan(zoomed);
  await page.keyboard.press('0');
  expect(await zoom()).toBe(1);
  // The canvas says it is a button, and which state it is in
  const canvas = page.locator('#host canvas');
  await expect(canvas).toHaveAttribute('role', 'button');
  await expect(canvas).toHaveAttribute('aria-pressed', 'false');
});

test('every error-correction level reads', async ({ page }) => {
  for (const errorCorrection of ['L', 'M', 'Q', 'H'] as const) {
    const img = await topDown(page, { data: PAYLOADS.url, style: 'moderna', errorCorrection });
    expect(decode(downscale(img, 3)), `level ${errorCorrection}`).toBe(PAYLOADS.url);
  }
});

test('a style that breaks the invariant (light roofs) does NOT scan, so the test can fail', async ({ page }) => {
  // Guards the guard: if this started to pass, the scan tests would prove nothing.
  await page.goto('/');
  await page.evaluate(() => {
    const m = window.qrcity.styles.moderna;
    const palette = { ...m.palette, roof: '#eeeeee', ground: '#d8d8d8', walk: '#dddddd', road: '#d0d0d0' };
    return window.qrcity.mount({ data: 'https://danioliva.dev', style: { ...m, palette } });
  });
  const img = readPng(await page.evaluate(() => window.qrcity.topDownPng()));
  expect(decode(downscale(img, 3))).toBeNull();
});

// ---- The plain QR: what people print, and what they get when WebGL is missing.

for (const [name, data] of Object.entries(PAYLOADS)) {
  for (const errorCorrection of ['L', 'H'] as const) {
    test(`flat PNG · ${name} · ${errorCorrection}: scans back to its data`, async ({ page }) => {
      await page.goto('/');
      const img = readPng(await page.evaluate(([d, e]) => window.qrcity.flatPng(d, { errorCorrection: e }), [data, errorCorrection] as const));
      expect(decode(img)).toBe(data);
    });
  }

  test(`flat SVG · ${name}: the browser draws it and it scans back to its data`, async ({ page }) => {
    await page.goto('/');
    const img = readPng(await page.evaluate((d) => window.qrcity.svgAsPng(d), data));
    expect(decode(img)).toBe(data);
  });
}

test('without WebGL the plain QR is shown, with the style colors, and it scans', async ({ page }) => {
  // Break WebGL before any script runs.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (/webgl/i.test(type)) return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof original;
  });
  await page.goto('/');
  const state = await page.evaluate(async (data) => {
    let reason = '';
    await window.qrcity.mount({ data, style: 'costera', onFallback: (e: Error) => { reason = e.message; } } as never);
    const c = window.qrcity.controller;
    return { fallback: c?.fallback, canvas: c?.canvas === null, svgs: document.querySelectorAll('#host svg').length, canvases: document.querySelectorAll('#host canvas').length, reason };
  }, PAYLOADS.url);
  expect(state).toMatchObject({ fallback: true, canvas: true, svgs: 1, canvases: 0 });
  expect(state.reason).toMatch(/WebGL is not available/);
  expect(decode(readPng((await page.locator('#host').screenshot()).toString('base64')))).toBe(PAYLOADS.url);
});

test('fallback: "none" still throws when there is no WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (/webgl/i.test(type)) return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof original;
  });
  await page.goto('/');
  const message = await page.evaluate(async () => {
    try { await window.qrcity.mount({ data: 'x', fallback: 'none' }); return 'no error'; } catch (e) { return (e as Error).message; }
  });
  expect(message).toMatch(/Could not create a WebGL context/);
});
