import { Color, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, PlaneGeometry, SphereGeometry, TorusGeometry } from 'three';
import type { BufferGeometry, MeshLambertMaterial, Object3D } from 'three';
import { rand, ringPoint } from '../util/math';
import { col } from './color';
import type { Animated, SceneCtx } from './ctx';
import { blobGeo } from './geometry';
import { createGlow } from './glow';
import { getUltra } from './ultraKit';

/** Trees (round, palm, pine or neon) and street lamps along the outer ring, plus lamps along the inner one. */
export function createVegetation(ctx: SceneCtx): Animated {
  const { style: S, profile, decor, lambert, basic, geo, R } = ctx;
  const kind = S.vegetation.kind;
  const neon = kind === 'neon';
  const colors = S.vegetation.colors;
  const treeMats = colors.map((c) => (neon ? basic(c) : lambert(c)));
  const tint = (hex: string, k: number) => {
    const c = col(hex);
    return k >= 0 ? c.lerp(new Color(1, 1, 1), k) : c.multiplyScalar(1 + k);
  };
  const hiMats = colors.map((c) => lambert(tint(c, 0.28)));
  const loMats = colors.map((c) => lambert(tint(c, -0.12)));
  const frondMats = colors.map((c) => lambert(c, { side: DoubleSide }));
  const trunkMat = lambert(neon ? 0x3a3360 : 0xc4a48d);
  const lampMat = lambert(neon ? 0x3a3360 : 0x9aa3b8);
  const bulbMat = basic(neon ? 0xff6fd8 : 0xfff6d8);
  const full = profile.level !== 'low';
  const snowing = S.flyers.kind === 'snow';
  const snowMat = lambert(0xffffff);
  const nutMat = lambert(0xb08a6a);

  const blobs = [blobGeo(1, profile.detail), blobGeo(2.7, profile.detail), blobGeo(4.1, profile.detail)].map(geo);
  const lampGeo = geo(new CylinderGeometry(0.022, 0.022, 0.7, 8).translate(0, 0.35, 0));
  const bulbGeo = geo(new SphereGeometry(0.05, 10, 8).translate(0, 0.72, 0));
  const trunk = geo(new CylinderGeometry(0.025, 0.045, 0.4, 10).translate(0, 0.2, 0));
  const branch = geo(new CylinderGeometry(0.01, 0.018, 0.2, 6).translate(0, 0.1, 0));
  const cone = geo(new ConeGeometry(0.3, 0.4, Math.max(8, Math.round(20 * profile.detail))));
  const snowCap = geo(new ConeGeometry(0.14, 0.12, Math.max(8, Math.round(20 * profile.detail))));
  const palmSeg = geo(new CylinderGeometry(0.028, 0.034, 0.19, 10).translate(0, 0.095, 0));
  const nut = geo(new SphereGeometry(0.032, 10, 8));
  const neonPole = geo(new CylinderGeometry(0.03, 0.03, 0.9, 8).translate(0, 0.45, 0));
  const neonTip = geo(new SphereGeometry(0.08, 12, 8));
  const neonRing = geo(new TorusGeometry(0.16, 0.02, 8, 24));
  const frondGeo = geo((() => {
    const L = 0.5;
    const g = new PlaneGeometry(L, 0.13, full ? 12 : 6, full ? 2 : 1).translate(L / 2, 0, 0).rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const k = x / L;
      p.setZ(i, z * (1 - k * 0.85) * (0.6 + Math.sin(k * Math.PI) * 0.8));
      p.setY(i, 0.12 * Math.sin(k * 1.4) - 0.28 * k * k + Math.abs(z) * 0.4);
    }
    g.computeVertexNormals();
    return g;
  })());

  const makeLamp = () => {
    const l = new Group();
    l.add(new Mesh(lampGeo, lampMat), new Mesh(bulbGeo, bulbMat));
    return l;
  };

  const makeTree = (i: number) => {
    const o = new Group();
    const ci = Math.floor(rand(i, 9) * colors.length) % colors.length;
    const m = treeMats[ci];
    const s = 0.85 + rand(i, 8) * 0.4;
    const put = (g: BufferGeometry, mt: MeshLambertMaterial | typeof m, x: number, y: number, z: number, sc?: number) => {
      const b = new Mesh(g, mt);
      b.position.set(x, y, z);
      if (sc) b.scale.setScalar(sc);
      b.castShadow = true;
      o.add(b);
      return b;
    };
    if (kind === 'round') {
      put(trunk, trunkMat, 0, 0, 0);
      put(branch, trunkMat, 0, 0.3, 0).rotation.z = 0.7;
      put(branch, trunkMat, 0, 0.34, 0).rotation.z = -0.6;
      const crown: [number, number, number, number, MeshLambertMaterial[]][] = [
        [0, 0.6, 0, 0.26, loMats], [0.14, 0.54, 0.05, 0.19, loMats], [-0.13, 0.56, -0.06, 0.2, loMats],
        [0.03, 0.77, 0.03, 0.22, treeMats as MeshLambertMaterial[]], [-0.06, 0.72, 0.1, 0.16, treeMats as MeshLambertMaterial[]], [0.05, 0.92, -0.02, 0.13, hiMats],
      ];
      if (full) {
        crown.push([-0.1, 0.84, -0.09, 0.12, hiMats], [0.11, 0.7, -0.1, 0.13, treeMats as MeshLambertMaterial[]]);
      } else {
        crown.splice(4, 2, [0.05, 0.9, -0.02, 0.15, hiMats]);
      }
      crown.forEach(([x, y, z, r, mats], k) => {
        put(blobs[k % 3], mats[ci], x * s, y * s, z * s, r * s).rotation.y = rand(i, k) * 6;
      });
    } else if (kind === 'pine') {
      put(trunk, trunkMat, 0, 0, 0, 0.6);
      const tiers = full ? 5 : 3;
      for (let k = 0; k < tiers; k++) {
        const sc = s * (1 - (k * 0.8) / tiers);
        const y = (0.3 + (k * 0.76) / tiers) * s;
        put(cone, k % 2 ? m : loMats[ci], 0, y, 0, sc).rotation.y = rand(i, k) * 3;
        if (snowing) put(snowCap, snowMat, 0, y + 0.15 * sc, 0, sc);
      }
    } else if (kind === 'palm') {
      let x = 0;
      let y = 0;
      let rot = 0;
      const lean = (rand(i, 3) - 0.5) * 0.5;
      for (let k = 0; k < 5; k++) {
        const sg = put(palmSeg, trunkMat, x, y, 0, s * (1 - k * 0.05));
        sg.rotation.z = rot;
        x += -Math.sin(rot) * 0.19 * s;
        y += Math.cos(rot) * 0.19 * s;
        rot += lean / 5;
      }
      const crown = new Group();
      crown.position.set(x, y, 0);
      const fronds = full ? 10 : 6;
      for (let k = 0; k < fronds; k++) {
        const f = new Mesh(frondGeo, frondMats[(ci + k) % frondMats.length]);
        f.rotation.y = (k * Math.PI * 2) / fronds + rand(i, k) * 0.4;
        f.scale.setScalar(s * (0.85 + rand(k, i) * 0.3));
        f.castShadow = true;
        crown.add(f);
      }
      for (let k = 0; k < (full ? 3 : 0); k++) {
        const nt = new Mesh(nut, nutMat);
        nt.position.set(Math.cos(k * 2.1) * 0.04, -0.03, Math.sin(k * 2.1) * 0.04);
        crown.add(nt);
      }
      o.add(crown);
    } else {
      const tip = new Mesh(neonTip, m);
      tip.position.y = 0.95;
      const ring = new Mesh(neonRing, m);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.6;
      o.add(new Mesh(neonPole, trunkMat), tip, ring);
    }
    if (profile.level === 'ultra') getUltra()?.decorateTree(o, kind, ctx, s);
    return o;
  };

  const props: Object3D[] = [];
  /** Where the bulbs are, to give them a halo at night. */
  const bulbs: number[] = [];
  const steps = Math.floor((8 * R.tree) / profile.propStep);
  for (let i = 0; i < steps; i++) {
    const [x, z] = ringPoint(R.tree, i * profile.propStep + 0.3);
    const o = i % 5 === 4 ? makeLamp() : makeTree(i);
    o.position.set(x, 0, z);
    decor.add(o);
    props.push(o);
    if (i % 5 === 4) bulbs.push(x, 0.72, z);
  }
  for (let i = 0; i < Math.floor((8 * R.inner) / 2.2); i++) {
    const [x, z] = ringPoint(R.inner + 0.2, i * 2.2 + 1);
    const l = makeLamp();
    l.position.set(x, 0, z);
    decor.add(l);
    props.push(l);
    bulbs.push(x, 0.72, z);
  }

  const glow = S.night ? createGlow(ctx, bulbs, neon ? '#ff6fd8' : '#ffd9a0') : null;

  return {
    update(f) {
      for (const p of props) p.scale.setScalar(f.k);
      glow?.update(f);
    },
    setViewport: (h) => glow?.setViewport(h),
    setZoom: (z) => glow?.setZoom(z),
  };
}
