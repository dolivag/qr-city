// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQrCity } from './index';

// jsdom has no WebGL, which is exactly the situation the fallback is for.
let host: HTMLElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  host.remove();
  vi.restoreAllMocks();
});

const svgOf = () => host.querySelector('svg');

describe('without WebGL', () => {
  it('shows a plain QR instead of throwing', () => {
    const city = createQrCity(host, { data: 'https://danioliva.dev' });
    expect(city.fallback).toBe(true);
    expect(city.canvas).toBeNull();
    expect(svgOf()).not.toBeNull();
    expect(svgOf()?.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
  });

  it('uses the style colors: dark roof on light ground', () => {
    createQrCity(host, { data: 'hola', style: 'ciberpunk' });
    const html = svgOf()?.outerHTML ?? '';
    expect(html).toContain('#0f0c1f'); // roof
    expect(html).toContain('#e6e9ff'); // ground
  });

  it('tells the host what happened, once, and finishes the intro so UIs can carry on', async () => {
    const onFallback = vi.fn();
    const onReveal = vi.fn();
    const onIntroStage = vi.fn();
    const city = createQrCity(host, { data: 'a', intro: 'door', onFallback, onReveal, onIntroStage });
    expect(city.stage).toBe('done');
    await Promise.resolve();
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect((onFallback.mock.calls[0][0] as Error).message).toMatch(/WebGL is not available/);
    expect(onIntroStage).toHaveBeenCalledWith('done');
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('logs a warning when nobody listens', async () => {
    createQrCity(host, { data: 'a' });
    await Promise.resolve();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('throws as before with fallback: "none"', () => {
    expect(() => createQrCity(host, { data: 'a', fallback: 'none' })).toThrow(/Could not create a WebGL context/);
    expect(host.children).toHaveLength(0);
  });

  it('update() redraws the code, and rejects invalid data without touching the current one', () => {
    const city = createQrCity(host, { data: 'first' });
    const before = svgOf()?.outerHTML;
    city.update({ data: 'second' });
    expect(svgOf()?.outerHTML).not.toBe(before);
    const now = svgOf()?.outerHTML;
    expect(() => city.update({ data: '' })).toThrow(/non-empty/);
    expect(svgOf()?.outerHTML).toBe(now);
    expect(() => city.update({ intro: 'door' })).toThrow(/fixed at creation/);
  });

  it('exports the current code as a plain SVG, with the options applied', () => {
    const city = createQrCity(host, { data: 'hola', style: 'costera', errorCorrection: 'H' });
    const svg = city.toQrSvg({ dark: '#111111', margin: 2 });
    expect(svg).toContain('fill="#111111"');
    expect(svg).toContain('fill="#ffffff"');
    city.update({ data: 'otro' });
    expect(city.toQrSvg()).not.toBe(city.toQrSvg({ dark: '#111111' }));
  });

  it('keeps the 3D-only methods harmless', () => {
    const city = createQrCity(host, { data: 'a' });
    expect(() => {
      city.openDoor(); city.continueIntro(); city.skipIntro(); city.setZoom(3); city.zoomBy(2); city.resetZoom();
      city.play(); city.pause(); city.resize();
    }).not.toThrow();
    expect(city.zoom).toBe(1);
    city.reveal();
    expect(city.view).toBe('qr');
  });

  it('dispose() removes the QR and is idempotent', () => {
    const city = createQrCity(host, { data: 'a' });
    city.dispose();
    city.dispose();
    expect(host.children).toHaveLength(0);
  });

  it('still validates the options', () => {
    expect(() => createQrCity(host, { data: '' })).toThrow(/non-empty/);
    expect(() => createQrCity(host, { data: 'a', fallback: 'x' as never })).toThrow(/Invalid fallback/);
  });
});
