import { Vector3 } from 'three';
import type { OrthographicCamera } from 'three';
import { ease } from '../util/math';

export const ISO = { polar: Math.atan(Math.SQRT2), azim: Math.PI / 4 };
const TOP = { polar: 0.0001, azim: 0 };
const DISTANCE = 150;

/** Half of the visible height that frames the whole city at view progress `e` (already eased). */
export function fitHalfHeight(citySize: number, e: number, aspect: number): number {
  const fit = (citySize * (1.66 + (1.06 - 1.66) * e)) / 2;
  return aspect >= 1 ? fit : fit / aspect;
}

/**
 * Orthographic camera that interpolates between the isometric view (t=0) and the
 * top-down view (t=1), keeping the whole city framed for any canvas aspect ratio.
 * `zoom` ≥ 1 magnifies around the point (`panX`, `panZ`) of the ground.
 */
export function placeOrtho(camera: OrthographicCamera, t: number, citySize: number, aspect: number, zoom = 1, panX = 0, panZ = 0): void {
  const e = ease(t);
  const polar = ISO.polar + (TOP.polar - ISO.polar) * e;
  const azim = ISO.azim + (TOP.azim - ISO.azim) * e;
  camera.position.set(
    panX + DISTANCE * Math.sin(polar) * Math.sin(azim),
    DISTANCE * Math.cos(polar),
    panZ + DISTANCE * Math.sin(polar) * Math.cos(azim),
  );
  camera.lookAt(panX, (1 - e) * 3, panZ);
  const vh = fitHalfHeight(citySize, e, aspect) / zoom;
  camera.left = -vh * aspect;
  camera.right = vh * aspect;
  camera.top = vh;
  camera.bottom = -vh;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

const _right = new Vector3();
const _up = new Vector3();
const _fwd = new Vector3();
const _origin = new Vector3();

/**
 * Point of the ground (y = 0) under normalized screen coordinates (−1…1, y up), for the
 * camera as last placed with {@link placeOrtho}.
 */
export function groundPointAt(camera: OrthographicCamera, ndcX: number, ndcY: number): { x: number; z: number } {
  camera.matrixWorld.extractBasis(_right, _up, _fwd);
  _fwd.negate(); // the camera looks down its local -z
  _origin.copy(camera.position).addScaledVector(_right, ndcX * camera.right).addScaledVector(_up, ndcY * camera.top);
  const s = Math.abs(_fwd.y) < 1e-6 ? 0 : -_origin.y / _fwd.y;
  return { x: _origin.x + _fwd.x * s, z: _origin.z + _fwd.z * s };
}
