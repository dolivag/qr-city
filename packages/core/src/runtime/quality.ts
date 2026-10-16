import type { QrCityQuality } from '../types';

export interface QualityProfile {
  level: 'high' | 'low';
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  pixelRatioCap: number;
  /** Painted-ground pixels per module (capped further by the max texture size). */
  groundPx: number;
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
  level: 'high', antialias: true, shadows: true, shadowMapSize: 2048, pixelRatioCap: 2, groundPx: 36,
  ringCars: 12, runCars: 18, people: 50, propStep: 0.85, flocks: 3, detail: 1,
};

const LOW: QualityProfile = {
  level: 'low', antialias: false, shadows: false, shadowMapSize: 512, pixelRatioCap: 1, groundPx: 20,
  ringCars: 6, runCars: 8, people: 16, propStep: 1.9, flocks: 1, detail: 0.5,
};

/** `auto` → low on touch devices with a small viewport. Safe to call during SSR (returns high). */
export function resolveQuality(q: QrCityQuality): QualityProfile {
  if (q === 'high') return HIGH;
  if (q === 'low') return LOW;
  if (typeof matchMedia === 'undefined') return HIGH;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = typeof innerWidth === 'number' && Math.min(innerWidth, innerHeight) <= 820;
  return coarse && small ? LOW : HIGH;
}
