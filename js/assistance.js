/*
 * Page « Assistance » : l'utilisateur écrit à l'équipe Devizo depuis l'appli.
 * La demande est enregistrée (table demandes_assistance), l'équipe est
 * prévenue par e-mail (fonction « admin », action « assistance ») et répond
 * directement sur l'adresse e-mail du compte. Les demandes des clients
 * Entreprise sont prioritaires (calculé par le serveur).
 * Utilise view, esc, Compte, Abonnement.
 */
const Assistance = (() => {
  const CONTACT = 'devizocontact@gmail.com';
  const CATEGORIES = [
    ['probleme', 'Un problème ou un bug'],
    ['question', 'Une question'],
    ['abonnement', 'Mon abonnement ou un paiement'],
    ['suggestion', 'Une idée ou une suggestion'],
  ];
  let envoyee = null; // dernière demande envoyée (pour le message de confirmation)

  const connecte = () => typeof Compte !== 'undefined' && Compte.actif && Compte.connecte();
  const prioritaire = () => typeof Abonnement !== 'undefined' && Abonnement.etat() === 'equipe';
  const dateFr = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  function contexte() {
    const version = (document.querySelector('script[src*="js/app.js"]')?.getAttribute('src') || '').split('v=')[1] || '';
    return {
      page: (window.dernierePageAssistance || '').slice(0, 80) || '—',
      version,
      appareil: `${navigator.userAgent}`.slice(0, 300),
      ecran: `${window.innerWidth}×${window.innerHeight}`,
    };
  }

  async function mesDemandes() {
    try {
      const { data } = await Compte.client().from('demandes_assistance')
        .select('id, sujet, cree_le, traitee_le, prioritaire').order('cree_le', { ascending: false }).limit(10);
      return data || [];
    } catch (e) {
      return [];
    }
  }

  async function page() {
    if (!connecte()) {
      view.innerHTML = `
        <div class="page-head"><h1>Assistance</h1></div>
        <section class="card"><p>Une question, un problème ? Écrivez-nous à <a href="mailto:${CONTACT}">${CONTACT}</a>.</p></section>`;
      return;
    }
    const email = Compte.utilisateur()?.email || '';
    const prio = prioritaire();
    view.innerHTML = `
      <div class="page-head"><h1>Assistance</h1></div>
      ${envoyee ? `<section class="card assist-ok" role="status">
          <p class="big">✓ Message envoyé</p>
          <p>Merci ! Nous avons bien reçu votre demande « ${esc(envoyee)} ». La réponse arrivera par e-mail sur <strong>${esc(email)}</strong>${prio ? ', en priorité' : ''}.</p>
        </section>` : ''}
      <section class="card">
        ${prio
          ? '<p class="assist-prio">⚡ <strong>Assistance prioritaire</strong> : avec la formule Entreprise, votre demande est traitée en premier.</p>'
          : '<p class="hint">Nous répondons en général sous 48 h ouvrées. Les clients de la formule Entreprise bénéficient d\'une assistance prioritaire.</p>'}
        <form id="assist-form" novalidate>
          <div class="field"><label for="assist-categorie">C'est à propos de…</label>
            <select id="assist-categorie">${CATEGORIES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
          <div class="field"><label for="assist-sujet">Sujet</label>
            <input id="assist-sujet" maxlength="150" placeholder="Ex. : le PDF de ma facture ne se télécharge pas" required></div>
          <div class="field"><label for="assist-message">Votre message</label>
            <textarea id="assist-message" rows="7" maxlength="5000" placeholder="Expliquez ce qui se passe, et si possible ce que vous faisiez juste avant." required></textarea></div>
          <label class="checkbox"><input type="checkbox" id="assist-contexte" checked> Joindre des informations techniques (page, appareil) pour nous aider</label>
          <p class="hint">Nous vous répondrons sur ${esc(email)}.</p>
          <p class="auth-erreur" id="assist-erreur" role="alert" hidden></p>
          <div class="actions"><button class="btn btn-primary" type="submit">Envoyer ma demande</button></div>
        </form>
      </section>
      <section class="card" id="assist-historique" hidden></section>`;
    envoyee = null;

    const form = document.getElementById('assist-form');
    const zoneErreur = document.getElementById('assist-erreur');
    const montrer = (t) => {
      zoneErreur.textContent = t;
      zoneErreur.hidden = !t;
    };
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const sujet = document.getElementById('assist-sujet').value.trim();
      const message = document.getElementById('assist-message').value.trim();
      if (sujet.length < 2) return montrer('Indiquez un sujet.');
      if (message.length < 5) return montrer('Écrivez votre message.');
      montrer('');
      const bouton = form.querySelector('[type=submit]');
      bouton.disabled = true;
      bouton.textContent = 'Envoi…';
      const { data, error } = await Compte.client().from('demandes_assistance').insert({
        user_id: Compte.utilisateur().id,
        categorie: document.getElementById('assist-categorie').value,
        sujet,
        message,
        contexte: document.getElementById('assist-contexte').checked ? contexte() : null,
      }).select('id').single();
      if (error) {
        bouton.disabled = false;
        bouton.textContent = 'Envoyer ma demande';
        const raison = /10 demandes/.test(error.message) ? error.message.replace(/^.*?(Vous avez)/, '$1')
          : `L'envoi n'a pas abouti. Réessayez, ou écrivez-nous à ${CONTACT}.`;
        return montrer(raison);
      }
      // L'équipe est prévenue par e-mail ; la demande reste enregistrée même si cet envoi échoue.
      try {
        await Compte.client().functions.invoke('admin', { body: { action: 'assistance', id: data.id } });
      } catch (e) {
        // la demande est visible dans le panel d'administration
      }
      envoyee = sujet;
      page();
      window.scrollTo(0, 0);
    });

    const demandes = await mesDemandes();
    const zone = document.getElementById('assist-historique');
    if (zone && demandes.length) {
      zone.hidden = false;
      zone.innerHTML = `<h2>Vos demandes</h2>
        <ul class="assist-liste">${demandes.map((d) => `
          <li><span>${esc(d.sujet)}<small>${dateFr(d.cree_le)}</small></span>
            ${d.traitee_le ? `<span class="badge badge-accepte">Traitée</span>` : '<span class="badge badge-envoye">En cours</span>'}</li>`).join('')}</ul>
        <p class="hint">Les réponses arrivent par e-mail. Pensez à regarder vos courriers indésirables.</p>`;
    }
  }

  return { page };
})();
