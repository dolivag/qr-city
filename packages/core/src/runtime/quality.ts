import type { QrCityQuality } from '../types';

export interface QualityProfile {
  level: 'ultra' | 'high' | 'low';
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  pixelRatioCap: number;
  /** Painted-ground pixels per module (capped further by the max texture size). */
  groundPx: number;
  /** Facade texture size in pixels per window tile. */
  facadePx: number;
  anisotropy: number;
  snowflakes: number;
  ringCars: number;
  runCars: number;
  people: number;
  /** Distance between props on the outer ring, in modules. */
  propStep: number;
  flocks: number;
  /** Sphere/curve segment multiplier (1 = full detail). */
  detail: number;
}

const HIGH: QualityProfile = {
  level: 'high', antialias: true, shadows: true, shadowMapSize: 2048, pixelRatioCap: 2, groundPx: 56, facadePx: 128, anisotropy: 8, snowflakes: 1100,
  ringCars: 12, runCars: 18, people: 50, propStep: 0.85, flocks: 3, detail: 1,
};

/** High plus denser everything. The extra modelled parts come from `@qr-city/core/ultra` (see `ultraKit.ts`). */
const ULTRA: QualityProfile = {
  level: 'ultra', antialias: true, shadows: true, shadowMapSize: 4096, pixelRatioCap: 3, groundPx: 64, facadePx: 256, anisotropy: 16, snowflakes: 1500,
  ringCars: 16, runCars: 26, people: 80, propStep: 0.62, flocks: 4, detail: 1.5,
};

const LOW: QualityProfile = {
  level: 'low', antialias: false, shadows: false, shadowMapSize: 512, pixelRatioCap: 1, groundPx: 24, facadePx: 64, anisotropy: 2, snowflakes: 500,
  ringCars: 6, runCars: 8, people: 16, propStep: 1.9, flocks: 1, detail: 0.5,
};

/** `auto` → low on touch devices with a small viewport. Safe to call during SSR (returns high). */
export function resolveQuality(q: QrCityQuality): QualityProfile {
  if (q === 'high') return HIGH;
  if (q === 'ultra') return ULTRA;
  if (q === 'low') return LOW;
  if (typeof matchMedia === 'undefined') return HIGH;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = typeof innerWidth === 'number' && Math.min(innerWidth, innerHeight) <= 820;
  return coarse && small ? LOW : HIGH;
}
