/*
 * Bandeau d'information sur les cookies, affiché une seule fois par appareil.
 * Devizo n'utilise que des traceurs indispensables (connexion, données
 * enregistrées sur l'appareil) : aucun consentement n'est requis, le bandeau
 * informe simplement et renvoie vers la politique de confidentialité.
 */
(() => {
  const CLE = 'devizo-cookies-vu';
  try {
    if (localStorage.getItem(CLE)) return;
  } catch (e) {
    return; // stockage bloqué : rien n'est enregistré, inutile d'afficher le bandeau
  }

  const TEXTES = {
    fr: ['Cookies', "Devizo utilise uniquement les cookies indispensables : rester connecté et garder vos données sur cet appareil. Aucune publicité, aucun pistage.", "J'ai compris", 'En savoir plus'],
    en: ['Cookies', 'Devizo only uses essential cookies: keeping you logged in and saving your data on this device. No ads, no tracking.', 'Got it', 'Learn more'],
    es: ['Cookies', 'Devizo solo utiliza cookies imprescindibles: mantener tu sesión y guardar tus datos en este dispositivo. Sin publicidad ni seguimiento.', 'Entendido', 'Más información'],
    pt: ['Cookies', 'O Devizo usa apenas cookies essenciais: manter a sessão iniciada e guardar os seus dados neste dispositivo. Sem publicidade nem rastreamento.', 'Entendi', 'Saber mais'],
    it: ['Cookie', 'Devizo utilizza solo cookie indispensabili: mantenere l\'accesso e salvare i tuoi dati su questo dispositivo. Nessuna pubblicità, nessun tracciamento.', 'Ho capito', 'Scopri di più'],
    de: ['Cookies', 'Devizo verwendet nur notwendige Cookies: um Sie angemeldet zu halten und Ihre Daten auf diesem Gerät zu speichern. Keine Werbung, kein Tracking.', 'Verstanden', 'Mehr erfahren'],
    ar: ['ملفات تعريف الارتباط', 'يستخدم Devizo ملفات تعريف الارتباط الضرورية فقط: للبقاء متصلاً وحفظ بياناتك على هذا الجهاز. لا إعلانات ولا تتبع.', 'فهمت', 'اعرف المزيد'],
    tr: ['Çerezler', 'Devizo yalnızca zorunlu çerezleri kullanır: oturumunuzu açık tutmak ve verilerinizi bu cihazda saklamak için. Reklam yok, takip yok.', 'Anladım', 'Daha fazla bilgi'],
    ro: ['Cookie-uri', 'Devizo folosește doar cookie-uri esențiale: pentru a rămâne conectat și a păstra datele pe acest dispozitiv. Fără reclame, fără urmărire.', 'Am înțeles', 'Află mai multe'],
    pl: ['Pliki cookie', 'Devizo używa tylko niezbędnych plików cookie: aby utrzymać zalogowanie i zapisać dane na tym urządzeniu. Bez reklam i śledzenia.', 'Rozumiem', 'Dowiedz się więcej'],
  };
  const langue = () => (typeof I18n !== 'undefined' ? I18n.langue() : document.documentElement.lang || 'fr').slice(0, 2);

  const style = document.createElement('style');
  style.textContent = `
    .cookies {
      position: fixed; left: 16px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); z-index: 60;
      width: min(400px, calc(100vw - 32px)); padding: 18px 18px 16px; border-radius: 14px;
      background: #ffffff; color: #1c2333; border: 1px solid #e2e6ee; box-shadow: 0 18px 40px rgba(15, 27, 61, .18);
      font: 15px/1.5 var(--font-sans, system-ui, sans-serif); animation: cookies-in .3s ease;
    }
    [dir="rtl"] .cookies { left: auto; right: 16px; }
    .cookies-titre { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-weight: 700; font-size: 1rem; }
    .cookies-titre span { font-size: 1.4rem; line-height: 1; }
    .cookies p { margin: 0; color: #4a5266; font-size: .92rem; }
    .cookies-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
    .cookies-actions a { color: #1f5eff; font-weight: 600; font-size: .92rem; text-decoration: none; }
    .cookies-actions a:hover { text-decoration: underline; }
    .cookies-actions button {
      border: 0; border-radius: 10px; padding: 10px 20px; background: #1f5eff; color: #ffffff;
      font: inherit; font-weight: 700; cursor: pointer;
    }
    .cookies-actions button:hover { background: #1749cc; }
    @media (prefers-color-scheme: dark) {
      .cookies { background: #1a1f2b; color: #e6e9f2; border-color: #2c3344; box-shadow: 0 18px 40px rgba(0, 0, 0, .5); }
      .cookies p { color: #9aa2b5; }
      .cookies-actions a { color: #8eadff; }
    }
    /* Téléphone : bandeau compact en bas, qui ne cache pas le bouton principal de l'accueil. */
    @media (max-width: 560px) {
      .cookies { left: 8px; right: 8px; bottom: calc(8px + env(safe-area-inset-bottom, 0px)); width: auto; padding: 12px 14px; }
      .cookies-titre { display: none; }
      .cookies p { font-size: .85rem; line-height: 1.4; }
      .cookies-actions { margin-top: 8px; }
      .cookies-actions a { padding: 10px 0; }
      .cookies-actions button { min-height: 44px; padding: 0 20px; }
    }
    @keyframes cookies-in { from { opacity: 0; transform: translateY(16px); } }
    @media (prefers-reduced-motion: reduce) { .cookies { animation: none; } }
    @media print { .cookies { display: none; } }`;

  const bandeau = document.createElement('div');
  bandeau.className = 'cookies';
  bandeau.setAttribute('role', 'region');

  function remplir() {
    const [titre, texte, ok, plus] = TEXTES[langue()] || TEXTES.fr;
    bandeau.setAttribute('aria-label', titre);
    bandeau.innerHTML = `
      <p class="cookies-titre"><span aria-hidden="true">🍪</span>${titre}</p>
      <p>${texte}</p>
      <div class="cookies-actions">
        <a href="confidentialite.html#cookies">${plus}</a>
        <button type="button">${ok}</button>
      </div>`;
    bandeau.querySelector('button').addEventListener('click', fermer);
  }

  function fermer() {
    try {
      localStorage.setItem(CLE, new Date().toISOString());
    } catch (e) {
      // stockage indisponible
    }
    bandeau.remove();
  }

  function montrer() {
    document.head.appendChild(style);
    remplir();
    document.body.appendChild(bandeau);
    if (typeof I18n !== 'undefined') I18n.surChangement(remplir);
  }

  // Un court délai : la page s'affiche d'abord, le bandeau arrive ensuite.
  const lancer = () => setTimeout(montrer, 600);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lancer);
  else lancer();
})();
