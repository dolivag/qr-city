import { LinearSRGBColorSpace, OrthographicCamera, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { createFlight, FLIGHT_END } from './camera/flight';
import type { Flight } from './camera/flight';
import { placeOrtho } from './camera/ortho';
import { resolveOptions, validateData } from './options';
import type { ResolvedOptions } from './options';
import { createMatrix } from './qr/matrix';
import { resolveQuality } from './runtime/quality';
import type { QualityProfile } from './runtime/quality';
import { col } from './scene/color';
import { createCity } from './scene/city';
import type { City } from './scene/city';
import { createDoorScene, ENTER_DURATION } from './scene/door';
import type { DoorScene } from './scene/door';
import { resolveStyle } from './styles';
import { moderna } from './styles/moderna';
import type {
  QrCityController,
  QrCityDoorTheme,
  QrCityIntroStage,
  QrCityOptions,
  QrCityStyle,
  QrCityStyleId,
  QrCityView,
} from './types';
import { smooth } from './util/math';

const VIEW_SPEED = 1.6; // view-transition progress per second

const doorTheme = (style: QrCityStyle): QrCityDoorTheme => style.door ?? (moderna.door as QrCityDoorTheme);

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
  createMatrix(opts.data, opts.errorCorrection); // fail fast if the data cannot be encoded
  const intro = opts.intro; // fixed at creation

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;outline-offset:2px';
  wrapper.appendChild(canvas);
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: profile.antialias, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    throw new Error(`[qr-city] Could not create a WebGL context: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.shadowMap.enabled = profile.shadows;
  el.appendChild(wrapper);

  const cityScene = new Scene();
  const ortho = new OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const persp = new PerspectiveCamera(38, 1, 0.05, 200);
  const reduceQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

  // Door intro: a white veil on top of the canvas hides the cuts between scenes
  let doorScene: DoorScene | null = null;
  let veil: HTMLDivElement | null = null;
  let veilValue = -1;
  if (intro === 'door') {
    veil = document.createElement('div');
    veil.style.cssText = 'position:absolute;inset:0;opacity:0;pointer-events:none';
    wrapper.appendChild(veil);
  }

  let city: City | null = null;
  let stage: QrCityIntroStage = intro === 'door' ? 'door' : 'done';
  let enterStart = 0;
  let flightStart = 0;
  let flight: Flight | null = null;
  let buildQueued = false;
  let disposed = false;
  let playing = true;
  let contextLost = false;
  let raf = 0;
  let last = 0;
  let width = 0;
  let height = 0;
  let t = intro === 'door' || opts.view !== 'qr' ? 0 : 1;
  let target = opts.view === 'qr' ? 1 : 0;
  let bornAt = -1;
  let revealed = intro === 'door';

  const reduced = () => (opts.animate === 'auto' ? !!reduceQuery?.matches : !opts.animate);
  const report = (e: unknown) => {
    const err = e instanceof Error ? e : new Error(String(e));
    if (opts.onError) opts.onError(err); else console.error(err);
  };
  const safe = (fn: (() => void) | undefined) => {
    try { fn?.(); } catch (e) { report(e); }
  };

  function setVeil(v: number) {
    if (!veil || v === veilValue) return;
    veilValue = v;
    veil.style.opacity = String(v);
  }

  function applyBackground() {
    if (opts.background === 'transparent') {
      cityScene.background = null;
      renderer.setClearColor(0x000000, 0);
    } else {
      cityScene.background = col(opts.background ?? style.palette.sky);
    }
    doorScene?.setBackground(opts.background === 'transparent' ? null : (opts.background ?? doorTheme(style).background));
    if (veil) veil.style.background = doorTheme(style).veil;
  }

  function applyA11y() {
    const atDoor = stage === 'door';
    const active = opts.interactive && (atDoor || stage === 'done');
    canvas.setAttribute('aria-label', atDoor ? opts.doorLabel : opts.label);
    canvas.setAttribute('role', active ? 'button' : 'img');
    canvas.style.cursor = active ? 'pointer' : '';
    if (active) canvas.tabIndex = 0; else canvas.removeAttribute('tabindex');
    if (active && stage === 'done') canvas.setAttribute('aria-pressed', String(target === 1)); else canvas.removeAttribute('aria-pressed');
  }

  function setStage(next: QrCityIntroStage) {
    if (stage === next) return;
    stage = next;
    applyA11y();
    safe(() => opts.onIntroStage?.(next));
  }

  function buildDoorScene() {
    doorScene?.dispose();
    doorScene = createDoorScene(doorTheme(style), profile);
  }

  /** Builds the city. `rise`: buildings grow from the ground (otherwise it is complete at once). */
  function buildCity(rise: boolean) {
    // Build first: if it throws, the current city stays untouched.
    const next = createCity(style, createMatrix(opts.data, opts.errorCorrection), profile, { rise });
    city?.dispose();
    city = next;
    cityScene.add(city.root);
    renderer.shadowMap.enabled = profile.shadows;
    applyBackground();
    bornAt = -1;
    revealed = false;
  }

  function dropCity() {
    city?.dispose();
    city = null;
  }

  function ensureCity() {
    if (!city) buildCity(false);
    return city as City;
  }

  function queueCityBuild() {
    buildQueued = true;
    setTimeout(() => {
      buildQueued = false;
      if (disposed || city || stage === 'done') return;
      try { buildCity(false); } catch (e) { report(e); }
    }, 60);
  }

  function endIntro() {
    const c = ensureCity();
    if (c.door) c.door.hinge.rotation.y = 0;
    flight = null;
    doorScene?.dispose();
    doorScene = null;
    veil?.remove();
    veil = null;
    t = 0;
    setStage('done');
    bornAt = -1;
    revealed = true;
    safe(opts.onReveal);
  }

  function openDoor() {
    if (disposed || stage !== 'door') return;
    enterStart = performance.now();
    setStage('entering');
    if (reduced()) reachThreshold();
  }

  function reachThreshold() {
    setStage('threshold');
    setVeil(1);
    if (!opts.pauseAtThreshold) continueIntro();
  }

  function continueIntro() {
    if (disposed || stage !== 'threshold') return;
    const c = ensureCity();
    if (reduced()) { endIntro(); return; }
    flight = createFlight(c.door?.d ?? new Vector3(0, 0, 1), c.door?.facade ?? new Vector3(0, 0, c.size / 2), c.size);
    flightStart = performance.now();
    setStage('flying');
  }

  function skipIntro() {
    if (disposed || stage === 'done') return;
    endIntro();
  }

  function resize() {
    if (disposed) return;
    width = el.clientWidth;
    height = el.clientHeight;
    if (!width || !height) return;
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    renderer.setPixelRatio(Math.min(dpr, opts.maxPixelRatio ?? profile.pixelRatioCap));
    renderer.setSize(width, height, false);
    if (!playing) tick(performance.now(), 0, false);
  }

  /** Updates and draws the current stage. `advance` is false for redraws that must not move time forward. */
  function tick(now: number, dt: number, advance: boolean) {
    if (!width || !height || contextLost) return;
    const still = reduced();
    const aspect = width / height;

    if (stage === 'door' || stage === 'entering' || stage === 'threshold') {
      if (!doorScene) return;
      const entering = stage === 'entering' ? (now - enterStart) / 1000 : stage === 'threshold' ? ENTER_DURATION + 1 : null;
      const r = doorScene.update(now, aspect, entering, still, persp);
      setVeil(stage === 'threshold' ? 1 : r.veil);
      renderer.render(doorScene.scene, persp);
      if (advance) {
        if (stage === 'entering' && r.done) reachThreshold();
        else if (stage === 'door' && !city && !buildQueued) queueCityBuild();
      }
      return;
    }

    if (!city) return;

    if (stage === 'flying' && flight) {
      const el = (now - flightStart) / 1000;
      setVeil(1 - smooth(0.12, 1.22, el));
      city.update({ now, dt, t: 0, reduce: still, bob: false });
      const angle = flight.place(Math.min(el, FLIGHT_END), persp, aspect);
      if (city.door) city.door.hinge.rotation.y = angle;
      renderer.render(cityScene, persp);
      if (advance && el >= FLIGHT_END) endIntro();
      return;
    }

    if (advance && t !== target) {
      t = still ? target : target > t ? Math.min(1, t + dt * VIEW_SPEED) : Math.max(0, t - dt * VIEW_SPEED);
    }
    city.update({ now, dt, t, reduce: still });
    placeOrtho(ortho, t, city.size, aspect);
    renderer.render(cityScene, ortho);
    if (advance && !revealed) {
      if (bornAt < 0) bornAt = now;
      if (still || now - bornAt >= city.riseDuration * 1000) {
        revealed = true;
        safe(opts.onReveal);
      }
    }
  }

  function frame(now: number) {
    if (disposed || !playing) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    tick(now, dt, true);
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
    if (stage === 'done') {
      if (o?.immediate || reduced() || !playing) t = target;
      if (stage === 'done') canvas.setAttribute('aria-pressed', String(target === 1));
      if (!playing || o?.immediate) tick(performance.now(), 0, false);
    }
    if (changed) safe(() => opts.onViewChange?.(view));
  }

  const toggleView = () => setView(target === 1 ? 'city' : 'qr');

  const activate = () => {
    if (!opts.interactive) return;
    if (stage === 'door') openDoor();
    else if (stage === 'done') toggleView();
  };
  const onClick = () => activate();
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!opts.interactive || (stage !== 'door' && stage !== 'done')) return;
    e.preventDefault();
    activate();
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
    report(new Error('[qr-city] The WebGL context was lost.'));
  };
  const onRestored = () => { contextLost = false; };
  const onMotionChange = () => {
    if (reduced() && stage === 'done') t = target;
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
    if (intro === 'door') buildDoorScene();
    else buildCity(true);
    applyBackground();
    applyA11y();
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
    if (resolved.intro !== intro) throw new RangeError('[qr-city] `intro` is fixed at creation and cannot be changed with update().');
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
    const styleChanged = nextStyle !== style || nextProfile !== profile;
    style = nextStyle;
    profile = nextProfile;
    raw = merged;
    if (needsRebuild) {
      try {
        createMatrix(opts.data, opts.errorCorrection);
        if (stage === 'flying') endIntro();
        if (doorScene && styleChanged) buildDoorScene();
        if (stage === 'done') buildCity(true);
        else dropCity(); // built again when the door opens
        applyBackground();
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
    if (!width || !height) throw new Error('[qr-city] The canvas has no size yet.');
    const scale = o?.scale ?? 1;
    if (!(scale > 0)) throw new RangeError('[qr-city] `scale` must be greater than 0.');
    const pr = renderer.getPixelRatio();
    const max = renderer.capabilities.maxTextureSize;
    const effective = Math.min(pr * scale, max / Math.max(width, height));
    renderer.setPixelRatio(effective);
    renderer.setSize(width, height, false);
    tick(performance.now(), 0, false);
    // toBlob snapshots the bitmap synchronously, so we can restore the size right away.
    const blob = new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('[qr-city] Could not encode the canvas as PNG.'))), 'image/png');
    });
    renderer.setPixelRatio(pr);
    renderer.setSize(width, height, false);
    if (!playing) tick(performance.now(), 0, false);
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
    doorScene?.dispose();
    doorScene = null;
    cityScene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
    wrapper.remove();
  }

  return {
    canvas,
    get view(): QrCityView {
      return target === 1 ? 'qr' : 'city';
    },
    get stage(): QrCityIntroStage {
      return stage;
    },
    openDoor,
    continueIntro,
    skipIntro,
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
