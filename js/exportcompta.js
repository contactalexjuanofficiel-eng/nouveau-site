/*
 * Export pour le comptable (formule Équipe) : journal des ventes (factures)
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
    .filter((d) => d.type === 'facture' && dansPeriode(d.date, du, au))
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
    'Date', 'N° facture', 'Client', 'SIRET client', 'Objet', 'Total HT',
    ...taux.map((t) => `TVA ${String(t).replace('.', ',')} %`), 'Total TVA', 'Total TTC', 'Statut', 'Payée le',
  ]];
  factures.forEach((f, i) => {
    const t = totaux[i];
    const client = f.clientArchive || getClient(f.clientId) || {};
    lignes.push([
      csvDate(f.date), f.numero, client.nom || '', client.siret || '', f.objet || '', csvNombre(t.ht),
      ...taux.map((x) => csvNombre(t.tvaParTaux[x] || 0)), csvNombre(t.tva), csvNombre(t.ttc),
      f.statut === 'payee' ? 'Payée' : 'À payer', csvDate(f.statut === 'payee' ? f.datePaiement : ''),
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
    return { ht: s.ht + t.ht, tva: s.tva + t.tva, ttc: s.ttc + t.ttc };
  }, { ht: 0, tva: 0, ttc: 0 });
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
        <div><label for="export-du">Du</label><input id="export-du" name="du" type="date" value="${esc(du)}"></div>
        <div><label for="export-au">Au</label><input id="export-au" name="au" type="date" value="${esc(au)}"></div>
      </form>
    </section>
    <div class="panels">
      <section class="card">
        <h2>Journal des ventes</h2>
        <p><strong>${factures.length}</strong> facture${factures.length > 1 ? 's' : ''} du ${dateFr(du)} au ${dateFr(au)}</p>
        <p>${data.entreprise.franchiseTva ? `Total : <strong>${euro(ventes.ht)}</strong>`
          : `Total HT : <strong>${euro(ventes.ht)}</strong> · TVA : <strong>${euro(ventes.tva)}</strong> · TTC : <strong>${euro(ventes.ttc)}</strong>`}</p>
        <button class="btn btn-primary" id="export-ventes" ${factures.length ? '' : 'disabled'}>Télécharger les ventes (CSV)</button>
      </section>
      <section class="card">
        <h2>Dépenses</h2>
        <p><strong>${depenses.length}</strong> dépense${depenses.length > 1 ? 's' : ''} du ${dateFr(du)} au ${dateFr(au)}</p>
        <p>Total TTC : <strong>${euro(totalDepenses)}</strong></p>
        <button class="btn btn-primary" id="export-depenses" ${depenses.length ? '' : 'disabled'}>Télécharger les dépenses (CSV)</button>
      </section>
    </div>
    <p class="hint">Les fichiers CSV s'ouvrent avec Excel, LibreOffice ou Google Sheets, et s'importent dans la plupart des logiciels comptables.
      Joignez-les à un e-mail pour votre comptable, avec les PDF des factures si besoin.</p>
  `;

  const form = document.getElementById('export-form');
  form.addEventListener('change', () => {
    const v = Object.fromEntries(new FormData(form));
    if (v.du && v.au) go(`#/export?du=${v.du <= v.au ? v.du : v.au}&au=${v.du <= v.au ? v.au : v.du}`);
  });
  document.getElementById('export-ventes').addEventListener('click', () => telechargerCsv(nomFichier('ventes'), journalVentes(du, au)));
  document.getElementById('export-depenses').addEventListener('click', () => telechargerCsv(nomFichier('depenses'), journalDepenses(du, au)));
}
