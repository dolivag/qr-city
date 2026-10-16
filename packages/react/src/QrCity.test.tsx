import { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { QrCityHandle } from './index';

type QrHandle = QrCityHandle;

type Fake = ReturnType<typeof fakeController>;
const controllers: Fake[] = [];
let lastOptions: Record<string, unknown> = {};
let failNext = false;

function fakeController() {
  return {
    view: 'city', fallback: false, zoom: 1, stage: 'done', toQrSvg: vi.fn(() => '<svg/>'), toQrPng: vi.fn(async () => new Blob()), canvas: document.createElement('canvas'),
    openDoor: vi.fn(), continueIntro: vi.fn(), skipIntro: vi.fn(), reveal: vi.fn(), setView: vi.fn(),
    toggleView: vi.fn(), setZoom: vi.fn(), zoomBy: vi.fn(), resetZoom: vi.fn(), setStyle: vi.fn(),
    update: vi.fn(), toPNG: vi.fn(async () => new Blob()), play: vi.fn(), pause: vi.fn(), resize: vi.fn(), dispose: vi.fn(),
  };
}

vi.mock('@qr-city/core', () => ({
  styles: { moderna: { id: 'moderna' } },
  createQrCity: vi.fn((_el: HTMLElement, options: Record<string, unknown>) => {
    if (failNext) throw new Error('no webgl');
    lastOptions = options;
    const c = fakeController();
    controllers.push(c);
    return c;
  }),
}));

const { QrCity } = await import('./index');
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const render = (ui: React.ReactElement) => act(() => { root.render(ui); });

beforeEach(() => {
  controllers.length = 0;
  failNext = false;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('<QrCity>', () => {
  it('creates the city after mounting and maps props to options (cityStyle → style)', async () => {
    await render(<QrCity data="hola" cityStyle="costera" quality="low" intro="door" pauseAtThreshold zoomable={false} />);
    expect(controllers).toHaveLength(1);
    expect(lastOptions).toMatchObject({ data: 'hola', style: 'costera', quality: 'low', intro: 'door', pauseAtThreshold: true, zoomable: false });
    expect('view' in lastOptions).toBe(false); // undefined props are not passed, so core defaults apply
  });

  it('renders a sized container, merging className and style', async () => {
    await render(<QrCity data="a" className="city" style={{ width: 300 }} aria-label="mi ciudad" />);
    const el = host.firstElementChild as HTMLElement;
    expect(el.className).toBe('city');
    expect(el.style.width).toBe('300px');
    expect(el.style.aspectRatio).toContain('1');
    expect(el.getAttribute('aria-label')).toBe('mi ciudad');
  });

  it('updates in place when props change, without recreating', async () => {
    await render(<QrCity data="a" />);
    await render(<QrCity data="b" background="transparent" />);
    expect(controllers).toHaveLength(1);
    expect(controllers[0].update).toHaveBeenLastCalledWith(expect.objectContaining({ data: 'b', background: 'transparent' }));
  });

  it('does not update when only callback identities change', async () => {
    await render(<QrCity data="a" onReveal={() => {}} />);
    const calls = controllers[0].update.mock.calls.length;
    await render(<QrCity data="a" onReveal={() => {}} />);
    expect(controllers[0].update.mock.calls.length).toBe(calls);
  });

  it('always calls the latest callback', async () => {
    const first = vi.fn();
    const second = vi.fn();
    await render(<QrCity data="a" onReveal={first} />);
    await render(<QrCity data="a" onReveal={second} />);
    (lastOptions.onReveal as () => void)();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('keeps the same style reference when an equal custom style is re-created each render', async () => {
    await render(<QrCity data="a" cityStyle={{ id: 'x' } as never} />);
    const before = controllers[0].update.mock.calls.length;
    await render(<QrCity data="a" cityStyle={{ id: 'x' } as never} />);
    expect(controllers[0].update.mock.calls.length).toBe(before);
  });

  it('recreates the city when intro changes (it is fixed at creation)', async () => {
    await render(<QrCity data="a" />);
    await render(<QrCity data="a" intro="door" />);
    expect(controllers[0].dispose).toHaveBeenCalledTimes(1);
    expect(controllers).toHaveLength(2);
    expect(lastOptions.intro).toBe('door');
  });

  it('disposes on unmount', async () => {
    await render(<QrCity data="a" />);
    act(() => root.unmount());
    expect(controllers[0].dispose).toHaveBeenCalledTimes(1);
    root = createRoot(host);
  });

  it('exposes the controller through a ref', async () => {
    const ref = createRef<QrCityHandle>();
    await render(<QrCity data="a" ref={ref} />);
    ref.current?.reveal();
    ref.current?.setZoom(3, { immediate: true });
    expect(controllers[0].reveal).toHaveBeenCalled();
    expect(controllers[0].setZoom).toHaveBeenCalledWith(3, { immediate: true });
    expect(ref.current?.canvas).toBe(controllers[0].canvas);
  });

  it('passes the fallback option and callback, and exposes the plain QR through the ref', async () => {
    const onFallback = vi.fn();
    const ref = createRef<QrHandle>();
    await render(<QrCity data="a" fallback="none" onFallback={onFallback} ref={ref} />);
    expect(lastOptions).toMatchObject({ fallback: 'none' });
    (lastOptions.onFallback as (e: Error) => void)(new Error('no webgl'));
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(ref.current?.toQrSvg({ margin: 2 })).toBe('<svg/>');
    expect(controllers[0].toQrSvg).toHaveBeenCalledWith({ margin: 2 });
    expect(ref.current?.fallback).toBe(false);
  });

  it('reports creation failures through onError instead of throwing', async () => {
    failNext = true;
    const onError = vi.fn();
    await render(<QrCity data="a" onError={onError} />);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('no webgl');
  });

  it('server-renders an empty container and never touches WebGL', () => {
    const html = renderToString(<QrCity data="a" className="c" />);
    expect(html).toContain('<div');
    expect(controllers).toHaveLength(0);
  });
});
