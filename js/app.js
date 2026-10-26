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
  catalogue: [],
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
  // Fin d'essai sans abonnement : lecture seule, la modification est annulée.
  if (!Abonnement.peutModifier()) {
    data = loadData();
    Abonnement.refuserModification();
    render();
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Impossible d'enregistrer les données", e);
  }
  Compte.modifie(); // envoi en ligne si un compte est connecté
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Moment du dernier changement d'écran (page ou fenêtre). Un 2e tap arrivé juste
// après (double tap) ne doit pas déclencher un bouton du nouvel écran.
let ecranChange = 0;
document.addEventListener('click', (e) => {
  if (e.isTrusted && Date.now() - ecranChange < 350) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

// Comportement commun des fenêtres : se ferment en touchant le fond, en glissant
// vers le bas sur téléphone, ou quand on change de page (bouton retour).
function fenetreTactile(dialog, annuler = () => dialog.close()) {
  ecranChange = Date.now();
  dialog.dataset.page = location.hash;
  // Pas de clavier qui surgit à l'ouverture sur téléphone.
  if (matchMedia('(pointer: coarse)').matches && document.activeElement?.matches?.('input, textarea')) document.activeElement.blur();
  dialog.addEventListener('click', (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) annuler();
  });
  let g = null;
  dialog.addEventListener('touchstart', (e) => {
    g = innerWidth <= 760 && dialog.scrollTop <= 0 && !e.target.closest('input, textarea, select')
      ? { y: e.touches[0].clientY, t: Date.now(), dy: 0 } : null;
  }, { passive: true });
  dialog.addEventListener('touchmove', (e) => {
    if (!g) return;
    g.dy = Math.max(0, e.touches[0].clientY - g.y);
    dialog.style.transition = 'none';
    dialog.style.transform = `translateY(${g.dy}px)`;
  }, { passive: true });
  dialog.addEventListener('touchend', () => {
    if (!g) return;
    const { dy, t } = g;
    g = null;
    dialog.style.transition = '';
    dialog.style.transform = '';
    if (dy > 100 || (dy > 40 && dy / (Date.now() - t) > 0.5)) annuler();
  });
}
window.addEventListener('hashchange', () => {
  ecranChange = Date.now();
  document.querySelectorAll('dialog[open]').forEach((d) => {
    if (d.dataset.page !== undefined && d.dataset.page !== location.hash) d.close();
  });
});

// Boutons qui effacent quelque chose : en rouge.
const ACTION_DANGER = /^(Supprimer|Tout effacer|Effacer|Retirer|Résilier|Quitter)/;

// Fenêtre de confirmation intégrée à la page. withCancel : false, true ou le texte du bouton d'annulation.
function ask(message, okLabel = 'Confirmer', withCancel = true) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'ask';
    dialog.innerHTML = `
      <p>${esc(message)}</p>
      <div class="actions">
        ${withCancel ? `<button class="btn" value="non">${esc(typeof withCancel === 'string' ? withCancel : 'Annuler')}</button>` : ''}
        <button class="btn ${ACTION_DANGER.test(okLabel) ? 'btn-danger-plein' : 'btn-primary'}" value="oui">${esc(okLabel)}</button>
      </div>`;
    dialog.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b?.value) dialog.close(b.value);
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(dialog.returnValue === 'oui');
    });
    document.body.appendChild(dialog);
    dialog.showModal();
    fenetreTactile(dialog, () => dialog.close('non'));
  });
}

// Fenêtre de choix entre plusieurs boutons. Renvoie la valeur choisie, ou null.
function choisir(message, options, details = '') {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'ask';
    dialog.innerHTML = `
      <p>${esc(message)}</p>
      ${details ? `<p class="hint">${esc(details)}</p>` : ''}
      <div class="choix">
        ${options.map(([v, titre, aide]) => `<button class="btn choix-option" value="${esc(v)}"><strong>${esc(titre)}</strong>${aide ? `<small>${esc(aide)}</small>` : ''}</button>`).join('')}
      </div>
      <div class="actions"><button class="btn" value="">Annuler</button></div>`;
    dialog.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) dialog.close(b.value);
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(dialog.returnValue || null);
    });
    document.body.appendChild(dialog);
    dialog.showModal();
    fenetreTactile(dialog, () => dialog.close(''));
  });
}

function getClient(id) {
  return data.clients.find((c) => c.id === id);
}

function getDocument(id) {
  return data.documents.find((d) => d.id === id);
}

// Numérotation chronologique et sans trou : D-2026-001, F-2026-001, A-2026-001 (avoirs)...
function nextNumber(type) {
  const e = data.entreprise;
  const base = type === 'avoir' ? 'A' : (type === 'facture' ? e.prefixeFacture : e.prefixeDevis) || (type === 'facture' ? 'F' : 'D');
  const prefix = base + '-' + new Date().getFullYear() + '-';
  const max = data.documents
    .filter((d) => d.type === type && d.numero.startsWith(prefix))
    .reduce((m, d) => Math.max(m, parseInt(d.numero.slice(prefix.length), 10) || 0), 0);
  return prefix + String(max + 1).padStart(3, '0');
}

// Devis fait avec le générateur gratuit (devis-gratuit.html) : à la connexion,
// il est ajouté au compte, avec l'entreprise (champs vides seulement) et le client.
async function importerDevisGratuit(compteNeuf) {
  let g;
  try {
    g = JSON.parse(localStorage.getItem('devizo-devis-gratuit'));
  } catch (e) {
    return null;
  }
  if (!g || !g.devis || Date.now() - (g.le || 0) > 7 * 86400000) {
    localStorage.removeItem('devizo-devis-gratuit');
    return null;
  }
  if (!Abonnement.peutModifier()) return null;
  const titre = g.devis.objet || g.client?.nom || 'votre devis';
  if (!compteNeuf && !(await ask(`Ajouter à votre compte le devis « ${titre} » fait avec le générateur gratuit ?`, 'Ajouter', 'Non merci'))) {
    localStorage.removeItem('devizo-devis-gratuit');
    return null;
  }
  const e = data.entreprise;
  const ge = g.entreprise || {};
  const vide = !e.nom;
  for (const k of ['nom', 'rue', 'codePostal', 'ville', 'siret', 'telephone', 'email', 'numeroTva', 'assureur', 'numeroContrat']) {
    if (!e[k] && ge[k]) e[k] = String(ge[k]).trim();
  }
  e.siret = String(e.siret || '').replace(/\s/g, '');
  if (vide) {
    if (FORMES[ge.formeJuridique]) e.formeJuridique = ge.formeJuridique;
    e.franchiseTva = Boolean(ge.franchiseTva);
    e.devisGratuit = Boolean(ge.devisGratuit);
  }
  if (!e.adresse) e.adresse = composeAdresse(e);
  const gc = g.client || {};
  let client = data.clients.find((c) => c.nom && c.nom.trim().toLowerCase() === String(gc.nom || '').trim().toLowerCase());
  if (!client && gc.nom) {
    client = { id: newId(), nom: gc.nom.trim(), rue: gc.rue || '', codePostal: gc.codePostal || '', ville: gc.ville || '' };
    client.adresse = composeAdresse(client);
    data.clients.push(client);
  }
  const numeroPris = data.documents.some((d) => d.numero === g.devis.numero);
  const doc = {
    id: newId(),
    type: 'devis',
    numero: g.devis.numero && !numeroPris ? g.devis.numero : nextNumber('devis'),
    clientId: client?.id || '',
    date: g.devis.date || today(),
    echeance: g.devis.echeance || echeanceDefaut('devis'),
    objet: g.devis.objet || '',
    lignes: (g.devis.lignes || []).filter((l) => l.description || Number(String(l.prixUnitaire).replace(',', '.')))
      .map((l) => ({ description: l.description || '', quantite: Number(String(l.quantite).replace(',', '.')) || 0, unite: l.unite || 'u',
        prixUnitaire: Number(String(l.prixUnitaire).replace(',', '.')) || 0, tva: e.franchiseTva ? 0 : Number(l.tva) || 0 })),
    notes: '',
    acompte: 0,
    statut: 'envoye',
    creeLe: Date.now(),
  };
  if (!doc.lignes.length) doc.lignes = [newLine()];
  data.documents.push(doc);
  localStorage.removeItem('devizo-devis-gratuit');
  saveData();
  return doc;
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
  // La Poste (SIREN 356 000 000) : ses établissements suivent une autre règle.
  if (d.startsWith('356000000') && [...d].reduce((a, c) => a + Number(c), 0) % 5 === 0) return true;
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

// Créer ou modifier : seul l'abonnement compte (après l'essai, lecture seule).
// On peut découvrir l'appli et préparer ses devis avant d'avoir tout rempli.
function peutCreer() {
  if (Abonnement.peutModifier()) return true;
  Abonnement.refuserModification();
  return false;
}

// Télécharger, imprimer ou envoyer un document : il doit porter les mentions
// obligatoires, donc « Mon entreprise » doit être complète. Renvoie true si c'est bon.
async function profilPret() {
  if (!peutCreer()) return false;
  const manque = profilManquant();
  // Un administrateur peut tout tester, même avec un profil incomplet.
  if (!manque.length || (typeof Compte !== 'undefined' && Compte.estAdmin?.())) return true;
  const ok = await ask(manque.length === 1
    ? 'Votre document est presque prêt : il manque une information sur votre entreprise, obligatoire sur un devis ou une facture. Ça prend une minute.'
    : `Votre document est presque prêt : il manque ${manque.length} informations sur votre entreprise, obligatoires sur un devis ou une facture. Ça prend une minute.`,
  'Compléter (1 minute)', 'Plus tard');
  if (ok) Bienvenue.ouvrir(location.hash);
  return false;
}

function echeanceDefaut(type) {
  const e = data.entreprise;
  return addDays(today(), Number(type === 'facture' ? e.delaiPaiement : e.validiteDevis) || 0);
}

// ====================================================================
// Calculs
// ====================================================================

// Arrondi au centime (au plus proche, 0,005 vers le haut), sans les erreurs
// de calcul des nombres à virgule (1,5 × 3,33 = 4,995 → 5,00).
function arrondi(n) {
  const c = Math.round(Number((Math.abs(n) * 100).toFixed(6)));
  return (Math.sign(n) * c) / 100;
}

// Nombres saisis à la française : « 12,5 » et « 1 234,56 » sont acceptés.
// Les champs de montants sont en texte (clavier décimal), car un champ
// « number » ignore la virgule sur certains téléphones.
function lireNombre(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
const saisieNombre = (n) => (n === '' || n === null || n === undefined ? '' : String(n).replace('.', ','));

// Chaque ligne est arrondie au centime, puis la TVA de chaque taux : les
// montants affichés s'additionnent toujours exactement (HT + TVA = TTC).
const montantLigne = (line) => arrondi(lireNombre(line.quantite) * lireNombre(line.prixUnitaire));

function computeTotals(doc) {
  const franchise = data.entreprise.franchiseTva;
  let ht = 0;
  const baseParTaux = {};
  for (const line of doc.lignes) {
    const montant = montantLigne(line);
    ht += montant;
    if (!franchise) {
      const taux = Number(line.tva) || 0;
      baseParTaux[taux] = (baseParTaux[taux] || 0) + montant;
    }
  }
  ht = arrondi(ht);
  const tvaParTaux = {};
  for (const [taux, base] of Object.entries(baseParTaux)) tvaParTaux[taux] = arrondi((base * Number(taux)) / 100);
  const tva = arrondi(Object.values(tvaParTaux).reduce((a, b) => a + b, 0));
  return { ht, tvaParTaux, tva, ttc: arrondi(ht + tva) };
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
  facture: { 'a-payer': 'À payer', payee: 'Payée', annulee: 'Annulée (avoir)' },
  avoir: { 'a-rembourser': 'À rembourser', rembourse: 'Remboursé', deduit: 'Déduit' },
};
const TYPES = { devis: 'Devis', facture: 'Facture', avoir: 'Avoir' };
const libelleType = (doc) => TYPES[doc.type] || 'Document';

// Avoirs émis sur une facture.
const avoirsDe = (facture) => data.documents.filter((d) => d.type === 'avoir' && d.factureOrigine === facture.id);

// Facture non payée dont l'échéance est passée : nombre de jours de retard, sinon 0.
function joursDeRetard(doc) {
  if (doc.type !== 'facture' || doc.statut === 'payee' || doc.statut === 'annulee' || !doc.echeance) return 0;
  return Math.max(0, Math.floor((Date.parse(today()) - Date.parse(doc.echeance)) / 86400000));
}

function badge(doc) {
  const retard = joursDeRetard(doc);
  if (retard) return `<span class="badge badge-retard">En retard · ${retard} j</span>`;
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

// Dernier envoi ou signature, affiché sous le nom du client.
function suiviEnvoi(d) {
  if (d.signature) return `<small class="suivi suivi-signe">✍ Signé le ${dateFr(d.signature.le.slice(0, 10))}</small>`;
  const dernier = Envoi.dernierEnvoi(d);
  if (!dernier) return '';
  return `<small class="suivi">${dernier.type === 'relance' ? 'Relancé' : 'Envoyé'} le ${dateFr(dernier.le.slice(0, 10))}</small>`;
}

// L'étape suivante d'un document, faisable directement depuis la liste.
function actionsRapides(d) {
  const id = esc(d.id);
  if (d.type === 'avoir') {
    const f = getDocument(d.factureOrigine);
    const lien = f ? `<a class="hint" href="#/voir/${esc(f.id)}">sur ${esc(f.numero)}</a>` : '';
    if (d.statut === 'a-rembourser') return `${lien} <button class="btn btn-sm btn-primary" data-statut-doc="${id}" data-valeur="rembourse">Marquer remboursé</button>`;
    return lien;
  }
  if (d.type === 'facture' && d.statut === 'annulee') {
    const a = avoirsDe(d)[0];
    return a ? `<a class="hint" href="#/voir/${esc(a.id)}">Annulée par ${esc(a.numero)}</a>` : '';
  }
  if (d.type === 'facture') {
    if (d.statut === 'payee') return `<span class="hint">${d.datePaiement ? `Payée le ${dateFr(d.datePaiement)}` : 'Payée'}</span>`;
    return `${Envoi.aRelancer(d) ? `<button class="btn btn-sm" data-relancer="${id}">Relancer</button>` : ''}
      <button class="btn btn-sm btn-primary" data-payee="${id}">Marquer payée</button>`;
  }
  if (d.statut === 'accepte') {
    const facture = data.documents.find((f) => f.devisOrigine === d.id);
    if (!facture) {
      return `<button class="btn btn-sm btn-primary" data-facturer="${id}">Facturer →</button>
        <button class="btn btn-sm" data-devis-paye="${id}" title="Crée la facture et la marque payée">Déjà payé</button>`;
    }
    // Le devis a sa facture : on agit directement sur elle.
    return facture.statut === 'payee'
      ? `<a class="hint" href="#/voir/${esc(facture.id)}">Facture ${esc(facture.numero)} payée</a>`
      : `<a class="btn btn-sm" href="#/voir/${esc(facture.id)}">${esc(facture.numero)}</a>
        <button class="btn btn-sm btn-primary" data-payee="${esc(facture.id)}">Marquer payée</button>`;
  }
  if (d.statut === 'refuse') return '';
  if (d.statut === 'brouillon') {
    return `<button class="btn btn-sm btn-primary" data-envoyer="${id}">Envoyer</button>
      <button class="btn btn-sm" data-statut-doc="${id}" data-valeur="accepte">Accepter</button>`;
  }
  return `<button class="btn btn-sm btn-primary" data-statut-doc="${id}" data-valeur="accepte">Accepter</button>
    <button class="btn btn-sm" data-statut-doc="${id}" data-valeur="refuse">Refuser</button>`;
}

// Le statut est cliquable : on le change directement depuis la liste.
function statutCliquable(d) {
  const options = Object.entries(STATUTS[d.type]).filter(([k]) => k !== d.statut && k !== 'annulee');
  return `<details class="menu-ligne menu-statut">
    <summary title="Changer le statut">${badge(d)}<span class="chevron" aria-hidden="true">▾</span></summary>
    <div class="menu-ligne-liste">
      <p class="menu-titre">Changer le statut</p>
      ${options.map(([k, v]) => `<button data-statut-doc="${esc(d.id)}" data-valeur="${k}"><span class="badge badge-${k}">${esc(v)}</span></button>`).join('')}
    </div>
  </details>`;
}

function documentsTable(docs) {
  if (!docs.length) {
    return `<p class="empty">Aucun document pour l'instant. Créez votre premier devis !</p>`;
  }
  return `
    <div class="table-wrap"><table class="docs-table">
      <thead><tr><th>Numéro</th><th>Client</th><th>Date</th><th>Statut</th><th class="num">Total TTC</th><th class="num">Actions</th></tr></thead>
      <tbody>
        ${docs.map((d) => `
          <tr data-ouvrir="${esc(d.id)}">
            <td class="dt-num"><span class="dt-type dt-type-${d.type}">${libelleType(d)}</span><a href="#/voir/${esc(d.id)}">${esc(d.numero)}</a></td>
            <td class="dt-client">${esc(clientName(d))}${suiviEnvoi(d)}</td>
            <td class="dt-date">${dateFr(d.date)}</td>
            <td class="dt-statut">${statutCliquable(d)}</td>
            <td class="num dt-total">${d.type === 'avoir' ? '−' : ''}${euro(computeTotals(d).ttc)}</td>
            <td class="dt-actions"><div class="row-actions">
              ${actionsRapides(d)}
              <details class="menu-ligne">
                <summary class="btn btn-sm" aria-label="Plus d'actions" title="Plus d'actions">⋯</summary>
                <div class="menu-ligne-liste">
                  <button data-envoyer="${esc(d.id)}">Envoyer par e-mail</button>
                  <button data-pdf="${esc(d.id)}">Télécharger le PDF</button>
                  <a href="#/modifier/${esc(d.id)}">Modifier</a>
                  ${d.type === 'facture' && d.statut !== 'annulee' ? `<button data-avoir="${esc(d.id)}">Faire un avoir</button>` : ''}
                  ${d.type !== 'avoir' ? `<button data-duplicate="${esc(d.id)}">Dupliquer</button>` : ''}
                  <button class="danger" data-delete="${esc(d.id)}">Supprimer</button>
                </div>
              </details>
            </div></td>
          </tr>`).join('')}
      </tbody>
    </table></div>
    <p class="hint legende-numeros">Comment lire les numéros : <strong>D-2026-001</strong> = devis n° 1 de 2026,
      <strong>F-2026-001</strong> = facture n° 1 de 2026, <strong>A-2026-001</strong> = avoir n° 1 de 2026. Chaque type a sa propre suite de numéros,
      qui se suivent sans trou comme l'exige la loi. Une facture créée depuis un devis prend le numéro de facture suivant.</p>`;
}

// Petit message en bas de l'écran, avec un bouton « Annuler » pour revenir en arrière.
function toast(message, annuler) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast no-print';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(message)}</span>${annuler ? '<button type="button">Annuler</button>' : ''}`;
  el.querySelector('button')?.addEventListener('click', () => {
    el.remove();
    annuler();
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

// Change le statut d'un document depuis la liste, avec possibilité d'annuler.
function changerStatut(doc, statut) {
  if (!doc) return;
  const avant = { statut: doc.statut, datePaiement: doc.datePaiement };
  doc.statut = statut;
  if (statut === 'payee' || statut === 'rembourse') doc.datePaiement = doc.datePaiement || today();
  if (statut === 'a-payer' || statut === 'a-rembourser') delete doc.datePaiement;
  saveData();
  render();
  const libelle = { payee: 'marquée payée', 'a-payer': 'remise à payer', accepte: 'marqué accepté', refuse: 'marqué refusé', envoye: 'marqué envoyé', brouillon: 'remis en brouillon',
    rembourse: 'marqué remboursé', 'a-rembourser': 'remis à rembourser', deduit: 'marqué déduit' }[statut];
  toast(`${libelleType(doc)} ${doc.numero} ${libelle}`, () => {
    doc.statut = avant.statut;
    if (avant.datePaiement) doc.datePaiement = avant.datePaiement;
    else delete doc.datePaiement;
    saveData();
    render();
  });
}

function pageDocuments(filtre) {
  const type = { factures: 'facture', devis: 'devis', avoirs: 'avoir' }[filtre] || null;
  const docs = data.documents
    .filter((d) => !type || d.type === type)
    .sort((a, b) => b.creeLe - a.creeLe);

  view.innerHTML = `
    <div class="page-head">
      <h1>Devis &amp; factures</h1>
      <div class="actions">
        <button class="btn btn-primary" data-new="devis">+ Nouveau devis</button>
        <button class="btn" data-new="facture">+ Nouvelle facture</button>
        <a class="btn" href="#/export">Export comptable</a>
      </div>
    </div>
    <div class="actions" style="margin-bottom:12px">
      <a class="btn btn-sm ${!type ? 'btn-primary' : ''}" href="#/documents">Tous</a>
      <a class="btn btn-sm ${type === 'devis' ? 'btn-primary' : ''}" href="#/documents/devis">Devis</a>
      <a class="btn btn-sm ${type === 'facture' ? 'btn-primary' : ''}" href="#/documents/factures">Factures</a>
      ${data.documents.some((d) => d.type === 'avoir') ? `<a class="btn btn-sm ${type === 'avoir' ? 'btn-primary' : ''}" href="#/documents/avoirs">Avoirs</a>` : ''}
    </div>
    <div class="card">${documentsTable(docs)}</div>
  `;
}

let creationEnCours = false;
async function createDocument(type) {
  if (creationEnCours) return; // double clic : un seul document
  creationEnCours = true;
  setTimeout(() => { creationEnCours = false; }, 800);
  if (!peutCreer()) return;
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
  documentNeuf = { id: doc.id, copie: JSON.stringify(doc) };
  go('#/modifier/' + doc.id);
}

// Document tout juste créé (bouton « + Nouveau ») puis abandonné sans aucune
// modification : on le retire, s'il est le dernier de sa série, pour ne pas laisser
// une facture à 0 € ni un trou. Un document existant n'est jamais concerné.
let documentNeuf = null; // { id, copie } : le document créé et son contenu de départ
function retirerSiVide() {
  const doc = documentNeuf && getDocument(documentNeuf.id);
  // Toujours sur ce document, ou parti ajouter un client pour lui : on attend.
  if (!doc || location.hash.includes(doc.id)) return;
  const intact = JSON.stringify(doc) === documentNeuf.copie;
  documentNeuf = null;
  const dernier = nextNumber(doc.type) === incrementNumber(doc.numero);
  if (intact && dernier) {
    data.documents = data.documents.filter((d) => d.id !== doc.id);
    saveData();
  }
}
window.addEventListener('hashchange', retirerSiVide);

function pageEdit(id) {
  const doc = getDocument(id);
  if (!doc) return pageNotFound();
  const franchise = data.entreprise.franchiseTva;
  const isFacture = doc.type === 'facture';
  const isAvoir = doc.type === 'avoir';
  const isDevis = doc.type === 'devis';
  const champPaye = isAvoir ? 'rembourse' : 'payee';

  view.innerHTML = `
    ${backLink()}
    <div class="page-head">
      <h1>${libelleType(doc)} ${esc(doc.numero)}</h1>
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
            <a class="lien-action" href="#/clients/nouveau?retour=${esc(doc.id)}">+ Ajouter un client</a>
          </div>
          <div>
            <label for="objet">Objet</label>
            <input id="objet" name="objet" value="${esc(doc.objet)}" placeholder="Ex : Rénovation salle de bain">
          </div>
          <div>
            <label for="date">Date</label>
            <input id="date" name="date" type="date" min="2000-01-01" max="2099-12-31" value="${esc(doc.date)}">
          </div>
          ${isAvoir ? '' : `<div>
            <label for="echeance">${isFacture ? "Date d'échéance" : "Valable jusqu'au"}</label>
            <input id="echeance" name="echeance" type="date" min="2000-01-01" max="2099-12-31" value="${esc(doc.echeance)}">
          </div>`}
          <div>
            <label for="statut">Statut</label>
            <select id="statut" name="statut">
              ${Object.entries(STATUTS[doc.type]).filter(([k]) => k !== 'annulee' || doc.statut === 'annulee').map(([k, v]) => `<option value="${k}" ${k === doc.statut ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
          ${isFacture || isAvoir ? `<div id="field-paiement" ${doc.statut === champPaye ? '' : 'hidden'}>
            <label for="datePaiement">${isAvoir ? 'Remboursé le' : 'Payée le'}</label>
            <input id="datePaiement" name="datePaiement" type="date" min="2000-01-01" max="2099-12-31" value="${esc(doc.datePaiement || '')}">
          </div>` : ''}
          ${isDevis ? `<div>
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
            <th class="num">Total HT</th><th></th><th></th>
          </tr></thead>
          <tbody id="lines"></tbody>
        </table></div>
        <div class="actions" style="margin-top:10px">
          <button type="button" class="btn btn-sm" id="add-line">+ Ajouter une ligne</button>
          <button type="button" class="btn btn-sm" id="add-from-catalogue">+ Depuis le catalogue</button>
        </div>
        <p class="hint">Astuce : tapez quelques lettres dans la description pour retrouver une prestation de votre catalogue, ou touchez ☆ pour y enregistrer une ligne.</p>
        <div class="totals" id="totals" style="margin-top:16px"></div>
      </div>

      <div class="card" id="motif-tva0" hidden>
        <label for="motifTva0">Pourquoi la TVA est à 0 % ?</label>
        <select id="motifTva0" name="motifTva0">
          <option value="" ${!doc.motifTva0 ? 'selected' : ''}>— Choisir le motif —</option>
          <option value="autoliquidation" ${doc.motifTva0 === 'autoliquidation' ? 'selected' : ''}>Sous-traitance dans le bâtiment (autoliquidation)</option>
          <option value="autre" ${doc.motifTva0 === 'autre' ? 'selected' : ''}>Autre motif (je l'écris moi-même)</option>
        </select>
        <div id="mention-tva0-champ" hidden style="margin-top:8px">
          <label for="mentionTva0">Mention à afficher sur le document</label>
          <input id="mentionTva0" name="mentionTva0" value="${esc(doc.mentionTva0 || '')}" placeholder="Ex : Exonération de TVA, article … du CGI">
        </div>
        <p class="hint warn" id="motif-tva0-alerte">La loi impose d'indiquer sur la facture pourquoi aucune TVA n'est facturée.</p>
      </div>

      <div class="card">
        <label for="notes">Notes (conditions, délais, acompte...)</label>
        <textarea id="notes" name="notes" rows="3">${esc(doc.notes)}</textarea>
      </div>
    </form>

    <div class="actions">
      <a class="btn btn-primary" href="#/voir/${esc(doc.id)}">Terminer</a>
      ${isDevis ? `<button class="btn" id="to-invoice">Transformer en facture</button>` : ''}
      ${isAvoir ? '' : '<button class="btn" id="duplicate">Dupliquer</button>'}
      <button class="btn btn-danger" id="delete">Supprimer</button>
    </div>
  `;

  const form = document.getElementById('doc-form');
  const linesEl = document.getElementById('lines');

  function renderLines() {
    linesEl.innerHTML = doc.lignes.map((l, i) => `
      <tr data-i="${i}">
        <td class="l-desc"><input data-field="description" value="${esc(l.description)}" placeholder="Ex : Pose d'un lavabo"></td>
        <td data-label="Qté"><input data-field="quantite" type="text" inputmode="decimal" autocomplete="off" value="${esc(saisieNombre(l.quantite))}"></td>
        <td data-label="Unité"><select data-field="unite">
          ${['u', 'h', 'jour', 'm²', 'm', 'ml', 'forfait', 'kg', 'lot'].map((u) => `<option ${u === l.unite ? 'selected' : ''}>${u}</option>`).join('')}
        </select></td>
        <td data-label="Prix unit. HT"><input data-field="prixUnitaire" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(saisieNombre(l.prixUnitaire))}"></td>
        ${franchise ? '' : `<td data-label="TVA %"><select data-field="tva">
          ${tauxProposes(l.tva).map((t) => `<option value="${t}" ${Number(l.tva) === t ? 'selected' : ''}>${tauxFr(t)}</option>`).join('')}
        </select></td>`}
        <td class="num line-total" data-label="Total HT">${euro(montantLigne(l))}</td>
        <td class="l-act">${etoileLigne(l, i)}</td>
        <td class="l-act"><button type="button" class="btn btn-sm btn-danger" data-remove="${i}" title="Supprimer la ligne">✕</button></td>
      </tr>`).join('');
    renderTotals();
  }

  // Taux activés dans « Mon entreprise », 0 % (toujours possible) et celui déjà choisi sur la ligne.
  function tauxProposes(actuel) {
    const liste = (data.entreprise.tauxActifs || []).map(Number);
    for (const t of [0, Number(actuel)]) if (!liste.includes(t)) liste.push(t);
    return liste.sort((a, b) => b - a);
  }

  function renderTotals() {
    const t = computeTotals(doc);
    document.getElementById('totals').innerHTML = totalsHtml(t, doc);
    majMotifTva0();
  }

  // Une ligne à 0 % de TVA doit être justifiée par une mention sur le document.
  function majMotifTva0() {
    const bloc = document.getElementById('motif-tva0');
    if (!bloc) return;
    bloc.hidden = franchise || !doc.lignes.some((l) => Number(l.tva) === 0);
    document.getElementById('mention-tva0-champ').hidden = doc.motifTva0 !== 'autre';
    document.getElementById('motif-tva0-alerte').hidden = Boolean(doc.motifTva0);
  }

  linesEl.addEventListener('input', (e) => {
    const row = e.target.closest('tr');
    const field = e.target.dataset.field;
    if (!row || !field) return;
    const line = doc.lignes[row.dataset.i];
    line[field] = ['quantite', 'prixUnitaire', 'tva'].includes(field) ? lireNombre(e.target.value) : e.target.value;
    row.querySelector('.line-total').textContent = euro(montantLigne(line));
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

  // Date du document vidée : elle reprend la date du jour (un devis ou une facture doit être daté).
  form.date?.addEventListener('change', (e) => {
    if (!e.target.value) {
      e.target.value = doc.date = today();
      saveData();
    }
  });

  form.addEventListener('input', (e) => {
    if (e.target.closest('#lines')) return;
    if (e.target.name) {
      if (e.target.name === 'date' && !e.target.value) return;
      // Un autre client est choisi : la copie de l'ancien client n'est plus utile.
      if (e.target.name === 'clientId' && e.target.value !== doc.clientId) delete doc.clientArchive;
      doc[e.target.name] = e.target.value;
      if (e.target.name === 'acompte' || e.target.name === 'motifTva0') renderTotals();
      if (e.target.name === 'statut') {
        // La date de paiement sert au calcul du chiffre d'affaires encaissé.
        if (e.target.value === champPaye && !doc.datePaiement) doc.datePaiement = today();
        const champ = document.getElementById('field-paiement');
        if (champ) {
          champ.hidden = e.target.value !== champPaye;
          document.getElementById('datePaiement').value = doc.datePaiement || '';
        }
      }
      saveData();
    }
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  document.getElementById('to-invoice')?.addEventListener('click', () => convertToInvoice(doc));
  document.getElementById('duplicate')?.addEventListener('click', () => duplicateDocument(doc));
  document.getElementById('delete').addEventListener('click', async () => {
    if (await deleteDocument(doc)) go('#/documents');
  });

  brancherCatalogue(linesEl, doc, renderLines);
  renderLines();
}

function totalsHtml(t, doc) {
  const acompte = doc && doc.type === 'devis' ? Number(doc.acompte) || 0 : 0;
  const ligneAcompte = acompte > 0
    ? `<div class="acompte"><span>Acompte à la commande (${tauxFr(acompte)} %)</span><span>${euro((t.ttc * acompte) / 100)}</span></div>`
    : '';
  const avoir = doc?.type === 'avoir';
  if (data.entreprise.franchiseTva) {
    return `<div class="grand"><span>${avoir ? "Montant de l'avoir" : 'Total'}</span><span>${euro(t.ht)}</span></div>${ligneAcompte}`;
  }
  return `
    <div><span>Total HT</span><span>${euro(t.ht)}</span></div>
    ${Object.entries(t.tvaParTaux).filter(([, v]) => v).map(([taux, v]) =>
      `<div><span>TVA ${tauxFr(taux)} %</span><span>${euro(v)}</span></div>`).join('')}
    <div class="grand"><span>${avoir ? "Montant de l'avoir TTC" : 'Total TTC'}</span><span>${euro(t.ttc)}</span></div>
    ${ligneAcompte}`;
}

// Champs qui décrivent la vie d'un document (signature, envois, paiement) :
// ils ne doivent jamais passer sur une copie ni sur la facture créée depuis un devis.
function sansHistorique(doc) {
  const copie = structuredClone(doc);
  for (const champ of ['signature', 'envois', 'datePaiement', 'devisOrigine', 'factureOrigine', 'numeroFactureOrigine', 'dateFactureOrigine']) delete copie[champ];
  return copie;
}

// Crée une copie du document avec un nouveau numéro, puis l'ouvre.
async function duplicateDocument(doc) {
  if (!doc || doc.type === 'avoir') return;
  if (!peutCreer()) return;
  const copie = {
    ...sansHistorique(doc),
    id: newId(),
    numero: nextNumber(doc.type),
    date: today(),
    echeance: echeanceDefaut(doc.type),
    statut: doc.type === 'facture' ? 'a-payer' : 'brouillon',
    creeLe: Date.now(),
  };
  data.documents.push(copie);
  saveData();
  go('#/modifier/' + copie.id);
}

// Avoir sur une facture : total (annule la facture) ou partiel (montants à ajuster).
async function faireAvoir(facture) {
  if (!facture || facture.type !== 'facture' || facture.statut === 'annulee') return;
  if (!peutCreer()) return;
  const paye = facture.statut === 'payee';
  const choix = await choisir(`Faire un avoir sur la facture ${facture.numero} ?`, [
    ['total', 'Avoir total', paye ? 'Toute la facture est remboursée au client.' : 'La facture est annulée en entier.'],
    ['partiel', 'Avoir partiel', 'Une partie seulement : vous ajustez les lignes et les montants.'],
  ], "Une facture envoyée ne se supprime pas : l'avoir l'annule ou la corrige, avec son propre numéro.");
  if (!choix) return;
  const avoir = {
    id: newId(),
    type: 'avoir',
    numero: nextNumber('avoir'),
    clientId: facture.clientId,
    ...(facture.clientArchive ? { clientArchive: structuredClone(facture.clientArchive) } : {}),
    date: today(),
    echeance: today(),
    objet: `Avoir sur la facture ${facture.numero}${facture.objet ? ' – ' + facture.objet : ''}`,
    lignes: structuredClone(facture.lignes),
    motifTva0: facture.motifTva0 || '',
    mentionTva0: facture.mentionTva0 || '',
    notes: '',
    // Facture déjà payée : l'avoir est à rembourser. Sinon il vient en déduction.
    statut: paye ? 'a-rembourser' : 'deduit',
    factureOrigine: facture.id,
    numeroFactureOrigine: facture.numero,
    dateFactureOrigine: facture.date,
    avoirTotal: choix === 'total',
    creeLe: Date.now(),
  };
  data.documents.push(avoir);
  if (choix === 'total' && !paye) facture.statut = 'annulee';
  saveData();
  if (choix === 'total') {
    go('#/voir/' + avoir.id);
    toast(paye ? `Avoir ${avoir.numero} créé : pensez à rembourser le client` : `Avoir ${avoir.numero} créé, facture ${facture.numero} annulée`);
  } else {
    go('#/modifier/' + avoir.id);
    toast(`Avoir ${avoir.numero} créé : gardez seulement les lignes et les montants à ${paye ? 'rembourser' : 'déduire'}`);
  }
}

// Supprime un document après confirmation. Renvoie true si supprimé.
async function deleteDocument(doc) {
  if (doc.type === 'facture' && avoirsDe(doc).length) {
    await ask(`La facture ${doc.numero} a un avoir (${avoirsDe(doc).map((a) => a.numero).join(', ')}) : elle ne peut plus être supprimée.`, "D'accord", false);
    return false;
  }
  if (doc.type === 'avoir') {
    const derniere = nextNumber('avoir') === incrementNumber(doc.numero);
    if (!derniere) {
      await ask(`Pour respecter la numérotation (sans trou), seul le dernier avoir peut être supprimé.`, "D'accord", false);
      return false;
    }
    if (!(await ask(`Supprimer l'avoir ${doc.numero} ? Ne le supprimez que s'il n'a pas encore été envoyé au client.`, 'Supprimer'))) return false;
    // La facture annulée par cet avoir redevient à payer.
    const f = getDocument(doc.factureOrigine);
    if (f && f.statut === 'annulee' && avoirsDe(f).length === 1) f.statut = 'a-payer';
    data.documents = data.documents.filter((d) => d.id !== doc.id);
    saveData();
    return true;
  }
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

// Crée la facture d'un devis. ouvrir=false : reste sur la page (actions rapides de la liste).
async function convertToInvoice(devis, ouvrir = true) {
  if (!peutCreer()) return null;
  const deja = data.documents.find((d) => d.devisOrigine === devis.id);
  if (deja) {
    if (await ask(`Ce devis a déjà été transformé en facture (${deja.numero}). L'ouvrir ?`, 'Ouvrir la facture')) {
      go('#/voir/' + deja.id);
    }
    return;
  }
  const facture = {
    ...sansHistorique(devis),
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
  if (ouvrir) go('#/voir/' + facture.id);
  return facture;
}

// Devis payé sur place : la facture est créée et marquée payée d'un coup.
async function devisPaye(devis) {
  const statutAvant = devis.statut;
  const facture = await convertToInvoice(devis, false);
  if (!facture) return;
  facture.statut = 'payee';
  facture.datePaiement = today();
  saveData();
  render();
  toast(`Facture ${facture.numero} créée et marquée payée`, () => {
    data.documents = data.documents.filter((d) => d.id !== facture.id);
    devis.statut = statutAvant;
    saveData();
    render();
  });
}

// Tout ce qui figure sur un devis ou une facture (écran et PDF).
function infosDocument(doc) {
  const e = data.entreprise;
  const client = docClient(doc) || {};
  const isFacture = doc.type === 'facture';
  const isAvoir = doc.type === 'avoir';
  const isDevis = doc.type === 'devis';
  const t = computeTotals(doc);
  const origine = doc.devisOrigine ? getDocument(doc.devisOrigine) : null;
  const factureOrigine = isAvoir && doc.factureOrigine ? getDocument(doc.factureOrigine) : null;

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
  } else if (isAvoir) {
    const f = factureOrigine || { numero: doc.numeroFactureOrigine, date: doc.dateFactureOrigine };
    if (f.numero) mentions.push(`Avoir sur la facture n° ${f.numero}${f.date ? ` du ${dateFr(f.date)}` : ''}.`);
    if (doc.statut === 'rembourse') mentions.push(`Montant remboursé${doc.datePaiement ? ` le ${dateFr(doc.datePaiement)}` : ''}.`);
    else if (doc.statut === 'deduit') mentions.push('Montant déduit de la somme due au titre de la facture.');
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
  if (!e.franchiseTva && doc.lignes.some((l) => Number(l.tva) === 0)) {
    if (doc.motifTva0 === 'autoliquidation') mentions.push('Autoliquidation : TVA due par le preneur (article 283-2 nonies du CGI).');
    else if (doc.motifTva0 === 'autre' && doc.mentionTva0) mentions.push(doc.mentionTva0);
  }
  if (e.mentions) mentions.push(e.mentions);

  // « EI » obligatoire à côté du nom pour les entrepreneurs individuels.
  const nomAffiche = (e.nom || 'Nom de votre entreprise') + (isIndividuel(e) && e.nom && !/\bEI\b/.test(e.nom) ? ' EI' : '');
  const formeAffichee = !isIndividuel(e) && e.formeJuridique !== 'autre'
    ? FORMES[e.formeJuridique] + (e.capital ? ` au capital de ${new Intl.NumberFormat('fr-FR').format(Number(String(e.capital).replace(/\s/g, '').replace(',', '.')) || 0)} €` : '')
    : '';
  return { e, client, isFacture, isAvoir, isDevis, t, origine, factureOrigine, clientPro, mentions, nomAffiche, formeAffichee };
}

function pageView(id) {
  const doc = getDocument(id);
  if (!doc) return pageNotFound();
  const { e, client, isFacture, isAvoir, isDevis, t, origine, factureOrigine, mentions, nomAffiche, formeAffichee } = infosDocument(doc);
  const avoirs = isFacture ? avoirsDe(doc) : [];

  view.innerHTML = `
    ${backLink()}
    <div class="page-head no-print">
      <h1>${libelleType(doc)} ${esc(doc.numero)} ${badge(doc)}</h1>
      <div class="actions">
        <button class="btn btn-primary" data-pdf="${esc(doc.id)}">Télécharger le PDF</button>
        <button class="btn" data-envoyer="${esc(doc.id)}">Envoyer par e‑mail</button>
        ${isDevis ? `<button class="btn" id="to-invoice">Transformer en facture</button>` : ''}
        ${isFacture && doc.statut === 'a-payer' ? `<button class="btn" id="mark-paid">Marquer comme payée</button>` : ''}
        ${isAvoir && doc.statut === 'a-rembourser' ? `<button class="btn" data-statut-doc="${esc(doc.id)}" data-valeur="rembourse">Marquer remboursé</button>` : ''}
        ${Envoi.aRelancer(doc) ? `<button class="btn" data-relancer="${esc(doc.id)}">Relancer</button>` : ''}
        <a class="btn" href="#/modifier/${esc(doc.id)}">Modifier</a>
        <details class="menu-ligne menu-actions">
          <summary class="btn">Plus d'actions <span class="chevron" aria-hidden="true">▾</span></summary>
          <div class="menu-ligne-liste">
            <button type="button" id="imprimer">Imprimer</button>
            ${isFacture && doc.statut !== 'annulee' ? `<button type="button" data-avoir="${esc(doc.id)}">Faire un avoir</button>` : ''}
            ${isAvoir ? '' : '<button type="button" id="duplicate">Dupliquer</button>'}
            <button type="button" class="danger" id="delete">Supprimer</button>
          </div>
        </details>
      </div>
    </div>
    ${profilManquant().length ? `<div class="doc-incomplet no-print" role="status">
      <p><strong>Ce document n'est pas encore prêt à être envoyé.</strong> Il manque des informations sur votre entreprise, obligatoires sur un devis ou une facture.</p>
      <button type="button" class="btn btn-primary btn-sm" id="completer-profil">Compléter (1 minute)</button>
    </div>` : ''}
    ${avoirs.length ? `<p class="historique no-print">${avoirs.map((a) => `Avoir <a href="#/voir/${esc(a.id)}">${esc(a.numero)}</a> de ${euro(computeTotals(a).ttc)} TTC (${esc(STATUTS.avoir[a.statut] || a.statut)})`).join(' · ')}</p>` : ''}
    ${isAvoir && factureOrigine ? `<p class="historique no-print">Avoir sur la facture <a href="#/voir/${esc(factureOrigine.id)}">${esc(factureOrigine.numero)}</a> du ${dateFr(factureOrigine.date)}</p>` : ''}
    ${(doc.envois || []).length || doc.signature ? `<ul class="historique no-print">
      ${(doc.envois || []).map((x) => `<li>${x.type === 'relance' ? '🔔 Relance envoyée' : '✉ Envoyé'} à ${esc(x.a)} le ${esc(new Date(x.le).toLocaleString('fr-FR'))}${x.lien ? ' · avec lien de signature' : ''}</li>`).join('')}
      ${doc.signature ? `<li>✍ Signé en ligne par <strong>${esc(doc.signature.nom)}</strong> le ${esc(new Date(doc.signature.le).toLocaleString('fr-FR'))}</li>` : ''}
    </ul>` : ''}

    <div class="doc" dir="ltr" lang="fr">
      <div class="doc-head">
        <div>
          ${e.logo && Abonnement.aAcces('pro') ? `<img class="doc-logo" src="${esc(e.logo)}" alt="">` : ''}
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
        <div class="doc-meta">
          <p class="doc-title">${libelleType(doc).toUpperCase()}</p>
          <div>N° ${esc(doc.numero)}</div>
          <div>Date : ${dateFr(doc.date)}</div>
          ${origine ? `<div><small>Réf. devis ${esc(origine.numero)}</small></div>` : ''}
          ${isAvoir && (factureOrigine || doc.numeroFactureOrigine) ? `<div><small>Réf. facture ${esc(factureOrigine?.numero || doc.numeroFactureOrigine)}</small></div>` : ''}
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

      <div class="table-wrap"><table class="liste-fiches">
        <thead><tr>
          <th>Description</th><th class="num">Qté</th><th class="num">Prix unit. HT</th>
          ${e.franchiseTva ? '' : '<th class="num">TVA</th>'}
          <th class="num">Total HT</th>
        </tr></thead>
        <tbody>
          ${doc.lignes.map((l) => `
            <tr>
              <td>${esc(l.description)}</td>
              <td class="num" data-label="Qté">${esc(String(l.quantite).replace('.', ','))} ${esc(l.unite)}</td>
              <td class="num" data-label="Prix unit. HT">${euro(l.prixUnitaire)}</td>
              ${e.franchiseTva ? '' : `<td class="num" data-label="TVA">${esc(String(l.tva).replace('.', ','))} %</td>`}
              <td class="num fiche-total" data-label="Total HT">${euro(montantLigne(l))}</td>
            </tr>`).join('')}
        </tbody>
      </table></div>

      <div class="totals" style="margin-top:16px">${totalsHtml(t, doc)}</div>

      ${doc.notes ? `<p style="margin-top:24px;white-space:pre-line">${esc(doc.notes)}</p>` : ''}

      ${isDevis ? (doc.signature
        ? `<div class="signature signature-faite">Bon pour accord : signé en ligne par <strong>${esc(doc.signature.nom)}</strong> le ${esc(new Date(doc.signature.le).toLocaleString('fr-FR'))}
            ${doc.signature.image ? `<img src="${esc(doc.signature.image)}" alt="Signature de ${esc(doc.signature.nom)}">` : ''}</div>`
        : `<div class="signature">Bon pour accord : date et signature du client</div>`) : ''}

      <div class="doc-mentions">${mentions.map(esc).join('\n')}</div>
    </div>
  `;

  document.getElementById('to-invoice')?.addEventListener('click', () => convertToInvoice(doc));
  document.getElementById('mark-paid')?.addEventListener('click', () => {
    doc.statut = 'payee';
    doc.datePaiement = today();
    saveData();
    render();
  });
  document.getElementById('duplicate')?.addEventListener('click', () => duplicateDocument(doc));
  document.getElementById('imprimer')?.addEventListener('click', async () => { if (await profilPret()) window.print(); });
  document.getElementById('completer-profil')?.addEventListener('click', () => Bienvenue.ouvrir(location.hash));
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
        <div class="table-wrap"><table class="liste-fiches">
          <thead><tr><th>Nom</th><th>Téléphone</th><th>Email</th><th></th></tr></thead>
          <tbody>
            ${data.clients.map((c) => `
              <tr>
                <td><strong>${esc(c.nom)}</strong><br><small>${esc(c.adresse).replace(/\n/g, ', ')}</small></td>
                <td class="nowrap">${esc(c.telephone)}</td>
                <td>${esc(c.email)}</td>
                <td class="fiche-actions"><div class="row-actions">
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

  let enCours = false;
  document.getElementById('client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enCours) return; // double clic : un seul client
    const values = Object.fromEntries(new FormData(e.target));
    values.siret = (values.siret || '').replace(/\s/g, '');
    if (values.siret && !checkSiret(values.siret)) {
      await ask("Le SIRET de ce client semble incorrect : vérifiez les 14 chiffres (ou laissez le champ vide pour un particulier).", "D'accord", false);
      return;
    }
    enCours = true;
    if (!peutCreer()) { enCours = false; return; }
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
    <p class="intro">Ces informations apparaissent sur vos devis et factures. Seuls les champs marqués * sont obligatoires ; le reste se règle quand vous voulez.</p>
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
            <span class="label">Logo (affiché en haut des devis et factures)</span>
            <div class="actions">
              <label class="btn btn-sm" for="logo-input" id="logo-choisir">${logo ? 'Changer le logo' : 'Choisir un logo'}</label>
              <input id="logo-input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden>
              <button type="button" class="btn btn-sm btn-danger" id="logo-remove" ${logo ? '' : 'hidden'}>Retirer le logo</button>
            </div>
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

      <details class="card partie-option">
        <summary><span class="partie-titre">Paiement</span><small>IBAN, délai et moyens de paiement, pénalités de retard</small></summary>
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
      </details>

      <details class="card partie-option">
        <summary><span class="partie-titre">Devis</span><small>Durée de validité, acompte, conditions par défaut</small></summary>
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
      </details>

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

      <details class="card partie-option">
        <summary><span class="partie-titre">Fiscalité</span><small>Régime et taux utilisés pour les estimations du tableau de bord</small></summary>
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
      </details>

      <details class="card partie-option">
        <summary><span class="partie-titre">Numérotation</span><small>Préfixes des numéros de devis et de factures</small></summary>
        <div class="grid-2">
          <div><label for="prefixeDevis">Préfixe des devis</label><input id="prefixeDevis" name="prefixeDevis" maxlength="6" value="${esc(e.prefixeDevis)}"></div>
          <div><label for="prefixeFacture">Préfixe des factures</label><input id="prefixeFacture" name="prefixeFacture" maxlength="6" value="${esc(e.prefixeFacture)}"></div>
        </div>
        <small class="hint" id="hint-numeros"></small>
      </details>

      <details class="card partie-option">
        <summary><span class="partie-titre">Sauvegarde de vos données</span><small>Télécharger ou restaurer une sauvegarde</small></summary>
        <p class="hint">Vos devis, factures et clients sont enregistrés sur cet appareil. Téléchargez régulièrement une sauvegarde pour ne rien perdre, ou pour passer sur un autre appareil.</p>
        <div class="actions">
          <button type="button" class="btn" id="export">Télécharger une sauvegarde</button>
          <label class="btn" for="import-input">Restaurer une sauvegarde</label>
          <input id="import-input" type="file" accept="application/json,.json" hidden>
        </div>
      </details>

      <div class="save-bar" id="save-bar">
        <span id="saved" class="hint" role="status"></span>
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
    const el = $(manque[0].champ === 'logo' ? 'logo-choisir' : manque[0].champ);
    if (!el) return;
    const partie = el.closest('details');
    if (partie) partie.open = true; // champ dans une partie repliée
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
      refresh(); // met à jour la liste de ce qui manque, sans marquer « non enregistré »
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
      ? `<div class="checklist-head"><strong>Encore ${manque.length} information${manque.length > 1 ? 's' : ''} obligatoire${manque.length > 1 ? 's' : ''} pour pouvoir envoyer vos documents</strong>
           <div class="progress"><span style="width:${Math.round(((total - manque.length) / total) * 100)}%"></span></div></div>
         <ul class="todo">${manque.map((m) => `<li><button type="button" class="link" data-champ="${esc(m.champ)}">${esc(m.texte)}</button></li>`).join('')}</ul>`
      : `<strong>✓ Toutes les mentions obligatoires sont renseignées.</strong> Vos devis et factures sont prêts à être envoyés.`;
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
    $('save-bar').classList.add('modifie'); // la barre ne flotte en bas que s'il y a quelque chose à enregistrer
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
        $('logo-choisir').textContent = 'Changer le logo';
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
    $('logo-choisir').textContent = 'Choisir un logo';
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
    $('save-bar').classList.remove('modifie');
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
  if (champ && $(champ === 'logo' ? 'logo-choisir' : champ)) {
    // Ouvre la partie TVA si c'est elle qui manque.
    if (champ === 'numeroTva') $('tva-options').hidden = false;
    setTimeout(() => champSuivant([{ champ }]), 50);
  }
}

function majPastille() {
  const nb = profilManquant().length;
  const lien = document.querySelector('.nav a[href="#/parametres"]');
  if (lien) {
    let pastille = lien.querySelector('.pill');
    if (nb && !pastille) {
      pastille = document.createElement('span');
      pastille.className = 'pill';
      lien.appendChild(pastille);
    }
    if (pastille) {
      if (nb) pastille.textContent = nb;
      else pastille.remove();
    }
  }
  document.getElementById('burger')?.classList.toggle('alerte', nb > 0);
  const navParrain = document.getElementById('nav-parrainage');
  if (navParrain) navParrain.hidden = !(typeof Compte !== 'undefined' && Compte.actif && Compte.connecte());
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
  return `<a class="back no-print" href="${esc(lastList.hash)}"><span aria-hidden="true">←</span> Retour à ${esc(lastList.label)}</a>`;
}

const LISTES = {
  '': 'Tableau de bord',
  documents: 'Devis & factures',
  clients: 'Clients',
  depenses: 'Dépenses',
  catalogue: 'Catalogue',
};

function render() {
  // Avec les comptes en ligne, rien ne s'affiche tant qu'on n'est pas connecté.
  if (Compte.actif && !Compte.connecte()) return;
  Abonnement.majBandeau();
  const [path, query] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);

  document.querySelectorAll('.nav a, .tabbar a').forEach((a) => {
    const target = a.getAttribute('href').slice(1);
    a.classList.toggle('active', target === '/' ? parts.length === 0 : path.startsWith(target));
  });

  // On mémorise les pages de liste (pas les fiches client ni les documents).
  if ((parts[0] ?? '') in LISTES && (parts[0] !== 'clients' || !parts[1])) {
    lastList = { hash: location.hash || '#/', label: LISTES[parts[0] ?? ''] };
  }

  majPastille();
  if (parts[0] !== 'assistance') window.dernierePageAssistance = location.hash || '#/';
  if (['', 'documents', 'voir'].includes(parts[0] ?? '')) Envoi.synchroniserSignatures();

  // Compte neuf : démarrage guidé en 3 écrans (une seule fois, « Plus tard » possible).
  if (parts[0] === undefined && Bienvenue.doitAfficher()) {
    history.replaceState(null, '', location.pathname + '#/bienvenue');
    parts[0] = 'bienvenue';
  }
  document.body.classList.toggle('mode-accueil', parts[0] === 'bienvenue');
  if (parts[0] === 'bienvenue') return Bienvenue.page();

  // Abonnement : lecture seule après l'essai, fonctions réservées à la formule Pro.
  if (!Abonnement.peutModifier() && (parts[0] === 'modifier' || (parts[0] === 'clients' && parts[1]))) {
    return Abonnement.pageLectureSeule();
  }
  if (!Abonnement.aAcces('pro') && (parts[0] === 'depenses' || parts[0] === 'catalogue')) {
    return Abonnement.pageUpsell(parts[0]);
  }
  if (!Abonnement.aAcces('equipe') && parts[0] === 'export') return Abonnement.pageUpsell('export');

  switch (parts[0]) {
    case undefined: return pageDashboard();
    case 'documents': return pageDocuments(parts[1]);
    case 'modifier': return pageEdit(parts[1]);
    case 'voir': return pageView(parts[1]);
    case 'clients': return parts[1] ? pageClientForm(parts[1], params.get('retour')) : pageClients();
    case 'parametres': return pageSettings(params.get('champ'));
    case 'depenses': return pageDepenses(params);
    case 'catalogue': return pageCatalogue(params);
    case 'export': return pageExport(params);
    case 'compte': return Compte.page();
    case 'abonnement': return Abonnement.page(params);
    case 'assistance': return Assistance.page();
    case 'parrainage': return Compte.actif && Compte.connecte() ? Parrainage.page() : pageNotFound();
    case 'inscription':
    case 'connexion': return go('#/');
    default: return pageNotFound();
  }
}

document.addEventListener('click', async (e) => {
  if (!(e.target instanceof Element)) return;
  // Un clic ailleurs ferme les menus « ⋯ » ouverts.
  document.querySelectorAll('.menu-ligne[open]').forEach((m) => {
    if (!m.contains(e.target)) m.open = false;
  });
  // Un choix fait dans un menu le referme.
  e.target.closest('.menu-ligne-liste a, .menu-ligne-liste button')?.closest('.menu-ligne')?.removeAttribute('open');
  const cible = e.target.closest('[data-new], [data-duplicate], [data-delete], [data-delete-client], [data-payee], [data-statut-doc], [data-facturer], [data-devis-paye], [data-pdf], [data-envoyer], [data-relancer], [data-avoir]');
  if (!cible) {
    // Clic sur une ligne de document (hors bouton, lien ou menu) : on l'ouvre.
    const ligne = e.target.closest('tr[data-ouvrir]');
    if (ligne && !e.target.closest('a, button, details')) go('#/voir/' + ligne.dataset.ouvrir);
    return;
  }
  cible.closest('.menu-ligne')?.removeAttribute('open');
  const { new: type, duplicate, delete: del, deleteClient: delClient, payee, statutDoc, valeur, facturer, devisPaye: dejaPaye, pdf, envoyer, relancer, avoir } = cible.dataset;
  if (avoir) faireAvoir(getDocument(avoir));
  if (type) createDocument(type);
  if (duplicate) duplicateDocument(getDocument(duplicate));
  if (del && (await deleteDocument(getDocument(del)))) render();
  if (delClient && (await deleteClient(getClient(delClient)))) render();
  if (payee) changerStatut(getDocument(payee), 'payee');
  if (statutDoc) changerStatut(getDocument(statutDoc), valeur);
  if (facturer) convertToInvoice(getDocument(facturer));
  if (dejaPaye) devisPaye(getDocument(dejaPaye));
  if (envoyer) Envoi.ouvrir(getDocument(envoyer), 'envoi');
  if (relancer) Envoi.ouvrir(getDocument(relancer), 'relance');
  if (pdf && getDocument(pdf) && (await profilPret())) {
    const texte = cible.textContent;
    cible.disabled = true;
    cible.textContent = 'Création du PDF…';
    await Pdf.document(getDocument(pdf));
    cible.disabled = false;
    cible.textContent = texte;
  }
});

// Menu burger sur téléphone.
const burger = document.getElementById('burger');
const topbar = document.querySelector('.topbar');
function menuOuvert(ouvert) {
  topbar.classList.toggle('menu-open', ouvert);
  document.body.classList.toggle('menu-ouvert', ouvert);
  burger.setAttribute('aria-expanded', String(ouvert));
  burger.setAttribute('aria-label', ouvert ? 'Fermer le menu' : 'Ouvrir le menu');
}
burger?.addEventListener('click', () => menuOuvert(!topbar.classList.contains('menu-open')));
// Téléphone tourné à l'horizontale (passage au menu latéral) : le menu « Plus » se ferme.
matchMedia('(max-width: 760px)').addEventListener('change', (e) => { if (!e.matches) menuOuvert(false); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.menu-ligne[open]').forEach((m) => m.removeAttribute('open'));
  if (e.key === 'Escape') menuOuvert(false);
});
document.addEventListener('click', (e) => {
  if (topbar.classList.contains('menu-open') && !feuille?.contains(e.target) && !burger?.contains(e.target)) menuOuvert(false);
});

// Le menu « Plus » se ferme en le faisant glisser vers le bas, comme sur iPhone.
// Tant qu'il est ouvert, la page derrière ne défile pas.
const feuille = document.getElementById('menu-principal');
let glisse = null;
feuille?.addEventListener('touchstart', (e) => {
  if (!topbar.classList.contains('menu-open')) return;
  glisse = { y: e.touches[0].clientY, t: Date.now(), dy: 0, haut: feuille.scrollTop <= 0 };
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (!topbar.classList.contains('menu-open')) return;
  if (!feuille.contains(e.target)) { e.preventDefault(); return; }
  if (!glisse) return;
  const dy = e.touches[0].clientY - glisse.y;
  // On ne tire la feuille que si son contenu est déjà en haut et qu'on glisse vers le bas.
  if (!glisse.haut || dy <= 0) { glisse.dy = 0; feuille.style.removeProperty('--glisse'); return; }
  e.preventDefault();
  glisse.dy = dy;
  feuille.classList.add('glisse');
  feuille.style.setProperty('--glisse', dy + 'px');
}, { passive: false });
feuille?.addEventListener('touchend', () => {
  if (!glisse) return;
  const { dy, t } = glisse; glisse = null;
  feuille.classList.remove('glisse');
  feuille.style.removeProperty('--glisse');
  if (dy > 80 || (dy > 30 && dy / (Date.now() - t) > 0.5)) menuOuvert(false);
});

window.addEventListener('hashchange', () => {
  menuOuvert(false);
  render();
  window.scrollTo(0, 0);
});
// Mise à jour automatique : si une version plus récente du site est en ligne
// (le navigateur garde l'ancienne page en mémoire quelques minutes), on recharge.
(async () => {
  try {
    const actuelle = document.querySelector('script[src*="js/app.js"]')?.src.match(/[?&]v=(\d+)/)?.[1];
    const page = await (await fetch(location.pathname, { cache: 'no-store' })).text();
    const enLigne = page.match(/js\/app\.js\?v=(\d+)/)?.[1];
    const cle = 'devizo-maj-' + enLigne;
    if (actuelle && enLigne && Number(enLigne) > Number(actuelle) && !sessionStorage.getItem(cle)) {
      sessionStorage.setItem(cle, '1'); // une seule tentative, pour ne jamais boucler
      location.reload();
    }
  } catch (e) {
    // hors ligne : on garde la version actuelle
  }
})();

Compte.demarrer(render);
