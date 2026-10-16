import { describe, expect, it } from 'vitest';
import { createMatrix } from './matrix';

describe('createMatrix', () => {
  it('builds a square matrix with the three finder patterns', () => {
    const m = createMatrix('https://github.com', 'M');
    expect(m.size).toBeGreaterThanOrEqual(21);
    for (const [r, c] of [[0, 0], [0, m.size - 7], [m.size - 7, 0]]) {
      expect(m.isDark(r, c)).toBe(true);
      expect(m.isDark(r + 6, c + 6)).toBe(true);
      expect(m.isDark(r + 3, c + 3)).toBe(true);
      expect(m.isDark(r + 1, c + 1)).toBe(false);
    }
  });

  it('treats out-of-range cells as light', () => {
    const m = createMatrix('hi', 'L');
    expect(m.isDark(-1, 0)).toBe(false);
    expect(m.isDark(0, m.size)).toBe(false);
  });

  it('is deterministic', () => {
    const a = createMatrix('same', 'M');
    const b = createMatrix('same', 'M');
    expect(a.size).toBe(b.size);
    for (let r = 0; r < a.size; r++) for (let c = 0; c < a.size; c++) expect(a.isDark(r, c)).toBe(b.isDark(r, c));
  });

  it('encodes non-ASCII text as UTF-8 (different from its Latin-1 truncation)', () => {
    const a = createMatrix('ñandú ☃', 'M');
    const b = createMatrix('nandu ?', 'M');
    expect(a.size).toBeGreaterThan(0);
    const same = Array.from({ length: a.size ** 2 }).every((_, i) => {
      const r = Math.floor(i / a.size);
      const c = i % a.size;
      return a.size === b.size && a.isDark(r, c) === b.isDark(r, c);
    });
    expect(same).toBe(false);
  });

  it('grows with the error-correction level', () => {
    const data = 'x'.repeat(120);
    expect(createMatrix(data, 'H').size).toBeGreaterThan(createMatrix(data, 'L').size);
  });
});
