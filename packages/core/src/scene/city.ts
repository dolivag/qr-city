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
  ShadowMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import type { BufferGeometry, MeshBasicMaterialParameters, MeshLambertMaterialParameters ,
  Color} from 'three';
import type { QrMatrix } from '../qr/matrix';
import type { QualityProfile } from '../runtime/quality';
import { ResourceTracker } from '../runtime/tracker';
import { moderna } from '../styles/moderna';
import type { QrCityStyle } from '../types';
import { clamp01, pick, rand, smooth } from '../util/math';
import { createCoast } from './coast';
import { col } from './color';
import type { Run, SceneCtx } from './ctx';
import { createDoorKit } from './door';
import { createFlyers } from './flyers';
import { roundedPrism } from './geometry';
import { createTraffic } from './traffic';
import { createVegetation } from './vegetation';

/** three ≥ r155 dropped the legacy ×π light scaling; this keeps the look of the original r128 prototype. */
const LIGHT_SCALE = Math.PI;
const MAX_GROUND_TEXTURE = 4096;
/** Side of a building as a fraction of its module while the city is seen from the side. */
const BUILDING_FOOTPRINT = 0.96;
/** Side of a building as a fraction of its module in the top-down view (slightly over 1, so roofs overlap). */
const TOP_FOOTPRINT = 1.08;

export interface CityFrame {
  now: number;
  dt: number;
  /** View progress: 0 isometric … 1 top-down. */
  t: number;
  reduce: boolean;
  /** Gentle up-and-down floating of the whole city. Default `true`. */
  bob?: boolean;
}

/** The small door built into one of the buildings, where the door intro comes out. */
export interface DoorInfo {
  /** Unit vector pointing out of the facade. */
  d: Vector3;
  /** Center of the door on the facade. */
  facade: Vector3;
  hinge: Group;
}

export interface CityOptions {
  /** Buildings rise from the ground. When `false` the city is complete from the first frame. */
  rise?: boolean;
}

export interface City {
  /** Lights + city; add it to the scene. */
  root: Group;
  /** Seconds from the first frame until every building has risen. */
  riseDuration: number;
  /** Side of the city slab, in modules. */
  size: number;
  door: DoorInfo | null;
  update(frame: CityFrame): void;
  /** Points the sun's shadow at what is on screen, so shadows stay sharp when zoomed in. */
  setFocus(x: number, z: number, zoom: number): void;
  dispose(): void;
}

export function createCity(style: QrCityStyle, qr: QrMatrix, profile: QualityProfile, options: CityOptions = {}): City {
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
  const R = { road: half + 2.1, inner: half + 0.75, outer: half + 3.55, tree: half + 4.25 };
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
              a: start === 0 ? -R.road : toW(start),
              b: i === n ? R.road : toW(i - 1),
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
  const rrect = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
    g.fill();
  };
  if (P.water) {
    g.fillStyle = P.water;
    g.fillRect(0, 0, cv.width, cv.height);
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 0.05 * px;
    for (let i = 0; i < 40; i++) {
      const x = rand(i, 1) * cv.width;
      const y = rand(1, i) * cv.height;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 0.3 * px, y - 0.15 * px, x + 0.6 * px, y);
      g.stroke();
    }
    g.fillStyle = P.walk;
    const R_sand = half + 4.75;
    rrect(W(-R_sand), W(-R_sand), 2 * R_sand * px, 2 * R_sand * px, 0.8 * px);
  } else {
    g.fillStyle = P.walk;
    g.fillRect(0, 0, cv.width, cv.height);
  }
  g.fillStyle = P.ground;
  g.fillRect(W(-half - 0.25), W(-half - 0.25), (n + 0.5) * px, (n + 0.5) * px);
  if (P.grid) {
    g.strokeStyle = P.grid;
    g.lineWidth = 0.03 * px;
    for (let i = -half; i <= half; i++) {
      g.beginPath(); g.moveTo(W(i), W(-half)); g.lineTo(W(i), W(half)); g.stroke();
      g.beginPath(); g.moveTo(W(-half), W(i)); g.lineTo(W(half), W(i)); g.stroke();
    }
  }
  g.lineCap = 'round';
  g.strokeStyle = P.road;
  g.lineWidth = 1.5 * px;
  g.strokeRect(W(-R.road), W(-R.road), 2 * R.road * px, 2 * R.road * px);
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
  g.strokeRect(W(-R.road), W(-R.road), 2 * R.road * px, 2 * R.road * px);
  for (const r of runs) {
    g.beginPath();
    if (r.axis === 'x') { g.moveTo(W(r.a + 0.3), W(r.k)); g.lineTo(W(r.b - 0.3), W(r.k)); }
    else { g.moveTo(W(r.k), W(r.a + 0.3)); g.lineTo(W(r.k), W(r.b - 0.3)); }
    g.stroke();
  }
  g.setLineDash([]);
  const groundTex = tracker.track(new CanvasTexture(cv));
  groundTex.anisotropy = profile.anisotropy;

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
  const neon = S.buildings.neon;
  const facade = (() => {
    const fp = profile.facadePx / 64;
    const mk = () => {
      const c = document.createElement('canvas');
      c.width = c.height = Math.round(64 * fp);
      const f = c.getContext('2d') as CanvasRenderingContext2D;
      f.scale(fp, fp);
      return f;
    };
    const round = (f: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      f.beginPath();
      if (f.roundRect) f.roundRect(x, y, w, h, r); else f.rect(x, y, w, h);
      f.fill();
    };
    const a = mk();
    a.fillStyle = '#ffffff';
    a.fillRect(0, 0, 64, 64);
    a.fillStyle = S.buildings.windowColor;
    round(a, 12, 18, 40, 28, 8);
    a.fillStyle = 'rgba(255,255,255,0.55)';
    round(a, 15, 21, 16, 6, 3);
    const map = tracker.track(new CanvasTexture(a.canvas));
    let mask: CanvasTexture | null = null;
    if (neon) {
      const b = mk();
      b.fillStyle = '#000';
      b.fillRect(0, 0, 64, 64);
      b.fillStyle = '#fff';
      round(b, 12, 18, 40, 28, 8);
      b.fillStyle = '#000';
      b.fillRect(30, 18, 4, 28);
      mask = tracker.track(new CanvasTexture(b.canvas));
    }
    for (const t of [map, mask]) {
      if (!t) continue;
      t.wrapS = t.wrapT = RepeatWrapping;
      t.anisotropy = profile.anisotropy;
    }
    return { map, mask };
  })();
  const towerMats = P.towers.map((c, i) =>
    neon
      ? lambert(c, { map: facade.map, emissive: col(neon[i % neon.length]), emissiveMap: facade.mask, emissiveIntensity: 0.9 })
      : lambert(c, { map: facade.map }),
  );
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

  // The door building: a dark module outside the finder patterns with two free modules in front,
  // facing +x or +z so it is visible from the final isometric camera.
  const isLight = (r: number, c: number) => !qr.isDark(r, c);
  let doorCell: { r: number; c: number; dr: number; dc: number } | null = null;
  let bestScore = 1e9;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c) || inFinder(r, c)) continue;
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        if (!isLight(r + dr, c + dc) || !isLight(r + 2 * dr, c + 2 * dc)) continue;
        const score = Math.hypot(toW(c), toW(r)) + rand(r, c) * 2;
        if (score < bestScore) { bestScore = score; doorCell = { r, c, dr, dc }; }
      }
    }
  }

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
      const isDoor = !!doorCell && doorCell.r === r && doorCell.c === c;
      let kind: 'sky' | 'house' | 'mid';
      if (isDoor) kind = 'mid';
      else if (inFinder(r, c)) kind = 'sky';
      else if (rr > S.buildings.skyBias + dist * 0.6) kind = 'sky';
      else if (rr < S.buildings.houseBias + dist * 0.55) kind = 'house';
      else kind = 'mid';

      if (kind === 'house') {
        const wallH = 0.38 + rand(c, r) * 0.18;
        const walls = new Mesh(houseGeo, pick(houseMats, rand(r + 9, c)));
        walls.scale.y = wallH;
        const roof = new Mesh(roofGeo, roofMat);
        roof.scale.set(1, S.vegetation.kind === 'pine' ? 0.6 : 0.38, 1);
        roof.position.y = wallH;
        grp.add(walls, roof);
      } else {
        let h = kind === 'sky'
          ? (inFinder(r, c) ? 7 + rand(r, c * 2) * 2 : 5.5 + Math.pow(rr, 1.5) * 9 * (1 - dist * 0.5))
          : 1.3 + rand(c * 2, r) * 2.6;
        h = Math.max(isDoor ? 2.6 : 0.9, h * S.buildings.heightMul);
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
      grp.userData.delay = isDoor ? -100 : Math.hypot(x, z) * 0.03 + rand(r * 3, c) * 0.2;
      maxDelay = Math.max(maxDelay, grp.userData.delay as number);
      grp.scale.y = isDoor ? 1 : 0.001;
      city.add(grp);
      buildings.push(grp);
    }
  }

  // ---- The same door, to scale, on the ground floor of that building, with its lobby
  let doorInfo: DoorInfo | null = null;
  if (doorCell) {
    const T = S.door ?? (moderna.door as NonNullable<typeof moderna.door>);
    const dk = createDoorKit(tracker, T, profile.detail);
    const d = new Vector3(doorCell.dc, 0, doorCell.dr);
    const B = new Vector3(toW(doorCell.c), 0, toW(doorCell.r));
    const facade = B.clone().addScaledVector(d, 0.48);
    const rotY = Math.atan2(d.x, d.z);

    const rig = new Group();
    rig.position.copy(facade).addScaledVector(d, 0.005);
    rig.rotation.y = rotY;
    rig.scale.setScalar(0.17);
    const cityDoor = dk.buildDoor();
    rig.add(cityDoor.group);
    const warm = new Mesh(dk.geo(new PlaneGeometry(1.26, 2.6)), dk.basic(T.warm));
    warm.position.set(0, 1.3, 0);
    rig.add(warm);
    const arm = new Mesh(dk.geo(roundedPrism(0.12, 0.3, 0.04)), dk.mats.dark);
    arm.scale.y = 0.08;
    arm.position.set(1.08, 1.95, 0.12);
    rig.add(arm);
    const lampG = new Mesh(dk.geo(new SphereGeometry(0.11, 16, 12)), dk.basic(T.glow));
    lampG.position.set(1.08, 1.86, 0.26);
    rig.add(lampG);
    city.add(rig);

    // Lobby: the building only paints its outer face, so the inside is built from double-sided planes
    const lob = new Group();
    lob.position.copy(B);
    lob.rotation.y = rotY;
    const wallM = dk.lambert(T.background);
    wallM.side = DoubleSide;
    const floorM = dk.lambert(T.lobbyFloor);
    floorM.side = DoubleSide;
    const H = 0.6, I = 0.44, F = 0.465, dw = 0.107, dh = 0.44;
    const plane = (w: number, hh: number, x: number, y: number, z: number, ry: number, rx: number, m: MeshLambertMaterial = wallM) => {
      const p = new Mesh(dk.geo(new PlaneGeometry(w, hh)), m);
      p.position.set(x, y, z);
      p.rotation.set(rx, ry, 0);
      lob.add(p);
    };
    plane(2 * I, H, 0, H / 2, -I, 0, 0);
    plane(F + I, H, -I, H / 2, (F - I) / 2, Math.PI / 2, 0);
    plane(F + I, H, I, H / 2, (F - I) / 2, Math.PI / 2, 0);
    plane(2 * I, F + I, 0, 0.004, (F - I) / 2, 0, -Math.PI / 2, floorM);
    plane(2 * I, F + I, 0, H, (F - I) / 2, 0, -Math.PI / 2);
    plane(I - dw, H, -(I + dw) / 2, H / 2, F, 0, 0);
    plane(I - dw, H, (I + dw) / 2, H / 2, F, 0, 0);
    plane(2 * dw, H - dh, 0, (H + dh) / 2, F, 0, 0);
    const bulb = new Mesh(dk.geo(new SphereGeometry(0.03, 12, 8)), dk.basic(T.glow));
    bulb.position.set(0, H - 0.04, 0);
    lob.add(bulb);
    const pic = new Mesh(dk.geo(new PlaneGeometry(0.17, 0.17)), dk.mats.plaque);
    pic.position.set(0, 0.3, -I + 0.006);
    lob.add(pic);
    const picFrame = new Mesh(dk.geo(new PlaneGeometry(0.2, 0.2)), dk.mats.plaqueFrame);
    picFrame.position.set(0, 0.3, -I + 0.003);
    lob.add(picFrame);
    const pot = dk.makePot(0.32, S.vegetation.colors);
    pot.position.set(-0.32, 0.004, -0.3);
    lob.add(pot);
    const pot2 = dk.makePot(0.26, T.plants);
    pot2.position.set(0.33, 0.004, -0.32);
    lob.add(pot2);
    city.add(lob);

    doorInfo = { d, facade, hinge: cityDoor.hinge };
  }

  // ---- Traffic, vegetation, coast and flyers
  const ctx: SceneCtx = { style: S, profile, tracker, lambert, basic, geo, decor, root, half, size, R };
  const modules = [createTraffic(ctx, runs), createVegetation(ctx), createCoast(ctx), createFlyers(ctx)];
  const flyers = modules[3] as ReturnType<typeof createFlyers>;

  // ---- Sun shadow: covers the whole city, or the part on screen when zoomed in
  const sc = sun.shadow.camera;
  const lightOffset = new Vector3(-size * 0.9, size * 1.6, size * 0.5);
  let focus = '';
  function setFocus(x: number, z: number, zoom: number) {
    const key = `${x.toFixed(2)},${z.toFixed(2)},${zoom.toFixed(2)}`;
    if (key === focus) return;
    focus = key;
    const full = size * 0.85;
    const ext = zoom <= 1 ? full : Math.min(full, Math.max(6, (full / zoom) * 1.35));
    sc.left = sc.bottom = -ext;
    sc.right = sc.top = ext;
    sc.near = 1;
    sc.far = 200;
    sc.updateProjectionMatrix();
    const cx = zoom <= 1 ? 0 : x;
    const cz = zoom <= 1 ? 0 : z;
    sun.target.position.set(cx, 0, cz);
    sun.position.set(cx + lightOffset.x, lightOffset.y, cz + lightOffset.z);
    sun.target.updateMatrixWorld();
  }
  setFocus(0, 0, 1);

  // ---- Animation
  let born = Number.NaN;
  const riseDuration = maxDelay + 0.9;

  function update({ now, dt, t, reduce, bob = true }: CityFrame) {
    if (Number.isNaN(born)) born = options.rise === false ? now - 1e9 : now;
    const el = (now - born) / 1000;
    // In the top-down view the rooftops grow to fill their whole module: no hairline gaps between
    // neighbouring roofs, which is what scanners with sharp, high-resolution cameras trip over.
    const fill = 1 + (TOP_FOOTPRINT / BUILDING_FOOTPRINT - 1) * smooth(0.4, 1, t);
    for (const b of buildings) {
      const k = reduce ? 1 : clamp01((el - (b.userData.delay as number)) / 0.9);
      b.scale.set(fill, Math.max(0.001, 1 - Math.pow(1 - k, 3)), fill);
    }
    const vis = 1 - smooth(0.05, 0.55, t);
    decor.visible = vis > 0.01;
    flyers.setVisibility(vis);
    if (shadowMat) shadowMat.opacity = 0.14 * (1 - smooth(0.2, 0.9, t));
    const pop = reduce ? 1 : clamp01((el - 0.6) / 0.8);
    const k = vis * (1 - Math.pow(1 - pop, 3));
    if (decor.visible) {
      const frame = { now, dt, move: reduce ? 0 : dt, k, vis };
      for (const m of modules) m?.update(frame);
    }
    city.position.y = reduce || !bob ? 0 : Math.sin(now / 1600) * 0.12 * (1 - t);
  }

  function dispose() {
    tracker.disposeTree(root);
    tracker.dispose();
    sun.shadow.map?.dispose();
    root.removeFromParent();
    root.clear();
  }

  return { root, riseDuration, size, door: doorInfo, update, setFocus, dispose };
}
