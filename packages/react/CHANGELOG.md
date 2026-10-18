# @qr-city/react

## 0.4.0

### Minor Changes

- [#34](https://github.com/dolivag/qr-city/pull/34) [`f0fd4fc`](https://github.com/dolivag/qr-city/commit/f0fd4fc2622588a65219cddc6bb47d923ce171da) Thanks [@dolivag](https://github.com/dolivag)! - Marcador para renderizado en servidor: los componentes de React, Vue y Angular pintan en el servidor un QR plano con los colores del estilo (el mismo código que dibuja la ciudad), oculto a los lectores de pantalla. La página ya funciona, se puede escanear y no pega saltos mientras carga el 3D, que lo sustituye al montarse. El núcleo exporta `qrPlaceholder()` para hacer lo mismo a mano.

### Patch Changes

- Updated dependencies [[`bb78f41`](https://github.com/dolivag/qr-city/commit/bb78f41e655b20a6ea73ab2368dd6c9f65a55a2d), [`4b3f4b8`](https://github.com/dolivag/qr-city/commit/4b3f4b85b6df62dcca8abe036e769ae7a00e8c30), [`c13cbf1`](https://github.com/dolivag/qr-city/commit/c13cbf11dbaf59a7f456fd82115e2a961a0480d6), [`f0fd4fc`](https://github.com/dolivag/qr-city/commit/f0fd4fc2622588a65219cddc6bb47d923ce171da), [`bc011d7`](https://github.com/dolivag/qr-city/commit/bc011d722b1c0990a282515336f0d842b5f69482), [`e14d05d`](https://github.com/dolivag/qr-city/commit/e14d05d68a82e4835d8e005f0661791b0b57adfb), [`8fe8f6f`](https://github.com/dolivag/qr-city/commit/8fe8f6f30fb15fb5482d790a6fe186d2b20663a0), [`ee61cd3`](https://github.com/dolivag/qr-city/commit/ee61cd34caba3f9384545a64036444f7d3b65aac), [`b24aa26`](https://github.com/dolivag/qr-city/commit/b24aa2647195afe42bf3f3afcc266329be004b1d)]:
  - @qr-city/core@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [[`ac32b3c`](https://github.com/dolivag/qr-city/commit/ac32b3cbd847850b476d6dc92d46d44b5dba7133)]:
  - @qr-city/core@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [[`bc78b76`](https://github.com/dolivag/qr-city/commit/bc78b767b744a026b21f5a9ba32f678544eaa5bc)]:
  - @qr-city/core@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [[`7f1fd38`](https://github.com/dolivag/qr-city/commit/7f1fd38dced3161c4a17e04b259c2a61b4d93e0e), [`af6c91c`](https://github.com/dolivag/qr-city/commit/af6c91c1e933e9e3802d621c1ae45ebb2624bb31)]:
  - @qr-city/core@0.2.0

## 0.1.0

### Minor Changes

- [#5](https://github.com/dolivag/qr-city/pull/5) [`13ce089`](https://github.com/dolivag/qr-city/commit/13ce0892ad16c1ce3ac96710f21c7695fb0b1de3) Thanks [@dolivag](https://github.com/dolivag)! - First public release: isometric 3D city whose rooftops form a scannable QR code, with four styles, door intro, zoom, flat QR export (SVG/PNG) and a no-WebGL fallback. Web Component and React, Vue and Angular wrappers.

### Patch Changes

- Updated dependencies [[`6df5f96`](https://github.com/dolivag/qr-city/commit/6df5f96a9ab14c4b6f1126bb4983c8d99cfdfdc4), [`e0a4b81`](https://github.com/dolivag/qr-city/commit/e0a4b810b4ddd762d3e6c4a22c204810ded4f158), [`13ce089`](https://github.com/dolivag/qr-city/commit/13ce0892ad16c1ce3ac96710f21c7695fb0b1de3), [`5910b32`](https://github.com/dolivag/qr-city/commit/5910b324ddc5575bda299d3c7b21dcff53fab7b2)]:
  - @qr-city/core@0.1.0
