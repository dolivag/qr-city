import { InstancedMesh, Matrix4, Mesh } from 'three';
import type { BufferGeometry, Material, Object3D } from 'three';

/** Layer the camera never renders: the originals stay in the scene (they keep moving) but are not drawn. */
const HIDDEN_LAYER = 31;
/** A copy that must not be drawn (hidden, or under a hidden parent). */
const ZERO = new Matrix4().makeScale(0, 0, 0);

interface Entry {
  mesh: Mesh;
  /** Last matrix written for this copy, to skip uploads when nothing moved. */
  last: Float32Array;
}

interface Group {
  inst: InstancedMesh;
  entries: Entry[];
}

/**
 * Same shape, same key: many parts are built with their own copy of an identical geometry, and
 * they can share one batch. A hash of the vertex data (and the material groups).
 */
function shapeKey(g: BufferGeometry, cache: Map<string, string>): string {
  const hit = cache.get(g.uuid);
  if (hit) return hit;
  let h = 2166136261;
  const mix = (v: number) => { h = Math.imul(h ^ v, 16777619); };
  for (const name of ['position', 'normal', 'uv']) {
    const a = g.attributes[name];
    if (!a) { mix(0); continue; }
    const arr = a.array as ArrayLike<number>;
    mix(arr.length);
    const bits = new Uint32Array(new Float32Array(arr as ArrayLike<number>).buffer);
    for (let i = 0; i < bits.length; i++) mix(bits[i]);
  }
  const idx = g.index?.array as ArrayLike<number> | undefined;
  if (idx) for (let i = 0; i < idx.length; i++) mix(idx[i]);
  const key = `${(h >>> 0).toString(36)}|${JSON.stringify(g.groups)}`;
  cache.set(g.uuid, key);
  return key;
}

/**
 * Same look, same key: parts often get their own copy of an identical material (a person's coat, a
 * car's paint). Nothing changes these materials after the city is built, so equal ones can share.
 */
function lookKey(m: Material, cache: Map<string, string>): string {
  const hit = cache.get(m.uuid);
  if (hit) return hit;
  const json = m.toJSON() as unknown as Record<string, unknown>;
  delete json.uuid;
  delete json.name;
  const key = JSON.stringify(json);
  cache.set(m.uuid, key);
  return key;
}

export interface Batch {
  /** Copies every moved, shown or hidden mesh into its batch. Call once per frame, after animating. */
  refresh(): void;
  /** Draw calls saved: meshes now drawn by an instanced batch. */
  readonly batched: number;
  dispose(): void;
}

/**
 * Draws repeated meshes under `root` (same geometry and material: trees, lamps, cars, people,
 * buildings…) with one instanced draw call per kind instead of one per mesh.
 *
 * The originals are kept in the scene, so the code that animates them does not change: they are
 * just moved to a layer the camera does not render, and `refresh()` copies their transforms (and
 * their visibility) into the batches. Only batches whose copies moved are uploaded again.
 */
export function createBatch(root: Object3D, minCopies = 2): Batch {
  root.updateMatrixWorld(true);
  const kinds = new Map<string, Mesh[]>();
  const shapes = new Map<string, string>();
  const looks = new Map<string, string>();
  root.traverse((o) => {
    if (!(o instanceof Mesh) || o instanceof InstancedMesh || o.userData.noBatch) return;
    const mats = (Array.isArray(o.material) ? o.material : [o.material]) as Material[];
    const key = `${shapeKey(o.geometry, shapes)}|${mats.map((m) => lookKey(m, looks)).join(',')}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}`;
    const list = kinds.get(key);
    if (list) list.push(o); else kinds.set(key, [o]);
  });

  const groups: Group[] = [];
  let batched = 0;
  for (const meshes of kinds.values()) {
    if (meshes.length < minCopies) continue;
    const first = meshes[0];
    const inst = new InstancedMesh(first.geometry, first.material, meshes.length);
    inst.castShadow = first.castShadow;
    inst.receiveShadow = first.receiveShadow;
    inst.frustumCulled = false; // the copies spread over the whole city
    inst.userData.noBatch = true;
    root.add(inst);
    for (const m of meshes) m.layers.set(HIDDEN_LAYER);
    groups.push({ inst, entries: meshes.map((mesh) => ({ mesh, last: new Float32Array(16).fill(Number.NaN) })) });
    batched += meshes.length;
  }

  const rootInv = new Matrix4();
  const tmp = new Matrix4();
  /** Shown, and every parent up to `root` shown too. */
  const shown = (o: Object3D) => {
    for (let p: Object3D | null = o; p && p !== root; p = p.parent) if (!p.visible) return false;
    return true;
  };

  function refresh() {
    root.updateMatrixWorld();
    rootInv.copy(root.matrixWorld).invert();
    for (const { inst, entries } of groups) {
      let moved = false;
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (shown(e.mesh)) tmp.multiplyMatrices(rootInv, e.mesh.matrixWorld);
        else tmp.copy(ZERO);
        const m = tmp.elements;
        let same = true;
        for (let j = 0; j < 16; j++) {
          if (m[j] !== e.last[j]) { same = false; break; }
        }
        if (same) continue;
        e.last.set(m);
        inst.setMatrixAt(i, tmp);
        moved = true;
      }
      if (moved) inst.instanceMatrix.needsUpdate = true;
    }
  }
  refresh();

  return {
    refresh,
    batched,
    dispose() {
      for (const { inst } of groups) {
        inst.removeFromParent();
        inst.dispose();
      }
      groups.length = 0;
    },
  };
}
