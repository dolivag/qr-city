import jsQR from 'jsqr';
import { PNG } from 'pngjs';

export interface Raster {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export function readPng(base64: string): Raster {
  const png = PNG.sync.read(Buffer.from(base64, 'base64'));
  return { data: new Uint8ClampedArray(png.data), width: png.width, height: png.height };
}

/** Box-filter downscale by an integer factor: what a camera sensor does by integrating light over a pixel. */
export function downscale(img: Raster, factor: number): Raster {
  if (factor <= 1) return img;
  const width = Math.floor(img.width / factor);
  const height = Math.floor(img.height / factor);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let j = 0; j < factor; j++) {
          for (let i = 0; i < factor; i++) sum += img.data[((y * factor + j) * img.width + x * factor + i) * 4 + c];
        }
        data[(y * width + x) * 4 + c] = sum / (factor * factor);
      }
    }
  }
  return { data, width, height };
}

/** The decoded text, or `null` if jsQR cannot read the image. */
export function decode(img: Raster): string | null {
  return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
}
