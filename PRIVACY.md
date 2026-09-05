# Politique de confidentialité / Privacy Policy — Click All QR

**FR** — Click All QR n'a pas de serveur, pas de compte, pas d'analytique.

1. **Données collectées : aucune.** L'extension ne collecte, n'enregistre et ne transmet aucune donnée personnelle, aucune donnée de navigation, et aucun contenu de page.
2. **Traitement local :** les images des pages visitées sont analysées dans votre navigateur uniquement, via l'API native `BarcodeDetector` (aucune librairie tierce embarquée), afin d'y détecter des QR codes. Ce traitement ne quitte jamais votre appareil.
3. **Requêtes réseau :** pour contourner les restrictions de lecture des images cross-origin, l'extension peut retélécharger une image déjà affichée par la page, sans cookies (`credentials: omit`). Aucune requête n'est envoyée à un serveur tiers appartenant à l'éditeur.
4. **Permissions & cycle de vie :** l'extension est **désactivée par défaut** — tant que le toggle est OFF, rien n'est injecté dans les pages et rien n'est lu. Armée pour une session, elle utilise : `storage` (mémorise uniquement l'état ON/OFF du toggle, effacé à la fermeture du navigateur), `activeTab` + `scripting` (injection du détecteur), et l'accès aux pages web exclusivement pour la détection locale de QR codes. Elle n'accède ni à votre historique, ni à vos identifiants.
5. **Liens ouverts :** les QR encodant une URL http/https deviennent cliquables ; l'ouverture se fait dans un nouvel onglet avec les protections standard (`noopener noreferrer`). Les QR non-URL affichent un badge informatif et ne déclenchent aucune ouverture.
6. **Contact :** faci.life@outlook.com

**EN** — Click All QR has no server, no account, no analytics.

1. **Data collected: none.** The extension does not collect, store, or transmit any personal data, browsing data, or page content.
2. **Local processing:** images from visited pages are analyzed in your browser only, via the native `BarcodeDetector` API (no third-party library bundled), to detect QR codes in them. This processing never leaves your device.
3. **Network requests:** to work around cross-origin image reading restrictions, the extension may re-download an image already displayed by the page, without cookies (`credentials: omit`). No request is sent to any third-party server owned by the publisher.
4. **Permissions & lifecycle:** the extension is **off by default** — while the toggle is OFF, nothing is injected into pages and nothing is read. When armed for a session it uses: `storage` (remembers only the ON/OFF toggle state, reset when the browser closes), `activeTab` + `scripting` (detector injection), and web page access exclusively for local QR code detection. It does not access your history, tabs, or credentials.
5. **Opened links:** QR codes encoding an http/https URL become clickable; opening happens in a new tab with standard protections (`noopener noreferrer`). Non-URL QR codes show an info badge and never trigger any navigation.
6. **Contact:** faci.life@outlook.com

Dernière mise à jour / Last updated : 2026-09-06
