/*
 * Outils gratuits des pages publiques (sans compte) :
 *  - #outil-tva : quel taux de TVA pour des travaux, et calcul HT ↔ TTC ;
 *  - #outil-cotisations : cotisations et reste d'un micro-entrepreneur ;
 *  - #outil-siret : vérification d'un numéro SIRET dans l'annuaire officiel.
 * Les taux sont ceux de l'appli (js/dashboard.js) : à mettre à jour ensemble.
 */
(() => {
  const euro = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number.isFinite(n) ? n : 0);
  const nombre = (v) => Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')) || 0;
  const tauxFr = (t) => String(t).replace('.', ',');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cta = (texte) => `<div class="outil-cta"><p>${texte}</p>
    <a class="btn btn-primary" href="app.html#inscription">Essai gratuit 14 jours</a></div>`;

  // ------------------------------------------------------------------
  // TVA des travaux
  // ------------------------------------------------------------------
  const tva = document.getElementById('outil-tva');
  if (tva) {
    const QUESTIONS = [
      { id: 'franchise', q: 'Facturez-vous la TVA ?', r: [['oui', 'Oui'], ['non', 'Non, je suis en franchise (micro-entreprise sous le seuil)']] },
      { id: 'soustraitance', q: "Travaillez-vous en sous-traitance pour une autre entreprise du bâtiment ?", r: [['non', 'Non, je facture le client final'], ['oui', "Oui, je suis sous-traitant d'une entreprise"]] },
      { id: 'lieu', q: 'Où ont lieu les travaux ?', r: [['logement', 'Dans un logement (maison, appartement, parties communes)'], ['pro', 'Dans un local professionnel ou commercial']] },
      { id: 'age', q: 'Le logement est-il terminé depuis plus de 2 ans ?', r: [['oui', 'Oui, plus de 2 ans'], ['non', 'Non, moins de 2 ans ou construction neuve']] },
      { id: 'nature', q: 'Quels travaux faites-vous ?', r: [
        ['energie', "Rénovation énergétique : isolation, pompe à chaleur, chaudière à haute performance, fenêtres isolantes…"],
        ['amelioration', 'Amélioration, transformation, aménagement ou entretien : salle de bain, cuisine, électricité, peinture, plomberie…'],
        ['neuf', "Agrandissement (surface en plus), surélévation, ou remise à neuf de plus de la moitié du gros œuvre"],
        ['materiel', 'Vente de matériel seul, sans la pose']] },
    ];
    const rep = {};
    function resultat() {
      if (rep.franchise === 'non') return { taux: 0, titre: 'Pas de TVA', texte: 'En franchise de TVA, vous ne facturez pas de TVA : vos prix sont HT = TTC. Mention obligatoire sur vos devis et factures : « TVA non applicable, art. 293 B du CGI ».' };
      if (rep.soustraitance === 'oui') return { taux: 0, titre: 'Autoliquidation (0 %)', texte: "En sous-traitance BTP, c'est l'entreprise principale qui déclare la TVA. Vous facturez HT avec la mention « Autoliquidation : TVA due par le preneur (article 283-2 nonies du CGI) »." };
      if (rep.lieu === 'pro') return { taux: 20, titre: 'TVA à 20 %', texte: "Les travaux dans un local professionnel ou commercial sont au taux normal de 20 %." };
      if (rep.age === 'non') return { taux: 20, titre: 'TVA à 20 %', texte: "Dans un logement de moins de 2 ans ou une construction neuve, c'est le taux normal de 20 %." };
      if (rep.nature === 'materiel') return { taux: 20, titre: 'TVA à 20 %', texte: "La vente de matériel seul, sans la pose, est au taux normal de 20 %. Si vous fournissez et posez, le matériel suit le taux des travaux." };
      if (rep.nature === 'neuf') return { taux: 20, titre: 'TVA à 20 %', texte: "Les travaux qui créent de la surface ou qui remettent le bâtiment à neuf sont au taux normal de 20 %, même dans un logement ancien." };
      if (rep.nature === 'energie') return { taux: 5.5, titre: 'TVA à 5,5 %', texte: "La rénovation énergétique d'un logement de plus de 2 ans bénéficie du taux réduit de 5,5 %, pour les équipements et travaux qui respectent les critères de performance fixés par la loi.", attestation: true };
      if (rep.nature === 'amelioration') return { taux: 10, titre: 'TVA à 10 %', texte: "Les travaux d'amélioration, de transformation, d'aménagement et d'entretien d'un logement de plus de 2 ans sont au taux intermédiaire de 10 %.", attestation: true };
      return null;
    }
    function questionsVisibles() {
      const liste = [QUESTIONS[0]];
      if (rep.franchise === 'oui') liste.push(QUESTIONS[1]);
      if (rep.soustraitance === 'non') liste.push(QUESTIONS[2]);
      if (rep.lieu === 'logement') liste.push(QUESTIONS[3]);
      if (rep.age === 'oui') liste.push(QUESTIONS[4]);
      return liste;
    }
    let montant = '1000';
    let sens = 'ht';
    function afficher() {
      const r = resultat();
      const qs = questionsVisibles();
      tva.innerHTML = `
        <div class="outil-carte">
          ${qs.map((q, i) => `<fieldset class="outil-question">
            <legend><span>${i + 1}</span>${q.q}</legend>
            <div class="outil-choix">${q.r.map(([v, l]) => `<label class="${rep[q.id] === v ? 'choisi' : ''}"><input type="radio" name="${q.id}" value="${v}"${rep[q.id] === v ? ' checked' : ''}> ${l}</label>`).join('')}</div>
          </fieldset>`).join('')}
          ${r ? `<div class="outil-resultat" role="status">
            <p class="outil-taux">${r.titre}</p>
            <p>${r.texte}</p>
            ${r.attestation ? '<p class="outil-note">⚠️ Le client doit attester que son logement a plus de 2 ans et que les travaux remplissent les conditions du taux réduit. Gardez cette attestation avec votre facture. Les règles détaillées et les formulaires sont sur <a href="https://www.impots.gouv.fr/" rel="noopener" target="_blank">impots.gouv.fr</a>.</p>' : ''}
            <div class="outil-calcul">
              <p class="outil-sous-titre">Calculer le prix ${r.taux ? `avec la TVA à ${tauxFr(r.taux)} %` : ''}</p>
              <div class="outil-ligne">
                <input id="tva-montant" inputmode="decimal" value="${esc(montant)}" aria-label="Montant en euros">
                <select id="tva-sens" aria-label="Le montant est"><option value="ht"${sens === 'ht' ? ' selected' : ''}>€ HT</option><option value="ttc"${sens === 'ttc' ? ' selected' : ''}>€ TTC</option></select>
              </div>
              <div class="outil-chiffres" id="tva-chiffres"></div>
            </div>
          </div>
          ${cta('Avec Devizo, choisissez le taux de TVA ligne par ligne : les totaux et les mentions obligatoires se mettent tout seuls sur vos devis et factures.')}` : ''}
        </div>`;
      if (r) calculer(r);
    }
    function calculer(r) {
      const m = nombre(montant);
      const ht = sens === 'ht' ? m : m / (1 + r.taux / 100);
      const t = (ht * r.taux) / 100;
      document.getElementById('tva-chiffres').innerHTML = `<div><span>Montant HT</span><strong>${euro(ht)}</strong></div>
        <div><span>TVA ${tauxFr(r.taux)} %</span><strong>${euro(t)}</strong></div>
        <div class="fort"><span>Montant TTC</span><strong>${euro(ht + t)}</strong></div>`;
    }
    tva.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.type === 'radio') {
        rep[t.name] = t.value;
        // Une réponse change la suite : on efface les réponses suivantes.
        const ordre = QUESTIONS.map((q) => q.id);
        ordre.slice(ordre.indexOf(t.name) + 1).forEach((id) => delete rep[id]);
        afficher();
        if (resultat()) {
          tva.querySelector('.outil-resultat')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
      if (t.id === 'tva-sens') {
        sens = t.value;
        calculer(resultat());
      }
    });
    tva.addEventListener('input', (ev) => {
      if (ev.target.id === 'tva-montant') {
        montant = ev.target.value;
        calculer(resultat());
      }
    });
    afficher();
  }

  // ------------------------------------------------------------------
  // Cotisations d'un micro-entrepreneur (mêmes taux que l'appli)
  // ------------------------------------------------------------------
  const cotis = document.getElementById('outil-cotisations');
  if (cotis) {
    const MICRO = {
      services: { label: 'Prestations de services artisanales ou commerciales (BIC)', aide: 'Plombier, électricien, peintre, maçon, menuisier…', cotis: 21.2, cfp: 0.3, vl: 1.7, plafond: 83600, seuilTva: 37500 },
      vente: { label: 'Vente de marchandises (BIC)', aide: 'Achat-revente, vente de matériel', cotis: 12.3, cfp: 0.1, vl: 1, plafond: 203100, seuilTva: 85000 },
      liberal: { label: 'Activité libérale (BNC)', aide: "Conseil, bureau d'études, architecte d'intérieur…", cotis: 25.6, cfp: 0.2, vl: 2.2, plafond: 83600, seuilTva: 37500 },
    };
    const s = { activite: 'services', ca: '3000', periode: 'mois', depenses: '400', vl: false };
    function afficher() {
      cotis.innerHTML = `
        <div class="outil-carte">
          <fieldset class="outil-question">
            <legend><span>1</span>Votre activité</legend>
            <div class="outil-choix">${Object.entries(MICRO).map(([k, m]) => `<label class="${s.activite === k ? 'choisi' : ''}"><input type="radio" name="activite" value="${k}"${s.activite === k ? ' checked' : ''}> <span>${m.label}<small>${m.aide}</small></span></label>`).join('')}</div>
          </fieldset>
          <fieldset class="outil-question">
            <legend><span>2</span>Ce que vous encaissez</legend>
            <div class="outil-ligne">
              <input id="c-ca" inputmode="decimal" value="${esc(s.ca)}" aria-label="Chiffre d'affaires encaissé">
              <select id="c-periode" aria-label="Période"><option value="mois"${s.periode === 'mois' ? ' selected' : ''}>€ par mois</option><option value="an"${s.periode === 'an' ? ' selected' : ''}>€ par an</option></select>
            </div>
            <label class="outil-label" for="c-dep">Vos dépenses (matériel, carburant, outillage…) sur la même période</label>
            <div class="outil-ligne"><input id="c-dep" inputmode="decimal" value="${esc(s.depenses)}"><span class="outil-unite">€</span></div>
            <label class="outil-case"><input type="checkbox" id="c-vl"${s.vl ? ' checked' : ''}> J'ai choisi le versement libératoire de l'impôt sur le revenu</label>
          </fieldset>
          <div class="outil-resultat" role="status" id="c-resultat"></div>
          ${cta("Devizo fait ce calcul tout seul, chaque mois, à partir de vos factures payées et de vos dépenses : vous savez toujours combien il vous reste.")}
        </div>`;
      calculer();
    }
    function calculer() {
      const m = MICRO[s.activite];
      const ca = nombre(s.ca);
      const dep = nombre(s.depenses);
      const cotisations = (ca * (m.cotis + m.cfp)) / 100;
      const impot = s.vl ? (ca * m.vl) / 100 : 0;
      const reste = ca - dep - cotisations - impot;
      const annuel = s.periode === 'mois' ? ca * 12 : ca;
      const part = (v) => Math.min(100, Math.round((annuel / v) * 100));
      const p = s.periode === 'mois' ? 'par mois' : 'par an';
      document.getElementById('c-resultat').innerHTML = `
        <div class="outil-chiffres">
          <div><span>Chiffre d'affaires encaissé</span><strong>${euro(ca)}</strong></div>
          <div><span>Dépenses</span><strong>− ${euro(dep)}</strong></div>
          <div><span>Cotisations sociales (${tauxFr(m.cotis)} %) et formation (${tauxFr(m.cfp)} %)</span><strong>− ${euro(cotisations)}</strong></div>
          ${s.vl ? `<div><span>Impôt sur le revenu, versement libératoire (${tauxFr(m.vl)} %)</span><strong>− ${euro(impot)}</strong></div>` : ''}
          <div class="fort"><span>Il vous reste ${p}</span><strong>${euro(reste)}</strong></div>
        </div>
        ${s.vl ? '' : '<p class="outil-note">Sans le versement libératoire, l\'impôt sur le revenu dépend de votre foyer fiscal : il n\'est pas compté ici.</p>'}
        <div class="outil-jauges">
          <div><p>Plafond du chiffre d'affaires de la micro-entreprise : <strong>${euro(m.plafond)}</strong> par an</p><div class="outil-jauge"><span style="width:${part(m.plafond)}%"></span></div><small>${part(m.plafond)} % atteint sur l'année</small></div>
          <div><p>Seuil de la franchise de TVA : <strong>${euro(m.seuilTva)}</strong> par an</p><div class="outil-jauge${part(m.seuilTva) >= 90 ? ' alerte' : ''}"><span style="width:${part(m.seuilTva)}%"></span></div><small>${part(m.seuilTva) >= 100 ? 'Seuil dépassé : vous devez facturer la TVA' : `${part(m.seuilTva)} % atteint sur l'année`}</small></div>
        </div>
        <p class="outil-note">Estimation avec les taux utilisés par Devizo en 2026, hors ACRE et hors cotisation foncière des entreprises (CFE). Elle ne remplace pas votre déclaration à l'Urssaf : les taux officiels sont sur <a href="https://www.autoentrepreneur.urssaf.fr/" rel="noopener" target="_blank">autoentrepreneur.urssaf.fr</a>.</p>`;
    }
    cotis.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t.name === 'activite') {
        s.activite = t.value;
        afficher();
      } else if (t.id === 'c-ca') s.ca = t.value;
      else if (t.id === 'c-dep') s.depenses = t.value;
      else if (t.id === 'c-periode') s.periode = t.value;
      else if (t.id === 'c-vl') s.vl = t.checked;
      if (t.name !== 'activite') calculer();
    });
    afficher();
  }

  // ------------------------------------------------------------------
  // Vérification d'un SIRET (clé de contrôle + annuaire officiel)
  // ------------------------------------------------------------------
  const siret = document.getElementById('outil-siret');
  if (siret) {
    const cleValide = (d) => {
      if (!/^\d{14}$/.test(d)) return false;
      if (d.startsWith('356000000')) return d.split('').reduce((a, c) => a + Number(c), 0) % 5 === 0; // La Poste
      let somme = 0;
      for (let i = 0; i < 14; i++) {
        let n = Number(d[i]);
        if (i % 2 === 0) {
          n *= 2;
          if (n > 9) n -= 9;
        }
        somme += n;
      }
      return somme % 10 === 0;
    };
    siret.innerHTML = `
      <div class="outil-carte">
        <form class="outil-ligne outil-siret-form" novalidate>
          <input id="s-num" inputmode="numeric" autocomplete="off" placeholder="Ex : 123 456 789 00012" aria-label="Numéro SIRET ou SIREN">
          <button class="btn btn-primary" type="submit">Vérifier</button>
        </form>
        <div id="s-resultat" role="status"></div>
        ${cta('Dans Devizo, votre SIRET et celui de vos clients professionnels sont vérifiés automatiquement, et l\'adresse se remplit toute seule.')}
      </div>`;
    const zone = siret.querySelector('#s-resultat');
    siret.querySelector('form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const d = siret.querySelector('#s-num').value.replace(/[\s.-]/g, '');
      if (/^\d{9}$/.test(d)) {
        zone.innerHTML = '<p class="outil-note">C\'est un numéro SIREN (9 chiffres) : il identifie l\'entreprise. Le SIRET (14 chiffres) identifie un établissement : c\'est le SIREN suivi de 5 chiffres. Recherche en cours…</p>';
      } else if (!/^\d{14}$/.test(d)) {
        zone.innerHTML = '<div class="outil-resultat ko"><p class="outil-taux">Format incorrect</p><p>Un SIRET contient exactement 14 chiffres (un SIREN, 9 chiffres).</p></div>';
        return;
      } else if (!cleValide(d)) {
        zone.innerHTML = '<div class="outil-resultat ko"><p class="outil-taux">❌ Numéro invalide</p><p>Ce numéro ne respecte pas la clé de contrôle des SIRET : il y a probablement une faute de frappe.</p></div>';
        return;
      } else {
        zone.innerHTML = '<p class="outil-note">✓ Format et clé de contrôle corrects. Recherche dans l\'annuaire officiel…</p>';
      }
      try {
        const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${d}&page=1&per_page=5`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const json = await r.json();
        const ent = (json.results || []).find((x) => x.siren === d.slice(0, 9));
        if (!ent) {
          zone.innerHTML = `<div class="outil-resultat ko"><p class="outil-taux">Introuvable</p><p>${d.length === 14 ? 'Le numéro est bien formé' : 'Ce SIREN'} mais il n'apparaît pas dans l'annuaire public des entreprises (entreprise récente, non diffusible ou numéro erroné).</p></div>`;
          return;
        }
        const etabs = [ent.siege, ...(ent.matching_etablissements || [])].filter(Boolean);
        const etab = d.length === 14 ? etabs.find((x) => x.siret === d) : ent.siege;
        const ferme = ent.etat_administratif === 'C' || etab?.etat_administratif === 'F';
        const adresse = etab?.adresse || '';
        zone.innerHTML = `<div class="outil-resultat ${ferme ? 'ko' : 'ok'}">
          <p class="outil-taux">${ferme ? '⚠️ Établissement fermé' : '✓ Entreprise active'}</p>
          <div class="outil-chiffres">
            <div><span>Nom</span><strong>${esc(ent.nom_complet || ent.nom_raison_sociale || '—')}</strong></div>
            ${adresse ? `<div><span>Adresse</span><strong>${esc(adresse)}</strong></div>` : ''}
            <div><span>SIREN</span><strong>${esc(ent.siren)}</strong></div>
            ${etab?.siret ? `<div><span>SIRET</span><strong>${esc(etab.siret)}</strong></div>` : ''}
            ${ent.activite_principale ? `<div><span>Code APE</span><strong>${esc(ent.activite_principale)}</strong></div>` : ''}
            ${ent.date_creation ? `<div><span>Créée le</span><strong>${esc(new Date(ent.date_creation).toLocaleDateString('fr-FR'))}</strong></div>` : ''}
          </div>
          <p class="outil-note">Source : annuaire des entreprises de l'État (données INSEE), consulté à l'instant.</p>
        </div>`;
      } catch (e) {
        zone.innerHTML = '<p class="outil-note">L\'annuaire officiel ne répond pas pour le moment. Le format et la clé de contrôle sont corrects ; réessayez dans quelques minutes.</p>';
      }
    });
  }
})();
