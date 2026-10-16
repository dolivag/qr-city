import { OrthographicCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { groundPointAt, placeOrtho } from './ortho';

const cam = () => new OrthographicCamera(-1, 1, 1, -1, 0.1, 400);

describe('ortho camera zoom and pan', () => {
  it('the screen center looks at the pan point in the top-down view', () => {
    const c = cam();
    placeOrtho(c, 1, 40, 1.4, 3, 5, -4);
    const p = groundPointAt(c, 0, 0);
    expect(p.x).toBeCloseTo(5, 1);
    expect(p.z).toBeCloseTo(-4, 1);
  });

  it('zooming magnifies: the visible ground span shrinks by the zoom factor', () => {
    const span = (zoom: number) => {
      const c = cam();
      placeOrtho(c, 1, 40, 1, zoom);
      const a = groundPointAt(c, -1, 0);
      const b = groundPointAt(c, 1, 0);
      return Math.hypot(b.x - a.x, b.z - a.z);
    };
    expect(span(1) / span(4)).toBeCloseTo(4, 3);
  });

  it('keeps the anchored point fixed when zooming around it (top-down)', () => {
    const c = cam();
    placeOrtho(c, 1, 40, 1.5, 1);
    const ndc = { x: 0.6, y: -0.3 };
    const g = groundPointAt(c, ndc.x, ndc.y);
    placeOrtho(c, 1, 40, 1.5, 4);
    const p = groundPointAt(c, ndc.x, ndc.y);
    // Correcting the pan by the difference puts the anchor back under the cursor.
    placeOrtho(c, 1, 40, 1.5, 4, g.x - p.x, g.z - p.z);
    const q = groundPointAt(c, ndc.x, ndc.y);
    expect(q.x).toBeCloseTo(g.x, 4);
    expect(q.z).toBeCloseTo(g.z, 4);
  });
});
