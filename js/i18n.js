/*
 * Langue du site : bouton 🌐 et traduction des textes marqués data-i18n.
 *
 * Le français est le texte d'origine de la page ; les autres langues sont
 * chargées à la demande depuis js/langues/<code>.js. Une clé absente d'une
 * traduction garde le texte français. Le choix est mémorisé sur l'appareil.
 * Les devis et factures restent toujours en français (obligation légale).
 */
const I18n = (() => {
  const LANGUES = [
    ['fr', 'Français'], ['en', 'English'], ['es', 'Español'], ['pt', 'Português'], ['it', 'Italiano'],
    ['de', 'Deutsch'], ['ar', 'العربية'], ['tr', 'Türkçe'], ['ro', 'Română'], ['pl', 'Polski'],
  ];
  const LOCALES = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', pt: 'pt-PT', it: 'it-IT', de: 'de-DE', ar: 'ar', tr: 'tr-TR', ro: 'ro-RO', pl: 'pl-PL' };
  const CODES = new Set(LANGUES.map(([c]) => c));
  const STOCKAGE = 'devizo-langue';
  const VERSION = '?v=40';
  window.DEVIZO_TRAD = window.DEVIZO_TRAD || {};

  const originaux = new Map(); // élément -> HTML français
  const ecouteurs = [];
  let langue = 'fr';

  function auDepart() {
    try {
      const memo = localStorage.getItem(STOCKAGE);
      if (CODES.has(memo)) return memo;
    } catch (e) {
      // stockage indisponible : langue du navigateur
    }
    // Les robots des moteurs de recherche (Google…) voient toujours la page en français.
    if (navigator.webdriver || /bot|crawl|spider|slurp|google|bing|yandex|baidu|duckduck|facebookexternalhit|lighthouse|headless/i.test(navigator.userAgent)) return 'fr';
    const nav = (navigator.languages || [navigator.language || 'fr']).map((l) => String(l).slice(0, 2).toLowerCase());
    return nav.find((c) => CODES.has(c)) || 'fr';
  }

  function charger(code) {
    if (code === 'fr' || window.DEVIZO_TRAD[code]) return Promise.resolve();
    return new Promise((ok) => {
      const s = document.createElement('script');
      s.src = `js/langues/${code}.js${VERSION}`;
      s.onload = ok;
      s.onerror = ok; // sans réseau : on reste sur le texte français
      document.head.appendChild(s);
    });
  }

  function t(cle, francais) {
    const dico = window.DEVIZO_TRAD[langue];
    return (dico && dico[cle]) ?? francais;
  }

  function appliquer() {
    const dico = langue === 'fr' ? null : window.DEVIZO_TRAD[langue];
    document.documentElement.lang = langue;
    document.documentElement.dir = langue === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      if (!originaux.has(el)) originaux.set(el, el.innerHTML);
      const texte = dico?.[el.dataset.i18n];
      el.innerHTML = texte ?? originaux.get(el);
    });
    const code = document.querySelector('.l-langue-code');
    if (code) code.textContent = langue.toUpperCase();
    document.querySelectorAll('.l-langue-liste button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.langue === langue)));
    ecouteurs.forEach((f) => f(langue));
  }

  async function choisir(code) {
    if (!CODES.has(code)) return;
    await charger(code);
    langue = window.DEVIZO_TRAD[code] || code === 'fr' ? code : 'fr';
    try {
      localStorage.setItem(STOCKAGE, langue);
    } catch (e) {
      // choix non mémorisé, sans gravité
    }
    appliquer();
  }

  function monterSelecteur() {
    const details = document.getElementById('langue');
    if (!details) return;
    const liste = details.querySelector('.l-langue-liste');
    liste.innerHTML = LANGUES.map(([code, nom]) =>
      `<li><button type="button" lang="${code}" data-langue="${code}" aria-current="${code === langue}">${nom}</button></li>`).join('');
    liste.addEventListener('click', (e) => {
      const b = e.target.closest('[data-langue]');
      if (!b) return;
      details.open = false;
      choisir(b.dataset.langue);
    });
    document.addEventListener('click', (e) => {
      if (details.open && !details.contains(e.target)) details.open = false;
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && details.open) {
        details.open = false;
        details.querySelector('summary').focus();
      }
    });
  }

  langue = auDepart();
  monterSelecteur();
  if (langue !== 'fr') choisir(langue);

  return {
    t,
    choisir,
    langue: () => langue,
    locale: () => LOCALES[langue],
    surChangement: (f) => ecouteurs.push(f),
  };
})();
