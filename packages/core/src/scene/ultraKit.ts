import type { Group, Material } from 'three';
import type { CarKind } from './cars';
import type { SceneCtx } from './ctx';

/**
 * Extra modelled parts for `quality: 'ultra'`. They live in their own entry point
 * (`@qr-city/core/ultra`) so apps that never ask for `ultra` do not ship them: importing that
 * entry registers the kit, and the scene calls it while building cars and trees.
 */
export interface UltraKit {
  decorateCar(car: Group, kind: CarKind, ctx: SceneCtx, mats: { paint: Material; trim: Material }): void;
  decorateTree(tree: Group, kind: string, ctx: SceneCtx, scale: number): void;
}

let kit: UltraKit | null = null;
let warned = false;

export function registerUltra(next: UltraKit | null): void {
  kit = next;
}

export function getUltra(): UltraKit | null {
  return kit;
}

/** `ultra` without the kit still works (it is `high` with denser traffic); say so once. */
export function warnIfUltraMissing(level: string): void {
  if (level === 'ultra' && !kit && !warned) {
    warned = true;
    console.warn("[qr-city] quality 'ultra' adds modelled details only if you `import '@qr-city/core/ultra'`; rendering high detail with denser traffic.");
  }
}
