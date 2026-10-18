# @qr-city/core

## 0.4.0

### Minor Changes

- [#33](https://github.com/dolivag/qr-city/pull/33) [`bb78f41`](https://github.com/dolivag/qr-city/commit/bb78f41e655b20a6ea73ab2368dd6c9f65a55a2d) Thanks [@dolivag](https://github.com/dolivag)! - Accesibilidad: el lienzo queda descrito con el destino del QR para los lectores de pantalla (`destinationLabel`, `'Destination:'` por defecto). Si el contenido es una dirección web, se añade un enlace real tras el lienzo en el orden del tabulador, que se muestra al recibir el foco; cualquier otro texto solo se describe, nunca se enlaza. Disponible en el Web Component (`destination-label`) y en React, Vue y Angular. El zoom, el desplazamiento y el cambio de vista con teclado ya existían y ahora tienen pruebas.

- [#34](https://github.com/dolivag/qr-city/pull/34) [`f0fd4fc`](https://github.com/dolivag/qr-city/commit/f0fd4fc2622588a65219cddc6bb47d923ce171da) Thanks [@dolivag](https://github.com/dolivag)! - Marcador para renderizado en servidor: los componentes de React, Vue y Angular pintan en el servidor un QR plano con los colores del estilo (el mismo código que dibuja la ciudad), oculto a los lectores de pantalla. La página ya funciona, se puede escanear y no pega saltos mientras carga el 3D, que lo sustituye al montarse. El núcleo exporta `qrPlaceholder()` para hacer lo mismo a mano.

- [#28](https://github.com/dolivag/qr-city/pull/28) [`bc011d7`](https://github.com/dolivag/qr-city/commit/bc011d722b1c0990a282515336f0d842b5f69482) Thanks [@dolivag](https://github.com/dolivag)! - Nueva opción `time: 'night'`: la misma ciudad de noche, con cielo estrellado y luna, luz de luna, ventanas encendidas y la escena de la puerta con un farol. Funciona con cualquier estilo (también con los propios) y el QR se lee igual: los tejados y el suelo conservan sus colores, y el suelo, que de lado se ve apagado, se ilumina en la vista cenital. Disponible en el Web Component (`time`) y en React, Vue y Angular.

- [#24](https://github.com/dolivag/qr-city/pull/24) [`8fe8f6f`](https://github.com/dolivag/qr-city/commit/8fe8f6f30fb15fb5482d790a6fe186d2b20663a0) Thanks [@dolivag](https://github.com/dolivag)! - Nueva opción `plaza`: una plaza en el centro de la ciudad con tu imagen (logo), que solo se ve desde arriba, en la vista del QR. El código se sigue leyendo: fuerza la corrección de errores `'H'` y reduce la imagen a tonos claros y oscuros. Disponible en el Web Component (`plaza`, `plaza-image`, `plaza-size`) y en React, Vue y Angular.

- [#27](https://github.com/dolivag/qr-city/pull/27) [`b24aa26`](https://github.com/dolivag/qr-city/commit/b24aa2647195afe42bf3f3afcc266329be004b1d) Thanks [@dolivag](https://github.com/dolivag)! - Rendimiento: las piezas repetidas (árboles, farolas, coches, personas, edificios) se dibujan en lotes instanciados, con un 90–95 % menos de llamadas de dibujo, y las copas de los árboles usan un tercio de los triángulos. Con `quality: 'auto'`, si el dispositivo no llega a ~30 fps se baja primero la densidad de píxeles y después el nivel de detalle.

### Patch Changes

- [#30](https://github.com/dolivag/qr-city/pull/30) [`4b3f4b8`](https://github.com/dolivag/qr-city/commit/4b3f4b85b6df62dcca8abe036e769ae7a00e8c30) Thanks [@dolivag](https://github.com/dolivag)! - Modo noche: las luces brillan más. Las ventanas encendidas dejan un halo sobre la fachada y tienen más intensidad, y las farolas tienen un resplandor que crece al hacer zoom. Los árboles de noche vuelven a verse verdes (la luz de luna azul los viraba a gris azulado). Solo afecta a la noche y a la vista de lado: el QR no cambia.

- [#29](https://github.com/dolivag/qr-city/pull/29) [`c13cbf1`](https://github.com/dolivag/qr-city/commit/c13cbf11dbaf59a7f456fd82115e2a961a0480d6) Thanks [@dolivag](https://github.com/dolivag)! - Costera: el mar es ahora de un azul intenso con aguas someras más claras, espuma en la orilla y más extensión (`quietZone` de 8), y los barcos son más grandes y navegan por mar abierto. Nevada: el suelo se ve cubierto de nieve, con ventisqueros pintados, destellos y montones de nieve al pie de los edificios, sobre un cielo gris azulado que hace destacar el blanco.

- [#36](https://github.com/dolivag/qr-city/pull/36) [`e14d05d`](https://github.com/dolivag/qr-city/commit/e14d05d68a82e4835d8e005f0661791b0b57adfb) Thanks [@dolivag](https://github.com/dolivag)! - Nevada: los copos son más pequeños y algo más transparentes, y hay menos en `high` y `ultra`, para que no tapen la ciudad vista desde lejos.

- [#32](https://github.com/dolivag/qr-city/pull/32) [`ee61cd3`](https://github.com/dolivag/qr-city/commit/ee61cd34caba3f9384545a64036444f7d3b65aac) Thanks [@dolivag](https://github.com/dolivag)! - Plaza: un logo claro (por ejemplo, blanco sobre fondo transparente) se invierte solo para que se vea sobre el pavimento claro. Se puede forzar o desactivar con `plaza.invert` (`'auto'` por defecto, `true` o `false`).

## 0.3.1

### Patch Changes

- [#20](https://github.com/dolivag/qr-city/pull/20) [`ac32b3c`](https://github.com/dolivag/qr-city/commit/ac32b3cbd847850b476d6dc92d46d44b5dba7133) Thanks [@dolivag](https://github.com/dolivag)! - Añade el logo a los README de los paquetes.

## 0.3.0

### Minor Changes

- [#16](https://github.com/dolivag/qr-city/pull/16) [`bc78b76`](https://github.com/dolivag/qr-city/commit/bc78b767b744a026b21f5a9ba32f678544eaa5bc) Thanks [@dolivag](https://github.com/dolivag)! - New `checkStyle(style)`: reports the contrast between rooftops and ground and the quiet zone of a style, so a custom style that would not scan can be caught. `createQrCity` logs its warnings once for custom style objects.

## 0.2.0

### Minor Changes

- [#11](https://github.com/dolivag/qr-city/pull/11) [`7f1fd38`](https://github.com/dolivag/qr-city/commit/7f1fd38dced3161c4a17e04b259c2a61b4d93e0e) Thanks [@dolivag](https://github.com/dolivag)! - `intro: 'flyover'` now works: the camera sweeps over the finished city and settles into the isometric view (a click or `skipIntro()` skips it; reduced motion skips it too). Also, revealing the QR while zoomed in now zooms back out and re-centres, so the whole code is visible.

### Patch Changes

- [#14](https://github.com/dolivag/qr-city/pull/14) [`af6c91c`](https://github.com/dolivag/qr-city/commit/af6c91c1e933e9e3802d621c1ae45ebb2624bb31) Thanks [@dolivag](https://github.com/dolivag)! - Snowflakes are now soft round dots sized by the canvas height (about 3 px on a tall desktop canvas, much smaller on a phone) instead of fixed 6 px squares, so on small screens the snow no longer hides the city.

## 0.1.0

### Minor Changes

- [#7](https://github.com/dolivag/qr-city/pull/7) [`6df5f96`](https://github.com/dolivag/qr-city/commit/6df5f96a9ab14c4b6f1126bb4983c8d99cfdfdc4) Thanks [@dolivag](https://github.com/dolivag)! - New `quality: 'ultra'`: higher shadow and texture resolution and denser traffic and trees. Importing `@qr-city/core/ultra` (a separate entry point, under 1 kB gzip) adds extra modelled parts to cars and trees.

- [#5](https://github.com/dolivag/qr-city/pull/5) [`13ce089`](https://github.com/dolivag/qr-city/commit/13ce0892ad16c1ce3ac96710f21c7695fb0b1de3) Thanks [@dolivag](https://github.com/dolivag)! - First public release: isometric 3D city whose rooftops form a scannable QR code, with four styles, door intro, zoom, flat QR export (SVG/PNG) and a no-WebGL fallback. Web Component and React, Vue and Angular wrappers.

### Patch Changes

- [#6](https://github.com/dolivag/qr-city/pull/6) [`e0a4b81`](https://github.com/dolivag/qr-city/commit/e0a4b810b4ddd762d3e6c4a22c204810ded4f158) Thanks [@dolivag](https://github.com/dolivag)! - The `quality` option now changes the geometry too, not only the counts: `low` (default on small touch screens) uses fewer curve segments, simpler tree crowns and no wheel rims or side mirrors; `high` adds fuller crowns, more palm fronds and tiers on pines, rims and mirrors.

- [#8](https://github.com/dolivag/qr-city/pull/8) [`5910b32`](https://github.com/dolivag/qr-city/commit/5910b324ddc5575bda299d3c7b21dcff53fab7b2) Thanks [@dolivag](https://github.com/dolivag)! - Windows on `high` and `ultra` are now framed, four-pane windows with a sill shadow and a sky gradient (the neon style lights the panes, not the frames); `low` keeps the simple one. Drones in the cyberpunk style fly above the skyline, are 2.5× bigger and carry a soft halo, so they are visible.
