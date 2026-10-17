import type { QrCityStyle } from '../types';

/** Contrast between rooftops and ground below which a QR gets hard to scan (WCAG "AA" for text). */
export const MIN_CONTRAST = 4.5;
/** The QR standard asks for a quiet zone of at least this many modules. */
const MIN_QUIET_ZONE = 4;

export interface StyleCheck {
  /** Contrast between the rooftops and the darkest of the walk, ground and road colors (1–21). */
  contrast: number;
  /** `true` when nothing is likely to stop the code from scanning. */
  ok: boolean;
  /** Human-readable reasons, empty when `ok`. */
  warnings: string[];
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** WCAG relative luminance of a `#rrggbb` color. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Checks that a style keeps the scan-ability invariant: dark flat rooftops over a light ground, with a
 * quiet zone. Built-in styles always pass; use it on your own: `checkStyle(myStyle).warnings`.
 */
export function checkStyle(style: QrCityStyle): StyleCheck {
  const { roof, walk, ground, road } = style.palette;
  const warnings: string[] = [];
  const bad = [roof, walk, ground, road].filter((c) => typeof c !== 'string' || !HEX.test(c));
  if (bad.length) {
    return { contrast: 0, ok: false, warnings: ['Colors must be `#rrggbb` strings (palette.roof, walk, ground and road were checked).'] };
  }
  const light = Math.min(luminance(walk), luminance(ground), luminance(road));
  const contrast = (light + 0.05) / (luminance(roof) + 0.05);
  if (contrast < MIN_CONTRAST) {
    warnings.push(
      `Low contrast between the rooftops and the ground (${contrast.toFixed(1)}:1; at least ${MIN_CONTRAST}:1 is advised): the QR may not scan. Use dark rooftops over a light walk, ground and road.`,
    );
  }
  if (style.quietZone < MIN_QUIET_ZONE) {
    warnings.push(`quietZone is ${style.quietZone}: the QR standard asks for at least ${MIN_QUIET_ZONE} light modules around the code.`);
  }
  return { contrast, ok: warnings.length === 0, warnings };
}
