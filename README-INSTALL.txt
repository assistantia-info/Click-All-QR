CLICK ALL QR v0.2.0 — Installation (2 minutes, zéro compte, zéro hébergement)
==============================================================================

1. Dézipper ce dossier où tu veux le garder (ex. Documents\extensions\click-all-qr).
2. Ouvrir Chrome et aller sur :  chrome://extensions
3. Activer l'interrupteur « Mode développeur » (en haut à droite).
4. Cliquer « Charger l'extension non empaquetée »… et sélectionner le dossier
   dézippé (celui qui contient manifest.json).
5. Cliquer l'icône Click All QR dans la barre d'outils et basculer l'interrupteur
   sur ON. Va sur une page contenant un QR code encodant une URL (visuel Instagram,
   article, affiche…) : un petit badge sombre apparaît en haut à droite du QR.
   Un clic ouvre le lien dans un nouvel onglet.

Notes
-----
- L'extension est DÉSACTIVÉE par défaut : rien n'est injecté sur les pages tant
  que le toggle est OFF, et il repasse OFF à chaque redémarrage du navigateur.
- Les QR non-URL (wifi, vCard, texte…) affichent un badge « TXT » informatif,
  volontairement non cliquable.
- Navigateurs : Chrome/Edge 92+ (API BarcodeDetector native). Sans cette API,
  un bandeau « QR API non supportée » s'affiche — aucune librairie externe
  n'est jamais téléchargée.
- Désactivation instantanée : icône de la barre d'outils → toggle OFF
  (ou chrome://extensions → interrupteur « Click All QR »).
- Mise à jour : remplacer le dossier puis bouton « ↻ » (Recharger) sur la fiche.

Fichiers
--------
manifest.json   : MV3 — permissions minimales (storage, activeTab, scripting),
                  aucun content script déclaré, aucune donnée collectée
background.js   : service worker — orchestration du toggle + pont CORS des images
content.js      : détection/décodage BarcodeDetector natif + cache LRU (20 / 5 s)
popup.html/.js/.css : interrupteur ON/OFF persisté par session (storage.local)
overlay.css     : style des badges et du bandeau
icons/          : icônes de la fiche extension
tests/e2e/      : tests Playwright (hors de l'extension, ignorés par Chrome)

Contact : faci.life@outlook.com
