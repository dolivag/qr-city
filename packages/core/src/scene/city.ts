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
import { centerSquare } from '../qr/matrix';
import type { QrMatrix } from '../qr/matrix';
import type { ResolvedPlaza } from '../options';
import type { QualityProfile } from '../runtime/quality';
import { ResourceTracker } from '../runtime/tracker';
import { moderna } from '../styles/moderna';
import type { QrCityStyle } from '../types';
import { clamp01, pick, rand, smooth } from '../util/math';
import { createBatch } from './batch';
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
/** Glass of a window with the light off, at night. */
const NIGHT_DARK_GLASS = '#1c2240';
/** How bright the ground stays at night, seen from the side (1 = as by day). */
const NIGHT_GROUND = 0.3;
/** Floor counts a tower can have: close enough to any height, few enough to share geometry. */
const FLOOR_STEPS = [2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 19, 22, 26, 30, 35, 41];
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
  /** A plaza in the middle of the city, with a picture painted on its paving. */
  plaza?: ResolvedPlaza | null;
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
  /** Height of the canvas in CSS pixels (sizes things measured in screen pixels, like snowflakes). */
  setViewport(cssHeight: number): void;
  dispose(): void;
}

/** The four panes of a detailed window (x, y, w, h in a 64 px tile), split by a mullion and a transom. */
const GLASS: readonly (readonly [number, number, number, number])[] = [
  [15, 18, 16, 12], [33, 18, 16, 12], [15, 32, 16, 15], [33, 32, 16, 15],
];

/** Mixes two `#rrggbb` colours (t = 0 → a, 1 → b) into a CSS colour. */
function mixHex(a: string, b: string, t: number): string {
  const n = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, bl] = n(a).map((v, i) => Math.round(v + (n(b)[i] - v) * t));
  return `rgb(${r},${g},${bl})`;
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

  // ---- Plaza: a centered square of modules with no buildings and no streets across it
  const plaza = options.plaza ? centerSquare(n, options.plaza.size) : null;
  const inPlaza = (r: number, c: number) =>
    !!plaza && r >= plaza.first && r < plaza.first + plaza.side && c >= plaza.first && c < plaza.first + plaza.side;

  // ---- Streets: runs of ≥4 light modules; the ones touching the border connect to the ring road
  const runs: Run[] = [];
  const scan = (axis: 'x' | 'z') => {
    for (let k = 0; k < n; k++) {
      let start = -1;
      for (let i = 0; i <= n; i++) {
        const light = i < n && !(axis === 'x' ? qr.isDark(k, i) || inPlaza(k, i) : qr.isDark(i, k) || inPlaza(i, k));
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
  const snowy = S.flyers.kind === 'snow';
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
    // Shallows around the beach: lighter water that fades into the deep sea
    const R_sand = half + 4.75;
    for (const [grow, alpha] of [[2.6, 0.16], [1.7, 0.2], [0.9, 0.26]] as const) {
      g.fillStyle = `rgba(255,255,255,${alpha})`;
      rrect(W(-R_sand - grow), W(-R_sand - grow), 2 * (R_sand + grow) * px, 2 * (R_sand + grow) * px, (0.8 + grow) * px);
    }
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 0.06 * px;
    for (let i = 0; i < 90; i++) {
      const x = rand(i, 1) * cv.width;
      const y = rand(1, i) * cv.height;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 0.3 * px, y - 0.15 * px, x + 0.6 * px, y);
      g.stroke();
    }
    // Foam line where the waves reach the sand
    g.fillStyle = 'rgba(255,255,255,0.9)';
    rrect(W(-R_sand - 0.22), W(-R_sand - 0.22), 2 * (R_sand + 0.22) * px, 2 * (R_sand + 0.22) * px, 1 * px);
    g.fillStyle = P.walk;
    rrect(W(-R_sand), W(-R_sand), 2 * R_sand * px, 2 * R_sand * px, 0.8 * px);
  } else {
    g.fillStyle = P.walk;
    g.fillRect(0, 0, cv.width, cv.height);
  }
  g.fillStyle = P.ground;
  g.fillRect(W(-half - 0.25), W(-half - 0.25), (n + 0.5) * px, (n + 0.5) * px);
  if (snowy) {
    // Snow cover: soft drifts in a slightly cooler white, bright sparkles. Light enough not to touch the scan.
    g.fillStyle = 'rgba(198,214,236,0.26)';
    for (let i = 0; i < 260; i++) {
      const r = (0.5 + rand(i, 41) * 1.6) * px;
      g.beginPath();
      g.ellipse(rand(i, 43) * cv.width, rand(47, i) * cv.height, r, r * (0.35 + rand(i, 49) * 0.3), rand(i, 51) * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.95)';
    for (let i = 0; i < 520; i++) {
      const r = (0.05 + rand(i, 53) * 0.07) * px;
      g.beginPath();
      g.arc(rand(i, 55) * cv.width, rand(57, i) * cv.height, r, 0, Math.PI * 2);
      g.fill();
    }
  }
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

  /**
   * A camera must read the plaza without doubt, so the picture has no mid tones: each pixel becomes
   * either dark (as a roof) or light (as the paving), keeping its hue. Mid tones would bend the
   * scanner's local threshold and spoil the modules around the plaza.
   */
  const DARK_MAX = 60;
  const LIGHT_MIN = 205;
  const rgbOf = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  const luma = (r: number, gg: number, b: number) => 0.2126 * r + 0.7152 * gg + 0.0722 * b;
  const paving = rgbOf(P.walk);
  const pavingLuma = Math.max(luma(...paving), LIGHT_MIN + 1);
  const toTwoTones = (d: Uint8ClampedArray, i: number) => {
    const y = luma(d[i], d[i + 1], d[i + 2]);
    if (y < 128) {
      const k = y > DARK_MAX ? DARK_MAX / y : 1;
      for (let j = 0; j < 3; j++) d[i + j] *= k;
    } else if (y < LIGHT_MIN) {
      const k = Math.min(1, (LIGHT_MIN - y) / (pavingLuma - y));
      for (let j = 0; j < 3; j++) d[i + j] += (paving[j] - d[i + j]) * k;
    }
  };
  // The plaza's paving is part of the ground; the picture lives on its own layer, shown only in the
  // top-down view: from the street the plaza looks plain, and the picture is a surprise from above.
  const art = document.createElement('canvas');
  if (plaza) {
    g.fillStyle = P.walk;
    const x0 = W(toW(plaza.first) - 0.5);
    g.fillRect(x0, x0, plaza.side * px, plaza.side * px);
  }
  /** Draws the plaza's picture: the one given, fitted inside it, or an emblem in the style's colours. */
  const paintPlaza = (picture: HTMLImageElement | null) => {
    if (!plaza) return;
    const side = Math.round(plaza.side * px);
    art.width = art.height = side;
    const a = art.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    a.fillStyle = P.walk;
    a.fillRect(0, 0, side, side);
    const inner = side * 0.94;
    let drawn = false;
    if (picture) {
      const fit = inner / Math.max(picture.naturalWidth, picture.naturalHeight);
      const w = picture.naturalWidth * fit;
      const h = picture.naturalHeight * fit;
      a.imageSmoothingQuality = 'high';
      a.drawImage(picture, (side - w) / 2, (side - h) / 2, w, h);
      drawn = true;
    }
    if (!drawn) {
      // A compass rose: a ring and a four-pointed star.
      const c = side / 2;
      const accent = P.towers[P.towers.length - 1];
      a.strokeStyle = accent;
      a.lineWidth = side * 0.05;
      a.beginPath();
      a.arc(c, c, inner * 0.42, 0, Math.PI * 2);
      a.stroke();
      a.fillStyle = accent;
      a.beginPath();
      for (let k = 0; k < 8; k++) {
        const ang = (k * Math.PI) / 4 - Math.PI / 2;
        const rr = k % 2 === 0 ? inner * 0.4 : inner * 0.1;
        a.lineTo(c + Math.cos(ang) * rr, c + Math.sin(ang) * rr);
      }
      a.closePath();
      a.fill();
    }
    try {
      const img = a.getImageData(0, 0, side, side);
      for (let i = 0; i < img.data.length; i += 4) toTwoTones(img.data, i);
      a.putImageData(img, 0, 0);
    } catch {
      // A picture from another origin without CORS cannot be read: leave the paving bare.
      a.fillStyle = P.walk;
      a.fillRect(0, 0, side, side);
    }
  };
  paintPlaza(null);
  const groundTex = tracker.track(new CanvasTexture(cv));
  let plazaLayer: Mesh<PlaneGeometry, MeshBasicMaterial> | null = null;
  if (plaza) {
    const tex = tracker.track(new CanvasTexture(art));
    tex.anisotropy = profile.anisotropy;
    plazaLayer = new Mesh(geo(new PlaneGeometry(plaza.side, plaza.side).rotateX(-Math.PI / 2)), basic(0xffffff, { map: tex, transparent: true, opacity: 0 }));
    plazaLayer.position.y = 0.004; // centred: the plaza sits exactly in the middle of the code
    plazaLayer.visible = false;
    city.add(plazaLayer);
  }
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
  const groundMat = basic(0xffffff, { map: groundTex });
  const ground = new Mesh(gGeo, [groundMat, lambert(P.base)]);
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
    // Low quality keeps the one chunky pane; high and ultra get a framed window with two panes,
    // a transom, a sky-reflection gradient and a sill shadow, which reads less like a toy.
    const detailed = profile.level !== 'low';
    const W = S.buildings.windowColor;
    // By day one window per tile; at night 2×2, each lit or dark at random, so the lit ones stand out
    const cells = S.night ? 2 : 1;
    const a = mk();
    a.fillStyle = '#ffffff';
    a.fillRect(0, 0, 64, 64);
    const drawWindow = (f: CanvasRenderingContext2D, glass: string) => {
      if (detailed) {
        f.fillStyle = 'rgba(0,0,0,0.07)';
        f.fillRect(13, 48, 38, 3);
        f.fillStyle = 'rgba(0,0,0,0.30)';
        round(f, 13, 16, 38, 33, 2);
        const g = f.createLinearGradient(0, 18, 0, 47);
        g.addColorStop(0, mixHex(glass, '#ffffff', 0.4));
        g.addColorStop(1, mixHex(glass, '#000000', 0.12));
        f.fillStyle = g;
        for (const [x, y, w, h] of GLASS) f.fillRect(x, y, w, h);
        f.fillStyle = 'rgba(255,255,255,0.35)';
        f.beginPath();
        f.moveTo(16, 19);
        f.lineTo(26, 19);
        f.lineTo(17, 30);
        f.lineTo(16, 30);
        f.fill();
      } else {
        f.fillStyle = glass;
        round(f, 12, 18, 40, 28, 8);
        f.fillStyle = 'rgba(255,255,255,0.55)';
        round(f, 15, 21, 16, 6, 3);
      }
    };
    const lit = (cx: number, cy: number) => cells === 1 || rand(cx * 7 + 3, cy * 5 + 11) < 0.7;
    for (let cy = 0; cy < cells; cy++) {
      for (let cx = 0; cx < cells; cx++) {
        a.save();
        a.translate((cx * 64) / cells, (cy * 64) / cells);
        a.scale(1 / cells, 1 / cells);
        drawWindow(a, lit(cx, cy) ? W : NIGHT_DARK_GLASS);
        a.restore();
      }
    }
    const map = tracker.track(new CanvasTexture(a.canvas));
    let mask: CanvasTexture | null = null;
    if (neon) {
      const b = mk();
      b.fillStyle = '#000';
      b.fillRect(0, 0, 64, 64);
      for (let cy = 0; cy < cells; cy++) {
        for (let cx = 0; cx < cells; cx++) {
          if (!lit(cx, cy)) continue;
          b.save();
          b.translate((cx * 64) / cells, (cy * 64) / cells);
          b.scale(1 / cells, 1 / cells);
          b.fillStyle = '#fff';
          if (detailed) for (const [x, y, w, h] of GLASS) b.fillRect(x, y, w, h);
          else {
            round(b, 12, 18, 40, 28, 8);
            b.fillStyle = '#000';
            b.fillRect(30, 18, 4, 28);
          }
          b.restore();
        }
      }
      mask = tracker.track(new CanvasTexture(b.canvas));
    }
    for (const t of [map, mask]) {
      if (!t) continue;
      t.wrapS = t.wrapT = RepeatWrapping;
      t.anisotropy = profile.anisotropy;
    }
    return { map, mask, cells };
  })();
  const towerMats = P.towers.map((c, i) =>
    neon
      ? lambert(c, { map: facade.map, emissive: col(neon[i % neon.length]), emissiveMap: facade.mask, emissiveIntensity: S.night ? 1.25 : 0.9 })
      : lambert(c, { map: facade.map }),
  );
  const houseMats = P.houses.map((c) => lambert(c));

  /** Height of the tallest tower, so things that fly can clear the skyline. */
  let skyline = 0;
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
        uv.setXY(v, (uv.getX(v) * 2.1) / facade.cells + 0.5, (uv.getY(v) * floors) / facade.cells);
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
      if (!qr.isDark(r, c) || inFinder(r, c) || inPlaza(r, c)) continue;
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        if (!isLight(r + dr, c + dc) || !isLight(r + 2 * dr, c + 2 * dc)) continue;
        const score = Math.hypot(toW(c), toW(r)) + rand(r, c) * 2;
        if (score < bestScore) { bestScore = score; doorCell = { r, c, dr, dc }; }
      }
    }
  }

  const snowMat = lambert(0xffffff);
  const driftGeo = geo(new SphereGeometry(1, Math.max(8, Math.round(14 * profile.detail)), Math.max(5, Math.round(8 * profile.detail))));
  const buildings: Group[] = [];
  let maxDelay = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c) || inPlaza(r, c)) continue;
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
        skyline = Math.max(skyline, h);
        // Floors from a fixed scale, so towers share geometry and draw in batches (windows vary a few %)
        // (an even count at night, so the 2×2 window tiles end on a whole row)
        let floors = FLOOR_STEPS.reduce((best, f) => (Math.abs(f - h / 0.42) < Math.abs(best - h / 0.42) ? f : best));
        if (facade.cells > 1) floors = Math.max(2, 2 * Math.round(floors / facade.cells));
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
      if (snowy && !isDoor) {
        // Snow piled against the walls: a low, wide mound that spills over the neighbouring ground
        const bank = new Mesh(driftGeo, snowMat);
        bank.scale.set(0.62 + rand(r, c * 3) * 0.12, 0.14 + rand(c, r * 5) * 0.06, 0.62 + rand(c * 3, r) * 0.12);
        bank.position.y = 0.01;
        grp.add(bank);
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
  const ctx: SceneCtx = { style: S, profile, tracker, lambert, basic, geo, decor, root, half, size, R, skyline };
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

  // ---- Repeated meshes (trees, lamps, cars, people, buildings…) drawn in instanced batches
  const batch = createBatch(city);

  // ---- Animation
  let born = Number.NaN;
  const riseDuration = maxDelay + 0.9;

  function update({ now, dt, t, reduce, bob = true }: CityFrame) {
    if (Number.isNaN(born)) born = options.rise === false ? now - 1e9 : now;
    const el = (now - born) / 1000;
    if (plazaLayer) {
      // The picture fades in over the last part of the move to the top-down view
      const o = smooth(0.55, 0.95, t);
      plazaLayer.material.opacity = o;
      plazaLayer.visible = o > 0;
    }
    // In the top-down view the rooftops grow to fill their whole module: no hairline gaps between
    // neighbouring roofs, which is what scanners with sharp, high-resolution cameras trip over.
    const fill = 1 + (TOP_FOOTPRINT / BUILDING_FOOTPRINT - 1) * smooth(0.4, 1, t);
    for (const b of buildings) {
      const k = reduce ? 1 : clamp01((el - (b.userData.delay as number)) / 0.9);
      b.scale.set(fill, Math.max(0.001, 1 - Math.pow(1 - k, 3)), fill);
    }
    // At night the ground (unlit, so it would stay bright) is dimmed from the side and lights up for the QR
    if (S.night) groundMat.color.setScalar(NIGHT_GROUND + (1 - NIGHT_GROUND) * smooth(0.3, 0.9, t));
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
    batch.refresh();
  }

  // The picture arrives later: paint it over the pattern when it does.
  let alive = true;
  if (plaza && options.plaza?.image) {
    const picture = new Image();
    picture.crossOrigin = 'anonymous';
    picture.decoding = 'async';
    picture.onload = () => {
      if (!alive) return;
      paintPlaza(picture);
      if (plazaLayer?.material.map) plazaLayer.material.map.needsUpdate = true;
    };
    picture.src = options.plaza.image;
  }

  function dispose() {
    alive = false;
    batch.dispose();
    tracker.disposeTree(root);
    tracker.dispose();
    sun.shadow.map?.dispose();
    root.removeFromParent();
    root.clear();
  }

  return { root, riseDuration, size, door: doorInfo, update, setFocus, setViewport: (h) => flyers.setViewport(h), dispose };
}
