// @vitest-environment node
import { describe, expect, it } from 'vitest';

describe('SSR safety', () => {
  it('imports and "defines" without a DOM', async () => {
    expect(typeof HTMLElement).toBe('undefined');
    const mod = await import('./index');
    expect(() => mod.defineQrCity()).not.toThrow();
    await expect(import('./define')).resolves.toBeDefined();
  });
});
