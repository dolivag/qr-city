import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Points, PointsMaterial } from 'three';
import { col } from './color';
import type { Animated, SceneCtx } from './ctx';

/**
 * A soft halo at each of the given points (street lamps at night): one additive point sprite per
 * light, all drawn in a single call. The sprites are a fixed size on screen, so they scale with the
 * canvas and the pixel ratio, not with the zoom.
 */
export function createGlow(ctx: SceneCtx, spots: number[], color: string): (Animated & { setViewport(cssHeight: number): void; setZoom(zoom: number): void }) | null {
  if (!spots.length) return null;
  const { decor, tracker, geo } = ctx;
  const dot = document.createElement('canvas');
  dot.width = dot.height = 64;
  const g = dot.getContext('2d') as CanvasRenderingContext2D;
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,0.95)');
  rg.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  rg.addColorStop(0.5, 'rgba(255,255,255,0.14)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 64, 64);

  const geometry = geo(new BufferGeometry());
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(spots), 3));
  const material = tracker.track(new PointsMaterial({
    color: col(color), size: 20, map: tracker.track(new CanvasTexture(dot)), sizeAttenuation: false,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  }));
  let base = 20;
  let zoomScale = 1;
  const apply = () => { if (base * zoomScale !== material.size) material.size = base * zoomScale; };
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  decor.add(points);

  return {
    setViewport(cssHeight) {
      // About 22 px on a tall desktop canvas, less on a phone, times the pixel ratio
      const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2);
      base = Math.max(10, Math.min(26, cssHeight * 0.03)) * dpr;
      apply();
    },
    // Zoomed in, the lights are closer: their halos grow, though not as fast as the city does
    setZoom(zoom) {
      zoomScale = Math.min(3, 1 + 0.45 * (zoom - 1));
      apply();
    },
    update({ k }) {
      material.opacity = k;
    },
  };
}
