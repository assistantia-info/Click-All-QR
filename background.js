// Click All QR v0.2.0 — service worker (orchestration + pont CORS images)
//
// Rôles :
//   1. ORCHESTRATION DU TOGGLE — source de vérité : chrome.storage.local "enabled".
//      - ON  : injection de content.js + overlay.css sur les onglets éligibles,
//              puis ré-injection à chaque navigation complète tant que c'est ON.
//      - OFF : diffusion de caqr-disable → le content script se démonte partout.
//      - Démarrage du navigateur / (ré)installation : enabled = false.
//        L'utilisateur arme l'extension volontairement À CHAQUE SESSION —
//        par défaut, plus rien n'est injecté nulle part.
//   2. PONT CORS — un content script ne peut pas lire les pixels d'une image
//      cross-origin (canvas « tainted ») ; le service worker, couvert par les
//      host_permissions, rapatrie les octets sans cookies (cache navigateur réutilisé).

const CONTENT_JS = 'content.js';
const OVERLAY_CSS = 'overlay.css';

// ---------------------------------------------------------------- état du toggle
async function isEnabled() {
  const { enabled } = await chrome.storage.local.get({ enabled: false });
  return !!enabled;
}

// ---------------------------------------------------------------- injection
async function injectTab(tabId) {
  try {
    await chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, files: [OVERLAY_CSS] });
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: [CONTENT_JS] });
    return true;
  } catch (_) {
    return false; // chrome://, edge://, webstore, onglet fermé… : silencieux
  }
}

async function eligibleTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs.filter((t) => /^(https?|file):/i.test(t.url || ''));
}

// ON : couvre tous les onglets déjà ouverts (l'utilisateur peut armer depuis n'importe où).
async function injectAllTabs() {
  const tabs = await eligibleTabs();
  await Promise.allSettled(tabs.map((t) => injectTab(t.id)));
}

// OFF : le content script se démonte lui-même en recevant caqr-disable.
async function broadcastDisable() {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(
    tabs.map((t) => chrome.tabs.sendMessage(t.id, { type: 'caqr-disable' }).catch(() => {}))
  );
}

// ---------------------------------------------------------------- événements
chrome.runtime.onInstalled.addListener(() => chrome.storage.local.set({ enabled: false }));
chrome.runtime.onStartup.addListener(() => chrome.storage.local.set({ enabled: false }));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !('enabled' in changes)) return;
  if (changes.enabled.newValue) injectAllTabs();
  else broadcastDisable();
});

// Ré-injection aux navigations complètes tant que le toggle est ON.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status !== 'complete') return;
  isEnabled().then((on) => { if (on) injectTab(tabId); });
});

// ---------------------------------------------------------------- messagerie
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'fetch-image' && typeof msg.url === 'string') {
    fetchImage(msg.url).then(sendResponse);
    return true; // réponse asynchrone
  }
  return undefined;
});

// Pont CORS : rapatrie les octets d'une image http(s) pour le décodage local.
async function fetchImage(url) {
  try {
    if (!/^https?:\/\//i.test(url)) throw new Error('scheme non autorisé');
    const resp = await fetch(url, { credentials: 'omit', redirect: 'follow' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const buffer = await resp.arrayBuffer();
    if (buffer.byteLength > 20 * 1024 * 1024) throw new Error('image trop volumineuse');
    // Transport base64 : la messagerie d'extension ne conserve pas toujours
    // l'ArrayBuffer via structured clone selon les versions.
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return { ok: true, b64: btoa(binary), contentType: resp.headers.get('content-type') || '' };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}
