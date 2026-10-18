<p align="center"><img src="https://raw.githubusercontent.com/dolivag/qr-city/master/assets/logo/logo-mark.svg" alt="qr-city" width="120"></p>

# @qr-city/core

Core of **qr-city**: an isometric 3D city whose rooftops form a scannable QR code. No framework dependencies; `three` is a *peerDependency* (`>=0.160 <1`).

```bash
npm i @qr-city/core three
```

```ts
import { createQrCity } from '@qr-city/core';

const city = createQrCity(hostElement, {
  data: 'https://your-site.dev',
  onReveal: () => console.log('city built'),
});
```

`hostElement` must have a size (the canvas fills it and follows changes via `ResizeObserver`). Call `createQrCity` on the client only (`useEffect`, `onMounted`, `ngAfterViewInit`…); importing the package on the server is safe.

## Options (`QrCityOptions`)

| Option | Default | |
| --- | --- | --- |
| `data` | — | Text or URL, 1–300 characters. |
| `style` | `'moderna'` | `'moderna'`, `'costera'`, `'ciberpunk'`, `'nevada'` or a `QrCityStyle` object. |
| `intro` | `'none'` | `'door'`: door → you step in → fly out over the city. `'flyover'`: the camera sweeps over the finished city and settles into the isometric view (stages `flying` → `done`; a click or `skipIntro()` skips it). Both are skipped with `prefers-reduced-motion`. Fixed at creation. |
| `pauseAtThreshold` | `false` | With `intro: 'door'`: stops on the white screen after crossing the door until you call `continueIntro()` (a good place for a form). |
| `view` | `'city'` | Initial view: `'city'` (isometric) or `'qr'` (top-down). |
| `errorCorrection` | `'M'` | `'L' \| 'M' \| 'Q' \| 'H'`. Always `'H'` with `plaza`. |
| `time` | `'day'` | `'night'` turns any style into its night version: starry sky with a moon, moonlight, windows lit from inside. The QR scans the same: roofs and ground keep their colours (the ground only looks dim from the side and lights up in the top-down view). |
| `plaza` | off | `true` or `{ image?, size? }`: a plaza in the middle of the city with your picture (a URL or data URL; other origins need CORS) painted on it, seen only in the top-down view. `size` is the fraction of the code's side, 0.1–0.25 (default 0.2). The code still scans: error correction is forced to `'H'` and the picture is reduced to light and dark tones (hues kept). A light picture (a white logo) would vanish on the light paving, so by default (`invert: 'auto'`) one whose visible part is mostly light is turned into its negative; `invert: true` always does and `false` never. Without `image`, a compass rose in the style's colours. |
| `quality` | `'auto'` | `'low'` disables shadows, lowers the pixel ratio, simplifies trees and cars and reduces their number. `'high'` adds fuller trees and rims/mirrors on cars. `'ultra'` adds denser traffic, 4K shadows and, if you `import '@qr-city/core/ultra'`, extra modelled parts (see below). `auto` picks `low` on small touch devices and `high` elsewhere, then watches the frame rate: if the device stays under ~30 fps it lowers the pixel ratio and, if that is not enough, switches to `low` (it never steps back up). Antialiasing is fixed at creation. |
| `interactive` | `true` | Click / Enter / Space toggles the view. |
| `zoomable` / `maxZoom` / `wheelZoom` | `true` / `8` / `'ctrl'` | Zoom and pan: pinch, drag, `+` `−` `0` and arrow keys while the canvas is focused. `wheelZoom`: `'ctrl'` (Ctrl/⌘ + wheel and trackpad pinch; the plain wheel still scrolls the page), `'always'` or `'off'`. |
| `animate` | `'auto'` | `'auto'` respects `prefers-reduced-motion`. |
| `maxPixelRatio` | 2 (1 on `low`) | |
| `background` | the style's sky | CSS colour or `'transparent'`. |
| `fallback` | `'qr'` | What to do without WebGL: `'qr'` shows a flat, scannable QR in the style's colours; `'none'` throws. |
| `label` / `doorLabel` | `'QR code city'` / `'Open the door'` | Accessible name of the canvas (and while the door waits). |
| `destinationLabel` | `'Destination:'` | Words that introduce where the code leads. The canvas is described by `<destinationLabel> <data>`; when `data` is a web address (`http(s)://…`), a real link to it follows the canvas in the tab order and shows while it has the focus. Anything else is only described, never linked. |
| `onReveal` / `onIntroStage` / `onViewChange` / `onZoomChange` / `onFallback` / `onError` | — | `onReveal` fires when the city is on screen: when it finishes building or, with `intro: 'door'`, when the flight ends (and after every rebuild). `onIntroStage` receives each stage. |

## Controller (`QrCityController`)

`fallback` · `toQrSvg(opts?)` · `toQrPng(opts?)` · `zoom` · `setZoom(z, { immediate?, at? })` · `zoomBy(f)` · `resetZoom()` · `stage` · `openDoor()` · `continueIntro()` · `skipIntro()` · `reveal()` · `setView(view, { immediate? })` · `toggleView()` · `setStyle(style)` · `update(partial)` · `toPNG({ scale? })` · `play()` / `pause()` · `resize()` · `dispose()` · `canvas` · `view`.

`update` only rebuilds the city when `data`, `style`, `errorCorrection`, `quality` or `plaza` change. Zooming stays sharp: the ground texture is painted at high resolution and the sun's shadow follows what is visible. `update` with a different `data`/`style` resets the zoom.

`dispose()` is idempotent and frees geometries, textures, materials, listeners, the loop and the WebGL context.

## Flat QR for printing, and the no-WebGL fallback

The city is the attraction, but sometimes what you need is the code itself:

```ts
import { qrToSvg, qrToPng } from '@qr-city/core';

const svg = qrToSvg('https://your-site.dev');                      // SVG string: black on white, 4-module quiet zone
const png = await qrToPng('https://your-site.dev', { size: 1024 }); // PNG Blob (browser only)

city.toQrSvg({ dark: '#111', margin: 4 });                          // the city's current code
```

`qrToSvg` needs neither DOM nor WebGL, so it works on the server. Options: `errorCorrection`, `margin` (modules, default 4), `dark`, `light` (simple CSS colours) and `title`.

**Without WebGL** (old browser, blocked GPU, lost context) `createQrCity` no longer throws: it shows that same flat QR, using the style's roof and ground colours, and returns a controller with `fallback: true` and `canvas: null` where the 3D-only methods are harmless and `update`, `toQrSvg`, `toQrPng` and `toPNG` keep working. `onFallback` is called (or a `console.warn` if you do not define it) and the intro completes (`onIntroStage('done')`, `onReveal`) so your UI is not left waiting. If the WebGL context is lost and does not come back within 3 s, the flat QR is overlaid on the canvas. With `fallback: 'none'` the usual error is thrown.

## Door intro

```ts
const city = createQrCity(host, {
  data: 'https://your-site.dev',
  intro: 'door',
  pauseAtThreshold: true,
  onIntroStage: (stage) => { if (stage === 'threshold') showForm(); },
});
// Stages: 'door' → 'entering' → 'threshold' → 'flying' → 'done'
// A click (or Enter/Space) on the door calls city.openDoor().
// At 'threshold' you can change the data and carry on:
city.update({ data: 'https://another.site' });
city.continueIntro();
city.skipIntro(); // jump to the city from any stage
```

The door, the lobby and the flight are coloured with `style.door` (see `QrCityDoorTheme`); a custom style that does not define it uses *moderna*'s. With `prefers-reduced-motion` the intro skips the animations.

## Styles

Four styles are included (`styles.moderna`, `styles.costera`, `styles.ciberpunk`, `styles.nevada`), each with its own vegetation, traffic and wildlife: palms, boats and gulls in *costera*; neon, grid and drones in *ciberpunk*; pines and snow in *nevada*.

## Ultra quality

`quality: 'ultra'` is for large screens and showcases. It raises the shadow and texture resolution and the number of cars, pedestrians and trees. The extra modelled details (bumpers, grilles, plates, antennas and pillars on cars; root flares on trees) live in a separate entry point so apps that never ask for `ultra` do not ship them (under 1 kB gzip):

```ts
import '@qr-city/core/ultra'; // registers the extra parts; it has no exports
import { createQrCity } from '@qr-city/core';

createQrCity(host, { data: 'https://your-site.dev', quality: 'ultra' });
```

You can also load it lazily: `await import('@qr-city/core/ultra')` before creating the city. Without the import, `ultra` still works as `high` with denser traffic and logs one warning.

## Custom styles

`style` accepts a `QrCityStyle` object (colours as `#rrggbb`). Keep the scan-ability invariant: a dark `palette.roof` and light ground tones. See `styles.moderna` as a template.

`checkStyle(style)` tells you whether a style keeps that invariant:

```ts
import { checkStyle } from '@qr-city/core';

const { ok, contrast, warnings } = checkStyle(myStyle);
// ok: false, contrast: 2.6, warnings: ['Low contrast between the rooftops and the ground (2.6:1; …)']
```

It measures the contrast between `palette.roof` and the darkest of `walk`, `ground` and `road` (at least 4.5:1 is advised) and checks the quiet zone. The built-in styles always pass. `createQrCity` runs it once for a custom style object and logs the warnings with `console.warn`; for styles you change at runtime, call it yourself.

## License

MIT. "QR Code" is a registered trademark of DENSO WAVE INCORPORATED; this library is not affiliated with DENSO WAVE.
