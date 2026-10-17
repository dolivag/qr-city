// Fonts are bundled with the app (no third-party requests).
import '@fontsource/young-serif/latin-400.css';
import '@fontsource/young-serif/latin-ext-400.css';
import '@fontsource-variable/hanken-grotesk/wght.css';
import '@fontsource/fragment-mono/latin-400.css';
import '@fontsource/fragment-mono/latin-ext-400.css';
// Extra modelled parts for `quality: 'ultra'`.
import '@qr-city/core/ultra';
import { defineQrCity } from '@qr-city/element';
import type { QrCityElement, QrCityIntroStage } from '@qr-city/element';
import { createLab, presets } from './lab';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const city = $<QrCityElement>('city');

const hint = $('hint');
const skip = $('skip');
const gate = $('gate');
const form = $<HTMLFormElement>('form');
const input = $<HTMLInputElement>('data');
const err = $('err');
const cancel = $('cancel');
const toggle = $<HTMLButtonElement>('toggle');
const again = $<HTMLButtonElement>('again');
const check = $<HTMLButtonElement>('check');
const scan = $('scan');
const share = $<HTMLButtonElement>('share');
const png = $<HTMLButtonElement>('png');
const qrSvg = $<HTMLButtonElement>('qr-svg');
const qrPng = $<HTMLButtonElement>('qr-png');
const zoomIn = $<HTMLButtonElement>('zoom-in');
const zoomOut = $<HTMLButtonElement>('zoom-out');
const zoomReset = $<HTMLButtonElement>('zoom-reset');
const zoomValue = $('zoom-value');
const msg = $('msg');
const styleDesc = $('style-desc');
const qrWarn = $('qr-warn');

let stage: QrCityIntroStage = 'door';
let overCity = false; // the form is open on top of an already built city
let asking = false; // the form is open before a flyover, which starts when it is sent

function sync() {
  hint.hidden = stage !== 'door';
  skip.hidden = stage !== 'flying';
  gate.hidden = !(stage === 'threshold' || overCity || asking);
  gate.classList.toggle('over', overCity);
  cancel.hidden = !(overCity || asking);
  const ready = stage === 'done' && !overCity;
  const flat = city.usingFallback; // no WebGL: only the plain QR exists
  for (const b of [again, check, png, qrSvg, qrPng]) b.disabled = !ready;
  for (const b of [toggle, zoomIn, zoomOut, zoomReset]) b.disabled = !ready || flat;
  zoomValue.textContent = `${Number(city.zoom.toFixed(1))}×`;
  toggle.textContent = city.view === 'qr' ? 'Ver ciudad' : 'Revelar QR';
  if (!gate.hidden) setTimeout(() => input.focus({ preventScroll: true }), 350);
}

// The lab: every option the packages expose, with the code that reproduces it.
const lab = createLab(city, $('lab-controls'), {
  onRestart() {
    // The intro is fixed at creation, so the element started over.
    overCity = false;
    err.textContent = '';
    msg.textContent = '';
    stage = city.stage;
    sync();
  },
  onWarn(text) {
    qrWarn.textContent = text;
    qrWarn.hidden = !text;
  },
  onAsk() {
    overCity = false;
    asking = true;
    input.value = lab.state.data;
    sync();
  },
  onStyle() {
    styleDesc.textContent = lab.preset.description;
    for (const r of document.querySelectorAll<HTMLInputElement>('input[name="style"]')) r.checked = r.value === lab.preset.id;
  },
});
// Set before registering the element so it builds once, with the right options and style.
lab.start();
defineQrCity();
stage = city.stage;
input.value = lab.state.data;

const opts = $('opts');
presets.forEach((s) => {
  const label = document.createElement('label');
  label.className = 'opt';
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'style';
  radio.value = s.id;
  radio.checked = s.id === lab.preset.id;
  radio.addEventListener('change', () => lab.selectPreset(s.id));
  const dots = document.createElement('span');
  dots.className = 'dots';
  for (const c of [...s.palette.towers.slice(0, 3), s.palette.roof]) {
    const d = document.createElement('i');
    d.style.background = c;
    dots.append(d);
  }
  const name = document.createElement('b');
  name.textContent = s.name;
  label.append(radio, dots, name);
  opts.append(label);
});
styleDesc.textContent = lab.preset.description;

city.addEventListener('qr-city-introstage', (e) => {
  stage = (e as CustomEvent<{ stage: QrCityIntroStage }>).detail.stage;
  sync();
});
city.addEventListener('qr-city-viewchange', () => { lab.set({ view: city.view }); sync(); });
city.addEventListener('qr-city-zoomchange', sync);
city.addEventListener('qr-city-fallback', () => {
  msg.textContent = 'Tu navegador no admite WebGL, así que te mostramos el código QR sin la ciudad. Sigue siendo escaneable.';
  sync();
});
city.addEventListener('qr-city-error', (e) => {
  msg.textContent = (e as CustomEvent<{ error: Error }>).detail.error.message;
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const value = input.value.trim();
  if (!value) { err.textContent = 'Escribe un enlace o un texto para el QR.'; return; }
  if (value.length > 300) { err.textContent = 'Es demasiado largo. Usa menos de 300 caracteres.'; return; }
  err.textContent = '';
  msg.textContent = '';
  lab.set({ data: value });
  if (asking) {
    asking = false;
    lab.startFlyover();
    return;
  }
  if (stage === 'threshold') {
    city.continueIntro();
  } else {
    overCity = false;
    city.setView('city');
  }
  sync();
});

skip.addEventListener('click', () => city.skipIntro());
zoomIn.addEventListener('click', () => city.zoomBy(1.6));
zoomOut.addEventListener('click', () => city.zoomBy(1 / 1.6));
zoomReset.addEventListener('click', () => city.resetZoom());
toggle.addEventListener('click', () => city.toggleView());
again.addEventListener('click', () => { overCity = true; sync(); });
cancel.addEventListener('click', () => {
  overCity = false;
  if (asking) { asking = false; lab.cancelAsk(); }
  err.textContent = '';
  sync();
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && (overCity || asking)) cancel.click(); });

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function run(action: () => Promise<void> | void) {
  try {
    await action();
  } catch (error) {
    msg.textContent = (error as Error).message;
  }
}

png.addEventListener('click', () => run(async () => {
  city.setView('qr', { immediate: true });
  download(await city.toPNG({ scale: 2 }), 'ciudad-qr.png');
}));
// The plain, print-ready code (black on white, with its quiet zone), not a picture of the city.
qrSvg.addEventListener('click', () => run(() => download(new Blob([city.toQrSvg({ title: 'Código QR' })], { type: 'image/svg+xml' }), 'qr.svg')));
qrPng.addEventListener('click', () => run(async () => download(await city.toQrPng({ size: 1024 }), 'qr.png')));

/** Decodes the top-down view as a phone camera would (full size and shrunk) and reports what it reads. */
async function checkScan() {
  const wanted = lab.state.data;
  scan.hidden = false;
  scan.className = 'scan';
  scan.textContent = 'Comprobando…';
  const previous = city.view;
  city.setView('qr', { immediate: true });
  try {
    const bitmap = await createImageBitmap(await city.toPNG({ scale: 1 }));
    const { default: jsQR } = await import('jsqr');
    const read = (factor: number) => {
      const w = Math.round(bitmap.width / factor);
      const h = Math.round(bitmap.height / factor);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
      g.imageSmoothingQuality = 'high';
      g.drawImage(bitmap, 0, 0, w, h);
      return jsQR(g.getImageData(0, 0, w, h).data, w, h)?.data ?? null;
    };
    const full = read(1);
    const small = read(3);
    if (full === wanted && small === wanted) {
      scan.className = 'scan ok';
      scan.textContent = '✓ Se lee: el QR devuelve el texto original, a tamaño completo y reducido (como lo vería una cámara).';
    } else if (full === wanted || small === wanted) {
      scan.className = 'scan fail';
      scan.textContent = `Se lee solo a ${full === wanted ? 'tamaño completo' : 'tamaño reducido'}. Una cámara real podría fallar: aumenta el contraste entre tejados y suelo.`;
    } else {
      scan.className = 'scan fail';
      scan.textContent = full || small
        ? `✗ Lee otro texto distinto del esperado: «${full ?? small}».`
        : '✗ No se puede leer. Revisa los colores: tejados oscuros sobre suelo y calles claros.';
    }
  } catch (error) {
    scan.className = 'scan fail';
    scan.textContent = (error as Error).message;
  } finally {
    city.setView(previous, { immediate: true });
  }
}
check.addEventListener('click', () => run(checkScan));

share.addEventListener('click', async () => {
  const url = lab.shareUrl();
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'Ciudad QR', url });
    else { await navigator.clipboard.writeText(url); share.textContent = 'Enlace copiado'; }
  } catch (error) {
    if ((error as Error).name === 'AbortError') return; // the person closed the share sheet
    prompt('Copia el enlace', url); // the clipboard is blocked: show the link instead
  }
  setTimeout(() => { share.textContent = 'Copiar enlace'; }, 1800);
});


sync();
