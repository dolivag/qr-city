import type { OrthographicCamera } from 'three';
import { ease } from '../util/math';

const ISO = { polar: Math.atan(Math.SQRT2), azim: Math.PI / 4 };
const TOP = { polar: 0.0001, azim: 0 };
const DISTANCE = 150;

/**
 * Orthographic camera that interpolates between the isometric view (t=0) and the
 * top-down view (t=1), keeping the whole city framed for any canvas aspect ratio.
 */
export function placeOrtho(camera: OrthographicCamera, t: number, citySize: number, aspect: number): void {
  const e = ease(t);
  const polar = ISO.polar + (TOP.polar - ISO.polar) * e;
  const azim = ISO.azim + (TOP.azim - ISO.azim) * e;
  camera.position.set(
    DISTANCE * Math.sin(polar) * Math.sin(azim),
    DISTANCE * Math.cos(polar),
    DISTANCE * Math.sin(polar) * Math.cos(azim),
  );
  camera.lookAt(0, (1 - e) * 3, 0);
  const fit = (citySize * (1.66 + (1.06 - 1.66) * e)) / 2;
  const vh = aspect >= 1 ? fit : fit / aspect;
  camera.left = -vh * aspect;
  camera.right = vh * aspect;
  camera.top = vh;
  camera.bottom = -vh;
  camera.updateProjectionMatrix();
}
