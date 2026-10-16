import type { QrCityStyle, QrCityStyleId } from '../types';
import { moderna } from './moderna';

export const styles: Readonly<Record<QrCityStyleId, QrCityStyle>> = Object.freeze({ moderna });

export function resolveStyle(style: QrCityStyleId | QrCityStyle): QrCityStyle {
  if (typeof style === 'string') {
    const found = (styles as Record<string, QrCityStyle | undefined>)[style];
    if (!found) throw new RangeError(`[qr-city] Unknown style "${style}". Available: ${Object.keys(styles).join(', ')}.`);
    return found;
  }
  return style;
}
