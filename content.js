// QR cliquable — content script MV3
// Détection des QR codes encodant une URL dans la page + badge cliquable.
// V1 : <img>, <canvas> same-origin, <video poster>, background-image (passée throttlée).
// Décodage : BarcodeDetector natif si disponible, sinon jsQR (vendored).

(() => {
  if (window.__qrCliquableActif) return;
  window.__qrCliquableActif = true;

  // ---------------- constantes ----------------
  const MIN_SIDE = 110;        // côté min (px CSS x DPR) pour qu'un QR soit plausible
  const MAX_SIDE = 1600;       // on réduit les très grandes images avant décodage
  const UPSCALE = 2;           // upscale x2 des petites images (jsQR aime les modules nets)
  const BATCH = 4;             // décodages simultanés
  const DEBOUNCE_MS = 250;     // après une mutation
  const RESCAN_MS = 4000;      // re-scan périodique (skip les déjà vus)
  const BG_SLICE = 600;        // éléments background-image examinés par tranche idle
  const URL_RE = /^https?:\/\//i;

  const seen = new Map();      // clé candidat -> 'pending' | 'noqr' | url
  const queue = [];
  let active = 0;
  let bgCursor = 0;            // curseur de la passe background-image

  // ---------------- décodeur ----------------
  let detector = null;
  if ('BarcodeDetector' in window) {
    try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (_) {}
  }
  const jsQR = typeof window.jsQR === 'function' ? window.jsQR : null;
  if (!detector && !jsQR) return; // rien pour décoder : extension inerte

  // ---------------- couche overlay ----------------
  const layer = document.createElement('div');
  layer.id = 'qr-cliquable-layer';
  const SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
    '<path fill="currentColor" d="M4 4h6v6H4V4zm2 2v2h2V6H6zm8-2h6v6h-6V4zm2 2v2h2V6h-2zM4 14h6v6H4v-6zm2 2v2h2v-2H6zM14 14h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v2h-2v-2zm-2-2h2v2h-2v-2z"/></svg>';
  (document.body || document.documentElement).appendChild(layer);

  function placeBadges() {
    for (const el of document.querySelectorAll('.qr-cliquable-host')) {
      const badge = el.__qrBadge;
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
    requestAnimationFrame(() => {}); // point d'ancrage rAF (coût nul)
  }

  let placeScheduled = false;
  function schedulePlace() {
    if (placeScheduled) return;
    placeScheduled = true;
    requestAnimationFrame(() => { placeScheduled = false; placeBadges(); });
  }
  addEventListener('scroll', schedulePlace, { passive: true, capture: true });
  addEventListener('resize', schedulePlace, { passive: true });

  function attachBadge(el, url) {
    el.classList.add('qr-cliquable-host');
    if (el.__qrBadge) { el.__qrBadge.href = url; el.__qrBadge.title = url; return; }
    const a = document.createElement('a');
    a.className = 'qr-cliquable-badge';
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = url;
    a.setAttribute('aria-label', 'Ouvrir le lien du QR code');
    a.innerHTML = SVG; // SVG statique, jamais de contenu de la page
    layer.appendChild(a);
    el.__qrBadge = a;
    schedulePlace();
  }

  // ---------------- collecte des candidats ----------------
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
      if (p && URL_RE.test(p) || p && p.startsWith('data:')) out.push({ el: v, kind: 'url', url: p });
    }
    return out;
  }

  // Passe background-image : coûteuse, donc tranchée en tranches via requestIdleCallback.
  const allEls = () => document.querySelectorAll('body *');
  function bgSlice(deadline) {
    const els = allEls();
    const end = Math.min(bgCursor + BG_SLICE, els.length);
    for (; bgCursor < end; bgCursor++) {
      const el = els[bgCursor];
      if (el.__qrCheckedBg) continue;
      el.__qrCheckedBg = true; // marqueur léger, survit entre les passes
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

  // ---------------- décodage ----------------
  async function bitmapFor(item) {
    if (item.kind === 'url') {
      let blob;
      if (item.url.startsWith('data:')) {
        blob = await (await fetch(item.url)).blob();
      } else {
        const resp = await chrome.runtime.sendMessage({ type: 'fetch-image', url: item.url }).catch(() => null);
        if (!resp || !resp.ok) throw new Error(resp ? resp.error : 'SW indisponible');
        const bytes = Uint8Array.from(atob(resp.b64), (c) => c.charCodeAt(0));
        blob = new Blob([bytes], { type: resp.contentType || 'application/octet-stream' });
      }
      return createImageBitmap(blob);
    }
    // canvas same-origin : dessin direct vers un bitmap propre
    return createImageBitmap(item.el);
  }

  async function decodeOne(item) {
    const bmp = await bitmapFor(item);
    try {
      let w = bmp.width, h = bmp.height;
      if (w < MIN_SIDE || h < MIN_SIDE) throw new Error('trop petit après chargement');
      let scale = 1;
      if (Math.max(w, h) > MAX_SIDE) scale = MAX_SIDE / Math.max(w, h);
      else if (Math.min(w, h) < 180) scale = UPSCALE;
      const cw = Math.round(w * scale), ch = Math.round(h * scale);
      const canvas = new OffscreenCanvas(cw, ch);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0, cw, ch);
      let res = null;
      if (detector) {
        const codes = await detector.detect(canvas);
        if (codes.length) res = codes[0].rawValue;
      }
      if (!res && jsQR) {
        const data = ctx.getImageData(0, 0, cw, ch);
        const out = jsQR(data.data, cw, ch, { inversionAttempts: 'dontInvert' });
        res = out && out.data;
      }
      return URL_RE.test(res || '') ? res : null;
    } finally {
      bmp.close && bmp.close();
    }
  }

  function keyOf(item) {
    return item.kind === 'url' ? 'u:' + item.url : 'c:' + (item.el.dataset.__qrKey ||
      (item.el.dataset.__qrKey = 'c' + Math.random().toString(36).slice(2)));
  }

  function pump() {
    while (active < BATCH && queue.length) {
      const item = queue.shift();
      const key = keyOf(item);
      if (seen.get(key) === 'pending') continue;
      seen.set(key, 'pending');
      active++;
      decodeOne(item)
        .then((url) => {
          if (url) { seen.set(key, url); attachBadge(item.el, url); }
          else seen.set(key, 'noqr');
        })
        .catch((e) => {
          seen.set(key, 'noqr');
          layer.dataset.lastError = String((e && e.message) || e).slice(0, 200);
        })
        .finally(() => { active--; pump(); });
    }
  }

  function scanPass() {
    const fresh = collectMedia().filter((it) => {
      const k = keyOf(it);
      return !seen.has(k);
    });
    if (fresh.length) { queue.push(...fresh); pump(); }
    startBgPass();
  }

  // ---------------- orchestration ----------------
  let t = null;
  const mo = new MutationObserver(() => {
    clearTimeout(t);
    t = setTimeout(scanPass, DEBOUNCE_MS);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(scanPass, RESCAN_MS);

  scanPass();
})();
