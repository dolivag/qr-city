<p align="center"><img src="https://raw.githubusercontent.com/dolivag/qr-city/master/assets/logo/logo-mark.svg" alt="qr-city" width="120"></p>

# @qr-city/vue

Vue 3 component for **qr-city**: a 3D city whose rooftops form a scannable QR code. Vue ≥ 3.3, `three` as a *peerDependency*.

```bash
npm i @qr-city/vue three
```

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { QrCity } from '@qr-city/vue';

const city = ref<InstanceType<typeof QrCity> | null>(null);
</script>

<template>
  <QrCity ref="city" data="https://your-site.dev" city-style="nevada" style="width: 480px" @reveal="console.log('city ready')" />
  <button @click="city?.reveal()">Reveal QR</button>
</template>
```

## Props and events

The same options as [`createQrCity`](../core): `data`, `city-style`, `intro`, `pause-at-threshold`, `view`, `error-correction`, `quality`, `interactive`, `animate`, `max-pixel-ratio`, `zoomable`, `max-zoom`, `wheel-zoom`, `fallback`, `background`, `label`, `door-label`, `time` and `plaza`. **`city-style`** is the city's style (`'moderna' | 'costera' | 'ciberpunk' | 'nevada'` or a `QrCityStyle` object), because `style` is the container's CSS style.

| Event | Payload |
| --- | --- |
| `reveal` | — |
| `intro-stage` | `'door' \| 'entering' \| 'threshold' \| 'flying' \| 'done'` |
| `view-change` | `'city' \| 'qr'` |
| `zoom-change` | `number` |
| `fallback` | `Error`: no WebGL, a flat scannable QR is shown |
| `error` | `Error` |

`class` and `style` fall through to the container, which by default is a square as wide as its parent.

## Behaviour

- **Server (SSR, Nuxt…):** renders an empty `<div>` and starts WebGL in `onMounted`. In Nuxt, use `<ClientOnly>` to avoid the empty placeholder.
- **Prop changes:** applied in place; the city only rebuilds when `data`, `city-style`, `error-correction`, `quality` or `plaza` change.
- **`intro`** is fixed at creation: if it changes, the component restarts.
- **Absent booleans** are not `false`: they are not passed to the core, which applies its own defaults.
- **Without WebGL** a flat, scannable QR is shown and `fallback` is emitted (`fallback="none"` to get an `error` instead). **Other errors** (invalid data…) reach the `error` event; the component never throws on mount.
- **Printable QR:** `toQrSvg()` / `toQrPng()` on the ref, or `qrToSvg(data)` / `qrToPng(data)` (exported).
- **Component ref:** `controller`, `reveal()`, `setView()`, `toggleView()`, `setZoom()`, `zoomBy()`, `resetZoom()`, `openDoor()`, `continueIntro()`, `skipIntro()`, `toPNG()`, `play()`, `pause()`, `view`, `zoom`, `stage`.

## License

MIT. "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
