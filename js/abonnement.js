/*
 * Essai gratuit, formules (Solo, Pro) et paiement par Stripe.
 *
 * - Essai : 14 jours d'accès complet à partir de la création du compte.
 * - Après l'essai sans abonnement : lecture seule (la base de données refuse
 *   aussi toute modification, voir supabase/abonnements.sql).
 * - Solo : devis, factures, clients. Pro : en plus tableau de bord complet,
 *   dépenses, catalogue et logo. Équipe : en plus 5 utilisateurs et export
 *   comptable ; les membres d'une équipe dépendent de l'abonnement du titulaire.
 * - Sans comptes en ligne (ou dans l'aperçu), tout reste accessible.
 *
 * Chargé après compte.js et avant app.js.
 */
const Abonnement = (() => {
  const ESSAI_JOURS = 14;
  const STATUTS_ACTIFS = ['active', 'trialing', 'past_due'];
  const PRIX = { solo: { mois: 9, an: 90 }, pro: { mois: 19, an: 190 }, equipe: { mois: 39, an: 390 } };
  const NIVEAU = { solo: 1, pro: 2, equipe: 3 };
  const CONTACT = 'devizocontact@gmail.com';
  const FORMULES = {
    solo: {
      nom: 'Solo',
      pour: 'Pour démarrer en micro-entreprise',
      inclus: ['Devis et factures illimités', 'Clients illimités', 'Export PDF', 'Mentions légales automatiques', 'Franchise de TVA ou TVA multi-taux'],
    },
    pro: {
      nom: 'Pro',
      pour: 'Pour gérer toute votre activité',
      inclus: ['Tout ce qui est dans Solo', 'Catalogue de vos prestations et de vos prix', "Tableau de bord complet : ce qu'il vous reste, graphiques",
        'Suivi des dépenses', 'Alertes plafonds micro et TVA', 'Votre logo sur les documents'],
    },
    equipe: {
      nom: 'Équipe',
      pour: 'Pour les entreprises avec salariés',
      inclus: ['Tout ce qui est dans Pro', "Jusqu'à 5 utilisateurs, chacun avec son compte", 'Export pour le comptable (ventes et dépenses)',
        'Assistance prioritaire'],
    },
  };
  const liens = (window.DEVIZO_CONFIG || {}).stripe || {};

  let client = null;
  let user = null;
  let infos = null; // ligne de la table « abonnements »
  let equipe = null; // réponse de mon_equipe() : titulaire ou membre d'une équipe
  let periode = 'mois';

  const membre = () => equipe?.role === 'membre';

  async function charger(c, u, eq) {
    client = c;
    user = u;
    equipe = eq || null;
    if (membre()) {
      // L'accès vient de l'abonnement du titulaire de l'équipe.
      infos = equipe.abonnement || null;
      return;
    }
    try {
      const { data: ligne, error } = await c.from('abonnements').select('*').eq('user_id', u.id).maybeSingle();
      if (!error) infos = ligne || null;
    } catch (e) {
      // pas de réseau : on garde la dernière information connue
    }
  }

  function joursEssaiRestants() {
    if (!user?.created_at) return ESSAI_JOURS;
    const fin = Date.parse(user.created_at) + ESSAI_JOURS * 86400000;
    return Math.max(0, Math.ceil((fin - Date.now()) / 86400000));
  }

  function abonnementActif() {
    return Boolean(infos && STATUTS_ACTIFS.includes(infos.statut) &&
      (!infos.fin_periode || Date.parse(infos.fin_periode) > Date.now() - 3 * 86400000));
  }

  // 'libre' (sans compte en ligne), 'essai', 'solo', 'pro' ou 'expire'.
  function etat() {
    if (typeof Compte === 'undefined' || !Compte.actif || !user) return 'libre';
    if (membre()) return equipe.active ? 'equipe' : 'expire';
    if (abonnementActif()) return NIVEAU[infos.formule] ? infos.formule : 'pro';
    if (joursEssaiRestants() > 0) return 'essai';
    return 'expire';
  }

  function peutModifier() {
    return etat() !== 'expire';
  }

  // niveau : 'solo', 'pro' ou 'equipe' (formule minimale nécessaire).
  function aAcces(niveau = 'solo') {
    const e = etat();
    if (e === 'libre' || e === 'essai') return true;
    if (!NIVEAU[e]) return false;
    return NIVEAU[e] >= (NIVEAU[niveau] || 1);
  }

  const estAbonne = (e) => Boolean(NIVEAU[e]);

  function lienPaiement(formule) {
    const url = liens[formule + (periode === 'an' ? 'An' : 'Mois')];
    if (!url || !user) return '';
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}client_reference_id=${encodeURIComponent(user.id)}&prefilled_email=${encodeURIComponent(user.email || '')}`;
  }

  function lienPortail() {
    if (!liens.portail) return '';
    const sep = liens.portail.includes('?') ? '&' : '?';
    return user?.email ? `${liens.portail}${sep}prefilled_email=${encodeURIComponent(user.email)}` : liens.portail;
  }

  // ------------------------------------------------------------------
  // Bandeau en haut de l'application
  // ------------------------------------------------------------------
  function majBandeau() {
    let el = document.getElementById('bandeau-abo');
    const e = etat();
    let html = '';
    let classe = '';
    if (e === 'expire' && membre()) {
      classe = 'bad';
      html = `L'abonnement Équipe de ${esc(equipe.email_titulaire)} n'est plus actif : les documents restent consultables, mais plus modifiables.`;
    } else if (e === 'essai') {
      const j = joursEssaiRestants();
      classe = j <= 3 ? 'warn' : '';
      html = `🎁 Essai gratuit : encore <strong>${j} jour${j > 1 ? 's' : ''}</strong>. <a href="#/abonnement">Choisir une formule</a>`;
    } else if (e === 'expire') {
      classe = 'bad';
      html = 'Votre essai gratuit est terminé : vos documents restent consultables, mais vous ne pouvez plus en créer. <a href="#/abonnement">Choisir une formule</a>';
    } else if (estAbonne(e) && !membre() && infos?.statut === 'past_due') {
      classe = 'bad';
      html = `⚠ Le dernier paiement a échoué. ${lienPortail() ? `<a href="${esc(lienPortail())}" target="_blank" rel="noopener">Mettre à jour ma carte</a>` : 'Mettez à jour votre carte bancaire.'}`;
    }
    if (!html) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'bandeau-abo';
      document.getElementById('view').before(el);
    }
    el.className = 'bandeau-abo no-print ' + classe;
    el.innerHTML = html;
  }

  // ------------------------------------------------------------------
  // Écrans de blocage
  // ------------------------------------------------------------------
  function pageLectureSeule() {
    if (membre()) {
      view.innerHTML = `
        <div class="card gate">
          <h1>Abonnement de l'équipe inactif</h1>
          <p>L'abonnement Équipe de ${esc(equipe.email_titulaire)} n'est plus actif. Les devis, factures et clients restent consultables ;
            pour les modifier, demandez-lui de renouveler l'abonnement.</p>
          <div class="actions"><a class="btn" href="#/documents">Voir les documents</a></div>
        </div>`;
      return;
    }
    view.innerHTML = `
      <div class="card gate">
        <h1>Votre essai gratuit est terminé</h1>
        <p>Merci d'avoir essayé Devizo ! Vos devis, factures et clients sont toujours là : vous pouvez les consulter et télécharger vos PDF.
          Pour en créer de nouveaux ou les modifier, choisissez une formule.</p>
        <div class="actions">
          <a class="btn btn-primary btn-lg" href="#/abonnement">Choisir une formule</a>
          <a class="btn" href="#/documents">Voir mes documents</a>
        </div>
      </div>`;
  }

  // Appelé quand une modification est refusée (fin d'essai).
  async function refuserModification() {
    if (membre()) {
      await ask(`L'abonnement Équipe de ${equipe.email_titulaire} n'est plus actif : les documents restent consultables, mais plus modifiables.`, "D'accord", false);
      return;
    }
    const ok = await ask("Votre essai gratuit est terminé : vos documents restent consultables, mais pour créer ou modifier il faut choisir une formule.", 'Voir les formules', 'Plus tard');
    if (ok) go('#/abonnement');
  }

  const FONCTIONS_PRO = {
    depenses: ['Suivi des dépenses', 'Notez vos achats de matériel, carburant, assurance… et connaissez votre vrai bénéfice.', 'pro'],
    catalogue: ['Catalogue de prestations', 'Enregistrez vos prestations et vos prix une fois, retrouvez-les en quelques lettres dans vos devis.', 'pro'],
    dashboard: ["Tableau de bord complet", "Ce qu'il vous reste après charges et impôts, graphiques mois par mois et jour par jour, alertes de plafonds.", 'pro'],
    export: ['Export pour le comptable', 'Journal des ventes et liste des dépenses sur la période de votre choix, en un clic, prêts à envoyer à votre comptable.', 'equipe'],
  };

  function carteUpsell(cle) {
    const [titre, texte, formule] = FONCTIONS_PRO[cle];
    return `
      <div class="card upsell">
        <p class="upsell-tag">Formule ${FORMULES[formule].nom}</p>
        <h2>${esc(titre)}</h2>
        <p>${esc(texte)}</p>
        <a class="btn btn-primary" href="#/abonnement">Passer à ${FORMULES[formule].nom} · ${PRIX[formule].mois} € HT / mois</a>
      </div>`;
  }

  function pageUpsell(cle) {
    view.innerHTML = `<div class="page-head"><h1>${esc(FONCTIONS_PRO[cle][0])}</h1></div>${carteUpsell(cle)}`;
  }

  // ------------------------------------------------------------------
  // Page « Abonnement »
  // ------------------------------------------------------------------
  function prixTexte(formule) {
    const ht = PRIX[formule][periode];
    const fmt = (v) => v.toLocaleString('fr-FR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
    return `<span class="amount">${fmt(ht)}</span> € <small class="per">HT / ${periode === 'an' ? 'an' : 'mois'}</small>
      <span class="price-ttc">soit ${fmt(ht * 1.2)} € TTC</span>`;
  }

  function statutHtml() {
    const e = etat();
    const fin = infos?.fin_periode ? new Date(infos.fin_periode).toLocaleDateString('fr-FR') : '';
    if (membre()) {
      return `<p class="big">Équipe de ${esc(equipe.email_titulaire)} <small>${equipe.active ? 'accès actif' : 'abonnement inactif'}</small></p>
        <p class="hint">Votre accès est fourni par l'abonnement de ${esc(equipe.email_titulaire)} : c'est cette personne qui gère l'abonnement et les factures Stripe.</p>`;
    }
    if (e === 'essai') {
      const j = joursEssaiRestants();
      const finEssai = new Date(Date.parse(user.created_at) + ESSAI_JOURS * 86400000).toLocaleDateString('fr-FR');
      return `<p class="big">Essai gratuit <small>encore ${j} jour${j > 1 ? 's' : ''}, jusqu'au ${finEssai}</small></p>
        <p class="hint">Pendant l'essai, vous avez accès à tout. Choisissez une formule quand vous voulez : rien n'est prélevé avant.</p>`;
    }
    if (estAbonne(e)) {
      const resilie = infos.statut === 'canceled' || infos.fin_prevue === true;
      return `<p class="big">Formule ${FORMULES[e].nom} <small>${resilie ? `résiliée, active jusqu'au ${fin}` : fin ? `renouvellement le ${fin}` : 'active'}</small></p>
        ${infos.statut === 'past_due' ? '<p class="status bad">⚠ Le dernier paiement a échoué : mettez à jour votre carte.</p>' : ''}
        ${lienPortail() ? `<a class="btn" href="${esc(lienPortail())}" target="_blank" rel="noopener">Gérer mon abonnement (carte, factures, résiliation)</a>` : ''}
        ${e === 'equipe' ? `<p class="hint">Assistance prioritaire : écrivez à <a href="mailto:${CONTACT}">${CONTACT}</a>, votre demande est traitée en premier.</p>` : ''}`;
    }
    if (e === 'expire') {
      return `<p class="big">Essai terminé</p>
        <p class="hint">Vos données sont conservées. Choisissez une formule pour continuer à créer des devis et des factures.</p>`;
    }
    return '<p>Les comptes en ligne ne sont pas activés : toutes les fonctions sont accessibles.</p>';
  }

  function page(params) {
    if (etat() === 'libre') {
      view.innerHTML = `<div class="card"><h1>Abonnement</h1>${statutHtml()}</div>`;
      return;
    }
    if (membre()) {
      view.innerHTML = `<div class="page-head"><h1>Abonnement</h1></div><section class="card">${statutHtml()}</section>`;
      return;
    }
    const merci = params?.get('merci');
    const e = etat();
    const actuelle = estAbonne(e) ? e : null;
    const paiementPret = Boolean(liens.soloMois || liens.proMois);

    view.innerHTML = `
      <div class="page-head"><h1>Abonnement</h1></div>
      ${merci && !actuelle ? '<div class="card auth-info" id="abo-attente">Merci pour votre paiement ! Activation de votre abonnement en cours…</div>' : ''}
      ${merci && actuelle ? '<div class="card status good">✓ Merci ! Votre abonnement est actif.</div>' : ''}
      <section class="card">${statutHtml()}</section>

      <div class="billing-toggle" role="group" aria-label="Période de facturation">
        <button type="button" class="${periode === 'mois' ? 'active' : ''}" data-periode-abo="mois">Mensuel</button>
        <button type="button" class="${periode === 'an' ? 'active' : ''}" data-periode-abo="an">Annuel <span class="save">2 mois offerts</span></button>
      </div>

      <div class="plans plans-app">
        ${['solo', 'pro', 'equipe'].map((f) => {
          const url = lienPaiement(f);
          let bouton;
          if (actuelle === f) bouton = '<span class="btn btn-lg plan-cta" aria-disabled="true">✓ Votre formule actuelle</span>';
          else if (actuelle && lienPortail()) bouton = `<a class="btn btn-lg plan-cta ${f === 'pro' ? 'btn-primary' : ''}" href="${esc(lienPortail())}" target="_blank" rel="noopener">Passer à ${FORMULES[f].nom}</a>`;
          // Déjà abonné : un lien de paiement créerait un second abonnement.
          else if (actuelle) bouton = '<span class="btn btn-lg plan-cta" aria-disabled="true">Changement de formule bientôt disponible</span>';
          else if (url) bouton = `<a class="btn btn-lg plan-cta ${f === 'pro' ? 'btn-primary' : ''}" href="${esc(url)}">Choisir ${FORMULES[f].nom}</a>`;
          else bouton = '<span class="btn btn-lg plan-cta" aria-disabled="true">Paiement bientôt disponible</span>';
          return `
            <article class="plan ${f === 'pro' ? 'plan-featured' : ''}">
              ${f === 'pro' ? '<p class="plan-tag">Le plus choisi</p>' : ''}
              <h3>${FORMULES[f].nom}</h3>
              <p class="plan-for">${FORMULES[f].pour}</p>
              <p class="price">${prixTexte(f)}</p>
              <ul>${FORMULES[f].inclus.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
              ${bouton}
            </article>`;
        }).join('')}
      </div>
      <p class="plans-note">Paiement sécurisé par Stripe. Sans engagement : vous résiliez quand vous voulez depuis cette page.
        ${paiementPret ? '' : '<br>Le paiement en ligne sera ouvert très bientôt.'}</p>
    `;

    view.querySelectorAll('[data-periode-abo]').forEach((b) => b.addEventListener('click', () => {
      periode = b.dataset.periodeAbo;
      page(params);
    }));

    // Retour de Stripe : on attend que le webhook ait enregistré l'abonnement.
    if (merci && !actuelle) attendreActivation();
  }

  async function attendreActivation() {
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      if (!document.getElementById('abo-attente')) return; // page quittée
      await charger(client, user);
      if (abonnementActif()) {
        majBandeau();
        page(new URLSearchParams('merci=1'));
        return;
      }
    }
    const el = document.getElementById('abo-attente');
    if (el) el.textContent = "Votre paiement est bien reçu par Stripe ; l'activation prend un peu plus de temps que prévu. Rechargez la page dans une minute.";
  }

  // Résumé pour la page « Mon compte ».
  function resume() {
    const e = etat();
    if (e === 'libre') return '';
    const libelle = membre() ? `Équipe de ${esc(equipe.email_titulaire)}` : {
      essai: `Essai gratuit, encore ${joursEssaiRestants()} jour${joursEssaiRestants() > 1 ? 's' : ''}`,
      solo: 'Formule Solo',
      pro: 'Formule Pro',
      equipe: 'Formule Équipe',
      expire: 'Essai terminé',
    }[e];
    return `<section class="card"><h2>Abonnement</h2><p><strong>${libelle}</strong></p>
      <a class="btn" href="#/abonnement">${estAbonne(e) || membre() ? 'Voir mon abonnement' : 'Choisir une formule'}</a></section>`;
  }

  return {
    charger, etat, peutModifier, aAcces, majBandeau, page, pageUpsell, carteUpsell,
    pageLectureSeule, refuserModification, resume, joursEssaiRestants,
  };
})();
