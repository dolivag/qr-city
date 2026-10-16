import '@qr-city/core/ultra';
import { createQrCity, qrToPng, qrToSvg, styles } from '@qr-city/core';
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
      /** The plain QR (`qrToPng`) as a PNG (base64). */
      flatPng(data: string, options?: Parameters<typeof qrToPng>[1]): Promise<string>;
      /** The plain QR as SVG, drawn by the browser and returned as a PNG (base64). */
      svgAsPng(data: string, options?: Parameters<typeof qrToSvg>[1], side?: number): Promise<string>;
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
  async flatPng(data, options) {
    return toBase64(await qrToPng(data, options));
  },
  async svgAsPng(data, options, side = 600) {
    const url = URL.createObjectURL(new Blob([qrToSvg(data, options)], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = side;
      const g = canvas.getContext('2d') as CanvasRenderingContext2D;
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0, side, side);
      return toBase64(await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/png')));
    } finally {
      URL.revokeObjectURL(url);
    }
  },
  async topDownPng(scale = 1) {
    const c = this.controller;
    if (!c) throw new Error('mount() first');
    c.setView('qr', { immediate: true });
    return toBase64(await c.toPNG({ scale }));
  },
};

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
