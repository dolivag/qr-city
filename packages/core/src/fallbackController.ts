import { mountFlatQr } from './fallback';
import { resolveOptions } from './options';
import type { ResolvedOptions } from './options';
import { qrToPng, qrToSvg } from './qr/image';
import { resolveStyle } from './styles';
import type { QrCityController, QrCityOptions, QrCityStyle, QrCityView } from './types';

/**
 * The controller returned when WebGL is not available: a plain, scannable QR is shown instead of the
 * city and every 3D-only method is a harmless no-op. `toQrSvg`, `toQrPng` and `update` keep working.
 */
export function createFallbackController(el: HTMLElement, raw: QrCityOptions, reason: Error): QrCityController {
  let current: QrCityOptions = { ...raw };
  let opts: ResolvedOptions = resolveOptions(current);
  let style: QrCityStyle = resolveStyle(opts.style);
  let view: QrCityView = opts.view;
  let disposed = false;

  const flat = mountFlatQr(el, { data: opts.data, errorCorrection: opts.errorCorrection, style, label: opts.label });

  const safe = (fn: () => void) => {
    try { fn(); } catch (e) { if (opts.onError) opts.onError(e instanceof Error ? e : new Error(String(e))); else console.error(e); }
  };

  // Tell the host once, after it has the controller in its hands.
  queueMicrotask(() => {
    if (disposed) return;
    safe(() => (opts.onFallback ? opts.onFallback(reason) : console.warn(reason.message)));
    safe(() => opts.onIntroStage?.('done'));
    safe(() => opts.onReveal?.());
  });

  function setView(next: QrCityView) {
    if (disposed || next === view) return;
    view = next;
    safe(() => opts.onViewChange?.(next));
  }

  function update(next: Partial<QrCityOptions>) {
    if (disposed) return;
    const merged: QrCityOptions = { ...current, ...next };
    const resolved = resolveOptions(merged);
    if (resolved.intro !== opts.intro) throw new RangeError('[qr-city] `intro` is fixed at creation and cannot be changed with update().');
    const nextStyle = resolveStyle(resolved.style);
    qrToSvg(resolved.data, { errorCorrection: resolved.errorCorrection }); // fail before changing anything
    current = merged;
    opts = resolved;
    style = nextStyle;
    flat.update(opts.data, opts.errorCorrection, style);
  }

  return {
    canvas: null,
    fallback: true,
    get view() { return view; },
    zoom: 1,
    stage: 'done',
    openDoor() {},
    continueIntro() {},
    skipIntro() {},
    reveal: () => setView('qr'),
    setView: (v) => setView(v),
    toggleView: () => setView(view === 'qr' ? 'city' : 'qr'),
    setZoom() {},
    zoomBy() {},
    resetZoom() {},
    setStyle: (s) => update({ style: s }),
    update,
    toPNG: (o) => qrToPng(opts.data, { errorCorrection: opts.errorCorrection, size: Math.round(512 * (o?.scale ?? 1)) }),
    toQrSvg: (o) => qrToSvg(opts.data, { errorCorrection: opts.errorCorrection, ...o }),
    toQrPng: (o) => qrToPng(opts.data, { errorCorrection: opts.errorCorrection, ...o }),
    play() {},
    pause() {},
    resize() {},
    dispose() {
      if (disposed) return;
      disposed = true;
      flat.dispose();
    },
  };
}
