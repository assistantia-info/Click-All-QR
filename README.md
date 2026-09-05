<div align="center">

# Click All QR

**Make every QR code on a web page clickable — one click, the link opens.**
**Rends chaque QR code d'une page web cliquable — un clic, le lien s'ouvre.**

100% local · No ads · No account · 100 % local · Sans pub · Sans compte

[Chrome Web Store *(à venir)*](#-install) · [Edge Add-ons *(à venir)*](#-install) · [Firefox Add-ons *(à venir)*](#-install) · [Manual install / Installation manuelle / 手动安装](#-manual-install--installation-manuelle--手动安装)

</div>

---

## English

### The problem

A QR code shows up **on your own screen** — in a screenshot someone sent you, a story, a ticket, an article. You can't scan it: the code is already on the device in your hand. So you take screenshots, send things to yourself, or open Lens in four clumsy steps.

### The fix

**Click All QR** detects QR codes on any web page and drops a small badge on each one. Click the badge → the link opens in a new tab. That's it.

- 🔒 **100% local** — detection and decoding happen in your browser, via the native `BarcodeDetector` API. No image is ever uploaded. No server exists. **No bundled library.**
- 🚫 **No ads, no account, no telemetry** — nothing is collected, nothing is tracked, ever.
- 🎚 **Off by default** — nothing is injected into any page until *you* arm it from the toolbar. One click ON for the whole session; it resets to OFF when you close your browser. [Privacy policy →](PRIVACY.md)
- 👁 **See before you go** — the target URL shows on hover. QR phishing ("quishing") doesn't work here. Non-URL QR codes (Wi-Fi, vCard…) get a non-clickable info badge.
- 🪶 **Lightweight** — ~20 KB of commented code, zero third-party library, LRU-cached decoding that never decodes the same image twice within 5 seconds.
- 📱 **Works on Chromium 92+** (Chrome, Edge, Brave, Opera…) including mobile Chromium browsers with extension support (Edge for Android). Firefox shows a discreet "QR API not supported" notice — the native API it would need does not exist there yet.

### What v0.2.0 does not do (on purpose)

- Non-URL QR codes are shown as an info badge but never opened — only `http/https` links open.
- PDFs opened in the browser's built-in PDF viewer are not covered yet (planned).

### Why the "read all sites" permission

The extension reads images from the pages you visit **to detect QR codes in them, locally** — cross-origin pixels are only readable through the extension's own service worker. That's the whole story. No access to your history, tabs, or credentials. Audit path: 5 commented source files, no third-party library at all, nothing injected while OFF. [Privacy policy →](PRIVACY.md)

### 🔧 Manual install — Installation manuelle — 手动安装

<details>
<summary><b>English — install from source (Chrome, Edge, Brave, any Chromium)</b></summary>

1. Download the latest zip from [Releases](../../releases) and unzip it.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder.
5. Click the **Click All QR** toolbar icon and switch it **ON** — QR badges appear on pages. It resets to OFF next time you start the browser.

</details>

<details>
<summary><b>Français — installation manuelle (Chrome, Edge, Brave, tout navigateur Chromium)</b></summary>

1. Télécharger le zip depuis [Releases](../../releases) et le dézipper.
2. Ouvrir `chrome://extensions` (ou `edge://extensions`).
3. Activer le **Mode développeur** (en haut à droite).
4. Cliquer **Charger l'extension non empaquetée** et sélectionner le dossier dézippé.
5. Cliquer l'icône **Click All QR** dans la barre d'outils et basculer sur **ON** — les badges apparaissent. Le toggle repasse OFF au prochain démarrage du navigateur.

</details>

<details>
<summary><b>中文 — 手动安装（Chrome、Edge 等 Chromium 浏览器）</b></summary>

1. 从 [Releases](../../releases) 下载最新的 zip 并解压。
2. 打开 `chrome://extensions`（或 `edge://extensions`）。
3. 打开右上角的**开发者模式**。
4. 点击**加载已解压的扩展程序**，选择解压后的文件夹。
5. 安装完成 — 访问任何包含二维码的网页，点击徽章即可打开链接。

> 说明：Chrome 应用商店在中国大陆无法直接访问；Edge 加载项商店可正常访问。本扩展完全在本地运行，不上传任何数据。

</details>

### 🗺 Roadmap

- [x] v0.2.0 — session toggle (ON/OFF), native decoding only, LRU cache, e2e tests
- [ ] v1.1 — per-site pause
- [ ] V2 — PDF viewer support
- [ ] V2 — rich safe preview for non-URL QR content (Wi-Fi, vCard)
- [ ] Pro (2,99 € one-time) — history, batch decode, quishing check — *only if 10k+ users*

### 📄 License

MIT © 2026 — contact: faci.life@outlook.com

---

## Français

### Le problème

Un QR code s'affiche **sur ton propre écran** — dans une capture reçue, une story, un billet, un article. Impossible de le scanner : le code est déjà sur l'appareil que tu as en main. Résultat : captures d'écran, envois à soi-même, Lens en quatre étapes pénibles.

### La solution

**Click All QR** détecte les QR codes de n'importe quelle page web et pose un petit badge sur chacun. Clique le badge → le lien s'ouvre dans un nouvel onglet. C'est tout.

- 🔒 **100 % local** — détection et décodage dans ton navigateur, via l'API native `BarcodeDetector`. Aucune image envoyée. Aucun serveur, il n'y en a pas. **Aucune librairie embarquée.**
- 🚫 **Sans pub, sans compte, sans télémétrie** — rien n'est collecté, jamais.
- 🎚 **Désactivée par défaut** — rien n'est injecté dans les pages tant que tu n'as pas armé l'extension depuis la barre d'outils. Un clic ON pour toute la session ; retour à OFF à la fermeture du navigateur. [Politique de confidentialité →](PRIVACY.md)
- 👁 **Voir avant d'ouvrir** — l'URL cible s'affiche au survol. Le quishing ne passe pas ici. Les QR non-URL (Wi-Fi, vCard…) affichent un badge informatif non cliquable.
- 🪶 **Léger** — ~20 Ko de code commenté, zéro librairie tierce, cache LRU qui ne redécode jamais la même image en moins de 5 secondes.
- 📱 **Marche sur tout navigateur Chromium 92+** (Chrome, Edge, Brave, Opera…) y compris les navigateurs mobiles à extensions (Edge Android). Firefox affiche un bandeau discret « QR API non supportée » — l'API native nécessaire n'y existe pas encore.

### Ce que la v0.2.0 ne fait pas (à dessein)

- Les QR non-URL s'affichent en badge informatif mais ne s'ouvrent jamais — seuls les liens `http/https` s'ouvrent.
- Les PDF ouverts dans le lecteur intégré du navigateur ne sont pas couverts (prévu).

### Pourquoi la permission « lire tous les sites »

L'extension lit les images des pages visitées **pour y détecter des QR codes, localement** — les pixels cross-origin ne sont lisibles que via le service worker de l'extension. C'est tout. Pas d'accès à ton historique, tes onglets ou tes identifiants. Chemin d'audit complet : 5 fichiers source commentés, aucune librairie tierce, rien d'injecté tant que le toggle est OFF. [Politique de confidentialité →](PRIVACY.md)

---

<div align="center">

**Click All QR** — the QR on your screen, finally clickable. · *Le QR sur ton écran, enfin cliquable.*

</div>
