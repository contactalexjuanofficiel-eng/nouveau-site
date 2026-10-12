/*
 * Mesure d'audience sans cookie : compte une visite par page et par session
 * de navigation (aucune donnée personnelle, seulement un total par jour).
 */
(() => {
  const cfg = window.DEVIZO_CONFIG || {};
  const page = document.documentElement.dataset.page;
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !page || navigator.webdriver || window.DEVIZO_DEMO) return;
  if (/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) return;
  try {
    if (sessionStorage.getItem('devizo-vu-' + page)) return;
    sessionStorage.setItem('devizo-vu-' + page, '1');
  } catch (e) {
    // stockage indisponible : on compte quand même
  }
  fetch(cfg.supabaseUrl + '/rest/v1/rpc/compter_visite', {
    method: 'POST',
    keepalive: true,
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p: page }),
  }).catch(() => {});
})();
