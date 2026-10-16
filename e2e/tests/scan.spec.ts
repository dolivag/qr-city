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
