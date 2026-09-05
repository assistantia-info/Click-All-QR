// Click All QR e2e — configuration Playwright.
// Le serveur web local sert fixtures/page.html (3 QR codes : http, https, non-URL)
// sur http://127.0.0.1:8791 — nécessaire car les extensions ne peuvent pas
// s'injecter proprement dans les pages file:// sans une coche manuelle.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,            // un seul navigateur armé à la fois
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { viewport: { width: 1280, height: 900 } },
  webServer: {
    command: process.platform === 'win32'
      ? 'python -m http.server 8791 --directory fixtures'
      : 'python3 -m http.server 8791 --directory fixtures',
    port: 8791,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
