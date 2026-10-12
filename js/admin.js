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
  let demandes = null; // demandes d'assistance (null si la table n'existe pas encore)
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
    if (u.abonne && u.offert === 'essai') {
      badges.push(`<span class="badge badge-essai">Essai prolongé · ${date(u.fin_periode)}</span>`);
    } else if (u.abonne && u.offert === 'cadeau') {
      badges.push(`<span class="badge badge-offert">🎁 ${esc(FORMULES[u.formule] || u.formule)} offert${u.fin_periode ? ` · ${date(u.fin_periode)}` : ''}</span>`);
    } else if (u.abonne) {
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
      case 'abonnes': return u.abonne && !u.offert;
      case 'offerts': return u.abonne && Boolean(u.offert);
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
          <td class="num" data-label=""><button type="button" class="btn btn-sm" data-gerer="${esc(u.id)}">Gérer</button></td>
        </tr>`).join('')
      : '<tr><td colspan="8" class="hint">Aucun utilisateur ne correspond.</td></tr>';
  }

  function exporterCsv() {
    const colonnes = ['email', 'entreprise', 'inscrit_le', 'derniere_connexion', 'confirme', 'formule', 'statut', 'abonne',
      'fin_periode', 'fin_prevue', 'offert', 'essai_en_cours', 'membre_de', 'nb_membres', 'documents', 'factures', 'clients', 'emails'];
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

  // ------------------------------------------------------------------
  // Actions sur un compte : essai, offre, e-mail, suppression
  // ------------------------------------------------------------------
  const erreurRpc = (e) => String(e?.message || e || 'Erreur inconnue').replace(/^.*?exception:\s*/i, '');

  async function erreurFonction(error) {
    try {
      const r = error.context;
      if (r && typeof r.json === 'function') {
        const j = await r.json();
        if (j?.erreur) return j.erreur;
        if (r.status === 404) return "La fonction « admin » n'est pas encore déployée dans Supabase.";
        if (j?.message) return `${r.status} ${j.message}`;
      }
    } catch (e) {
      // réponse illisible
    }
    return /Failed to send/i.test(error?.message || '')
      ? "La fonction « admin » n'est pas joignable : vérifiez qu'elle est déployée sous ce nom."
      : error?.message || 'Erreur inconnue';
  }

  function ouvrirActions(id, retour = null) {
    const u = utilisateurs.find((x) => x.id === id);
    if (!u) return;
    const payant = u.abonne && u.stripe && !u.offert && u.statut !== 'canceled';
    document.querySelector('dialog.admin-dialog')?.remove();
    const dialog = document.createElement('dialog');
    dialog.className = 'ask admin-dialog';
    dialog.innerHTML = `
      <div class="admin-dialog-tete">
        <div><h2>${esc(u.email)}</h2><p class="hint">${esc(u.entreprise || 'Entreprise non renseignée')} · inscrit le ${date(u.inscrit_le)}</p></div>
        <button type="button" class="btn btn-sm" data-fermer aria-label="Fermer">✕</button>
      </div>
      <p>${statutUtilisateur(u)}</p>
      ${retour ? `<p class="status ${retour.ok ? 'good' : 'bad'}" role="status">${esc(retour.texte)}</p>` : ''}

      <section class="admin-action">
        <h3>Prolonger l'essai gratuit</h3>
        ${payant ? '<p class="hint">Ce compte paie déjà un abonnement Stripe.</p>' : `
        <p class="hint">Accès complet, comme pendant l'essai. Les jours s'ajoutent à la fin de l'essai actuel.</p>
        <div class="actions"><button type="button" class="btn" data-essai="7">+ 7 jours</button>
          <button type="button" class="btn" data-essai="30">+ 30 jours</button></div>`}
      </section>

      <section class="admin-action">
        <h3>Offrir une formule</h3>
        ${payant ? '<p class="hint">Ce compte paie déjà un abonnement Stripe : gérez-le depuis Stripe.</p>' : `
        <div class="input-row">
          <select id="offre-formule" aria-label="Formule"><option value="pro">Pro</option><option value="equipe">Entreprise</option><option value="solo">Solo</option></select>
          <select id="offre-duree" aria-label="Durée"><option value="1">1 mois</option><option value="3">3 mois</option><option value="6">6 mois</option>
            <option value="12" selected>1 an</option><option value="0">Sans limite</option></select>
          <button type="button" class="btn btn-primary" data-offrir>Offrir</button>
        </div>
        <p class="hint">Gratuit pour la personne, rien n'est prélevé. Si elle s'abonne ensuite par carte, l'abonnement payant remplace l'offre.</p>`}
        ${u.offert && u.abonne ? '<div class="actions"><button type="button" class="btn btn-danger" data-retirer>Retirer l\'offre en cours</button></div>' : ''}
      </section>

      <section class="admin-action">
        <h3>Envoyer un e-mail</h3>
        <input id="mail-objet" maxlength="200" placeholder="Objet">
        <textarea id="mail-message" rows="6">Bonjour,\n\n\n\nBonne journée,\nL'équipe Devizo</textarea>
        <p class="hint">Envoyé depuis contact@devizo-app.fr. Les réponses arrivent sur devizocontact@gmail.com.</p>
        <div class="actions"><button type="button" class="btn btn-primary" data-mail>Envoyer l'e-mail</button></div>
      </section>

      <section class="admin-action danger-zone">
        <h3>Supprimer le compte</h3>
        ${u.admin ? '<p class="hint">Un compte administrateur ne peut pas être supprimé ici.</p>' : payant
          ? '<p class="hint">Ce compte a un abonnement payant en cours : résiliez-le d\'abord dans Stripe, sinon il continuera d\'être prélevé.</p>' : `
        <p class="hint">Le compte et toutes ses données (clients, devis, factures, dépenses) sont effacés définitivement.
          Pour confirmer, recopiez l'adresse e-mail : <strong>${esc(u.email)}</strong></p>
        <div class="input-row"><input id="suppr-confirme" autocomplete="off" placeholder="adresse e-mail du compte">
          <button type="button" class="btn btn-danger" data-supprimer>Supprimer</button></div>`}
      </section>`;
    document.body.appendChild(dialog);
    dialog.showModal();
    dialog.addEventListener('close', () => dialog.remove());
    dialog.querySelector('[data-fermer]').addEventListener('click', () => dialog.close());

    // Lance une action, recharge les données et rouvre la fiche avec le résultat.
    const agir = async (bouton, action, succes) => {
      dialog.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      bouton.textContent = '…';
      let retourAction;
      try {
        const r = await action();
        retourAction = { ok: true, texte: succes(r) };
      } catch (e) {
        retourAction = { ok: false, texte: e.message };
      }
      await charger(true);
      if (utilisateurs.some((x) => x.id === id)) ouvrirActions(id, retourAction);
      else {
        dialog.close();
        alert(retourAction.texte);
      }
    };
    const rpc = async (nom, args) => {
      const { data, error } = await client.rpc(nom, args);
      if (error) throw new Error(erreurRpc(error));
      return data;
    };

    dialog.querySelectorAll('[data-essai]').forEach((b) => b.addEventListener('click', () => agir(b,
      () => rpc('admin_prolonger_essai', { uid: id, jours: Number(b.dataset.essai) }),
      (fin) => `Essai prolongé jusqu'au ${date(fin)}.`)));
    dialog.querySelector('[data-offrir]')?.addEventListener('click', (ev) => {
      const formule = dialog.querySelector('#offre-formule').value;
      const mois = Number(dialog.querySelector('#offre-duree').value);
      agir(ev.currentTarget, () => rpc('admin_offrir', { uid: id, formule, mois }),
        (fin) => `Formule ${FORMULES[formule]} offerte ${fin ? `jusqu'au ${date(fin)}` : 'sans limite de durée'}.`);
    });
    dialog.querySelector('[data-retirer]')?.addEventListener('click', (ev) => {
      if (!confirm("Retirer l'offre ? La personne reviendra à son état normal (essai ou essai terminé).")) return;
      agir(ev.currentTarget, () => rpc('admin_retirer_offre', { uid: id }), () => 'Offre retirée.');
    });
    dialog.querySelector('[data-mail]').addEventListener('click', (ev) => {
      const objet = dialog.querySelector('#mail-objet').value.trim();
      const message = dialog.querySelector('#mail-message').value.trim();
      if (!objet) {
        dialog.querySelector('#mail-objet').focus();
        return;
      }
      agir(ev.currentTarget, async () => {
        const { error } = await client.functions.invoke('admin', { body: { action: 'email', a: u.email, objet, message } });
        if (error) throw new Error(await erreurFonction(error));
      }, () => `E-mail envoyé à ${u.email}.`);
    });
    dialog.querySelector('[data-supprimer]')?.addEventListener('click', (ev) => {
      const saisie = dialog.querySelector('#suppr-confirme').value.trim().toLowerCase();
      if (saisie !== String(u.email).toLowerCase()) {
        dialog.querySelector('#suppr-confirme').focus();
        return;
      }
      agir(ev.currentTarget, () => rpc('admin_supprimer_compte', { uid: id }), () => `Le compte ${u.email} a été supprimé.`);
    });
  }

  // ------------------------------------------------------------------
  // Revenu encaissé mois par mois (factures Stripe, via la fonction « admin »)
  // ------------------------------------------------------------------
  let revenus = null; // { mois: [...] } ou { erreur }

  function blocRevenus() {
    if (!revenus) return '<p class="hint">Chargement du revenu depuis Stripe…</p>';
    if (revenus.erreur) return `<p class="hint">Revenu mois par mois indisponible : ${esc(revenus.erreur)}</p>`;
    const mois = revenus.mois.map((m) => ({ ...m, jour: m.mois + '-15', libelle: new Date(m.mois + '-15T12:00:00').toLocaleDateString('fr-FR', { month: 'short' }) }));
    const total = mois.reduce((t, m) => t + m.ht, 0);
    const max = Math.max(1, ...mois.map((m) => m.ht));
    const colonnes = mois.map((m) => `
      <div class="rev-col" title="${esc(new Date(m.jour + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))} : ${euro(m.ht)} HT (${euro(m.ttc)} TTC), ${m.factures} paiement(s)">
        <span class="rev-barre" style="height:${m.ht ? Math.max(2, Math.round((m.ht / max) * 100)) : 0}%"><span class="rev-val">${m.ht ? nb(Math.round(m.ht)) + ' €' : ''}</span></span>
        <span class="rev-mois">${esc(m.libelle.replace('.', ''))}</span>
      </div>`).join('');
    return `<p class="admin-graph-titre">Encaissé par mois (HT) <span>${euro(total)} HT sur 12 mois</span></p>
      <div class="rev-graph" role="img" aria-label="Revenu encaissé par mois">${colonnes}</div>
      <p class="hint">Paiements Stripe réellement encaissés (remboursements non déduits).</p>`;
  }

  async function chargerRevenus() {
    const { data, error } = await client.functions.invoke('admin', { body: { action: 'revenus' } });
    revenus = error ? { erreur: await erreurFonction(error) } : data;
    const bloc = document.getElementById('admin-revenus');
    if (bloc) bloc.innerHTML = blocRevenus();
  }

  // Liste « libellé : nombre » avec une barre proportionnelle.
  const SOURCES = {
    direct: 'Lien direct / favori', google: 'Google', bing: 'Bing', 'autre-moteur': 'Autre moteur de recherche',
    facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', youtube: 'YouTube', x: 'X (Twitter)',
    whatsapp: 'WhatsApp', pinterest: 'Pinterest', snapchat: 'Snapchat', email: 'E-mail', 'autre-site': 'Autre site',
  };
  const APPAREILS = { mobile: '📱 Téléphone', ordinateur: '💻 Ordinateur', tablette: 'Tablette', inconnu: 'Inconnu' };

  function repartition(valeurs, libelles) {
    const lignes = Object.entries(valeurs || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    const total = lignes.reduce((t, [, n]) => t + Number(n), 0);
    if (!total) return '<p class="hint">Pas encore de données : elles arrivent avec les prochaines visites.</p>';
    return `<ul class="admin-repartition">${lignes.map(([cle, n]) => `
      <li><span class="admin-rep-libelle">${esc(libelles[cle] || cle)}</span>
        <span class="admin-rep-barre"><span style="width:${Math.max(2, Math.round((n / total) * 100))}%"></span></span>
        <span class="admin-rep-n">${nb(n)} <small>${pourcent(n, total)}</small></span></li>`).join('')}</ul>`;
  }

  // ------------------------------------------------------------------
  // Demandes d'assistance
  // ------------------------------------------------------------------
  const CATEGORIES = { question: 'Question', probleme: 'Problème', abonnement: 'Abonnement', suggestion: 'Suggestion' };

  function carteDemande(d) {
    const lien = `mailto:${encodeURIComponent(d.email)}?subject=${encodeURIComponent('Re: ' + d.sujet)}&body=${encodeURIComponent(`Bonjour,\n\n\n\nBonne journée,\nL'équipe Devizo\n\n---\nVotre message :\n${d.message}`)}`;
    const contexte = d.contexte ? Object.entries(d.contexte).map(([k, v]) => `<li><strong>${esc(k)}</strong> : ${esc(v)}</li>`).join('') : '';
    return `<article class="demande${d.prioritaire ? ' demande-prio' : ''}${d.traitee_le ? ' demande-traitee' : ''}">
      <div class="demande-tete">
        <span class="badges">${d.prioritaire ? '<span class="badge badge-retard">⚡ Prioritaire</span>' : ''}
          ${d.notifiee ? '' : '<span class="badge badge-fin" title="L\'e-mail de notification n\'a pas pu partir : voir les Logs de la fonction « admin » dans Supabase">✉ E-mail non envoyé</span>'}
          <span class="badge">${esc(CATEGORIES[d.categorie] || d.categorie)}</span>
          <span class="badge">${esc((d.formule || '—').replace('equipe', 'Entreprise').replace('pro', 'Pro').replace('solo', 'Solo'))}</span></span>
        <small>${new Date(d.cree_le).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</small>
      </div>
      <p class="demande-sujet">${esc(d.sujet)}</p>
      <p class="demande-de">${esc(d.email)}</p>
      <p class="demande-message">${esc(d.message)}</p>
      ${contexte ? `<details><summary>Informations techniques</summary><ul>${contexte}</ul></details>` : ''}
      <div class="actions">
        <a class="btn btn-sm btn-primary" href="${lien}">Répondre par e-mail</a>
        <button type="button" class="btn btn-sm" data-traiter="${d.id}" data-etat="${d.traitee_le ? 'rouvrir' : 'traiter'}">${d.traitee_le ? 'Rouvrir' : '✓ Marquer traitée'}</button>
        ${d.traitee_le ? `<button type="button" class="btn btn-sm btn-danger" data-supprimer-demande="${d.id}">Supprimer</button>` : ''}
      </div>
    </article>`;
  }

  function blocAssistance() {
    if (!demandes) return '';
    const ouvertes = demandes.filter((d) => !d.traitee_le);
    const traitees = demandes.filter((d) => d.traitee_le).slice(0, 20);
    return `<h2 class="admin-section-titre">Assistance</h2>
      <section class="card">
        <p class="admin-graph-titre">${ouvertes.length ? `${nb(ouvertes.length)} demande(s) à traiter` : 'Aucune demande en attente 👍'}
          <span>${nb(ouvertes.filter((d) => d.prioritaire).length)} prioritaire(s)</span></p>
        ${ouvertes.map(carteDemande).join('')}
        ${traitees.length ? `<details class="demandes-traitees"><summary>Demandes traitées (${traitees.length})</summary>${traitees.map(carteDemande).join('')}</details>` : ''}
      </section>`;
  }

  async function chargerDemandes() {
    const { data, error } = await client.from('demandes_assistance').select('*')
      .order('prioritaire', { ascending: false }).order('cree_le', { ascending: false }).limit(200);
    demandes = error ? null : data;
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
      ${blocAssistance()}

      <h2 class="admin-section-titre">Argent</h2>
      <div class="admin-kpis">
        ${carte('Revenu mensuel estimé (HT)', euro(s.revenu_mensuel_ht), `soit ${euro(s.revenu_mensuel_ht * 12)} par an`, true)}
        ${carte('Abonnés payants', nb(s.abonnes), detailFormules, true)}
        ${carte('Dont abonnements annuels', nb(s.abonnes_annuels), `${pourcent(s.abonnes_annuels, s.abonnes)} des abonnés`)}
        ${carte('Résiliations prévues', nb(s.resiliations_prevues), `${nb(s.paiements_en_retard)} paiement(s) en retard`)}
      </div>
      <section class="card" id="admin-revenus">${blocRevenus()}</section>

      <h2 class="admin-section-titre">Utilisateurs</h2>
      <div class="admin-kpis">
        ${carte('Comptes créés', nb(s.utilisateurs), `+${nb(s.nouveaux_7j)} en 7 j · +${nb(s.nouveaux_30j)} en 30 j`)}
        ${carte('En essai gratuit', nb(s.en_essai), '14 jours après l\'inscription')}
        ${carte('Taux de conversion', pourcent(s.abonnes, s.utilisateurs), 'abonnés / comptes créés')}
        ${carte('Actifs', nb(s.actifs_7j), `connectés en 7 j · ${nb(s.actifs_30j)} en 30 j`)}
        ${carte('Membres d\'équipe', nb(s.membres_equipe), `${nb(s.non_confirmes)} e-mail(s) non confirmé(s)`)}
        ${carte('Offerts par vous', nb(s.offerts || 0), `${nb(s.essais_prolonges || 0)} essai(s) prolongé(s)`)}
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
      <div class="admin-deux">
        <section class="card"><h2>D'où viennent les visiteurs</h2>${repartition(s.sources_30j, SOURCES)}</section>
        <section class="card"><h2>Téléphone ou ordinateur</h2>${repartition(s.appareils_30j, APPAREILS)}</section>
      </div>

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
            ${[['tous', 'Tous'], ['abonnes', 'Abonnés payants'], ['offerts', 'Offerts / essai prolongé'], ['essai', 'En essai'], ['perdus', 'Essai terminé, sans abonnement'],
              ['membres', 'Membres d\'équipe'], ['inactifs', 'Inactifs depuis 30 j'], ['non-confirmes', 'E-mail non confirmé']]
              .map(([v, l]) => `<option value="${v}"${filtre.type === v ? ' selected' : ''}>${l}</option>`).join('')}
          </select>
          <button class="btn" id="admin-csv">Exporter (CSV)</button>
          <span class="hint" id="admin-compte"></span>
        </div>
        <div class="table-wrap">
          <table class="admin-table">
            <thead><tr><th>Compte</th><th>Statut</th><th>Inscrit le</th><th>Dernière connexion</th>
              <th class="num">Documents</th><th class="num">Clients</th><th class="num">E-mails</th><th><span class="sr-only">Actions</span></th></tr></thead>
            <tbody id="admin-lignes"></tbody>
          </table>
        </div>
      </section>
      <p class="hint">Mis à jour le ${new Date().toLocaleString('fr-FR')}. Le revenu est une estimation hors TVA, à partir des abonnements en cours.
        Les montants exacts sont dans votre tableau de bord Stripe.</p>`;

    lignesUtilisateurs();
    zone.querySelectorAll('[data-traiter]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      const { error } = await client.from('demandes_assistance')
        .update({ traitee_le: b.dataset.etat === 'traiter' ? new Date().toISOString() : null }).eq('id', Number(b.dataset.traiter));
      if (error) {
        b.disabled = false;
        alert(error.message);
        return;
      }
      await charger(true);
    }));
    zone.querySelectorAll('[data-supprimer-demande]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Supprimer définitivement cette demande ?')) return;
      b.disabled = true;
      const { error } = await client.from('demandes_assistance').delete().eq('id', Number(b.dataset.supprimerDemande));
      if (error) {
        b.disabled = false;
        alert(error.message);
        return;
      }
      await charger(true);
    }));
    document.getElementById('admin-lignes').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-gerer]');
      if (b) ouvrirActions(b.dataset.gerer);
    });
    document.getElementById('admin-rafraichir').addEventListener('click', () => {
      revenus = null;
      charger().then(chargerRevenus);
    });
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

  async function charger(discret = false) {
    const [a, b] = await Promise.all([client.rpc('admin_stats'), client.rpc('admin_utilisateurs'), chargerDemandes()]);
    if (a.error || b.error) {
      if (discret) return;
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
    chargerRevenus();
  }

  boutonDeco.addEventListener('click', async () => {
    await client.auth.signOut();
    demarrer();
  });

  demarrer();
})();
