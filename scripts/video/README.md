# Vídeo de la demo

Graba la demo en vertical (1080×1920) con efectos de sonido sintetizados y, si quieres, tu música.

## Requisitos

- Node 20+ y las dependencias del repo (`npm ci`).
- **ffmpeg** en el `PATH`.
- Chromium de Playwright: `npx playwright install chromium`.
- Un ordenador con **GPU** para `ultra` (sin GPU, usa `--software`: funciona, pero muy lento).

## Uso

```bash
npm run video                                # ultra, 24 fps, 1080×1920 → qr-city-demo.mp4
npm run video -- --music pista.mp3           # con tu música por debajo de los efectos
npm run video -- --lang en --out demo-en.mp4 # en inglés
npm run video -- --quick                     # prueba rápida (low, 12 fps, 540×960)
npm run video -- --help                      # todas las opciones
```

La primera vez construye la demo (`npm run build`) y la sirve en local. Si ya tienes una en marcha, `--url`.

## Cómo funciona

Chromium con el reloj de Playwright detenido: el tiempo avanza exactamente 1/fps entre capturas, así que el vídeo
sale fluido aunque cada fotograma tarde segundos en dibujarse. Los eventos (toques, cambios de estilo, zooms…) se
anotan con su fotograma y `sfx.mjs` genera el audio sincronizado; `ffmpeg` lo une todo.

Guion: título con paneo → puerta y toque → enlace y estilo → vuelo → vista cenital con comprobación de lectura →
zoom a detalles del estilo creado → Costera, Nevada y Moderna con sus detalles → noche → pantalla final.

## Ajustes habituales

Todo está al principio de `record.mjs`:

- `TEXT`: rótulos en español e inglés.
- `TOUR`, `FIRST_DETAIL`, `NIGHT_DETAIL`: a qué punto de la pantalla (`at`, 0–1) y cuánto (`zoom`) se acerca la
  cámara. Lo que hay allí se mueve (drones, barcos, personas, aves), así que si un zoom no pilla lo que quieres,
  cambia la posición y vuelve a grabar.
- `LINK`: el enlace que se teclea; `FIRST_STYLE`: el estilo con el que nace la ciudad.
- Duración de cada pausa: los `frame(...)` y `detail(...)`.
- Sonidos: `sfx.mjs` (cada efecto está en su propio bloque, ligado al nombre de un evento).

## Si falla ffmpeg al final

Los fotogramas y el audio quedan en `.video-work/` (no se borran si el montaje falla). Cuando ffmpeg funcione
(en Windows, abre una terminal nueva tras instalarlo; comprueba con `ffmpeg -version`), monta sin volver a grabar:

```bash
npm run video -- --assemble                       # con la música: --music pista.mp3
npm run video -- --assemble --ffmpeg "C:\\ruta\\ffmpeg.exe"   # si no está en el PATH
```

`--keep` conserva los fotogramas en `.video-work/` por si solo quieres rehacer el montaje.
