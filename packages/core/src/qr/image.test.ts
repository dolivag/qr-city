import { describe, expect, it } from 'vitest';
import { qrToPng, qrToSvg } from './image';
import { createMatrix } from './matrix';

/** Reads the dark modules back from the SVG path, to compare them with the real matrix. */
function modulesFromSvg(svg: string, quiet: number) {
  const total = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1]);
  const size = total - 2 * quiet;
  const grid = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const d = /<path fill="[^"]+" d="([^"]*)"/.exec(svg)?.[1] ?? '';
  for (const [, x, y, len] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(len); i++) grid[Number(y) - quiet][Number(x) - quiet + i] = true;
  }
  return { size, grid };
}

describe('qrToSvg', () => {
  it.each([
    ['https://danioliva.dev', 'M'],
    ['Ñandú ☃ — café ¿qué tal? 日本語', 'H'],
    ['x'.repeat(250), 'L'],
  ] as const)('draws exactly the modules of the QR for %s (%s)', (data, ecc) => {
    const m = createMatrix(data, ecc);
    const { size, grid } = modulesFromSvg(qrToSvg(data, { errorCorrection: ecc }), 4);
    expect(size).toBe(m.size);
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) expect(grid[r][c]).toBe(m.isDark(r, c));
  });

  it('adds the quiet zone around the code (4 modules by default)', () => {
    const m = createMatrix('hola', 'M');
    expect(qrToSvg('hola')).toContain(`viewBox="0 0 ${m.size + 8} ${m.size + 8}"`);
    expect(qrToSvg('hola', { margin: 0 })).toContain(`viewBox="0 0 ${m.size} ${m.size}"`);
  });

  it('uses black on white by default and accepts other colors', () => {
    const svg = qrToSvg('hola');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('fill="#000000"');
    const custom = qrToSvg('hola', { dark: '#36415f', light: 'rgb(238, 240, 246)' });
    expect(custom).toContain('fill="#36415f"');
    expect(custom).toContain('fill="rgb(238, 240, 246)"');
  });

  it('refuses colors that could break out of the attribute', () => {
    expect(() => qrToSvg('hola', { dark: '"/><script>alert(1)</script>' })).toThrow(/plain CSS color/);
    expect(() => qrToSvg('hola', { light: "red' onload='x" })).toThrow(/plain CSS color/);
  });

  it('escapes the title', () => {
    const svg = qrToSvg('hola', { title: '<b>"Mi" & \'QR\'</b>' });
    expect(svg).toContain('<title>&#60;b&#62;&#34;Mi&#34; &#38; &#39;QR&#39;&#60;/b&#62;</title>');
    expect(svg).not.toContain('<b>');
  });

  it('validates its input', () => {
    expect(() => qrToSvg('')).toThrow(/non-empty string/);
    expect(() => qrToSvg('a'.repeat(301))).toThrow(/too long/);
    expect(() => qrToSvg('hola', { margin: -1 })).toThrow(/margin/);
    expect(() => qrToSvg('hola', { margin: 1.5 })).toThrow(/margin/);
  });

  it('is deterministic and needs no DOM', () => {
    expect(typeof document).toBe('undefined');
    expect(qrToSvg('same')).toBe(qrToSvg('same'));
  });
});

describe('qrToPng', () => {
  it('rejects on the server instead of throwing synchronously', async () => {
    await expect(qrToPng('hola')).rejects.toThrow(/browser DOM/);
  });
});
