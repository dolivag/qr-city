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
