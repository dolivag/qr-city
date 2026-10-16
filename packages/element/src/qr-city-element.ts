import { createQrCity } from '@qr-city/core';
import type {
  QrCityController,
  QrCityEcc,
  QrCityIntro,
  QrCityIntroStage,
  QrCityOptions,
  QrCityQuality,
  QrCityStyle,
  QrCityStyleId,
  QrCityView,
} from '@qr-city/core';

/** `HTMLElement` does not exist on the server: keep the module importable during SSR. */
const Base: typeof HTMLElement =
  typeof HTMLElement === 'undefined' ? (class {} as unknown as typeof HTMLElement) : HTMLElement;

const ATTRIBUTES = [
  'data', 'style-name', 'intro', 'view', 'error-correction', 'quality',
  'animate', 'interactive', 'background', 'label', 'pause-at-threshold', 'door-label', 'zoomable', 'max-zoom', 'wheel-zoom',
] as const;

const TEMPLATE_CSS = `
  :host { display: block; position: relative; aspect-ratio: 1 / 1; contain: layout paint; }
  :host([hidden]) { display: none; }
  #stage { position: absolute; inset: 0; }
`;

export interface QrCityEventMap {
  'qr-city-reveal': CustomEvent<void>;
  'qr-city-viewchange': CustomEvent<{ view: QrCityView }>;
  'qr-city-introstage': CustomEvent<{ stage: QrCityIntroStage }>;
  'qr-city-zoomchange': CustomEvent<{ zoom: number }>;
  'qr-city-error': CustomEvent<{ error: Error }>;
}

/**
 * `<qr-city data="https://example.com">`: a 3D city whose rooftops form a scannable QR.
 *
 * Attributes: `data`, `style-name`, `intro`, `view`, `error-correction`, `quality`,
 * `animate` (`auto` | `true` | `false`; property `animated`), `interactive` (`false` disables clicks), `background`, `label`,
 * `pause-at-threshold` (with `intro="door"`: wait at the white screen until `continueIntro()`), `door-label`,
 * `zoomable` (`false` disables zoom and pan), `max-zoom`, `wheel-zoom` (`ctrl` | `always` | `off`).
 * Size it with CSS (default: a square as wide as its container).
 */
export class QrCityElement extends Base {
  static readonly observedAttributes = ATTRIBUTES;

  #stage: HTMLDivElement | null = null;
  #controller: QrCityController | null = null;
  #io: IntersectionObserver | null = null;
  #opts: Partial<QrCityOptions> = {};
  #mountedIntro: QrCityIntro | undefined;
  #userPaused = false;
  #visible = true;

  constructor() {
    super();
    if (typeof this.attachShadow !== 'function') return;
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = TEMPLATE_CSS;
    this.#stage = document.createElement('div');
    this.#stage.id = 'stage';
    root.append(style, this.#stage);
  }

  // ---- Properties ------------------------------------------------------
  get data(): string | undefined { return this.#opts.data; }
  set data(v: string | undefined) { this.#set({ data: v }); }

  /** A built-in style id or a custom style object (the `style-name` attribute accepts ids only). */
  get cityStyle(): QrCityStyleId | QrCityStyle | undefined { return this.#opts.style; }
  set cityStyle(v: QrCityStyleId | QrCityStyle | undefined) { this.#set({ style: v }); }

  get intro(): QrCityIntro | undefined { return this.#opts.intro; }
  set intro(v: QrCityIntro | undefined) { this.#set({ intro: v }); }

  get view(): QrCityView { return this.#controller?.view ?? this.#opts.view ?? 'city'; }
  set view(v: QrCityView | undefined) { this.#set({ view: v }); }

  get errorCorrection(): QrCityEcc | undefined { return this.#opts.errorCorrection; }
  set errorCorrection(v: QrCityEcc | undefined) { this.#set({ errorCorrection: v }); }

  get quality(): QrCityQuality | undefined { return this.#opts.quality; }
  set quality(v: QrCityQuality | undefined) { this.#set({ quality: v }); }

  get animated(): boolean | 'auto' | undefined { return this.#opts.animate; }
  set animated(v: boolean | 'auto' | undefined) { this.#set({ animate: v }); }

  get interactive(): boolean | undefined { return this.#opts.interactive; }
  set interactive(v: boolean | undefined) { this.#set({ interactive: v }); }

  get background(): string | undefined { return this.#opts.background; }
  set background(v: string | undefined) { this.#set({ background: v }); }

  get label(): string | undefined { return this.#opts.label; }
  set label(v: string | undefined) { this.#set({ label: v }); }

  get pauseAtThreshold(): boolean | undefined { return this.#opts.pauseAtThreshold; }
  set pauseAtThreshold(v: boolean | undefined) { this.#set({ pauseAtThreshold: v }); }

  get doorLabel(): string | undefined { return this.#opts.doorLabel; }
  set doorLabel(v: string | undefined) { this.#set({ doorLabel: v }); }

  get zoomable(): boolean | undefined { return this.#opts.zoomable; }
  set zoomable(v: boolean | undefined) { this.#set({ zoomable: v }); }

  get maxZoom(): number | undefined { return this.#opts.maxZoom; }
  set maxZoom(v: number | undefined) { this.#set({ maxZoom: v }); }

  get wheelZoom(): 'ctrl' | 'always' | 'off' | undefined { return this.#opts.wheelZoom; }
  set wheelZoom(v: 'ctrl' | 'always' | 'off' | undefined) { this.#set({ wheelZoom: v }); }

  /** Current zoom (1 = the whole city in view). */
  get zoom(): number { return this.#controller?.zoom ?? 1; }

  /** Current stage of the door intro (`'done'` without an intro). */
  get stage(): QrCityIntroStage { return this.#controller?.stage ?? 'done'; }

  /** The underlying controller, or `null` while disconnected or without valid `data`. */
  get controller(): QrCityController | null { return this.#controller; }

  // ---- Methods ---------------------------------------------------------
  openDoor(): void { this.#controller?.openDoor(); }
  continueIntro(): void { this.#controller?.continueIntro(); }
  skipIntro(): void { this.#controller?.skipIntro(); }
  setZoom(zoom: number, opts?: { immediate?: boolean; at?: { x: number; y: number } }): void { this.#controller?.setZoom(zoom, opts); }
  zoomBy(factor: number, opts?: { at?: { x: number; y: number } }): void { this.#controller?.zoomBy(factor, opts); }
  resetZoom(opts?: { immediate?: boolean }): void { this.#controller?.resetZoom(opts); }
  reveal(): void { this.#controller?.reveal(); }
  setView(view: QrCityView, opts?: { immediate?: boolean }): void { this.#controller?.setView(view, opts); }
  toggleView(): void { this.#controller?.toggleView(); }
  toPNG(opts?: { scale?: number }): Promise<Blob> {
    if (!this.#controller) return Promise.reject(new Error('[qr-city] The element is not rendering (no valid `data` or not connected).'));
    return this.#controller.toPNG(opts);
  }
  play(): void { this.#userPaused = false; this.#syncLoop(); }
  pause(): void { this.#userPaused = true; this.#syncLoop(); }

  // ---- Lifecycle -------------------------------------------------------
  connectedCallback(): void {
    for (const p of ['data', 'cityStyle', 'intro', 'view', 'errorCorrection', 'quality', 'animated', 'interactive', 'background', 'label', 'pauseAtThreshold', 'doorLabel', 'zoomable', 'maxZoom', 'wheelZoom']) {
      this.#upgrade(p);
    }
    for (const name of ATTRIBUTES) this.#readAttribute(name, this.getAttribute(name));
    if (typeof IntersectionObserver !== 'undefined') {
      this.#io = new IntersectionObserver((entries) => {
        this.#visible = entries[entries.length - 1]?.isIntersecting ?? true;
        this.#syncLoop();
      });
      this.#io.observe(this);
    }
    this.#mount();
  }

  disconnectedCallback(): void {
    this.#io?.disconnect();
    this.#io = null;
    this.#unmount();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    this.#readAttribute(name, value);
    if (this.isConnected) this.#apply();
  }

  // ---- Internals -------------------------------------------------------
  /** Re-applies an instance property set before the element was upgraded. */
  #upgrade(prop: string): void {
    if (Object.prototype.hasOwnProperty.call(this, prop)) {
      const value = (this as unknown as Record<string, unknown>)[prop];
      delete (this as unknown as Record<string, unknown>)[prop];
      (this as unknown as Record<string, unknown>)[prop] = value;
    }
  }

  #readAttribute(name: string, value: string | null): void {
    const v = value ?? undefined;
    const o = this.#opts as Record<string, unknown>;
    switch (name) {
      case 'data': o.data = v; break;
      case 'style-name': if (v !== undefined || typeof o.style === 'string') o.style = v; break;
      case 'intro': o.intro = v; break;
      case 'view': o.view = v; break;
      case 'error-correction': o.errorCorrection = v; break;
      case 'quality': o.quality = v; break;
      case 'animate': o.animate = v === undefined || v === 'auto' ? undefined : v !== 'false'; break;
      case 'interactive': o.interactive = v === undefined ? undefined : v !== 'false'; break;
      case 'background': o.background = v; break;
      case 'label': o.label = v; break;
      case 'pause-at-threshold': o.pauseAtThreshold = v === undefined ? undefined : v !== 'false'; break;
      case 'door-label': o.doorLabel = v; break;
      case 'zoomable': o.zoomable = v === undefined ? undefined : v !== 'false'; break;
      case 'max-zoom': o.maxZoom = v === undefined ? undefined : Number(v); break;
      case 'wheel-zoom': o.wheelZoom = v; break;
    }
  }

  #set(patch: Partial<QrCityOptions>): void {
    Object.assign(this.#opts, patch);
    if (this.isConnected) this.#apply();
  }

  #clean(): QrCityOptions {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this.#opts)) if (v !== undefined) out[k] = v;
    return out as unknown as QrCityOptions;
  }

  #emit<K extends keyof QrCityEventMap>(type: K, detail: QrCityEventMap[K]['detail']): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  #apply(): void {
    if (!this.#controller) { this.#mount(); return; }
    if (!this.#opts.data) { this.#unmount(); return; }
    // `intro` is fixed when the controller is created: changing it means starting over.
    if ((this.#opts.intro ?? 'none') !== (this.#mountedIntro ?? 'none')) { this.#unmount(); this.#mount(); return; }
    try {
      this.#controller.update(this.#clean());
    } catch (error) {
      this.#emit('qr-city-error', { error: error as Error });
    }
  }

  #mount(): void {
    if (this.#controller || !this.#stage || !this.#opts.data) return;
    try {
      this.#controller = createQrCity(this.#stage, {
        ...this.#clean(),
        onReveal: () => this.#emit('qr-city-reveal', undefined),
        onIntroStage: (stage) => this.#emit('qr-city-introstage', { stage }),
        onZoomChange: (zoom) => this.#emit('qr-city-zoomchange', { zoom }),
        onViewChange: (view) => this.#emit('qr-city-viewchange', { view }),
        onError: (error) => this.#emit('qr-city-error', { error }),
      });
      this.#mountedIntro = this.#opts.intro;
      this.#syncLoop();
    } catch (error) {
      this.#emit('qr-city-error', { error: error as Error });
    }
  }

  #unmount(): void {
    this.#controller?.dispose();
    this.#controller = null;
  }

  #syncLoop(): void {
    if (!this.#controller) return;
    if (this.#visible && !this.#userPaused) this.#controller.play(); else this.#controller.pause();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'qr-city': QrCityElement;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface HTMLElementEventMap extends QrCityEventMap {}
}
