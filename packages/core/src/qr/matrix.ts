import qrcode from 'qrcode-generator';
import type { QrCityEcc } from '../types';

export interface QrMatrix {
  /** Modules per side. */
  size: number;
  /** `true` when the module is dark. Out-of-range cells are light (quiet zone). */
  isDark(row: number, col: number): boolean;
}

/** UTF-8 bytes as a Latin-1 string: qrcode-generator keeps the low 8 bits of each char. */
function toByteString(text: string): string {
  let out = '';
  for (const b of new TextEncoder().encode(text)) out += String.fromCharCode(b);
  return out;
}

/**
 * The centered square of modules the plaza covers: `first` row/column and `side` (odd, so it
 * sits exactly in the middle). `size` is the fraction of the code's side.
 */
export function centerSquare(modules: number, size: number): { first: number; side: number } {
  // Rounded down to an odd side, so the plaza never covers more than asked (small codes have little to spare).
  let side = Math.max(3, Math.floor(modules * size));
  if (side % 2 === 0) side -= 1;
  return { first: (modules - side) / 2, side };
}

export function createMatrix(data: string, ecc: QrCityEcc): QrMatrix {
  const qr = qrcode(0, ecc);
  qr.addData(toByteString(data));
  qr.make();
  const size = qr.getModuleCount();
  return {
    size,
    isDark: (r, c) => r >= 0 && c >= 0 && r < size && c < size && qr.isDark(r, c),
  };
}
