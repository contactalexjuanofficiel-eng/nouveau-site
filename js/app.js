/*
 * Devizo : devis et factures pour artisans.
 * Version 1 : tout fonctionne dans le navigateur, les données sont
 * enregistrées localement (localStorage) sur l'appareil de l'utilisateur.
 */

// ====================================================================
// Données
// ====================================================================

const STORAGE_KEY = 'devizo-data-v1';

const DEFAULT_DATA = {
  entreprise: {
    nom: '',
    adresse: '',
    telephone: '',
    email: '',
    siret: '',
    numeroTva: '',
    franchiseTva: true, // micro-entreprise : TVA non applicable
    iban: '',
    mentions: '',
  },
  clients: [],
  documents: [],
};

let data = loadData();

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      return {
        ...structuredClone(DEFAULT_DATA),
        ...saved,
        entreprise: { ...DEFAULT_DATA.entreprise, ...saved.entreprise },
      };
    }
  } catch (e) {
    console.error('Impossible de lire les données enregistrées', e);
  }
  // Mode démo : on part d'exemples déjà remplis.
  return structuredClone(window.DEVIZO_DEMO_DATA || DEFAULT_DATA);
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Impossible d'enregistrer les données", e);
  }
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Fenêtre de confirmation intégrée à la page.
function ask(message, okLabel = 'Confirmer', withCancel = true) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'ask';
    dialog.innerHTML = `
      <p>${esc(message)}</p>
      <div class="actions">
        ${withCancel ? '<button class="btn" value="non">Annuler</button>' : ''}
        <button class="btn btn-primary" value="oui">${esc(okLabel)}</button>
      </div>`;
    dialog.addEventListener('click', (e) => {
      if (e.target.value) dialog.close(e.target.value);
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(dialog.returnValue === 'oui');
    });
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

function getClient(id) {
  return data.clients.find((c) => c.id === id);
}

function getDocument(id) {
  return data.documents.find((d) => d.id === id);
}

// Numérotation chronologique et sans trou : D-2026-001, F-2026-001...
function nextNumber(type) {
  const prefix = (type === 'facture' ? 'F' : 'D') + '-' + new Date().getFullYear() + '-';
  const max = data.documents
    .filter((d) => d.type === type && d.numero.startsWith(prefix))
    .reduce((m, d) => Math.max(m, parseInt(d.numero.slice(prefix.length), 10) || 0), 0);
  return prefix + String(max + 1).padStart(3, '0');
}

// ====================================================================
// Calculs
// ====================================================================

function computeTotals(doc) {
  const franchise = data.entreprise.franchiseTva;
  let ht = 0;
  const tvaParTaux = {};
  for (const line of doc.lignes) {
    const montant = (Number(line.quantite) || 0) * (Number(line.prixUnitaire) || 0);
    ht += montant;
    if (!franchise) {
      const taux = Number(line.tva) || 0;
      tvaParTaux[taux] = (tvaParTaux[taux] || 0) + (montant * taux) / 100;
    }
  }
  const tva = Object.values(tvaParTaux).reduce((a, b) => a + b, 0);
  return { ht, tvaParTaux, tva, ttc: ht + tva };
}

// ====================================================================
// Outils d'affichage
// ====================================================================

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const euroFormat = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
function euro(n) {
  return euroFormat.format(n || 0);
}

function dateFr(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const STATUTS = {
  devis: { brouillon: 'Brouillon', envoye: 'Envoyé', accepte: 'Accepté', refuse: 'Refusé' },
  facture: { 'a-payer': 'À payer', payee: 'Payée' },
};

function badge(doc) {
  return `<span class="badge badge-${esc(doc.statut)}">${esc(STATUTS[doc.type][doc.statut] || doc.statut)}</span>`;
}

function clientName(id) {
  const c = getClient(id);
  return c ? c.nom : '—';
}

const view = document.getElementById('view');

function go(hash) {
  location.hash = hash;
}

// ====================================================================
// Pages
// ====================================================================

function pageDashboard() {
  const devis = data.documents.filter((d) => d.type === 'devis');
  const factures = data.documents.filter((d) => d.type === 'facture');
  const enAttente = devis.filter((d) => d.statut === 'envoye');
  const impayees = factures.filter((d) => d.statut === 'a-payer');
  const year = String(new Date().getFullYear());
  const caAnnee = factures
    .filter((d) => d.statut === 'payee' && d.date.startsWith(year))
    .reduce((s, d) => s + computeTotals(d).ttc, 0);

  const profilIncomplet = !data.entreprise.nom || !data.entreprise.siret;

  view.innerHTML = `
    <div class="page-head">
      <h1>Tableau de bord</h1>
      <div class="actions">
        <button class="btn btn-primary" data-new="devis">+ Nouveau devis</button>
        <button class="btn" data-new="facture">+ Nouvelle facture</button>
      </div>
    </div>

    ${profilIncomplet ? `<div class="alert">👋 Bienvenue ! Commencez par renseigner <a href="#/parametres">les informations de votre entreprise</a> : elles apparaîtront sur vos devis et factures.</div>` : ''}

    <div class="stats">
      <div class="stat"><div class="label">Encaissé en ${year}</div><div class="value">${euro(caAnnee)}</div></div>
      <div class="stat"><div class="label">Factures à encaisser</div><div class="value">${euro(impayees.reduce((s, d) => s + computeTotals(d).ttc, 0))}</div></div>
      <div class="stat"><div class="label">Devis en attente de réponse</div><div class="value">${enAttente.length}</div></div>
      <div class="stat"><div class="label">Clients</div><div class="value">${data.clients.length}</div></div>
    </div>

    <div class="card">
      <h2>Derniers documents</h2>
      ${documentsTable(data.documents.slice().sort((a, b) => b.creeLe - a.creeLe).slice(0, 5))}
    </div>
  `;
}

function documentsTable(docs) {
  if (!docs.length) {
    return `<p class="empty">Aucun document pour l'instant. Créez votre premier devis !</p>`;
  }
  return `
    <div class="table-wrap"><table>
      <thead><tr><th>Numéro</th><th>Client</th><th>Date</th><th>Statut</th><th class="num">Total TTC</th><th class="num">Actions</th></tr></thead>
      <tbody>
        ${docs.map((d) => `
          <tr>
            <td><a href="#/voir/${esc(d.id)}">${esc(d.numero)}</a></td>
            <td>${esc(clientName(d.clientId))}</td>
            <td>${dateFr(d.date)}</td>
            <td>${badge(d)}</td>
            <td class="num">${euro(computeTotals(d).ttc)}</td>
            <td><div class="row-actions">
              <a class="btn btn-sm" href="#/modifier/${esc(d.id)}">Modifier</a>
              <button class="btn btn-sm" data-duplicate="${esc(d.id)}">Dupliquer</button>
              <button class="btn btn-sm btn-danger" data-delete="${esc(d.id)}">Supprimer</button>
            </div></td>
          </tr>`).join('')}
      </tbody>
    </table></div>`;
}

function pageDocuments(filtre) {
  const type = filtre === 'factures' ? 'facture' : filtre === 'devis' ? 'devis' : null;
  const docs = data.documents
    .filter((d) => !type || d.type === type)
    .sort((a, b) => b.creeLe - a.creeLe);

  view.innerHTML = `
    <div class="page-head">
      <h1>Devis &amp; factures</h1>
      <div class="actions">
        <button class="btn btn-primary" data-new="devis">+ Nouveau devis</button>
        <button class="btn" data-new="facture">+ Nouvelle facture</button>
      </div>
    </div>
    <div class="actions" style="margin-bottom:12px">
      <a class="btn btn-sm ${!type ? 'btn-primary' : ''}" href="#/documents">Tous</a>
      <a class="btn btn-sm ${type === 'devis' ? 'btn-primary' : ''}" href="#/documents/devis">Devis</a>
      <a class="btn btn-sm ${type === 'facture' ? 'btn-primary' : ''}" href="#/documents/factures">Factures</a>
    </div>
    <div class="card">${documentsTable(docs)}</div>
  `;
}

function createDocument(type) {
  const doc = {
    id: newId(),
    type,
    numero: nextNumber(type),
    clientId: data.clients[0]?.id || '',
    date: today(),
    // Devis : date de validité. Facture : date d'échéance.
    echeance: addDays(today(), 30),
    objet: '',
    lignes: [{ description: '', quantite: 1, unite: 'u', prixUnitaire: 0, tva: 20 }],
    notes: '',
    statut: type === 'facture' ? 'a-payer' : 'brouillon',
    creeLe: Date.now(),
  };
  data.documents.push(doc);
  saveData();
  go('#/modifier/' + doc.id);
}

function pageEdit(id) {
  const doc = getDocument(id);
  if (!doc) return pageNotFound();
  const franchise = data.entreprise.franchiseTva;
  const isFacture = doc.type === 'facture';

  view.innerHTML = `
    <div class="page-head">
      <h1>${isFacture ? 'Facture' : 'Devis'} ${esc(doc.numero)}</h1>
      <div class="actions">
        <a class="btn" href="#/voir/${esc(doc.id)}">Aperçu / PDF</a>
      </div>
    </div>

    <form id="doc-form">
      <div class="card">
        <div class="grid-2">
          <div>
            <label for="clientId">Client</label>
            <select id="clientId" name="clientId">
              <option value="">— Choisir un client —</option>
              ${data.clients.map((c) => `<option value="${esc(c.id)}" ${c.id === doc.clientId ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}
            </select>
            <small><a href="#/clients/nouveau?retour=${esc(doc.id)}">+ Ajouter un client</a></small>
          </div>
          <div>
            <label for="objet">Objet</label>
            <input id="objet" name="objet" value="${esc(doc.objet)}" placeholder="Ex : Rénovation salle de bain">
          </div>
          <div>
            <label for="date">Date</label>
            <input id="date" name="date" type="date" value="${esc(doc.date)}">
          </div>
          <div>
            <label for="echeance">${isFacture ? "Date d'échéance" : "Valable jusqu'au"}</label>
            <input id="echeance" name="echeance" type="date" value="${esc(doc.echeance)}">
          </div>
          <div>
            <label for="statut">Statut</label>
            <select id="statut" name="statut">
              ${Object.entries(STATUTS[doc.type]).map(([k, v]) => `<option value="${k}" ${k === doc.statut ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Prestations</h2>
        <div class="table-wrap"><table class="lines">
          <thead><tr>
            <th>Description</th><th>Qté</th><th>Unité</th><th>Prix unit. HT</th>
            ${franchise ? '' : '<th>TVA %</th>'}
            <th class="num">Total HT</th><th></th>
          </tr></thead>
          <tbody id="lines"></tbody>
        </table></div>
        <button type="button" class="btn btn-sm" id="add-line" style="margin-top:10px">+ Ajouter une ligne</button>
        <div class="totals" id="totals" style="margin-top:16px"></div>
      </div>

      <div class="card">
        <label for="notes">Notes (conditions, délais, acompte...)</label>
        <textarea id="notes" name="notes" rows="3">${esc(doc.notes)}</textarea>
      </div>
    </form>

    <div class="actions">
      <a class="btn btn-primary" href="#/voir/${esc(doc.id)}">Terminer</a>
      ${!isFacture ? `<button class="btn" id="to-invoice">Transformer en facture</button>` : ''}
      <button class="btn" id="duplicate">Dupliquer</button>
      <button class="btn btn-danger" id="delete">Supprimer</button>
    </div>
  `;

  const form = document.getElementById('doc-form');
  const linesEl = document.getElementById('lines');

  function renderLines() {
    linesEl.innerHTML = doc.lignes.map((l, i) => `
      <tr data-i="${i}">
        <td><input data-field="description" value="${esc(l.description)}" placeholder="Ex : Pose d'un lavabo"></td>
        <td><input data-field="quantite" type="number" step="any" min="0" value="${esc(l.quantite)}"></td>
        <td><select data-field="unite">
          ${['u', 'h', 'jour', 'm²', 'm', 'ml', 'forfait', 'kg', 'lot'].map((u) => `<option ${u === l.unite ? 'selected' : ''}>${u}</option>`).join('')}
        </select></td>
        <td><input data-field="prixUnitaire" type="number" step="0.01" min="0" value="${esc(l.prixUnitaire)}"></td>
        ${franchise ? '' : `<td><select data-field="tva">
          ${[20, 10, 5.5, 2.1, 0].map((t) => `<option value="${t}" ${Number(l.tva) === t ? 'selected' : ''}>${String(t).replace('.', ',')}</option>`).join('')}
        </select></td>`}
        <td class="num line-total">${euro(l.quantite * l.prixUnitaire)}</td>
        <td><button type="button" class="btn btn-sm btn-danger" data-remove="${i}" title="Supprimer la ligne">✕</button></td>
      </tr>`).join('');
    renderTotals();
  }

  function renderTotals() {
    const t = computeTotals(doc);
    document.getElementById('totals').innerHTML = totalsHtml(t);
  }

  linesEl.addEventListener('input', (e) => {
    const row = e.target.closest('tr');
    const field = e.target.dataset.field;
    if (!row || !field) return;
    const line = doc.lignes[row.dataset.i];
    line[field] = ['quantite', 'prixUnitaire', 'tva'].includes(field) ? Number(e.target.value) : e.target.value;
    row.querySelector('.line-total').textContent = euro(line.quantite * line.prixUnitaire);
    renderTotals();
    saveData();
  });

  linesEl.addEventListener('click', (e) => {
    const i = e.target.dataset.remove;
    if (i === undefined) return;
    doc.lignes.splice(Number(i), 1);
    saveData();
    renderLines();
  });

  document.getElementById('add-line').addEventListener('click', () => {
    doc.lignes.push({ description: '', quantite: 1, unite: 'u', prixUnitaire: 0, tva: 20 });
    saveData();
    renderLines();
    linesEl.querySelector('tr:last-child input').focus();
  });

  form.addEventListener('input', (e) => {
    if (e.target.closest('#lines')) return;
    if (e.target.name) {
      doc[e.target.name] = e.target.value;
      saveData();
    }
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  document.getElementById('to-invoice')?.addEventListener('click', () => convertToInvoice(doc));
  document.getElementById('duplicate').addEventListener('click', () => duplicateDocument(doc));
  document.getElementById('delete').addEventListener('click', async () => {
    if (await deleteDocument(doc)) go('#/documents');
  });

  renderLines();
}

function totalsHtml(t) {
  if (data.entreprise.franchiseTva) {
    return `<div class="grand"><span>Total</span><span>${euro(t.ht)}</span></div>`;
  }
  return `
    <div><span>Total HT</span><span>${euro(t.ht)}</span></div>
    ${Object.entries(t.tvaParTaux).filter(([, v]) => v).map(([taux, v]) =>
      `<div><span>TVA ${String(taux).replace('.', ',')} %</span><span>${euro(v)}</span></div>`).join('')}
    <div class="grand"><span>Total TTC</span><span>${euro(t.ttc)}</span></div>`;
}

// Crée une copie du document avec un nouveau numéro, puis l'ouvre.
function duplicateDocument(doc) {
  const copie = {
    ...structuredClone(doc),
    id: newId(),
    numero: nextNumber(doc.type),
    date: today(),
    echeance: addDays(today(), 30),
    statut: doc.type === 'facture' ? 'a-payer' : 'brouillon',
    creeLe: Date.now(),
  };
  delete copie.devisOrigine;
  data.documents.push(copie);
  saveData();
  go('#/modifier/' + copie.id);
}

// Supprime un document après confirmation. Renvoie true si supprimé.
async function deleteDocument(doc) {
  if (doc.type === 'facture') {
    // La numérotation des factures doit rester continue : on ne peut
    // supprimer que la dernière facture de sa série.
    const derniere = nextNumber('facture') === incrementNumber(doc.numero);
    if (!derniere) {
      await ask(
        `Pour respecter la numérotation obligatoire des factures (sans trou), seule la dernière facture peut être supprimée. ` +
        `Si la facture ${doc.numero} est erronée, modifiez-la ou faites un avoir.`,
        "D'accord", false);
      return false;
    }
    const ok = await ask(
      `Supprimer la facture ${doc.numero} ? Ne supprimez une facture que si elle n'a pas encore été envoyée au client.`,
      'Supprimer');
    if (!ok) return false;
  } else if (!(await ask(`Supprimer le devis ${doc.numero} ?`, 'Supprimer'))) {
    return false;
  }
  data.documents = data.documents.filter((d) => d.id !== doc.id);
  saveData();
  return true;
}

// F-2026-007 -> F-2026-008
function incrementNumber(numero) {
  return numero.replace(/(\d+)$/, (n) => String(Number(n) + 1).padStart(n.length, '0'));
}

async function convertToInvoice(devis) {
  const deja = data.documents.find((d) => d.devisOrigine === devis.id);
  if (deja) {
    if (await ask(`Ce devis a déjà été transformé en facture (${deja.numero}). L'ouvrir ?`, 'Ouvrir la facture')) {
      go('#/voir/' + deja.id);
    }
    return;
  }
  const facture = {
    ...structuredClone(devis),
    id: newId(),
    type: 'facture',
    numero: nextNumber('facture'),
    date: today(),
    echeance: addDays(today(), 30),
    statut: 'a-payer',
    devisOrigine: devis.id,
    creeLe: Date.now(),
  };
  devis.statut = 'accepte';
  data.documents.push(facture);
  saveData();
  go('#/voir/' + facture.id);
}

function pageView(id) {
  const doc = getDocument(id);
  if (!doc) return pageNotFound();
  const e = data.entreprise;
  const client = getClient(doc.clientId) || {};
  const isFacture = doc.type === 'facture';
  const t = computeTotals(doc);
  const origine = doc.devisOrigine ? getDocument(doc.devisOrigine) : null;

  const mentions = [];
  if (e.franchiseTva) mentions.push('TVA non applicable, art. 293 B du CGI.');
  if (isFacture) {
    mentions.push(`Paiement à réception, au plus tard le ${dateFr(doc.echeance)}.`);
    mentions.push("En cas de retard de paiement : pénalités au taux de 3 fois le taux d'intérêt légal et indemnité forfaitaire de 40 € pour frais de recouvrement. Pas d'escompte pour paiement anticipé.");
    if (e.iban) mentions.push('IBAN : ' + e.iban);
  } else {
    mentions.push(`Devis valable jusqu'au ${dateFr(doc.echeance)}.`);
  }
  if (e.mentions) mentions.push(e.mentions);

  view.innerHTML = `
    <div class="page-head no-print">
      <h1>${isFacture ? 'Facture' : 'Devis'} ${esc(doc.numero)} ${badge(doc)}</h1>
      <div class="actions">
        <a class="btn" href="#/modifier/${esc(doc.id)}">Modifier</a>
        ${window.DEVIZO_DEMO
          ? `<button class="btn btn-primary" id="print">Télécharger en PDF</button>`
          : `<button class="btn btn-primary" onclick="window.print()">Télécharger / Imprimer (PDF)</button>`}
        ${!isFacture ? `<button class="btn" id="to-invoice">Transformer en facture</button>` : ''}
        ${isFacture && doc.statut !== 'payee' ? `<button class="btn" id="mark-paid">Marquer comme payée</button>` : ''}
        <button class="btn" id="duplicate">Dupliquer</button>
        <button class="btn btn-danger" id="delete">Supprimer</button>
      </div>
    </div>

    <div class="doc">
      <div class="doc-head">
        <div>
          <strong>${esc(e.nom || 'Nom de votre entreprise')}</strong><br>
          ${esc(e.adresse).replace(/\n/g, '<br>')}<br>
          ${e.telephone ? 'Tél. ' + esc(e.telephone) + '<br>' : ''}
          ${e.email ? esc(e.email) + '<br>' : ''}
          ${e.siret ? '<small>SIRET : ' + esc(e.siret) + '</small><br>' : ''}
          ${e.numeroTva && !e.franchiseTva ? '<small>N° TVA : ' + esc(e.numeroTva) + '</small>' : ''}
        </div>
        <div style="text-align:right">
          <p class="doc-title">${isFacture ? 'FACTURE' : 'DEVIS'}</p>
          <div>N° ${esc(doc.numero)}</div>
          <div>Date : ${dateFr(doc.date)}</div>
          ${origine ? `<div><small>Réf. devis ${esc(origine.numero)}</small></div>` : ''}
        </div>
      </div>

      <div class="doc-head">
        <div>${doc.objet ? `<strong>Objet :</strong> ${esc(doc.objet)}` : ''}</div>
        <div class="doc-client">
          <small>Client</small><br>
          <strong>${esc(client.nom || '—')}</strong><br>
          ${esc(client.adresse || '').replace(/\n/g, '<br>')}
          ${client.siret ? '<br><small>SIRET : ' + esc(client.siret) + '</small>' : ''}
        </div>
      </div>

      <div class="table-wrap"><table>
        <thead><tr>
          <th>Description</th><th class="num">Qté</th><th class="num">Prix unit. HT</th>
          ${e.franchiseTva ? '' : '<th class="num">TVA</th>'}
          <th class="num">Total HT</th>
        </tr></thead>
        <tbody>
          ${doc.lignes.map((l) => `
            <tr>
              <td>${esc(l.description)}</td>
              <td class="num">${esc(String(l.quantite).replace('.', ','))} ${esc(l.unite)}</td>
              <td class="num">${euro(l.prixUnitaire)}</td>
              ${e.franchiseTva ? '' : `<td class="num">${esc(String(l.tva).replace('.', ','))} %</td>`}
              <td class="num">${euro(l.quantite * l.prixUnitaire)}</td>
            </tr>`).join('')}
        </tbody>
      </table></div>

      <div class="totals" style="margin-top:16px">${totalsHtml(t)}</div>

      ${doc.notes ? `<p style="margin-top:24px;white-space:pre-line">${esc(doc.notes)}</p>` : ''}

      ${!isFacture ? `<div class="signature">Bon pour accord : date et signature du client</div>` : ''}

      <div class="doc-mentions">${mentions.map(esc).join('\n')}</div>
    </div>
  `;

  document.getElementById('to-invoice')?.addEventListener('click', () => convertToInvoice(doc));
  document.getElementById('print')?.addEventListener('click', () => {
    ask("Dans l'aperçu, le téléchargement est bloqué. Sur le vrai site, ce bouton enregistre le document en PDF.", "D'accord");
  });
  document.getElementById('mark-paid')?.addEventListener('click', () => {
    doc.statut = 'payee';
    saveData();
    render();
  });
  document.getElementById('duplicate').addEventListener('click', () => duplicateDocument(doc));
  document.getElementById('delete').addEventListener('click', async () => {
    if (await deleteDocument(doc)) go('#/documents');
  });
}

function pageClients() {
  view.innerHTML = `
    <div class="page-head">
      <h1>Clients</h1>
      <a class="btn btn-primary" href="#/clients/nouveau">+ Nouveau client</a>
    </div>
    <div class="card">
      ${data.clients.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Nom</th><th>Téléphone</th><th>Email</th><th></th></tr></thead>
          <tbody>
            ${data.clients.map((c) => `
              <tr>
                <td><strong>${esc(c.nom)}</strong><br><small>${esc(c.adresse).replace(/\n/g, ', ')}</small></td>
                <td>${esc(c.telephone)}</td>
                <td>${esc(c.email)}</td>
                <td class="num"><a class="btn btn-sm" href="#/clients/${esc(c.id)}">Modifier</a></td>
              </tr>`).join('')}
          </tbody>
        </table></div>` : `<p class="empty">Aucun client pour l'instant.</p>`}
    </div>
  `;
}

function pageClientForm(id, retour) {
  const isNew = id === 'nouveau';
  const client = isNew ? { nom: '', adresse: '', telephone: '', email: '', siret: '' } : getClient(id);
  if (!client) return pageNotFound();
  const utilise = !isNew && data.documents.some((d) => d.clientId === client.id);

  view.innerHTML = `
    <div class="page-head"><h1>${isNew ? 'Nouveau client' : esc(client.nom)}</h1></div>
    <form id="client-form" class="card">
      <div class="grid-2">
        <div><label for="nom">Nom ou raison sociale *</label><input id="nom" name="nom" required value="${esc(client.nom)}"></div>
        <div><label for="telephone">Téléphone</label><input id="telephone" name="telephone" type="tel" value="${esc(client.telephone)}"></div>
        <div><label for="email">Email</label><input id="email" name="email" type="email" value="${esc(client.email)}"></div>
        <div><label for="siret">SIRET (si professionnel)</label><input id="siret" name="siret" value="${esc(client.siret)}"></div>
      </div>
      <div style="margin-top:12px"><label for="adresse">Adresse</label><textarea id="adresse" name="adresse" rows="3">${esc(client.adresse)}</textarea></div>
      <div class="actions" style="margin-top:16px">
        <button class="btn btn-primary" type="submit">Enregistrer</button>
        <a class="btn" href="${retour ? '#/modifier/' + esc(retour) : '#/clients'}">Annuler</a>
        ${!isNew && !utilise ? `<button class="btn btn-danger" type="button" id="delete">Supprimer</button>` : ''}
      </div>
    </form>
  `;

  document.getElementById('client-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.target));
    if (isNew) {
      const created = { id: newId(), ...values };
      data.clients.push(created);
      const doc = retour && getDocument(retour);
      if (doc) doc.clientId = created.id;
    } else {
      Object.assign(client, values);
    }
    saveData();
    go(retour ? '#/modifier/' + retour : '#/clients');
  });

  document.getElementById('delete')?.addEventListener('click', async () => {
    if (await ask(`Supprimer le client ${client.nom} ?`, 'Supprimer')) {
      data.clients = data.clients.filter((c) => c.id !== client.id);
      saveData();
      go('#/clients');
    }
  });
}

function pageSettings() {
  const e = data.entreprise;
  view.innerHTML = `
    <div class="page-head"><h1>Mon entreprise</h1></div>
    <form id="settings-form" class="card">
      <p style="margin-top:0;color:var(--muted)">Ces informations apparaissent sur tous vos devis et factures.</p>
      <div class="grid-2">
        <div><label for="nom">Nom de l'entreprise *</label><input id="nom" name="nom" value="${esc(e.nom)}" placeholder="Ex : Dupont Plomberie"></div>
        <div><label for="siret">SIRET *</label><input id="siret" name="siret" value="${esc(e.siret)}"></div>
        <div><label for="telephone">Téléphone</label><input id="telephone" name="telephone" type="tel" value="${esc(e.telephone)}"></div>
        <div><label for="email">Email</label><input id="email" name="email" type="email" value="${esc(e.email)}"></div>
        <div><label for="iban">IBAN (affiché sur les factures)</label><input id="iban" name="iban" value="${esc(e.iban)}"></div>
        <div><label for="numeroTva">N° de TVA intracommunautaire</label><input id="numeroTva" name="numeroTva" value="${esc(e.numeroTva)}"></div>
      </div>
      <div style="margin-top:12px"><label for="adresse">Adresse</label><textarea id="adresse" name="adresse" rows="3">${esc(e.adresse)}</textarea></div>
      <div style="margin-top:12px">
        <label class="checkbox"><input type="checkbox" name="franchiseTva" ${e.franchiseTva ? 'checked' : ''}> Je ne facture pas la TVA (micro-entreprise, franchise en base de TVA)</label>
      </div>
      <div style="margin-top:12px"><label for="mentions">Mentions supplémentaires (assurance décennale, etc.)</label>
        <textarea id="mentions" name="mentions" rows="3" placeholder="Ex : Assurance décennale n° ... auprès de ..., couverture France">${esc(e.mentions)}</textarea></div>
      <div class="actions" style="margin-top:16px">
        <button class="btn btn-primary" type="submit">Enregistrer</button>
        <span id="saved" style="color:var(--success);align-self:center"></span>
      </div>
    </form>
  `;

  document.getElementById('settings-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const values = Object.fromEntries(new FormData(ev.target));
    data.entreprise = { ...data.entreprise, ...values, franchiseTva: values.franchiseTva === 'on' };
    saveData();
    document.getElementById('saved').textContent = '✓ Enregistré';
  });
}

function pageNotFound() {
  view.innerHTML = `<div class="card"><p>Page introuvable.</p><a href="#/">Retour au tableau de bord</a></div>`;
}

// ====================================================================
// Navigation
// ====================================================================

function render() {
  const [path, query] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);

  document.querySelectorAll('.nav a').forEach((a) => {
    const target = a.getAttribute('href').slice(1);
    a.classList.toggle('active', target === '/' ? parts.length === 0 : path.startsWith(target));
  });

  switch (parts[0]) {
    case undefined: return pageDashboard();
    case 'documents': return pageDocuments(parts[1]);
    case 'modifier': return pageEdit(parts[1]);
    case 'voir': return pageView(parts[1]);
    case 'clients': return parts[1] ? pageClientForm(parts[1], params.get('retour')) : pageClients();
    case 'parametres': return pageSettings();
    default: return pageNotFound();
  }
}

document.addEventListener('click', async (e) => {
  const { new: type, duplicate, delete: del } = e.target.dataset || {};
  if (type) createDocument(type);
  if (duplicate) duplicateDocument(getDocument(duplicate));
  if (del && (await deleteDocument(getDocument(del)))) render();
});

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});
render();
