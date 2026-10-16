import type { QrCityEcc, QrCityIntro, QrCityOptions, QrCityQuality, QrCityView } from './types';

export const MAX_DATA_LENGTH = 300;

const INTROS: readonly QrCityIntro[] = ['door', 'flyover', 'none'];
const VIEWS: readonly QrCityView[] = ['city', 'qr'];
const ECCS: readonly QrCityEcc[] = ['L', 'M', 'Q', 'H'];
const WHEELS: readonly NonNullable<QrCityOptions['wheelZoom']>[] = ['ctrl', 'always', 'off'];
const QUALITIES: readonly QrCityQuality[] = ['auto', 'high', 'low'];

export type ResolvedOptions = Required<Omit<QrCityOptions, 'onReveal' | 'onIntroStage' | 'onViewChange' | 'onZoomChange' | 'onError' | 'background' | 'maxPixelRatio'>> &
  Pick<QrCityOptions, 'onReveal' | 'onIntroStage' | 'onViewChange' | 'onZoomChange' | 'onError' | 'background' | 'maxPixelRatio'>;

function oneOf<T extends string>(name: string, value: unknown, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) {
    throw new RangeError(`[qr-city] Invalid ${name} "${String(value)}". Expected one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}

export function validateData(data: unknown): string {
  if (typeof data !== 'string' || data.trim() === '') {
    throw new TypeError('[qr-city] `data` must be a non-empty string.');
  }
  if (data.length > MAX_DATA_LENGTH) {
    throw new RangeError(`[qr-city] \`data\` is too long (${data.length}). The limit is ${MAX_DATA_LENGTH} characters.`);
  }
  return data;
}

/** Applies defaults and validates. Throws on invalid input; never touches the DOM. */
export function resolveOptions(input: QrCityOptions): ResolvedOptions {
  const intro = oneOf('intro', input.intro ?? 'none', INTROS);
  if (intro === 'flyover') {
    throw new RangeError('[qr-city] intro "flyover" is not implemented yet. Use "door" or "none".');
  }
  const maxPixelRatio = input.maxPixelRatio;
  if (maxPixelRatio !== undefined && !(maxPixelRatio > 0)) throw new RangeError('[qr-city] `maxPixelRatio` must be greater than 0.');
  const maxZoom = input.maxZoom ?? 8;
  if (!(maxZoom >= 1)) throw new RangeError('[qr-city] `maxZoom` must be at least 1.');
  return {
    data: validateData(input.data),
    style: input.style ?? 'moderna',
    intro,
    pauseAtThreshold: input.pauseAtThreshold ?? false,
    view: oneOf('view', input.view ?? 'city', VIEWS),
    errorCorrection: oneOf('errorCorrection', input.errorCorrection ?? 'M', ECCS),
    quality: oneOf('quality', input.quality ?? 'auto', QUALITIES),
    interactive: input.interactive ?? true,
    zoomable: input.zoomable ?? true,
    maxZoom: maxZoom,
    wheelZoom: oneOf('wheelZoom', input.wheelZoom ?? 'ctrl', WHEELS),
    animate: input.animate ?? 'auto',
    maxPixelRatio,
    label: input.label ?? 'QR code city',
    doorLabel: input.doorLabel ?? 'Open the door',
    background: input.background,
    onReveal: input.onReveal,
    onIntroStage: input.onIntroStage,
    onViewChange: input.onViewChange,
    onZoomChange: input.onZoomChange,
    onError: input.onError,
  };
}
