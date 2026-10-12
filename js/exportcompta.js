/*
 * Export pour le comptable (formule Entreprise) : journal des ventes (factures)
 * et liste des dépenses sur une période, en fichiers CSV lisibles par Excel
 * et LibreOffice (séparateur « ; », virgule décimale, dates JJ/MM/AAAA).
 *
 * Chargé avant app.js ; utilise data, computeTotals, getClient, view... d'app.js.
 */

function csvCellule(v) {
  const t = String(v ?? '');
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function csvNombre(n) {
  return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace('.', ',');
}

function csvDate(iso) {
  if (!iso) return '';
  const [a, m, j] = String(iso).slice(0, 10).split('-');
  return j ? `${j}/${m}/${a}` : iso;
}

function telechargerCsv(nom, lignes) {
  // BOM : Excel reconnaît alors les accents (UTF-8).
  const contenu = '﻿' + lignes.map((l) => l.map(csvCellule).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dansPeriode(date, du, au) {
  const d = String(date || '').slice(0, 10);
  return d && d >= du && d <= au;
}

function facturesPeriode(du, au) {
  return data.documents
    .filter((d) => (d.type === 'facture' || d.type === 'avoir') && dansPeriode(d.date, du, au))
    .sort((a, b) => (a.numero || '').localeCompare(b.numero || '', 'fr', { numeric: true }));
}

function depensesPeriode(du, au) {
  return (data.depenses || [])
    .filter((d) => dansPeriode(d.date, du, au))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function journalVentes(du, au) {
  const factures = facturesPeriode(du, au);
  const totaux = factures.map((f) => computeTotals(f));
  const taux = [...new Set(totaux.flatMap((t) => Object.keys(t.tvaParTaux).map(Number)))].sort((a, b) => b - a);
  const lignes = [[
    'Date', 'N° facture / avoir', 'Client', 'SIRET client', 'Objet', 'Total HT',
    ...taux.map((t) => `TVA ${String(t).replace('.', ',')} %`), 'Total TVA', 'Total TTC', 'Statut', 'Réglé le',
  ]];
  // Les avoirs sont repris en négatif.
  factures.forEach((f, i) => {
    const t = totaux[i];
    const s = f.type === 'avoir' ? -1 : 1;
    const client = f.clientArchive || getClient(f.clientId) || {};
    const regle = f.statut === 'payee' || f.statut === 'rembourse';
    lignes.push([
      csvDate(f.date), f.numero, client.nom || '', client.siret || '', f.objet || '', csvNombre(s * t.ht),
      ...taux.map((x) => csvNombre(s * (t.tvaParTaux[x] || 0))), csvNombre(s * t.tva), csvNombre(s * t.ttc),
      STATUTS[f.type]?.[f.statut] || f.statut, csvDate(regle ? f.datePaiement : ''),
    ]);
  });
  return lignes;
}

function journalDepenses(du, au) {
  const lignes = [['Date', 'Fournisseur', 'Catégorie', 'Montant HT', 'Taux TVA', 'TVA', 'Montant TTC', 'Note']];
  depensesPeriode(du, au).forEach((d) => {
    const ttc = Number(d.montantTTC) || 0;
    const ht = ttc / (1 + (Number(d.tva) || 0) / 100);
    lignes.push([
      csvDate(d.date), d.fournisseur || '', d.categorie || '', csvNombre(ht),
      `${String(Number(d.tva) || 0).replace('.', ',')} %`, csvNombre(ttc - ht), csvNombre(ttc), d.note || '',
    ]);
  });
  return lignes;
}

// Périodes proposées : [libellé, du, au] au format AAAA-MM-JJ.
function periodesExport() {
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const auj = new Date();
  const a = auj.getFullYear();
  const m = auj.getMonth();
  const t = Math.floor(m / 3);
  return [
    ['Mois dernier', iso(new Date(a, m - 1, 1)), iso(new Date(a, m, 0))],
    ['Trimestre dernier', iso(new Date(a, (t - 1) * 3, 1)), iso(new Date(a, t * 3, 0))],
    ['Année en cours', `${a}-01-01`, iso(auj)],
    ['Année dernière', `${a - 1}-01-01`, `${a - 1}-12-31`],
  ];
}

function pageExport(params) {
  const periodes = periodesExport();
  const du = params?.get('du') || periodes[2][1];
  const au = params?.get('au') || periodes[2][2];
  const factures = facturesPeriode(du, au);
  const depenses = depensesPeriode(du, au);
  const ventes = factures.reduce((s, f) => {
    const t = computeTotals(f);
    const k = f.type === 'avoir' ? -1 : 1;
    return { ht: s.ht + k * t.ht, tva: s.tva + k * t.tva, ttc: s.ttc + k * t.ttc };
  }, { ht: 0, tva: 0, ttc: 0 });
  const nbAvoirs = factures.filter((f) => f.type === 'avoir').length;
  const nbFactures = factures.length - nbAvoirs;
  const totalDepenses = depenses.reduce((s, d) => s + (Number(d.montantTTC) || 0), 0);
  const nomFichier = (quoi) => `devizo-${quoi}-${du}-au-${au}.csv`;

  view.innerHTML = `
    <div class="page-head"><h1>Export pour le comptable</h1></div>
    <section class="card">
      <h2>Période</h2>
      <div class="actions" style="margin-bottom:12px">
        ${periodes.map(([lib, d, f]) => `<a class="btn btn-sm ${d === du && f === au ? 'btn-primary' : ''}" href="#/export?du=${d}&au=${f}">${lib}</a>`).join('')}
      </div>
      <form id="export-form" class="grid-2" novalidate>
        <div><label for="export-du">Du</label><input id="export-du" name="du" type="date" min="2000-01-01" max="2099-12-31" value="${esc(du)}"></div>
        <div><label for="export-au">Au</label><input id="export-au" name="au" type="date" min="2000-01-01" max="2099-12-31" value="${esc(au)}"></div>
      </form>
    </section>
    <div class="panels">
      <section class="card">
        <h2>Journal des ventes</h2>
        <p><strong>${nbFactures}</strong> facture${nbFactures > 1 ? 's' : ''}${nbAvoirs ? ` et <strong>${nbAvoirs}</strong> avoir${nbAvoirs > 1 ? 's' : ''}` : ''} du ${dateFr(du)} au ${dateFr(au)}</p>
        <p>${data.entreprise.franchiseTva ? `Total : <strong>${euro(ventes.ht)}</strong>`
          : `Total HT : <strong>${euro(ventes.ht)}</strong> · TVA : <strong>${euro(ventes.tva)}</strong> · TTC : <strong>${euro(ventes.ttc)}</strong>`}</p>
        <div class="actions">
          <button class="btn btn-primary" id="export-ventes-pdf">Télécharger en PDF</button>
          ${factures.length ? '<button class="btn" id="export-ventes">Fichier Excel (CSV)</button>' : ''}
        </div>
      </section>
      <section class="card">
        <h2>Dépenses</h2>
        <p><strong>${depenses.length}</strong> dépense${depenses.length > 1 ? 's' : ''} du ${dateFr(du)} au ${dateFr(au)}</p>
        <p>Total TTC : <strong>${euro(totalDepenses)}</strong></p>
        <div class="actions">
          <button class="btn btn-primary" id="export-depenses-pdf">Télécharger en PDF</button>
          ${depenses.length ? '<button class="btn" id="export-depenses">Fichier Excel (CSV)</button>' : ''}
        </div>
        ${depenses.length ? '' : '<p class="hint">Aucune dépense enregistrée sur cette période : le PDF l\u2019indiquera. Ajoutez vos achats dans <a href="#/depenses">Dépenses</a>.</p>'}
      </section>
    </div>
    <p class="hint">Le PDF est prêt à envoyer à votre comptable. Le fichier Excel (CSV) s'ouvre avec Excel, LibreOffice ou Google Sheets
      et s'importe dans la plupart des logiciels comptables.</p>
  `;

  // Dates tapées au clavier : on attend une date complète (année à 4 chiffres)
  // et une petite pause avant d'actualiser, pour ne pas couper la saisie.
  const form = document.getElementById('export-form');
  let attente = null;
  const appliquer = () => {
    const v = Object.fromEntries(new FormData(form));
    const valide = (d) => /^(20\d\d)-\d\d-\d\d$/.test(d || '');
    if (!valide(v.du) || !valide(v.au) || (v.du === du && v.au === au)) return;
    go(`#/export?du=${v.du <= v.au ? v.du : v.au}&au=${v.du <= v.au ? v.au : v.du}`);
  };
  form.addEventListener('input', () => {
    clearTimeout(attente);
    attente = setTimeout(appliquer, 900);
  });
  form.addEventListener('focusout', (e) => {
    if (form.contains(e.relatedTarget)) return; // on passe juste de « Du » à « Au »
    clearTimeout(attente);
    attente = setTimeout(appliquer, 150);
  });
  document.getElementById('export-ventes')?.addEventListener('click', () => telechargerCsv(nomFichier('ventes'), journalVentes(du, au)));
  document.getElementById('export-depenses')?.addEventListener('click', () => telechargerCsv(nomFichier('depenses'), journalDepenses(du, au)));
  const pdfJournal = (bouton, titre, lignes, fichier, vide) => bouton?.addEventListener('click', async () => {
    bouton.disabled = true;
    bouton.textContent = 'Création du PDF…';
    await Pdf.journal(titre, lignes, du, au, fichier, vide);
    bouton.disabled = false;
    bouton.textContent = 'Télécharger en PDF';
  });
  pdfJournal(document.getElementById('export-ventes-pdf'), 'Journal des ventes', journalVentes(du, au),
    `Journal des ventes ${dateFr(du)} au ${dateFr(au)}`.replace(/\//g, '-'), 'Aucune facture sur cette période');
  pdfJournal(document.getElementById('export-depenses-pdf'), 'Journal des dépenses', journalDepenses(du, au),
    `Journal des dépenses ${dateFr(du)} au ${dateFr(au)}`.replace(/\//g, '-'), 'Aucune dépense sur cette période');
}
