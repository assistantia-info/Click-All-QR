// Click All QR v0.2.0 — tests end-to-end (Playwright + vrai Chromium chargé avec
// l'extension non empaquetée). Aucun setTimeout fragile : uniquement
// waitForSelector / toHaveCount (auto-retry) et expect.poll.
//
// Scénarios :
//   A. Désactivée par défaut → aucun badge.
//   B. Toggle ON via le VRAI popup → 3 overlays (2 liens + 1 info non-URL),
//      clic sur les badges → le bon onglet s'ouvre (expect.poll), l'info badge
//      n'ouvre rien.
//   C. Toggle OFF → tous les overlays sont démontés (caqr-disable).
//   D. Re-ON puis navigation (reload) → ré-injection automatique tant que ON.

const path = require('node:path');
const { test, expect, chromium } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..'); // racine du dépôt = racine de l'extension
const FIXTURE_URL = 'http://127.0.0.1:8791/page.html';

test.describe.serial('Click All QR — cycle de vie du toggle et ouverture des liens', () => {
  let context;
  let popupUrl;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: false, // les extensions MV3 exigent un navigateur fenêtré
      args: [
        `--disable-extensions-except=${REPO_ROOT}`,
        `--load-extension=${REPO_ROOT}`,
      ],
      viewport: { width: 1280, height: 900 },
    });
    // Identifiant de l'extension dérivé du service worker MV3.
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 20_000 });
    popupUrl = `chrome-extension://${new URL(sw.url()).host}/popup.html`;
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('A — désactivée par défaut : la page fixture n\'a aucun badge', async () => {
    const page = await context.newPage();
    await page.goto(FIXTURE_URL, { waitUntil: 'load' });
    await expect(page.locator('.caqr-badge')).toHaveCount(0);
    await expect(page.locator('.caqr-unsupported')).toHaveCount(0);
    await page.close();
  });

  test('B — toggle ON via le popup : 3 overlays, clics, bons onglets', async () => {
    const fixture = await context.newPage();
    await fixture.goto(FIXTURE_URL, { waitUntil: 'load' });

    // Le VRAI popup (ouvert en onglet — même DOM, même logique popup.js).
    const popup = await context.newPage();
    await popup.goto(popupUrl);
    await expect(popup.locator('#caqr-toggle')).not.toBeChecked(); // défaut = false
    await popup.locator('#caqr-toggle').check();

    // Injection automatique (storage.onChanged → service worker → executeScript).
    await fixture.waitForSelector('.caqr-badge', { timeout: 20_000 });
    await expect(fixture.locator('.caqr-badge')).toHaveCount(3);
    await expect(fixture.locator('a.caqr-badge')).toHaveCount(2); // http + https
    const info = fixture.locator('span.caqr-badge--text');
    await expect(info).toHaveCount(1);
    await expect(info).toHaveAttribute('aria-disabled', 'true');

    // Clic badge http → un onglet http://example.com/ s'ouvre (expect.poll).
    await fixture.locator('a.caqr-badge[href^="http://example.com"]').click();
    await expect.poll(
      () => Promise.all(context.pages().map((p) => p.url())),
      { timeout: 15_000 }
    ).toContain('http://example.com/');

    // Clic badge https → https://example.com/secure s'ouvre dans un 2e onglet.
    await fixture.locator('a.caqr-badge[href^="https://example.com"]').click();
    await expect.poll(
      () => Promise.all(context.pages().map((p) => p.url())),
      { timeout: 15_000 }
    ).toContain('https://example.com/secure');

    // Le badge non-URL n'ouvre rien : les URLs ouvertes restent exactement celles-là.
    await info.click();
    await expect.poll(() => context.pages().filter((p) => /example\.com/.test(p.url())).length)
      .toBe(2);

    await popup.close();
  });

  test('C — toggle OFF : tous les overlays sont démontés', async () => {
    const popup = await context.newPage();
    await popup.goto(popupUrl);
    await popup.locator('#caqr-toggle').uncheck();

    const fixture = await context.newPage();
    await fixture.goto(FIXTURE_URL, { waitUntil: 'load' });
    await expect(fixture.locator('.caqr-badge')).toHaveCount(0);
    await popup.close();
    await fixture.close();
  });

  test('D — re-ON puis navigation : ré-injection automatique tant que ON', async () => {
    const popup = await context.newPage();
    await popup.goto(popupUrl);
    await popup.locator('#caqr-toggle').check();

    const fixture = await context.newPage();
    await fixture.goto(FIXTURE_URL, { waitUntil: 'load' });
    await fixture.waitForSelector('.caqr-badge', { timeout: 20_000 });
    await expect(fixture.locator('.caqr-badge')).toHaveCount(3);

    await fixture.reload({ waitUntil: 'load' }); // navigation complète → onUpdated
    await fixture.waitForSelector('.caqr-badge', { timeout: 20_000 });
    await expect(fixture.locator('.caqr-badge')).toHaveCount(3);

    await popup.close();
    await fixture.close();
  });
});
