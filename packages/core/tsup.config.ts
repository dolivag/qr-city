import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/ultra.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  treeshake: true,
  // `three` (peer) and `qrcode-generator` (dependency) stay external.
});
