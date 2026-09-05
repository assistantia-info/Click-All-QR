// Click All QR v0.2.0 — popup : toggle ON/OFF persisté dans chrome.storage.local.
// Source de vérité unique = la clé "enabled" (défaut : false) ; le service worker
// réagit à son changement (injection / démontage). Le popup n'envoie aucun message.

const toggle = document.getElementById('caqr-toggle');
const label = document.getElementById('caqr-label');
const hint = document.getElementById('caqr-hint');

function render(on) {
  toggle.checked = on;
  label.textContent = on ? 'On — QR codes clickable' : 'Off — QR codes ignored';
  label.classList.toggle('on', on);
  label.classList.toggle('off', !on);
  hint.textContent = on
    ? 'Active for this browsing session — it resets to Off when you close your browser.'
    : 'Turn on to make QR codes clickable on every page. Nothing is injected while Off.';
}

(async () => {
  const { enabled } = await chrome.storage.local.get({ enabled: false });
  render(!!enabled);
  document.getElementById('caqr-version').textContent = chrome.runtime.getManifest().version;

  toggle.addEventListener('change', () => {
    chrome.storage.local.set({ enabled: toggle.checked });
  });

  // Synchronisation si l'état change ailleurs (rare : autre popup, outils dev).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && 'enabled' in changes) render(!!changes.enabled.newValue);
  });
})();
