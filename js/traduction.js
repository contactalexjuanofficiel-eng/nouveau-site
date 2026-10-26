/*
 * Traduction de l'interface de l'appli (10 langues).
 *
 * L'appli est écrite en français. Si une autre langue est choisie (même choix
 * que sur la page d'accueil, mémorisé sur l'appareil), les textes affichés sont
 * remplacés à la volée à partir du dictionnaire js/langues/app-<code>.js :
 * textes exacts, ou modèles avec des parties variables ({0}, {1}…).
 *
 * Ne sont JAMAIS traduits : l'aperçu des devis, factures et avoirs (.doc),
 * les champs de saisie, les PDF et les e-mails envoyés aux clients, qui
 * restent en français comme l'exige la loi.
 */
const TradApp = (() => {
  const LANGUES = [
    ['fr', 'Français'], ['en', 'English'], ['es', 'Español'], ['pt', 'Português'], ['it', 'Italiano'],
    ['de', 'Deutsch'], ['ar', 'العربية'], ['tr', 'Türkçe'], ['ro', 'Română'], ['pl', 'Polski'],
  ];
  const CODES = new Set(LANGUES.map(([c]) => c));
  const STOCKAGE = 'devizo-langue';
  const VERSION = (document.currentScript?.src.match(/\?v=\d+/) || ['?v=1'])[0];
  // Zones jamais traduites. Le contenu d'un champ textarea non plus (seul son placeholder l'est).
  const IGNORER = '.doc, [data-no-trad], script, style, code, [contenteditable]';
  const IGNORER_TEXTE = IGNORER + ', textarea';
  const ATTRIBUTS = ['placeholder', 'title', 'aria-label', 'data-label'];

  function choixInitial() {
    try {
      const memo = localStorage.getItem(STOCKAGE);
      if (CODES.has(memo)) return memo;
    } catch (e) {
      // stockage indisponible
    }
    if (navigator.webdriver || /bot|crawl|spider|google|bing|lighthouse|headless/i.test(navigator.userAgent)) return 'fr';
    const nav = (navigator.languages || [navigator.language || 'fr']).map((l) => String(l).slice(0, 2).toLowerCase());
    return nav.find((c) => CODES.has(c)) || 'fr';
  }

  const langue = choixInitial();
  let exacts = null; // Map texte français -> traduction
  let modeles = []; // [{ re, trad, indice }]
  let profondeur = 0; // traduction des parties variables (limitée)
  const deja = new WeakMap(); // nœud -> dernier texte posé par la traduction

  const normaliser = (t) => t.replace(/\s+/g, ' ').trim();
  const echapperRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function compiler(dico) {
    exacts = new Map();
    modeles = [];
    for (const [fr, trad] of Object.entries(dico)) {
      if (!/\{\d+\}/.test(fr)) {
        exacts.set(fr, trad);
        continue;
      }
      const ordre = [];
      const morceaux = fr.split(/(\{\d+\})/);
      // Les espaces collés à une partie variable sont facultatifs (partie vide à l'écran).
      const source = morceaux.map((m, i) => {
        const p = /^\{(\d+)\}$/.exec(m);
        if (p) {
          ordre.push(Number(p[1]));
          return '(.*?)';
        }
        let r = echapperRe(m);
        if (i > 0 && r.startsWith(' ')) r = ' ?' + r.slice(1);
        if (i < morceaux.length - 1 && r.endsWith(' ')) r = r.slice(0, -1) + ' ?';
        return r;
      }).join('');
      const fixes = morceaux.filter((m) => !/^\{\d+\}$/.test(m));
      // Au moins quelques lettres fixes, sinon le modèle attraperait n'importe quoi.
      if (fixes.join('').replace(/[^A-Za-zÀ-ÿ]/g, '').length < 3) continue;
      modeles.push({ re: new RegExp('^' + source + '$', 's'), ordre, trad, indice: fixes.reduce((a, b) => (b.length > a.length ? b : a), '') });
    }
    modeles.sort((a, b) => b.indice.length - a.indice.length);
    // Noms des mois (courts et longs), traduits par le navigateur.
    const LOCALES = { en: 'en-GB', es: 'es-ES', pt: 'pt-PT', it: 'it-IT', de: 'de-DE', ar: 'ar', tr: 'tr-TR', ro: 'ro-RO', pl: 'pl-PL' };
    try {
      for (let m = 0; m < 12; m++) {
        const d = new Date(2026, m, 15);
        for (const option of [{ month: 'short' }, { month: 'long' }]) {
          const fr = new Intl.DateTimeFormat('fr-FR', option).format(d);
          const tr = new Intl.DateTimeFormat(LOCALES[langue], option).format(d);
          if (!exacts.has(fr)) exacts.set(fr, tr);
          const Fr = fr[0].toUpperCase() + fr.slice(1);
          if (!exacts.has(Fr)) exacts.set(Fr, tr[0].toUpperCase() + tr.slice(1));
        }
      }
    } catch (e) {
      // navigateur sans les noms de mois : on garde le français
    }
  }

  function traduireTexte(texte) {
    const t = normaliser(texte);
    if (!t) return null;
    if (exacts.has(t)) return exacts.get(t);
    for (const m of modeles) {
      if (!t.includes(m.indice)) continue;
      const r = m.re.exec(t);
      if (!r) continue;
      const valeurs = {};
      m.ordre.forEach((n, i) => {
        valeurs[n] = valeur(r[i + 1]);
      });
      return m.trad.replace(/\{(\d+)\}/g, (_, n) => valeurs[n] ?? '');
    }
    // « déc. 2025 », « Septembre 2026 »… : le mot est traduit, l'année reste.
    const annee = /^(.+?) (\d{4})$/.exec(t);
    if (annee && exacts.has(annee[1])) return `${exacts.get(annee[1])} ${annee[2]}`;
    return null;
  }

  // Partie variable d'un modèle : traduite si c'est elle-même un texte connu
  // (y compris écrit en minuscules au milieu d'une phrase).
  function valeur(v) {
    const t = v.trim();
    if (!t) return v;
    // « s » du pluriel français (jour{1} → jours) : sans objet dans les autres langues.
    if (v === 's' || v === 'x') return '';
    if (exacts.has(t)) return v.replace(t, exacts.get(t));
    // Une partie variable peut être elle-même une phrase à modèle.
    if (t.length > 6 && profondeur < 2) {
      profondeur++;
      const tr = traduireTexte(t);
      profondeur--;
      if (tr != null) return v.replace(t, tr);
    }
    const maj = t[0].toUpperCase() + t.slice(1);
    if (t !== maj && exacts.has(maj)) {
      const tr = exacts.get(maj);
      return v.replace(t, tr[0].toLowerCase() + tr.slice(1));
    }
    return v;
  }

  function traduireNoeud(n) {
    if (n.nodeType === Node.TEXT_NODE) {
      const v = n.nodeValue;
      if (!v || deja.get(n) === v || !/[A-Za-zÀ-ÿ]/.test(v)) return;
      if (n.parentElement?.closest(IGNORER_TEXTE)) return;
      const trad = traduireTexte(v);
      if (trad == null) return;
      const avant = v.match(/^\s*/)[0];
      const apres = v.match(/\s*$/)[0];
      const nouveau = avant + trad + apres;
      deja.set(n, nouveau);
      if (nouveau !== v) n.nodeValue = nouveau;
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE || n.closest(IGNORER)) return;
    for (const a of ATTRIBUTS) {
      const v = n.getAttribute(a);
      if (v) {
        const trad = traduireTexte(v);
        if (trad != null && trad !== v) n.setAttribute(a, trad);
      }
    }
    const marcheur = document.createTreeWalker(n, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (x) => (x.nodeType === Node.ELEMENT_NODE && x.matches(IGNORER) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let x = marcheur.nextNode();
    while (x) {
      if (x.nodeType === Node.TEXT_NODE) traduireNoeud(x);
      else {
        for (const a of ATTRIBUTS) {
          const v = x.getAttribute(a);
          if (v) {
            const trad = traduireTexte(v);
            if (trad != null && trad !== v) x.setAttribute(a, trad);
          }
        }
      }
      x = marcheur.nextNode();
    }
  }

  function demarrer() {
    const dico = window.DEVIZO_TRAD_APP?.[langue];
    if (!dico) return;
    compiler({ ...dico, ...(window.DEVIZO_TRAD_APP_PLUS?.[langue] || {}) });
    document.documentElement.lang = langue;
    document.documentElement.dir = langue === 'ar' ? 'rtl' : 'ltr';
    const titre = traduireTexte(document.title);
    if (titre) document.title = titre;
    traduireNoeud(document.body);
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData') traduireNoeud(m.target);
        else if (m.type === 'attributes') {
          const v = m.target.getAttribute(m.attributeName);
          const trad = v && !m.target.closest(IGNORER) ? traduireTexte(v) : null;
          if (trad != null && trad !== v) m.target.setAttribute(m.attributeName, trad);
        }
        else m.addedNodes.forEach(traduireNoeud);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTS });
  }

  const charger = (src) => new Promise((ok) => {
    const s = document.createElement('script');
    s.src = src + VERSION;
    s.onload = ok;
    s.onerror = ok; // sans réseau : l'appli reste en français
    document.head.appendChild(s);
  });
  if (langue !== 'fr') {
    Promise.all([charger(`js/langues/app-${langue}.js`), charger('js/langues/app-plus.js')])
      .then(() => (document.body ? demarrer() : document.addEventListener('DOMContentLoaded', demarrer)));
  }

  // Changer de langue : mémorisé sur l'appareil (aussi pour la page d'accueil), puis rechargement.
  function choisir(code) {
    if (!CODES.has(code)) return;
    try {
      localStorage.setItem(STOCKAGE, code);
    } catch (e) {
      // stockage indisponible
    }
    location.reload();
  }

  // Sélecteur de langue (page « Mon compte » et écran de connexion).
  function selecteur() {
    return `<label class="langue-app"><span aria-hidden="true">🌐</span>
      <select data-langue-app aria-label="Langue / Language" data-no-trad>
        ${LANGUES.map(([c, nom]) => `<option value="${c}" ${c === langue ? 'selected' : ''}>${nom}</option>`).join('')}
      </select></label>`;
  }
  document.addEventListener('change', (e) => {
    if (e.target.matches?.('[data-langue-app]')) choisir(e.target.value);
  });

  return { langue: () => langue, choisir, selecteur, traduireTexte: (t) => (exacts ? traduireTexte(t) ?? t : t) };
})();
