# @qr-city/vue

Componente de Vue 3 para **qr-city**: una ciudad 3D cuyos tejados forman un QR escaneable. Vue ≥ 3.3, `three` como *peerDependency*.

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
  <QrCity ref="city" data="https://tu-web.dev" city-style="nevada" style="width: 480px" @reveal="console.log('ciudad lista')" />
  <button @click="city?.reveal()">Revelar QR</button>
</template>
```

## Props y eventos

Las mismas opciones que [`createQrCity`](../core): `data`, `city-style`, `intro`, `pause-at-threshold`, `view`, `error-correction`, `quality`, `interactive`, `animate`, `max-pixel-ratio`, `zoomable`, `max-zoom`, `wheel-zoom`, `background`, `label` y `door-label`. **`city-style`** es el estilo de la ciudad (`'moderna' | 'costera' | 'ciberpunk' | 'nevada'` o un objeto `QrCityStyle`), porque `style` es el estilo CSS del contenedor.

| Evento | Carga |
| --- | --- |
| `reveal` | — |
| `intro-stage` | `'door' \| 'entering' \| 'threshold' \| 'flying' \| 'done'` |
| `view-change` | `'city' \| 'qr'` |
| `zoom-change` | `number` |
| `error` | `Error` |

`class` y `style` caen al contenedor, que por defecto es un cuadrado del ancho de su padre.

## Cómo se comporta

- **Servidor (SSR, Nuxt…):** renderiza un `<div>` vacío y arranca WebGL en `onMounted`. En Nuxt, usa `<ClientOnly>` si quieres evitar el marcador vacío.
- **Cambios de props:** se aplican en el sitio; la ciudad solo se reconstruye cuando cambian `data`, `city-style`, `error-correction` o `quality`.
- **`intro`** se fija al crear: si cambia, el componente se reinicia.
- **Los booleanos ausentes** no valen `false`: no se pasan al núcleo, que aplica sus valores por defecto.
- **Errores** (sin WebGL, datos inválidos…) llegan al evento `error`; el componente nunca lanza al montarse.
- **Referencia del componente:** `controller`, `reveal()`, `setView()`, `toggleView()`, `setZoom()`, `zoomBy()`, `resetZoom()`, `openDoor()`, `continueIntro()`, `skipIntro()`, `toPNG()`, `play()`, `pause()`, `view`, `zoom`, `stage`.
