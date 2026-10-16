# qr-city

[![CI](https://github.com/dolivag/qr-city/actions/workflows/ci.yml/badge.svg)](https://github.com/dolivag/qr-city/actions/workflows/ci.yml)

Una ciudad 3D isométrica cuyos **tejados forman un código QR escaneable**. Cada módulo oscuro del QR es un edificio; los claros son calles y suelo. Al pasar a la vista cenital, el QR se lee.

> Estado: núcleo (`@qr-city/core`), Web Component (`@qr-city/element`), wrappers de React, Vue y Angular, y demo con la intro de la puerta (`intro: 'door'`). Cuatro estilos de ciudad (*Moderna*, *Costera*, *Ciberpunk*, *Nevada*) y zoom.

## Paquetes

| Paquete | Qué es |
| --- | --- |
| [`@qr-city/core`](packages/core) | Núcleo agnóstico de framework: `createQrCity(el, options)`. `three` es *peerDependency*. |
| [`@qr-city/element`](packages/element) | Web Component `<qr-city>` para cualquier framework. |
| [`@qr-city/react`](packages/react) | Componente `<QrCity>` para React ≥ 18 (compatible con SSR/Next.js). |
| [`@qr-city/vue`](packages/vue) | Componente `<QrCity>` para Vue ≥ 3.3. |
| [`@qr-city/angular`](packages/angular) | Componente standalone `<qr-city-view>` para Angular ≥ 21 (zoneless y SSR). |
| [`apps/demo`](apps/demo) | App de demo (Vite). |

## Elige tu paquete

| Framework | Instalación | Uso |
| --- | --- | --- |
| Cualquiera / HTML | `npm i @qr-city/element three` | `<qr-city data="…">` |
| React | `npm i @qr-city/react three` | `<QrCity data="…" />` |
| Vue | `npm i @qr-city/vue three` | `<QrCity data="…" />` |
| Angular | `npm i @qr-city/angular three` | `<qr-city-view data="…" />` |
| Sin framework | `npm i @qr-city/core three` | `createQrCity(el, { data })` |

## Uso rápido

```bash
npm i @qr-city/element three
```

```html
<script type="module">import '@qr-city/element/define';</script>
<qr-city data="https://tu-web.dev" style="width: 480px; height: 480px"></qr-city>
```

```ts
import { createQrCity } from '@qr-city/core';

const city = createQrCity(document.querySelector('#host')!, { data: 'https://tu-web.dev' });
city.reveal();            // vista cenital: el QR se puede escanear
city.toPNG().then(save);  // exporta un PNG
city.dispose();           // libera GPU, listeners y bucle
```

## Desarrollo

```bash
npm install
npm run demo        # demo en http://localhost:5173
npm run lint && npm run typecheck && npm test && npm run build
```

Monorepo [Nx](https://nx.dev) + npm workspaces + TypeScript. Tests con Vitest. La CI (GitHub Actions) ejecuta `lint`, `typecheck`, `test` y `build` en cada PR y en cada push a `master`; los mismos comandos funcionan en local.

## Notas de diseño

- **SSR-safe:** importar los paquetes no toca `window`/`document`; solo `createQrCity` y el Web Component necesitan DOM + WebGL.
- **Invariante de escaneabilidad:** tejados con `MeshBasicMaterial` oscuro y plano (sin iluminación) sobre suelo claro, con *quiet zone* de 5–6 módulos.
- **Color:** se renderiza en espacio lineal sin conversión sRGB y las luces se escalan ×π, para conservar el aspecto del prototipo original (three r128) con three ≥ r155.
- **Accesibilidad:** el lienzo es un botón (teclado: Enter/Espacio) con `aria-label`; respeta `prefers-reduced-motion`.

## Licencia

MIT
