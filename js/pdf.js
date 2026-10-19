/*
 * Vrais fichiers PDF, enregistrés directement (sans passer par l'impression) :
 * devis, factures, journal des ventes et des dépenses.
 *
 * La bibliothèque jsPDF (js/vendor) n'est chargée qu'au premier PDF demandé.
 * Utilise data, infosDocument, euro, dateFr, tauxFr... d'app.js.
 */
const Pdf = (() => {
  const VERSION = '?v=78';
  const MARGE = 15;
  const BLEU = [31, 94, 255];
  const GRIS = [107, 115, 133];
  const ENCRE = [28, 35, 51];
  let chargement = null;

  function chargerScript(src) {
    return new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = src + VERSION;
      s.onload = ok;
      s.onerror = () => ko(new Error('Chargement impossible : ' + src));
      document.head.appendChild(s);
    });
  }

  function charger() {
    if (window.jspdf?.jsPDF?.API?.autoTable) return Promise.resolve();
    chargement = chargement || chargerScript('js/vendor/jspdf.umd.min.js')
      .then(() => chargerScript('js/vendor/jspdf.plugin.autotable.min.js'))
      .catch((err) => {
        chargement = null;
        throw err;
      });
    return chargement;
  }

  // Les polices standard des PDF ne connaissent pas les espaces fines insécables.
  const txt = (v) => String(v ?? '').replace(/[  ]/g, ' ');
  // Nom de fichier sans accents ni caractères interdits (certains navigateurs les refusent).
  const nomFichier = (s) => txt(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '-').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim() + '.pdf';

  async function nouveau(orientation) {
    try {
      await charger();
    } catch (e) {
      await ask('Le PDF ne peut pas être créé sans connexion internet. Réessayez une fois connecté.', "D'accord", false);
      return null;
    }
    const pdf = new window.jspdf.jsPDF({ orientation, unit: 'mm', format: 'a4' });
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...ENCRE);
    return pdf;
  }

  // Numéros de page en bas, quand le document fait plusieurs pages.
  function numeroterPages(pdf) {
    const n = pdf.getNumberOfPages();
    if (n < 2) return;
    const largeur = pdf.internal.pageSize.getWidth();
    const hauteur = pdf.internal.pageSize.getHeight();
    for (let i = 1; i <= n; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(...GRIS);
      pdf.text(`Page ${i} / ${n}`, largeur - MARGE, hauteur - 8, { align: 'right' });
    }
  }

  // Écrit des lignes de texte et renvoie la position sous le bloc.
  function bloc(pdf, lignes, x, y, { taille = 9.5, interligne = 4.6, align = 'left', largeur = 90 } = {}) {
    pdf.setFontSize(taille);
    for (const l of lignes.filter(Boolean)) {
      const morceaux = pdf.splitTextToSize(txt(l), largeur);
      pdf.text(morceaux, x, y, { align });
      y += interligne * morceaux.length;
    }
    return y;
  }

  function logo(pdf, e, y) {
    if (!e.logo || !Abonnement.aAcces('pro')) return y;
    try {
      const p = pdf.getImageProperties(e.logo);
      const ratio = Math.min(40 / p.width, 18 / p.height);
      const l = p.width * ratio;
      const h = p.height * ratio;
      pdf.addImage(e.logo, p.fileType, MARGE, y, l, h);
      return y + h + 4;
    } catch (err) {
      return y; // image illisible : on continue sans
    }
  }

  // Devis ou facture, mis en page comme à l'écran.
  // sortie : 'enregistrer' (téléchargement) ou 'base64' (pièce jointe d'un e-mail).
  async function document_(doc, { sortie = 'enregistrer' } = {}) {
    const pdf = await nouveau('portrait');
    if (!pdf) return null;
    const { e, client, isDevis, isAvoir, t, origine, factureOrigine, mentions, nomAffiche, formeAffichee } = infosDocument(doc);
    const titre = libelleType(doc);
    const largeur = pdf.internal.pageSize.getWidth();
    const hauteur = pdf.internal.pageSize.getHeight();
    const droite = largeur - MARGE;

    // En-tête : entreprise à gauche, titre à droite.
    let y = logo(pdf, e, MARGE);
    pdf.setFont('helvetica', 'bold');
    y = bloc(pdf, [nomAffiche], MARGE, y + 4, { taille: 12, interligne: 5.5 });
    pdf.setFont('helvetica', 'normal');
    y = bloc(pdf, [formeAffichee, ...(e.adresse || '').split('\n'),
      e.telephone && 'Tél. ' + e.telephone, e.email, e.siteWeb], MARGE, y, {});
    pdf.setTextColor(...GRIS);
    y = bloc(pdf, [e.siret && 'SIRET : ' + e.siret, e.immatriculation, e.ape && 'Code APE : ' + e.ape,
      e.numeroTva && !e.franchiseTva && 'N° TVA : ' + e.numeroTva], MARGE, y, { taille: 8.5, interligne: 4 });
    pdf.setTextColor(...ENCRE);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(...BLEU);
    pdf.text(titre.toUpperCase(), droite, MARGE + 6, { align: 'right' });
    pdf.setTextColor(...ENCRE);
    pdf.setFont('helvetica', 'normal');
    bloc(pdf, [`N° ${doc.numero}`, `Date : ${dateFr(doc.date)}`, origine && `Réf. devis ${origine.numero}`,
      isAvoir && (factureOrigine?.numero || doc.numeroFactureOrigine) && `Réf. facture ${factureOrigine?.numero || doc.numeroFactureOrigine}`],
      droite, MARGE + 13, { align: 'right', largeur: 70 });

    // Client (encadré à droite) et objet (à gauche).
    y = Math.max(y, MARGE + 30) + 6;
    const xClient = largeur / 2 + 5;
    const lignesClient = [client.nom || '—', ...(client.adresse || '').split('\n'), client.siret && 'SIRET : ' + client.siret];
    pdf.setFontSize(9.5);
    const hClient = 9 + lignesClient.filter(Boolean)
      .reduce((n, l) => n + pdf.splitTextToSize(txt(l), droite - xClient - 8).length, 0) * 4.6;
    pdf.setDrawColor(226, 230, 238);
    pdf.roundedRect(xClient, y, droite - xClient, hClient, 2, 2);
    pdf.setFontSize(8);
    pdf.setTextColor(...GRIS);
    pdf.text('Client', xClient + 4, y + 5);
    pdf.setTextColor(...ENCRE);
    pdf.setFont('helvetica', 'bold');
    let yc = bloc(pdf, [lignesClient[0]], xClient + 4, y + 10, { largeur: droite - xClient - 8 });
    pdf.setFont('helvetica', 'normal');
    bloc(pdf, lignesClient.slice(1), xClient + 4, yc, { largeur: droite - xClient - 8 });
    if (doc.objet) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.text('Objet :', MARGE, y + 5);
      pdf.setFont('helvetica', 'normal');
      bloc(pdf, [doc.objet], MARGE + 14, y + 5, { largeur: xClient - MARGE - 20 });
    }
    y += hClient + 8;

    // Lignes du document.
    const tva = !e.franchiseTva;
    pdf.autoTable({
      startY: y,
      margin: { left: MARGE, right: MARGE },
      head: [['Description', 'Qté', 'Prix unit. HT', ...(tva ? ['TVA'] : []), 'Total HT']],
      body: doc.lignes.map((l) => [
        txt(l.description),
        txt(`${String(l.quantite).replace('.', ',')} ${l.unite || ''}`),
        txt(euro(l.prixUnitaire)),
        ...(tva ? [`${txt(tauxFr(l.tva))} %`] : []),
        txt(euro(l.quantite * l.prixUnitaire)),
      ]),
      styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.4, textColor: ENCRE, lineColor: [226, 230, 238] },
      headStyles: { fillColor: [244, 246, 251], textColor: GRIS, fontStyle: 'bold', fontSize: 8.5 },
      columnStyles: { 1: { halign: 'right', cellWidth: 22 }, 2: { halign: 'right', cellWidth: 28 },
        ...(tva ? { 3: { halign: 'right', cellWidth: 16 }, 4: { halign: 'right', cellWidth: 28 } } : { 3: { halign: 'right', cellWidth: 28 } }) },
      didParseCell: (c) => {
        if (c.section === 'head' && c.column.index > 0) c.cell.styles.halign = 'right';
      },
      theme: 'grid',
    });
    y = pdf.lastAutoTable.finalY + 6;

    // Totaux, alignés à droite.
    const acompte = doc.type === 'devis' ? Number(doc.acompte) || 0 : 0;
    const totaux = e.franchiseTva
      ? [[isAvoir ? "Montant de l'avoir" : 'Total', t.ht, true]]
      : [['Total HT', t.ht], ...Object.entries(t.tvaParTaux).filter(([, v]) => v).map(([taux, v]) => [`TVA ${tauxFr(taux)} %`, v]),
        [isAvoir ? "Montant de l'avoir TTC" : 'Total TTC', t.ttc, true]];
    if (acompte > 0) totaux.push([`Acompte à la commande (${tauxFr(acompte)} %)`, (t.ttc * acompte) / 100]);
    const xTotaux = droite - 80;
    if (y + totaux.length * 7 > hauteur - 20) {
      pdf.addPage();
      y = MARGE;
    }
    for (const [libelle, montant, fort] of totaux) {
      if (fort) {
        pdf.setDrawColor(...ENCRE);
        pdf.setLineWidth(0.5);
        pdf.line(xTotaux, y - 4, droite, y - 4);
        pdf.setLineWidth(0.2);
      }
      pdf.setFont('helvetica', fort ? 'bold' : 'normal');
      pdf.setFontSize(fort ? 12 : 10);
      pdf.text(txt(libelle), xTotaux, y);
      pdf.text(txt(euro(montant)), droite, y, { align: 'right' });
      y += fort ? 8 : 6;
    }
    pdf.setFont('helvetica', 'normal');

    const placer = (h) => {
      if (y + h > hauteur - 15) {
        pdf.addPage();
        y = MARGE;
      }
    };

    if (doc.notes) {
      pdf.setFontSize(9.5);
      const lignes = pdf.splitTextToSize(txt(doc.notes), largeur - 2 * MARGE);
      placer(lignes.length * 4.6 + 6);
      y += 4;
      pdf.text(lignes, MARGE, y);
      y += lignes.length * 4.6 + 2;
    }

    if (isDevis) {
      placer(40);
      y += 6;
      pdf.setDrawColor(200, 205, 215);
      pdf.rect(droite - 85, y, 85, 30);
      pdf.setFontSize(8.5);
      pdf.setTextColor(...GRIS);
      pdf.text('Bon pour accord : date et signature du client', droite - 82, y + 5);
      pdf.setTextColor(...ENCRE);
      // Devis signé en ligne : signature, nom et date du client.
      if (doc.signature?.image) {
        try {
          pdf.addImage(doc.signature.image, 'PNG', droite - 80, y + 7, 50, 16);
        } catch (err) {
          // image illisible : le nom et la date suffisent
        }
        pdf.setFontSize(8);
        pdf.text(txt(`Signé en ligne par ${doc.signature.nom} le ${new Date(doc.signature.le).toLocaleString('fr-FR')}`), droite - 82, y + 27);
      }
      y += 36;
    }

    // Mentions légales en petit, en fin de document.
    pdf.setFontSize(8);
    const mentionsTexte = pdf.splitTextToSize(mentions.map(txt).join('\n'), largeur - 2 * MARGE);
    placer(mentionsTexte.length * 3.8 + 8);
    y += 6;
    pdf.setDrawColor(226, 230, 238);
    pdf.line(MARGE, y - 3, droite, y - 3);
    pdf.setTextColor(...GRIS);
    pdf.text(mentionsTexte, MARGE, y + 1);
    pdf.setTextColor(...ENCRE);

    numeroterPages(pdf);
    const nomClient = docClient(doc)?.nom;
    const fichier = nomFichier(`${titre} ${doc.numero}${nomClient ? ' - ' + nomClient : ''}`);
    if (sortie === 'base64') return { nom: fichier, base64: pdf.output('datauristring').split(',')[1] };
    pdf.save(fichier);
    return { nom: fichier };
  }

  // Journal des ventes ou des dépenses : tableau avec totaux, en paysage.
  async function journal(titre, lignes, du, au, fichier, vide = 'Aucune ligne sur cette période') {
    const pdf = await nouveau('landscape');
    if (!pdf) return;
    const e = data.entreprise;
    const droite = pdf.internal.pageSize.getWidth() - MARGE;
    const [entetes, ...corps] = lignes;
    const montant = /^-?\d+,\d{2}$/;
    const numeriques = entetes.map((h, i) => (corps.length
      ? corps.every((l) => montant.test(l[i]))
      : /^(Montant|Total|TVA)/.test(h)));
    const lisible = (v) => txt(Number(v.replace(',', '.')).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    const totaux = entetes.map((_, i) => {
      if (i === 0) return `Total (${corps.length})`;
      if (!numeriques[i]) return '';
      return lisible(corps.reduce((s, l) => s + Number(l[i].replace(',', '.')), 0).toFixed(2).replace('.', ','));
    });

    pdf.setFont('helvetica', 'bold');
    let y = bloc(pdf, [e.nom], MARGE, MARGE + 4, { taille: 11 });
    pdf.setFont('helvetica', 'normal');
    bloc(pdf, [...(e.adresse || '').split('\n'), e.siret && 'SIRET : ' + e.siret,
      e.numeroTva && !e.franchiseTva && 'N° TVA : ' + e.numeroTva], MARGE, y, { taille: 9, largeur: 140 });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(txt(titre), droite, MARGE + 4, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    bloc(pdf, [`Du ${dateFr(du)} au ${dateFr(au)}`, `Édité le ${dateFr(today())}`], droite, MARGE + 11, { taille: 9, align: 'right' });

    pdf.autoTable({
      startY: MARGE + 34,
      margin: { left: MARGE, right: MARGE },
      head: [entetes.map(txt)],
      body: corps.length
        ? corps.map((l) => l.map((v, i) => (numeriques[i] ? lisible(v) : txt(v))))
        : [[{ content: vide, colSpan: entetes.length, styles: { halign: 'center', textColor: GRIS } }]],
      foot: [totaux],
      showFoot: 'lastPage',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, textColor: ENCRE, lineColor: [226, 230, 238] },
      headStyles: { fillColor: [244, 246, 251], textColor: GRIS, fontStyle: 'bold' },
      footStyles: { fillColor: [255, 255, 255], textColor: ENCRE, fontStyle: 'bold' },
      didParseCell: (c) => {
        if (numeriques[c.column.index]) c.cell.styles.halign = 'right';
      },
      theme: 'striped',
    });
    numeroterPages(pdf);
    pdf.save(nomFichier(fichier));
  }

  return { document: document_, journal, charger };
})();
