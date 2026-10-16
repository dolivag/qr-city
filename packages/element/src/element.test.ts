import { beforeEach, describe, expect, it, vi } from 'vitest';

const controllers: ReturnType<typeof fakeController>[] = [];
let lastOptions: Record<string, unknown> = {};

function fakeController() {
  return {
    view: 'city' as 'city' | 'qr',
    openDoor: vi.fn(), continueIntro: vi.fn(), skipIntro: vi.fn(), stage: 'done',
    reveal: vi.fn(), setView: vi.fn(), toggleView: vi.fn(), setStyle: vi.fn(),
    update: vi.fn(), toPNG: vi.fn(async () => new Blob()), play: vi.fn(), pause: vi.fn(),
    resize: vi.fn(), dispose: vi.fn(), canvas: document.createElement('canvas'),
  };
}

vi.mock('@qr-city/core', () => ({
  createQrCity: vi.fn((_el: HTMLElement, options: Record<string, unknown>) => {
    if (options.data === 'boom') throw new Error('no webgl');
    lastOptions = options;
    const c = fakeController();
    controllers.push(c);
    return c;
  }),
}));

const { defineQrCity, QrCityElement } = await import('./index');
defineQrCity();

const make = (attrs: Record<string, string> = {}) => {
  const el = document.createElement('qr-city');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

beforeEach(() => {
  controllers.length = 0;
  document.body.innerHTML = '';
});

describe('<qr-city>', () => {
  it('registers once and is idempotent', () => {
    defineQrCity();
    expect(customElements.get('qr-city')).toBe(QrCityElement);
  });

  it('does nothing until it has data', () => {
    const el = make();
    document.body.append(el);
    expect(el.controller).toBeNull();
    el.setAttribute('data', 'https://example.com');
    expect(el.controller).not.toBeNull();
  });

  it('maps attributes to options', () => {
    document.body.append(make({
      data: 'hola', 'style-name': 'moderna', view: 'qr', 'error-correction': 'H',
      quality: 'low', animate: 'false', interactive: 'false', background: 'transparent',
    }));
    expect(lastOptions).toMatchObject({
      data: 'hola', style: 'moderna', view: 'qr', errorCorrection: 'H',
      quality: 'low', animate: false, interactive: false, background: 'transparent',
    });
  });

  it('updates the controller when attributes or properties change', () => {
    const el = make({ data: 'a' });
    document.body.append(el);
    const c = controllers[0];
    el.setAttribute('data', 'b');
    expect(c.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: 'b' }));
    el.cityStyle = { id: 'x' } as never;
    expect(c.update).toHaveBeenLastCalledWith(expect.objectContaining({ style: { id: 'x' } }));
  });

  it('disposes on disconnect and recreates on reconnect', () => {
    const el = make({ data: 'a' });
    document.body.append(el);
    el.remove();
    expect(controllers[0].dispose).toHaveBeenCalledTimes(1);
    expect(el.controller).toBeNull();
    document.body.append(el);
    expect(controllers).toHaveLength(2);
  });

  it('disposes when data is removed', () => {
    const el = make({ data: 'a' });
    document.body.append(el);
    el.removeAttribute('data');
    expect(controllers[0].dispose).toHaveBeenCalled();
  });

  it('re-emits core callbacks as composed CustomEvents', () => {
    const el = make({ data: 'a' });
    document.body.append(el);
    const seen: string[] = [];
    document.body.addEventListener('qr-city-reveal', () => seen.push('reveal'));
    document.body.addEventListener('qr-city-viewchange', (e) => seen.push(`view:${(e as CustomEvent).detail.view}`));
    (lastOptions.onReveal as () => void)();
    (lastOptions.onViewChange as (v: string) => void)('qr');
    expect(seen).toEqual(['reveal', 'view:qr']);
  });

  it('reports creation failures as an event instead of throwing', () => {
    const el = make({ data: 'boom' });
    const onError = vi.fn();
    el.addEventListener('qr-city-error', onError);
    expect(() => document.body.append(el)).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(el.controller).toBeNull();
    return expect(el.toPNG()).rejects.toThrow(/not rendering/);
  });

  it('upgrades properties set before the element was defined', () => {
    const el = document.createElement('qr-city-late') as HTMLElement & { data?: string };
    el.data = 'early';
    document.body.append(el);
    defineQrCity('qr-city-late');
    expect(controllers).toHaveLength(1);
    expect(lastOptions.data).toBe('early');
  });

  it('maps the door-intro attributes and re-emits stage changes', () => {
    document.body.append(make({ data: 'a', intro: 'door', 'pause-at-threshold': '', 'door-label': 'Abrir la puerta' }));
    expect(lastOptions).toMatchObject({ intro: 'door', pauseAtThreshold: true, doorLabel: 'Abrir la puerta' });
    const stages: string[] = [];
    document.body.addEventListener('qr-city-introstage', (e) => stages.push((e as CustomEvent).detail.stage));
    (lastOptions.onIntroStage as (s: string) => void)('threshold');
    expect(stages).toEqual(['threshold']);
  });

  it('restarts the controller when intro changes (it is fixed at creation)', () => {
    const el = make({ data: 'a' });
    document.body.append(el);
    el.setAttribute('intro', 'door');
    expect(controllers[0].dispose).toHaveBeenCalled();
    expect(controllers).toHaveLength(2);
    expect(lastOptions.intro).toBe('door');
  });

  it('forwards the intro methods', () => {
    const el = make({ data: 'a', intro: 'door' });
    document.body.append(el);
    el.openDoor();
    el.continueIntro();
    el.skipIntro();
    const c = controllers[0] as unknown as Record<string, ReturnType<typeof vi.fn>>;
    expect(c.openDoor).toHaveBeenCalled();
    expect(c.continueIntro).toHaveBeenCalled();
    expect(c.skipIntro).toHaveBeenCalled();
  });

  it('forwards imperative methods', () => {
    const el = make({ data: 'a' });
    document.body.append(el);
    el.reveal();
    el.toggleView();
    expect(controllers[0].reveal).toHaveBeenCalled();
    expect(controllers[0].toggleView).toHaveBeenCalled();
  });
});
