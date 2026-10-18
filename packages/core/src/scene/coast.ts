import { CylinderGeometry, DoubleSide, Group, Mesh, Shape, ShapeGeometry, SphereGeometry } from 'three';
import type { Object3D } from 'three';
import { pick, rand, ringPoint } from '../util/math';
import type { Animated, SceneCtx } from './ctx';
import { roundedPrism } from './geometry';

/** Boats are drawn a little larger than true to scale, so they read as boats from the isometric view. */
const BOAT_SCALE = 1.5;

interface Boat { obj: Object3D; R: number; s: number; v: number }

/** Lighthouse and sailing boats around a city that stands in the sea (`palette.water`). */
export function createCoast(ctx: SceneCtx): Animated | null {
  if (!ctx.style.palette.water) return null;
  const { decor, lambert, basic, geo, R, half, size } = ctx;

  const lh = new Group();
  for (let k = 0; k < 5; k++) {
    const seg = new Mesh(
      geo(new CylinderGeometry(0.22 - k * 0.02, 0.24 - k * 0.02, 0.4, 16).translate(0, 0.2, 0)),
      lambert(k % 2 ? 0xf4a5a0 : 0xffffff),
    );
    seg.position.y = k * 0.4;
    seg.castShadow = true;
    lh.add(seg);
  }
  const lamp = new Mesh(geo(new SphereGeometry(0.15, 14, 10)), basic(0xfff3c4));
  lamp.position.y = 2.15;
  lh.add(lamp);
  lh.position.set(R.tree + 0.1, 0, R.tree + 0.1);
  decor.add(lh);

  const hullGeo = geo(roundedPrism(0.55, 0.22, 0.1).scale(1, 0.1, 1));
  const sail = new Shape();
  sail.moveTo(0, 0);
  sail.lineTo(0.3, 0);
  sail.lineTo(0, 0.5);
  sail.lineTo(0, 0);
  const sailGeo = geo(new ShapeGeometry(sail).translate(-0.12, 0.1, 0));
  const sailMat = lambert(0xffffff, { side: DoubleSide });
  // Boats sail in the middle of the open water: between the beach (half + 4.75) and the edge of the slab
  const R_boat = (half + 4.75 + size / 2) / 2;
  const boats: Boat[] = [];
  for (let i = 0; i < 6; i++) {
    const b = new Group();
    b.add(new Mesh(hullGeo, lambert(pick([0xffffff, 0xf6d38a, 0xf4a5a0], rand(i, 4)))));
    b.add(new Mesh(sailGeo, sailMat));
    decor.add(b);
    b.userData.big = true;
    boats.push({ obj: b, R: R_boat, s: i * ((8 * R_boat) / 6), v: 0.25 + rand(i, 6) * 0.15 });
  }

  return {
    update({ now, move, k }) {
      lh.scale.setScalar(k);
      for (const b of boats) {
        b.s += b.v * move;
        const [x, z, ang] = ringPoint(b.R, b.s);
        b.obj.position.set(x, Math.sin(now / 500 + b.s) * 0.03, z);
        b.obj.rotation.y = -ang;
        b.obj.rotation.x = Math.sin(now / 700 + b.s) * 0.06;
        b.obj.scale.setScalar(k * BOAT_SCALE);
      }
    },
  };
}
