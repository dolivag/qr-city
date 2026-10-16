import type { QrCityEcc } from '../types';
import { validateData } from '../options';
import { createMatrix } from './matrix';
import type { QrMatrix } from './matrix';

export interface QrImageOptions {
  /** Default `'M'`. */
  errorCorrection?: QrCityEcc;
  /** Quiet zone around the code, in modules. The QR standard asks for 4 (the default). */
  margin?: number;
  /** Dark modules, as a CSS color. Default `'#000000'`. */
  dark?: string;
  /** Light modules and quiet zone, as a CSS color. Default `'#ffffff'`. */
  light?: string;
  /** Accessible name: becomes the `<title>` of the SVG. */
  title?: string;
}

export interface QrPngOptions extends QrImageOptions {
  /** Approximate side of the image in pixels. Modules are drawn on whole pixels, so the real side may be a bit smaller. Default 512. */
  size?: number;
}

/** CSS colors only: no quotes, angle brackets or `;`, so a color can never break out of the attribute. */
const SAFE_COLOR = /^[#a-zA-Z0-9(),.%\s-]{1,64}$/;

function color(name: string, value: string): string {
  if (!SAFE_COLOR.test(value)) throw new RangeError(`[qr-city] \`${name}\` must be a plain CSS color, got "${value}".`);
  return value;
}

function margin(value: number | undefined): number {
  const m = value ?? 4;
  if (!Number.isInteger(m) || m < 0 || m > 20) throw new RangeError('[qr-city] `margin` must be a whole number of modules between 0 and 20.');
  return m;
}

const escapeXml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** One `M x y h len v1 h-len z` per horizontal run of dark modules. */
function modulesPath(m: QrMatrix, offset: number): string {
  let d = '';
  for (let r = 0; r < m.size; r++) {
    let c = 0;
    while (c < m.size) {
      if (!m.isDark(r, c)) { c++; continue; }
      const start = c;
      while (c < m.size && m.isDark(r, c)) c++;
      d += `M${start + offset} ${r + offset}h${c - start}v1h-${c - start}z`;
    }
  }
  return d;
}

/**
 * A plain, print-ready QR code as an SVG string: black squares on white with a quiet zone.
 * Needs no DOM and no WebGL, so it also works on the server.
 */
export function qrToSvg(data: string, options: QrImageOptions = {}): string {
  validateData(data);
  const m = createMatrix(data, options.errorCorrection ?? 'M');
  const q = margin(options.margin);
  const total = m.size + 2 * q;
  const dark = color('dark', options.dark ?? '#000000');
  const light = color('light', options.light ?? '#ffffff');
  const title = options.title ? `<title>${escapeXml(options.title)}</title>` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img">` +
    `${title}<rect width="${total}" height="${total}" fill="${light}"/>` +
    `<path fill="${dark}" d="${modulesPath(m, q)}"/></svg>`
  );
}

/** The same code as a PNG. Browser only (it draws on a canvas). */
export function qrToPng(data: string, options: QrPngOptions = {}): Promise<Blob> {
  if (typeof document === 'undefined') return Promise.reject(new Error('[qr-city] qrToPng needs a browser DOM. Use qrToSvg on the server.'));
  try {
    validateData(data);
    const m = createMatrix(data, options.errorCorrection ?? 'M');
    const q = margin(options.margin);
    const total = m.size + 2 * q;
    const side = options.size ?? 512;
    if (!(side >= total)) throw new RangeError(`[qr-city] \`size\` must be at least ${total} pixels for this code.`);
    const scale = Math.floor(side / total);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = total * scale;
    const g = canvas.getContext('2d');
    if (!g) throw new Error('[qr-city] Could not get a 2D canvas context.');
    g.fillStyle = color('light', options.light ?? '#ffffff');
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = color('dark', options.dark ?? '#000000');
    for (let r = 0; r < m.size; r++) {
      for (let c = 0; c < m.size; c++) if (m.isDark(r, c)) g.fillRect((c + q) * scale, (r + q) * scale, scale, scale);
    }
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('[qr-city] Could not encode the canvas as PNG.'))), 'image/png');
    });
  } catch (error) {
    return Promise.reject(error);
  }
}
