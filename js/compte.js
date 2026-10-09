/*
 * Comptes utilisateurs et sauvegarde en ligne (Supabase).
 *
 * - Sans configuration (js/config.js vide) ou dans l'aperçu, le site
 *   fonctionne comme avant : données sur l'appareil uniquement.
 * - Avec configuration : il faut un compte pour utiliser l'application.
 *   Les données de l'artisan sont gardées dans la table « espaces » et
 *   envoyées automatiquement à chaque modification. Une copie reste sur
 *   l'appareil pour un affichage immédiat et le mode hors ligne.
 * - Formule Équipe : les membres travaillent dans l'espace du titulaire.
 *   Chaque envoi ne réussit que si personne n'a écrit entre-temps ; sinon
 *   les deux versions sont fusionnées (fiche par fiche) avant de réessayer.
 *
 * Chargé avant app.js ; utilise data, saveData, render, view, ask... d'app.js
 * au moment de l'appel.
 */
const Compte = (() => {
  const cfg = window.DEVIZO_CONFIG || {};
  const actif = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase && !window.DEVIZO_DEMO);
  const client = actif
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
    : null;

  let utilisateur = null;
  let renderApp = () => {};
  let minuteurEnvoi = null;
  let envoiEnCours = false;
  let espaceId = null; // compte dont on utilise les données : le sien, ou celui du titulaire de l'équipe
  let equipe = null; // réponse de mon_equipe() (null si la formule Équipe n'est pas installée)
  let versionBrute = null; // « mis_a_jour » exact de la dernière version en ligne connue
  let base = null; // données de cette version, pour fusionner avec celles d'un collègue
  let minuteurEquipe = null;
  let etat = 'ok'; // 'ok' | 'envoi' | 'erreur'

  const adresseRetour = () => location.origin + location.pathname;

  // ------------------------------------------------------------------
  // Indicateur de sauvegarde dans la barre du haut
  // ------------------------------------------------------------------
  function setEtat(nouvel) {
    etat = nouvel;
    let el = document.getElementById('sync');
    if (!el) {
      el = document.createElement('a');
      el.id = 'sync';
      el.href = '#/compte';
      document.querySelector('.topbar .logo')?.after(el);
    }
    el.className = 'sync sync-' + nouvel;
    el.textContent = {
      ok: '✓ Sauvegardé',
      envoi: 'Sauvegarde…',
      erreur: '⚠ Non sauvegardé',
    }[nouvel];
    el.title = nouvel === 'erreur'
      ? 'Pas de connexion : vos modifications sont gardées sur cet appareil et seront envoyées dès le retour du réseau.'
      : 'Vos données sont sauvegardées dans votre compte.';
  }

  // ------------------------------------------------------------------
  // Données en ligne
  // ------------------------------------------------------------------
  function completer(d) {
    return {
      ...structuredClone(DEFAULT_DATA),
      ...d,
      entreprise: { ...structuredClone(DEFAULT_DATA.entreprise), ...(d.entreprise || {}) },
    };
  }

  function garderSurAppareil() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // l'affichage fonctionne quand même
    }
  }

  function remplacerDonnees(d) {
    data = completer(d);
    garderSurAppareil();
  }

  async function lireEnLigne() {
    const { data: ligne, error } = await client
      .from('espaces').select('donnees, mis_a_jour').eq('user_id', espaceId).maybeSingle();
    if (error) throw error;
    return ligne;
  }

  // Prend la version en ligne en gardant les modifications faites ici depuis
  // la dernière version connue. Renvoie les documents renumérotés.
  function appliquerDistant(ligne) {
    const serveur = completer(ligne.donnees || {});
    let renumerotes = [];
    // Sans version connue (premier envoi), tout ce qui est ici compte comme nouveau.
    const res = Fusion.fusionner(base || completer({}), data, serveur);
    data = res.donnees;
    renumerotes = res.renumerotes;
    garderSurAppareil();
    base = structuredClone(serveur);
    versionBrute = ligne.mis_a_jour;
    return renumerotes;
  }

  function signalerRenumerotes(liste) {
    if (!liste.length) return;
    ask(liste.map(([avant, apres]) =>
      `Un membre de l'équipe a créé le numéro ${avant} en même temps que vous : votre document est devenu ${apres}.`).join('\n'),
    "D'accord", false);
  }

  async function envoyer() {
    clearTimeout(minuteurEnvoi);
    minuteurEnvoi = null;
    if (!utilisateur) return;
    if (envoiEnCours) {
      minuteurEnvoi = setTimeout(envoyer, 500); // envoi suivant juste après
      return;
    }
    envoiEnCours = true;
    setEtat('envoi');
    const renumerotes = [];
    try {
      for (let essai = 0; ; essai++) {
        if (essai >= 5) throw new Error('Trop de modifications simultanées');
        const maintenant = new Date().toISOString();
        const copie = JSON.parse(JSON.stringify(data));
        const res = versionBrute === null
          // Premier envoi : l'espace n'existe pas encore.
          ? await client.from('espaces').insert({ user_id: espaceId, donnees: copie, mis_a_jour: maintenant }).select('mis_a_jour')
          // Envoi accepté seulement si la version en ligne est celle qu'on connaît.
          : await client.from('espaces').update({ donnees: copie, mis_a_jour: maintenant })
            .eq('user_id', espaceId).eq('mis_a_jour', versionBrute).select('mis_a_jour');
        if (res.error && res.error.code !== '23505') throw res.error;
        if (!res.error && res.data?.length) {
          versionBrute = res.data[0].mis_a_jour;
          base = copie;
          break;
        }
        // Quelqu'un a enregistré entre-temps : on fusionne puis on réessaie.
        const ligne = await lireEnLigne();
        if (!ligne) throw new Error('Espace introuvable');
        if (versionBrute !== null && Date.parse(ligne.mis_a_jour) === Date.parse(versionBrute)) {
          throw new Error('Modification refusée');
        }
        renumerotes.push(...appliquerDistant(ligne));
        if (!document.activeElement?.matches?.('input, textarea, select')) renderApp();
      }
      setEtat('ok');
    } catch (error) {
      console.warn('Sauvegarde en ligne impossible', error);
      setEtat('erreur');
      minuteurEnvoi = setTimeout(envoyer, 15000); // nouvel essai
    } finally {
      envoiEnCours = false;
    }
    signalerRenumerotes(renumerotes);
  }

  // Appelé par saveData() à chaque modification.
  function modifie() {
    if (!utilisateur) return;
    setEtat('envoi');
    clearTimeout(minuteurEnvoi);
    minuteurEnvoi = setTimeout(envoyer, 800);
  }

  // Au retour sur l'onglet : récupère ce qui a été fait sur un autre appareil.
  async function rafraichir() {
    if (!utilisateur || minuteurEnvoi || envoiEnCours || etat === 'erreur') return;
    try {
      const ligne = await lireEnLigne();
      if (minuteurEnvoi || envoiEnCours) return; // modifié pendant la lecture : l'envoi fusionnera
      if (ligne && (versionBrute === null || Date.parse(ligne.mis_a_jour) !== Date.parse(versionBrute))) {
        appliquerDistant(ligne);
        // Ne pas interrompre une saisie en cours dans un formulaire.
        if (!document.activeElement?.matches?.('input, textarea, select')) renderApp();
      }
    } catch (e) {
      // pas de réseau : on garde ce qu'on a
    }
  }

  // ------------------------------------------------------------------
  // Équipe
  // ------------------------------------------------------------------
  async function chargerEquipe() {
    equipe = null;
    espaceId = utilisateur.id;
    try {
      const { data: res, error } = await client.rpc('mon_equipe');
      if (error) return; // formule Équipe pas encore installée dans la base
      equipe = res;
      if (equipe?.role === 'membre') espaceId = equipe.proprietaire;
    } catch (e) {
      // pas de réseau
    }
  }

  // Invitation reçue : on propose de rejoindre l'équipe.
  async function proposerInvitations() {
    if (equipe?.role !== 'titulaire' || equipe.membres?.length) return;
    const { data: invitations, error } = await client.rpc('mes_invitations');
    if (error || !invitations?.length) return;
    for (const inv of invitations) {
      const ok = await ask(
        `${inv.email_titulaire} vous invite à rejoindre son équipe${inv.entreprise ? ` « ${inv.entreprise} »` : ''} sur Devizo. ` +
        'Vous travaillerez sur les mêmes devis, factures et clients. Vos propres données sont mises de côté : ' +
        "vous les retrouverez si vous quittez l'équipe.",
        "Rejoindre l'équipe", 'Pas maintenant');
      if (!ok) continue;
      const { error: err } = await client.rpc('rejoindre_equipe', { proprio: inv.proprietaire });
      if (err) {
        await ask(messageErreur(err), "D'accord", false);
        continue;
      }
      await chargerEquipe();
      return;
    }
  }

  // Avec des collègues, on va chercher leurs modifications régulièrement.
  function suivreEquipe() {
    clearInterval(minuteurEquipe);
    minuteurEquipe = null;
    if (equipe?.role === 'membre' || equipe?.membres?.length) {
      minuteurEquipe = setInterval(() => {
        if (document.visibilityState === 'visible') rafraichir();
      }, 20000);
    }
  }

  // ------------------------------------------------------------------
  // Démarrage et session
  // ------------------------------------------------------------------
  async function demarrer(render) {
    renderApp = render;
    if (!actif) return render();
    view.innerHTML = '<div class="card auth-loading">Chargement de votre compte…</div>';

    // Retour d'un lien reçu par e-mail (confirmation, mot de passe oublié).
    const hash = location.hash;
    const retourEmail = /access_token|error_description|type=recovery/.test(hash);
    const erreurLien = new URLSearchParams(hash.slice(1)).get('error_description');

    client.auth.onAuthStateChange((evenement) => {
      if (evenement === 'PASSWORD_RECOVERY') setTimeout(() => pageNouveauMotDePasse(), 0);
    });

    const { data: { session } } = await client.auth.getSession();
    if (retourEmail) history.replaceState(null, '', location.pathname + '#/');
    if (/type=recovery/.test(hash) && session) return pageNouveauMotDePasse();
    if (!session) {
      return pageConnexion(hash === '#inscription' ? 'inscription' : 'connexion',
        erreurLien ? 'Ce lien a expiré ou a déjà été utilisé. Connectez-vous ou demandez un nouveau lien.' : '');
    }
    await ouvrirSession(session.user);
  }

  async function ouvrirSession(user) {
    utilisateur = user;
    versionBrute = null;
    base = null;
    document.body.classList.remove('sans-compte');
    if (/^#(inscription|connexion)?$/.test(location.hash)) history.replaceState(null, '', location.pathname + '#/');
    view.innerHTML = '<div class="card auth-loading">Chargement de vos données…</div>';
    await chargerEquipe();
    await proposerInvitations();
    try {
      const ligne = await lireEnLigne();
      if (ligne) {
        remplacerDonnees(ligne.donnees);
        base = structuredClone(data);
        versionBrute = ligne.mis_a_jour;
        setEtat('ok');
      } else if (espaceId !== utilisateur.id) {
        throw new Error("Espace de l'équipe introuvable");
      } else {
        // Premier passage : s'il y a déjà des données sur cet appareil (utilisées
        // sans compte, ou par quelqu'un d'autre), on demande avant de les reprendre.
        const e = data.entreprise;
        const nbDocs = data.documents.length;
        const nbClients = data.clients.length;
        if (e.nom || nbDocs || nbClients || (data.depenses || []).length) {
          const importer = await ask(
            `Des données sont déjà enregistrées sur cet appareil` +
            `${e.nom ? ` (entreprise « ${e.nom} »` : ' ('}${e.nom ? ', ' : ''}${nbDocs} devis et factures, ${nbClients} client${nbClients > 1 ? 's' : ''}). ` +
            `Voulez-vous les mettre dans votre nouveau compte ?`,
            'Oui, les importer', 'Non, partir de zéro');
          if (!importer) remplacerDonnees(structuredClone(DEFAULT_DATA));
        }
        await envoyer();
      }
    } catch (e) {
      console.warn('Lecture des données en ligne impossible', e);
      setEtat('erreur');
    }
    await Abonnement.charger(client, user, equipe);
    suivreEquipe();
    renderApp();
  }

  function oublierSession() {
    utilisateur = null;
    equipe = null;
    espaceId = null;
    versionBrute = null;
    base = null;
    clearInterval(minuteurEquipe);
    minuteurEquipe = null;
  }

  async function deconnecter() {
    if (minuteurEnvoi || etat !== 'ok') await envoyer();
    await client.auth.signOut();
    oublierSession();
    // Rien ne reste sur l'appareil après la déconnexion (appareil partagé).
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // rien à faire
    }
    data = structuredClone(DEFAULT_DATA);
    document.getElementById('sync')?.remove();
    history.replaceState(null, '', location.pathname + '#/');
    pageConnexion('connexion', 'Vous êtes déconnecté.');
  }

  window.addEventListener('focus', rafraichir);
  // Au retour sur l'onglet (par exemple après un paiement), l'abonnement est relu.
  window.addEventListener('focus', async () => {
    if (!utilisateur) return;
    const avant = Abonnement.etat();
    await chargerEquipe();
    await Abonnement.charger(client, utilisateur, equipe);
    if (Abonnement.etat() !== avant) renderApp();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') rafraichir();
  });
  window.addEventListener('online', () => {
    if (etat === 'erreur') envoyer();
  });
  window.addEventListener('beforeunload', (e) => {
    if (utilisateur && (minuteurEnvoi || envoiEnCours)) {
      envoyer();
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // ------------------------------------------------------------------
  // Écrans de connexion
  // ------------------------------------------------------------------
  const MESSAGES = {
    'Invalid login credentials': 'E-mail ou mot de passe incorrect.',
    'Email not confirmed': "Votre adresse e-mail n'est pas encore confirmée. Cliquez sur le lien reçu par e-mail.",
    'User already registered': 'Un compte existe déjà avec cette adresse. Connectez-vous ou utilisez « Mot de passe oublié ».',
    'Password should be at least 6 characters.': 'Le mot de passe doit faire au moins 8 caractères.',
  };
  function messageErreur(error) {
    if (!error) return '';
    if (/rate limit|too many/i.test(error.message)) return 'Trop de tentatives. Patientez quelques minutes puis réessayez.';
    if (/fetch|network/i.test(error.message)) return 'Pas de connexion internet. Vérifiez votre réseau puis réessayez.';
    return MESSAGES[error.message] || "Une erreur s'est produite : " + error.message;
  }

  function pageConnexion(mode = 'connexion', info = '') {
    document.body.classList.add('sans-compte');
    const titres = {
      connexion: ['Se connecter', 'Retrouvez vos devis, factures et clients sur tous vos appareils.'],
      inscription: ['Créer mon compte', '14 jours d’essai gratuit, sans carte bancaire. Vos données sont sauvegardées en ligne et accessibles sur téléphone et ordinateur.'],
      oubli: ['Mot de passe oublié', 'Indiquez votre adresse e-mail : vous recevrez un lien pour choisir un nouveau mot de passe.'],
    };
    const [titre, sousTitre] = titres[mode];
    view.innerHTML = `
      <div class="auth">
        <div class="auth-card card">
          ${mode !== 'oubli' ? `
            <div class="auth-tabs" role="tablist">
              <button type="button" role="tab" aria-selected="${mode === 'connexion'}" data-mode="connexion">Se connecter</button>
              <button type="button" role="tab" aria-selected="${mode === 'inscription'}" data-mode="inscription">Créer un compte</button>
            </div>` : ''}
          <h1>${titre}</h1>
          <p class="auth-sub">${sousTitre}</p>
          ${info ? `<p class="auth-info">${esc(info)}</p>` : ''}
          <form id="auth-form" novalidate>
            <div class="field">
              <label for="auth-email">Adresse e-mail</label>
              <input id="auth-email" name="email" type="email" autocomplete="email" inputmode="email" required>
            </div>
            ${mode !== 'oubli' ? `
              <div class="field">
                <label for="auth-mdp">Mot de passe${mode === 'inscription' ? ' (8 caractères minimum)' : ''}</label>
                <div class="input-row">
                  <input id="auth-mdp" name="mdp" type="password" autocomplete="${mode === 'inscription' ? 'new-password' : 'current-password'}" required minlength="8">
                  <button type="button" class="btn btn-sm" id="auth-voir" aria-label="Afficher le mot de passe">Afficher</button>
                </div>
              </div>` : ''}
            <p class="auth-erreur" id="auth-erreur" role="alert" hidden></p>
            <button class="btn btn-primary btn-lg auth-submit" type="submit">${{ connexion: 'Se connecter', inscription: 'Créer mon compte gratuit', oubli: 'Recevoir le lien' }[mode]}</button>
          </form>
          <p class="auth-links">
            ${mode === 'connexion' ? '<button type="button" class="link" data-mode="oubli">Mot de passe oublié ?</button>' : ''}
            ${mode === 'oubli' ? '<button type="button" class="link" data-mode="connexion">← Retour à la connexion</button>' : ''}
          </p>
          ${mode === 'inscription' ? '<p class="auth-legal">En créant un compte, vous acceptez que vos données soient enregistrées pour faire fonctionner le service. Elles ne sont jamais revendues et vous pouvez supprimer votre compte à tout moment.</p>' : ''}
        </div>
      </div>`;

    view.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => pageConnexion(b.dataset.mode)));
    const mdp = document.getElementById('auth-mdp');
    document.getElementById('auth-voir')?.addEventListener('click', (e) => {
      mdp.type = mdp.type === 'password' ? 'text' : 'password';
      e.target.textContent = mdp.type === 'password' ? 'Afficher' : 'Masquer';
    });
    document.getElementById('auth-email').focus();

    const form = document.getElementById('auth-form');
    const zoneErreur = document.getElementById('auth-erreur');
    const montrerErreur = (texte) => {
      zoneErreur.textContent = texte;
      zoneErreur.hidden = !texte;
    };
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const email = form.email.value.trim();
      const motDePasse = form.mdp?.value || '';
      if (!/^\S+@\S+\.\S+$/.test(email)) return montrerErreur('Indiquez une adresse e-mail valide.');
      if (mode !== 'oubli' && motDePasse.length < 8) return montrerErreur('Le mot de passe doit faire au moins 8 caractères.');
      montrerErreur('');
      const bouton = form.querySelector('.auth-submit');
      bouton.disabled = true;
      bouton.textContent = 'Un instant…';
      try {
        if (mode === 'connexion') {
          const { data: res, error } = await client.auth.signInWithPassword({ email, password: motDePasse });
          if (error) throw error;
          await ouvrirSession(res.user);
        } else if (mode === 'inscription') {
          const { data: res, error } = await client.auth.signUp({
            email, password: motDePasse, options: { emailRedirectTo: adresseRetour() },
          });
          if (error) throw error;
          if (res.session) {
            await ouvrirSession(res.user);
          } else {
            pageConfirmation(email);
          }
        } else {
          const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: adresseRetour() });
          if (error) throw error;
          pageConnexion('connexion', `Si un compte existe pour ${email}, un e-mail avec un lien vient d'être envoyé. Pensez à regarder dans les courriers indésirables.`);
        }
      } catch (error) {
        bouton.disabled = false;
        bouton.textContent = { connexion: 'Se connecter', inscription: 'Créer mon compte gratuit', oubli: 'Recevoir le lien' }[mode];
        montrerErreur(messageErreur(error));
      }
    });
  }

  function pageConfirmation(email) {
    document.body.classList.add('sans-compte');
    view.innerHTML = `
      <div class="auth"><div class="auth-card card">
        <h1>Confirmez votre adresse e-mail</h1>
        <p class="auth-sub">Un e-mail vient d'être envoyé à <strong>${esc(email)}</strong>. Cliquez sur le lien qu'il contient pour activer votre compte.</p>
        <p class="auth-sub">Rien reçu ? Regardez dans les courriers indésirables, ou renvoyez l'e-mail.</p>
        <div class="actions">
          <button class="btn" id="auth-renvoyer">Renvoyer l'e-mail</button>
          <button class="btn btn-primary" id="auth-connexion">J'ai confirmé, me connecter</button>
        </div>
        <p class="auth-info" id="auth-renvoi" hidden></p>
      </div></div>`;
    document.getElementById('auth-connexion').addEventListener('click', () => pageConnexion('connexion'));
    document.getElementById('auth-renvoyer').addEventListener('click', async () => {
      const { error } = await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: adresseRetour() } });
      const el = document.getElementById('auth-renvoi');
      el.hidden = false;
      el.textContent = error ? messageErreur(error) : 'E-mail renvoyé.';
    });
  }

  function pageNouveauMotDePasse() {
    document.body.classList.add('sans-compte');
    view.innerHTML = `
      <div class="auth"><div class="auth-card card">
        <h1>Nouveau mot de passe</h1>
        <p class="auth-sub">Choisissez votre nouveau mot de passe (8 caractères minimum).</p>
        <form id="mdp-form" novalidate>
          <div class="field"><label for="mdp-nouveau">Nouveau mot de passe</label>
            <input id="mdp-nouveau" type="password" autocomplete="new-password" minlength="8" required></div>
          <p class="auth-erreur" id="mdp-erreur" role="alert" hidden></p>
          <button class="btn btn-primary btn-lg auth-submit" type="submit">Enregistrer et continuer</button>
        </form>
      </div></div>`;
    document.getElementById('mdp-nouveau').focus();
    document.getElementById('mdp-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const mdp = document.getElementById('mdp-nouveau').value;
      const err = document.getElementById('mdp-erreur');
      if (mdp.length < 8) {
        err.hidden = false;
        err.textContent = 'Le mot de passe doit faire au moins 8 caractères.';
        return;
      }
      const { data: res, error } = await client.auth.updateUser({ password: mdp });
      if (error) {
        err.hidden = false;
        err.textContent = messageErreur(error);
        return;
      }
      await ouvrirSession(res.user);
    });
  }

  // ------------------------------------------------------------------
  // Mon compte, en mode sans compte (données sur l'appareil uniquement)
  // ------------------------------------------------------------------
  function pageSansCompte() {
    const e = data.entreprise;
    const nb = data.documents.length + data.clients.length + (data.depenses || []).length;
    view.innerHTML = `
      <div class="page-head"><h1>Mon compte</h1></div>
      <section class="card">
        <h2>Vos données sur cet appareil</h2>
        <p>${e.nom ? `Entreprise : <strong>${esc(e.nom)}</strong><br>` : ''}
          ${data.documents.length} devis et factures, ${data.clients.length} client${data.clients.length > 1 ? 's' : ''},
          ${(data.depenses || []).length} dépense${(data.depenses || []).length > 1 ? 's' : ''}.</p>
        <p class="hint">Vos informations sont enregistrées uniquement dans ce navigateur, sur cet appareil.
          Personne d'autre n'y a accès.</p>
        <div class="actions">
          <a class="btn" href="#/parametres?champ=export">Télécharger une sauvegarde</a>
        </div>
      </section>
      <section class="card danger-zone">
        <h2>Tout effacer et recommencer</h2>
        <p>Efface de cet appareil l'entreprise, les clients, les devis, les factures, les dépenses et le catalogue.
          Utile si vous testez le site ou si vous prêtez votre appareil.${nb ? ' Téléchargez d\u2019abord une sauvegarde si vous voulez garder vos documents.' : ''}</p>
        <button class="btn btn-danger" id="local-effacer">Effacer toutes mes données</button>
      </section>`;
    document.getElementById('local-effacer').addEventListener('click', async () => {
      if (!(await ask('Effacer définitivement toutes les données de cet appareil ? Cette action est irréversible.', 'Tout effacer'))) return;
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        // rien à faire
      }
      data = structuredClone(window.DEVIZO_DEMO_DATA || DEFAULT_DATA);
      history.replaceState(null, '', location.pathname + '#/');
      renderApp();
      await ask('Toutes les données ont été effacées. Vous pouvez recommencer depuis le début.', "D'accord", false);
    });
  }

  // ------------------------------------------------------------------
  // Page « Mon compte »
  // ------------------------------------------------------------------
  function page() {
    if (!actif || !utilisateur) {
      pageSansCompte();
      return;
    }
    const cree = utilisateur.created_at ? new Date(utilisateur.created_at) : null;
    view.innerHTML = `
      <div class="page-head"><h1>Mon compte</h1></div>
      <section class="card">
        <h2>Connexion</h2>
        <p>Adresse e-mail : <strong>${esc(utilisateur.email)}</strong></p>
        ${cree ? `<p class="hint">Compte créé le ${cree.toLocaleDateString('fr-FR')}</p>` : ''}
        <p>Sauvegarde : <strong>${{ ok: '✓ à jour', envoi: 'en cours…', erreur: '⚠ en attente du réseau' }[etat]}</strong></p>
        <div class="actions">
          <button class="btn" id="compte-sync">Sauvegarder maintenant</button>
          <button class="btn" id="compte-deco">Se déconnecter</button>
        </div>
      </section>
      ${Abonnement.resume()}
      ${carteEquipe()}
      <section class="card">
        <h2>Changer de mot de passe</h2>
        <form id="compte-mdp" novalidate>
          <div class="input-row">
            <input id="compte-mdp-nouveau" type="password" autocomplete="new-password" minlength="8" placeholder="Nouveau mot de passe (8 caractères minimum)">
            <button class="btn btn-primary" type="submit">Changer</button>
          </div>
          <p class="hint" id="compte-mdp-info"></p>
        </form>
      </section>
      <section class="card danger-zone">
        <h2>Supprimer mon compte</h2>
        <p>Votre compte et toutes vos données (entreprise, clients, devis, factures, dépenses) seront définitivement effacés.
        Téléchargez d'abord une sauvegarde depuis <a href="#/parametres">Mon entreprise</a> si vous voulez garder vos factures :
        la loi vous oblige à les conserver 10 ans.</p>
        <button class="btn btn-danger" id="compte-suppr">Supprimer mon compte</button>
      </section>`;

    brancherEquipe();
    document.getElementById('compte-sync').addEventListener('click', async () => {
      await envoyer();
      page();
    });
    document.getElementById('compte-deco').addEventListener('click', deconnecter);
    document.getElementById('compte-mdp').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const champ = document.getElementById('compte-mdp-nouveau');
      const info = document.getElementById('compte-mdp-info');
      if (champ.value.length < 8) {
        info.textContent = 'Le mot de passe doit faire au moins 8 caractères.';
        info.className = 'hint warn';
        return;
      }
      const { error } = await client.auth.updateUser({ password: champ.value });
      info.textContent = error ? messageErreur(error) : '✓ Mot de passe changé.';
      info.className = 'hint ' + (error ? 'warn' : 'ok');
      if (!error) champ.value = '';
    });
    document.getElementById('compte-suppr').addEventListener('click', async () => {
      const avecEquipe = equipe?.role === 'titulaire' && equipe.membres?.length;
      const message = equipe?.role === 'membre'
        ? "Supprimer définitivement votre compte ? Vous quitterez l'équipe ; ses données restent chez le titulaire. Cette action est irréversible."
        : `Supprimer définitivement votre compte et toutes vos données ?${avecEquipe ? " Les membres de votre équipe n'y auront plus accès non plus." : ''} Cette action est irréversible.`;
      if (!(await ask(message, 'Supprimer définitivement'))) return;
      const { error } = await client.rpc('supprimer_mon_compte');
      if (error) {
        await ask(messageErreur(error), "D'accord", false);
        return;
      }
      clearTimeout(minuteurEnvoi);
      minuteurEnvoi = null;
      oublierSession();
      await client.auth.signOut();
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        // rien à faire
      }
      data = structuredClone(DEFAULT_DATA);
      document.getElementById('sync')?.remove();
      pageConnexion('inscription', 'Votre compte a été supprimé.');
    });
  }

  // ------------------------------------------------------------------
  // Carte « Mon équipe » de la page Mon compte
  // ------------------------------------------------------------------
  const MAX_MEMBRES = 4; // + le titulaire = 5 utilisateurs

  function carteEquipe() {
    if (!equipe) return '';
    if (equipe.role === 'membre') {
      return `<section class="card" id="equipe">
        <h2>Mon équipe</h2>
        <p>Vous travaillez dans l'équipe de <strong>${esc(equipe.email_titulaire)}</strong> : mêmes devis, factures, clients et dépenses.
          L'abonnement est géré par cette personne.</p>
        <button class="btn" id="equipe-quitter">Quitter l'équipe</button>
      </section>`;
    }
    const membres = equipe.membres || [];
    const peutInviter = Abonnement.aAcces('equipe');
    if (!peutInviter && !membres.length) {
      return `<section class="card" id="equipe">
        <h2>Travailler à plusieurs</h2>
        <p>Avec la formule Équipe, jusqu'à 4 collègues (salarié, associé, secrétaire…) utilisent Devizo avec vous, chacun avec son compte, sur les mêmes données.</p>
        <a class="btn" href="#/abonnement">Voir la formule Équipe</a>
      </section>`;
    }
    return `<section class="card" id="equipe">
      <h2>Mon équipe <small class="hint">${membres.length + 1} / ${MAX_MEMBRES + 1} utilisateurs</small></h2>
      <ul class="equipe-liste">
        <li><span><strong>${esc(utilisateur.email)}</strong> (vous, titulaire)</span></li>
        ${membres.map((m) => `<li>
          <span>${esc(m.email)} <small class="${m.actif ? 'ok' : 'hint'}">${m.actif ? '✓ a rejoint l’équipe' : 'invitation en attente'}</small></span>
          <button class="btn btn-sm" data-retirer="${esc(m.email)}">Retirer</button>
        </li>`).join('')}
      </ul>
      ${!peutInviter ? '<p class="status bad">Votre abonnement Équipe n\u2019est plus actif : vos membres ne peuvent plus modifier les données. <a href="#/abonnement">Voir les formules</a></p>' : ''}
      ${peutInviter && membres.length < MAX_MEMBRES ? `
        <form id="equipe-inviter" novalidate>
          <label for="equipe-email">Inviter un collègue</label>
          <div class="input-row">
            <input id="equipe-email" type="email" inputmode="email" autocomplete="off" placeholder="adresse e-mail du collègue">
            <button class="btn btn-primary" type="submit">Inviter</button>
          </div>
          <p class="hint" id="equipe-info">Votre collègue crée son compte Devizo avec cette adresse e-mail (ou se connecte s'il en a déjà un) : Devizo lui propose alors de rejoindre votre équipe.</p>
        </form>
        <div id="equipe-message" class="equipe-message" hidden>
          <p>Envoyez-lui ce message (SMS, WhatsApp, e-mail) :</p>
          <textarea id="equipe-texte" rows="3" readonly></textarea>
          <button class="btn btn-sm" type="button" id="equipe-copier">Copier le message</button>
        </div>` : ''}
    </section>`;  }

  function brancherEquipe() {
    document.getElementById('equipe-quitter')?.addEventListener('click', async () => {
      if (!(await ask(`Quitter l'équipe de ${equipe.email_titulaire} ? Vous n'aurez plus accès à ses devis et factures, et vous retrouverez vos propres données.`, "Quitter l'équipe"))) return;
      if (minuteurEnvoi || etat !== 'ok') await envoyer();
      const { error } = await client.from('membres').delete().eq('membre', utilisateur.id);
      if (error) return ask(messageErreur(error), "D'accord", false);
      history.replaceState(null, '', location.pathname + '#/compte');
      await ouvrirSession(utilisateur);
    });
    view.querySelectorAll('[data-retirer]').forEach((b) => b.addEventListener('click', async () => {
      const email = b.dataset.retirer;
      if (!(await ask(`Retirer ${email} de votre équipe ? Cette personne n'aura plus accès à vos données.`, 'Retirer'))) return;
      const { error } = await client.from('membres').delete().eq('proprietaire', utilisateur.id).eq('email', email);
      if (error) return ask(messageErreur(error), "D'accord", false);
      await chargerEquipe();
      suivreEquipe();
      page();
    }));
    const form = document.getElementById('equipe-inviter');
    form?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const champ = document.getElementById('equipe-email');
      const info = document.getElementById('equipe-info');
      const email = champ.value.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        info.textContent = 'Indiquez une adresse e-mail valide.';
        info.className = 'hint warn';
        return;
      }
      const { error } = await client.rpc('inviter_membre', { adresse: email });
      if (error) {
        info.textContent = error.message;
        info.className = 'hint warn';
        return;
      }
      await chargerEquipe();
      suivreEquipe();
      page();
      const nom = data.entreprise.nom ? ` « ${data.entreprise.nom} »` : '';
      const texte = `Je t'ai invité dans notre équipe${nom} sur Devizo. Crée ton compte avec l'adresse ${email} ici : ` +
        `${location.origin + location.pathname}#inscription (ou connecte-toi si tu as déjà un compte), puis accepte l'invitation.`;
      const boite = document.getElementById('equipe-message');
      if (boite) {
        boite.hidden = false;
        document.getElementById('equipe-texte').value = texte;
      } else {
        await ask(texte, "D'accord", false);
      }
    });
    document.getElementById('equipe-copier')?.addEventListener('click', async (e) => {
      const zone = document.getElementById('equipe-texte');
      try {
        await navigator.clipboard.writeText(zone.value);
      } catch (err) {
        zone.select();
        document.execCommand?.('copy');
      }
      e.target.textContent = '✓ Copié';
    });
  }

  return {
    actif, demarrer, modifie, page, connecte: () => Boolean(utilisateur),
    membre: () => equipe?.role === 'membre',
    titulaireEquipe: () => equipe?.email_titulaire || '',
  };
})();
