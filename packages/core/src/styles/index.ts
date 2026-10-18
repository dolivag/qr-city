import type { QrCityStyle, QrCityStyleId, QrCityTime } from '../types';
import { ciberpunk } from './ciberpunk';
import { costera } from './costera';
import { moderna } from './moderna';
import { nevada } from './nevada';
import { nightOf } from './night';

export const styles: Readonly<Record<QrCityStyleId, QrCityStyle>> = Object.freeze({ moderna, costera, ciberpunk, nevada });

export function resolveStyle(style: QrCityStyleId | QrCityStyle): QrCityStyle {
  if (typeof style === 'string') {
    const found = (styles as Record<string, QrCityStyle | undefined>)[style];
    if (!found) throw new RangeError(`[qr-city] Unknown style "${style}". Available: ${Object.keys(styles).join(', ')}.`);
    return found;
  }
  return style;
}

/** The style as the options ask for it: the day one as it is, or its night version. */
export function resolveStyleAt(style: QrCityStyleId | QrCityStyle, time: QrCityTime): QrCityStyle {
  const base = resolveStyle(style);
  return time === 'night' ? nightOf(base) : base;
}
