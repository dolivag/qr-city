import { ExtrudeGeometry, Shape, SphereGeometry } from 'three';
import type { BufferGeometry } from 'three';

/** Rounded-corner prism: footprint w×d, height 1, base at y=0. */
export function roundedPrism(w: number, d: number, r: number, seg = 5): ExtrudeGeometry {
  const s = new Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: seg });
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Soft organic canopy: a sphere with gentle sinusoidal deformation. */
export function blobGeo(seed: number, detail = 1): BufferGeometry {
  const g = new SphereGeometry(1, Math.max(8, Math.round(22 * detail)), Math.max(6, Math.round(16 * detail)));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const n = 1 + 0.1 * Math.sin(x * 4 + seed) * Math.sin(y * 5 + seed * 2) + 0.06 * Math.sin(z * 7 + seed * 3);
    p.setXYZ(i, x * n, y * n * 0.9, z * n);
  }
  g.computeVertexNormals();
  return g;
}

/** Extrudes a 2D side profile along z (centered), with small bevels. */
export function extrudeProfile(pts: readonly (readonly [number, number])[], depth: number, bevel: number): BufferGeometry {
  const s = new Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  const g = new ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 4,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}
