# @qr-city/core

## 0.1.0

### Minor Changes

- [#7](https://github.com/dolivag/qr-city/pull/7) [`6df5f96`](https://github.com/dolivag/qr-city/commit/6df5f96a9ab14c4b6f1126bb4983c8d99cfdfdc4) Thanks [@dolivag](https://github.com/dolivag)! - New `quality: 'ultra'`: higher shadow and texture resolution and denser traffic and trees. Importing `@qr-city/core/ultra` (a separate entry point, under 1 kB gzip) adds extra modelled parts to cars and trees.

- [#5](https://github.com/dolivag/qr-city/pull/5) [`13ce089`](https://github.com/dolivag/qr-city/commit/13ce0892ad16c1ce3ac96710f21c7695fb0b1de3) Thanks [@dolivag](https://github.com/dolivag)! - First public release: isometric 3D city whose rooftops form a scannable QR code, with four styles, door intro, zoom, flat QR export (SVG/PNG) and a no-WebGL fallback. Web Component and React, Vue and Angular wrappers.

### Patch Changes

- [#6](https://github.com/dolivag/qr-city/pull/6) [`e0a4b81`](https://github.com/dolivag/qr-city/commit/e0a4b810b4ddd762d3e6c4a22c204810ded4f158) Thanks [@dolivag](https://github.com/dolivag)! - The `quality` option now changes the geometry too, not only the counts: `low` (default on small touch screens) uses fewer curve segments, simpler tree crowns and no wheel rims or side mirrors; `high` adds fuller crowns, more palm fronds and tiers on pines, rims and mirrors.

- [#8](https://github.com/dolivag/qr-city/pull/8) [`5910b32`](https://github.com/dolivag/qr-city/commit/5910b324ddc5575bda299d3c7b21dcff53fab7b2) Thanks [@dolivag](https://github.com/dolivag)! - Windows on `high` and `ultra` are now framed, four-pane windows with a sill shadow and a sky gradient (the neon style lights the panes, not the frames); `low` keeps the simple one. Drones in the cyberpunk style fly above the skyline, are 2.5× bigger and carry a soft halo, so they are visible.
