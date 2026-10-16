# @qr-city/react

Componente de React para **qr-city**: una ciudad 3D cuyos tejados forman un QR escaneable. React ≥ 18, `three` como *peerDependency*.

```bash
npm i @qr-city/react three
```

```tsx
import { useRef } from 'react';
import { QrCity } from '@qr-city/react';
import type { QrCityHandle } from '@qr-city/react';

export function Ciudad() {
  const city = useRef<QrCityHandle>(null);
  return (
    <>
      <QrCity
        ref={city}
        data="https://tu-web.dev"
        cityStyle="costera"
        style={{ width: 480 }}
        onReveal={() => console.log('ciudad lista')}
      />
      <button onClick={() => city.current?.reveal()}>Revelar QR</button>
    </>
  );
}
```

## Props

Las mismas opciones que [`createQrCity`](../core) (`data`, `intro`, `pauseAtThreshold`, `view`, `errorCorrection`, `quality`, `interactive`, `animate`, `maxPixelRatio`, `zoomable`, `maxZoom`, `wheelZoom`, `background`, `label`, `doorLabel`) `fallback`, y las callbacks `onReveal`, `onIntroStage`, `onViewChange`, `onZoomChange`, `onFallback` y `onError`, con dos diferencias:

- **`cityStyle`** es el estilo de la ciudad (`'moderna' | 'costera' | 'ciberpunk' | 'nevada'` o un objeto `QrCityStyle`), porque **`style`** es el estilo CSS del contenedor.
- El resto de props de `<div>` (`className`, `style`, `aria-*`…) van al contenedor. Por defecto es un cuadrado del ancho de su padre.

## Cómo se comporta

- **Servidor (SSR, Next.js…):** renderiza un `<div>` vacío y arranca WebGL al montarse. El paquete incluye `"use client"`.
- **Cambios de props:** se aplican en el sitio; la ciudad solo se reconstruye cuando cambian `data`, `cityStyle`, `errorCorrection` o `quality`. Un objeto de estilo recreado en cada render con el mismo contenido no reconstruye nada.
- **`intro`** se fija al crear: si cambia, el componente se reinicia.
- **`view`** se aplica cuando cambia; el usuario puede alternar la vista con un clic sin que cambie la prop.
- **Callbacks:** se llama siempre a la última, sin recrear la ciudad.
- **Sin WebGL** se muestra un QR plano escaneable y se llama a `onFallback` (`fallback="none"` para recibir un error en su lugar). **Otros errores** (datos inválidos…) llegan a `onError`; el componente nunca lanza al renderizar.
- **QR para imprimir:** `ref.current.toQrSvg()` / `toQrPng()`, o `qrToSvg(data)` / `qrToPng(data)` (se exportan, y `qrToSvg` sirve en el servidor).
- **`ref`:** expone el controlador (`reveal()`, `setView()`, `setZoom()`, `zoomBy()`, `resetZoom()`, `openDoor()`, `continueIntro()`, `skipIntro()`, `toPNG()`, `play()`, `pause()`, `canvas`, `view`, `zoom`, `stage`…). Sus métodos no hacen nada hasta que la ciudad se monta.

### Intro de la puerta con formulario

```tsx
const [stage, setStage] = useState<QrCityIntroStage>('door');
const city = useRef<QrCityHandle>(null);

<QrCity ref={city} data={url} intro="door" pauseAtThreshold onIntroStage={setStage} />
{stage === 'threshold' && <Formulario onSubmit={(u) => { setUrl(u); city.current?.continueIntro(); }} />}
```
