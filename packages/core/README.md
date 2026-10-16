# @qr-city/core

Núcleo de **qr-city**: una ciudad 3D isométrica cuyos tejados forman un QR escaneable. Sin dependencias de framework; `three` es *peerDependency* (`>=0.160 <1`).

```bash
npm i @qr-city/core three
```

```ts
import { createQrCity } from '@qr-city/core';

const city = createQrCity(hostElement, {
  data: 'https://tu-web.dev',
  onReveal: () => console.log('ciudad construida'),
});
```

`hostElement` debe tener tamaño (el lienzo lo rellena y sigue sus cambios con `ResizeObserver`). Llama a `createQrCity` solo en cliente (`useEffect`, `onMounted`, `ngAfterViewInit`…); importar el paquete en servidor es seguro.

## Opciones (`QrCityOptions`)

| Opción | Por defecto | |
| --- | --- | --- |
| `data` | — | Texto o URL, 1–300 caracteres. |
| `style` | `'moderna'` | `'moderna'`, `'costera'`, `'ciberpunk'`, `'nevada'` o un objeto `QrCityStyle`. |
| `intro` | `'none'` | `'door'`: puerta → entras → sales al vuelo hasta la ciudad. `'flyover'` aún no está implementado (lanza error). Se fija al crear. |
| `pauseAtThreshold` | `false` | Con `intro: 'door'`: se detiene en la pantalla blanca tras cruzar la puerta hasta que llames a `continueIntro()` (ahí puedes mostrar un formulario). |
| `view` | `'city'` | Vista inicial: `'city'` (isométrica) o `'qr'` (cenital). |
| `errorCorrection` | `'M'` | `'L' \| 'M' \| 'Q' \| 'H'`. |
| `quality` | `'auto'` | `'low'` desactiva sombras, baja el pixel ratio y reduce coches/peatones/árboles. `auto` elige `low` en táctiles pequeños. El antialiasing se fija al crear. |
| `interactive` | `true` | Clic / Enter / Espacio alterna la vista. |
| `zoomable` / `maxZoom` / `wheelZoom` | `true` / `8` / `'ctrl'` | Zoom y desplazamiento de la ciudad: pellizco, arrastrar, `+` `−` `0` y flechas con el lienzo enfocado. `wheelZoom`: `'ctrl'` (Ctrl/⌘ + rueda y pellizco del trackpad; la rueda sola sigue haciendo scroll), `'always'` u `'off'`. |
| `animate` | `'auto'` | `'auto'` respeta `prefers-reduced-motion`. |
| `maxPixelRatio` | 2 (1 en `low`) | |
| `background` | cielo del estilo | Color CSS o `'transparent'`. |
| `fallback` | `'qr'` | Qué hacer si no hay WebGL: `'qr'` muestra un QR plano escaneable con los colores del estilo; `'none'` lanza un error. |
| `label` / `doorLabel` | `'QR code city'` / `'Open the door'` | Nombre accesible del lienzo (y mientras la puerta espera). |
| `onReveal` / `onIntroStage` / `onViewChange` / `onZoomChange` / `onFallback` / `onError` | — | `onReveal` se dispara cuando la ciudad está en pantalla: al terminar de construirse o, con `intro: 'door'`, al acabar el vuelo (y tras cada reconstrucción). `onIntroStage` recibe cada etapa. |

## Controlador (`QrCityController`)

`fallback` · `toQrSvg(opts?)` · `toQrPng(opts?)` · `zoom` · `setZoom(z, { immediate?, at? })` · `zoomBy(f)` · `resetZoom()` · `stage` · `openDoor()` · `continueIntro()` · `skipIntro()` · `reveal()` · `setView(view, { immediate? })` · `toggleView()` · `setStyle(style)` · `update(partial)` · `toPNG({ scale? })` · `play()` / `pause()` · `resize()` · `dispose()` · `canvas` · `view`.

`update` solo reconstruye la ciudad si cambian `data`, `style`, `errorCorrection` o `quality`. El zoom no pierde nitidez: la textura del suelo se pinta a alta resolución y la sombra del sol se ajusta a lo que se ve. `update` con otros `data`/`style` restablece el zoom.

`dispose()` es idempotente y libera geometrías, texturas, materiales, listeners, el bucle y el contexto WebGL.

## QR plano para imprimir y respaldo sin WebGL

La ciudad es el atractivo, pero a veces lo que se necesita es el código. Para eso:

```ts
import { qrToSvg, qrToPng } from '@qr-city/core';

const svg = qrToSvg('https://tu-web.dev');                 // string SVG: negro sobre blanco, con quiet zone de 4 módulos
const png = await qrToPng('https://tu-web.dev', { size: 1024 }); // Blob PNG (solo navegador)

city.toQrSvg({ dark: '#111', margin: 4 });                 // el código actual de la ciudad
```

`qrToSvg` no necesita DOM ni WebGL: sirve en el servidor. Opciones: `errorCorrection`, `margin` (módulos), `dark`, `light` (colores CSS simples) y `title`.

**Sin WebGL** (navegador antiguo, GPU bloqueada, contexto perdido) `createQrCity` ya no lanza: muestra ese mismo QR plano, con el color de tejado y de suelo del estilo, y devuelve un controlador con `fallback: true` y `canvas: null` en el que los métodos solo 3D son inofensivos y `update`, `toQrSvg`, `toQrPng` y `toPNG` siguen funcionando. Se avisa con `onFallback` (o un `console.warn` si no la defines) y se completa la intro (`onIntroStage('done')`, `onReveal`) para que tu interfaz no se quede esperando. Si el contexto WebGL se pierde y no vuelve en 3 s, el QR plano se superpone al lienzo. Con `fallback: 'none'` se lanza el error de siempre.

## Intro de la puerta

```ts
const city = createQrCity(host, {
  data: 'https://tu-web.dev',
  intro: 'door',
  pauseAtThreshold: true,
  onIntroStage: (stage) => { if (stage === 'threshold') showForm(); },
});
// Etapas: 'door' → 'entering' → 'threshold' → 'flying' → 'done'
// Un clic (o Enter/Espacio) en la puerta llama a city.openDoor().
// En 'threshold' puedes cambiar los datos y continuar:
city.update({ data: 'https://otra.web' });
city.continueIntro();
city.skipIntro(); // salta a la ciudad desde cualquier etapa
```

La puerta, el vestíbulo y el vuelo se colorean con `style.door` (ver `QrCityDoorTheme`); si un estilo propio no lo define, usa el de *moderna*. Con `prefers-reduced-motion` la intro se salta las animaciones.

## Estilos

Incluye cuatro estilos (`styles.moderna`, `styles.costera`, `styles.ciberpunk`, `styles.nevada`), cada uno con su vegetación, tráfico y fauna: palmeras, barcos y gaviotas en *costera*; neón, rejilla y drones en *ciberpunk*; pinos y nieve en *nevada*.

## Estilos propios

`style` acepta un objeto `QrCityStyle` (colores en `#rrggbb`). Mantén el invariante de escaneabilidad: `palette.roof` oscuro y los tonos de suelo claros. Ver `styles.moderna` como plantilla.
