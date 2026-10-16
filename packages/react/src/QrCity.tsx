import { createQrCity } from '@qr-city/core';
import type { QrCityController, QrCityOptions, QrCityStyle, QrCityStyleId } from '@qr-city/core';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';

type Callbacks = Pick<QrCityOptions, 'onReveal' | 'onIntroStage' | 'onViewChange' | 'onZoomChange' | 'onError'>;

export interface QrCityProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onError'>,
    Omit<QrCityOptions, 'style'>,
    Callbacks {
  /** Built-in style id or a custom style object. (`style` is the CSS style of the container.) */
  cityStyle?: QrCityStyleId | QrCityStyle;
}

/** The controller as seen through a React ref: safe to call before the city is mounted (no-ops). */
export type QrCityHandle = Omit<QrCityController, 'canvas'> & { readonly canvas: HTMLCanvasElement | null };

const DEFAULT_STYLE: CSSProperties = { width: '100%', aspectRatio: '1 / 1' };

/**
 * A 3D city whose rooftops form a scannable QR code. Size it with CSS (default: a square as wide
 * as its container). Renders an empty `<div>` on the server and starts WebGL after mounting.
 *
 * Use a `ref` to drive it: `ref.current.reveal()`, `.setZoom(3)`, `.toPNG()`…
 */
export const QrCity = forwardRef<QrCityHandle, QrCityProps>(function QrCity(props, ref) {
  const {
    data, cityStyle, intro, pauseAtThreshold, view, errorCorrection, quality, interactive, animate,
    maxPixelRatio, zoomable, maxZoom, wheelZoom, background, label, doorLabel,
    onReveal, onIntroStage, onViewChange, onZoomChange, onError,
    style, className, ...rest
  } = props;

  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<QrCityController | null>(null);

  // Handlers change identity on every render; the controller always calls the latest ones.
  const callbacks = useRef<Callbacks>({});
  callbacks.current = { onReveal, onIntroStage, onViewChange, onZoomChange, onError };

  // A custom style object that is re-created on every render with the same content must not rebuild the city.
  const styleKey = typeof cityStyle === 'object' ? JSON.stringify(cityStyle) : cityStyle;
  const stableStyle = useMemo(() => cityStyle, [styleKey]);

  const options: Omit<QrCityOptions, keyof Callbacks> = {
    data, style: stableStyle, intro, pauseAtThreshold, view, errorCorrection, quality, interactive, animate,
    maxPixelRatio, zoomable, maxZoom, wheelZoom, background, label, doorLabel,
  };
  const latest = useRef(options);
  latest.current = options;

  const report = (error: unknown) => {
    const err = error instanceof Error ? error : new Error(String(error));
    if (callbacks.current.onError) callbacks.current.onError(err); else console.error(err);
  };

  // `intro` is fixed when the city is created, so changing it starts over.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    try {
      controllerRef.current = createQrCity(host, {
        ...clean(latest.current),
        onReveal: () => callbacks.current.onReveal?.(),
        onIntroStage: (s) => callbacks.current.onIntroStage?.(s),
        onViewChange: (v) => callbacks.current.onViewChange?.(v),
        onZoomChange: (z) => callbacks.current.onZoomChange?.(z),
        onError: (e) => report(e),
      } as QrCityOptions);
    } catch (error) {
      report(error);
    }
    return () => {
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, [intro]);

  // Everything else is applied in place (the city is rebuilt only when it has to be).
  const key = JSON.stringify([
    data, styleKey, errorCorrection, quality, interactive, animate,
    maxPixelRatio, zoomable, maxZoom, wheelZoom, background, label, doorLabel, pauseAtThreshold, view,
  ]);
  useEffect(() => {
    try {
      controllerRef.current?.update(clean(latest.current) as QrCityOptions);
    } catch (error) {
      report(error);
    }
  }, [key]);

  const handle = useMemo<QrCityHandle>(() => {
    const c = () => controllerRef.current;
    return {
      get canvas() { return c()?.canvas ?? null; },
      get view() { return c()?.view ?? 'city'; },
      get zoom() { return c()?.zoom ?? 1; },
      get stage() { return c()?.stage ?? 'done'; },
      openDoor: () => c()?.openDoor(),
      continueIntro: () => c()?.continueIntro(),
      skipIntro: () => c()?.skipIntro(),
      reveal: () => c()?.reveal(),
      setView: (v, o) => c()?.setView(v, o),
      toggleView: () => c()?.toggleView(),
      setZoom: (z, o) => c()?.setZoom(z, o),
      zoomBy: (f, o) => c()?.zoomBy(f, o),
      resetZoom: (o) => c()?.resetZoom(o),
      setStyle: (s) => c()?.setStyle(s),
      update: (n) => c()?.update(n),
      toPNG: (o) => (c() ? (c() as QrCityController).toPNG(o) : Promise.reject(new Error('[qr-city] The city is not mounted.'))),
      play: () => c()?.play(),
      pause: () => c()?.pause(),
      resize: () => c()?.resize(),
      dispose: () => c()?.dispose(),
    };
  }, []);
  useImperativeHandle(ref, () => handle, [handle]);

  return <div {...rest} ref={hostRef} className={className} style={{ ...DEFAULT_STYLE, ...style }} />;
});

/** Drops `undefined` values so the core applies its own defaults. */
function clean<T extends object>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out as T;
}
