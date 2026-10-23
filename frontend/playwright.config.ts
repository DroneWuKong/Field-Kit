import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 90000,
  use: { baseURL: process.env.HORIZON_TEST_URL || 'http://127.0.0.1:8766', viewport: { width: 1560, height: 980 },
    launchOptions: { args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }, screenshot: 'only-on-failure' },
  reporter: [['list']],
});
