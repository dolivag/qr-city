import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  isDevMode,
  output,
  signal,
  untracked,
} from '@angular/core';
import { createQrCity } from '@qr-city/core';
import type {
  QrCityController,
  QrCityEcc,
  QrCityIntro,
  QrCityIntroStage,
  QrCityOptions,
  QrCityPlaza,
  QrCityQuality,
  QrCityStyle,
  QrCityStyleId,
  QrCityTime,
  QrCityView,
} from '@qr-city/core';

type ConfigOptions = Omit<QrCityOptions, 'onReveal' | 'onIntroStage' | 'onViewChange' | 'onZoomChange' | 'onError' | 'intro'>;

/**
 * `<qr-city-view data="https://…" />`: a 3D city whose rooftops form a scannable QR code.
 *
 * Standalone and zoneless-friendly: it starts WebGL after the first render (so it is SSR-safe), runs
 * the animation loop outside the Angular zone, and applies input changes in place.
 * Size it with CSS (default: a square as wide as its container).
 */
@Component({
  selector: 'qr-city-view',
  template: '',
  styles: [':host { display: block; position: relative; aspect-ratio: 1 / 1; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrCityComponent {
  /** Text or URL encoded in the QR (1–300 characters). */
  readonly data = input.required<string>();
  /** Built-in style id or a custom style object. */
  readonly cityStyle = input<QrCityStyleId | QrCityStyle>();
  /** Fixed at creation: changing it starts over. */
  readonly intro = input<QrCityIntro>();
  readonly pauseAtThreshold = input<boolean>();
  readonly view = input<QrCityView>();
  readonly errorCorrection = input<QrCityEcc>();
  readonly quality = input<QrCityQuality>();
  readonly interactive = input<boolean>();
  readonly animate = input<boolean | 'auto'>();
  readonly maxPixelRatio = input<number>();
  readonly zoomable = input<boolean>();
  readonly maxZoom = input<number>();
  readonly wheelZoom = input<'ctrl' | 'always' | 'off'>();
  /** `'qr'` (default) shows a plain QR when WebGL is missing; `'none'` reports an error instead. */
  readonly fallback = input<'qr' | 'none'>();
  readonly background = input<string>();
  readonly label = input<string>();
  readonly doorLabel = input<string>();
  /** `'night'`: the same city after dark. Default `'day'`. */
  readonly time = input<QrCityTime>();
  /** A plaza with your picture in the middle of the city: `true` or `{ image, size }`. */
  readonly plaza = input<boolean | QrCityPlaza>();

  /** The city is on screen: it finished building (or the door intro finished). */
  readonly revealed = output<void>();
  readonly introStageChange = output<QrCityIntroStage>();
  readonly viewChange = output<QrCityView>();
  readonly zoomChange = output<number>();
  /** WebGL is not available: a plain QR is shown instead of the city. */
  readonly fallbackUsed = output<Error>();
  /** Failures: no WebGL, invalid data, a lost context… */
  readonly qrError = output<Error>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly mounted = signal(false);
  private instance: QrCityController | null = null;

  /** Everything but `intro` and the callbacks, without `undefined` so the core applies its defaults. */
  private readonly config = computed<ConfigOptions>(() => {
    const all: Record<string, unknown> = {
      data: this.data(),
      style: this.cityStyle(),
      pauseAtThreshold: this.pauseAtThreshold(),
      view: this.view(),
      errorCorrection: this.errorCorrection(),
      quality: this.quality(),
      interactive: this.interactive(),
      animate: this.animate(),
      maxPixelRatio: this.maxPixelRatio(),
      zoomable: this.zoomable(),
      maxZoom: this.maxZoom(),
      wheelZoom: this.wheelZoom(),
      fallback: this.fallback(),
      background: this.background(),
      label: this.label(),
      doorLabel: this.doorLabel(),
      plaza: this.plaza(),
      time: this.time(),
    };
    for (const k of Object.keys(all)) if (all[k] === undefined) delete all[k];
    return all as unknown as ConfigOptions;
  });

  /** The controller (`null` until the first render, and on the server). */
  get controller(): QrCityController | null { return this.instance; }
  get stage(): QrCityIntroStage { return this.instance?.stage ?? 'done'; }
  get currentView(): QrCityView { return this.instance?.view ?? 'city'; }
  get zoom(): number { return this.instance?.zoom ?? 1; }
  /** `true` while a plain QR is shown because WebGL is not available. */
  get usingFallback(): boolean { return this.instance?.fallback ?? false; }

  constructor() {
    // Browser only: never runs during server-side rendering.
    afterNextRender(() => this.mounted.set(true));

    // `intro` is fixed when the city is created, so (re)create it when it changes.
    effect((onCleanup) => {
      if (!this.mounted()) return;
      const intro = this.intro();
      untracked(() => this.create(intro));
      onCleanup(() => this.destroy());
    });

    // Everything else is applied in place; the city is rebuilt only when it has to be.
    effect(() => {
      const next = this.config();
      untracked(() => {
        try { this.instance?.update(next as QrCityOptions); } catch (error) { this.report(error); }
      });
    });

    inject(DestroyRef).onDestroy(() => this.destroy());
  }

  openDoor(): void { this.instance?.openDoor(); }
  continueIntro(): void { this.instance?.continueIntro(); }
  skipIntro(): void { this.instance?.skipIntro(); }
  reveal(): void { this.instance?.reveal(); }
  setView(view: QrCityView, opts?: { immediate?: boolean }): void { this.instance?.setView(view, opts); }
  toggleView(): void { this.instance?.toggleView(); }
  setZoom(zoom: number, opts?: { immediate?: boolean; at?: { x: number; y: number } }): void { this.instance?.setZoom(zoom, opts); }
  zoomBy(factor: number, opts?: { at?: { x: number; y: number } }): void { this.instance?.zoomBy(factor, opts); }
  resetZoom(opts?: { immediate?: boolean }): void { this.instance?.resetZoom(opts); }
  /** The current code as a plain, print-ready SVG. */
  toQrSvg(opts?: Parameters<QrCityController['toQrSvg']>[0]): string {
    if (!this.instance) throw new Error('[qr-city] The city is not mounted.');
    return this.instance.toQrSvg(opts);
  }
  toQrPng(opts?: Parameters<QrCityController['toQrPng']>[0]): Promise<Blob> {
    return this.instance ? this.instance.toQrPng(opts) : Promise.reject(new Error('[qr-city] The city is not mounted.'));
  }
  play(): void { this.instance?.play(); }
  pause(): void { this.instance?.pause(); }
  toPNG(opts?: { scale?: number }): Promise<Blob> {
    return this.instance ? this.instance.toPNG(opts) : Promise.reject(new Error('[qr-city] The city is not mounted.'));
  }

  private create(intro: QrCityIntro | undefined): void {
    this.destroy();
    const inZone = <T>(fn: () => T) => () => this.zone.run(fn);
    try {
      // The animation loop must not trigger change detection every frame.
      this.instance = this.zone.runOutsideAngular(() =>
        createQrCity(this.host.nativeElement, {
          ...this.config(),
          ...(intro ? { intro } : {}),
          onReveal: inZone(() => this.revealed.emit()),
          onIntroStage: (s) => inZone(() => this.introStageChange.emit(s))(),
          onViewChange: (v) => inZone(() => this.viewChange.emit(v))(),
          onZoomChange: (z) => inZone(() => this.zoomChange.emit(z))(),
          onFallback: (r) => inZone(() => this.fallbackUsed.emit(r))(),
          onError: (e) => this.report(e),
        } as QrCityOptions),
      );
    } catch (error) {
      this.report(error);
    }
  }

  private destroy(): void {
    this.instance?.dispose();
    this.instance = null;
  }

  private report(error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));
    if (isDevMode()) console.error(err);
    this.zone.run(() => this.qrError.emit(err));
  }
}
