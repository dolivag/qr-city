# @qr-city/angular

Componente de Angular para **qr-city**: una ciudad 3D cuyos tejados forman un QR escaneable. Standalone, compatible con zoneless y con SSR. Angular ≥ 21, `three` como *peerDependency*.

```bash
npm i @qr-city/angular three
```

```ts
import { Component, viewChild } from '@angular/core';
import { QrCityComponent } from '@qr-city/angular';

@Component({
  selector: 'app-ciudad',
  imports: [QrCityComponent],
  template: `
    <qr-city-view #city data="https://tu-web.dev" cityStyle="ciberpunk" style="width: 480px" (revealed)="listo()" />
    <button (click)="city.reveal()">Revelar QR</button>
  `,
})
export class CiudadComponent {
  listo() { console.log('ciudad lista'); }
}
```

## Entradas y salidas

Las mismas opciones que [`createQrCity`](../core), como `input()`: `data` (obligatoria), `cityStyle`, `intro`, `pauseAtThreshold`, `view`, `errorCorrection`, `quality`, `interactive`, `animate`, `maxPixelRatio`, `zoomable`, `maxZoom`, `wheelZoom`, `fallback`, `background`, `label` y `doorLabel`. **`cityStyle`** es el estilo de la ciudad (`'moderna' | 'costera' | 'ciberpunk' | 'nevada'` o un objeto `QrCityStyle`).

| Salida | Carga |
| --- | --- |
| `revealed` | — |
| `introStageChange` | `'door' \| 'entering' \| 'threshold' \| 'flying' \| 'done'` |
| `viewChange` | `'city' \| 'qr'` |
| `zoomChange` | `number` |
| `fallbackUsed` | `Error`: no hay WebGL y se muestra un QR plano escaneable |
| `qrError` | `Error` |

El selector es `qr-city-view` (para no chocar con el Web Component `<qr-city>`). Por defecto es un cuadrado del ancho de su contenedor.

## Cómo se comporta

- **Servidor (SSR):** WebGL arranca con `afterNextRender`, que no se ejecuta en el servidor.
- **Zona:** el bucle de animación corre fuera de `NgZone`, así que no dispara detección de cambios en cada fotograma. Las salidas se emiten dentro de la zona.
- **Cambios de entradas:** se aplican en el sitio; la ciudad solo se reconstruye cuando cambian `data`, `cityStyle`, `errorCorrection` o `quality`.
- **`intro`** se fija al crear: si cambia, el componente se reinicia.
- **Sin WebGL** se muestra un QR plano escaneable y se emite `fallbackUsed` (`fallback="none"` para recibir un `qrError` en su lugar). **Otros errores** (datos inválidos…) llegan a `qrError`; en modo desarrollo también se escriben en la consola.
- **QR para imprimir:** `toQrSvg()` / `toQrPng()` en el componente, o `qrToSvg(data)` / `qrToPng(data)` (se exportan).
- **Métodos del componente:** `reveal()`, `setView()`, `toggleView()`, `setZoom()`, `zoomBy()`, `resetZoom()`, `openDoor()`, `continueIntro()`, `skipIntro()`, `toPNG()`, `play()`, `pause()`, y `controller`, `stage`, `currentView`, `zoom`.

## Publicación

ng-packagr genera el paquete en `packages/angular/dist`; se publica desde esa carpeta.
