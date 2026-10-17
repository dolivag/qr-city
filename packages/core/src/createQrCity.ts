import { LinearSRGBColorSpace, OrthographicCamera, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { createFlight, createFlyover, FLIGHT_END, FLYOVER_END } from './camera/flight';
import type { Flight } from './camera/flight';
import { groundPointAt, placeOrtho } from './camera/ortho';
import { resolveOptions, validateData } from './options';
import type { ResolvedOptions } from './options';
import { createFallbackController } from './fallbackController';
import { mountFlatQr } from './fallback';
import type { FlatQr } from './fallback';
import { qrToPng, qrToSvg } from './qr/image';
import { createMatrix } from './qr/matrix';
import { resolveQuality } from './runtime/quality';
import { checkStyle } from './styles/check';
import { warnIfUltraMissing } from './scene/ultraKit';
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
  warnIfUltraMissing(profile.level);
  // A custom style can break the scan-ability invariant; built-in ones cannot. Say so once, at creation.
  if (typeof opts.style === 'object') for (const w of checkStyle(style).warnings) console.warn(`[qr-city] style "${style.id}": ${w}`);
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
    const detail = err instanceof Error ? err.message : String(err);
    if (opts.fallback === 'none') throw new Error(`[qr-city] Could not create a WebGL context: ${detail}`, { cause: err });
    return createFallbackController(
      el,
      raw,
      new Error(`[qr-city] WebGL is not available (${detail}). Showing a plain QR code instead.`, { cause: err }),
    );
  }
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.shadowMap.enabled = profile.shadows;
  el.appendChild(wrapper);

  const cityScene = new Scene();
  const ortho = new OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const persp = new PerspectiveCamera(38, 1, 0.05, 200);
  const reduceQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

  // Flyover: the city is complete and the camera sweeps over it. With reduced motion it is skipped.
  const flyover = intro === 'flyover' && !(opts.animate === 'auto' ? !!reduceQuery?.matches : !opts.animate);

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
  let stage: QrCityIntroStage = intro === 'door' ? 'door' : flyover ? 'flying' : 'done';
  let enterStart = 0;
  let flightStart = -1;
  let flight: Flight | null = null;
  let buildQueued = false;
  let disposed = false;
  let flat: FlatQr | null = null;
  let lostTimer = 0;
  let playing = true;
  let contextLost = false;
  let raf = 0;
  let last = 0;
  let width = 0;
  let height = 0;
  let t = intro === 'door' || flyover || opts.view !== 'qr' ? 0 : 1;
  let target = opts.view === 'qr' ? 1 : 0;
  let bornAt = -1;
  let revealed = intro === 'door' || flyover;

  // Zoom and pan of the city view. `zoomTarget` is what was asked for; `zoom` follows it smoothly.
  let zoom = 1;
  let zoomTarget = 1;
  const pan = { x: 0, z: 0 };
  /** Ground point that must stay under a screen position while the zoom animates. */
  let anchor: { ndcX: number; ndcY: number; gx: number; gz: number } | null = null;
  let dragged = false;

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
    const active = opts.interactive && (atDoor || stage === 'done' || (flyover && stage === 'flying'));
    canvas.setAttribute('aria-label', atDoor ? opts.doorLabel : opts.label);
    canvas.setAttribute('role', active ? 'button' : 'img');
    canvas.style.cursor = active ? 'pointer' : '';
    if (active) canvas.tabIndex = 0; else canvas.removeAttribute('tabindex');
    if (active && stage === 'done') canvas.setAttribute('aria-pressed', String(target === 1)); else canvas.removeAttribute('aria-pressed');
    // Vertical swipes keep scrolling the page until the city is zoomed in; then touches drag the map.
    canvas.style.touchAction = canZoom() ? (zoomTarget > 1 ? 'none' : 'pan-y') : '';
    if (canZoom() && zoomTarget > 1) canvas.style.cursor = 'grab';
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
    zoom = zoomTarget = 1;
    pan.x = pan.z = 0;
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

  const canZoom = () => opts.zoomable && stage === 'done';
  const clampPan = () => {
    const lim = (city?.size ?? 40) * 0.5;
    pan.x = Math.max(-lim, Math.min(lim, pan.x));
    pan.z = Math.max(-lim, Math.min(lim, pan.z));
  };
  const ndcOf = (clientX: number, clientY: number) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / Math.max(1, r.width)) * 2 - 1, y: 1 - ((clientY - r.top) / Math.max(1, r.height)) * 2 };
  };
  const placeView = () => city && placeOrtho(ortho, t, city.size, width / height, zoom, pan.x, pan.z);

  function setZoom(next: number, o?: { immediate?: boolean; at?: { x: number; y: number } }) {
    if (disposed) return;
    const z = Math.max(1, Math.min(opts.maxZoom, Number.isFinite(next) ? next : 1));
    if (z === zoomTarget && !o?.immediate) return;
    const changed = z !== zoomTarget;
    zoomTarget = z;
    if (stage === 'done' && city && width && height) {
      placeView();
      const ndcX = o?.at ? o.at.x * 2 - 1 : 0;
      const ndcY = o?.at ? 1 - o.at.y * 2 : 0;
      const g = groundPointAt(ortho, ndcX, ndcY);
      anchor = z === 1 ? null : { ndcX, ndcY, gx: g.x, gz: g.z };
      if (o?.immediate || reduced() || !playing) {
        zoom = z;
        if (z === 1) { pan.x = 0; pan.z = 0; }
        applyAnchor();
        tick(performance.now(), 0, false);
      }
    }
    applyA11y();
    if (changed) safe(() => opts.onZoomChange?.(z));
  }

  /** Moves the pan so the anchored ground point returns under its screen position. */
  function applyAnchor() {
    if (!anchor || !city) return;
    placeView();
    const p = groundPointAt(ortho, anchor.ndcX, anchor.ndcY);
    pan.x += anchor.gx - p.x;
    pan.z += anchor.gz - p.z;
    clampPan();
    placeView();
  }

  function stepZoom(dt: number, still: boolean) {
    if (zoom !== zoomTarget) {
      const k = still ? 1 : 1 - Math.exp(-dt * 10);
      const lz = Math.log(zoom) + (Math.log(zoomTarget) - Math.log(zoom)) * k;
      zoom = Math.abs(Math.log(zoomTarget) - lz) < 0.003 ? zoomTarget : Math.exp(lz);
    }
    if (zoomTarget === 1 && (pan.x || pan.z)) {
      const k = still ? 1 : 1 - Math.exp(-dt * 10);
      pan.x = Math.abs(pan.x) < 0.01 ? 0 : pan.x * (1 - k);
      pan.z = Math.abs(pan.z) < 0.01 ? 0 : pan.z * (1 - k);
    }
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
    city.setViewport(height);

    if (stage === 'flying' && flight) {
      if (flightStart < 0) flightStart = now;
      const el = (now - flightStart) / 1000;
      const end = flyover ? FLYOVER_END : FLIGHT_END;
      if (!flyover) setVeil(1 - smooth(0.12, 1.22, el));
      city.update({ now, dt, t: 0, reduce: still, bob: false });
      const angle = flight.place(Math.min(el, end), persp, aspect);
      if (city.door) city.door.hinge.rotation.y = angle;
      renderer.render(cityScene, persp);
      if (advance && el >= end) endIntro();
      return;
    }

    if (advance && t !== target) {
      t = still ? target : target > t ? Math.min(1, t + dt * VIEW_SPEED) : Math.max(0, t - dt * VIEW_SPEED);
    }
    if (advance) stepZoom(dt, still);
    city.update({ now, dt, t, reduce: still });
    placeView();
    if (anchor) {
      applyAnchor();
      if (zoom === zoomTarget) anchor = null;
    }
    city.setFocus(pan.x, pan.z, zoom);
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
    // The top-down view must show the whole QR centred: undo any zoom and pan on the way up.
    // The zoom animates back to 1 while the pan eases to the centre (see `stepZoom`).
    if (next === 1 && stage === 'done' && zoomTarget > 1) setZoom(1, { immediate: o?.immediate });
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
    else if (stage === 'flying' && flyover) skipIntro();
    else if (stage === 'done') toggleView();
  };
  const onClick = () => {
    if (dragged) { dragged = false; return; }
    activate();
  };

  // Pointers on the canvas: one finger/mouse drags the map when zoomed in, two fingers pinch.
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt: { x: number; y: number } | null = null;
  const onPointerDown = (e: PointerEvent) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) { downAt = { x: e.clientX, y: e.clientY }; dragged = false; }
    if (canZoom() && (zoomTarget > 1 || pointers.size > 1)) canvas.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev || !canZoom() || !city) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pointers.size === 1) {
      if (downAt && Math.hypot(cur.x - downAt.x, cur.y - downAt.y) > 6) dragged = true;
      if (zoomTarget > 1 && dragged) {
        placeView();
        const a = ndcOf(prev.x, prev.y);
        const b = ndcOf(cur.x, cur.y);
        const g0 = groundPointAt(ortho, a.x, a.y);
        const g1 = groundPointAt(ortho, b.x, b.y);
        pan.x += g0.x - g1.x;
        pan.z += g0.z - g1.z;
        anchor = null;
        clampPan();
        if (!playing) tick(performance.now(), 0, false);
      }
    } else if (pointers.size === 2) {
      dragged = true;
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)?.[1] as { x: number; y: number };
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(cur.x - other.x, cur.y - other.y);
      const from = ndcOf((prev.x + other.x) / 2, (prev.y + other.y) / 2);
      const to = ndcOf((cur.x + other.x) / 2, (cur.y + other.y) / 2);
      if (before > 4 && after > 4) {
        placeView();
        const g = groundPointAt(ortho, from.x, from.y);
        const z = Math.max(1, Math.min(opts.maxZoom, zoom * (after / before)));
        const changed = z !== zoomTarget;
        zoom = zoomTarget = z;
        placeView();
        const p = groundPointAt(ortho, to.x, to.y);
        pan.x += g.x - p.x;
        pan.z += g.z - p.z;
        anchor = null;
        if (z === 1) { pan.x = 0; pan.z = 0; }
        clampPan();
        applyA11y();
        if (changed) safe(() => opts.onZoomChange?.(z));
        if (!playing) tick(performance.now(), 0, false);
      }
    }
    pointers.set(e.pointerId, cur);
  };
  const onPointerEnd = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  const onWheel = (e: WheelEvent) => {
    if (!canZoom() || opts.wheelZoom === 'off') return;
    if (opts.wheelZoom === 'ctrl' && !e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const speed = e.ctrlKey ? 0.005 : 0.003; // trackpad pinch arrives as small ctrl+wheel deltas
    const at = ndcOf(e.clientX, e.clientY);
    setZoom(zoomTarget * Math.exp(-e.deltaY * unit * speed), { at: { x: (at.x + 1) / 2, y: (1 - at.y) / 2 } });
  };
  const onKey = (e: KeyboardEvent) => {
    if (canZoom() && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const k = e.key;
      if (k === '+' || k === '=') { e.preventDefault(); setZoom(zoomTarget * 1.5); return; }
      if (k === '-' || k === '_') { e.preventDefault(); setZoom(zoomTarget / 1.5); return; }
      if (k === '0') { e.preventDefault(); setZoom(1); return; }
      const dir: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
      if (dir[k] && zoomTarget > 1 && city) {
        e.preventDefault();
        placeView();
        const a = groundPointAt(ortho, 0, 0);
        const b = groundPointAt(ortho, dir[k][0] * 0.25, dir[k][1] * 0.25);
        pan.x += b.x - a.x;
        pan.z += b.z - a.z;
        anchor = null;
        clampPan();
        if (!playing) tick(performance.now(), 0, false);
        return;
      }
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!opts.interactive || (stage !== 'door' && stage !== 'done')) return;
    e.preventDefault();
    activate();
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
    report(new Error('[qr-city] The WebGL context was lost.'));
    // Browsers usually give the context back within moments; if not, show a plain QR over the canvas.
    clearTimeout(lostTimer);
    lostTimer = window.setTimeout(() => {
      if (!contextLost || disposed || flat || opts.fallback === 'none') return;
      flat = mountFlatQr(wrapper, { data: opts.data, errorCorrection: opts.errorCorrection, style, label: opts.label }, true);
      const reason = new Error('[qr-city] The WebGL context was lost and did not come back. Showing a plain QR code instead.');
      safe(() => (opts.onFallback ? opts.onFallback(reason) : console.warn(reason.message)));
    }, 3000);
  };
  const onRestored = () => {
    contextLost = false;
    clearTimeout(lostTimer);
    flat?.dispose();
    flat = null;
  };
  const onMotionChange = () => {
    if (reduced() && stage === 'done') t = target;
  };
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  canvas.addEventListener('wheel', onWheel, { passive: false });
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
    else if (flyover) {
      buildCity(false);
      flight = createFlyover(ensureCity().size);
    } else buildCity(true);
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
    warnIfUltraMissing(profile.level);
    raw = merged;
    if (needsRebuild) {
      try {
        createMatrix(opts.data, opts.errorCorrection);
        if (stage === 'flying') endIntro();
        if (doorScene && styleChanged) buildDoorScene();
        zoom = zoomTarget = 1;
        pan.x = pan.z = 0;
        anchor = null;
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
    flat?.update(opts.data, opts.errorCorrection, style);
    if (!opts.zoomable || zoomTarget > opts.maxZoom) setZoom(opts.zoomable ? opts.maxZoom : 1, { immediate: true });
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
    clearTimeout(lostTimer);
    flat?.dispose();
    flat = null;
    observer?.disconnect();
    if (!observer) removeEventListener('resize', resize);
    reduceQuery?.removeEventListener?.('change', onMotionChange);
    canvas.removeEventListener('click', onClick);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerEnd);
    canvas.removeEventListener('pointercancel', onPointerEnd);
    canvas.removeEventListener('wheel', onWheel);
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
    fallback: false,
    get view(): QrCityView {
      return target === 1 ? 'qr' : 'city';
    },
    get stage(): QrCityIntroStage {
      return stage;
    },
    get zoom(): number {
      return zoomTarget;
    },
    setZoom,
    zoomBy: (factor: number, o?: { at?: { x: number; y: number } }) => setZoom(zoomTarget * factor, o),
    resetZoom: (o?: { immediate?: boolean }) => setZoom(1, o),
    openDoor,
    continueIntro,
    skipIntro,
    reveal: () => setView('qr'),
    setView,
    toggleView,
    setStyle: (s: QrCityStyleId | QrCityStyle) => update({ style: s }),
    update,
    toPNG,
    toQrSvg: (o) => qrToSvg(opts.data, { errorCorrection: opts.errorCorrection, ...o }),
    toQrPng: (o) => qrToPng(opts.data, { errorCorrection: opts.errorCorrection, ...o }),
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
