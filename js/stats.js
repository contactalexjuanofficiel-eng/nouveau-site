/*
 * Mesure d'audience sans cookie : compte une visite par page et par session
 * de navigation (aucune donnée personnelle, seulement un total par jour).
 */
(() => {
  const cfg = window.DEVIZO_CONFIG || {};
  const page = document.documentElement.dataset.page;
  let admin = false;
  try {
    admin = localStorage.getItem('devizo-admin') === '1'; // l'administrateur ne fausse pas les chiffres
  } catch (e) {
    // stockage indisponible
  }
  const actif = cfg.supabaseUrl && cfg.supabaseAnonKey && !navigator.webdriver && !window.DEVIZO_DEMO && !admin
    && !/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname);
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

  // Compte une page ou une étape du parcours d'inscription, une seule fois par session de navigation.
  function compter(p) {
    if (!actif || !p) return;
    try {
      if (sessionStorage.getItem('devizo-vu-' + p)) return;
      sessionStorage.setItem('devizo-vu-' + p, '1');
    } catch (e) {
      // stockage indisponible : on compte quand même
    }
    fetch(cfg.supabaseUrl + '/rest/v1/rpc/compter_visite', {
      method: 'POST',
      keepalive: true,
      headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey, 'Content-Type': 'application/json' },
      // Une étape (clic, formulaire) n'est pas une nouvelle arrivée : elle ne compte pas dans les provenances.
      body: JSON.stringify({ p, s: p === page ? source() : 'interne', a: appareil() }),
    }).catch(() => {});
  }
  window.devizoCompter = compter;
  (window.devizoEnAttente || []).forEach(compter);
  compter(page);

  // Clic sur un bouton « Essai gratuit » ou « Continuer avec Google » (page d'accueil, pages métiers…).
  document.addEventListener('click', (e) => {
    const lien = e.target instanceof Element && e.target.closest('a[href*="app.html#inscription"], a[href*="app.html#google"]');
    if (!lien) return;
    compter('clic-essai');
    if (lien.getAttribute('href').includes('#google')) compter('clic-google');
  }, true);
})();
