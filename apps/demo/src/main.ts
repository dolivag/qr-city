// Fonts are bundled with the app (no third-party requests).
import '@fontsource/young-serif/latin-400.css';
import '@fontsource/young-serif/latin-ext-400.css';
import '@fontsource-variable/hanken-grotesk/wght.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-ext-400.css';
// Extra modelled parts for `quality: 'ultra'`.
import '@qr-city/core/ultra';
import { defineQrCity } from '@qr-city/element';
import type { QrCityElement, QrCityIntroStage } from '@qr-city/element';
import { createLab, presets } from './lab';
import { getLang, getTheme, initI18n, onChange, setLang, setText, setTheme, t } from './i18n';
import type { Key, Lang, Theme } from './i18n';

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

/** Empties a message and forgets its key, so a language change does not bring it back. */
const clearText = (node: HTMLElement) => {
  delete node.dataset.i18n;
  delete node.dataset.i18nVars;
  node.textContent = '';
};

// Language and theme first, so everything below builds in the right language.
initI18n();

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
  setText(toggle, city.view === 'qr' ? 'panel.showCity' : 'panel.reveal');
  if (!gate.hidden) setTimeout(() => input.focus({ preventScroll: true }), 350);
}

// The lab: every option the packages expose, with the code that reproduces it.
const lab = createLab(city, $('lab-controls'), {
  onRestart() {
    // The intro is fixed at creation, so the element started over.
    overCity = false;
    clearText(err);
    clearText(msg);
    stage = city.stage;
    sync();
  },
  onWarn(text) {
    if (text) setText(qrWarn, text.key, text.vars);
    else qrWarn.textContent = '';
    qrWarn.hidden = !text;
  },
  onAsk() {
    overCity = false;
    asking = true;
    input.value = lab.state.data;
    sync();
  },
  onStyle() {
    setText(styleDesc, `style.${lab.preset.id}.desc` as Key);
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
  setText(name, `style.${s.id}.name` as Key);
  label.append(radio, dots, name);
  opts.append(label);
});
setText(styleDesc, `style.${lab.preset.id}.desc` as Key);

city.addEventListener('qr-city-introstage', (e) => {
  stage = (e as CustomEvent<{ stage: QrCityIntroStage }>).detail.stage;
  sync();
});
city.addEventListener('qr-city-viewchange', () => { lab.set({ view: city.view }); sync(); });
city.addEventListener('qr-city-zoomchange', sync);
city.addEventListener('qr-city-fallback', () => {
  setText(msg, 'msg.noWebgl');
  sync();
});
city.addEventListener('qr-city-error', (e) => {
  clearText(msg);
  msg.textContent = (e as CustomEvent<{ error: Error }>).detail.error.message;
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const value = input.value.trim();
  if (!value) { setText(err, 'err.empty'); return; }
  if (value.length > 300) { setText(err, 'err.long'); return; }
  clearText(err);
  clearText(msg);
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
  clearText(err);
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
    clearText(msg);
    msg.textContent = (error as Error).message;
  }
}

png.addEventListener('click', () => run(async () => {
  city.setView('qr', { immediate: true });
  download(await city.toPNG({ scale: 2 }), t('file.city'));
}));
// The plain, print-ready code (black on white, with its quiet zone), not a picture of the city.
qrSvg.addEventListener('click', () => run(() => download(new Blob([city.toQrSvg({ title: t('qr.title') })], { type: 'image/svg+xml' }), 'qr.svg')));
qrPng.addEventListener('click', () => run(async () => download(await city.toQrPng({ size: 1024 }), 'qr.png')));

/** Decodes the top-down view as a phone camera would (full size and shrunk) and reports what it reads. */
async function checkScan() {
  const wanted = lab.state.data;
  scan.hidden = false;
  scan.className = 'scan';
  setText(scan, 'scan.checking');
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
      setText(scan, 'scan.ok');
    } else if (full === wanted || small === wanted) {
      scan.className = 'scan fail';
      setText(scan, full === wanted ? 'scan.onlyFull' : 'scan.onlySmall');
    } else {
      scan.className = 'scan fail';
      if (full || small) setText(scan, 'scan.other', { text: full ?? small ?? '' });
      else setText(scan, 'scan.none');
    }
  } catch (error) {
    scan.className = 'scan fail';
    clearText(scan);
    scan.textContent = (error as Error).message;
  } finally {
    city.setView(previous, { immediate: true });
  }
}
check.addEventListener('click', () => run(checkScan));

share.addEventListener('click', async () => {
  const url = lab.shareUrl();
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: t('doc.title'), url });
    else { await navigator.clipboard.writeText(url); setText(share, 'share.copied'); }
  } catch (error) {
    if ((error as Error).name === 'AbortError') return; // the person closed the share sheet
    prompt(t('share.prompt'), url); // the clipboard is blocked: show the link instead
  }
  setTimeout(() => { setText(share, 'share.copy'); }, 1800);
});

// ---- Language and theme controls ------------------------------------------
const themeBtn = $<HTMLButtonElement>('theme');
const langBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-lang]')];
const THEMES: Theme[] = ['auto', 'light', 'dark'];
function paintBar() {
  const lang = getLang();
  for (const b of langBtns) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  themeBtn.textContent = t('theme.label', { name: t(`theme.${getTheme()}` as Key) });
  themeBtn.setAttribute('aria-label', t('bar.theme') + ': ' + t(`theme.${getTheme()}` as Key));
}
for (const b of langBtns) b.addEventListener('click', () => setLang(b.dataset.lang as Lang));
themeBtn.addEventListener('click', () => setTheme(THEMES[(THEMES.indexOf(getTheme()) + 1) % THEMES.length]));
onChange(() => {
  paintBar();
  sync();
  // The URL carries the language, so a shared link opens in the one it was shared in.
  lab.refreshLanguage();
});
paintBar();

// ---- Installable app: offline cache and the install button ------------------------------------------------
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* the demo works without it */ }); });
}
/** Chromium offers to install the app through this event; other browsers use their own menu. */
interface InstallPrompt extends Event { prompt(): Promise<void> }
const installBtn = $<HTMLButtonElement>('install');
let installPrompt: InstallPrompt | null = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e as InstallPrompt;
  installBtn.hidden = false;
});
installBtn.addEventListener('click', async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  installPrompt = null;
  installBtn.hidden = true;
});
addEventListener('appinstalled', () => { installBtn.hidden = true; });

sync();
