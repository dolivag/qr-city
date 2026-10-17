import { MathUtils, Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { clamp01, ease } from '../util/math';
import { fitHalfHeight, ISO } from './ortho';

/** Seconds of the flight from the doorstep to the isometric view. */
export const FLIGHT_END = 9.4;
/** Seconds after which the door has closed behind the camera. */
const DOOR_CLOSE_START = 2.7;
const DOOR_CLOSE_DURATION = 1;

interface Key {
  time: number;
  target: Vector3;
  polar: number;
  azim: number;
  dist: number;
  fov: number;
  final?: boolean;
}

export interface Flight {
  keys: Key[];
  /** Applies the camera for `el` seconds since the flight started. Returns the door angle. */
  place(el: number, camera: PerspectiveCamera, aspect: number): number;
}

/**
 * Keyframes: you look at the back of the lobby, walk out backwards through the door, the door
 * closes in front of you, and the camera rises and pulls back to the isometric view
 * (a dolly zoom that flattens the perspective down to a 2° FOV, so the swap to the orthographic
 * camera is seamless).
 *
 * @param d unit vector pointing out of the facade
 * @param door center of the door on the facade
 */
export function createFlight(d: Vector3, door: Vector3, citySize: number): Flight {
  const aOut = Math.atan2(d.x, d.z); // camera on the street side, looking in
  const at = (v: Vector3, y: number) => new Vector3(v.x, y, v.z);
  const inside = { target: at(door.clone().addScaledVector(d, -0.8), 0.22), polar: 1.53, azim: aOut, dist: 0.55, fov: 68 };
  const outside = { target: at(door.clone().addScaledVector(d, -0.1), 0.24), polar: 1.47, azim: aOut, dist: 1.15, fov: 58 };
  const settle = { target: at(door, 0.3), polar: 1.3, azim: aOut, dist: 1.3, fov: 52 };
  let isoAz = ISO.azim;
  while (isoAz - aOut > Math.PI) isoAz -= 2 * Math.PI;
  while (aOut - isoAz > Math.PI) isoAz += 2 * Math.PI;
  const keys: Key[] = [
    { time: 0, ...inside },
    { time: 0.9, ...inside },
    { time: 2.6, ...outside },
    { time: 3.7, ...settle },
    { time: 4.1, ...settle },
    { time: FLIGHT_END, final: true, target: new Vector3(0, 3, 0), polar: ISO.polar, azim: isoAz, dist: 0, fov: 2 },
  ];

  return buildFlight(keys, citySize, (el) => -1.9 * (1 - ease(clamp01((el - DOOR_CLOSE_START) / DOOR_CLOSE_DURATION))));
}

/** Seconds of the flyover intro. */
export const FLYOVER_END = 7.5;

/**
 * Flyover: the camera starts outside the city, low and to the side, and sweeps around it while
 * rising and dolly-zooming (the FOV narrows to 2° as it pulls back) into the isometric view,
 * so the swap to the orthographic camera is seamless.
 */
export function createFlyover(citySize: number): Flight {
  const start = { target: new Vector3(0, 2.2, 0), polar: 1.3, azim: ISO.azim + 2.1, dist: citySize * 1.15, fov: 55 };
  const keys: Key[] = [
    { time: 0, ...start },
    { time: FLYOVER_END, final: true, target: new Vector3(0, 3, 0), polar: ISO.polar, azim: ISO.azim, dist: 0, fov: 2 },
  ];
  return buildFlight(keys, citySize, () => 0);
}

/** Interpolates the keyframes into a camera. `door` gives the door angle at each moment. */
function buildFlight(keys: Key[], citySize: number, door: (el: number) => number): Flight {
  return {
    keys,
    place(el, camera, aspect) {
      let i = 0;
      while (i < keys.length - 2 && el > keys[i + 1].time) i++;
      const a = keys[i];
      const b = keys[i + 1];
      const e = ease(clamp01((el - a.time) / (b.time - a.time)));
      const bDist = b.final ? fitHalfHeight(citySize, 0, aspect) / Math.tan(MathUtils.degToRad(b.fov / 2)) : b.dist;
      const polar = a.polar + (b.polar - a.polar) * e;
      const azim = a.azim + (b.azim - a.azim) * e;
      const dist = Math.exp(Math.log(a.dist) + (Math.log(bDist) - Math.log(a.dist)) * e);
      const fov = Math.exp(Math.log(a.fov) + (Math.log(b.fov) - Math.log(a.fov)) * e);
      const tg = a.target.clone().lerp(b.target, e);
      camera.fov = fov;
      camera.aspect = aspect;
      camera.near = Math.max(0.02, dist * 0.04);
      camera.far = dist + 300;
      camera.position.set(
        tg.x + dist * Math.sin(polar) * Math.sin(azim),
        tg.y + dist * Math.cos(polar),
        tg.z + dist * Math.sin(polar) * Math.cos(azim),
      );
      camera.lookAt(tg);
      camera.updateProjectionMatrix();
      return door(el);
    },
  };
}
