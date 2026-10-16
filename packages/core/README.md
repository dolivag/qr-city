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
| `intro` | `'none'` | `'door'` y `'flyover'` aún no están implementados (lanzan error). |
| `view` | `'city'` | Vista inicial: `'city'` (isométrica) o `'qr'` (cenital). |
| `errorCorrection` | `'M'` | `'L' \| 'M' \| 'Q' \| 'H'`. |
| `quality` | `'auto'` | `'low'` desactiva sombras, baja el pixel ratio y reduce coches/peatones/árboles. `auto` elige `low` en táctiles pequeños. El antialiasing se fija al crear. |
| `interactive` | `true` | Clic / Enter / Espacio alterna la vista. |
| `animate` | `'auto'` | `'auto'` respeta `prefers-reduced-motion`. |
| `maxPixelRatio` | 2 (1 en `low`) | |
| `background` | cielo del estilo | Color CSS o `'transparent'`. |
| `label` | `'QR code city'` | Nombre accesible del lienzo. |
| `onReveal` / `onViewChange` / `onError` | — | `onReveal` se dispara cuando termina de construirse la ciudad (también tras cada reconstrucción). |

## Controlador (`QrCityController`)

`reveal()` · `setView(view, { immediate? })` · `toggleView()` · `setStyle(style)` · `update(partial)` · `toPNG({ scale? })` · `play()` / `pause()` · `resize()` · `dispose()` · `canvas` · `view`.

`update` solo reconstruye la ciudad si cambian `data`, `style`, `errorCorrection` o `quality`. `dispose()` es idempotente y libera geometrías, texturas, materiales, listeners, el bucle y el contexto WebGL.

## Estilos propios

`style` acepta un objeto `QrCityStyle` (colores en `#rrggbb`). Mantén el invariante de escaneabilidad: `palette.roof` oscuro y los tonos de suelo claros. Ver `styles.moderna` como plantilla.
