<p align="center"><img src="https://raw.githubusercontent.com/dolivag/qr-city/master/assets/logo/logo-mark.svg" alt="qr-city" width="120"></p>

# @qr-city/angular

Angular component for **qr-city**: a 3D city whose rooftops form a scannable QR code. Standalone, zoneless- and SSR-friendly. Angular ≥ 21, `three` as a *peerDependency*.

```bash
npm i @qr-city/angular three
```

```ts
import { Component } from '@angular/core';
import { QrCityComponent } from '@qr-city/angular';

@Component({
  selector: 'app-city',
  imports: [QrCityComponent],
  template: `
    <qr-city-view #city data="https://your-site.dev" cityStyle="ciberpunk" style="width: 480px" (revealed)="ready()" />
    <button (click)="city.reveal()">Reveal QR</button>
  `,
})
export class CityComponent {
  ready() { console.log('city ready'); }
}
```

## Inputs and outputs

The same options as [`createQrCity`](../core), as `input()`s: `data` (required), `cityStyle`, `intro`, `pauseAtThreshold`, `view`, `errorCorrection`, `quality`, `interactive`, `animate`, `maxPixelRatio`, `zoomable`, `maxZoom`, `wheelZoom`, `fallback`, `background`, `label`, `doorLabel` and `plaza`. **`cityStyle`** is the city's style (`'moderna' | 'costera' | 'ciberpunk' | 'nevada'` or a `QrCityStyle` object).

| Output | Payload |
| --- | --- |
| `revealed` | — |
| `introStageChange` | `'door' \| 'entering' \| 'threshold' \| 'flying' \| 'done'` |
| `viewChange` | `'city' \| 'qr'` |
| `zoomChange` | `number` |
| `fallbackUsed` | `Error`: no WebGL, a flat scannable QR is shown |
| `qrError` | `Error` |

The selector is `qr-city-view` (so it does not clash with the `<qr-city>` Web Component). By default it is a square as wide as its container.

## Behaviour

- **Server (SSR):** WebGL starts in `afterNextRender`, which does not run on the server.
- **Zone:** the animation loop runs outside `NgZone`, so it does not trigger change detection every frame. Outputs are emitted inside the zone.
- **Input changes:** applied in place; the city only rebuilds when `data`, `cityStyle`, `errorCorrection`, `quality` or `plaza` change.
- **`intro`** is fixed at creation: if it changes, the component restarts.
- **Without WebGL** a flat, scannable QR is shown and `fallbackUsed` is emitted (`fallback="none"` to get a `qrError` instead). **Other errors** (invalid data…) reach `qrError`; in dev mode they are also written to the console.
- **Printable QR:** `toQrSvg()` / `toQrPng()` on the component, or `qrToSvg(data)` / `qrToPng(data)` (exported).
- **Component methods:** `reveal()`, `setView()`, `toggleView()`, `setZoom()`, `zoomBy()`, `resetZoom()`, `openDoor()`, `continueIntro()`, `skipIntro()`, `toPNG()`, `play()`, `pause()`, plus `controller`, `stage`, `currentView`, `zoom`.

## Publishing

ng-packagr builds the package into `packages/angular/dist`; publish from that folder.

## License

MIT. "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
