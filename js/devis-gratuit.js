/*
 * Générateur de devis gratuit (page devis-gratuit.html), sans compte.
 * Volontairement simple : un devis à la fois, rien n'est enregistré en ligne
 * (le brouillon reste seulement dans l'onglet), PDF avec la mention Devizo.
 * À la création d'un compte, le devis est repris dans l'appli (clé
 * « devizo-devis-gratuit », lue par importerDevisGratuit() dans app.js).
 */
(() => {
  const zone = document.getElementById('generateur');
  if (!zone) return;
  const BROUILLON = 'devizo-devis-gratuit-brouillon';
  const POUR_APPLI = 'devizo-devis-gratuit';
  const FORMES = { micro: 'Micro-entreprise', ei: 'Entreprise individuelle (EI)', eurl: 'EURL', sarl: 'SARL', sasu: 'SASU', sas: 'SAS' };
  const UNITES = ['u', 'h', 'j', 'm²', 'm', 'ml', 'm³', 'forfait', 'lot', 'kg'];
  const TAUX = [20, 10, 5.5, 0];

  const aujourdhui = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };
  const plusJours = (iso, n) => {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const euro = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
  const dateFr = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR') : '');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nombre = (v) => Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')) || 0;
  const tauxFr = (t) => String(t).replace('.', ',');

  const VIDE = () => ({
    entreprise: { nom: '', formeJuridique: 'micro', rue: '', codePostal: '', ville: '', siret: '', telephone: '', email: '',
      franchiseTva: true, numeroTva: '', assureur: '', numeroContrat: '', devisGratuit: true },
    client: { nom: '', rue: '', codePostal: '', ville: '' },
    devis: { numero: 'D-' + new Date().getFullYear() + '-001', date: aujourdhui(), echeance: plusJours(aujourdhui(), 30), objet: '',
      lignes: [{ description: '', quantite: 1, unite: 'u', prixUnitaire: '', tva: 10 }] },
  });
  let etat;
  try {
    etat = JSON.parse(sessionStorage.getItem(BROUILLON)) || VIDE();
  } catch (e) {
    etat = VIDE();
  }
  const garderBrouillon = () => {
    try {
      sessionStorage.setItem(BROUILLON, JSON.stringify(etat));
    } catch (e) {
      // stockage indisponible
    }
  };

  function totaux() {
    const franchise = etat.entreprise.franchiseTva;
    let ht = 0;
    const parTaux = {};
    for (const l of etat.devis.lignes) {
      const m = nombre(l.quantite) * nombre(l.prixUnitaire);
      ht += m;
      if (!franchise) parTaux[l.tva] = (parTaux[l.tva] || 0) + (m * Number(l.tva)) / 100;
    }
    const tva = Object.values(parTaux).reduce((a, b) => a + b, 0);
    return { ht, parTaux, tva, ttc: ht + tva };
  }

  const champ = (groupe, nom, libelle, { type = 'text', requis = false, aide = '', attrs = '' } = {}) => `
    <div class="gen-champ">
      <label for="g-${groupe}-${nom}">${libelle}${requis ? ' <span class="gen-requis">*</span>' : ''}</label>
      <input id="g-${groupe}-${nom}" type="${type}" data-g="${groupe}" data-n="${nom}" value="${esc(etat[groupe][nom])}" ${attrs}>
      ${aide ? `<small>${aide}</small>` : ''}
    </div>`;

  function ligneHtml(l, i) {
    const franchise = etat.entreprise.franchiseTva;
    return `<div class="gen-ligne" data-i="${i}">
      <input class="gen-desc" data-l="description" value="${esc(l.description)}" placeholder="Ex : Pose d'un mitigeur thermostatique" aria-label="Description">
      <span class="gen-et gen-et-q" aria-hidden="true">Quantité</span><span class="gen-et gen-et-u" aria-hidden="true">Unité</span><span class="gen-et gen-et-p" aria-hidden="true">Prix unit. HT</span>
      <input class="gen-qte" data-l="quantite" inputmode="decimal" value="${esc(l.quantite)}" aria-label="Quantité">
      <select class="gen-unite" data-l="unite" aria-label="Unité">${UNITES.map((u) => `<option${u === l.unite ? ' selected' : ''}>${u}</option>`).join('')}</select>
      <input class="gen-pu" data-l="prixUnitaire" inputmode="decimal" value="${esc(l.prixUnitaire)}" placeholder="0,00" aria-label="Prix unitaire HT">
      ${franchise ? '' : `<select class="gen-tva" data-l="tva" aria-label="TVA">${TAUX.map((t) => `<option value="${t}"${Number(l.tva) === t ? ' selected' : ''}>${tauxFr(t)} %</option>`).join('')}</select>`}
      <span class="gen-total">${euro(nombre(l.quantite) * nombre(l.prixUnitaire))}</span>
      <button type="button" class="gen-suppr" data-suppr="${i}" aria-label="Supprimer la ligne"${etat.devis.lignes.length < 2 ? ' disabled' : ''}>✕</button>
    </div>`;
  }

  function totauxHtml() {
    const t = totaux();
    return `<div><span>Total HT</span><strong>${euro(t.ht)}</strong></div>
      ${etat.entreprise.franchiseTva ? '<div class="gen-note"><span>TVA non applicable, art. 293 B du CGI</span></div>'
        : Object.entries(t.parTaux).map(([taux, m]) => `<div><span>TVA ${tauxFr(taux)} %</span><span>${euro(m)}</span></div>`).join('')}
      <div class="gen-ttc"><span>Total ${etat.entreprise.franchiseTva ? '' : 'TTC'}</span><strong>${euro(t.ttc)}</strong></div>`;
  }

  function afficher() {
    const e = etat.entreprise;
    zone.innerHTML = `
      <form class="gen" novalidate>
        <fieldset>
          <legend><span>1</span> Votre entreprise</legend>
          <div class="gen-grille">
            ${champ('entreprise', 'nom', "Nom de l'entreprise", { requis: true, attrs: 'autocomplete="organization"' })}
            <div class="gen-champ">
              <label for="g-forme">Statut</label>
              <select id="g-forme" data-g="entreprise" data-n="formeJuridique">${Object.entries(FORMES).map(([k, v]) => `<option value="${k}"${k === e.formeJuridique ? ' selected' : ''}>${v}</option>`).join('')}</select>
            </div>
            ${champ('entreprise', 'rue', 'Adresse', { requis: true, attrs: 'autocomplete="address-line1"' })}
            <div class="gen-cp-ville">
              ${champ('entreprise', 'codePostal', 'Code postal', { requis: true, attrs: 'inputmode="numeric" maxlength="5" autocomplete="postal-code"' })}
              ${champ('entreprise', 'ville', 'Ville', { requis: true, attrs: 'autocomplete="address-level2"' })}
            </div>
            ${champ('entreprise', 'siret', 'SIRET', { requis: true, aide: '14 chiffres', attrs: 'inputmode="numeric"' })}
            ${champ('entreprise', 'telephone', 'Téléphone', { type: 'tel', attrs: 'autocomplete="tel"' })}
            ${champ('entreprise', 'email', 'E-mail', { type: 'email', attrs: 'autocomplete="email"' })}
          </div>
          <label class="gen-case"><input type="checkbox" data-g="entreprise" data-n="franchiseTva"${e.franchiseTva ? ' checked' : ''}> Je ne facture pas la TVA (franchise en base, souvent le cas en micro-entreprise)</label>
          ${e.franchiseTva ? '' : `<div class="gen-grille">${champ('entreprise', 'numeroTva', 'N° de TVA intracommunautaire', { attrs: 'placeholder="FR..."' })}</div>`}
          <div class="gen-grille">
            ${champ('entreprise', 'assureur', 'Assurance décennale (assureur)', { aide: 'Obligatoire pour les travaux de construction' })}
            ${champ('entreprise', 'numeroContrat', 'N° de contrat')}
          </div>
        </fieldset>

        <fieldset>
          <legend><span>2</span> Votre client</legend>
          <div class="gen-grille">
            ${champ('client', 'nom', 'Nom du client', { requis: true })}
            ${champ('client', 'rue', 'Adresse')}
            <div class="gen-cp-ville">
              ${champ('client', 'codePostal', 'Code postal', { attrs: 'inputmode="numeric" maxlength="5"' })}
              ${champ('client', 'ville', 'Ville')}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend><span>3</span> Le devis</legend>
          <div class="gen-grille gen-grille-3">
            ${champ('devis', 'numero', 'Numéro')}
            ${champ('devis', 'date', 'Date', { type: 'date' })}
            ${champ('devis', 'echeance', "Valable jusqu'au", { type: 'date' })}
          </div>
          ${champ('devis', 'objet', 'Objet', { attrs: 'placeholder="Ex : Rénovation de la salle de bain"' })}
          <div class="gen-lignes-tete${e.franchiseTva ? ' sans-tva' : ''}" aria-hidden="true"><span>Description</span><span>Qté</span><span>Unité</span><span>Prix unit. HT</span>${e.franchiseTva ? '' : '<span>TVA</span>'}<span>Total HT</span><span></span></div>
          <div class="gen-lignes${e.franchiseTva ? ' sans-tva' : ''}">${etat.devis.lignes.map(ligneHtml).join('')}</div>
          <button type="button" class="btn gen-ajouter">+ Ajouter une ligne</button>
          <div class="gen-totaux">${totauxHtml()}</div>
          <label class="gen-case"><input type="checkbox" data-g="entreprise" data-n="devisGratuit"${e.devisGratuit ? ' checked' : ''}> Afficher la mention « Devis gratuit »</label>
        </fieldset>

        <p class="gen-erreur" role="alert" hidden></p>
        <button type="submit" class="btn btn-primary btn-lg gen-pdf">Télécharger le devis en PDF</button>
        <p class="gen-info">🔒 Gratuit et sans inscription. Rien n'est enregistré sur nos serveurs : fermez l'onglet et tout est effacé.</p>
      </form>`;
  }

  function rafraichirCalculs() {
    zone.querySelectorAll('.gen-ligne').forEach((el) => {
      const l = etat.devis.lignes[el.dataset.i];
      el.querySelector('.gen-total').textContent = euro(nombre(l.quantite) * nombre(l.prixUnitaire));
    });
    zone.querySelector('.gen-totaux').innerHTML = totauxHtml();
  }

  zone.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.dataset.g) {
      etat[t.dataset.g][t.dataset.n] = t.type === 'checkbox' ? t.checked : t.value;
      if (t.type === 'checkbox' && t.dataset.n === 'franchiseTva') {
        garderBrouillon();
        afficher();
        return;
      }
    } else if (t.dataset.l) {
      const i = t.closest('.gen-ligne').dataset.i;
      etat.devis.lignes[i][t.dataset.l] = t.dataset.l === 'tva' ? Number(t.value) : t.value;
    }
    garderBrouillon();
    rafraichirCalculs();
  });
  zone.addEventListener('click', (ev) => {
    if (ev.target.closest('.gen-ajouter')) {
      etat.devis.lignes.push({ description: '', quantite: 1, unite: 'u', prixUnitaire: '', tva: etat.devis.lignes.at(-1)?.tva ?? 10 });
      garderBrouillon();
      afficher();
      zone.querySelector('.gen-ligne:last-child .gen-desc')?.focus();
    }
    const s = ev.target.closest('[data-suppr]');
    if (s && etat.devis.lignes.length > 1) {
      etat.devis.lignes.splice(Number(s.dataset.suppr), 1);
      garderBrouillon();
      afficher();
    }
  });

  function erreurs() {
    const e = etat.entreprise;
    const manque = [];
    if (!e.nom.trim()) manque.push("le nom de l'entreprise");
    if (!e.rue.trim() || !/^\d{5}$/.test(e.codePostal.trim()) || !e.ville.trim()) manque.push("l'adresse complète de l'entreprise");
    if (!/^\d{14}$/.test(e.siret.replace(/\s/g, ''))) manque.push('un SIRET de 14 chiffres');
    if (!etat.client.nom.trim()) manque.push('le nom du client');
    if (!etat.devis.lignes.some((l) => l.description.trim() && nombre(l.prixUnitaire) > 0)) manque.push('au moins une ligne avec un prix');
    return manque;
  }

  // ------------------------------------------------------------------
  // PDF
  // ------------------------------------------------------------------
  let chargement = null;
  function chargerJsPdf() {
    const script = (src) => new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = ko;
      document.head.appendChild(s);
    });
    if (window.jspdf?.jsPDF?.API?.autoTable) return Promise.resolve();
    chargement = chargement || script('js/vendor/jspdf.umd.min.js').then(() => script('js/vendor/jspdf.plugin.autotable.min.js'))
      .catch((err) => {
        chargement = null;
        throw err;
      });
    return chargement;
  }
  const txt = (v) => String(v ?? '').replace(/[  ]/g, ' ');

  async function fairePdf() {
    await chargerJsPdf();
    const e = etat.entreprise;
    const c = etat.client;
    const d = etat.devis;
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const L = pdf.internal.pageSize.getWidth();
    const H = pdf.internal.pageSize.getHeight();
    const M = 15;
    const BLEU = [31, 94, 255];
    const GRIS = [107, 115, 133];
    const ENCRE = [28, 35, 51];
    const individuel = e.formeJuridique === 'micro' || e.formeJuridique === 'ei';
    const nom = e.nom.trim() + (individuel && !/\bEI\b/.test(e.nom) ? ' EI' : '');
    pdf.setTextColor(...ENCRE);

    // Entreprise (gauche)
    pdf.setFont('helvetica', 'bold').setFontSize(13).text(txt(nom), M, 20);
    pdf.setFont('helvetica', 'normal').setFontSize(9.5);
    const infos = [
      !individuel ? FORMES[e.formeJuridique] : '',
      e.rue, `${e.codePostal} ${e.ville}`,
      e.telephone && 'Tél. ' + e.telephone, e.email,
      'SIRET : ' + e.siret.replace(/\s/g, ''),
      !e.franchiseTva && e.numeroTva ? 'N° TVA : ' + e.numeroTva : '',
    ].filter(Boolean).map(txt);
    pdf.text(infos, M, 26, { lineHeightFactor: 1.35 });

    // Titre (droite)
    pdf.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...BLEU).text('DEVIS', L - M, 22, { align: 'right' });
    pdf.setFontSize(10).setTextColor(...ENCRE).setFont('helvetica', 'normal');
    pdf.text([`N° ${txt(d.numero)}`, `Date : ${dateFr(d.date)}`, `Valable jusqu'au : ${dateFr(d.echeance)}`], L - M, 29, { align: 'right', lineHeightFactor: 1.4 });

    // Client
    let y = Math.max(26 + infos.length * 4.6, 48) + 6;
    pdf.setDrawColor(226, 230, 238).setFillColor(246, 248, 252).roundedRect(L / 2, y, L / 2 - M, 28, 2, 2, 'FD');
    pdf.setFontSize(8.5).setTextColor(...GRIS).text('CLIENT', L / 2 + 5, y + 6);
    pdf.setFontSize(10.5).setTextColor(...ENCRE).setFont('helvetica', 'bold').text(txt(c.nom), L / 2 + 5, y + 12);
    pdf.setFont('helvetica', 'normal').setFontSize(9.5).text([c.rue, [c.codePostal, c.ville].filter(Boolean).join(' ')].filter(Boolean).map(txt), L / 2 + 5, y + 17.5, { lineHeightFactor: 1.35 });
    y += 36;
    if (d.objet.trim()) {
      pdf.setFont('helvetica', 'bold').setFontSize(10).text('Objet :', M, y);
      const decalage = pdf.getTextWidth('Objet :') + 1.5;
      pdf.setFont('helvetica', 'normal').text(txt(d.objet), M + decalage, y);
      y += 6;
    }

    // Lignes
    const lignes = d.lignes.filter((l) => l.description.trim() || nombre(l.prixUnitaire));
    const tete = ['Description', 'Qté', 'Unité', 'Prix unit. HT', ...(e.franchiseTva ? [] : ['TVA']), 'Total HT'];
    pdf.autoTable({
      startY: y + 2,
      head: [tete],
      body: lignes.map((l) => [txt(l.description), txt(String(nombre(l.quantite)).replace('.', ',')), l.unite, txt(euro(nombre(l.prixUnitaire))),
        ...(e.franchiseTva ? [] : [tauxFr(l.tva) + ' %']), txt(euro(nombre(l.quantite) * nombre(l.prixUnitaire)))]),
      margin: { left: M, right: M },
      styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.4, textColor: ENCRE, lineColor: [226, 230, 238], lineWidth: 0.2 },
      headStyles: { fillColor: BLEU, textColor: 255, fontStyle: 'bold' },
      columnStyles: Object.fromEntries(tete.map((_, i) => [i, i === 0 ? { cellWidth: 'auto' } : { halign: 'right', cellWidth: i === tete.length - 1 ? 28 : (i === 3 ? 26 : 16) }])),
    });
    y = pdf.lastAutoTable.finalY + 6;

    // Totaux
    const t = totaux();
    const lignesTotaux = [['Total HT', euro(t.ht)]];
    if (!e.franchiseTva) Object.entries(t.parTaux).forEach(([taux, m]) => lignesTotaux.push([`TVA ${tauxFr(taux)} %`, euro(m)]));
    lignesTotaux.push([e.franchiseTva ? 'Total' : 'Total TTC', euro(t.ttc)]);
    if (y + lignesTotaux.length * 6 + 60 > H - 20) {
      pdf.addPage();
      y = 20;
    }
    lignesTotaux.forEach(([k, v], i) => {
      const dernier = i === lignesTotaux.length - 1;
      pdf.setFont('helvetica', dernier ? 'bold' : 'normal').setFontSize(dernier ? 11.5 : 10);
      pdf.text(txt(k), L - M - 60, y).text(txt(v), L - M, y, { align: 'right' });
      y += dernier ? 7 : 5.5;
    });

    // Mentions
    const mentions = [];
    if (e.franchiseTva) mentions.push('TVA non applicable, art. 293 B du CGI.');
    mentions.push(`Devis valable jusqu'au ${dateFr(d.echeance)}.`);
    if (e.devisGratuit) mentions.push('Devis gratuit.');
    if (e.assureur.trim()) mentions.push(`Assurance décennale : ${e.assureur.trim()}${e.numeroContrat.trim() ? `, contrat n° ${e.numeroContrat.trim()}` : ''}.`);
    pdf.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GRIS);
    const texteMentions = pdf.splitTextToSize(mentions.map(txt).join('\n'), L - 2 * M);
    pdf.text(texteMentions, M, y + 2);
    y += texteMentions.length * 3.8 + 8;

    // Bon pour accord
    pdf.setTextColor(...ENCRE).setDrawColor(200, 205, 215);
    pdf.roundedRect(L / 2, y, L / 2 - M, 34, 2, 2);
    pdf.setFont('helvetica', 'bold').setFontSize(9.5).text('Bon pour accord', L / 2 + 5, y + 6);
    pdf.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GRIS)
      .text(['Date, signature du client et mention', '« Devis reçu avant l\'exécution des travaux, bon pour accord »'], L / 2 + 5, y + 11, { lineHeightFactor: 1.35 });

    // Mention Devizo en bas de chaque page
    for (let p = 1; p <= pdf.getNumberOfPages(); p++) {
      pdf.setPage(p);
      pdf.setFontSize(8).setTextColor(...GRIS).text('Devis réalisé gratuitement avec Devizo · devizo-app.fr', L / 2, H - 8, { align: 'center' });
    }
    pdf.save(`Devis ${d.numero} ${c.nom}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\\/:*?"<>|]+/g, '-').replace(/[^\x20-\x7e]/g, '').trim() + '.pdf');
  }

  // Après le téléchargement : proposer de garder le devis dans l'appli.
  function proposerCompte() {
    const dlg = document.createElement('dialog');
    dlg.className = 'gen-dialogue';
    dlg.innerHTML = `
      <p class="gen-dialogue-ok">✓ Votre devis est téléchargé</p>
      <h2>💾 Gardez ce devis et transformez-le en facture</h2>
      <p>Créez votre compte gratuit : ce devis est <strong>déjà dans votre appli</strong>, avec votre entreprise et votre client.
        Plus besoin de tout retaper la prochaine fois.</p>
      <ul>
        <li>Devis → facture en un clic, numérotation automatique</li>
        <li>Envoi par e-mail et signature en ligne du client</li>
        <li>14 jours gratuits, sans carte bancaire</li>
      </ul>
      <a class="btn btn-lg btn-google" href="app.html#google"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg><span>Continuer avec Google</span></a>
      <a class="btn btn-primary btn-lg" href="app.html#inscription">Créer mon compte avec mon e-mail</a>
      <button type="button" class="gen-non">Non merci</button>`;
    dlg.querySelector('.gen-non').addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => dlg.remove());
    document.body.appendChild(dlg);
    dlg.showModal();
  }

  zone.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const zoneErreur = zone.querySelector('.gen-erreur');
    const manque = erreurs();
    if (manque.length) {
      zoneErreur.textContent = 'Il manque ' + manque.join(', ') + '.';
      zoneErreur.hidden = false;
      return;
    }
    zoneErreur.hidden = true;
    const bouton = zone.querySelector('.gen-pdf');
    bouton.disabled = true;
    bouton.textContent = 'Création du PDF…';
    try {
      await fairePdf();
      try {
        localStorage.setItem(POUR_APPLI, JSON.stringify({ ...etat, le: Date.now() }));
      } catch (e) {
        // stockage indisponible
      }
      if (window.devizoCompter) window.devizoCompter('pdf-gratuit');
      proposerCompte();
    } catch (e) {
      zoneErreur.textContent = "Le PDF n'a pas pu être créé. Vérifiez votre connexion internet et réessayez.";
      zoneErreur.hidden = false;
    }
    bouton.disabled = false;
    bouton.textContent = 'Télécharger le devis en PDF';
  });

  afficher();
})();
