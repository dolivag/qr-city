import { resolveStyleAt } from '../styles';
import type { QrCityEcc, QrCityPlaza, QrCityStyle, QrCityStyleId, QrCityTime } from '../types';
import { qrToSvg } from './image';

export interface QrPlaceholderOptions {
  /** The same text as the city's `data`. */
  data: string;
  /** The city's style: the code is drawn with its roof and ground colors. Default `'moderna'`. */
  style?: QrCityStyleId | QrCityStyle;
  time?: QrCityTime;
  errorCorrection?: QrCityEcc;
  /** With a plaza the city uses level `'H'`; pass it so the placeholder is the very same code. */
  plaza?: boolean | QrCityPlaza;
  /** Accessible name of the image. */
  title?: string;
}

/**
 * A flat QR in the colors of the city, as an SVG that fills its container: what a page shows while
 * the 3D city loads, or from the server (it needs no DOM and no WebGL). It is the same code the city
 * draws, so the page already works (and scans) before any JavaScript runs.
 */
export function qrPlaceholder(options: QrPlaceholderOptions): string {
  const style = resolveStyleAt(options.style ?? 'moderna', options.time ?? 'day');
  const svg = qrToSvg(options.data, {
    errorCorrection: options.plaza ? 'H' : (options.errorCorrection ?? 'M'),
    dark: style.palette.roof,
    light: style.palette.ground,
    title: options.title,
  });
  return svg.replace('<svg ', '<svg width="100%" height="100%" ');
}
