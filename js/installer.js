/*
 * Devizo comme une vraie appli : enregistrement du service worker (ouverture
 * sans réseau) et invitation à installer l'icône sur l'écran d'accueil.
 * - Android / ordinateur (Chrome, Edge) : bouton « Installer » natif.
 * - iPhone / iPad (Safari) : explication en 3 gestes (Partager → Sur l'écran d'accueil).
 */
const Installer = (() => {
  const CLE = 'devizo-installer-plus-tard';
  let invite = null; // événement beforeinstallprompt gardé pour plus tard

  const installee = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const android = () => /Android/i.test(navigator.userAgent);
  const mobile = () => ios() || android() || /Mobi/i.test(navigator.userAgent);
  const possible = () => !installee() && (Boolean(invite) || ios() || android());

  // Ouvert depuis l'icône de l'écran d'accueil sur la page d'accueil du site : on va dans l'appli.
  if (installee() && /^\/(index\.html)?$/.test(location.pathname)) location.replace('app.html');

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    invite = ev;
    rafraichir();
    proposer();
  });
  window.addEventListener('appinstalled', () => {
    invite = null;
    document.querySelector('.installer-bandeau')?.remove();
    rafraichir();
  });

  const ETAPES_IOS = `
    <ol class="installer-etapes">
      <li>Dans Safari, touchez <strong>Partager</strong> <span class="installer-icone" aria-hidden="true">⬆︎</span> (sur les iPhone récents, il est dans le menu <strong>« ⋯ »</strong> en bas à droite).</li>
      <li>Choisissez <strong>« Sur l'écran d'accueil »</strong>.</li>
      <li>Touchez <strong>Ajouter</strong> : l'icône Devizo apparaît avec vos autres applis.</li>
    </ol>`;

  const ETAPES_ANDROID = `
    <ol class="installer-etapes">
      <li>Touchez le menu <strong>⋮</strong> en haut à droite de Chrome (sur Samsung Internet : le menu <strong>≡</strong> en bas).</li>
      <li>Choisissez <strong>« Installer l'application »</strong> ou <strong>« Ajouter à l'écran d'accueil »</strong>
        (sur Samsung Internet : « Ajouter la page à » puis « Écran d'accueil »).</li>
      <li>Confirmez : l'icône Devizo apparaît avec vos autres applis.</li>
    </ol>`;

  function expliquer(titre, etapes, note) {
    const dialog = document.createElement('dialog');
    dialog.className = 'ask';
    dialog.innerHTML = `<p><strong>${titre}</strong></p>${etapes}<p class="hint">${note}</p>
      <div class="actions"><button class="btn btn-primary" value="ok">J'ai compris</button></div>`;
    dialog.addEventListener('click', (e) => e.target.value && dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    document.body.appendChild(dialog);
    dialog.showModal();
  }

  async function installer() {
    if (invite) {
      invite.prompt();
      await invite.userChoice.catch(() => null);
      invite = null;
      rafraichir();
      return;
    }
    if (ios()) expliquer('Installer Devizo sur votre iPhone', ETAPES_IOS, 'À faire depuis Safari (pas depuis une autre appli).');
    else if (android()) expliquer('Installer Devizo sur votre téléphone Android', ETAPES_ANDROID, 'À faire depuis Chrome ou Samsung Internet.');
  }

  // Carte pour la page « Mon compte ».
  function carte() {
    if (installee()) {
      return '<section class="card"><h2>Devizo sur cet appareil</h2><p>✓ Devizo est installé : ouvrez-le depuis son icône, même sans réseau.</p></section>';
    }
    return `<section class="card" id="installer-carte">
      <h2>Devizo sur votre téléphone</h2>
      <p>Ajoutez Devizo à votre écran d'accueil : il s'ouvre en plein écran comme une appli, et même sans réseau sur un chantier.</p>
      ${invite ? '<button class="btn btn-primary" data-installer>📲 Installer Devizo</button>'
        : ios() ? ETAPES_IOS
          : android() ? ETAPES_ANDROID
          : '<p class="hint">Ouvrez devizo-app.fr dans Chrome (Android, ordinateur) ou Safari (iPhone) pour l\'installer.</p>'}
    </section>`;
  }

  function rafraichir() {
    const zone = document.getElementById('installer-carte');
    if (zone) zone.outerHTML = carte();
  }

  // Petit bandeau proposé une fois sur téléphone (« Plus tard » le masque 30 jours).
  function proposer() {
    if (!mobile() || !possible() || document.querySelector('.installer-bandeau')) return;
    const accueil = !document.getElementById('view'); // page d'accueil du site (pas l'appli)
    try {
      const plusTard = Number(localStorage.getItem(CLE) || 0);
      if (Date.now() - plusTard < 30 * 86400000) return;
    } catch (e) {
      return;
    }
    // Pas encore connecté (écran de connexion) : on repasse plus tard.
    if (typeof Compte !== 'undefined' && Compte.actif && !Compte.connecte()) {
      setTimeout(proposer, 8000);
      return;
    }
    const el = document.createElement('div');
    el.className = 'installer-bandeau no-print' + (document.querySelector('.cookies') ? ' installer-haut' : '');
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Installer Devizo');
    el.innerHTML = `<img src="img/logo-192.png" alt="" width="40" height="40">
      <span><strong>${accueil ? "Installez l'appli Devizo" : 'Installez Devizo'}</strong><small>${accueil ? "Gratuit · sur votre écran d'accueil, en 10 secondes" : "Sur l'écran d'accueil, même sans réseau"}</small></span>
      <button class="btn btn-primary btn-sm" data-installer>Installer</button>
      <button class="installer-fermer" aria-label="Plus tard">✕</button>`;
    el.querySelector('.installer-fermer').addEventListener('click', () => {
      try {
        localStorage.setItem(CLE, String(Date.now()));
      } catch (e) {
        // stockage indisponible
      }
      el.remove();
    });
    document.body.appendChild(el);
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-installer]')) {
      e.preventDefault();
      installer();
    }
  });
  // Sur iPhone (et Android si le navigateur ne propose rien), on propose après quelques secondes.
  if (ios() || android()) setTimeout(proposer, document.getElementById('view') ? 8000 : 3000);

  return { carte, installee };
})();
