import { BoxGeometry, CanvasTexture, Group, Mesh, MeshBasicMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ResourceTracker } from './tracker';

describe('ResourceTracker', () => {
  it('disposes tracked items once and forgets them', () => {
    const tracker = new ResourceTracker();
    const item = tracker.track({ dispose: vi.fn() });
    tracker.dispose();
    tracker.dispose();
    expect(item.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes geometries, materials (also arrays) and their textures under a root', () => {
    const geo = new BoxGeometry();
    const tex = Object.assign(Object.create(CanvasTexture.prototype), { dispose: vi.fn() }) as CanvasTexture;
    const m1 = new MeshBasicMaterial({ color: 0xffffff });
    (m1 as unknown as { map: unknown }).map = tex;
    const m2 = new MeshBasicMaterial();
    const spies = [vi.spyOn(geo, 'dispose'), vi.spyOn(m1, 'dispose'), vi.spyOn(m2, 'dispose')];
    const root = new Group();
    root.add(new Mesh(geo, [m1, m2]));
    new ResourceTracker().disposeTree(root);
    spies.forEach((s) => expect(s).toHaveBeenCalled());
    expect(tex.dispose).toHaveBeenCalled();
  });
});
