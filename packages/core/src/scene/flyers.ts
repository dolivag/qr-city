import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Group, Mesh, Points, PointsMaterial, Shape, ShapeGeometry, SphereGeometry, Sprite, SpriteMaterial } from 'three';
import type { Object3D } from 'three';
import { pick, rand } from '../util/math';
import { col } from './color';
import type { Animated, SceneCtx } from './ctx';
import { roundedPrism } from './geometry';

/** Drones are modelled small and drawn this much bigger so they are visible at the city's scale. */
const DRONE_SCALE = 2.5;

interface Flock { group: Group; birds: Bird[]; R: number; h: number; speed: number; a: number }
interface Bird extends Object3D { userData: { pl: Object3D; pr: Object3D; phase: number; flapSpeed: number } }
interface Drone { obj: Group; led: Mesh; rotors: Mesh[]; R: number; h: number; a: number; speed: number; phase: number }

export interface Flyers extends Animated {
  /** Fades the snow with the decor (it lives outside the decor group). */
  setVisibility(vis: number): void;
}

/** What flies or falls: birds, gulls, drones or snow, depending on the style. */
export function createFlyers(ctx: SceneCtx): Flyers {
  const { style: S, profile, decor, root, lambert, basic, geo, half, size } = ctx;
  const kind = S.flyers.kind;
  const flocks: Flock[] = [];
  const drones: Drone[] = [];
  let snow: Points | null = null;
  let snowMat: PointsMaterial | null = null;

  if (kind === 'birds' || kind === 'gulls') {
    const big = kind === 'gulls';
    const bodyGeo = geo(new SphereGeometry(0.09, 12, 8).scale(1.8, 0.8, 0.8));
    const ws = new Shape();
    ws.moveTo(0, 0);
    ws.quadraticCurveTo(0.12, 0.08, 0.04, big ? 0.55 : 0.42);
    ws.quadraticCurveTo(-0.08, 0.2, -0.1, 0);
    ws.lineTo(0, 0);
    const wingGeo = geo(new ShapeGeometry(ws, 8).rotateX(-Math.PI / 2));
    const mat = lambert(S.flyers.color, { side: DoubleSide });
    for (let f = 0; f < profile.flocks; f++) {
      const fl: Flock = {
        group: new Group(), birds: [], R: half * (0.45 + f * 0.25) * (big ? 1.3 : 1), h: (big ? 9 : 13) + f * 1.8,
        speed: (0.16 + f * 0.04) * (f % 2 ? -1 : 1), a: f * 2.1,
      };
      const count = big ? 3 : 5 + f;
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
        bird.position.set(-row * 0.55 + (big ? rand(b, f) : 0), (rand(b, f) - 0.5) * 0.4, sd * row * (big ? 0.9 : 0.45));
        bird.userData = { pl, pr, phase: rand(b, f * 3) * 6, flapSpeed: big ? 260 : 110 };
        fl.group.add(bird);
        fl.birds.push(bird);
      }
      decor.add(fl.group);
      flocks.push(fl);
    }
  } else if (kind === 'drones') {
    // Seen from the city's scale a 0.3-unit drone is a speck: build it 2.5× bigger (DRONE_SCALE), light the body
    // and give each one a soft additive halo so it still reads against a bright sky.
    const dBody = geo(roundedPrism(0.3, 0.3, 0.08).scale(1, 0.09, 1));
    const rotor = geo(new CylinderGeometry(0.1, 0.1, 0.01, 16));
    const ledGeo = geo(new SphereGeometry(0.05, 10, 8));
    const bodyMat = lambert(0x5b4fa8);
    const rotMat = basic(0xc9c0ff, { transparent: true, opacity: 0.55 });
    const haloTex = (() => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const g = cv.getContext('2d') as CanvasRenderingContext2D;
      const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, 'rgba(255,255,255,0.9)');
      rg.addColorStop(0.35, 'rgba(255,255,255,0.28)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 64, 64);
      return ctx.tracker.track(new CanvasTexture(cv));
    })();
    const leds = S.buildings.neon ?? [S.flyers.color];
    const count = profile.level === 'low' ? 4 : 9;
    for (let i = 0; i < count; i++) {
      const d = new Group();
      d.add(new Mesh(dBody, bodyMat));
      const rotors: Mesh[] = [];
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const r = new Mesh(rotor, rotMat);
        r.position.set(a * 0.17, 0.09, b * 0.17);
        d.add(r);
        rotors.push(r);
      }
      const ledColor = pick(leds, rand(i, 2));
      const led = new Mesh(ledGeo, basic(ledColor));
      led.position.y = -0.035;
      d.add(led);
      const halo = new Sprite(ctx.tracker.track(new SpriteMaterial({
        map: haloTex, color: col(ledColor), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8,
      })));
      halo.scale.setScalar(0.9);
      halo.position.y = -0.02;
      d.add(halo);
      decor.add(d);
      drones.push({
        obj: d, led, rotors, R: half * (0.2 + rand(i, 1) * 0.9), h: ctx.skyline + 1.2 + rand(i, 2) * 3.5, a: rand(i, 3) * 6.3,
        speed: (0.2 + rand(i, 4) * 0.25) * (i % 2 ? 1 : -1), phase: rand(i, 5) * 6,
      });
    }
  } else if (kind === 'snow') {
    const N = profile.snowflakes;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * size;
      pos[i * 3 + 1] = Math.random() * 18;
      pos[i * 3 + 2] = (Math.random() - 0.5) * size;
    }
    const g = geo(new BufferGeometry());
    g.setAttribute('position', new BufferAttribute(pos, 3));
    snowMat = ctx.tracker.track(new PointsMaterial({
      color: col(S.flyers.color), size: 3 * Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2),
      sizeAttenuation: false, transparent: true, opacity: 0.95,
    }));
    snow = new Points(g, snowMat);
    root.add(snow);
  }

  return {
    setVisibility(vis) {
      if (!snow || !snowMat) return;
      snow.visible = vis > 0.01;
      snowMat.opacity = 0.95 * vis;
    },
    update({ now, dt, move, k }) {
      for (const f of flocks) {
        f.a += f.speed * move;
        f.group.position.set(Math.cos(f.a) * f.R, f.h + Math.sin(now / 900 + f.R) * 0.4, Math.sin(f.a) * f.R);
        f.group.rotation.y = -f.a - (f.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
        f.group.scale.setScalar(k);
        for (const b of f.birds) {
          const flap = move === 0 ? 0.3 : Math.sin(now / b.userData.flapSpeed + b.userData.phase) * 0.8;
          b.userData.pl.rotation.x = flap;
          b.userData.pr.rotation.x = -flap;
        }
      }
      for (const d of drones) {
        d.a += d.speed * move * 0.6;
        d.obj.position.set(Math.cos(d.a) * d.R, d.h + Math.sin(now / 700 + d.phase) * 0.35, Math.sin(d.a) * d.R);
        d.obj.rotation.z = Math.sin(now / 900 + d.phase) * 0.08;
        for (const r of d.rotors) r.rotation.y += dt * 40;
        d.led.visible = Math.sin(now / 250 + d.phase) > -0.3;
        d.obj.scale.setScalar(k * DRONE_SCALE);
      }
      if (snow && snow.visible && move) {
        const p = snow.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          let y = p.getY(i) - dt * (0.6 + (i % 7) * 0.08);
          if (y < 0) y += 18;
          p.setY(i, y);
          p.setX(i, p.getX(i) + Math.sin(now / 1200 + i) * dt * 0.08);
        }
        p.needsUpdate = true;
      }
    },
  };
}
