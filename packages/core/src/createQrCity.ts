import { LinearSRGBColorSpace, OrthographicCamera, Scene, WebGLRenderer } from 'three';
import { placeOrtho } from './camera/ortho';
import { resolveOptions, validateData } from './options';
import type { ResolvedOptions } from './options';
import { createMatrix } from './qr/matrix';
import { resolveQuality } from './runtime/quality';
import type { QualityProfile } from './runtime/quality';
import { col } from './scene/color';
import { createCity } from './scene/city';
import type { City } from './scene/city';
import { resolveStyle } from './styles';
import type { QrCityController, QrCityOptions, QrCityStyle, QrCityStyleId, QrCityView } from './types';

const VIEW_SPEED = 1.6; // view-transition progress per second

/**
 * Mounts a 3D city whose rooftops form a scannable QR code inside `el`.
 *
 * Browser-only: importing this module is SSR-safe, but calling it needs a DOM and WebGL.
 * `el` must have a size (the canvas fills it and follows its resizes).
 */
export function createQrCity(el: HTMLElement, options: QrCityOptions): QrCityController {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('[qr-city] createQrCity needs a browser DOM. Call it from a client-only hook (useEffect, onMounted, ngAfterViewInit…).');
  }
  if (!(el instanceof HTMLElement)) throw new TypeError('[qr-city] The first argument must be an HTMLElement.');

  let raw: QrCityOptions = { ...options };
  let opts: ResolvedOptions = resolveOptions(raw);
  let style: QrCityStyle = resolveStyle(opts.style);
  let profile: QualityProfile = resolveQuality(opts.quality);

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;outline-offset:2px';
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: profile.antialias, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    throw new Error(`[qr-city] Could not create a WebGL context: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.shadowMap.enabled = profile.shadows;
  el.appendChild(canvas);

  const scene = new Scene();
  const ortho = new OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const reduceQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

  let city: City | null = null;
  let disposed = false;
  let playing = true;
  let contextLost = false;
  let raf = 0;
  let last = 0;
  let width = 0;
  let height = 0;
  let t = opts.view === 'qr' ? 1 : 0;
  let target = t;
  let bornAt = -1;
  let revealed = false;

  const reduced = () => (opts.animate === 'auto' ? !!reduceQuery?.matches : !opts.animate);
  const report = (e: unknown) => {
    const err = e instanceof Error ? e : new Error(String(e));
    if (opts.onError) opts.onError(err); else console.error(err);
  };
  const safe = (fn: (() => void) | undefined) => {
    try { fn?.(); } catch (e) { report(e); }
  };

  function applyBackground() {
    if (opts.background === 'transparent') {
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
    } else {
      scene.background = col(opts.background ?? style.palette.sky);
    }
  }

  function applyA11y() {
    canvas.setAttribute('aria-label', opts.label);
    canvas.setAttribute('role', opts.interactive ? 'button' : 'img');
    canvas.style.cursor = opts.interactive ? 'pointer' : '';
    if (opts.interactive) {
      canvas.tabIndex = 0;
      canvas.setAttribute('aria-pressed', String(target === 1));
    } else {
      canvas.removeAttribute('tabindex');
      canvas.removeAttribute('aria-pressed');
    }
  }

  function rebuild() {
    // Build first: if the data is invalid this throws before touching the current city.
    const next = createCity(style, createMatrix(opts.data, opts.errorCorrection), profile);
    city?.dispose();
    city = next;
    scene.add(city.root);
    renderer.shadowMap.enabled = profile.shadows;
    applyBackground();
    bornAt = -1;
    revealed = false;
  }

  function resize() {
    if (disposed) return;
    width = el.clientWidth;
    height = el.clientHeight;
    if (!width || !height) return;
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    renderer.setPixelRatio(Math.min(dpr, opts.maxPixelRatio ?? profile.pixelRatioCap));
    renderer.setSize(width, height, false);
    if (!playing) renderFrame();
  }

  function renderFrame() {
    if (!city || !width || !height || contextLost) return;
    placeOrtho(ortho, t, city.size, width / height);
    renderer.render(scene, ortho);
  }

  function frame(now: number) {
    if (disposed || !playing) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (!city || !width || !height || contextLost) return;
    const still = reduced();
    if (t !== target) {
      t = still ? target : target > t ? Math.min(1, t + dt * VIEW_SPEED) : Math.max(0, t - dt * VIEW_SPEED);
    }
    city.update({ now, dt, t, reduce: still });
    renderFrame();
    if (!revealed) {
      if (bornAt < 0) bornAt = now;
      if (still || now - bornAt >= city.riseDuration * 1000) {
        revealed = true;
        safe(opts.onReveal);
      }
    }
  }

  function startLoop() {
    if (raf || disposed) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stopLoop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function setView(view: QrCityView, o?: { immediate?: boolean }) {
    if (disposed) return;
    const next = view === 'qr' ? 1 : 0;
    if (next === target && !o?.immediate) return;
    const changed = next !== target;
    target = next;
    if (o?.immediate || reduced() || !playing) t = target;
    canvas.setAttribute('aria-pressed', String(target === 1));
    if (!playing || o?.immediate) {
      city?.update({ now: performance.now(), dt: 0, t, reduce: reduced() });
      renderFrame();
    }
    if (changed) safe(() => opts.onViewChange?.(view));
  }

  const toggleView = () => setView(target === 1 ? 'city' : 'qr');

  const onClick = () => { if (opts.interactive) toggleView(); };
  const onKey = (e: KeyboardEvent) => {
    if (!opts.interactive || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    toggleView();
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
    report(new Error('[qr-city] The WebGL context was lost.'));
  };
  const onRestored = () => { contextLost = false; };
  const onMotionChange = () => {
    if (reduced()) { t = target; }
  };
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  reduceQuery?.addEventListener?.('change', onMotionChange);

  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(resize);
    observer.observe(el);
  } else {
    addEventListener('resize', resize);
  }

  try {
    applyA11y();
    rebuild();
  } catch (e) {
    teardown();
    throw e;
  }
  resize();
  startLoop();

  function update(next: Partial<QrCityOptions>) {
    if (disposed) return;
    const merged: QrCityOptions = { ...raw, ...next };
    if (next.data !== undefined) validateData(next.data);
    const resolved = resolveOptions(merged);
    const nextStyle = resolveStyle(resolved.style);
    const nextProfile = resolveQuality(resolved.quality);
    const needsRebuild =
      resolved.data !== opts.data ||
      resolved.errorCorrection !== opts.errorCorrection ||
      nextStyle !== style ||
      nextProfile !== profile;
    const viewRequested = 'view' in next && next.view !== undefined && resolved.view !== (target === 1 ? 'qr' : 'city');

    const prev = { opts, style, profile };
    opts = resolved;
    style = nextStyle;
    profile = nextProfile;
    raw = merged;
    if (needsRebuild) {
      try {
        rebuild();
      } catch (e) {
        ({ opts, style, profile } = prev);
        throw e;
      }
    } else {
      applyBackground();
    }
    applyA11y();
    if (viewRequested) setView(resolved.view);
    resize();
  }

  async function toPNG(o?: { scale?: number }): Promise<Blob> {
    if (disposed) throw new Error('[qr-city] The controller was disposed.');
    if (!city || !width || !height) throw new Error('[qr-city] The canvas has no size yet.');
    const scale = o?.scale ?? 1;
    if (!(scale > 0)) throw new RangeError('[qr-city] `scale` must be greater than 0.');
    const pr = renderer.getPixelRatio();
    const max = renderer.capabilities.maxTextureSize;
    const effective = Math.min(pr * scale, max / Math.max(width, height));
    renderer.setPixelRatio(effective);
    renderer.setSize(width, height, false);
    renderFrame();
    // toBlob snapshots the bitmap synchronously, so we can restore the size right away.
    const blob = new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('[qr-city] Could not encode the canvas as PNG.'))), 'image/png');
    });
    renderer.setPixelRatio(pr);
    renderer.setSize(width, height, false);
    if (!playing) renderFrame();
    return blob;
  }

  function teardown() {
    if (disposed) return;
    disposed = true;
    stopLoop();
    observer?.disconnect();
    if (!observer) removeEventListener('resize', resize);
    reduceQuery?.removeEventListener?.('change', onMotionChange);
    canvas.removeEventListener('click', onClick);
    canvas.removeEventListener('keydown', onKey);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    city?.dispose();
    city = null;
    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }

  return {
    canvas,
    get view(): QrCityView {
      return target === 1 ? 'qr' : 'city';
    },
    reveal: () => setView('qr'),
    setView,
    toggleView,
    setStyle: (s: QrCityStyleId | QrCityStyle) => update({ style: s }),
    update,
    toPNG,
    play() {
      if (disposed || playing) return;
      playing = true;
      startLoop();
    },
    pause() {
      if (disposed || !playing) return;
      playing = false;
      stopLoop();
    },
    resize,
    dispose: teardown,
  };
}
