# qr-city

[![CI](https://github.com/dolivag/qr-city/actions/workflows/ci.yml/badge.svg)](https://github.com/dolivag/qr-city/actions/workflows/ci.yml)

**English** · [Español](README.es.md)

An isometric 3D city whose **rooftops form a scannable QR code**. Every dark QR module is a building; light modules are streets and ground. Switch to the top-down view and the code reads.

> Status: core (`@qr-city/core`), Web Component (`@qr-city/element`), React, Vue and Angular wrappers, and a demo with the door intro (`intro: 'door'`). Four city styles (*Moderna*, *Costera*, *Ciberpunk*, *Nevada*) and zoom.

## Packages

| Package | What it is |
| --- | --- |
| [`@qr-city/core`](packages/core) | Framework-agnostic core: `createQrCity(el, options)`. `three` is a peer dependency. |
| [`@qr-city/element`](packages/element) | `<qr-city>` Web Component for any framework. |
| [`@qr-city/react`](packages/react) | `<QrCity>` component for React ≥ 18 (SSR / Next.js friendly). |
| [`@qr-city/vue`](packages/vue) | `<QrCity>` component for Vue ≥ 3.3. |
| [`@qr-city/angular`](packages/angular) | Standalone `<qr-city-view>` component for Angular ≥ 21 (zoneless and SSR). |
| [`apps/demo`](apps/demo) | Demo app (Vite). |

## Pick your package

| Framework | Install | Usage |
| --- | --- | --- |
| Any / plain HTML | `npm i @qr-city/element three` | `<qr-city data="…">` |
| React | `npm i @qr-city/react three` | `<QrCity data="…" />` |
| Vue | `npm i @qr-city/vue three` | `<QrCity data="…" />` |
| Angular | `npm i @qr-city/angular three` | `<qr-city-view data="…" />` |
| No framework | `npm i @qr-city/core three` | `createQrCity(el, { data })` |

## Quick start

```bash
npm i @qr-city/element three
```

```html
<script type="module">import '@qr-city/element/define';</script>
<qr-city data="https://your-site.dev" style="width: 480px; height: 480px"></qr-city>
```

```ts
import { createQrCity } from '@qr-city/core';

const city = createQrCity(document.querySelector('#host')!, { data: 'https://your-site.dev' });
city.reveal();            // top-down view: the QR can be scanned
city.toPNG().then(save);  // export a PNG
city.dispose();           // release GPU, listeners and the render loop
```

## Development

```bash
npm install
npm run demo        # demo at http://localhost:5173
npm run lint && npm run typecheck && npm test && npm run build
```

[Nx](https://nx.dev) monorepo + npm workspaces + TypeScript, tested with Vitest. CI (GitHub Actions) runs `lint`, `typecheck`, `test` and `build` on every PR and every push to `master`; the same commands work locally.

### Releasing

Versions are managed with [Changesets](https://github.com/changesets/changesets). A PR that changes a package adds a note with `npm run changeset`; merging it makes the Release workflow open a "Versionar paquetes" PR, and merging that one publishes to npm (with provenance) whatever is not published yet. `npm run size` checks the gzipped bundle sizes against `.size-limit.json` (CI runs it too). All `@qr-city/*` packages share one version.

### Scan-ability test

The point of the library is that the QR reads. [`e2e/`](e2e) renders the top-down view in Chromium (software WebGL), decodes it with [jsQR](https://github.com/cozmo/jsQR) and checks it returns the original text, for every style and several payloads (short URL, long URL, UTF-8), both at full resolution and downscaled the way a camera would see it. One test also checks that a style with light rooftops does **not** scan, to make sure the test can fail.

```bash
npx playwright install chromium   # once
npx nx run e2e:e2e
```

If Chromium is already installed, point to it with `PW_CHROMIUM_PATH=/path/to/chromium`. A failure uploads the Playwright report as a CI artifact.

It is the slowest job (~5 min), so it has its own workflow, [`escaneo.yml`](.github/workflows/escaneo.yml): it only runs on PRs that touch `packages/core/src`, `e2e/` or the lockfile, never when merging to `master`, and can be started by hand from the Actions tab.

## Design notes

- **SSR-safe:** importing the packages never touches `window`/`document`; only `createQrCity` and the Web Component need DOM + WebGL.
- **Scan-ability invariant:** roofs use a dark, flat `MeshBasicMaterial` (unlit) on a light ground, with a 5–6 module quiet zone. In the top-down view buildings grow to fill their module (and slightly beyond) so no gaps between neighbouring roofs confuse readers.
- **Colour:** rendered in linear space with no sRGB conversion and lights scaled ×π, to keep the look of the original prototype (three r128) on three ≥ r155.
- **Accessibility:** the canvas is a button (keyboard: Enter/Space) with an `aria-label`; `prefers-reduced-motion` is respected.
- **No WebGL?** `createQrCity` falls back to a flat, scannable QR in the style's colours instead of throwing.

## License and credits

MIT.

"QR Code" is a registered trademark of DENSO WAVE INCORPORATED. This library generates codes conforming to ISO/IEC 18004 and is not affiliated with or endorsed by DENSO WAVE.

Runtime dependencies: [three](https://threejs.org) (MIT, peer) and [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT). The demo bundles Young Serif, Hanken Grotesk and IBM Plex Mono (SIL OFL 1.1) through Fontsource.
