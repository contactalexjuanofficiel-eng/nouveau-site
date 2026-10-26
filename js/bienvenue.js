/*
 * Démarrage guidé d'un nouveau compte : 3 écrans courts au lieu du long
 * formulaire « Mon entreprise ».
 *   1. L'entreprise : le SIRET suffit, nom et adresse viennent de l'annuaire officiel.
 *   2. L'activité : métier (catalogue de prestations types), TVA, assurance décennale.
 *   3. C'est prêt : premier devis tout de suite, ou découverte de l'appli.
 * Rien n'est bloquant : « Plus tard » mène au tableau de bord. Les informations
 * obligatoires sont redemandées seulement au moment de télécharger ou d'envoyer
 * un document (voir profilPret dans app.js).
 */
const Bienvenue = (() => {
  const RETOUR = 'devizo-retour-bienvenue';
  const SOCIETES = ['eurl', 'sarl', 'sasu', 'sas'];
  let trouve = null; // réponse de l'annuaire pour le SIRET saisi
  let manuel = false; // saisie à la main (pas de SIRET sous la main, annuaire en panne…)

  const e = () => data.entreprise;

  // L'annuaire écrit tout en majuscules (« 12 RUE DES LILAS ») : on remet une
  // casse normale (« 12 rue des Lilas »), sauf si le texte contient déjà des minuscules.
  const PETITS = new Set(['de', 'des', 'du', 'la', 'le', 'les', 'l', 'd', 'et', 'à', 'au', 'aux', 'en', 'sur', 'sous']);
  const SIGLES = new Set(['sarl', 'sas', 'sasu', 'eurl', 'ei', 'eirl', 'sa', 'sci', 'snc', 'scop', 'btp', 'za', 'zi', 'zac']);
  const VOIES = new Set(['rue', 'avenue', 'av', 'boulevard', 'bd', 'chemin', 'route', 'impasse', 'allée', 'allee', 'place', 'quai', 'cours', 'passage', 'square', 'lieu-dit', 'lotissement', 'résidence', 'zone', 'za', 'zi']);
  function casse(texte, adresse = false) {
    const t = String(texte || '').trim();
    if (!t || /[a-zà-ÿ]/.test(t)) return t;
    return t.toLowerCase().split(/(\s+|-|'|\(|\))/).map((m, i, tout) => {
      if (/^(\s+|-|'|\(|\))$/.test(m) || !m) return m;
      if (SIGLES.has(m)) return m.toUpperCase();
      const apresParenthese = tout[i - 1] === '(';
      if (i > 0 && !apresParenthese && (PETITS.has(m) || (adresse && VOIES.has(m)))) return m;
      return m.charAt(0).toUpperCase() + m.slice(1);
    }).join('');
  }
  const identiteComplete = () => !profilManquant().some((m) => ['nom', 'rue', 'codePostal', 'ville', 'siret', 'capital'].includes(m.champ));

  // Affiché tout seul à la première ouverture d'un compte neuf.
  const doitAfficher = () => !e().accueilVu && profilManquant().length > 0 && !data.documents.length;

  // Document en attente : { hash, action, id, le } (action = pdf, imprimer, envoi…).
  // Valable 30 minutes et seulement tant qu'on reste dans le démarrage guidé.
  function lireRetour() {
    try {
      const r = JSON.parse(sessionStorage.getItem(RETOUR) || 'null');
      return r && Date.now() - r.le < 30 * 60000 ? r : null;
    } catch (err) {
      return null;
    }
  }
  function oublierRetour() {
    try { sessionStorage.removeItem(RETOUR); } catch (err) { /* rien */ }
  }

  let fin = false;
  function terminer(hash) {
    e().accueilVu = true;
    saveData();
    const retour = lireRetour();
    oublierRetour();
    fin = true;
    if (!hash && retour) {
      // L'action demandée (télécharger, imprimer, envoyer) reprend toute seule.
      if (retour.action) {
        try { sessionStorage.setItem('devizo-action-apres', JSON.stringify(retour)); } catch (err) { /* rien */ }
      }
      go(retour.hash);
    } else go(hash || '#/');
    fin = false;
  }

  // Appelé quand un document ne peut pas encore être téléchargé, imprimé ou envoyé.
  function ouvrir(hash, action = null) {
    try {
      if (hash) sessionStorage.setItem(RETOUR, JSON.stringify({ hash, action: action?.type || '', id: action?.id || '', le: Date.now() }));
    } catch (err) {
      // stockage indisponible
    }
    go('#/bienvenue');
  }
  // Quitter le démarrage autrement (retour arrière, lien) : on oublie le document en attente.
  window.addEventListener('hashchange', (ev) => {
    if (!fin && ev.oldURL.includes('#/bienvenue') && !location.hash.startsWith('#/bienvenue')) oublierRetour();
  });

  function etapes(n) {
    const noms = ['Entreprise', 'Activité', "C'est prêt"];
    return `<ol class="onb-etapes" aria-label="Étapes">${noms.map((nom, i) =>
      `<li class="${i + 1 < n ? 'fait' : i + 1 === n ? 'actif' : ''}"${i + 1 === n ? ' aria-current="step"' : ''}><span>${i + 1 < n ? '✓' : i + 1}</span>${nom}</li>`).join('')}</ol>`;
  }

  function cadre(n, contenu) {
    view.innerHTML = `
      <div class="onb">
        <div class="onb-tete">
          <span class="onb-logo"><img src="img/logo.svg" alt="" width="28" height="28"> Devizo</span>
          ${n < 3 ? '<button type="button" class="onb-plus-tard" data-plus-tard>Plus tard</button>' : ''}
        </div>
        ${etapes(n)}
        <div class="card onb-carte">${contenu}</div>
      </div>`;
    view.querySelector('[data-plus-tard]')?.addEventListener('click', () => terminer('#/'));
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------
  // Étape 1 : l'entreprise
  // ------------------------------------------------------------------
  function etape1() {
    const v = e();
    const formes = Object.entries(FORMES).map(([k, nom]) => `<option value="${k}" ${k === v.formeJuridique ? 'selected' : ''}>${esc(nom)}</option>`).join('');
    cadre(1, `
      <h1>Bienvenue sur Devizo 👋</h1>
      <p class="onb-intro">Commençons par votre entreprise. Ces informations apparaîtront sur vos devis et factures.</p>
      ${manuel ? `
        <form class="onb-form" id="onb-manuel" novalidate>
          <div class="grid-2">
            <div class="onb-pleine"><label for="onb-nom">Nom de l'entreprise</label><input id="onb-nom" name="nom" autocomplete="organization" value="${esc(v.nom)}" placeholder="Ex : Dupont Plomberie"></div>
            <div><label for="onb-forme">Statut</label><select id="onb-forme" name="formeJuridique">${formes}</select></div>
            <div><label for="onb-siret-m">SIRET</label><input id="onb-siret-m" name="siret" inputmode="numeric" autocomplete="off" value="${esc(v.siret)}" placeholder="14 chiffres"></div>
            <div class="onb-pleine"><label for="onb-rue">Adresse</label><input id="onb-rue" name="rue" autocomplete="address-line1" value="${esc(v.rue)}" placeholder="Ex : 12 rue des Lilas"></div>
            <div><label for="onb-cp">Code postal</label><input id="onb-cp" name="codePostal" inputmode="numeric" maxlength="5" autocomplete="postal-code" value="${esc(v.codePostal)}"></div>
            <div><label for="onb-ville">Ville</label><input id="onb-ville" name="ville" autocomplete="address-level2" value="${esc(v.ville)}"></div>
            <div class="onb-pleine" id="onb-capital-champ" ${SOCIETES.includes(v.formeJuridique) ? '' : 'hidden'}><label for="onb-capital">Capital social (€)</label><input id="onb-capital" name="capital" inputmode="decimal" value="${esc(v.capital)}"></div>
          </div>
          <p class="auth-erreur" id="onb-erreur" role="alert" hidden></p>
          <div class="onb-actions"><button class="btn btn-primary btn-lg" type="submit">Continuer</button></div>
          <button type="button" class="onb-lien" data-siret><span aria-hidden="true">←</span> Retrouver mon entreprise avec le SIRET</button>
        </form>` : `
        <form class="onb-form" id="onb-recherche" novalidate>
          <label for="onb-siret">Votre numéro SIRET</label>
          <div class="onb-recherche">
            <input id="onb-siret" inputmode="numeric" autocomplete="off" placeholder="Ex : 123 456 789 00012" value="${esc(v.siret)}">
            <button class="btn btn-primary" type="submit">Rechercher</button>
          </div>
          <p class="hint">On retrouve votre nom et votre adresse dans l'annuaire officiel des entreprises.</p>
          <div id="onb-resultat" aria-live="polite"></div>
          <button type="button" class="onb-lien" data-manuel>Je n'ai pas mon SIRET sous la main : saisir à la main</button>
        </form>`}`);

    view.querySelector('[data-manuel]')?.addEventListener('click', () => { manuel = true; etape1(); });
    view.querySelector('[data-siret]')?.addEventListener('click', () => { manuel = false; etape1(); });

    const recherche = document.getElementById('onb-recherche');
    if (recherche) {
      const champ = document.getElementById('onb-siret');
      // Résultat déjà trouvé pour ce SIRET (retour depuis la saisie à la main) : on le réaffiche.
      if (trouve && ['actif', 'ferme'].includes(trouve.statut) && trouve.siret === champ.value.replace(/\s/g, '')) afficherTrouve();
      recherche.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const siret = champ.value.replace(/\s/g, '');
        const zone = document.getElementById('onb-resultat');
        if (!/^\d{14}$/.test(siret)) return erreurRecherche('Un SIRET contient 14 chiffres : vous le trouvez sur votre avis de situation Insee ou sur autoentrepreneur.urssaf.fr.');
        if (!checkSiret(siret)) return erreurRecherche('Ce SIRET contient une faute de frappe : vérifiez les 14 chiffres.');
        const bouton = recherche.querySelector('button[type=submit]');
        bouton.disabled = true;
        zone.innerHTML = '<p class="hint">Recherche dans l\'annuaire officiel…</p>';
        trouve = await verifierSiret(siret);
        bouton.disabled = false;
        if (trouve.nom) {
          Object.assign(trouve, { nom: casse(trouve.nom), rue: casse(trouve.rue, true), complement: casse(trouve.complement, true), ville: casse(trouve.ville) });
        }
        if (trouve.statut === 'indisponible' || trouve.statut === 'introuvable') {
          // On garde le SIRET et on passe à la saisie à la main.
          e().siret = siret;
          manuel = true;
          etape1();
          const msg = trouve.statut === 'indisponible'
            ? "L'annuaire officiel ne répond pas pour le moment : complétez vos informations à la main."
            : "Ce SIRET n'est pas dans l'annuaire public (entreprise très récente ou non diffusible) : complétez vos informations à la main.";
          const err = document.getElementById('onb-erreur');
          err.textContent = msg;
          err.hidden = false;
          err.classList.add('info');
          return;
        }
        afficherTrouve();
      });
    }

    const formManuel = document.getElementById('onb-manuel');
    if (formManuel) {
      formManuel.formeJuridique.addEventListener('change', () => {
        document.getElementById('onb-capital-champ').hidden = !SOCIETES.includes(formManuel.formeJuridique.value);
      });
      formManuel.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const v = Object.fromEntries(new FormData(formManuel));
        v.siret = v.siret.replace(/\s/g, '');
        const manque = [];
        if (!v.nom.trim()) manque.push("Le nom de l'entreprise");
        if (!v.rue.trim() || !/^\d{5}$/.test(v.codePostal.trim()) || !v.ville.trim()) manque.push("L'adresse complète (rue, code postal, ville)");
        if (!checkSiret(v.siret)) manque.push('Un SIRET valide (14 chiffres)');
        if (SOCIETES.includes(v.formeJuridique) && !String(v.capital || '').trim()) manque.push('Le capital social');
        if (manque.length) {
          const err = document.getElementById('onb-erreur');
          err.classList.remove('info');
          err.innerHTML = listeManque(manque);
          err.hidden = false;
          return;
        }
        Object.assign(e(), v, { adresse: composeAdresse(v) });
        // Saisi à la main alors que l'annuaire ne le connaît pas : on le confirme.
        if (trouve?.siret === v.siret && trouve.statut === 'introuvable') Object.assign(e(), { siretVerifie: trouve, siretConfirme: true });
        saveData();
        etape2();
      });
    }
  }

  // Ce qui manque, en liste : chaque ligne est traduite séparément.
  const listeManque = (manque) => `<span>Il manque :</span><ul class="onb-manque">${manque.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`;

  function erreurRecherche(texte) {
    document.getElementById('onb-resultat').innerHTML = `<p class="auth-erreur" role="alert">${esc(texte)}</p>`;
  }

  function afficherTrouve() {
    const zone = document.getElementById('onb-resultat');
    if (trouve.statut === 'ferme') {
      zone.innerHTML = `<p class="auth-erreur" role="alert">L'établissement ${esc(trouve.nom)} est indiqué comme fermé dans l'annuaire. Vérifiez votre SIRET : il faut celui de votre établissement en activité.</p>`;
      return;
    }
    const societe = SOCIETES.includes(trouve.forme);
    zone.innerHTML = `
      <div class="onb-trouve">
        <p class="onb-trouve-titre">✓ Entreprise trouvée</p>
        <p><strong>${esc(trouve.nom)}</strong><br>${esc(trouve.rue)}${trouve.complement ? '<br>' + esc(trouve.complement) : ''}<br>${esc(trouve.codePostal)} ${esc(trouve.ville)}</p>
        ${trouve.forme ? `<p class="hint">${esc(FORMES[trouve.forme] || '')}</p>` : ''}
        ${societe ? `<label for="onb-capital-t">Capital social (€)</label><input id="onb-capital-t" inputmode="decimal" value="${esc(e().capital || '')}">` : ''}
        <p class="auth-erreur" id="onb-erreur-t" role="alert" hidden></p>
        <div class="onb-actions">
          <button type="button" class="btn btn-primary btn-lg" data-cest-moi>C'est bien moi, continuer</button>
          <button type="button" class="onb-lien" data-pas-moi>Ce n'est pas mon entreprise</button>
        </div>
      </div>`;
    zone.querySelector('[data-pas-moi]').addEventListener('click', () => {
      trouve = null;
      zone.innerHTML = '';
      document.getElementById('onb-siret').select();
    });
    zone.querySelector('[data-cest-moi]').addEventListener('click', () => {
      const capital = document.getElementById('onb-capital-t')?.value.trim() || '';
      if (societe && !capital) {
        const err = document.getElementById('onb-erreur-t');
        err.textContent = 'Indiquez le capital social de votre société : il doit figurer sur vos factures.';
        err.hidden = false;
        return;
      }
      const a = { rue: trouve.rue || trouve.adresse || '', complement: trouve.complement || '', codePostal: trouve.codePostal, ville: trouve.ville };
      Object.assign(e(), a, {
        nom: trouve.nom,
        siret: trouve.siret,
        adresse: composeAdresse(a),
        siretVerifie: trouve,
        ...(trouve.ape ? { ape: trouve.ape } : {}),
        ...(trouve.forme ? { formeJuridique: trouve.forme === 'ei' && e().formeJuridique === 'micro' ? 'micro' : trouve.forme } : {}),
        ...(societe ? { capital } : {}),
      });
      saveData();
      etape2();
    });
    // Une seule action principale : la recherche passe en bouton secondaire.
    document.querySelector('#onb-recherche button[type=submit]')?.classList.remove('btn-primary');
    zone.querySelector('[data-cest-moi]').focus();
  }

  // ------------------------------------------------------------------
  // Étape 2 : l'activité
  // ------------------------------------------------------------------
  function etape2() {
    const v = e();
    const metiers = window.DEVIZO_METIERS || [];
    const individuel = ['micro', 'ei'].includes(v.formeJuridique);
    const franchise = v.franchiseTva !== false;
    cadre(2, `
      <h1>Votre activité</h1>
      <p class="onb-intro">Trois questions, et vos devis auront toutes les mentions obligatoires.</p>
      <form class="onb-form" id="onb-activite" novalidate>
        <fieldset class="onb-question">
          <legend>Votre métier</legend>
          <div class="onb-metiers">
            ${metiers.map((m) => `<label class="onb-puce"><input type="radio" name="metier" value="${esc(m.slug)}" ${v.metier === m.slug ? 'checked' : ''}><span>${esc(m.nom)}</span></label>`).join('')}
            <label class="onb-puce"><input type="radio" name="metier" value="autre" ${v.metier === 'autre' ? 'checked' : ''}><span>Autre</span></label>
          </div>
          <p class="hint">On remplit votre catalogue avec des prestations types de votre métier, à adapter à vos prix.</p>
        </fieldset>

        ${individuel ? `
        <fieldset class="onb-question">
          <legend>Votre statut</legend>
          <div class="onb-choix">
            <label class="choice"><input type="radio" name="formeJuridique" value="micro" ${v.formeJuridique === 'micro' ? 'checked' : ''}><span><strong>Micro-entreprise</strong><small>Auto-entrepreneur</small></span></label>
            <label class="choice"><input type="radio" name="formeJuridique" value="ei" ${v.formeJuridique === 'ei' ? 'checked' : ''}><span><strong>Entreprise individuelle</strong><small>Au régime réel</small></span></label>
          </div>
        </fieldset>` : ''}

        <fieldset class="onb-question">
          <legend>Facturez-vous la TVA ?</legend>
          <div class="onb-choix">
            <label class="choice"><input type="radio" name="tva" value="non" ${franchise ? 'checked' : ''}><span><strong>Non</strong><small>Franchise en base : la mention « <bdi dir="ltr">TVA non applicable, art. 293 B du CGI</bdi> » est ajoutée toute seule</small></span></label>
            <label class="choice"><input type="radio" name="tva" value="oui" ${!franchise ? 'checked' : ''}><span><strong>Oui</strong><small>Les prix sont affichés HT et TTC</small></span></label>
          </div>
          <div id="onb-tva-champ" ${franchise ? 'hidden' : ''}>
            <label for="onb-tva">N° de TVA intracommunautaire</label>
            <input id="onb-tva" name="numeroTva" autocomplete="off" value="${esc(v.numeroTva || tvaFromSiret(v.siret))}" placeholder="FR…">
            <p class="hint">Calculé à partir de votre SIRET : vérifiez-le.</p>
          </div>
        </fieldset>

        <fieldset class="onb-question">
          <legend>Assurance décennale</legend>
          <div class="grid-2" id="onb-decennale" ${v.nonDecennale ? 'hidden' : ''}>
            <div><label for="onb-assureur">Assureur</label><input id="onb-assureur" name="assureur" value="${esc(v.assureur)}" placeholder="Ex : MAAF Pro"></div>
            <div><label for="onb-contrat">N° de contrat</label><input id="onb-contrat" name="numeroContrat" value="${esc(v.numeroContrat)}"></div>
          </div>
          <label class="checkbox"><input type="checkbox" name="nonDecennale" ${v.nonDecennale ? 'checked' : ''}> Mon activité n'est pas soumise à la garantie décennale (dépannage, entretien…)</label>
        </fieldset>

        <p class="auth-erreur" id="onb-erreur" role="alert" hidden></p>
        <div class="onb-actions">
          <button class="btn btn-primary btn-lg" type="submit">Continuer</button>
          <button type="button" class="onb-lien" data-retour><span aria-hidden="true">←</span> Retour</button>
        </div>
      </form>`);

    const form = document.getElementById('onb-activite');
    view.querySelector('[data-retour]').addEventListener('click', () => { manuel = false; etape1(); });
    form.addEventListener('change', () => {
      document.getElementById('onb-tva-champ').hidden = form.tva.value !== 'oui';
      document.getElementById('onb-decennale').hidden = form.nonDecennale.checked;
    });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const tva = fd.get('tva') === 'oui';
      const nonDecennale = fd.has('nonDecennale');
      const valeurs = {
        metier: fd.get('metier') || e().metier || '',
        franchiseTva: !tva,
        numeroTva: tva ? String(fd.get('numeroTva') || '').replace(/\s/g, '').toUpperCase() : e().numeroTva,
        nonDecennale,
        assureur: String(fd.get('assureur') ?? e().assureur ?? '').trim(),
        numeroContrat: String(fd.get('numeroContrat') ?? e().numeroContrat ?? '').trim(),
        ...(fd.get('formeJuridique') ? { formeJuridique: fd.get('formeJuridique') } : {}),
      };
      const manque = [];
      const invalide = (champ, oui) => {
        const el = form.querySelector(`[name=${champ}]`);
        if (el) oui ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid');
      };
      invalide('numeroTva', tva && !checkTva(valeurs.numeroTva));
      invalide('assureur', !nonDecennale && !valeurs.assureur);
      invalide('numeroContrat', !nonDecennale && !valeurs.numeroContrat);
      if (tva && !checkTva(valeurs.numeroTva)) manque.push('Un n° de TVA valide (FR + 11 caractères)');
      if (!nonDecennale && (!valeurs.assureur || !valeurs.numeroContrat)) manque.push("L'assureur et le n° de contrat (ou cochez la case si vous n'êtes pas concerné)");
      if (manque.length) {
        const err = document.getElementById('onb-erreur');
        err.innerHTML = listeManque(manque);
        err.hidden = false;
        return;
      }
      if (tva && !e().tauxActifs?.length) Object.assign(valeurs, { tauxActifs: [20, 10, 5.5], tvaDefaut: 10 });
      Object.assign(e(), valeurs);
      ajouterCatalogue(valeurs.metier);
      saveData();
      etape3();
    });
  }

  // Prestations types du métier, si le catalogue est encore vide.
  let ajoutees = 0;
  function ajouterCatalogue(slug) {
    const m = (window.DEVIZO_METIERS || []).find((x) => x.slug === slug);
    if (!m || catalogue().length) return;
    for (const l of m.lignes) catalogue().push({ id: newId(), categorie: '', ...l, tva: e().franchiseTva ? 0 : l.tva });
    ajoutees = m.lignes.length;
  }

  // ------------------------------------------------------------------
  // Étape 3 : c'est prêt
  // ------------------------------------------------------------------
  function etape3() {
    const manque = profilManquant();
    const m = (window.DEVIZO_METIERS || []).find((x) => x.slug === e().metier);
    const retour = lireRetour();
    cadre(3, `
      <div class="onb-fini">
        <p class="onb-fini-icone" aria-hidden="true">🎉</p>
        <h1>${manque.length ? 'Presque prêt' : 'Tout est prêt'}${e().nom ? `, ${esc(e().nom)}` : ''} !</h1>
        <ul class="onb-bilan">
          ${manque.length ? manque.map((x) => `<li class="manque"><a href="#/parametres?champ=${esc(x.champ)}">${esc(x.texte)}</a></li>`).join('')
            : '<li>Vos devis et factures auront toutes les mentions obligatoires</li>'}
          ${ajoutees && m ? `<li>${ajoutees} prestations ${/^[aeiouyéèêh]/i.test(m.nom) ? "d'" : 'de '}${esc(m.nom.toLowerCase())} ajoutées à votre catalogue (prix indicatifs, à adapter)</li>` : ''}
          <li>14 jours pour tout essayer, sans carte bancaire</li>
        </ul>
        <div class="onb-actions onb-actions-centre">
          ${retour
            ? '<button type="button" class="btn btn-primary btn-lg" data-retour-doc>Revenir à mon document</button>'
            : '<button type="button" class="btn btn-primary btn-lg" data-premier>Faire mon premier devis</button>'}
          <button type="button" class="btn btn-lg" data-decouvrir>Découvrir l'appli</button>
        </div>
        <p class="hint">Votre logo, votre IBAN et vos conditions se règlent quand vous voulez, dans « Mon entreprise ».</p>
      </div>`);
    view.querySelector('[data-premier]')?.addEventListener('click', () => {
      e().accueilVu = true;
      saveData();
      createDocument('devis');
    });
    view.querySelector('[data-retour-doc]')?.addEventListener('click', () => terminer());
    view.querySelector('[data-decouvrir]').addEventListener('click', () => {
      oublierRetour();
      terminer('#/');
    });
  }

  function page() {
    if (!profilManquant().length) etape3();
    else if (identiteComplete()) etape2();
    else etape1();
  }

  return { page, doitAfficher, ouvrir };
})();
