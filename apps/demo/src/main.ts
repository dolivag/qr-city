import { styles } from '@qr-city/core';
import type { QrCityStyle } from '@qr-city/core';
import { defineQrCity } from '@qr-city/element';
import type { QrCityElement, QrCityIntroStage } from '@qr-city/element';
import { paper } from './paper-style';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const city = $<QrCityElement>('city');
// Set before registering the element so it builds once, with the right style.
city.cityStyle = paper;
defineQrCity();

const choices: QrCityStyle[] = [paper, ...Object.values(styles)];
let chosen: QrCityStyle = paper;

const opts = $('opts');
const styleDesc = $('style-desc');
styleDesc.textContent = chosen.description;
choices.forEach((s, i) => {
  const label = document.createElement('label');
  label.className = 'opt';
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'style';
  input.value = s.id;
  input.checked = i === 0;
  input.addEventListener('change', () => { chosen = s; styleDesc.textContent = s.description; });
  const dots = document.createElement('span');
  dots.className = 'dots';
  for (const c of [...s.palette.towers.slice(0, 3), s.palette.roof]) {
    const d = document.createElement('i');
    d.style.background = c;
    dots.append(d);
  }
  const name = document.createElement('b');
  name.textContent = s.name;
  label.append(input, dots, name);
  opts.append(label);
});

const hint = $('hint');
const skip = $('skip');
const gate = $('gate');
const form = $<HTMLFormElement>('form');
const input = $<HTMLInputElement>('data');
const err = $('err');
const cancel = $('cancel');
const toggle = $<HTMLButtonElement>('toggle');
const again = $<HTMLButtonElement>('again');
const png = $<HTMLButtonElement>('png');
const qrSvg = $<HTMLButtonElement>('qr-svg');
const qrPng = $<HTMLButtonElement>('qr-png');
const zoomIn = $<HTMLButtonElement>('zoom-in');
const zoomOut = $<HTMLButtonElement>('zoom-out');
const zoomReset = $<HTMLButtonElement>('zoom-reset');
const zoomValue = $('zoom-value');
const msg = $('msg');

let stage: QrCityIntroStage = 'door';
let overCity = false; // the form is open on top of an already built city

function sync() {
  hint.hidden = stage !== 'door';
  skip.hidden = stage !== 'flying';
  gate.hidden = !(stage === 'threshold' || overCity);
  gate.classList.toggle('over', overCity);
  cancel.hidden = !overCity;
  const ready = stage === 'done' && !overCity;
  const flat = city.usingFallback; // no WebGL: only the plain QR exists
  for (const b of [again, png, qrSvg, qrPng]) b.disabled = !ready;
  for (const b of [toggle, zoomIn, zoomOut, zoomReset]) b.disabled = !ready || flat;
  zoomValue.textContent = `${Number(city.zoom.toFixed(1))}×`;
  toggle.textContent = city.view === 'qr' ? 'Ver ciudad' : 'Revelar QR';
  if (!gate.hidden) setTimeout(() => input.focus({ preventScroll: true }), 350);
}

city.addEventListener('qr-city-introstage', (e) => {
  stage = (e as CustomEvent<{ stage: QrCityIntroStage }>).detail.stage;
  sync();
});
city.addEventListener('qr-city-viewchange', sync);
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
  city.cityStyle = chosen;
  city.setAttribute('data', value);
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
cancel.addEventListener('click', () => { overCity = false; err.textContent = ''; sync(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && overCity) cancel.click(); });

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

sync();
