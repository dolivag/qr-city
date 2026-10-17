# @qr-city/element

`<qr-city>` Web Component: a 3D city whose rooftops form a scannable QR code. Works in React, Vue, Angular, Svelte or plain HTML.

```bash
npm i @qr-city/element three
```

```html
<script type="module">import '@qr-city/element/define';</script>
<qr-city data="https://your-site.dev" style="width: 480px; height: 480px"></qr-city>
```

To register it yourself: `import { defineQrCity } from '@qr-city/element'; defineQrCity('my-city');` (safe on the server).

## Attributes and properties

| Attribute | Property | |
| --- | --- | --- |
| `data` | `data` | Text or URL (1–300). Nothing is rendered without `data`. |
| `style-name` | `cityStyle` | Style id; the property also accepts a `QrCityStyle` object. |
| `intro` | `intro` | `none` \| `door` \| `flyover`. If it changes, the element restarts. |
| `pause-at-threshold` | `pauseAtThreshold` | With `intro="door"`, waits on the white screen until `continueIntro()`. |
| `door-label` | `doorLabel` | Accessible name while the door waits. |
| `zoomable` | `zoomable` | `zoomable="false"` disables zoom and pan. |
| `max-zoom` | `maxZoom` | Maximum zoom (default 8). |
| `wheel-zoom` | `wheelZoom` | `ctrl` (default) \| `always` \| `off`. |
| `fallback` | `fallback` | `qr` (default): without WebGL shows a flat, scannable QR. `none`: fires `qr-city-error`. |
| `view` | `view` | `city` \| `qr`. |
| `error-correction` | `errorCorrection` | `L` `M` `Q` `H`. |
| `quality` | `quality` | `auto` `high` `low` `ultra` (see [`@qr-city/core`](../core#ultra-quality)). |
| `animate` | `animated` | `auto` \| `true` \| `false`. |
| `interactive` | `interactive` | `interactive="false"` disables click. |
| `background` | `background` | CSS colour or `transparent`. |
| `label` | `label` | Accessible name. |

Methods: `toQrSvg()`, `toQrPng()`, `setZoom()`, `zoomBy()`, `resetZoom()`, `openDoor()`, `continueIntro()`, `skipIntro()`, `reveal()`, `setView()`, `toggleView()`, `toPNG()`, `play()`, `pause()`, and `controller` (the `@qr-city/core` controller).

Read-only properties: `stage` (intro stage), `zoom` and `usingFallback`. The `qrToSvg` and `qrToPng` functions are also exported.

Events (they bubble and cross the shadow DOM): `qr-city-reveal`, `qr-city-introstage` (`detail.stage`), `qr-city-zoomchange` (`detail.zoom`), `qr-city-fallback` (`detail.reason`: no WebGL, the flat QR is shown), `qr-city-viewchange` (`detail.view`), `qr-city-error` (`detail.error`).

By default the element is a square as wide as its container; size it with CSS. It pauses when off-screen (`IntersectionObserver`) and releases everything when disconnected from the DOM.

## License

MIT. "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
