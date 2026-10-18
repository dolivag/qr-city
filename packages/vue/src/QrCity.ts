import { createQrCity, qrPlaceholder } from '@qr-city/core';
import type {
  QrCityController,
  QrCityEcc,
  QrCityIntro,
  QrCityOptions,
  QrCityPlaza,
  QrCityQuality,
  QrCityStyle,
  QrCityStyleId,
  QrCityTime,
  QrCityView,
} from '@qr-city/core';
import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { PropType } from 'vue';

/** Same as `QrCityOptions` minus the callbacks (they are emitted as events) and with `cityStyle` for `style`. */
type Wheel = NonNullable<QrCityOptions['wheelZoom']>;

/**
 * `<QrCity data="https://…" />`: a 3D city whose rooftops form a scannable QR code.
 *
 * Props mirror the core options (`style` is `cityStyle` because `style` is the CSS style of the root).
 * Events: `reveal`, `intro-stage`, `view-change`, `zoom-change`, `error`.
 * Template ref: `controller`, `reveal()`, `setZoom()`, `toPNG()`…
 */
export const QrCity = defineComponent({
  name: 'QrCity',
  props: {
    data: { type: String, required: true },
    cityStyle: { type: [String, Object] as PropType<QrCityStyleId | QrCityStyle>, default: undefined },
    intro: { type: String as PropType<QrCityIntro>, default: undefined },
    pauseAtThreshold: { type: Boolean, default: undefined },
    view: { type: String as PropType<QrCityView>, default: undefined },
    errorCorrection: { type: String as PropType<QrCityEcc>, default: undefined },
    quality: { type: String as PropType<QrCityQuality>, default: undefined },
    interactive: { type: Boolean, default: undefined },
    animate: { type: [Boolean, String] as PropType<boolean | 'auto'>, default: undefined },
    maxPixelRatio: { type: Number, default: undefined },
    zoomable: { type: Boolean, default: undefined },
    maxZoom: { type: Number, default: undefined },
    wheelZoom: { type: String as PropType<Wheel>, default: undefined },
    fallback: { type: String as PropType<'qr' | 'none'>, default: undefined },
    background: { type: String, default: undefined },
    label: { type: String, default: undefined },
    doorLabel: { type: String, default: undefined },
    time: { type: String as PropType<QrCityTime>, default: undefined },
    /** A plaza with your picture in the middle of the city: `true` or `{ image, size }`. */
    plaza: { type: [Boolean, Object] as PropType<boolean | QrCityPlaza>, default: undefined },
  },
  emits: ['reveal', 'intro-stage', 'view-change', 'zoom-change', 'fallback', 'error'],
  setup(props, { emit, expose }) {
    const host = ref<HTMLElement | null>(null);
    // The flat QR shown until the 3D city has taken over (it is also what the server renders)
    const placeholderShown = ref(true);
    let controller: QrCityController | null = null;

    /** Core options from the props, dropping `undefined` so the core applies its own defaults. */
    const options = (): Omit<QrCityOptions, 'onReveal' | 'onIntroStage' | 'onViewChange' | 'onZoomChange' | 'onError'> => {
      const { cityStyle, ...rest } = props;
      const all: Record<string, unknown> = { ...rest, style: cityStyle };
      for (const k of Object.keys(all)) if (all[k] === undefined) delete all[k];
      return all as unknown as QrCityOptions;
    };
    const report = (error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      emit('error', err);
    };

    function create() {
      if (!host.value) return;
      try {
        controller = createQrCity(host.value, {
          ...options(),
          onReveal: () => emit('reveal'),
          onIntroStage: (s) => emit('intro-stage', s),
          onViewChange: (v) => emit('view-change', v),
          onZoomChange: (z) => emit('zoom-change', z),
          onFallback: (r) => emit('fallback', r),
          onError: report,
        });
      } catch (error) {
        report(error);
      }
    }
    function destroy() {
      controller?.dispose();
      controller = null;
    }

    onMounted(() => {
      create();
      // The 3D canvas is opaque and already covers the placeholder; this only removes it from the page, once it has painted
      requestAnimationFrame(() => requestAnimationFrame(() => { placeholderShown.value = false; }));
    });
    onBeforeUnmount(destroy);

    // `intro` is fixed when the city is created, so changing it starts over.
    watch(() => props.intro, () => { destroy(); create(); });

    // Everything else is applied in place; the city is rebuilt only when it has to be.
    watch(
      () => [
        props.data, props.cityStyle, props.errorCorrection, props.quality, props.interactive, props.animate,
        props.maxPixelRatio, props.zoomable, props.maxZoom, props.wheelZoom, props.fallback, props.background, props.label,
        props.doorLabel, props.pauseAtThreshold, props.view, JSON.stringify(props.plaza), props.time,
      ],
      () => {
        try { controller?.update(options() as QrCityOptions); } catch (error) { report(error); }
      },
    );

    const c = () => controller;
    expose({
      get controller() { return controller; },
      get fallback() { return c()?.fallback ?? false; },
      get view() { return c()?.view ?? 'city'; },
      get zoom() { return c()?.zoom ?? 1; },
      get stage() { return c()?.stage ?? 'done'; },
      openDoor: () => c()?.openDoor(),
      continueIntro: () => c()?.continueIntro(),
      skipIntro: () => c()?.skipIntro(),
      reveal: () => c()?.reveal(),
      setView: (v: QrCityView, o?: { immediate?: boolean }) => c()?.setView(v, o),
      toggleView: () => c()?.toggleView(),
      setZoom: (z: number, o?: { immediate?: boolean; at?: { x: number; y: number } }) => c()?.setZoom(z, o),
      zoomBy: (f: number, o?: { at?: { x: number; y: number } }) => c()?.zoomBy(f, o),
      resetZoom: (o?: { immediate?: boolean }) => c()?.resetZoom(o),
      toPNG: (o?: { scale?: number }) => (c() ? (c() as QrCityController).toPNG(o) : Promise.reject(new Error('[qr-city] The city is not mounted.'))),
      toQrSvg: (o?: Parameters<QrCityController['toQrSvg']>[0]) => {
        if (!controller) throw new Error('[qr-city] The city is not mounted.');
        return controller.toQrSvg(o);
      },
      toQrPng: (o?: Parameters<QrCityController['toQrPng']>[0]) => (controller ? controller.toQrPng(o) : Promise.reject(new Error('[qr-city] The city is not mounted.'))),
      play: () => c()?.play(),
      pause: () => c()?.pause(),
    });

    const placeholder = () => {
      try {
        return qrPlaceholder({ data: props.data, style: props.cityStyle, time: props.time, errorCorrection: props.errorCorrection, plaza: props.plaza, title: props.label });
      } catch {
        return ''; // invalid data: the controller reports it
      }
    };

    return () => {
      const svg = placeholderShown.value ? placeholder() : '';
      return h(
        'div',
        { ref: host, style: { width: '100%', aspectRatio: '1 / 1', position: 'relative' } },
        svg ? [h('div', { 'aria-hidden': 'true', style: { position: 'absolute', inset: '0' }, innerHTML: svg })] : [],
      );
    };
  },
});

export type QrCityInstance = InstanceType<typeof QrCity>;
