import { describe, expect, it } from 'vitest';
import { MAX_DATA_LENGTH, resolveOptions } from './options';
import { resolveStyle, styles } from './styles';

describe('resolveOptions', () => {
  it('applies defaults', () => {
    const o = resolveOptions({ data: 'hola' });
    expect(o).toMatchObject({
      style: 'moderna', intro: 'none', view: 'city', errorCorrection: 'M',
      quality: 'auto', interactive: true, animate: 'auto',
    });
    expect(o.maxPixelRatio).toBeUndefined();
  });

  it.each(['', '   ', undefined, 42])('rejects invalid data %p', (data) => {
    expect(() => resolveOptions({ data: data as never })).toThrow(/non-empty string/);
  });

  it('rejects data over the limit', () => {
    expect(() => resolveOptions({ data: 'a'.repeat(MAX_DATA_LENGTH + 1) })).toThrow(/too long/);
    expect(() => resolveOptions({ data: 'a'.repeat(MAX_DATA_LENGTH) })).not.toThrow();
  });

  it('supports intros "none", "door" and "flyover"', () => {
    expect(resolveOptions({ data: 'x', intro: 'door' }).intro).toBe('door');
    expect(resolveOptions({ data: 'x', intro: 'flyover' }).intro).toBe('flyover');
    expect(resolveOptions({ data: 'x' }).pauseAtThreshold).toBe(false);
    expect(() => resolveOptions({ data: 'x', intro: 'bogus' as never })).toThrow(/Invalid intro/);
  });

  it('validates enums and pixel ratio', () => {
    expect(() => resolveOptions({ data: 'x', view: 'side' as never })).toThrow(/Invalid view/);
    expect(() => resolveOptions({ data: 'x', errorCorrection: 'Z' as never })).toThrow(/Invalid errorCorrection/);
    expect(() => resolveOptions({ data: 'x', quality: 'bogus' as never })).toThrow(/Invalid quality/);
    expect(() => resolveOptions({ data: 'x', maxPixelRatio: 0 })).toThrow(/maxPixelRatio/);
  });
});

describe('styles', () => {
  it('resolves ids and passes custom objects through', () => {
    expect(resolveStyle('moderna')).toBe(styles.moderna);
    const custom = { ...styles.moderna, id: 'custom' };
    expect(resolveStyle(custom)).toBe(custom);
    expect(() => resolveStyle('nope' as never)).toThrow(/Unknown style/);
  });

  it.each(Object.values(styles))('keeps the scannability invariant in "$id": dark roof, light ground', (style) => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    };
    const p = style.palette;
    expect(lum(p.roof)).toBeLessThan(0.35);
    for (const c of [p.walk, p.ground, p.road]) expect(lum(c)).toBeGreaterThan(0.8);
    // The sea starts beyond the beach, which already gives the code its 4 light modules of margin: it may be as deep a blue as it likes
    if (p.water) expect(lum(p.water)).toBeGreaterThan(0.3);
    expect(style.quietZone).toBeGreaterThanOrEqual(5);
  });

  it('exposes the four built-in styles', () => {
    expect(Object.keys(styles)).toEqual(['moderna', 'costera', 'ciberpunk', 'nevada']);
    for (const [id, s] of Object.entries(styles)) expect(s.id).toBe(id);
  });

  it('plaza: off by default; on, it forces the highest error correction', () => {
    expect(resolveOptions({ data: 'x' }).plaza).toBeNull();
    expect(resolveOptions({ data: 'x', plaza: false }).plaza).toBeNull();
    const on = resolveOptions({ data: 'x', plaza: true, errorCorrection: 'L' });
    expect(on.plaza).toEqual({ image: null, size: 0.2 });
    expect(on.errorCorrection).toBe('H');
    expect(resolveOptions({ data: 'x', plaza: { image: 'logo.png', size: 0.25 } }).plaza).toEqual({ image: 'logo.png', size: 0.25 });
  });

  it.each([0.05, 0.3, Number.NaN])('plaza: rejects size %p', (size) => {
    expect(() => resolveOptions({ data: 'x', plaza: { size } })).toThrow(/plaza.size/);
  });
});
