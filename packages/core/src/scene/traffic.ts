import { CylinderGeometry, Group, Mesh, SphereGeometry } from 'three';
import type { Object3D } from 'three';
import { pick, rand, ringPoint } from '../util/math';
import { CAR_KIND_NAMES, createCarKit } from './cars';
import type { Animated, Run, SceneCtx } from './ctx';

interface RingCar { obj: Object3D; type: 'ring'; R: number; s: number; v: number }
interface RunCar { obj: Object3D; type: 'run'; run: Run; s: number; v: number; dir: number }
interface Person { obj: Object3D; R: number; s: number; v: number; phase: number }

/** Cars on the ring road and the streets, and pedestrians on the sidewalks. */
export function createTraffic(ctx: SceneCtx, runs: Run[]): Animated {
  const { style: S, profile, decor, lambert, basic, geo, R } = ctx;
  const kit = createCarKit();
  for (const k of Object.values(kit.kinds)) { geo(k.bodyGeo); geo(k.cabGeo); geo(k.roofGeo); }
  geo(kit.wheel); geo(kit.rim); geo(kit.lamp);
  const glass = S.traffic.glow ? basic(0x1a1430) : lambert(0x7d8aa6);
  const tyre = lambert(0x4a5163);
  const rim = lambert(0xe8ebf2);
  const headM = basic(0xfff8e0);
  const tailM = basic(0xff7b7b);

  const makeCar = (i: number) => {
    const car = new Group();
    const K = kit.kinds[pick(CAR_KIND_NAMES, rand(i, 21))];
    const color = S.traffic.carColors[i % S.traffic.carColors.length];
    const paint = S.traffic.glow ? basic(color) : lambert(color);
    const body = new Mesh(K.bodyGeo, paint);
    const cab = new Mesh(K.cabGeo, glass);
    const roof = new Mesh(K.roofGeo, paint);
    body.castShadow = cab.castShadow = true;
    car.add(body, cab, roof);
    for (const x of [K.front - 0.09, K.rear + 0.09]) {
      for (const z of [-0.105, 0.105]) {
        const w = new Mesh(kit.wheel, tyre);
        const rm = new Mesh(kit.rim, rim);
        w.position.set(x, 0.055, z);
        rm.position.set(x, 0.055, z);
        car.add(w, rm);
      }
    }
    for (const z of [-0.07, 0.07]) {
      const hl = new Mesh(kit.lamp, headM);
      hl.position.set(K.front, 0.125, z);
      const tl = new Mesh(kit.lamp, tailM);
      tl.position.set(K.rear, 0.13, z);
      car.add(hl, tl);
    }
    decor.add(car);
    return car;
  };

  const cars: (RingCar | RunCar)[] = [];
  const perim = 8 * R.road;
  for (let i = 0; i < profile.ringCars; i++) {
    const lane = i % 2 ? 1 : -1;
    cars.push({
      obj: makeCar(i), type: 'ring', R: R.road + lane * 0.36,
      s: (i / profile.ringCars) * perim, v: (0.9 + rand(i, 3) * 0.5) * (lane > 0 ? 1 : -1),
    });
  }
  runs.slice().sort((p, q) => Number(q.edge) - Number(p.edge) || rand(p.k, p.a) - rand(q.k, q.a))
    .slice(0, profile.runCars)
    .forEach((run, i) => {
      cars.push({ obj: makeCar(i + 3), type: 'run', run, s: rand(i, 11), v: 0.6 + rand(11, i) * 0.5, dir: rand(i, 12) > 0.5 ? 1 : -1 });
    });

  const personBody = geo(new CylinderGeometry(0.05, 0.065, 0.17, 12).translate(0, 0.12, 0));
  const personHead = geo(new SphereGeometry(0.052, 14, 10).translate(0, 0.26, 0));
  const skin = lambert(0xf2d2bb);
  const people: Person[] = [];
  for (let i = 0; i < profile.people; i++) {
    const p = new Group();
    const b = new Mesh(personBody, lambert(S.traffic.carColors[i % S.traffic.carColors.length]));
    b.castShadow = true;
    p.add(b, new Mesh(personHead, skin));
    decor.add(p);
    const r = (i % 2 ? R.outer - 0.25 : R.inner) + (rand(i, 5) - 0.5) * 0.25;
    people.push({ obj: p, R: r, s: rand(i, 1) * 8 * r, v: (0.12 + rand(1, i) * 0.12) * (rand(i, 2) > 0.5 ? 1 : -1), phase: rand(i, 4) * 6 });
  }

  return {
    update({ now, move, k }) {
      for (const c of cars) {
        if (c.type === 'ring') {
          c.s += c.v * move;
          const [x, z, ang] = ringPoint(c.R, c.s);
          c.obj.position.set(x, 0, z);
          c.obj.rotation.y = -(ang + (c.v < 0 ? Math.PI : 0));
        } else {
          const L = c.run.b - c.run.a;
          c.s += (c.v * move * c.dir) / Math.max(1, L);
          if (c.s > 1) { c.s = 1; c.dir = -1; }
          if (c.s < 0) { c.s = 0; c.dir = 1; }
          const along = c.run.a + c.s * L;
          const fixed = c.run.k;
          if (c.run.axis === 'x') { c.obj.position.set(along, 0, fixed + 0.17 * c.dir); c.obj.rotation.y = c.dir > 0 ? 0 : Math.PI; }
          else { c.obj.position.set(fixed - 0.17 * c.dir, 0, along); c.obj.rotation.y = c.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
        }
        c.obj.scale.setScalar(k);
      }
      for (const p of people) {
        p.s += p.v * move;
        const [x, z, ang] = ringPoint(p.R, p.s);
        p.obj.position.set(x, Math.abs(Math.sin(now / 160 + p.phase)) * 0.03, z);
        p.obj.rotation.y = -ang;
        p.obj.scale.setScalar(k);
      }
    },
  };
}
