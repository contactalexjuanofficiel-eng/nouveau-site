/*
 * Parrainage : chaque compte a un lien personnel devizo-app.fr/?p=CODE.
 *  - Sur le site : le code du lien est gardé sur l'appareil et un bandeau
 *    « Invité par … » s'affiche.
 *  - Dans l'appli : à la connexion d'un nouveau compte, le code est utilisé
 *    (essai porté à 44 jours) ; la page #/parrainage donne le lien à partager.
 *  - Le parrain gagne 1 mois offert quand son filleul paie (fonction stripe-webhook).
 * Voir supabase/parrainage.sql.
 */
const Parrainage = (() => {
  const CLE = 'devizo-parrain';
  const SITE = 'https://devizo-app.fr';
  const VALIDITE = 60 * 86400000; // le code du lien reste gardé 60 jours

  function lire() {
    try {
      const v = JSON.parse(localStorage.getItem(CLE) || 'null');
      if (v && v.code && Date.now() - v.le < VALIDITE) return v;
    } catch (e) {
      // stockage indisponible
    }
    return null;
  }
  function garder(v) {
    try {
      if (v) localStorage.setItem(CLE, JSON.stringify(v));
      else localStorage.removeItem(CLE);
    } catch (e) {
      // stockage indisponible
    }
  }

  // Code présent dans l'adresse (?p=CODE) : gardé puis retiré de l'adresse.
  function capturer() {
    const params = new URLSearchParams(location.search);
    const code = (params.get('p') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || code.length < 4 || code.length > 12) return lire();
    const v = { code, le: Date.now(), nom: lire()?.code === code ? lire().nom : '' };
    garder(v);
    params.delete('p');
    const reste = params.toString();
    history.replaceState(null, '', location.pathname + (reste ? '?' + reste : '') + location.hash);
    return v;
  }

  async function nomDuParrain(v) {
    if (v.nom) return v.nom;
    const cfg = window.DEVIZO_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return '';
    try {
      const r = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/info_code_parrainage`, {
        method: 'POST',
        headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ c: v.code }),
      });
      const info = r.ok ? await r.json() : null;
      if (!info || !info.nom) {
        garder(null); // code inconnu
        return '';
      }
      v.nom = info.nom;
      garder(v);
      return v.nom;
    } catch (e) {
      return '';
    }
  }

  const echapper = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Bandeau du site public (page d'accueil et pages métiers).
  async function bandeauSite(v) {
    const nom = await nomDuParrain(v);
    if (!nom || document.getElementById('parrain-bandeau')) return;
    const style = document.createElement('style');
    style.textContent = `#parrain-bandeau{background:#1e9e5a;color:#fff;font:600 15px/1.4 Inter,system-ui,sans-serif;text-align:center;padding:10px 44px 10px 16px;position:relative}
#parrain-bandeau a{color:#fff;text-decoration:underline;white-space:nowrap;margin-left:6px}
#parrain-bandeau button{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:6px}`;
    document.head.appendChild(style);
    const el = document.createElement('div');
    el.id = 'parrain-bandeau';
    el.setAttribute('role', 'status');
    el.innerHTML = `🎁 Invité par <strong>${echapper(nom)}</strong> : 1 mois d'essai offert en plus (44 jours au lieu de 14).
      <a href="app.html#inscription">Créer mon compte</a><button type="button" aria-label="Fermer">×</button>`;
    el.querySelector('button').addEventListener('click', () => el.remove());
    document.body.prepend(el);
  }

  // Ligne affichée sur le formulaire d'inscription de l'appli.
  function texteInscription() {
    const v = lire();
    if (!v) return '';
    return `<p class="parrain-info">🎁 ${v.nom ? `Invité par <strong>${echapper(v.nom)}</strong> : ` : ''}1 mois d'essai offert en plus, soit 44 jours gratuits.</p>`;
  }

  // Après la connexion : un nouveau compte utilise le code gardé.
  async function appliquer(client, user) {
    // Code du lien gardé sur l'appareil, sinon celui enregistré à l'inscription
    // (compte de moins de 3 jours, e-mail de confirmation ouvert ailleurs).
    let code = lire()?.code;
    const recent = user?.created_at && Date.now() - Date.parse(user.created_at) < 3 * 86400000;
    if (!code && recent && !(user.user_metadata || {}).parrain_vu) code = (user.user_metadata || {}).parrain;
    if (!code || !client) return null;
    try {
      const { data, error } = await client.rpc('utiliser_code_parrainage', { c: code });
      if (error) return null; // réseau ou serveur : on réessaiera à la prochaine connexion
      garder(null);
      if ((user?.user_metadata || {}).parrain) client.auth.updateUser({ data: { parrain_vu: true } }).catch(() => {});
      return data && data.ok ? data : null;
    } catch (e) {
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Page « Parrainage » de l'appli
  // ------------------------------------------------------------------
  let infos = null;

  async function page() {
    view.innerHTML = `<div class="page-head"><h1>Parrainage</h1></div><section class="card auth-loading">Chargement…</section>`;
    try {
      const { data, error } = await Compte.client().rpc('mes_parrainages');
      if (error) throw error;
      infos = data;
    } catch (e) {
      view.innerHTML = `<div class="page-head"><h1>Parrainage</h1></div>
        <section class="card"><p>Le parrainage n'est pas disponible pour le moment. Vérifiez votre connexion et réessayez.</p></section>`;
      return;
    }
    if (location.hash !== '#/parrainage') return; // on a changé de page entre-temps
    const lien = `${SITE}/?p=${infos.code}`;
    const message = `Je fais mes devis et factures avec Devizo, c'est simple et rapide depuis le téléphone. Avec mon lien, tu as 1 mois d'essai gratuit en plus : ${lien}`;
    const m = encodeURIComponent(message);
    const filleuls = infos.filleuls || [];
    view.innerHTML = `
      <div class="page-head"><h1>Parrainage</h1></div>
      <section class="card parrain-carte">
        <p class="big">🎁 Invitez un artisan, gagnez 1 mois offert</p>
        <ul class="parrain-regles">
          <li><strong>Lui :</strong> 1 mois d'essai gratuit en plus, soit 44 jours au lieu de 14.</li>
          <li><strong>Vous :</strong> 1 mois offert dès qu'il prend un abonnement.</li>
        </ul>
        <label class="parrain-lien-label" for="parrain-lien">Votre lien personnel</label>
        <div class="input-row">
          <input id="parrain-lien" type="text" readonly value="${esc(lien)}" data-no-trad>
          <button class="btn btn-primary" type="button" id="parrain-copier">Copier</button>
        </div>
        <div class="actions parrain-partage">
          <a class="btn" href="https://wa.me/?text=${m}" target="_blank" rel="noopener">WhatsApp</a>
          <a class="btn" href="sms:?&body=${m}">SMS</a>
          <a class="btn" href="mailto:?subject=${encodeURIComponent('Devizo : 1 mois offert pour tes devis et factures')}&body=${m}">E-mail</a>
          ${navigator.share ? '<button class="btn" type="button" id="parrain-partager">Partager…</button>' : ''}
        </div>
        <p class="hint">Votre filleul doit créer son compte avec votre lien. Code : <strong data-no-trad>${esc(infos.code)}</strong></p>
      </section>
      <section class="card">
        <h2>Vos parrainages</h2>
        <div class="parrain-chiffres">
          <div><strong>${infos.inscrits}</strong><span>${infos.inscrits > 1 ? 'inscrits' : 'inscrit'}</span></div>
          <div><strong>${infos.abonnes}</strong><span>${infos.abonnes > 1 ? 'abonnés' : 'abonné'}</span></div>
          <div><strong>${infos.mois}</strong><span>${infos.mois > 1 ? 'mois gagnés' : 'mois gagné'}</span></div>
        </div>
        ${filleuls.length ? `<ul class="parrain-liste">${filleuls.map((f) => `<li><span data-no-trad>${esc(f.nom)}</span>
            <span class="${f.abonne ? 'parrain-ok' : 'hint'}">${f.abonne ? '✓ Abonné' : `Inscrit le ${new Date(f.inscrit_le).toLocaleDateString('fr-FR')}`}</span></li>`).join('')}</ul>`
          : '<p class="hint">Personne pour le moment. Partagez votre lien à un collègue artisan !</p>'}
      </section>
      <section class="card">
        <h2>Comment ça marche ?</h2>
        <p>1. Envoyez votre lien à un artisan (plombier, électricien, peintre…).</p>
        <p>2. Il crée son compte avec ce lien : il a 44 jours pour essayer Devizo gratuitement.</p>
        <p>3. Quand il prend un abonnement, vous gagnez 1 mois offert : il est déduit de votre prochaine facture, ou ajouté à votre essai si vous n'êtes pas encore abonné.</p>
        <p class="hint">Jusqu'à 12 mois offerts par an. Le parrainage ne marche que pour un nouveau compte, et on ne peut pas se parrainer soi-même.</p>
      </section>`;
    document.getElementById('parrain-copier').addEventListener('click', async () => {
      const champ = document.getElementById('parrain-lien');
      try {
        await navigator.clipboard.writeText(lien);
      } catch (e) {
        champ.select();
        document.execCommand('copy');
      }
      toast('Lien copié');
    });
    document.getElementById('parrain-partager')?.addEventListener('click', () => {
      navigator.share({ title: 'Devizo', text: message.replace(lien, '').trim(), url: lien }).catch(() => {});
    });
  }

  // Sur le site public : capture du lien et bandeau.
  const v = capturer();
  if (v && typeof Compte === 'undefined' && !/app\.html$/.test(location.pathname)) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => bandeauSite(v));
    else bandeauSite(v);
  }

  return { page, appliquer, texteInscription, lire };
})();
