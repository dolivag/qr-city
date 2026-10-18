<p align="center"><img src="https://raw.githubusercontent.com/dolivag/qr-city/master/assets/logo/logo-mark.svg" alt="qr-city" width="120"></p>

# @qr-city/react

React component for **qr-city**: a 3D city whose rooftops form a scannable QR code. React ≥ 18, `three` as a *peerDependency*.

```bash
npm i @qr-city/react three
```

```tsx
import { useRef } from 'react';
import { QrCity } from '@qr-city/react';
import type { QrCityHandle } from '@qr-city/react';

export function City() {
  const city = useRef<QrCityHandle>(null);
  return (
    <>
      <QrCity
        ref={city}
        data="https://your-site.dev"
        cityStyle="costera"
        style={{ width: 480 }}
        onReveal={() => console.log('city ready')}
      />
      <button onClick={() => city.current?.reveal()}>Reveal QR</button>
    </>
  );
}
```

## Props

The same options as [`createQrCity`](../core) (`data`, `intro`, `pauseAtThreshold`, `view`, `errorCorrection`, `quality`, `interactive`, `animate`, `maxPixelRatio`, `zoomable`, `maxZoom`, `wheelZoom`, `background`, `label`, `doorLabel`, `destinationLabel`, `fallback`, `time`, `plaza`) and the callbacks `onReveal`, `onIntroStage`, `onViewChange`, `onZoomChange`, `onFallback` and `onError`, with two differences:

- **`cityStyle`** is the city's style (`'moderna' | 'costera' | 'ciberpunk' | 'nevada'` or a `QrCityStyle` object), because **`style`** is the container's CSS style.
- The remaining `<div>` props (`className`, `style`, `aria-*`…) go to the container. By default it is a square as wide as its parent.

## Behaviour

- **Server (SSR, Next.js…):** renders an empty `<div>` and starts WebGL on mount. The package ships `"use client"`.
- **Prop changes:** applied in place; the city only rebuilds when `data`, `cityStyle`, `errorCorrection`, `quality` or `plaza` change. A style object recreated on every render with the same content rebuilds nothing.
- **`intro`** is fixed at creation: if it changes, the component restarts.
- **`view`** is applied when it changes; the user can toggle the view with a click without the prop changing.
- **Callbacks:** the latest one is always called, without recreating the city.
- **Without WebGL** a flat, scannable QR is shown and `onFallback` is called (`fallback="none"` to get an error instead). **Other errors** (invalid data…) reach `onError`; the component never throws while rendering.
- **Printable QR:** `ref.current.toQrSvg()` / `toQrPng()`, or `qrToSvg(data)` / `qrToPng(data)` (exported; `qrToSvg` works on the server).
- **`ref`:** exposes the controller (`reveal()`, `setView()`, `setZoom()`, `zoomBy()`, `resetZoom()`, `openDoor()`, `continueIntro()`, `skipIntro()`, `toPNG()`, `play()`, `pause()`, `canvas`, `view`, `zoom`, `stage`…). Its methods do nothing until the city has mounted.

### Door intro with a form

```tsx
const [stage, setStage] = useState<QrCityIntroStage>('door');
const city = useRef<QrCityHandle>(null);

<QrCity ref={city} data={url} intro="door" pauseAtThreshold onIntroStage={setStage} />
{stage === 'threshold' && <Form onSubmit={(u) => { setUrl(u); city.current?.continueIntro(); }} />}
```

## License

MIT. "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
