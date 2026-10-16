import { CylinderGeometry, SphereGeometry } from 'three';
import type { BufferGeometry } from 'three';
import { extrudeProfile, roundedPrism } from './geometry';

type Pt = readonly [number, number];

const KINDS: Record<string, { body: Pt[]; cab: Pt[] }> = {
  sedan: {
    body: [[-0.24, 0.07], [0.24, 0.07], [0.245, 0.13], [0.13, 0.16], [-0.2, 0.165], [-0.245, 0.13]],
    cab: [[0.11, 0.16], [0.04, 0.235], [-0.1, 0.235], [-0.17, 0.16]],
  },
  suv: {
    body: [[-0.23, 0.08], [0.23, 0.08], [0.235, 0.15], [0.15, 0.18], [-0.23, 0.185]],
    cab: [[0.13, 0.18], [0.08, 0.275], [-0.2, 0.275], [-0.215, 0.18]],
  },
  hatch: {
    body: [[-0.2, 0.07], [0.21, 0.07], [0.215, 0.13], [0.11, 0.16], [-0.2, 0.165]],
    cab: [[0.09, 0.16], [0.02, 0.24], [-0.165, 0.24], [-0.185, 0.16]],
  },
};

export interface CarKind {
  bodyGeo: BufferGeometry;
  cabGeo: BufferGeometry;
  roofGeo: BufferGeometry;
  front: number;
  rear: number;
}

export interface CarKit {
  kinds: Record<string, CarKind>;
  wheel: BufferGeometry;
  rim: BufferGeometry;
  lamp: BufferGeometry;
}

export function createCarKit(): CarKit {
  const kinds: Record<string, CarKind> = {};
  for (const [name, k] of Object.entries(KINDS)) {
    const top = k.cab[1][1] + 0.012;
    const x1 = k.cab[1][0];
    const x2 = k.cab[2][0];
    kinds[name] = {
      bodyGeo: extrudeProfile(k.body, 0.2, 0.02),
      cabGeo: extrudeProfile(k.cab, 0.17, 0.012),
      roofGeo: roundedPrism(x1 - x2 + 0.02, 0.2, 0.05)
        .scale(1, 0.014, 1)
        .translate((x1 + x2) / 2, top - 0.006, 0),
      front: Math.max(...k.body.map((p) => p[0])) + 0.02,
      rear: Math.min(...k.body.map((p) => p[0])) - 0.02,
    };
  }
  return {
    kinds,
    wheel: new CylinderGeometry(0.055, 0.055, 0.05, 18).rotateX(Math.PI / 2),
    rim: new CylinderGeometry(0.03, 0.03, 0.054, 14).rotateX(Math.PI / 2),
    lamp: new SphereGeometry(0.022, 10, 8).scale(0.5, 0.8, 1.4),
  };
}

export const CAR_KIND_NAMES = Object.keys(KINDS);
