import type { BufferGeometry, Color, Group, MeshBasicMaterial, MeshBasicMaterialParameters, MeshLambertMaterial, MeshLambertMaterialParameters } from 'three';
import type { QualityProfile } from '../runtime/quality';
import type { ResourceTracker } from '../runtime/tracker';
import type { QrCityStyle } from '../types';

/** A street segment of ≥4 light modules. `edge`: touches the border and joins the ring road. */
export interface Run {
  axis: 'x' | 'z';
  k: number;
  a: number;
  b: number;
  edge: boolean;
}

/** Shared state handed to the scene modules (traffic, vegetation, coast, flyers). */
export interface SceneCtx {
  style: QrCityStyle;
  profile: QualityProfile;
  tracker: ResourceTracker;
  lambert(color: string | number | Color, extra?: MeshLambertMaterialParameters): MeshLambertMaterial;
  basic(color: string | number | Color, extra?: MeshBasicMaterialParameters): MeshBasicMaterial;
  geo<G extends BufferGeometry>(g: G): G;
  /** Everything that moves or decorates: hidden in the top-down view. */
  decor: Group;
  /** Scene root (lights + city). */
  root: Group;
  half: number;
  size: number;
  /** Ring radii around the QR, in modules. */
  R: { road: number; inner: number; outer: number; tree: number };
}

export interface AnimFrame {
  now: number;
  dt: number;
  /** `dt`, or 0 when motion is reduced. */
  move: number;
  /** Pop-in scale 0–1 (also fades out in the top-down view). */
  k: number;
  /** 0–1: how visible the decor is (1 in the isometric view). */
  vis: number;
}

export interface Animated {
  update(f: AnimFrame): void;
}
