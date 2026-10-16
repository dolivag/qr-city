import { defineConfig } from '@playwright/test';

const PORT = 4180;

export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  // Software WebGL is slow: keep the load low so frame times do not stretch the timeouts.
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: {
      // Use an already installed Chromium when told to (e.g. sandboxes without network).
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      // WebGL on machines without a GPU.
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: `npx vite --config page/vite.config.ts --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
