import { createApp, defineComponent, h, nextTick, reactive } from 'vue';
import type { App } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  qrPlaceholder: vi.fn(() => '<svg data-placeholder="1" width="100%" height="100%"></svg>'),
  createQrCity: vi.fn((_el: HTMLElement, options: Record<string, unknown>) => {
    if (failNext) throw new Error('no webgl');
    lastOptions = options;
    const c = fakeController();
    controllers.push(c);
    return c;
  }),
}));

const { QrCity } = await import('./index');

let host: HTMLElement;
let app: App | null = null;

/** Mounts `<QrCity v-bind="props">` and returns the reactive props (to change them) and the component ref. */
function mount(initial: Record<string, unknown>, listeners: Record<string, (...a: never[]) => void> = {}) {
  const props = reactive({ ...initial });
  const inst: { current: unknown } = { current: null };
  const Root = defineComponent({
    render: () => h(QrCity as never, { ...props, ...listeners, ref: (r: unknown) => { inst.current = r; } }),
  });
  app = createApp(Root);
  app.mount(host);
  return { props, inst };
}

beforeEach(() => {
  controllers.length = 0;
  failNext = false;
  host = document.createElement('div');
  document.body.append(host);
});
afterEach(() => {
  app?.unmount();
  app = null;
  host.remove();
});

describe('<QrCity> (Vue)', () => {
  it('creates the city on mount and maps props to options (cityStyle → style)', () => {
    mount({ data: 'hola', cityStyle: 'costera', quality: 'low', intro: 'door', pauseAtThreshold: true, zoomable: false });
    expect(controllers).toHaveLength(1);
    expect(lastOptions).toMatchObject({ data: 'hola', style: 'costera', quality: 'low', intro: 'door', pauseAtThreshold: true, zoomable: false });
    expect('view' in lastOptions).toBe(false); // absent props are not passed, so core defaults apply
    expect('interactive' in lastOptions).toBe(false); // Boolean props do not default to false
  });

  it('renders a sized root and lets class and style fall through', () => {
    const props = reactive({ data: 'a', class: 'city', style: { width: '300px' } });
    app = createApp({ render: () => h(QrCity as never, { ...props }) });
    app.mount(host);
    const el = host.firstElementChild as HTMLElement;
    expect(el.classList.contains('city')).toBe(true);
    expect(el.style.width).toBe('300px');
    expect(el.style.aspectRatio).toContain('1');
  });

  it('updates in place when props change, without recreating', async () => {
    const { props } = mount({ data: 'a' });
    props.data = 'b';
    props.background = 'transparent';
    await nextTick();
    expect(controllers).toHaveLength(1);
    expect(controllers[0].update).toHaveBeenLastCalledWith(expect.objectContaining({ data: 'b', background: 'transparent' }));
  });

  it('recreates the city when intro changes (it is fixed at creation)', async () => {
    const { props } = mount({ data: 'a' });
    props.intro = 'door';
    await nextTick();
    expect(controllers[0].dispose).toHaveBeenCalledTimes(1);
    expect(controllers).toHaveLength(2);
    expect(lastOptions.intro).toBe('door');
  });

  it('disposes on unmount', () => {
    mount({ data: 'a' });
    app?.unmount();
    app = null;
    expect(controllers[0].dispose).toHaveBeenCalledTimes(1);
  });

  it('turns the core callbacks into Vue events', () => {
    const onReveal = vi.fn();
    const onIntroStage = vi.fn();
    const onViewChange = vi.fn();
    const onZoomChange = vi.fn();
    mount({ data: 'a' }, { onReveal, 'onIntro-stage': onIntroStage, 'onView-change': onViewChange, 'onZoom-change': onZoomChange } as never);
    (lastOptions.onReveal as () => void)();
    (lastOptions.onIntroStage as (s: string) => void)('threshold');
    (lastOptions.onViewChange as (v: string) => void)('qr');
    (lastOptions.onZoomChange as (z: number) => void)(2);
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(onIntroStage).toHaveBeenCalledWith('threshold');
    expect(onViewChange).toHaveBeenCalledWith('qr');
    expect(onZoomChange).toHaveBeenCalledWith(2);
  });

  it('emits "fallback", passes the fallback prop and exposes the plain QR', () => {
    const onFallback = vi.fn();
    const { inst } = mount({ data: 'a', fallback: 'none' }, { onFallback } as never);
    expect(lastOptions).toMatchObject({ fallback: 'none' });
    (lastOptions.onFallback as (e: Error) => void)(new Error('no webgl'));
    expect(onFallback).toHaveBeenCalledTimes(1);
    const api = inst.current as { toQrSvg: (o?: unknown) => string; fallback: boolean };
    expect(api.toQrSvg({ margin: 2 })).toBe('<svg/>');
    expect(controllers[0].toQrSvg).toHaveBeenCalledWith({ margin: 2 });
    expect(api.fallback).toBe(false);
  });

  it('emits "error" instead of throwing when the city cannot be created', () => {
    failNext = true;
    const onError = vi.fn();
    expect(() => mount({ data: 'a' }, { onError } as never)).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toBe('no webgl');
  });

  it('exposes the controller on the template ref', () => {
    const { inst } = mount({ data: 'a' });
    const api = inst.current as Record<string, (...a: unknown[]) => unknown> & { controller: unknown; zoom: number };
    api.reveal();
    api.setZoom(3, { immediate: true });
    expect(controllers[0].reveal).toHaveBeenCalled();
    expect(controllers[0].setZoom).toHaveBeenCalledWith(3, { immediate: true });
    expect(api.controller).toBe(controllers[0]);
    expect(api.zoom).toBe(1);
  });

  it('server-renders a flat QR placeholder and never touches WebGL', async () => {
    const html = await renderToString(createApp({ render: () => h(QrCity as never, { data: 'a' }) }));
    expect(html).toContain('<div');
    expect(html).toContain('data-placeholder="1"');
    expect(html).toContain('aria-hidden="true"');
    expect(controllers).toHaveLength(0);
  });

  it('shows the placeholder until the 3D city has painted, then removes it', async () => {
    mount({ data: 'a' });
    expect(host.querySelector('[data-placeholder]')).not.toBeNull();
    await new Promise((r) => setTimeout(r, 80));
    await nextTick();
    expect(host.querySelector('[data-placeholder]')).toBeNull();
    expect(controllers).toHaveLength(1);
  });
});
