import { createQrCity, styles } from '@qr-city/core';
import type { QrCityController, QrCityOptions } from '@qr-city/core';

/** What the tests drive: mounts a city and resolves once its buildings have risen. */
declare global {
  interface Window {
    qrcity: {
      mount(options: QrCityOptions): Promise<void>;
      controller: QrCityController | null;
      styles: typeof styles;
      /** The top-down view as a PNG (base64). */
      topDownPng(scale?: number): Promise<string>;
    };
  }
}

window.qrcity = {
  controller: null,
  styles,
  mount(options) {
    this.controller?.dispose();
    return new Promise<void>((resolve, reject) => {
      try {
        this.controller = createQrCity(document.getElementById('host') as HTMLElement, {
          animate: false,
          ...options,
          onReveal: () => resolve(),
          onError: reject,
        });
      } catch (error) {
        reject(error);
      }
    });
  },
  async topDownPng(scale = 1) {
    const c = this.controller;
    if (!c) throw new Error('mount() first');
    c.setView('qr', { immediate: true });
    const blob = await c.toPNG({ scale });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  },
};
