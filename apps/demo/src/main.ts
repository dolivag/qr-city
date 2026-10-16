import '@qr-city/element/define';
import type { QrCityElement } from '@qr-city/element';

const city = document.querySelector<QrCityElement>('#city')!;
const form = document.querySelector<HTMLFormElement>('#form')!;
const input = document.querySelector<HTMLInputElement>('#data')!;
const toggle = document.querySelector<HTMLButtonElement>('#toggle')!;
const png = document.querySelector<HTMLButtonElement>('#png')!;
const msg = document.querySelector<HTMLElement>('#msg')!;

const syncToggle = () => { toggle.textContent = city.view === 'qr' ? 'Ver ciudad' : 'Revelar QR'; };

city.addEventListener('qr-city-viewchange', syncToggle);
city.addEventListener('qr-city-error', (e) => { msg.textContent = (e as CustomEvent<{ error: Error }>).detail.error.message; });

form.addEventListener('submit', (e) => {
  e.preventDefault();
  msg.textContent = '';
  city.setAttribute('data', input.value.trim());
  city.setView('city');
  syncToggle();
});

toggle.addEventListener('click', () => city.toggleView());

png.addEventListener('click', async () => {
  try {
    city.setView('qr', { immediate: true });
    syncToggle();
    const blob = await city.toPNG({ scale: 2 });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ciudad-qr.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch (err) {
    msg.textContent = (err as Error).message;
  }
});
