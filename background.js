// QR cliquable — service worker MV3
// Rôle unique : contourner le CORS pour la lecture des images de la page.
// Un content script ne peut pas lire les pixels d'une image cross-origin (canvas
// "tainted") ; le service worker, lui, dispose de host_permissions <all_urls> et
// peut rapatrier les octets de l'image (le cache navigateur est réutilisé).

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'fetch-image' || typeof msg.url !== 'string') return;

  (async () => {
    try {
      // On n'accepte que http(s) — les data:/blob: sont traités côté page.
      if (!/^https?:\/\//i.test(msg.url)) throw new Error('scheme non autorisé');

      const resp = await fetch(msg.url, { credentials: 'omit', redirect: 'follow' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);

      const buffer = await resp.arrayBuffer();
      if (buffer.byteLength > 20 * 1024 * 1024) throw new Error('image trop volumineuse');

      // Transport base64 : la messagerie d'extension n'a pas toujours le
      // structured clone (ArrayBuffer perdu sinon).
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
      }
      sendResponse({
        ok: true,
        b64: btoa(binary),
        contentType: resp.headers.get('content-type') || ''
      });
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
  })();

  return true; // réponse asynchrone
});
