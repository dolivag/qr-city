import { describe, expect, it } from 'vitest';
import { checkStyle } from './check';
import { styles } from './index';
import type { QrCityStyle } from '../types';

const withPalette = (p: Partial<QrCityStyle['palette']>): QrCityStyle => ({ ...styles.moderna, palette: { ...styles.moderna.palette, ...p } });

describe('checkStyle', () => {
  it('passes every built-in style', () => {
    for (const s of Object.values(styles)) {
      const r = checkStyle(s);
      expect(r.ok, `${s.id}: ${r.warnings.join(' ')}`).toBe(true);
      expect(r.contrast).toBeGreaterThan(4.5);
    }
  });

  it('flags light rooftops', () => {
    const r = checkStyle(withPalette({ roof: '#ddddee' }));
    expect(r.ok).toBe(false);
    expect(r.warnings[0]).toMatch(/Low contrast/);
  });

  it('flags a dark ground, using the darkest of walk, ground and road', () => {
    expect(checkStyle(withPalette({ road: '#b81c00' })).ok).toBe(false);
    expect(checkStyle(withPalette({ ground: '#b81c00' })).ok).toBe(false);
  });

  it('flags a quiet zone that is too small', () => {
    expect(checkStyle({ ...styles.moderna, quietZone: 2 }).warnings.join(' ')).toMatch(/quietZone/);
  });

  it('rejects colors that are not #rrggbb', () => {
    const r = checkStyle(withPalette({ roof: 'red' }));
    expect(r.ok).toBe(false);
    expect(r.contrast).toBe(0);
  });
});
