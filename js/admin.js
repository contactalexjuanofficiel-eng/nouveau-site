/*
 * Panel d'administration de Devizo : statistiques du site, abonnés, revenu
 * et liste des utilisateurs. Réservé aux comptes de la table « admins »
 * (voir supabase/admin.sql) : toutes les données passent par des fonctions
 * qui vérifient ce droit côté serveur.
 */
(() => {
  const cfg = window.DEVIZO_CONFIG || {};
  const zone = document.getElementById('admin');
  const boutonDeco = document.getElementById('admin-deco');
  const client = cfg.supabaseUrl && window.supabase
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
    : null;

  const FORMULES = { solo: 'Solo', pro: 'Pro', equipe: 'Entreprise' };
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const euro = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
  const nb = (n) => new Intl.NumberFormat('fr-FR').format(Number(n) || 0);
  const date = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—');
  const pourcent = (a, b) => (b ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format((a / b) * 100)} %` : '—');
  const ilYa = (iso) => {
    if (!iso) return 'jamais';
    const j = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
    if (j <= 0) return "aujourd'hui";
    if (j === 1) return 'hier';
    return `il y a ${j} j`;
  };

  let stats = null;
  let utilisateurs = [];
  let filtre = { texte: '', type: 'tous' };

  function message(titre, texte, bouton = '') {
    zone.innerHTML = `<div class="card admin-connexion"><h1>${esc(titre)}</h1><p>${texte}</p>${bouton}</div>`;
  }

  function pageConnexion(erreur = '') {
    zone.innerHTML = `
      <form class="card admin-connexion" id="admin-form" novalidate>
        <h1>Administration</h1>
        <p class="hint">Connectez-vous avec votre compte administrateur Devizo.</p>
        <div class="field"><label for="admin-email">Adresse e-mail</label>
          <input id="admin-email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="admin-mdp">Mot de passe</label>
          <input id="admin-mdp" type="password" autocomplete="current-password" required></div>
        <p class="auth-erreur" id="admin-erreur" role="alert" ${erreur ? '' : 'hidden'}>${esc(erreur)}</p>
        <button class="btn btn-primary" type="submit">Se connecter</button>
      </form>`;
    document.getElementById('admin-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const bouton = ev.target.querySelector('[type=submit]');
      bouton.disabled = true;
      bouton.textContent = 'Connexion…';
      const { error } = await client.auth.signInWithPassword({
        email: document.getElementById('admin-email').value.trim(),
        password: document.getElementById('admin-mdp').value,
      });
      if (error) pageConnexion('E-mail ou mot de passe incorrect.');
      else demarrer();
    });
  }

  // Graphique en barres des 30 derniers jours, en SVG sans bibliothèque.
  function graphique(jours, cle, libelle) {
    const L = 600;
    const H = 160;
    const bas = 22;
    const max = Math.max(1, ...jours.map((j) => Number(j[cle]) || 0));
    const pas = L / jours.length;
    const barres = jours.map((j, i) => {
      const v = Number(j[cle]) || 0;
      const h = ((H - bas - 14) * v) / max;
      const x = i * pas;
      const jour = new Date(j.jour + 'T12:00:00');
      const etiquette = i % 7 === 1 || i === jours.length - 1
        ? `<text class="axe" x="${i === jours.length - 1 ? L : x + pas / 2}" y="${H - 6}" text-anchor="${i === jours.length - 1 ? 'end' : 'middle'}">${jour.getDate()}/${jour.getMonth() + 1}</text>`
        : '';
      return `<g><title>${jour.toLocaleDateString('fr-FR')} : ${v} ${libelle}</title>
        <rect class="barre" x="${x + 1.5}" y="${H - bas - h}" width="${pas - 3}" height="${h}" rx="2"></rect>${etiquette}</g>`;
    }).join('');
    const total = jours.reduce((t, j) => t + (Number(j[cle]) || 0), 0);
    return `<div class="admin-graph-bloc"><p class="admin-graph-titre">${esc(libelle[0].toUpperCase() + libelle.slice(1))} par jour
        <span>${nb(total)} en 30 j · max ${nb(max)}/jour</span></p>
      <svg class="admin-graph" viewBox="0 0 ${L} ${H}" role="img" aria-label="${esc(libelle)} des 30 derniers jours">
      <line class="grille" x1="0" x2="${L}" y1="${H - bas}" y2="${H - bas}"></line>${barres}</svg></div>`;
  }

  function carte(label, valeur, sous = '', fort = false) {
    return `<div class="stat${fort ? ' fort' : ''}"><div class="label">${esc(label)}</div><div class="value">${valeur}</div>${sous ? `<div class="sous">${sous}</div>` : ''}</div>`;
  }

  function statutUtilisateur(u) {
    const badges = [];
    if (u.admin) badges.push('<span class="badge badge-admin">Admin</span>');
    if (u.abonne) {
      badges.push(`<span class="badge badge-abonne">${esc(FORMULES[u.formule] || u.formule)}</span>`);
      if (u.statut === 'past_due') badges.push('<span class="badge badge-retard">Paiement en retard</span>');
      if (u.fin_prevue) badges.push(`<span class="badge badge-fin">Résilié · fin ${date(u.fin_periode)}</span>`);
    } else if (u.membre_de) {
      badges.push('<span class="badge">Membre d\'équipe</span>');
    } else if (u.essai_en_cours) {
      const reste = Math.max(0, 14 - Math.floor((Date.now() - Date.parse(u.inscrit_le)) / 86400000));
      badges.push(`<span class="badge badge-essai">Essai · ${reste} j</span>`);
    } else {
      badges.push(`<span class="badge">${u.formule ? 'Ancien abonné' : 'Essai terminé'}</span>`);
    }
    if (!u.confirme) badges.push('<span class="badge badge-fin">E-mail non confirmé</span>');
    return `<span class="badges">${badges.join(' ')}</span>`;
  }

  function correspond(u) {
    const t = filtre.texte.toLowerCase();
    if (t && !`${u.email} ${u.entreprise || ''}`.toLowerCase().includes(t)) return false;
    switch (filtre.type) {
      case 'abonnes': return u.abonne;
      case 'essai': return !u.abonne && !u.membre_de && u.essai_en_cours;
      case 'perdus': return !u.abonne && !u.membre_de && !u.essai_en_cours;
      case 'membres': return Boolean(u.membre_de);
      case 'non-confirmes': return !u.confirme;
      case 'inactifs': return !u.derniere_connexion || Date.parse(u.derniere_connexion) < Date.now() - 30 * 86400000;
      default: return true;
    }
  }

  function lignesUtilisateurs() {
    const liste = utilisateurs.filter(correspond);
    document.getElementById('admin-compte').textContent = `${nb(liste.length)} sur ${nb(utilisateurs.length)}`;
    document.getElementById('admin-lignes').innerHTML = liste.length
      ? liste.map((u) => `
        <tr>
          <td class="email-cell" data-label="Compte"><span class="email">${esc(u.email)}</span>
            <small>${esc(u.entreprise || 'Entreprise non renseignée')}${u.membre_de ? ` · équipe de ${esc(u.membre_de)}` : ''}${u.nb_membres ? ` · ${u.nb_membres} membre(s)` : ''}</small></td>
          <td data-label="Statut">${statutUtilisateur(u)}</td>
          <td data-label="Inscrit le">${date(u.inscrit_le)}</td>
          <td data-label="Dernière connexion">${ilYa(u.derniere_connexion)}</td>
          <td class="num" data-label="Documents"><span>${nb(u.documents)} <small>dont ${nb(u.factures)} fact.</small></span></td>
          <td class="num" data-label="Clients">${nb(u.clients)}</td>
          <td class="num" data-label="E-mails">${nb(u.emails)}</td>
        </tr>`).join('')
      : '<tr><td colspan="7" class="hint">Aucun utilisateur ne correspond.</td></tr>';
  }

  function exporterCsv() {
    const colonnes = ['email', 'entreprise', 'inscrit_le', 'derniere_connexion', 'confirme', 'formule', 'statut', 'abonne',
      'fin_periode', 'fin_prevue', 'essai_en_cours', 'membre_de', 'nb_membres', 'documents', 'factures', 'clients', 'emails'];
    const cellule = (v) => {
      const t = v === null || v === undefined ? '' : String(v);
      return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const csv = [colonnes.join(';'), ...utilisateurs.filter(correspond).map((u) => colonnes.map((c) => cellule(u[c])).join(';'))].join('\r\n');
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    lien.download = `devizo-utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
  }

  function afficher() {
    const s = stats;
    const parFormule = s.abonnes_par_formule || {};
    const visites = s.visites_par_page_30j || {};
    const detailFormules = Object.keys(FORMULES).map((f) => `${FORMULES[f]} : ${nb(parFormule[f] || 0)}`).join(' · ');
    zone.innerHTML = `
      <div class="page-head">
        <h1>Tableau de bord admin</h1>
        <button class="btn" id="admin-rafraichir">↻ Actualiser</button>
      </div>

      <h2 class="admin-section-titre">Argent</h2>
      <div class="admin-kpis">
        ${carte('Revenu mensuel estimé (HT)', euro(s.revenu_mensuel_ht), `soit ${euro(s.revenu_mensuel_ht * 12)} par an`, true)}
        ${carte('Abonnés payants', nb(s.abonnes), detailFormules, true)}
        ${carte('Dont abonnements annuels', nb(s.abonnes_annuels), `${pourcent(s.abonnes_annuels, s.abonnes)} des abonnés`)}
        ${carte('Résiliations prévues', nb(s.resiliations_prevues), `${nb(s.paiements_en_retard)} paiement(s) en retard`)}
      </div>

      <h2 class="admin-section-titre">Utilisateurs</h2>
      <div class="admin-kpis">
        ${carte('Comptes créés', nb(s.utilisateurs), `+${nb(s.nouveaux_7j)} en 7 j · +${nb(s.nouveaux_30j)} en 30 j`)}
        ${carte('En essai gratuit', nb(s.en_essai), '14 jours après l\'inscription')}
        ${carte('Taux de conversion', pourcent(s.abonnes, s.utilisateurs), 'abonnés / comptes créés')}
        ${carte('Actifs', nb(s.actifs_7j), `connectés en 7 j · ${nb(s.actifs_30j)} en 30 j`)}
        ${carte('Membres d\'équipe', nb(s.membres_equipe), `${nb(s.non_confirmes)} e-mail(s) non confirmé(s)`)}
      </div>

      <h2 class="admin-section-titre">Site (30 derniers jours)</h2>
      <div class="admin-kpis">
        ${carte('Visites de l\'accueil', nb(visites.accueil), `inscription : ${pourcent(s.nouveaux_30j, visites.accueil)} des visiteurs`)}
        ${carte('Ouvertures de l\'appli', nb(visites.app))}
        ${carte('Pages de signature ouvertes', nb(visites.signer))}
        ${carte('Pages légales vues', nb(visites.legal))}
      </div>
      <section class="card">
        <div class="admin-graphs">${graphique(s.par_jour || [], 'visites', "visites de l'accueil")}${graphique(s.par_jour || [], 'inscriptions', 'inscriptions')}</div>
        <p class="hint">Une visite = une personne qui ouvre la page dans un onglet (sans cookie, aucune donnée personnelle).</p>
      </section>

      <h2 class="admin-section-titre">Utilisation de l'appli</h2>
      <div class="admin-kpis">
        ${carte('Factures créées', nb(s.factures), `${euro(s.factures_ht)} HT facturés au total`)}
        ${carte('Devis créés', nb(s.devis))}
        ${carte('E-mails envoyés', nb(s.emails_envoyes), `${nb(s.emails_30j)} en 30 j`)}
        ${carte('Devis signés en ligne', nb(s.devis_signes), `sur ${nb(s.devis_partages)} envoyés avec lien`)}
        ${carte('Clients enregistrés', nb(s.clients), `${nb(s.depenses)} dépenses saisies`)}
      </div>

      <h2 class="admin-section-titre">Liste des utilisateurs</h2>
      <section class="card">
        <div class="admin-outils">
          <input type="search" id="admin-recherche" placeholder="Rechercher un e-mail ou une entreprise" value="${esc(filtre.texte)}">
          <select id="admin-filtre" aria-label="Filtrer">
            ${[['tous', 'Tous'], ['abonnes', 'Abonnés payants'], ['essai', 'En essai'], ['perdus', 'Essai terminé, sans abonnement'],
              ['membres', 'Membres d\'équipe'], ['inactifs', 'Inactifs depuis 30 j'], ['non-confirmes', 'E-mail non confirmé']]
              .map(([v, l]) => `<option value="${v}"${filtre.type === v ? ' selected' : ''}>${l}</option>`).join('')}
          </select>
          <button class="btn" id="admin-csv">Exporter (CSV)</button>
          <span class="hint" id="admin-compte"></span>
        </div>
        <div class="table-wrap">
          <table class="admin-table">
            <thead><tr><th>Compte</th><th>Statut</th><th>Inscrit le</th><th>Dernière connexion</th>
              <th class="num">Documents</th><th class="num">Clients</th><th class="num">E-mails</th></tr></thead>
            <tbody id="admin-lignes"></tbody>
          </table>
        </div>
      </section>
      <p class="hint">Mis à jour le ${new Date().toLocaleString('fr-FR')}. Le revenu est une estimation hors TVA, à partir des abonnements en cours.
        Les montants exacts sont dans votre tableau de bord Stripe.</p>`;

    lignesUtilisateurs();
    document.getElementById('admin-rafraichir').addEventListener('click', charger);
    document.getElementById('admin-csv').addEventListener('click', exporterCsv);
    document.getElementById('admin-recherche').addEventListener('input', (ev) => {
      filtre.texte = ev.target.value.trim();
      lignesUtilisateurs();
    });
    document.getElementById('admin-filtre').addEventListener('change', (ev) => {
      filtre.type = ev.target.value;
      lignesUtilisateurs();
    });
  }

  async function charger() {
    const [a, b] = await Promise.all([client.rpc('admin_stats'), client.rpc('admin_utilisateurs')]);
    if (a.error || b.error) {
      message('Impossible de charger les statistiques', esc((a.error || b.error).message)
        + '<br><br>Vérifiez que le fichier <code>supabase/admin.sql</code> a bien été exécuté dans Supabase.');
      return;
    }
    stats = a.data;
    utilisateurs = b.data || [];
    afficher();
  }

  async function demarrer() {
    if (!client) {
      message('Configuration manquante', 'Supabase n\'est pas configuré (js/config.js).');
      return;
    }
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      boutonDeco.hidden = true;
      pageConnexion();
      return;
    }
    boutonDeco.hidden = false;
    const { data: admin, error } = await client.rpc('est_admin');
    if (error) {
      message('Panel pas encore installé', 'Exécutez le fichier <code>supabase/admin.sql</code> dans Supabase (SQL Editor), puis rechargez cette page.');
      return;
    }
    if (admin !== true) {
      message('Accès refusé', `Le compte <strong>${esc(session.user.email)}</strong> n'est pas administrateur.`,
        '<a class="btn" href="app.html">Retour à l\'appli</a>');
      return;
    }
    zone.innerHTML = '<p class="hint">Chargement des statistiques…</p>';
    await charger();
  }

  boutonDeco.addEventListener('click', async () => {
    await client.auth.signOut();
    demarrer();
  });

  demarrer();
})();
