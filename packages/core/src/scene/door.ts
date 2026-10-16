import {
  CanvasTexture,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  Scene,
} from 'three';
import type { BufferGeometry, Material, PerspectiveCamera ,
  Color} from 'three';
import { createMatrix } from '../qr/matrix';
import type { QualityProfile } from '../runtime/quality';
import { ResourceTracker } from '../runtime/tracker';
import type { QrCityDoorTheme } from '../types';
import { clamp01, ease, easeIn, pick, rand, smooth } from '../util/math';
import { col } from './color';
import { blobGeo, roundedPrism } from './geometry';

const LIGHT_SCALE = Math.PI;

/** Seconds the door takes to open, walk the camera in and fade to white. */
export const ENTER_DURATION = 2.1;

/** Everything needed to build the detailed door (used on the doorstep and, tiny, in the city). */
export function createDoorKit(tracker: ResourceTracker, theme: QrCityDoorTheme, detail: number) {
  const lambert = (c: string | Color) => tracker.track(new MeshLambertMaterial({ color: col(c) }));
  const basic = (c: string | number | Color, extra: ConstructorParameters<typeof MeshBasicMaterial>[0] = {}) =>
    tracker.track(new MeshBasicMaterial({ color: col(c), ...extra }));
  const geo = <G extends BufferGeometry>(g: G): G => tracker.track(g);

  // Engraved mini QR
  const plaqueTexture = (() => {
    const m = createMatrix('qr-city', 'L');
    const px = 8;
    const c = document.createElement('canvas');
    c.width = c.height = (m.size + 2) * px;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.fillStyle = theme.plaque.paper;
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = theme.plaque.ink;
    for (let r = 0; r < m.size; r++) for (let k = 0; k < m.size; k++) if (m.isDark(r, k)) g.fillRect((k + 1) * px, (r + 1) * px, px, px);
    return tracker.track(new CanvasTexture(c));
  })();

  const seg = Math.max(2, Math.round(5 * detail));
  const mats = {
    frame: lambert(theme.frame),
    dark: lambert(theme.frameDark),
    panel: lambert(theme.panel),
    raised: lambert(theme.panelRaised),
    brass: lambert(theme.brass),
    plaque: basic(0xffffff, { map: plaqueTexture }),
    plaqueFrame: lambert(theme.plaque.frame),
  };
  const G = {
    post: geo(roundedPrism(0.2, 0.32, 0.07, seg)),
    plinth: geo(roundedPrism(0.27, 0.38, 0.05, seg)),
    lintel: geo(roundedPrism(1.66, 0.32, 0.07, seg)),
    cornice: geo(roundedPrism(1.92, 0.42, 0.08, seg)),
    panel: geo(roundedPrism(1.26, 0.12, 0.05, seg)),
    raised: geo(roundedPrism(0.86, 0.035, 0.05, seg)),
    pframe: geo(roundedPrism(0.74, 0.03, 0.05, seg)),
    plaque: geo(new PlaneGeometry(0.62, 0.62)),
    kick: geo(roundedPrism(1.12, 0.02, 0.01, seg)),
    rose: geo(new CylinderGeometry(0.055, 0.055, 0.025, Math.max(10, Math.round(24 * detail))).rotateX(Math.PI / 2)),
    lever: geo(roundedPrism(0.2, 0.035, 0.016, seg)),
  };

  function buildDoor() {
    const g = new Group();
    const add = (parent: Group, geometry: BufferGeometry, material: Material, x: number, y: number, z: number, sy = 1) => {
      const m = new Mesh(geometry, material);
      m.position.set(x, y, z);
      m.scale.y = sy;
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    for (const x of [-0.73, 0.73]) {
      add(g, G.post, mats.frame, x, 0, 0, 2.72);
      add(g, G.plinth, mats.dark, x, 0, 0, 0.24);
      add(g, G.plinth, mats.dark, x, 2.42, 0, 0.1);
    }
    add(g, G.lintel, mats.frame, 0, 2.6, 0, 0.2);
    add(g, G.cornice, mats.dark, 0, 2.8, 0, 0.09);
    const hinge = new Group();
    hinge.position.set(-0.63, 0, 0);
    g.add(hinge);
    add(hinge, G.panel, mats.panel, 0.63, 0.02, 0, 2.46);
    for (const s of [1, -1]) {
      add(hinge, G.raised, mats.raised, 0.63, 0.2, s * 0.07, 0.76);
      add(hinge, G.rose, mats.brass, 1.1, 1.1, s * 0.075);
      add(hinge, G.lever, mats.brass, 1.02, 1.085, s * 0.098, 0.035);
      add(hinge, G.kick, mats.brass, 0.63, 0.04, s * 0.065, 0.12);
    }
    add(hinge, G.raised, mats.raised, 0.63, 1.25, -0.07, 1.05);
    add(hinge, G.pframe, mats.plaqueFrame, 0.63, 1.3, 0.07, 0.74);
    const pq = new Mesh(G.plaque, mats.plaque);
    pq.position.set(0.63, 1.67, 0.088);
    hinge.add(pq);
    return { group: g, hinge };
  }

  const blobs = [blobGeo(1, detail), blobGeo(2.7, detail), blobGeo(4.1, detail)].map(geo);
  const potGeo = geo(new CylinderGeometry(0.17, 0.12, 0.32, Math.max(10, Math.round(24 * detail))).translate(0, 0.16, 0));
  const potMat = lambert(theme.pot);

  function makePot(scale: number, greens: readonly string[]) {
    const p = new Group();
    const pot = new Mesh(potGeo, potMat);
    pot.castShadow = true;
    p.add(pot);
    const plantMats = greens.map((c) => lambert(c));
    const bumps: [number, number, number, number][] = [[0, 0.5, 0, 0.22], [0.09, 0.42, 0.06, 0.16], [-0.08, 0.45, -0.05, 0.17], [0.02, 0.66, 0, 0.14]];
    bumps.forEach(([x, y, z, r], k) => {
      const b = new Mesh(blobs[k % 3], plantMats[k % plantMats.length]);
      b.position.set(x, y, z);
      b.scale.setScalar(r);
      b.castShadow = true;
      p.add(b);
    });
    p.scale.setScalar(scale);
    return p;
  }

  return { buildDoor, makePot, mats, lambert, basic, geo };
}

export type DoorKit = ReturnType<typeof createDoorKit>;

export interface DoorFrameResult {
  /** 0–1: how white the screen is. */
  veil: number;
  /** The door was passed and the screen is white. */
  done: boolean;
}

export interface DoorScene {
  scene: Scene;
  setBackground(color: string | null): void;
  /** `entering` is the seconds since the door started to open, or `null` while idle. */
  update(now: number, aspect: number, entering: number | null, reduce: boolean, camera: PerspectiveCamera): DoorFrameResult;
  dispose(): void;
}

/** The doorstep: a single door in an empty room with floating cubes, plants and a doormat. */
export function createDoorScene(theme: QrCityDoorTheme, profile: QualityProfile): DoorScene {
  const tracker = new ResourceTracker();
  const kit = createDoorKit(tracker, theme, profile.detail);
  const scene = new Scene();
  scene.fog = new Fog(col(theme.background), 7, 20);

  const hemi = new HemisphereLight(col(theme.light.sky), col(theme.light.ground), theme.light.intensity * LIGHT_SCALE);
  const sun = new DirectionalLight(col(theme.light.sun), theme.light.sunIntensity * LIGHT_SCALE);
  sun.position.set(-4, 7, 5);
  sun.castShadow = profile.shadows;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.radius = 5;
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
  scene.add(hemi, sun);

  const floor = new Mesh(kit.geo(new PlaneGeometry(80, 80).rotateX(-Math.PI / 2)), kit.lambert(theme.background));
  floor.receiveShadow = true;
  scene.add(floor);

  const door = kit.buildDoor();
  door.group.position.y = 0.08;
  scene.add(door.group);

  const step = new Mesh(kit.geo(roundedPrism(2.1, 0.9, 0.12, Math.max(2, Math.round(5 * profile.detail)))), kit.lambert(theme.step));
  step.scale.y = 0.08;
  step.position.z = 0.25;
  step.receiveShadow = true;
  scene.add(step);

  const glow = new Mesh(kit.geo(new PlaneGeometry(1.26, 2.5)), kit.basic(theme.glow, { fog: false }));
  glow.position.set(0, 1.33, -0.12);
  scene.add(glow);

  const mat = new Mesh(kit.geo(roundedPrism(0.95, 0.5, 0.08)), kit.lambert(theme.mat));
  mat.scale.y = 0.02;
  mat.position.set(0, 0.08, 0.42);
  mat.receiveShadow = true;
  scene.add(mat);

  [-1.25, 1.25].forEach((x, i) => {
    const p = kit.makePot(1, theme.plants);
    p.position.set(x, 0, 0.45);
    p.rotation.y = i * 1.3;
    scene.add(p);
  });

  const floaterMats = theme.floaters.map((c) => kit.lambert(c));
  const cube = kit.geo(roundedPrism(0.3, 0.3, 0.08));
  const floaters: Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const m = new Mesh(cube, pick(floaterMats, rand(i, 2)));
    m.scale.y = 0.3 + rand(i, 5) * 0.9;
    const a = rand(i, 1) * Math.PI * 2;
    const R = 2.4 + rand(i, 3) * 4;
    m.position.set(Math.cos(a) * R, 0, -1.5 - Math.abs(Math.sin(a)) * R);
    m.castShadow = true;
    m.userData.phase = rand(i, 7) * 6;
    scene.add(m);
    floaters.push(m);
  }

  return {
    scene,
    setBackground(color) {
      scene.background = color ? col(color) : null;
    },
    update(now, aspect, entering, reduce, camera) {
      const s = now / 1000;
      if (!reduce) {
        for (const m of floaters) {
          m.position.y = 0.6 + Math.sin(s * 0.8 + (m.userData.phase as number)) * 0.25;
          m.rotation.y = s * 0.2 + (m.userData.phase as number);
        }
      }
      camera.fov = 38;
      camera.aspect = aspect;
      camera.near = 0.05;
      camera.far = 200;
      let z = aspect < 0.8 ? 7.4 : 5.6;
      let x = reduce ? 0 : Math.sin(s * 0.5) * 0.18;
      let y = 1.4;
      let veil = 0;
      let done = false;
      if (entering !== null) {
        const el = entering;
        door.hinge.rotation.y = -1.9 * ease(clamp01(el / 0.9));
        const walk = easeIn(clamp01((el - 0.6) / 1.4));
        z = z + (-0.6 - z) * walk;
        x *= 1 - walk;
        y = y + (1.3 - y) * walk;
        veil = smooth(1.45, 1.95, el);
        done = el > ENTER_DURATION;
      } else {
        door.hinge.rotation.y = reduce ? -0.05 : -0.05 - Math.max(0, Math.sin(s * 1.3)) * 0.04;
      }
      camera.position.set(x, y, z);
      camera.lookAt(0, 1.25, 0);
      camera.updateProjectionMatrix();
      return { veil, done };
    },
    dispose() {
      tracker.disposeTree(scene);
      tracker.dispose();
      sun.shadow.map?.dispose();
      scene.clear();
    },
  };
}
