import type { QrCityEcc, QrCityIntro, QrCityOptions, QrCityQuality, QrCityTime, QrCityView } from './types';

/** The plaza as the city builds it: `null` when it is off. */
export interface ResolvedPlaza {
  image: string | null;
  size: number;
  invert: 'auto' | boolean;
}

export const PLAZA_SIZE = { min: 0.1, max: 0.25, default: 0.2 } as const;

export const MAX_DATA_LENGTH = 300;

const INTROS: readonly QrCityIntro[] = ['door', 'flyover', 'none'];
const VIEWS: readonly QrCityView[] = ['city', 'qr'];
const ECCS: readonly QrCityEcc[] = ['L', 'M', 'Q', 'H'];
const WHEELS: readonly NonNullable<QrCityOptions['wheelZoom']>[] = ['ctrl', 'always', 'off'];
const FALLBACKS: readonly NonNullable<QrCityOptions['fallback']>[] = ['qr', 'none'];
const QUALITIES: readonly QrCityQuality[] = ['auto', 'high', 'low', 'ultra'];
const TIMES: readonly QrCityTime[] = ['day', 'night'];

export type ResolvedOptions = Required<Omit<QrCityOptions, 'onReveal' | 'onIntroStage' | 'onViewChange' | 'onZoomChange' | 'onFallback' | 'onError' | 'background' | 'maxPixelRatio' | 'plaza'>> &
  Pick<QrCityOptions, 'onReveal' | 'onIntroStage' | 'onViewChange' | 'onZoomChange' | 'onFallback' | 'onError' | 'background' | 'maxPixelRatio'> & {
    plaza: ResolvedPlaza | null;
  };

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

function resolvePlaza(input: QrCityOptions['plaza']): ResolvedPlaza | null {
  if (!input) return null;
  const o = input === true ? {} : input;
  const size = o.size ?? PLAZA_SIZE.default;
  if (!(size >= PLAZA_SIZE.min && size <= PLAZA_SIZE.max)) {
    throw new RangeError(`[qr-city] \`plaza.size\` must be between ${PLAZA_SIZE.min} and ${PLAZA_SIZE.max}.`);
  }
  if (o.image !== undefined && typeof o.image !== 'string') throw new TypeError('[qr-city] `plaza.image` must be a URL string.');
  if (o.invert !== undefined && o.invert !== 'auto' && typeof o.invert !== 'boolean') throw new TypeError("[qr-city] `plaza.invert` must be 'auto', true or false.");
  return { image: o.image || null, size, invert: o.invert ?? 'auto' };
}

/** Applies defaults and validates. Throws on invalid input; never touches the DOM. */
export function resolveOptions(input: QrCityOptions): ResolvedOptions {
  const intro = oneOf('intro', input.intro ?? 'none', INTROS);
  const maxPixelRatio = input.maxPixelRatio;
  if (maxPixelRatio !== undefined && !(maxPixelRatio > 0)) throw new RangeError('[qr-city] `maxPixelRatio` must be greater than 0.');
  const plaza = resolvePlaza(input.plaza);
  const maxZoom = input.maxZoom ?? 8;
  if (!(maxZoom >= 1)) throw new RangeError('[qr-city] `maxZoom` must be at least 1.');
  return {
    data: validateData(input.data),
    style: input.style ?? 'moderna',
    intro,
    pauseAtThreshold: input.pauseAtThreshold ?? false,
    view: oneOf('view', input.view ?? 'city', VIEWS),
    // The plaza covers part of the code: only the highest error correction rebuilds it reliably.
    errorCorrection: plaza ? 'H' : oneOf('errorCorrection', input.errorCorrection ?? 'M', ECCS),
    plaza,
    quality: oneOf('quality', input.quality ?? 'auto', QUALITIES),
    time: oneOf('time', input.time ?? 'day', TIMES),
    interactive: input.interactive ?? true,
    zoomable: input.zoomable ?? true,
    maxZoom: maxZoom,
    wheelZoom: oneOf('wheelZoom', input.wheelZoom ?? 'ctrl', WHEELS),
    animate: input.animate ?? 'auto',
    maxPixelRatio,
    fallback: oneOf('fallback', input.fallback ?? 'qr', FALLBACKS),
    label: input.label ?? 'QR code city',
    doorLabel: input.doorLabel ?? 'Open the door',
    destinationLabel: input.destinationLabel ?? 'Destination:',
    background: input.background,
    onReveal: input.onReveal,
    onIntroStage: input.onIntroStage,
    onViewChange: input.onViewChange,
    onZoomChange: input.onZoomChange,
    onFallback: input.onFallback,
    onError: input.onError,
  };
}
