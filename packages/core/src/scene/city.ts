import {
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  ShadowMaterial,
  SphereGeometry,
  Color,
} from 'three';
import type { MeshBasicMaterialParameters, MeshLambertMaterialParameters ,
  BufferGeometry,
  Object3D} from 'three';
import type { QrMatrix } from '../qr/matrix';
import type { QualityProfile } from '../runtime/quality';
import { ResourceTracker } from '../runtime/tracker';
import type { QrCityStyle } from '../types';
import { clamp01, pick, rand, ringPoint, smooth } from '../util/math';
import { CAR_KIND_NAMES, createCarKit } from './cars';
import { col } from './color';
import { blobGeo, roundedPrism } from './geometry';

/** three ≥ r155 dropped the legacy ×π light scaling; this keeps the look of the original r128 prototype. */
const LIGHT_SCALE = Math.PI;
const MAX_GROUND_TEXTURE = 4096;

export interface CityFrame {
  now: number;
  dt: number;
  /** View progress: 0 isometric … 1 top-down. */
  t: number;
  reduce: boolean;
}

export interface City {
  /** Lights + city; add it to the scene. */
  root: Group;
  /** Seconds from the first frame until every building has risen. */
  riseDuration: number;
  /** Half the side of the QR area plus its quiet zone, in modules. */
  size: number;
  update(frame: CityFrame): void;
  dispose(): void;
}

interface RingCar { obj: Object3D; type: 'ring'; R: number; s: number; v: number }
interface RunCar { obj: Object3D; type: 'run'; run: Run; s: number; v: number; dir: number }
interface Person { obj: Object3D; R: number; s: number; v: number; phase: number }
interface Flock { group: Group; birds: Object3D[]; R: number; h: number; speed: number; a: number }
interface Run { axis: 'x' | 'z'; k: number; a: number; b: number; edge: boolean }
interface Bird extends Object3D { userData: { pl: Object3D; pr: Object3D; phase: number; flapSpeed: number } }

export function createCity(style: QrCityStyle, qr: QrMatrix, profile: QualityProfile): City {
  const tracker = new ResourceTracker();
  const S = style;
  const P = style.palette;
  const seg = Math.max(2, Math.round(5 * profile.detail));

  const lambert = (color: string | number | Color, extra: MeshLambertMaterialParameters = {}) =>
    tracker.track(new MeshLambertMaterial({ color: col(color), ...extra }));
  const basic = (color: string | number | Color, extra: MeshBasicMaterialParameters = {}) =>
    tracker.track(new MeshBasicMaterial({ color: col(color), ...extra }));
  const geo = <G extends BufferGeometry>(g: G): G => tracker.track(g);

  const root = new Group();
  const hemi = new HemisphereLight(col(P.hemiSky), col(P.hemiGround), P.hemiIntensity * LIGHT_SCALE);
  const sun = new DirectionalLight(col(P.sun), P.sunIntensity * LIGHT_SCALE);
  sun.castShadow = profile.shadows;
  sun.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
  sun.shadow.bias = -0.0006;
  sun.shadow.radius = 4;
  const city = new Group();
  const decor = new Group();
  city.add(decor);
  root.add(hemi, sun, sun.target, city);

  const n = qr.size;
  const half = n / 2;
  const quiet = S.quietZone;
  const size = n + quiet * 2;
  const R_road = half + 2.1;
  const R_in = half + 0.75;
  const R_out = half + 3.55;
  const R_tree = half + 4.25;
  const toW = (i: number) => i - half + 0.5;

  // ---- Streets: runs of ≥4 light modules; the ones touching the border connect to the ring road
  const runs: Run[] = [];
  const scan = (axis: 'x' | 'z') => {
    for (let k = 0; k < n; k++) {
      let start = -1;
      for (let i = 0; i <= n; i++) {
        const light = i < n && !(axis === 'x' ? qr.isDark(k, i) : qr.isDark(i, k));
        if (light && start < 0) start = i;
        if (!light && start >= 0) {
          if (i - start >= 4) {
            runs.push({
              axis,
              k: toW(k),
              a: start === 0 ? -R_road : toW(start),
              b: i === n ? R_road : toW(i - 1),
              edge: start === 0 || i === n,
            });
          }
          start = -1;
        }
      }
    }
  };
  scan('x');
  scan('z');

  // ---- Painted ground
  const px = Math.max(8, Math.min(profile.groundPx, Math.floor(MAX_GROUND_TEXTURE / size)));
  const cv = document.createElement('canvas');
  cv.width = cv.height = Math.round(size * px);
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  const W = (x: number) => (x + size / 2) * px;
  g.fillStyle = P.walk;
  g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = P.ground;
  g.fillRect(W(-half - 0.25), W(-half - 0.25), (n + 0.5) * px, (n + 0.5) * px);
  g.lineCap = 'round';
  g.strokeStyle = P.road;
  g.lineWidth = 1.5 * px;
  g.strokeRect(W(-R_road), W(-R_road), 2 * R_road * px, 2 * R_road * px);
  g.lineWidth = 0.72 * px;
  for (const r of runs) {
    g.beginPath();
    if (r.axis === 'x') { g.moveTo(W(r.a), W(r.k)); g.lineTo(W(r.b), W(r.k)); }
    else { g.moveTo(W(r.k), W(r.a)); g.lineTo(W(r.k), W(r.b)); }
    g.stroke();
  }
  g.strokeStyle = P.dash;
  g.setLineDash([0.35 * px, 0.35 * px]);
  g.lineWidth = 0.06 * px;
  g.lineCap = 'butt';
  g.strokeRect(W(-R_road), W(-R_road), 2 * R_road * px, 2 * R_road * px);
  for (const r of runs) {
    g.beginPath();
    if (r.axis === 'x') { g.moveTo(W(r.a + 0.3), W(r.k)); g.lineTo(W(r.b - 0.3), W(r.k)); }
    else { g.moveTo(W(r.k), W(r.a + 0.3)); g.lineTo(W(r.k), W(r.b - 0.3)); }
    g.stroke();
  }
  g.setLineDash([]);
  const groundTex = tracker.track(new CanvasTexture(cv));
  groundTex.anisotropy = 4;

  const baseH = 1.4;
  const base = new Mesh(geo(roundedPrism(size, size, 1.2, seg * 2)), lambert(P.base));
  base.scale.y = baseH;
  base.position.y = -baseH - 0.002;
  city.add(base);

  const gGeo = geo(roundedPrism(size, size, 1.2, seg * 2));
  const guv = gGeo.attributes.uv;
  const gpos = gGeo.attributes.position;
  for (let i = 0; i < guv.count; i++) {
    guv.setXY(i, (gpos.getX(i) + size / 2) / size, 1 - (gpos.getZ(i) + size / 2) / size);
  }
  const ground = new Mesh(gGeo, [basic(0xffffff, { map: groundTex }), lambert(P.base)]);
  ground.scale.y = 0.001;
  city.add(ground);

  let shadowMat: ShadowMaterial | null = null;
  if (profile.shadows) {
    shadowMat = tracker.track(new ShadowMaterial({ opacity: 0.14 }));
    const plane = new Mesh(geo(new PlaneGeometry(size, size).rotateX(-Math.PI / 2)), shadowMat);
    plane.position.y = 0.01;
    plane.receiveShadow = true;
    city.add(plane);
  }

  // ---- Buildings: every dark module is a building; roofs are flat, unlit, dark
  const roofMat = basic(P.roof);
  const facade = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const f = c.getContext('2d') as CanvasRenderingContext2D;
    const round = (x: number, y: number, w: number, h: number, r: number) => {
      f.beginPath();
      if (f.roundRect) f.roundRect(x, y, w, h, r); else f.rect(x, y, w, h);
      f.fill();
    };
    f.fillStyle = '#ffffff';
    f.fillRect(0, 0, 64, 64);
    f.fillStyle = S.buildings.windowColor;
    round(12, 18, 40, 28, 8);
    f.fillStyle = 'rgba(255,255,255,0.55)';
    round(15, 21, 16, 6, 3);
    const t = tracker.track(new CanvasTexture(c));
    t.wrapS = t.wrapT = RepeatWrapping;
    t.anisotropy = 4;
    return t;
  })();
  const towerMats = P.towers.map((c) => lambert(c, { map: facade }));
  const houseMats = P.houses.map((c) => lambert(c));

  const towerCache = new Map<number, BufferGeometry>();
  const towerGeo = (floors: number) => {
    const hit = towerCache.get(floors);
    if (hit) return hit;
    const tg = geo(roundedPrism(0.96, 0.96, 0.14, seg));
    const uv = tg.attributes.uv;
    const side = tg.groups.find((gr) => gr.materialIndex === 1);
    if (side) {
      for (let i = side.start; i < side.start + side.count; i++) {
        const v = tg.index ? tg.index.getX(i) : i;
        uv.setXY(v, uv.getX(v) * 2.1 + 0.5, uv.getY(v) * floors);
      }
    }
    towerCache.set(floors, tg);
    return tg;
  };
  const houseGeo = geo(roundedPrism(0.8, 0.8, 0.12, seg));
  const roofGeo = geo(new ConeGeometry(0.68, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0));
  const capGeo = geo(roundedPrism(0.55, 0.55, 0.12, seg));
  const unitGeo = geo(roundedPrism(0.34, 0.28, 0.08, seg));
  const mastGeo = geo(new CylinderGeometry(0.025, 0.035, 1, 8).translate(0, 0.5, 0));

  const inFinder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const buildings: Group[] = [];
  let maxDelay = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      const x = toW(c);
      const z = toW(r);
      const dist = Math.hypot(x, z) / (half * 1.41);
      const rr = rand(r, c);
      const grp = new Group();
      grp.position.set(x, 0, z);
      let kind: 'sky' | 'house' | 'mid';
      if (inFinder(r, c)) kind = 'sky';
      else if (rr > S.buildings.skyBias + dist * 0.6) kind = 'sky';
      else if (rr < S.buildings.houseBias + dist * 0.55) kind = 'house';
      else kind = 'mid';

      if (kind === 'house') {
        const wallH = 0.38 + rand(c, r) * 0.18;
        const walls = new Mesh(houseGeo, pick(houseMats, rand(r + 9, c)));
        walls.scale.y = wallH;
        const roof = new Mesh(roofGeo, roofMat);
        roof.scale.set(1, 0.38, 1);
        roof.position.y = wallH;
        grp.add(walls, roof);
      } else {
        let h = kind === 'sky'
          ? (inFinder(r, c) ? 7 + rand(r, c * 2) * 2 : 5.5 + Math.pow(rr, 1.5) * 9 * (1 - dist * 0.5))
          : 1.3 + rand(c * 2, r) * 2.6;
        h = Math.max(0.9, h * S.buildings.heightMul);
        const floors = Math.max(2, Math.round(h / 0.42));
        const body = new Mesh(towerGeo(floors), [roofMat, pick(towerMats, rand(c, r))]);
        body.scale.y = h;
        grp.add(body);
        if (kind === 'sky' && rand(r * 5, c) > 0.45) {
          const cap = new Mesh(capGeo, roofMat);
          cap.scale.y = 0.55;
          cap.position.y = h;
          const mast = new Mesh(mastGeo, roofMat);
          mast.position.y = h + 0.55;
          grp.add(cap, mast);
        } else if (rand(r, c * 7) > 0.6) {
          const unit = new Mesh(unitGeo, roofMat);
          unit.scale.y = 0.2;
          unit.position.y = h;
          grp.add(unit);
        }
      }
      grp.traverse((o) => { o.castShadow = true; });
      grp.userData.delay = Math.hypot(x, z) * 0.03 + rand(r * 3, c) * 0.2;
      maxDelay = Math.max(maxDelay, grp.userData.delay as number);
      grp.scale.y = 0.001;
      city.add(grp);
      buildings.push(grp);
    }
  }

  // ---- Cars
  const kit = createCarKit();
  Object.values(kit.kinds).forEach((k) => { geo(k.bodyGeo); geo(k.cabGeo); geo(k.roofGeo); });
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
  const perim = 8 * R_road;
  for (let i = 0; i < profile.ringCars; i++) {
    const lane = i % 2 ? 1 : -1;
    cars.push({
      obj: makeCar(i), type: 'ring', R: R_road + lane * 0.36,
      s: (i / profile.ringCars) * perim, v: (0.9 + rand(i, 3) * 0.5) * (lane > 0 ? 1 : -1),
    });
  }
  runs.slice().sort((p, q) => Number(q.edge) - Number(p.edge) || rand(p.k, p.a) - rand(q.k, q.a))
    .slice(0, profile.runCars)
    .forEach((run, i) => {
      cars.push({ obj: makeCar(i + 3), type: 'run', run, s: rand(i, 11), v: 0.6 + rand(11, i) * 0.5, dir: rand(i, 12) > 0.5 ? 1 : -1 });
    });

  // ---- Pedestrians
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
    const R = (i % 2 ? R_out - 0.25 : R_in) + (rand(i, 5) - 0.5) * 0.25;
    people.push({ obj: p, R, s: rand(i, 1) * 8 * R, v: (0.12 + rand(1, i) * 0.12) * (rand(i, 2) > 0.5 ? 1 : -1), phase: rand(i, 4) * 6 });
  }

  // ---- Trees and street lamps
  const blobs = [blobGeo(1, profile.detail), blobGeo(2.7, profile.detail), blobGeo(4.1, profile.detail)].map(geo);
  const treeColors = S.vegetation.colors;
  const treeMats = treeColors.map((c) => lambert(c));
  const tint = (hex: string, k: number) => {
    const c = col(hex);
    return k >= 0 ? c.lerp(new Color(1, 1, 1), k) : c.multiplyScalar(1 + k);
  };
  const hiMats = treeColors.map((c) => lambert(tint(c, 0.28)));
  const loMats = treeColors.map((c) => lambert(tint(c, -0.12)));
  const trunkMat = lambert(0xc4a48d);
  const lampMat = lambert(0x9aa3b8);
  const bulbMat = basic(0xfff6d8);
  const lampGeo = geo(new CylinderGeometry(0.022, 0.022, 0.7, 8).translate(0, 0.35, 0));
  const bulbGeo = geo(new SphereGeometry(0.05, 10, 8).translate(0, 0.72, 0));
  const trunk = geo(new CylinderGeometry(0.025, 0.045, 0.4, 10).translate(0, 0.2, 0));
  const branch = geo(new CylinderGeometry(0.01, 0.018, 0.2, 6).translate(0, 0.1, 0));
  const makeLamp = () => {
    const l = new Group();
    l.add(new Mesh(lampGeo, lampMat), new Mesh(bulbGeo, bulbMat));
    return l;
  };
  const makeTree = (i: number) => {
    const o = new Group();
    const ci = Math.floor(rand(i, 9) * treeColors.length) % treeColors.length;
    const s = 0.85 + rand(i, 8) * 0.4;
    const put = (g2: BufferGeometry, mt: MeshLambertMaterial, x: number, y: number, z: number, sc?: number) => {
      const m = new Mesh(g2, mt);
      m.position.set(x, y, z);
      if (sc) m.scale.setScalar(sc);
      m.castShadow = true;
      o.add(m);
      return m;
    };
    put(trunk, trunkMat, 0, 0, 0);
    put(branch, trunkMat, 0, 0.3, 0).rotation.z = 0.7;
    put(branch, trunkMat, 0, 0.34, 0).rotation.z = -0.6;
    const crown: [number, number, number, number, MeshLambertMaterial[]][] = [
      [0, 0.6, 0, 0.26, loMats], [0.14, 0.54, 0.05, 0.19, loMats], [-0.13, 0.56, -0.06, 0.2, loMats],
      [0.03, 0.77, 0.03, 0.22, treeMats], [-0.06, 0.72, 0.1, 0.16, treeMats], [0.05, 0.92, -0.02, 0.13, hiMats],
    ];
    crown.forEach(([x, y, z, r, mats], k) => {
      put(blobs[k % 3], mats[ci], x * s, y * s, z * s, r * s).rotation.y = rand(i, k) * 6;
    });
    return o;
  };
  const props: Object3D[] = [];
  const steps = Math.floor((8 * R_tree) / profile.propStep);
  for (let i = 0; i < steps; i++) {
    const [x, z] = ringPoint(R_tree, i * profile.propStep + 0.3);
    const o = i % 5 === 4 ? makeLamp() : makeTree(i);
    o.position.set(x, 0, z);
    decor.add(o);
    props.push(o);
  }
  for (let i = 0; i < Math.floor((8 * R_in) / 2.2); i++) {
    const [x, z] = ringPoint(R_in + 0.2, i * 2.2 + 1);
    const l = makeLamp();
    l.position.set(x, 0, z);
    decor.add(l);
    props.push(l);
  }

  // ---- Birds
  const flocks: Flock[] = [];
  {
    const bodyGeo = geo(new SphereGeometry(0.09, 12, 8).scale(1.8, 0.8, 0.8));
    const ws = new Shape();
    ws.moveTo(0, 0);
    ws.quadraticCurveTo(0.12, 0.08, 0.04, 0.42);
    ws.quadraticCurveTo(-0.08, 0.2, -0.1, 0);
    ws.lineTo(0, 0);
    const wingGeo = geo(new ShapeGeometry(ws, 8).rotateX(-Math.PI / 2));
    const mat = lambert(S.flyers.color, { side: DoubleSide });
    for (let f = 0; f < profile.flocks; f++) {
      const fl: Flock = {
        group: new Group(), birds: [], R: half * (0.45 + f * 0.25), h: 13 + f * 1.8,
        speed: (0.16 + f * 0.04) * (f % 2 ? -1 : 1), a: f * 2.1,
      };
      const count = 5 + f;
      for (let b = 0; b < count; b++) {
        const bird = new Group() as unknown as Bird;
        const pl = new Group();
        const pr = new Group();
        const wl = new Mesh(wingGeo, mat);
        const wr = new Mesh(wingGeo, mat);
        wr.scale.z = -1;
        pl.add(wl);
        pr.add(wr);
        bird.add(new Mesh(bodyGeo, mat), pl, pr);
        const sd = b % 2 ? 1 : -1;
        const row = Math.ceil(b / 2);
        bird.position.set(-row * 0.55, (rand(b, f) - 0.5) * 0.4, sd * row * 0.45);
        bird.userData = { pl, pr, phase: rand(b, f * 3) * 6, flapSpeed: 110 };
        fl.group.add(bird);
        fl.birds.push(bird);
      }
      decor.add(fl.group);
      flocks.push(fl);
    }
  }

  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -size * 0.85;
  sc.right = sc.top = size * 0.85;
  sc.near = 1;
  sc.far = 200;
  sc.updateProjectionMatrix();
  sun.position.set(-size * 0.9, size * 1.6, size * 0.5);

  // ---- Animation
  let born = -1;
  const riseDuration = maxDelay + 0.9;

  function update({ now, dt, t, reduce }: CityFrame) {
    if (born < 0) born = now;
    const el = (now - born) / 1000;
    for (const b of buildings) {
      const k = reduce ? 1 : clamp01((el - (b.userData.delay as number)) / 0.9);
      b.scale.y = Math.max(0.001, 1 - Math.pow(1 - k, 3));
    }
    const vis = 1 - smooth(0.05, 0.55, t);
    decor.visible = vis > 0.01;
    if (shadowMat) shadowMat.opacity = 0.14 * (1 - smooth(0.2, 0.9, t));
    const pop = reduce ? 1 : clamp01((el - 0.6) / 0.8);
    const k = vis * (1 - Math.pow(1 - pop, 3));
    const move = reduce ? 0 : dt;

    if (decor.visible) {
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
      for (const pr of props) pr.scale.setScalar(k);
      for (const f of flocks) {
        f.a += f.speed * move;
        f.group.position.set(Math.cos(f.a) * f.R, f.h + Math.sin(now / 900 + f.R) * 0.4, Math.sin(f.a) * f.R);
        f.group.rotation.y = -f.a - (f.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
        f.group.scale.setScalar(k);
        for (const b of f.birds as Bird[]) {
          const flap = reduce ? 0.3 : Math.sin(now / b.userData.flapSpeed + b.userData.phase) * 0.8;
          b.userData.pl.rotation.x = flap;
          b.userData.pr.rotation.x = -flap;
        }
      }
    }
    city.position.y = reduce ? 0 : Math.sin(now / 1600) * 0.12 * (1 - t);
  }

  function dispose() {
    tracker.disposeTree(root);
    tracker.dispose();
    sun.shadow.map?.dispose();
    root.removeFromParent();
    root.clear();
  }

  return { root, riseDuration, size, update, dispose };
}
