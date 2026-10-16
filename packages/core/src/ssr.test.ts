// @vitest-environment node
import { describe, expect, it } from 'vitest';

describe('SSR safety', () => {
  it('imports without touching window/document', async () => {
    expect(typeof window).toBe('undefined');
    const mod = await import('./index');
    expect(typeof mod.createQrCity).toBe('function');
    expect(Object.keys(mod.styles)).toEqual(['moderna', 'costera', 'ciberpunk', 'nevada']);
  });

  it('createQrCity fails with a helpful message when there is no DOM', async () => {
    const { createQrCity } = await import('./index');
    expect(() => createQrCity({} as HTMLElement, { data: 'x' })).toThrow(/browser DOM/);
  });
});
