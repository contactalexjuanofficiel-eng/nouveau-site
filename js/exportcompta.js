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

// Journal en PDF : le tableau est mis en page comme un document et envoyé à
// l'impression (« Enregistrer au format PDF »), au format paysage.
function imprimerJournal(titre, lignes, du, au) {
  const e = data.entreprise;
  const [entetes, ...corps] = lignes;
  const montant = /^-?\d+,\d{2}$/;
  const totaux = entetes.map((_, i) => (corps.length && corps.every((l) => montant.test(l[i]))
    ? corps.reduce((s, l) => s + Number(l[i].replace(',', '.')), 0) : null));
  const lisible = (v) => (montant.test(v) ? Number(v.replace(',', '.')).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v);
  let zone = document.getElementById('rapport');
  if (!zone) {
    zone = document.createElement('div');
    zone.id = 'rapport';
    document.body.appendChild(zone);
  }
  zone.innerHTML = `
    <style>@page { size: A4 landscape; margin: 12mm; }</style>
    <div class="rapport-tete">
      <div><strong>${esc(e.nom || '')}</strong><br>${esc(e.adresse || '').replace(/\n/g, '<br>')}
        ${e.siret ? `<br>SIRET : ${esc(e.siret)}` : ''}${e.numeroTva && !e.franchiseTva ? `<br>N° TVA : ${esc(e.numeroTva)}` : ''}</div>
      <div class="rapport-titre"><strong>${esc(titre)}</strong><br>Du ${dateFr(du)} au ${dateFr(au)}<br><small>Édité le ${dateFr(today())}</small></div>
    </div>
    <table class="rapport-table">
      <thead><tr>${entetes.map((h, i) => `<th class="${totaux[i] !== null ? 'num' : ''}">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${corps.map((l) => `<tr>${l.map((v, i) => `<td class="${totaux[i] !== null ? 'num' : ''}">${esc(lisible(v))}</td>`).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr>${totaux.map((t, i) => `<td class="num">${i === 0 ? `<strong>Total (${corps.length})</strong>` : t !== null ? `<strong>${esc(lisible(csvNombre(t)))}</strong>` : ''}</td>`).join('')}</tr></tfoot>
    </table>`;
  document.body.classList.add('impression-rapport');
  const fin = () => {
    document.body.classList.remove('impression-rapport');
    window.removeEventListener('afterprint', fin);
  };
  window.addEventListener('afterprint', fin);
  setTimeout(() => window.print(), 50);
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
        <div><label for="export-du">Du</label><input id="export-du" name="du" type="date" min="2000-01-01" max="2099-12-31" value="${esc(du)}"></div>
        <div><label for="export-au">Au</label><input id="export-au" name="au" type="date" min="2000-01-01" max="2099-12-31" value="${esc(au)}"></div>
      </form>
    </section>
    <div class="panels">
      <section class="card">
        <h2>Journal des ventes</h2>
        <p><strong>${factures.length}</strong> facture${factures.length > 1 ? 's' : ''} du ${dateFr(du)} au ${dateFr(au)}</p>
        <p>${data.entreprise.franchiseTva ? `Total : <strong>${euro(ventes.ht)}</strong>`
          : `Total HT : <strong>${euro(ventes.ht)}</strong> · TVA : <strong>${euro(ventes.tva)}</strong> · TTC : <strong>${euro(ventes.ttc)}</strong>`}</p>
        ${factures.length ? `<div class="actions">
          <button class="btn btn-primary" id="export-ventes-pdf">Télécharger en PDF</button>
          <button class="btn" id="export-ventes">Fichier Excel (CSV)</button>
        </div>` : `<p class="hint">Aucune facture sur cette période. Choisissez une autre période ci-dessus.</p>`}
      </section>
      <section class="card">
        <h2>Dépenses</h2>
        <p><strong>${depenses.length}</strong> dépense${depenses.length > 1 ? 's' : ''} du ${dateFr(du)} au ${dateFr(au)}</p>
        <p>Total TTC : <strong>${euro(totalDepenses)}</strong></p>
        ${depenses.length ? `<div class="actions">
          <button class="btn btn-primary" id="export-depenses-pdf">Télécharger en PDF</button>
          <button class="btn" id="export-depenses">Fichier Excel (CSV)</button>
        </div>` : `<p class="hint">Aucune dépense enregistrée sur cette période. Ajoutez vos achats dans <a href="#/depenses">Dépenses</a> pour les retrouver ici.</p>`}
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
  document.getElementById('export-ventes-pdf')?.addEventListener('click', () => imprimerJournal('Journal des ventes', journalVentes(du, au), du, au));
  document.getElementById('export-depenses-pdf')?.addEventListener('click', () => imprimerJournal('Journal des dépenses', journalDepenses(du, au), du, au));
}
