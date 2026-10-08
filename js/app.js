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
    // Identité
    nom: '',
    formeJuridique: 'micro',
    capital: '',
    siret: '',
    immatriculation: '', // RCS ou RM (répertoire des métiers)
    ape: '',
    logo: '', // image en data URL
    // Coordonnées
    adresse: '',
    telephone: '',
    email: '',
    siteWeb: '',
    // TVA
    franchiseTva: true, // micro-entreprise : TVA non applicable
    numeroTva: '',
    tvaDefaut: 20,
    tauxActifs: [20, 10, 5.5],
    tvaDebits: false,
    // Paiement
    delaiPaiement: 30,
    moyensPaiement: ['virement', 'cheque'],
    iban: '',
    bic: '',
    titulaire: '',
    penalites: '',
    // Devis
    validiteDevis: 30,
    acompteDefaut: 0,
    devisGratuit: true,
    conditionsDevis: '',
    // Assurance et mentions
    assureur: '',
    numeroContrat: '',
    zoneCouverture: 'France métropolitaine',
    mediateur: '',
    nonDecennale: false, // activité non soumise à la garantie décennale
    mentions: '',
    // Numérotation
    prefixeDevis: 'D',
    prefixeFacture: 'F',
    // Fiscalité (estimations du tableau de bord)
    regimeFiscal: '', // 'micro', 'is' ou 'reel' ; vide = déduit de la forme juridique
    activiteMicro: 'services',
    versementLiberatoire: false,
    tauxCharges: 45,
  },
  clients: [],
  documents: [],
  depenses: [],
};

let data = loadData();

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      return {
        ...structuredClone(DEFAULT_DATA),
        ...saved,
        entreprise: { ...structuredClone(DEFAULT_DATA.entreprise), ...saved.entreprise },
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
  const e = data.entreprise;
  const base = (type === 'facture' ? e.prefixeFacture : e.prefixeDevis) || (type === 'facture' ? 'F' : 'D');
  const prefix = base + '-' + new Date().getFullYear() + '-';
  const max = data.documents
    .filter((d) => d.type === type && d.numero.startsWith(prefix))
    .reduce((m, d) => Math.max(m, parseInt(d.numero.slice(prefix.length), 10) || 0), 0);
  return prefix + String(max + 1).padStart(3, '0');
}

// ====================================================================
// Référentiels et vérifications
// ====================================================================

const FORMES = {
  micro: 'Micro-entreprise',
  ei: 'Entreprise individuelle (EI)',
  eurl: 'EURL',
  sarl: 'SARL',
  sasu: 'SASU',
  sas: 'SAS',
  autre: 'Autre',
};

const TAUX_TVA = [
  { taux: 20, aide: 'Taux normal : construction neuve, vente de matériel seul, travaux pour les professionnels' },
  { taux: 10, aide: "Travaux d'amélioration, de transformation et d'entretien dans un logement de plus de 2 ans" },
  { taux: 5.5, aide: 'Travaux de rénovation énergétique dans un logement de plus de 2 ans' },
  { taux: 2.1, aide: 'Cas particuliers (rare dans le bâtiment)' },
  { taux: 0, aide: 'Autoliquidation (sous-traitance BTP) ou exonération' },
];

const MOYENS = { virement: 'Virement', cheque: 'Chèque', especes: 'Espèces', carte: 'Carte bancaire' };

const PENALITES_DEFAUT = "En cas de retard de paiement, pénalités au taux de 3 fois le taux d'intérêt légal. Pas d'escompte pour paiement anticipé.";

function isIndividuel(e) {
  return e.formeJuridique === 'micro' || e.formeJuridique === 'ei';
}

function tauxFr(t) {
  return String(t).replace('.', ',');
}

function newLine() {
  return { description: '', quantite: 1, unite: 'u', prixUnitaire: 0, tva: Number(data.entreprise.tvaDefaut) || 0 };
}

// SIRET : 14 chiffres + clé de Luhn.
function checkSiret(value) {
  const d = String(value).replace(/\s/g, '');
  if (!/^\d{14}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let n = Number(d[i]);
    if (i % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

// Vérifie un SIRET dans l'annuaire officiel des entreprises (service public
// gratuit de l'État : recherche-entreprises.api.gouv.fr, données INSEE).
// Renvoie { siret, statut: 'actif' | 'ferme' | 'introuvable' | 'indisponible', ... }.
const NATURES = { '1000': 'ei', '5498': 'eurl', '5499': 'sarl', '5710': 'sas', '5720': 'sasu' };

async function verifierSiret(siret) {
  const clean = String(siret).replace(/\s/g, '');
  try {
    const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${clean}&page=1&per_page=5`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const entreprise = (json.results || []).find((r) => r.siren === clean.slice(0, 9));
    if (!entreprise) return { siret: clean, statut: 'introuvable' };
    const etablissements = [entreprise.siege, ...(entreprise.matching_etablissements || [])].filter(Boolean);
    const etab = etablissements.find((x) => x.siret === clean);
    if (!etab) return { siret: clean, statut: 'introuvable' };
    const adresse = etab.adresse || [etab.numero_voie, etab.type_voie, etab.libelle_voie, etab.code_postal, etab.libelle_commune]
      .filter(Boolean).join(' ');
    const rueAnnuaire = [etab.numero_voie, etab.indice_repetition, etab.type_voie, etab.libelle_voie].filter(Boolean).join(' ');
    return {
      siret: clean,
      statut: etab.etat_administratif === 'F' || entreprise.etat_administratif === 'C' ? 'ferme' : 'actif',
      nom: entreprise.nom_complet || entreprise.nom_raison_sociale || '',
      adresse,
      rue: rueAnnuaire,
      complement: etab.complement_adresse || '',
      codePostal: etab.code_postal || '',
      ville: etab.libelle_commune || '',
      ape: String(etab.activite_principale || entreprise.activite_principale || '').replace('.', ''),
      forme: NATURES[String(entreprise.nature_juridique)] || '',
      date: today(),
    };
  } catch (err) {
    console.warn('Vérification du SIRET indisponible', err);
    return { siret: clean, statut: 'indisponible' };
  }
}

// ====================================================================
// Adresses : rue, complément, code postal et ville dans des champs séparés.
// Le champ « adresse » (texte complet) est gardé pour l'affichage.
// ====================================================================

// Découpe une ancienne adresse en un seul texte (« 12 rue X\n75011 Paris »).
function decomposeAdresse(obj = {}) {
  if (obj.rue || obj.codePostal || obj.ville || obj.complement) {
    return { rue: obj.rue || '', complement: obj.complement || '', codePostal: obj.codePostal || '', ville: obj.ville || '' };
  }
  const lignes = String(obj.adresse || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const a = { rue: '', complement: '', codePostal: '', ville: '' };
  const i = lignes.findIndex((l) => /^\d{5}\s+\S/.test(l));
  if (i >= 0) {
    a.codePostal = lignes[i].slice(0, 5);
    a.ville = lignes[i].slice(5).trim();
    lignes.splice(i, 1);
  }
  a.rue = lignes.shift() || '';
  a.complement = lignes.join(', ');
  return a;
}

function composeAdresse(a) {
  return [a.rue, a.complement, [a.codePostal, a.ville].filter(Boolean).join(' ')]
    .map((x) => String(x || '').trim()).filter(Boolean).join('\n');
}

function champsAdresse(obj, requis) {
  const a = decomposeAdresse(obj);
  const etoile = requis ? ' *' : '';
  return `
    <div class="adresse-grid">
      <div class="full rue-wrap">
        <label for="rue">Numéro et rue${etoile}</label>
        <input id="rue" name="rue" autocomplete="off" value="${esc(a.rue)}" placeholder="Ex : 12 rue des Lilas">
        <ul class="suggestions" id="rue-suggestions" hidden></ul>
      </div>
      <div class="full">
        <label for="complement">Complément (bâtiment, étage, lieu-dit…)</label>
        <input id="complement" name="complement" value="${esc(a.complement)}">
      </div>
      <div>
        <label for="codePostal">Code postal${etoile}</label>
        <input id="codePostal" name="codePostal" inputmode="numeric" maxlength="5" autocomplete="postal-code" value="${esc(a.codePostal)}">
      </div>
      <div>
        <label for="ville">Ville${etoile}</label>
        <input id="ville" name="ville" list="villes" autocomplete="address-level2" value="${esc(a.ville)}">
        <datalist id="villes"></datalist>
      </div>
    </div>`;
}

// Suggestions d'adresses (Base Adresse Nationale) et ville d'après le code postal
// (geo.api.gouv.fr). Services publics gratuits ; s'ils ne répondent pas, la
// saisie reste simplement manuelle.
async function chercherAdresses(texte) {
  const q = encodeURIComponent(texte);
  const urls = [
    `https://data.geopf.fr/geocodage/search?q=${q}&limit=5&index=address`,
    `https://api-adresse.data.gouv.fr/search/?q=${q}&limit=5`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      return (json.features || []).map((f) => f.properties).filter((pr) => pr && pr.postcode);
    } catch {
      // service suivant
    }
  }
  return [];
}

async function villesDuCodePostal(cp) {
  try {
    const res = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom`);
    if (!res.ok) return [];
    return (await res.json()).map((c) => c.nom);
  } catch {
    return [];
  }
}

function brancherAdresse(root, onChange) {
  const $ = (id) => root.querySelector('#' + id);
  const rue = $('rue');
  const liste = $('rue-suggestions');
  const cp = $('codePostal');
  const ville = $('ville');
  let minuteur;
  let resultats = [];

  rue.addEventListener('input', () => {
    clearTimeout(minuteur);
    const texte = rue.value.trim();
    if (texte.length < 5) {
      liste.hidden = true;
      return;
    }
    minuteur = setTimeout(async () => {
      resultats = await chercherAdresses(texte + (cp.value.length === 5 ? ' ' + cp.value : ''));
      if (!document.body.contains(rue) || rue.value.trim() !== texte) return;
      liste.innerHTML = resultats.map((r, i) =>
        `<li><button type="button" data-i="${i}">${esc(r.label)}</button></li>`).join('');
      liste.hidden = !resultats.length;
    }, 350);
  });

  liste.addEventListener('mousedown', (e) => e.preventDefault()); // garde le focus pendant le clic
  liste.addEventListener('click', (e) => {
    const r = resultats[e.target.closest('button')?.dataset.i];
    if (!r) return;
    rue.value = r.name || r.label;
    cp.value = r.postcode || '';
    ville.value = r.city || '';
    liste.hidden = true;
    onChange?.();
  });
  rue.addEventListener('blur', () => setTimeout(() => { liste.hidden = true; }, 150));

  cp.addEventListener('input', async () => {
    cp.value = cp.value.replace(/\D/g, '').slice(0, 5);
    if (cp.value.length !== 5) return;
    const villes = await villesDuCodePostal(cp.value);
    if (!document.body.contains(cp)) return;
    $('villes').innerHTML = villes.map((v) => `<option value="${esc(v)}">`).join('');
    if (villes.length === 1 || (villes.length && !villes.includes(ville.value))) {
      ville.value = villes[0];
      onChange?.();
    }
  });
}

// IBAN : contrôle modulo 97.
function checkIban(value) {
  const s = String(value).replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const digits = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => c.charCodeAt(0) - 55);
  let mod = 0;
  for (const ch of digits) mod = (mod * 10 + Number(ch)) % 97;
  return mod === 1;
}

// N° de TVA français : FR + clé + SIREN (les 9 premiers chiffres du SIRET).
function tvaFromSiret(siret) {
  const siren = String(siret).replace(/\s/g, '').slice(0, 9);
  if (!/^\d{9}$/.test(siren)) return '';
  const key = (12 + 3 * (Number(siren) % 97)) % 97;
  return 'FR' + String(key).padStart(2, '0') + siren;
}

function checkTva(value) {
  const v = String(value).replace(/\s/g, '').toUpperCase();
  if (!/^FR[0-9A-Z]{2}\d{9}$/.test(v)) return false;
  return /^\d{2}$/.test(v.slice(2, 4)) ? tvaFromSiret(v.slice(4)) === v : true;
}

// Informations obligatoires avant de pouvoir créer un devis ou une facture.
// Renvoie la liste de ce qui manque : [{ champ, texte }].
function profilManquant(e = data.entreprise) {
  const manque = [];
  if (!String(e.nom || '').trim()) manque.push({ champ: 'nom', texte: "Nom ou raison sociale de l'entreprise" });
  const a = decomposeAdresse(e);
  if (!a.rue.trim() || !/^\d{5}$/.test(a.codePostal) || !a.ville.trim()) {
    manque.push({ champ: !a.rue.trim() ? 'rue' : !/^\d{5}$/.test(a.codePostal) ? 'codePostal' : 'ville', texte: "Adresse complète de l'entreprise (rue, code postal, ville)" });
  }
  const societe = ['eurl', 'sarl', 'sasu', 'sas'].includes(e.formeJuridique);
  if (societe && !String(e.capital || '').trim()) manque.push({ champ: 'capital', texte: 'Capital social (obligatoire pour une société)' });
  if (!checkSiret(e.siret || '')) {
    manque.push({ champ: 'siret', texte: 'SIRET valide (14 chiffres)' });
  } else {
    const v = e.siretVerifie;
    if (v && v.siret === String(e.siret).replace(/\s/g, '')) {
      if (v.statut === 'ferme') manque.push({ champ: 'siret', texte: "SIRET d'un établissement en activité (celui-ci est fermé)" });
      if (v.statut === 'introuvable' && !e.siretConfirme) manque.push({ champ: 'siret', texte: "SIRET reconnu par l'annuaire officiel des entreprises" });
    }
  }
  if (!e.franchiseTva && !checkTva(e.numeroTva || '')) manque.push({ champ: 'numeroTva', texte: 'N° de TVA intracommunautaire valide' });
  if (!e.nonDecennale && (!String(e.assureur || '').trim() || !String(e.numeroContrat || '').trim())) {
    manque.push({ champ: 'assureur', texte: 'Assurance décennale : assureur et n° de contrat' });
  }
  return manque;
}

function listeManquante(manque) {
  return `<ul class="todo">${manque.map((m) =>
    `<li><a href="#/parametres?champ=${esc(m.champ)}">${esc(m.texte)}</a></li>`).join('')}</ul>`;
}

// Bloque l'action si le profil n'est pas complet. Renvoie true si on peut continuer.
async function profilPret() {
  const manque = profilManquant();
  if (!manque.length) return true;
  const ok = await ask(
    `Avant de faire un devis ou une facture, complétez « Mon entreprise » : vos documents doivent comporter les mentions obligatoires. ` +
    `Il manque : ${manque.map((m) => m.texte).join(' ; ')}.`,
    'Compléter mon entreprise');
  if (ok) go('#/parametres?champ=' + manque[0].champ);
  return false;
}

// Écran affiché à la place de toute l'application tant que le profil est incomplet.
function pageBloquee() {
  const manque = profilManquant();
  view.innerHTML = `
    <div class="card gate">
      <h1>Bienvenue sur Devizo 👋</h1>
      <p>Avant de créer vos devis, vos factures et vos clients, renseignez les informations de votre entreprise.
      En France, elles doivent obligatoirement figurer sur chaque document. Il manque encore :</p>
      ${listeManquante(manque)}
      <a class="btn btn-primary btn-lg" href="#/parametres?champ=${esc(manque[0].champ)}">Compléter mon entreprise</a>
    </div>`;
}

function echeanceDefaut(type) {
  const e = data.entreprise;
  return addDays(today(), Number(type === 'facture' ? e.delaiPaiement : e.validiteDevis) || 0);
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

// Client d'un document. S'il a été supprimé du carnet d'adresses,
// on utilise la copie gardée dans le document.
function docClient(doc) {
  return getClient(doc.clientId) || doc.clientArchive || null;
}

function clientName(doc) {
  return docClient(doc)?.nom || '—';
}

async function deleteClient(client) {
  const docs = data.documents.filter((d) => d.clientId === client.id);
  const message = docs.length
    ? `Supprimer ${client.nom} du carnet d'adresses ? Ses ${docs.length} devis et factures restent intacts, avec son nom et son adresse.`
    : `Supprimer ${client.nom} du carnet d'adresses ?`;
  if (!(await ask(message, 'Supprimer'))) return false;
  for (const d of docs) {
    d.clientArchive = { nom: client.nom, adresse: client.adresse, siret: client.siret };
  }
  data.clients = data.clients.filter((c) => c.id !== client.id);
  saveData();
  return true;
}

const view = document.getElementById('view');

function go(hash) {
  location.hash = hash;
}

// ====================================================================
// Pages
// ====================================================================

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
            <td>${esc(clientName(d))}</td>
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

async function createDocument(type) {
  if (!(await profilPret())) return;
  const doc = {
    id: newId(),
    type,
    numero: nextNumber(type),
    clientId: data.clients[0]?.id || '',
    date: today(),
    // Devis : date de validité. Facture : date d'échéance.
    echeance: echeanceDefaut(type),
    objet: '',
    lignes: [newLine()],
    notes: type === 'devis' ? data.entreprise.conditionsDevis : '',
    acompte: type === 'devis' ? Number(data.entreprise.acompteDefaut) || 0 : 0,
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
    ${backLink()}
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
              ${doc.clientArchive && !getClient(doc.clientId) ? `<option value="${esc(doc.clientId)}" selected>${esc(doc.clientArchive.nom)} (supprimé du carnet)</option>` : ''}
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
          ${isFacture ? `<div id="field-paiement" ${doc.statut === 'payee' ? '' : 'hidden'}>
            <label for="datePaiement">Payée le</label>
            <input id="datePaiement" name="datePaiement" type="date" value="${esc(doc.datePaiement || '')}">
          </div>` : ''}
          ${!isFacture ? `<div>
            <label for="acompte">Acompte demandé à la commande (%)</label>
            <input id="acompte" name="acompte" type="number" min="0" max="100" step="1" value="${esc(doc.acompte || 0)}">
          </div>` : ''}
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
          ${tauxProposes(l.tva).map((t) => `<option value="${t}" ${Number(l.tva) === t ? 'selected' : ''}>${tauxFr(t)}</option>`).join('')}
        </select></td>`}
        <td class="num line-total">${euro(l.quantite * l.prixUnitaire)}</td>
        <td><button type="button" class="btn btn-sm btn-danger" data-remove="${i}" title="Supprimer la ligne">✕</button></td>
      </tr>`).join('');
    renderTotals();
  }

  // Taux activés dans « Mon entreprise », plus celui déjà choisi sur la ligne.
  function tauxProposes(actuel) {
    const liste = (data.entreprise.tauxActifs || []).map(Number);
    if (!liste.includes(Number(actuel))) liste.push(Number(actuel));
    return liste.sort((a, b) => b - a);
  }

  function renderTotals() {
    const t = computeTotals(doc);
    document.getElementById('totals').innerHTML = totalsHtml(t, doc);
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
    doc.lignes.push(newLine());
    saveData();
    renderLines();
    linesEl.querySelector('tr:last-child input').focus();
  });

  form.addEventListener('input', (e) => {
    if (e.target.closest('#lines')) return;
    if (e.target.name) {
      // Un autre client est choisi : la copie de l'ancien client n'est plus utile.
      if (e.target.name === 'clientId' && e.target.value !== doc.clientId) delete doc.clientArchive;
      doc[e.target.name] = e.target.value;
      if (e.target.name === 'acompte') renderTotals();
      if (e.target.name === 'statut') {
        // La date de paiement sert au calcul du chiffre d'affaires encaissé.
        if (e.target.value === 'payee' && !doc.datePaiement) doc.datePaiement = today();
        const champ = document.getElementById('field-paiement');
        if (champ) {
          champ.hidden = e.target.value !== 'payee';
          document.getElementById('datePaiement').value = doc.datePaiement || '';
        }
      }
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

function totalsHtml(t, doc) {
  const acompte = doc && doc.type === 'devis' ? Number(doc.acompte) || 0 : 0;
  const ligneAcompte = acompte > 0
    ? `<div class="acompte"><span>Acompte à la commande (${tauxFr(acompte)} %)</span><span>${euro((t.ttc * acompte) / 100)}</span></div>`
    : '';
  if (data.entreprise.franchiseTva) {
    return `<div class="grand"><span>Total</span><span>${euro(t.ht)}</span></div>${ligneAcompte}`;
  }
  return `
    <div><span>Total HT</span><span>${euro(t.ht)}</span></div>
    ${Object.entries(t.tvaParTaux).filter(([, v]) => v).map(([taux, v]) =>
      `<div><span>TVA ${tauxFr(taux)} %</span><span>${euro(v)}</span></div>`).join('')}
    <div class="grand"><span>Total TTC</span><span>${euro(t.ttc)}</span></div>
    ${ligneAcompte}`;
}

// Crée une copie du document avec un nouveau numéro, puis l'ouvre.
async function duplicateDocument(doc) {
  if (!(await profilPret())) return;
  const copie = {
    ...structuredClone(doc),
    id: newId(),
    numero: nextNumber(doc.type),
    date: today(),
    echeance: echeanceDefaut(doc.type),
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
  if (!(await profilPret())) return;
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
    echeance: echeanceDefaut('facture'),
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
  const client = docClient(doc) || {};
  const isFacture = doc.type === 'facture';
  const t = computeTotals(doc);
  const origine = doc.devisOrigine ? getDocument(doc.devisOrigine) : null;

  const clientPro = Boolean(client.siret);
  const mentions = [];
  if (e.franchiseTva) mentions.push('TVA non applicable, art. 293 B du CGI.');
  else if (isFacture && e.tvaDebits) mentions.push("Option pour le paiement de la TVA d'après les débits.");
  if (isFacture) {
    mentions.push(doc.echeance && doc.echeance !== doc.date
      ? `Date d'échéance : ${dateFr(doc.echeance)}.`
      : 'Paiement à réception de la facture.');
    const moyens = (e.moyensPaiement || []).map((m) => MOYENS[m]).filter(Boolean);
    if (moyens.length) mentions.push('Moyens de paiement acceptés : ' + moyens.join(', ') + '.');
    if (e.iban) {
      mentions.push(['IBAN : ' + e.iban, e.bic && 'BIC : ' + e.bic, e.titulaire && 'Titulaire : ' + e.titulaire]
        .filter(Boolean).join(' · '));
    }
    mentions.push(e.penalites || PENALITES_DEFAUT);
    if (clientPro) mentions.push('Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 €.');
  } else {
    mentions.push(`Devis valable jusqu'au ${dateFr(doc.echeance)}.`);
    if (e.devisGratuit) mentions.push('Devis gratuit.');
  }
  if (e.assureur) {
    mentions.push(`Assurance décennale : ${e.assureur}` +
      (e.numeroContrat ? `, contrat n° ${e.numeroContrat}` : '') +
      (e.zoneCouverture ? `, couverture : ${e.zoneCouverture}` : '') + '.');
  }
  if (e.mediateur && !clientPro) {
    mentions.push(`En cas de litige, le client consommateur peut recourir gratuitement au médiateur de la consommation : ${e.mediateur}.`);
  }
  if (e.mentions) mentions.push(e.mentions);

  // « EI » obligatoire à côté du nom pour les entrepreneurs individuels.
  const nomAffiche = (e.nom || 'Nom de votre entreprise') + (isIndividuel(e) && e.nom && !/\bEI\b/.test(e.nom) ? ' EI' : '');
  const formeAffichee = !isIndividuel(e) && e.formeJuridique !== 'autre'
    ? FORMES[e.formeJuridique] + (e.capital ? ` au capital de ${new Intl.NumberFormat('fr-FR').format(Number(String(e.capital).replace(/\s/g, '').replace(',', '.')) || 0)} €` : '')
    : '';

  view.innerHTML = `
    ${backLink()}
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
          ${e.logo ? `<img class="doc-logo" src="${esc(e.logo)}" alt="">` : ''}
          <strong>${esc(nomAffiche)}</strong><br>
          ${formeAffichee ? '<small>' + esc(formeAffichee) + '</small><br>' : ''}
          ${esc(e.adresse).replace(/\n/g, '<br>')}<br>
          ${e.telephone ? 'Tél. ' + esc(e.telephone) + '<br>' : ''}
          ${e.email ? esc(e.email) + '<br>' : ''}
          ${e.siteWeb ? esc(e.siteWeb) + '<br>' : ''}
          ${e.siret ? '<small>SIRET : ' + esc(e.siret) + '</small><br>' : ''}
          ${e.immatriculation ? '<small>' + esc(e.immatriculation) + '</small><br>' : ''}
          ${e.ape ? '<small>Code APE : ' + esc(e.ape) + '</small><br>' : ''}
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

      <div class="totals" style="margin-top:16px">${totalsHtml(t, doc)}</div>

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
    doc.datePaiement = today();
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
                <td><div class="row-actions">
                  <a class="btn btn-sm" href="#/clients/${esc(c.id)}">Modifier</a>
                  <button class="btn btn-sm btn-danger" data-delete-client="${esc(c.id)}">Supprimer</button>
                </div></td>
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

  view.innerHTML = `
    <div class="page-head"><h1>${isNew ? 'Nouveau client' : esc(client.nom)}</h1></div>
    <form id="client-form" class="card">
      <div class="grid-2">
        <div><label for="nom">Nom ou raison sociale *</label><input id="nom" name="nom" required value="${esc(client.nom)}"></div>
        <div><label for="telephone">Téléphone</label><input id="telephone" name="telephone" type="tel" value="${esc(client.telephone)}"></div>
        <div><label for="email">Email</label><input id="email" name="email" type="email" value="${esc(client.email)}"></div>
        <div><label for="siret">SIRET (si professionnel)</label><input id="siret" name="siret" value="${esc(client.siret)}"></div>
      </div>
      <div class="field">${champsAdresse(client, false)}</div>
      <div class="actions" style="margin-top:16px">
        <button class="btn btn-primary" type="submit">Enregistrer</button>
        <a class="btn" href="${retour ? '#/modifier/' + esc(retour) : '#/clients'}">Annuler</a>
        ${!isNew ? `<button class="btn btn-danger" type="button" id="delete">Supprimer</button>` : ''}
      </div>
    </form>
  `;

  document.getElementById('client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!(await profilPret())) return;
    const values = Object.fromEntries(new FormData(e.target));
    values.adresse = composeAdresse(values);
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

  brancherAdresse(document.getElementById('client-form'));

  document.getElementById('delete')?.addEventListener('click', async () => {
    if (await deleteClient(client)) go('#/clients');
  });
}

function pageSettings(champ) {
  const e = data.entreprise;
  let logo = e.logo || '';

  const checked = (cond) => (cond ? 'checked' : '');
  const selected = (cond) => (cond ? 'selected' : '');

  view.innerHTML = `
    <div class="page-head"><h1>Mon entreprise</h1></div>
    <p class="intro">Ces informations apparaissent sur tous vos devis et factures. Les champs marqués * sont obligatoires : sans eux, vous ne pouvez pas créer de devis.</p>
    <div class="card checklist" id="checklist"></div>

    <form id="settings-form" novalidate>
      <section class="card">
        <h2>Identité de l'entreprise</h2>
        <div class="grid-2">
          <div>
            <label for="nom">Nom ou raison sociale *</label>
            <input id="nom" name="nom" value="${esc(e.nom)}" placeholder="Ex : Dupont Plomberie">
          </div>
          <div>
            <label for="formeJuridique">Forme juridique</label>
            <select id="formeJuridique" name="formeJuridique">
              ${Object.entries(FORMES).map(([k, v]) => `<option value="${k}" ${selected(k === e.formeJuridique)}>${v}</option>`).join('')}
            </select>
            <small class="hint" id="hint-forme"></small>
          </div>
          <div id="field-capital">
            <label for="capital">Capital social (€) *</label>
            <input id="capital" name="capital" inputmode="decimal" value="${esc(e.capital)}" placeholder="Ex : 5000">
          </div>
          <div>
            <label for="siret">SIRET *</label>
            <input id="siret" name="siret" inputmode="numeric" value="${esc(e.siret)}" placeholder="14 chiffres">
            <small class="hint" id="hint-siret"></small>
            <div id="siret-check"></div>
          </div>
          <div>
            <label for="immatriculation">Immatriculation RCS ou RM (facultatif)</label>
            <input id="immatriculation" name="immatriculation" value="${esc(e.immatriculation)}" placeholder="Ex : RCS Bordeaux 123 456 789">
            <small class="hint" id="hint-immat"></small>
          </div>
          <div>
            <label for="ape">Code APE / NAF</label>
            <input id="ape" name="ape" value="${esc(e.ape)}" placeholder="Ex : 4322A (plomberie)">
          </div>
        </div>

        <div class="logo-field">
          <div class="logo-preview" id="logo-preview">${logo ? `<img src="${esc(logo)}" alt="Logo">` : '<span>Aucun logo</span>'}</div>
          <div>
            <label for="logo-input">Logo (affiché en haut des devis et factures)</label>
            <input id="logo-input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml">
            <button type="button" class="btn btn-sm btn-danger" id="logo-remove" ${logo ? '' : 'hidden'}>Retirer le logo</button>
          </div>
        </div>
      </section>

      <section class="card">
        <h2>Coordonnées</h2>
        <div class="grid-2">
          <div><label for="telephone">Téléphone</label><input id="telephone" name="telephone" type="tel" value="${esc(e.telephone)}"></div>
          <div><label for="email">Email</label><input id="email" name="email" type="email" value="${esc(e.email)}"></div>
          <div><label for="siteWeb">Site internet</label><input id="siteWeb" name="siteWeb" value="${esc(e.siteWeb)}" placeholder="Ex : www.dupont-plomberie.fr"></div>
        </div>
        <div class="field">${champsAdresse(e, true)}</div>
      </section>

      <section class="card">
        <h2>TVA</h2>
        <div class="choices">
          <label class="choice">
            <input type="radio" name="regimeTva" value="franchise" ${checked(e.franchiseTva)}>
            <span><strong>Je ne facture pas la TVA</strong><br><small>Franchise en base (micro-entreprise sous les seuils). La mention « TVA non applicable, art. 293 B du CGI » est ajoutée automatiquement.</small></span>
          </label>
          <label class="choice">
            <input type="radio" name="regimeTva" value="assujetti" ${checked(!e.franchiseTva)}>
            <span><strong>Je facture la TVA</strong><br><small>Les montants sont affichés en HT et TTC, avec le détail par taux.</small></span>
          </label>
        </div>

        <div id="tva-options" ${e.franchiseTva ? 'hidden' : ''}>
          <div class="grid-2">
            <div>
              <label for="numeroTva">N° de TVA intracommunautaire *</label>
              <div class="input-row">
                <input id="numeroTva" name="numeroTva" value="${esc(e.numeroTva)}" placeholder="FR12 345678901">
                <button type="button" class="btn btn-sm" id="tva-calc">Calculer depuis le SIRET</button>
              </div>
              <small class="hint" id="hint-tva"></small>
            </div>
            <div>
              <label for="tvaDefaut">Taux appliqué par défaut sur une nouvelle ligne</label>
              <select id="tvaDefaut" name="tvaDefaut">
                ${TAUX_TVA.map(({ taux }) => `<option value="${taux}" ${selected(Number(e.tvaDefaut) === taux)}>${tauxFr(taux)} %</option>`).join('')}
              </select>
            </div>
          </div>

          <p class="label">Taux proposés dans vos devis et factures</p>
          <div class="taux-list">
            ${TAUX_TVA.map(({ taux, aide }) => `
              <label class="choice">
                <input type="checkbox" name="tauxActifs" value="${taux}" ${checked((e.tauxActifs || []).map(Number).includes(taux))}>
                <span><strong>${tauxFr(taux)} %</strong><br><small>${esc(aide)}</small></span>
              </label>`).join('')}
          </div>

          <label class="checkbox field"><input type="checkbox" name="tvaDebits" ${checked(e.tvaDebits)}> J'ai opté pour le paiement de la TVA d'après les débits (mention ajoutée sur les factures)</label>
        </div>
      </section>

      <section class="card">
        <h2>Paiement</h2>
        <div class="grid-2">
          <div>
            <label for="delaiPaiement">Délai de paiement des factures</label>
            <select id="delaiPaiement" name="delaiPaiement">
              ${[[0, 'À réception'], [15, '15 jours'], [30, '30 jours'], [45, '45 jours'], [60, '60 jours (maximum légal)']]
                .map(([v, l]) => `<option value="${v}" ${selected(Number(e.delaiPaiement) === v)}>${l}</option>`).join('')}
            </select>
          </div>
          <div>
            <p class="label">Moyens de paiement acceptés</p>
            <div class="inline-checks">
              ${Object.entries(MOYENS).map(([k, v]) => `<label class="checkbox"><input type="checkbox" name="moyensPaiement" value="${k}" ${checked((e.moyensPaiement || []).includes(k))}> ${v}</label>`).join('')}
            </div>
          </div>
          <div>
            <label for="iban">IBAN</label>
            <input id="iban" name="iban" value="${esc(e.iban)}" placeholder="FR76 ...">
            <small class="hint" id="hint-iban"></small>
          </div>
          <div><label for="bic">BIC</label><input id="bic" name="bic" value="${esc(e.bic)}" placeholder="Ex : BNPAFRPPXXX"></div>
          <div><label for="titulaire">Titulaire du compte</label><input id="titulaire" name="titulaire" value="${esc(e.titulaire)}"></div>
        </div>
        <div class="field">
          <label for="penalites">Pénalités de retard</label>
          <textarea id="penalites" name="penalites" rows="2" placeholder="${esc(PENALITES_DEFAUT)}">${esc(e.penalites)}</textarea>
          <small class="hint">Laissez vide pour utiliser le texte proposé. L'indemnité de 40 € est ajoutée automatiquement pour les clients professionnels.</small>
        </div>
      </section>

      <section class="card">
        <h2>Devis</h2>
        <div class="grid-2">
          <div>
            <label for="validiteDevis">Durée de validité</label>
            <select id="validiteDevis" name="validiteDevis">
              ${[15, 30, 60, 90].map((v) => `<option value="${v}" ${selected(Number(e.validiteDevis) === v)}>${v} jours</option>`).join('')}
            </select>
          </div>
          <div>
            <label for="acompteDefaut">Acompte demandé par défaut (%)</label>
            <input id="acompteDefaut" name="acompteDefaut" type="number" min="0" max="100" step="1" value="${esc(e.acompteDefaut)}">
          </div>
        </div>
        <label class="checkbox field"><input type="checkbox" name="devisGratuit" ${checked(e.devisGratuit)}> Indiquer « Devis gratuit » sur mes devis</label>
        <div class="field">
          <label for="conditionsDevis">Conditions pré-remplies sur chaque nouveau devis</label>
          <textarea id="conditionsDevis" name="conditionsDevis" rows="3" placeholder="Ex : Délai d'intervention : 2 semaines après acceptation. Le matériel reste la propriété de l'entreprise jusqu'au paiement complet.">${esc(e.conditionsDevis)}</textarea>
        </div>
      </section>

      <section class="card">
        <h2>Assurance et mentions légales</h2>
        <div class="grid-2">
          <div><label for="assureur">Assureur (garantie décennale) <span class="star-decennale">*</span></label><input id="assureur" name="assureur" value="${esc(e.assureur)}" placeholder="Ex : MAAF Pro"></div>
          <div><label for="numeroContrat">N° de contrat <span class="star-decennale">*</span></label><input id="numeroContrat" name="numeroContrat" value="${esc(e.numeroContrat)}"></div>
          <div><label for="zoneCouverture">Zone couverte</label><input id="zoneCouverture" name="zoneCouverture" value="${esc(e.zoneCouverture)}"></div>
          <div>
            <label for="mediateur">Médiateur de la consommation (facultatif)</label>
            <input id="mediateur" name="mediateur" value="${esc(e.mediateur)}" placeholder="Nom et site internet du médiateur">
            <small class="hint">Si vous en avez un, il sera indiqué sur les devis et factures de vos clients particuliers. Exemple : CM2C, CNPM…</small>
          </div>
        </div>
        <label class="checkbox field"><input type="checkbox" name="nonDecennale" ${checked(e.nonDecennale)}> Mon activité n'est pas soumise à la garantie décennale (par exemple : dépannage seul, sans travaux de construction)</label>
        <div class="field"><label for="mentions">Autres mentions (ajoutées en bas de chaque document)</label>
          <textarea id="mentions" name="mentions" rows="2">${esc(e.mentions)}</textarea></div>
      </section>

      <section class="card">
        <h2>Fiscalité</h2>
        <p class="hint" style="margin-top:0">Sert à estimer vos cotisations, vos impôts et ce qu'il vous reste dans le tableau de bord.</p>
        <div class="grid-2">
          <div>
            <label for="regimeFiscal">Régime</label>
            <select id="regimeFiscal" name="regimeFiscal">
              <option value="micro" ${selected(regimeFiscal(e) === 'micro')}>Micro-entreprise (cotisations sur le chiffre d'affaires)</option>
              <option value="is" ${selected(regimeFiscal(e) === 'is')}>Société à l'impôt sur les sociétés (SAS, SARL…)</option>
              <option value="reel" ${selected(regimeFiscal(e) === 'reel')}>Entreprise individuelle au réel</option>
            </select>
          </div>
          <div id="field-activite">
            <label for="activiteMicro">Type d'activité</label>
            <select id="activiteMicro" name="activiteMicro">
              ${Object.entries(MICRO).map(([k, m]) => `<option value="${k}" ${selected(k === (e.activiteMicro || 'services'))}>${esc(m.label)}</option>`).join('')}
            </select>
          </div>
          <div id="field-charges">
            <label for="tauxCharges">Charges sociales estimées (% du bénéfice)</label>
            <input id="tauxCharges" name="tauxCharges" type="number" min="0" max="80" step="1" value="${esc(e.tauxCharges ?? 45)}">
          </div>
        </div>
        <label class="checkbox field" id="field-vl"><input type="checkbox" name="versementLiberatoire" ${checked(e.versementLiberatoire)}> J'ai opté pour le versement libératoire de l'impôt sur le revenu</label>
        <small class="hint" id="hint-fiscal"></small>
      </section>

      <section class="card">
        <h2>Numérotation</h2>
        <div class="grid-2">
          <div><label for="prefixeDevis">Préfixe des devis</label><input id="prefixeDevis" name="prefixeDevis" maxlength="6" value="${esc(e.prefixeDevis)}"></div>
          <div><label for="prefixeFacture">Préfixe des factures</label><input id="prefixeFacture" name="prefixeFacture" maxlength="6" value="${esc(e.prefixeFacture)}"></div>
        </div>
        <small class="hint" id="hint-numeros"></small>
      </section>

      <section class="card">
        <h2>Sauvegarde de vos données</h2>
        <p class="hint">Vos devis, factures et clients sont enregistrés sur cet appareil. Téléchargez régulièrement une sauvegarde pour ne rien perdre, ou pour passer sur un autre appareil.</p>
        <div class="actions">
          <button type="button" class="btn" id="export">Télécharger une sauvegarde</button>
          <label class="btn" for="import-input">Restaurer une sauvegarde</label>
          <input id="import-input" type="file" accept="application/json,.json" hidden>
        </div>
      </section>

      <div class="save-bar">
        <span id="saved" class="hint"></span>
        <button class="btn btn-primary" type="submit">Enregistrer</button>
      </div>
    </form>
  `;

  const form = document.getElementById('settings-form');
  const $ = (id) => document.getElementById(id);

  function hint(id, ok, okText, koText) {
    const el = $(id);
    const value = el.dataset.value;
    el.className = 'hint ' + (value ? (ok ? 'ok' : 'warn') : '');
    el.textContent = value ? (ok ? okText : koText) : '';
  }

  // Va au premier champ obligatoire encore vide.
  function champSuivant(manque) {
    const el = $(manque[0].champ);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
    el.classList.add('missing');
  }

  // Résultat de la vérification en ligne du SIRET.
  let verif = e.siretVerifie || null;
  let siretVerifieEnCours = '';

  function afficherVerif() {
    if (!document.body.contains(form)) return;
    const box = $('siret-check');
    const clean = $('siret').value.replace(/\s/g, '');
    if (!checkSiret(clean) || !verif || verif.siret !== clean) {
      box.innerHTML = '';
      return;
    }
    if (verif.statut === 'enCours') {
      box.innerHTML = `<div class="verif">Vérification dans l'annuaire officiel des entreprises…</div>`;
    } else if (verif.statut === 'actif') {
      box.innerHTML = `<div class="verif ok">
        <strong>✓ Entreprise trouvée dans l'annuaire officiel</strong>
        <span>${esc(verif.nom)}${verif.adresse ? ' · ' + esc(verif.adresse) : ''}${verif.ape ? ' · APE ' + esc(verif.ape) : ''}</span>
        <button type="button" class="btn btn-sm" id="siret-remplir">Remplir mes informations avec ces données</button>
      </div>`;
      $('siret-remplir').addEventListener('click', remplirDepuisAnnuaire);
    } else if (verif.statut === 'ferme') {
      box.innerHTML = `<div class="verif ko"><strong>⚠ Cet établissement est fermé</strong>
        <span>${esc(verif.nom)}. Utilisez le SIRET de votre établissement en activité.</span></div>`;
    } else if (verif.statut === 'introuvable') {
      box.innerHTML = `<div class="verif ko"><strong>⚠ Ce SIRET n'existe pas dans l'annuaire officiel</strong>
        <span>Vérifiez-le sur votre avis de situation INSEE ou votre extrait d'immatriculation.</span>
        <label class="checkbox"><input type="checkbox" name="siretConfirme" ${checked(e.siretConfirme)}> Mon SIRET est correct : mon entreprise n'apparaît pas dans l'annuaire public (données non diffusibles)</label>
      </div>`;
    } else {
      box.innerHTML = `<div class="verif">La vérification en ligne n'est pas disponible pour le moment. Le format du SIRET est correct.</div>`;
    }
  }

  async function lancerVerif() {
    if (!document.body.contains(form)) return; // la page a été quittée entre-temps
    const clean = $('siret').value.replace(/\s/g, '');
    if (!checkSiret(clean) || clean === siretVerifieEnCours || (verif && verif.siret === clean && verif.statut !== 'indisponible')) {
      afficherVerif();
      return;
    }
    siretVerifieEnCours = clean;
    verif = { siret: clean, statut: 'enCours' };
    afficherVerif();
    const resultat = await verifierSiret(clean);
    siretVerifieEnCours = '';
    if (document.body.contains(form) && $('siret').value.replace(/\s/g, '') === clean) {
      verif = resultat;
      afficherVerif();
      form.dispatchEvent(new Event('input'));
    }
  }

  function remplirDepuisAnnuaire() {
    if (verif.nom) $('nom').value = verif.nom;
    if (verif.rue || verif.codePostal) {
      $('rue').value = verif.rue || verif.adresse || '';
      $('complement').value = verif.complement || '';
      $('codePostal').value = verif.codePostal || '';
      $('ville').value = verif.ville || '';
    } else if (verif.adresse) {
      $('rue').value = verif.adresse;
    }
    if (verif.ape) $('ape').value = verif.ape;
    if (verif.forme && !(verif.forme === 'ei' && $('formeJuridique').value === 'micro')) $('formeJuridique').value = verif.forme;
    form.dispatchEvent(new Event('input'));
    $('siret-remplir').textContent = '✓ Informations remplies, pensez à enregistrer';
  }

  function refresh() {
    const forme = $('formeJuridique').value;
    const societe = ['eurl', 'sarl', 'sasu', 'sas'].includes(forme);
    // Aide : le n° RCS, c'est « RCS » + ville du greffe + SIREN (les 9 premiers chiffres du SIRET).
    const siren = $('siret').value.replace(/\s/g, '').slice(0, 9);
    const sirenFormate = /^\d{9}$/.test(siren) ? siren.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') : '123 456 789';
    $('hint-immat').textContent = societe
      ? `Il s'écrit « RCS » + la ville de votre greffe + votre SIREN, par exemple : RCS Bordeaux ${sirenFormate}. Vous le trouvez sur votre extrait Kbis.`
      : `Artisan : « RM » + votre SIREN, par exemple : RM ${sirenFormate}. Commerçant : « RCS » + la ville de votre greffe + votre SIREN.`;
    document.querySelectorAll('.star-decennale').forEach((el) => { el.hidden = form.nonDecennale.checked; });

    // Liste de contrôle en direct
    const actuel = collect();
    const manque = profilManquant(actuel);
    // Nombre d'informations obligatoires selon la situation de l'entreprise.
    const total = 3 + (societe ? 1 : 0) + (actuel.franchiseTva ? 0 : 1) +
      (actuel.nonDecennale ? 0 : 1);
    $('checklist').className = 'card checklist ' + (manque.length ? '' : 'done');
    $('checklist').innerHTML = manque.length
      ? `<div class="checklist-head"><strong>Encore ${manque.length} information${manque.length > 1 ? 's' : ''} obligatoire${manque.length > 1 ? 's' : ''} avant votre premier devis</strong>
           <div class="progress"><span style="width:${Math.round(((total - manque.length) / total) * 100)}%"></span></div></div>
         <ul class="todo">${manque.map((m) => `<li><button type="button" class="link" data-champ="${esc(m.champ)}">${esc(m.texte)}</button></li>`).join('')}</ul>`
      : `<strong>✓ Toutes les mentions obligatoires sont renseignées.</strong> Vous pouvez créer vos devis et factures.`;
    form.querySelectorAll('.missing').forEach((el) => {
      if (!manque.some((m) => m.champ === el.id)) el.classList.remove('missing');
    });
    $('field-capital').hidden = forme === 'micro' || forme === 'ei' || forme === 'autre';

    // Fiscalité : champs selon le régime, et rappel des taux appliqués.
    const reg = $('regimeFiscal').value;
    $('field-activite').hidden = reg !== 'micro';
    $('field-vl').hidden = reg !== 'micro';
    $('field-charges').hidden = reg !== 'reel';
    const mi = MICRO[$('activiteMicro').value] || MICRO.services;
    $('hint-fiscal').textContent = reg === 'micro'
      ? `Taux 2026 appliqués : cotisations ${tauxFr(mi.cotis)} % + formation ${tauxFr(mi.cfp)} % du chiffre d'affaires` +
        (form.versementLiberatoire.checked ? `, impôt ${tauxFr(mi.vl)} %` : '') + `. Plafond micro : ${euro(mi.plafond)}.`
      : reg === 'is'
        ? `Impôt sur les sociétés : ${IS_TAUX_REDUIT} % jusqu'à ${euro(IS_PLAFOND_REDUIT)} de bénéfice, ${IS_TAUX_NORMAL} % au-delà. La rémunération du dirigeant n'est pas prise en compte.`
        : "Au réel, les charges sociales sont d'environ 40 à 45 % du bénéfice. L'impôt sur le revenu n'est pas estimé.";
    $('hint-forme').textContent = forme === 'micro' || forme === 'ei'
      ? 'La mention « EI » sera ajoutée après votre nom, comme la loi l’exige.'
      : '';
    $('tva-options').hidden = form.regimeTva.value !== 'assujetti';

    $('hint-siret').dataset.value = $('siret').value.trim();
    hint('hint-siret', checkSiret($('siret').value), '✓ SIRET valide', '⚠ Ce SIRET semble incorrect : vérifiez les 14 chiffres.');
    $('hint-iban').dataset.value = $('iban').value.trim();
    hint('hint-iban', checkIban($('iban').value), '✓ IBAN valide', '⚠ Cet IBAN semble incorrect.');
    $('hint-tva').dataset.value = $('numeroTva').value.trim();
    hint('hint-tva', checkTva($('numeroTva').value), '✓ Numéro de TVA valide', '⚠ Format attendu : FR + 2 caractères + SIREN (9 chiffres).');

    const year = new Date().getFullYear();
    $('hint-numeros').textContent =
      `Exemple : ${$('prefixeDevis').value || 'D'}-${year}-001 et ${$('prefixeFacture').value || 'F'}-${year}-001. ` +
      'Changer de préfixe démarre une nouvelle série numérotée à partir de 001.';
  }

  let minuteur;
  $('siret').addEventListener('input', () => {
    clearTimeout(minuteur);
    minuteur = setTimeout(lancerVerif, 600);
    afficherVerif();
  });

  form.addEventListener('input', () => {
    refresh();
    $('saved').className = 'hint warn';
    $('saved').textContent = 'Modifications non enregistrées';
  });

  $('tva-calc').addEventListener('click', async () => {
    const numero = tvaFromSiret($('siret').value);
    if (!numero) {
      await ask("Renseignez d'abord un SIRET valide (14 chiffres) pour calculer votre numéro de TVA.", "D'accord", false);
      return;
    }
    $('numeroTva').value = numero;
    form.dispatchEvent(new Event('input'));
  });

  // Logo : redimensionné pour rester léger.
  $('logo-input').addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, 400 / img.width, 200 / img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        logo = canvas.toDataURL('image/png');
        $('logo-preview').innerHTML = `<img src="${logo}" alt="Logo">`;
        $('logo-remove').hidden = false;
        form.dispatchEvent(new Event('input'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  $('logo-remove').addEventListener('click', () => {
    logo = '';
    $('logo-input').value = '';
    $('logo-preview').innerHTML = '<span>Aucun logo</span>';
    $('logo-remove').hidden = true;
    form.dispatchEvent(new Event('input'));
  });

  // Valeurs actuelles du formulaire, au même format que data.entreprise.
  function collect() {
    const fd = new FormData(form);
    const values = Object.fromEntries(fd);
    const tauxActifs = fd.getAll('tauxActifs').map(Number);
    const tvaDefaut = Number(values.tvaDefaut);
    if (!tauxActifs.includes(tvaDefaut)) tauxActifs.push(tvaDefaut);
    delete values.regimeTva;
    values.adresse = composeAdresse(values);
    return {
      ...data.entreprise,
      ...values,
      logo,
      franchiseTva: form.regimeTva.value !== 'assujetti',
      tvaDefaut,
      tauxActifs,
      tvaDebits: fd.has('tvaDebits'),
      devisGratuit: fd.has('devisGratuit'),
      moyensPaiement: fd.getAll('moyensPaiement'),
      delaiPaiement: Number(values.delaiPaiement),
      validiteDevis: Number(values.validiteDevis),
      acompteDefaut: Math.min(100, Math.max(0, Number(values.acompteDefaut) || 0)),
      prefixeDevis: (values.prefixeDevis || 'D').trim(),
      prefixeFacture: (values.prefixeFacture || 'F').trim(),
      nonDecennale: fd.has('nonDecennale'),
      versementLiberatoire: fd.has('versementLiberatoire'),
      tauxCharges: Number(values.tauxCharges) || 0,
      siretVerifie: verif && verif.statut !== 'enCours' && verif.statut !== 'indisponible' ? verif : null,
      siretConfirme: fd.has('siretConfirme'),
    };
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const etaitIncomplet = profilManquant().length > 0;
    data.entreprise = collect();
    saveData();
    const manque = profilManquant();
    $('saved').className = 'hint ' + (manque.length ? 'warn' : 'ok');
    $('saved').textContent = manque.length
      ? `✓ Enregistré · il manque encore ${manque.length} information${manque.length > 1 ? 's' : ''}`
      : '✓ Enregistré';
    majPastille();
    if (etaitIncomplet && !manque.length) {
      const go2 = await ask('Tout est prêt ! Vos devis et factures comporteront toutes les mentions obligatoires.', 'Créer mon premier devis');
      if (go2) createDocument('devis');
    } else if (manque.length) {
      champSuivant(manque);
    }
  });

  // Sauvegarde et restauration
  $('export').addEventListener('click', async () => {
    if (window.DEVIZO_DEMO) {
      await ask("Dans l'aperçu, le téléchargement est bloqué. Sur le vrai site, ce bouton télécharge un fichier avec toutes vos données.", "D'accord", false);
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `devizo-sauvegarde-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('import-input').addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let saved;
      try {
        saved = JSON.parse(reader.result);
      } catch {
        saved = null;
      }
      if (!saved || !saved.entreprise || !Array.isArray(saved.clients) || !Array.isArray(saved.documents)) {
        await ask("Ce fichier n'est pas une sauvegarde Devizo.", "D'accord", false);
        return;
      }
      const ok = await ask(
        `Restaurer cette sauvegarde (${saved.documents.length} documents, ${saved.clients.length} clients) ? Les données actuelles de cet appareil seront remplacées.`,
        'Restaurer');
      if (!ok) return;
      data = {
        ...structuredClone(DEFAULT_DATA),
        ...saved,
        entreprise: { ...structuredClone(DEFAULT_DATA.entreprise), ...saved.entreprise },
      };
      saveData();
      render();
    };
    reader.readAsText(file);
  });

  $('checklist').addEventListener('click', (ev) => {
    const id = ev.target.dataset.champ;
    if (id) champSuivant([{ champ: id }]);
  });

  brancherAdresse(form, () => form.dispatchEvent(new Event('input')));
  refresh();
  lancerVerif();
  if (champ && $(champ)) {
    // Ouvre la partie TVA si c'est elle qui manque.
    if (champ === 'numeroTva') $('tva-options').hidden = false;
    setTimeout(() => champSuivant([{ champ }]), 50);
  }
}

function majPastille() {
  const nb = profilManquant().length;
  const lien = document.querySelector('.nav a[href="#/parametres"]');
  if (lien) lien.innerHTML = 'Mon entreprise' + (nb ? ` <span class="pill">${nb}</span>` : '');
  // Les autres pages sont verrouillées tant que le profil est incomplet.
  document.querySelectorAll('.nav a:not([href="#/parametres"])').forEach((a) => a.classList.toggle('locked', nb > 0));
}

function pageNotFound() {
  view.innerHTML = `<div class="card"><p>Page introuvable.</p><a href="#/">Retour au tableau de bord</a></div>`;
}

// ====================================================================
// Navigation
// ====================================================================

// Dernière liste consultée, pour le bouton « Retour ».
let lastList = { hash: '#/documents', label: 'Devis & factures' };

function backLink() {
  return `<a class="back no-print" href="${esc(lastList.hash)}">← Retour : ${esc(lastList.label)}</a>`;
}

const LISTES = {
  '': 'Tableau de bord',
  documents: 'Devis & factures',
  clients: 'Clients',
  depenses: 'Dépenses',
};

function render() {
  const [path, query] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);

  document.querySelectorAll('.nav a').forEach((a) => {
    const target = a.getAttribute('href').slice(1);
    a.classList.toggle('active', target === '/' ? parts.length === 0 : path.startsWith(target));
  });

  // On mémorise les pages de liste (pas les fiches client ni les documents).
  if ((parts[0] ?? '') in LISTES && (parts[0] !== 'clients' || !parts[1])) {
    lastList = { hash: location.hash || '#/', label: LISTES[parts[0] ?? ''] };
  }

  majPastille();

  // Tant que « Mon entreprise » est incomplet, seule cette page est accessible.
  const bloque = profilManquant().length > 0;
  if (bloque && parts[0] !== 'parametres') return pageBloquee();

  switch (parts[0]) {
    case undefined: return pageDashboard();
    case 'documents': return pageDocuments(parts[1]);
    case 'modifier': return pageEdit(parts[1]);
    case 'voir': return pageView(parts[1]);
    case 'clients': return parts[1] ? pageClientForm(parts[1], params.get('retour')) : pageClients();
    case 'parametres': return pageSettings(params.get('champ'));
    case 'depenses': return pageDepenses(params);
    default: return pageNotFound();
  }
}

document.addEventListener('click', async (e) => {
  const { new: type, duplicate, delete: del, deleteClient: delClient } = e.target.dataset || {};
  if (type) createDocument(type);
  if (duplicate) duplicateDocument(getDocument(duplicate));
  if (del && (await deleteDocument(getDocument(del)))) render();
  if (delClient && (await deleteClient(getClient(delClient)))) render();
});

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});
render();
