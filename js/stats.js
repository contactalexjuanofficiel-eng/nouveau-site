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
  // D'où vient le visiteur : paramètre utm_source d'un lien, sinon la page précédente.
  const SITES = [
    [/(^|\.)(mail\.google\.com|outlook\.|mail\.yahoo\.|mail\.)/, 'email'],
    [/(^|\.)google\./, 'google'], [/(^|\.)bing\.com$/, 'bing'],
    [/(^|\.)(yahoo|duckduckgo|ecosia|qwant|startpage|yandex|brave)\./, 'autre-moteur'],
    [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, 'facebook'], [/(^|\.)instagram\.com$/, 'instagram'],
    [/(^|\.)tiktok\.com$/, 'tiktok'], [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'linkedin'],
    [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'], [/(^|\.)(twitter\.com|x\.com|t\.co)$/, 'x'],
    [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp'], [/(^|\.)pinterest\./, 'pinterest'], [/(^|\.)snapchat\.com$/, 'snapchat'],
  ];
  const UTM = ['google', 'bing', 'facebook', 'instagram', 'tiktok', 'linkedin', 'youtube', 'x', 'whatsapp', 'pinterest', 'snapchat', 'email'];
  function source() {
    const utm = (new URLSearchParams(location.search).get('utm_source') || '').toLowerCase();
    if (utm) {
      if (UTM.includes(utm)) return utm;
      if (utm === 'fb' || utm === 'meta') return 'facebook';
      if (utm === 'ig') return 'instagram';
      if (utm === 'newsletter' || utm === 'mail') return 'email';
    }
    if (!document.referrer) return 'direct';
    let hote = '';
    try {
      hote = new URL(document.referrer).hostname.toLowerCase();
    } catch (e) {
      return 'direct';
    }
    if (hote === location.hostname) return 'interne';
    const trouve = SITES.find(([motif]) => motif.test(hote));
    return trouve ? trouve[1] : 'autre-site';
  }
  function appareil() {
    const ua = navigator.userAgent;
    if (/iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablette';
    if (/Mobi|iPhone|iPod|Android/i.test(ua)) return 'mobile';
    return 'ordinateur';
  }

  fetch(cfg.supabaseUrl + '/rest/v1/rpc/compter_visite', {
    method: 'POST',
    keepalive: true,
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p: page, s: source(), a: appareil() }),
  }).catch(() => {});
})();
