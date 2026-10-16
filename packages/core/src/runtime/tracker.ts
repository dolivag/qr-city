import { Texture } from 'three';
import type { BufferGeometry, Object3D , Material} from 'three';

interface Disposable {
  dispose(): void;
}

/** Collects everything that owns GPU memory so a rebuild or `dispose()` can free it all. */
export class ResourceTracker {
  private items = new Set<Disposable>();

  track<T extends Disposable>(item: T): T {
    this.items.add(item);
    return item;
  }

  /** Disposes geometries, materials and their textures found under `root` (safety net). */
  disposeTree(root: Object3D): void {
    root.traverse((o) => {
      const mesh = o as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const m of mats) {
        for (const v of Object.values(m)) if (v instanceof Texture) v.dispose();
        m.dispose();
      }
    });
  }

  dispose(): void {
    for (const i of this.items) i.dispose();
    this.items.clear();
  }
}
