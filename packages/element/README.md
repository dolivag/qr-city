# @qr-city/element

Web Component `<qr-city>`: una ciudad 3D cuyos tejados forman un QR escaneable. Funciona en React, Vue, Angular, Svelte o HTML plano.

```bash
npm i @qr-city/element three
```

```html
<script type="module">import '@qr-city/element/define';</script>
<qr-city data="https://tu-web.dev" style="width: 480px; height: 480px"></qr-city>
```

Si prefieres registrarlo tú: `import { defineQrCity } from '@qr-city/element'; defineQrCity('mi-ciudad');` (seguro en servidor).

## Atributos y propiedades

| Atributo | Propiedad | |
| --- | --- | --- |
| `data` | `data` | Texto o URL (1–300). Sin `data` no se renderiza nada. |
| `style-name` | `cityStyle` | Id de estilo; la propiedad también acepta un objeto `QrCityStyle`. |
| `intro` | `intro` | `none` \| `door`. Si cambia, el elemento se reinicia. |
| `pause-at-threshold` | `pauseAtThreshold` | Con `intro="door"`, espera en la pantalla blanca hasta `continueIntro()`. |
| `door-label` | `doorLabel` | Nombre accesible mientras la puerta espera. |
| `zoomable` | `zoomable` | `zoomable="false"` desactiva el zoom y el desplazamiento. |
| `max-zoom` | `maxZoom` | Zoom máximo (8 por defecto). |
| `wheel-zoom` | `wheelZoom` | `ctrl` (por defecto) \| `always` \| `off`. |
| `view` | `view` | `city` \| `qr`. |
| `error-correction` | `errorCorrection` | `L` `M` `Q` `H`. |
| `quality` | `quality` | `auto` `high` `low`. |
| `animate` | `animated` | `auto` \| `true` \| `false`. |
| `interactive` | `interactive` | `interactive="false"` desactiva el clic. |
| `background` | `background` | Color CSS o `transparent`. |
| `label` | `label` | Nombre accesible. |

Métodos: `setZoom()`, `zoomBy()`, `resetZoom()`, `openDoor()`, `continueIntro()`, `skipIntro()`, `reveal()`, `setView()`, `toggleView()`, `toPNG()`, `play()`, `pause()`, y `controller` (el controlador de `@qr-city/core`).

Propiedades de solo lectura `stage` (etapa de la intro) y `zoom`.

Eventos (burbujean y atraviesan el shadow DOM): `qr-city-reveal`, `qr-city-introstage` (`detail.stage`), `qr-city-zoomchange` (`detail.zoom`), `qr-city-viewchange` (`detail.view`), `qr-city-error` (`detail.error`).

El elemento mide por defecto un cuadrado del ancho de su contenedor; ponle tamaño con CSS. Se pausa fuera de pantalla (`IntersectionObserver`) y libera todo al desconectarse del DOM.
