import { describe, expect, it } from 'vitest';
import { checkStyle } from './check';
import { resolveStyleAt, styles } from './index';
import { nightOf } from './night';

describe('night styles', () => {
  it.each(Object.values(styles))('$id: night keeps the scan-ability invariant', (style) => {
    expect(checkStyle(nightOf(style)).ok).toBe(true);
  });

  it('keeps roofs and ground as they are (the QR must scan the same)', () => {
    for (const s of Object.values(styles)) {
      const n = nightOf(s);
      expect(n.palette.roof).toBe(s.palette.roof);
      expect([n.palette.walk, n.palette.ground, n.palette.road]).toEqual([s.palette.walk, s.palette.ground, s.palette.road]);
      expect(n.night).toBe(true);
      expect(n.quietZone).toBe(s.quietZone);
    }
  });

  it('returns the same object for the same style, so update() can compare by identity', () => {
    expect(nightOf(styles.moderna)).toBe(nightOf(styles.moderna));
    expect(resolveStyleAt('moderna', 'night')).toBe(resolveStyleAt('moderna', 'night'));
    expect(resolveStyleAt('moderna', 'day')).toBe(styles.moderna);
    expect(nightOf(nightOf(styles.moderna))).toBe(nightOf(styles.moderna));
  });

  it('lights the windows, but keeps a neon style its own colours', () => {
    expect(nightOf(styles.moderna).buildings.neon?.length).toBeGreaterThan(0);
    expect(nightOf(styles.ciberpunk).buildings.neon).toBe(styles.ciberpunk.buildings.neon);
  });
});
