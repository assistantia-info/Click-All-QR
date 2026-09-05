// Click All QR v0.2.0 — content script (injecté à la demande via chrome.scripting)
//
// Détection 100 % locale des QR codes encodant une URL, badge cliquable au-dessus.
// v0.2.0 « production grade » :
//   - BarcodeDetector NATIF uniquement — plus aucune librairie embarquée (jsQR retiré).
//     Sans l'API (Chrome/Edge < 92, Firefox), un bandeau discret l'indique et l'extension
//     reste inerte : zéro téléchargement, zéro fallback.
//   - Cache LRU des résultats de décodage : clé = CRC32 des premières lignes de pixels
//     (empreinte rapide de l'image), 20 entrées max, TTL 5 s. Une image identique
//     réapparue dans les 5 s (SPA, réordonnancement DOM) n'est jamais re-décodée.
//   - Cycle de vie : injecté seulement quand le toggle est ON ; se DÉMONTE
//     intégralement (observer, timers, overlays, marqueurs) quand il repasse OFF,
//     via le message caqr-disable diffusé par le service worker.
//   - Les QR non-URL (Wi-Fi, vCard, texte…) affichent un badge informatif non
//     cliquable — transparent sans rien ouvrir (V2 en fera un aperçu riche).

(() => {
  'use strict';

  if (window.__caqrActive) return; // garde d'idempotence (allFrames → une IIFE par frame)
  window.__caqrActive = true;

  // ---------------------------------------------------------------- constantes
  const MIN_SIDE = 110;        // côté min (px natifs) pour qu'un QR soit plausible
  const MAX_SIDE = 1600;       // réduction des très grandes images avant décodage
  const UPSCALE = 2;           // upscale x2 des petites images (modules plus nets)
  const BATCH = 4;             // décodages simultanés
  const DEBOUNCE_MS = 250;     // après une mutation DOM
  const RESCAN_MS = 4000;      // re-scan périodique (les éléments vus sont skippés)
  const BG_SLICE = 600;        // éléments background-image examinés par tranche idle
  const CACHE_MAX = 20;        // LRU : entrées max
  const CACHE_TTL_MS = 5000;   // LRU : durée de vie d'une entrée
  const HASH_ROWS = 16;        // LRU : lignes de pixels hachées (haut de l'image)
  const URL_RE = /^https?:\/\//i;

  // ---------------------------------------------------------------- CRC32 (clé du cache)
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // ---------------------------------------------------------------- cache LRU + état
  // cache : clé d'empreinte -> { value: {kind, value}|null, at: Date.now() }
  const cache = new Map();
  // seen : clé par ÉLÉMENT -> 'pending' | 'noqr' | résultat (évite les re-scans)
  const seen = new Map();
  const queue = [];
  let active = 0;
  let bgCursor = 0;
  // orchestration (hoistés : teardown doit rester sûr même en cas de sortie précoce)
  let mo = null;
  let reScanTimer = 0;
  let debounceTimer = 0;

  function cacheGet(key) {
    const hit = cache.get(key);
    if (!hit) return undefined; // MISS (null = HIT « aucun QR ici »)
    if (Date.now() - hit.at > CACHE_TTL_MS) { cache.delete(key); return undefined; } // TTL expiré
    cache.delete(key); cache.set(key, hit); // rafraîchit la position LRU
    return hit.value;
  }

  function cacheSet(key, value) {
    cache.delete(key); // réinsertion en fin = position LRU la plus récente
    cache.set(key, { value, at: Date.now() });
    if (cache.size > CACHE_MAX) {
      cache.delete(cache.keys().next().value); // éviction de la plus ancienne entrée
    }
  }

  // ---------------------------------------------------------------- couche overlay
  const layer = document.createElement('div');
  layer.id = 'caqr-layer';
  (document.body || document.documentElement).appendChild(layer);

  const SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
    '<path fill="currentColor" d="M4 4h6v6H4V4zm2 2v2h2V6H6zm8-2h6v6h-6V4zm2 2v2h2V6h-2zM4 14h6v6H4v-6zm2 2v2h2v-2H6zM14 14h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v2h-2v-2zm-2-2h2v2h-2v-2z"/></svg>';

  function placeBadges() {
    for (const el of document.querySelectorAll('.caqr-host')) {
      const badge = el.__caqrBadge;
      if (!badge) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 40 || r.bottom < 0 || r.top > innerHeight ||
          r.right < 0 || r.left > innerWidth) {
        badge.style.display = 'none';
        continue;
      }
      badge.style.display = '';
      const size = 26;
      const left = Math.min(Math.max(r.right - size - 4, 4), innerWidth - size - 4);
      const top = Math.min(Math.max(r.top + 4, 4), innerHeight - size - 4);
      badge.style.left = left + 'px';
      badge.style.top = top + 'px';
    }
  }

  let placeScheduled = false;
  function schedulePlace() {
    if (placeScheduled) return;
    placeScheduled = true;
    requestAnimationFrame(() => { placeScheduled = false; placeBadges(); });
  }
  addEventListener('scroll', schedulePlace, { passive: true, capture: true });
  addEventListener('resize', schedulePlace, { passive: true });

  function attachBadge(el, res) {
    el.classList.add('caqr-host');
    if (el.__caqrBadge) return;
    let badge;
    if (res.kind === 'url') {
      badge = document.createElement('a');
      badge.href = res.value;
      badge.target = '_blank';
      badge.rel = 'noopener noreferrer';
      badge.title = res.value;
      badge.setAttribute('aria-label', 'Open the link encoded in this QR code');
      badge.innerHTML = SVG; // SVG statique — jamais de contenu de la page
    } else { // QR non-URL : informatif, non cliquable
      badge = document.createElement('span');
      badge.className = 'caqr-badge caqr-badge--text';
      badge.title = 'QR content (not a link): ' + res.value.slice(0, 80);
      badge.setAttribute('aria-disabled', 'true');
      badge.textContent = 'TXT';
    }
    badge.classList.add('caqr-badge');
    layer.appendChild(badge);
    el.__caqrBadge = badge;
    schedulePlace();
  }

  // ---------------------------------------------------------------- démontage (toggle OFF)
  function teardown() {
    if (mo) mo.disconnect();
    clearInterval(reScanTimer); clearTimeout(debounceTimer);
    removeEventListener('scroll', schedulePlace, true);
    removeEventListener('resize', schedulePlace);
    layer.remove();
    for (const el of document.querySelectorAll('.caqr-host')) {
      delete el.__caqrBadge;
      el.classList.remove('caqr-host');
    }
    seen.clear(); cache.clear(); queue.length = 0; active = 0; bgCursor = 0;
    window.__caqrActive = false; // une prochaine injection repartira proprement
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'caqr-disable') teardown();
    // pas de réponse asynchrone → pas de return true
  });

  // ---------------------------------------------------------------- API native requise
  let detector = null;
  try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (_) {}

  if (!detector) {
    const note = document.createElement('div');
    note.className = 'caqr-unsupported';
    note.setAttribute('role', 'status');
    note.textContent = 'Click All QR — QR API non supportée / not supported';
    layer.appendChild(note);
    return; // inerte : aucune librairie n'est chargée, aucun réseau, rien
  }

  // ---------------------------------------------------------------- collecte des candidats
  function collectMedia() {
    const out = [];
    for (const img of document.images) {
      const side = Math.max(img.naturalWidth || 0, img.naturalHeight || 0);
      if (side < MIN_SIDE) continue;
      const src = img.currentSrc || img.src;
      if (src) out.push({ el: img, kind: 'url', url: src });
    }
    for (const c of document.querySelectorAll('canvas')) {
      if (c.width >= MIN_SIDE && c.height >= MIN_SIDE) out.push({ el: c, kind: 'canvas' });
    }
    for (const v of document.querySelectorAll('video[poster]')) {
      const p = v.poster;
      if (p && (URL_RE.test(p) || p.startsWith('data:'))) out.push({ el: v, kind: 'url', url: p });
    }
    return out;
  }

  // Passe background-image : coûteuse, tranchée en tranches via requestIdleCallback.
  const allEls = () => document.querySelectorAll('body *');
  function bgSlice() {
    const els = allEls();
    const end = Math.min(bgCursor + BG_SLICE, els.length);
    for (; bgCursor < end; bgCursor++) {
      const el = els[bgCursor];
      if (el.__caqrCheckedBg) continue;
      el.__caqrCheckedBg = true; // marqueur léger, survit entre les passes
      const cs = getComputedStyle(el);
      const bg = cs.backgroundImage || '';
      if (!bg.includes('url(')) continue;
      const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (!m) continue;
      const r = el.getBoundingClientRect();
      if (r.width < MIN_SIDE || r.height < MIN_SIDE) continue;
      const u = m[1];
      if (URL_RE.test(u) || u.startsWith('data:')) queue.push({ el, kind: 'url', url: u });
    }
    if (bgCursor < els.length) {
      (window.requestIdleCallback || ((f) => setTimeout(f, 60)))(bgSlice, { timeout: 800 });
    } else {
      bgCursor = 0; // passe suivante : seulement les nouveaux éléments (marqueurs)
    }
    pump(); // lancer le décodage de ce qui vient d'être empilé
  }
  function startBgPass() {
    if (bgCursor === 0) (window.requestIdleCallback || ((f) => setTimeout(f, 120)))(bgSlice, { timeout: 1500 });
  }

  // ---------------------------------------------------------------- décodage
  async function bitmapFor(item) {
    if (item.kind === 'url') {
      let blob;
      if (item.url.startsWith('data:')) {
        blob = await (await fetch(item.url)).blob();
      } else {
        // Image cross-origin : le canvas serait « tainted ». Le service worker
        // (host_permissions) rapatrie les octets sans cookies. 100 % local.
        const resp = await chrome.runtime.sendMessage({ type: 'fetch-image', url: item.url }).catch(() => null);
        if (!resp || !resp.ok) throw new Error(resp ? resp.error : 'service worker indisponible');
        const bytes = Uint8Array.from(atob(resp.b64), (c) => c.charCodeAt(0));
        blob = new Blob([bytes], { type: resp.contentType || 'application/octet-stream' });
      }
      return createImageBitmap(blob);
    }
    return createImageBitmap(item.el); // canvas same-origin
  }

  async function decodeOne(item) {
    const bmp = await bitmapFor(item);
    try {
      const w = bmp.width, h = bmp.height;
      if (w < MIN_SIDE || h < MIN_SIDE) return null;
      let scale = 1;
      if (Math.max(w, h) > MAX_SIDE) scale = MAX_SIDE / Math.max(w, h);
      else if (Math.min(w, h) < 180) scale = UPSCALE;
      const cw = Math.round(w * scale), ch = Math.round(h * scale);
      const canvas = new OffscreenCanvas(cw, ch);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0, cw, ch);

      // Empreinte rapide : dimensions + CRC32 des HASH_ROWS premières lignes.
      const strip = ctx.getImageData(0, 0, cw, Math.min(HASH_ROWS, ch));
      const key = cw + 'x' + ch + ':' + crc32(strip.data);

      const hit = cacheGet(key);
      if (hit !== undefined) return hit; // déjà décodée il y a < 5 s — zéro travail

      const codes = await detector.detect(canvas);
      let value = null;
      const urlCode = codes.find((c) => URL_RE.test(c.rawValue || ''));
      if (urlCode) value = { kind: 'url', value: urlCode.rawValue };
      else if (codes.length && (codes[0].rawValue || '').trim()) {
        value = { kind: 'text', value: codes[0].rawValue.trim() };
      }
      cacheSet(key, value);
      return value;
    } finally {
      if (bmp.close) bmp.close();
    }
  }

  function keyOf(item) {
    return item.kind === 'url'
      ? 'u:' + item.url
      : 'c:' + (item.el.dataset.__caqrKey || (item.el.dataset.__caqrKey = 'c' + Math.random().toString(36).slice(2)));
  }

  function pump() {
    while (active < BATCH && queue.length) {
      const item = queue.shift();
      const key = keyOf(item);
      if (seen.get(key) === 'pending') continue;
      seen.set(key, 'pending');
      active++;
      decodeOne(item)
        .then((res) => {
          if (res) { seen.set(key, res); attachBadge(item.el, res); }
          else seen.set(key, 'noqr');
        })
        .catch(() => { seen.set(key, 'noqr'); })
        .finally(() => { active--; pump(); });
    }
  }

  function scanPass() {
    const fresh = collectMedia().filter((it) => !seen.has(keyOf(it)));
    if (fresh.length) { queue.push(...fresh); pump(); }
    startBgPass();
  }

  // ---------------------------------------------------------------- orchestration
  mo = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanPass, DEBOUNCE_MS);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  reScanTimer = setInterval(scanPass, RESCAN_MS);
  scanPass();
})();
