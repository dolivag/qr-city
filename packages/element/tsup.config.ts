import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/define.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  splitting: true,
});
