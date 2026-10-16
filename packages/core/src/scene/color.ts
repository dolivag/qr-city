import { Color, LinearSRGBColorSpace } from 'three';

/**
 * Colors are used as-is (no sRGB→linear conversion). The renderer outputs linear values
 * too, so the look matches the original prototype regardless of three's color management.
 */
export const col = (v: string | number | Color): Color =>
  v instanceof Color ? v : typeof v === 'number' ? new Color().setHex(v, LinearSRGBColorSpace) : new Color().setStyle(v, LinearSRGBColorSpace);
