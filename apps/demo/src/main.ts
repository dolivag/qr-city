import { defineQrCity } from '@qr-city/element';
import type { QrCityElement, QrCityIntroStage } from '@qr-city/element';
import { paper } from './paper-style';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const city = $<QrCityElement>('city');
// Set before registering the element so it builds once, with the right style.
city.cityStyle = paper;
defineQrCity();

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
  for (const b of [toggle, again, png]) b.disabled = !ready;
  toggle.textContent = city.view === 'qr' ? 'Ver ciudad' : 'Revelar QR';
  if (!gate.hidden) setTimeout(() => input.focus({ preventScroll: true }), 350);
}

city.addEventListener('qr-city-introstage', (e) => {
  stage = (e as CustomEvent<{ stage: QrCityIntroStage }>).detail.stage;
  sync();
});
city.addEventListener('qr-city-viewchange', sync);
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
toggle.addEventListener('click', () => city.toggleView());
again.addEventListener('click', () => { overCity = true; sync(); });
cancel.addEventListener('click', () => { overCity = false; err.textContent = ''; sync(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && overCity) cancel.click(); });

png.addEventListener('click', async () => {
  try {
    city.setView('qr', { immediate: true });
    const blob = await city.toPNG({ scale: 2 });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ciudad-qr.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch (error) {
    msg.textContent = (error as Error).message;
  }
});

sync();
