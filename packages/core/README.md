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
| `style` | `'moderna'` | Id de estilo o un objeto `QrCityStyle`. |
| `intro` | `'none'` | `'door'`: puerta → entras → sales al vuelo hasta la ciudad. `'flyover'` aún no está implementado (lanza error). Se fija al crear. |
| `pauseAtThreshold` | `false` | Con `intro: 'door'`: se detiene en la pantalla blanca tras cruzar la puerta hasta que llames a `continueIntro()` (ahí puedes mostrar un formulario). |
| `view` | `'city'` | Vista inicial: `'city'` (isométrica) o `'qr'` (cenital). |
| `errorCorrection` | `'M'` | `'L' \| 'M' \| 'Q' \| 'H'`. |
| `quality` | `'auto'` | `'low'` desactiva sombras, baja el pixel ratio y reduce coches/peatones/árboles. `auto` elige `low` en táctiles pequeños. El antialiasing se fija al crear. |
| `interactive` | `true` | Clic / Enter / Espacio alterna la vista. |
| `animate` | `'auto'` | `'auto'` respeta `prefers-reduced-motion`. |
| `maxPixelRatio` | 2 (1 en `low`) | |
| `background` | cielo del estilo | Color CSS o `'transparent'`. |
| `label` / `doorLabel` | `'QR code city'` / `'Open the door'` | Nombre accesible del lienzo (y mientras la puerta espera). |
| `onReveal` / `onIntroStage` / `onViewChange` / `onError` | — | `onReveal` se dispara cuando la ciudad está en pantalla: al terminar de construirse o, con `intro: 'door'`, al acabar el vuelo (y tras cada reconstrucción). `onIntroStage` recibe cada etapa. |

## Controlador (`QrCityController`)

`stage` · `openDoor()` · `continueIntro()` · `skipIntro()` · `reveal()` · `setView(view, { immediate? })` · `toggleView()` · `setStyle(style)` · `update(partial)` · `toPNG({ scale? })` · `play()` / `pause()` · `resize()` · `dispose()` · `canvas` · `view`.

`update` solo reconstruye la ciudad si cambian `data`, `style`, `errorCorrection` o `quality`. `dispose()` es idempotente y libera geometrías, texturas, materiales, listeners, el bucle y el contexto WebGL.

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

## Estilos propios

`style` acepta un objeto `QrCityStyle` (colores en `#rrggbb`). Mantén el invariante de escaneabilidad: `palette.roof` oscuro y los tonos de suelo claros. Ver `styles.moderna` como plantilla.
