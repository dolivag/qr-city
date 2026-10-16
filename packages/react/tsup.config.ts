import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  external: ['react', 'react/jsx-runtime', 'three', '@qr-city/core'],
  // Needed by Next.js and other RSC frameworks: the component uses effects and refs.
  banner: { js: '"use client";' },
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
