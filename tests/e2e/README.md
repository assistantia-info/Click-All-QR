# Click All QR — tests end-to-end (Playwright)

Tests de bout en bout sur un **vrai Chromium** chargé avec l'extension
non empaquetée (`--load-extension`). Ils couvrent le cycle de vie complet :

| Test | Scénario |
|------|----------|
| A | Extension désactivée par défaut → **aucun** badge sur la fixture |
| B | Toggle ON via le vrai popup → 3 overlays (2 liens + 1 info non-URL), clics, `expect.poll` sur les onglets ouverts |
| C | Toggle OFF → tous les overlays démontés (message `caqr-disable`) |
| D | Re-ON + reload → ré-injection automatique tant que le toggle est ON |

## Lancer les tests

```bash
cd tests/e2e
npm install
npx playwright install chromium
npx playwright test
```

Sur un serveur CI Linux sans affichage (les extensions exigent un navigateur
fenêtré) :

```bash
xvfb-run npx playwright test
```

## Fixtures

`fixtures/page.html` contient 3 QR codes autonomes (data URIs, aucun réseau
externe) : `http://example.com/`, `https://example.com/secure` et
`hello world` (QR valide mais non-URL — doit produire un badge informatif
non cliquable). La page est servie sur `http://127.0.0.1:8791` par le
`webServer` de la config (un simple `python -m http.server`).
