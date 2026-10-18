import { CanvasTexture } from 'three';
import { rand } from '../util/math';

/** Side of the sky texture. The sky is screen-space (it does not move with the camera), so it only needs to look soft. */
const SIDE = 1024;

/**
 * A night sky for the scene background: a gradient from `deep` (top) to a paler horizon, a few
 * hundred stars of different sizes and a hazy moon. Drawn once.
 */
export function nightSky(deep: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = SIDE;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const grad = g.createLinearGradient(0, 0, 0, SIDE);
  grad.addColorStop(0, deep);
  grad.addColorStop(1, '#1b2350');
  g.fillStyle = grad;
  g.fillRect(0, 0, SIDE, SIDE);

  // Moon: a soft halo and a pale disc, high on the right
  const mx = SIDE * 0.8;
  const my = SIDE * 0.16;
  const halo = g.createRadialGradient(mx, my, 6, mx, my, SIDE * 0.16);
  halo.addColorStop(0, 'rgba(214,226,255,0.55)');
  halo.addColorStop(0.25, 'rgba(160,180,255,0.18)');
  halo.addColorStop(1, 'rgba(160,180,255,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, SIDE, SIDE);
  g.fillStyle = '#eef2ff';
  g.beginPath();
  g.arc(mx, my, SIDE * 0.022, 0, Math.PI * 2);
  g.fill();

  // Stars: many faint, a few bright; fewer towards the horizon, where the city's glow washes them out
  for (let i = 0; i < 420; i++) {
    const x = rand(i, 1) * SIDE;
    const y = Math.pow(rand(1, i), 1.5) * SIDE;
    const bright = rand(i, 7) > 0.93;
    const r = bright ? 1.1 + rand(i, 3) * 0.9 : 0.4 + rand(i, 3) * 0.6;
    g.globalAlpha = (bright ? 0.9 : 0.35 + rand(i, 5) * 0.4) * (1 - 0.6 * (y / SIDE));
    g.fillStyle = rand(i, 9) > 0.8 ? '#ffe9c4' : '#dbe5ff';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  return new CanvasTexture(c);
}
