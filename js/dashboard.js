/*
 * Tableau de bord de gestion et page Dépenses.
 * Chargé avant app.js : les fonctions ci-dessous utilisent les outils
 * d'app.js (data, esc, euro, computeTotals...) uniquement quand elles
 * sont appelées.
 */

// ====================================================================
// Paramètres fiscaux 2026 (estimations, à vérifier sur urssaf.fr)
// ====================================================================

const MICRO = {
  services: { label: 'Prestations de services artisanales ou commerciales (BIC)', cotis: 21.2, cfp: 0.3, vl: 1.7, plafond: 83600, seuilTva: 37500 },
  vente: { label: 'Vente de marchandises (BIC)', cotis: 12.3, cfp: 0.1, vl: 1, plafond: 203100, seuilTva: 85000 },
  liberal: { label: 'Activité libérale (BNC)', cotis: 25.6, cfp: 0.2, vl: 2.2, plafond: 83600, seuilTva: 37500 },
};
const IS_TAUX_REDUIT = 15;
const IS_PLAFOND_REDUIT = 42500;
const IS_TAUX_NORMAL = 25;

const CATEGORIES_DEPENSES = [
  'Matériaux et fournitures', 'Outillage et équipement', 'Carburant et péages', 'Véhicule (entretien, location)',
  'Sous-traitance', 'Assurances', 'Téléphone et internet', 'Loyer et local', 'Banque et comptabilité',
  'Publicité', 'Repas et déplacements', 'Autre',
];

function regimeFiscal(e = data.entreprise) {
  return e.regimeFiscal || (isIndividuel(e) ? 'micro' : 'is');
}

function impotSocietes(benefice) {
  const b = Math.max(0, benefice);
  return (Math.min(b, IS_PLAFOND_REDUIT) * IS_TAUX_REDUIT + Math.max(0, b - IS_PLAFOND_REDUIT) * IS_TAUX_NORMAL) / 100;
}

// ====================================================================
// Données agrégées
// ====================================================================

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function depenseHT(dep) {
  return (Number(dep.montantTTC) || 0) / (1 + (Number(dep.tva) || 0) / 100);
}

function encaissements() {
  return data.documents
    .filter((d) => d.type === 'facture' && d.statut === 'payee')
    .map((d) => {
      const t = computeTotals(d);
      return { date: d.datePaiement || d.date, ht: t.ht, tva: t.tva, ttc: t.ttc, client: clientName(d) };
    });
}

function depensesListe() {
  return (data.depenses || []).map((dep) => {
    const ht = depenseHT(dep);
    return { date: dep.date, ht, tva: (Number(dep.montantTTC) || 0) - ht, ttc: Number(dep.montantTTC) || 0 };
  });
}

// Bilan d'une période [debut, fin] (dates ISO incluses).
function bilan(debut, fin) {
  const e = data.entreprise;
  const dans = (x) => x.date >= debut && x.date <= fin;
  const enc = encaissements().filter(dans);
  const dep = depensesListe().filter(dans);
  const caHT = enc.reduce((s, x) => s + x.ht, 0);
  const tvaCollectee = enc.reduce((s, x) => s + x.tva, 0);
  const depHT = dep.reduce((s, x) => s + x.ht, 0);
  const tvaDeductible = e.franchiseTva ? 0 : dep.reduce((s, x) => s + x.tva, 0);
  const regime = regimeFiscal(e);
  let cotisations = 0;
  let impot = 0;
  let impotCompris = true;
  if (regime === 'micro') {
    const m = MICRO[e.activiteMicro] || MICRO.services;
    cotisations = (caHT * (m.cotis + m.cfp)) / 100;
    if (e.versementLiberatoire) impot = (caHT * m.vl) / 100;
    else impotCompris = false;
  } else if (regime === 'is') {
    impot = impotSocietes(caHT - depHT);
  } else {
    cotisations = (Math.max(0, caHT - depHT) * (Number(e.tauxCharges) || 45)) / 100;
    impotCompris = false;
  }
  return {
    caHT, tvaCollectee, depHT, tvaDeductible, cotisations, impot, impotCompris,
    reste: caHT - depHT - cotisations - impot,
    tvaAReverser: e.franchiseTva ? 0 : tvaCollectee - tvaDeductible,
    nbEncaissements: enc.length,
  };
}

const PERIODES = {
  mois: 'Ce mois-ci',
  trimestre: 'Ce trimestre',
  annee: 'Cette année',
  '12mois': '12 derniers mois',
};
let periodeChoisie = 'annee';

function bornesPeriode(p, ref = new Date()) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  let debut;
  let finD;
  let precDebut;
  let precFin;
  if (p === 'mois') {
    debut = new Date(y, m, 1);
    finD = new Date(y, m + 1, 0);
    precDebut = new Date(y, m - 1, 1);
    precFin = new Date(y, m, 0);
  } else if (p === 'trimestre') {
    const q = Math.floor(m / 3) * 3;
    debut = new Date(y, q, 1);
    finD = new Date(y, q + 3, 0);
    precDebut = new Date(y, q - 3, 1);
    precFin = new Date(y, q, 0);
  } else if (p === 'annee') {
    debut = new Date(y, 0, 1);
    finD = new Date(y, 11, 31);
    precDebut = new Date(y - 1, 0, 1);
    precFin = new Date(y - 1, 11, 31);
  } else {
    debut = new Date(y, m - 11, 1);
    finD = new Date(y, m + 1, 0);
    precDebut = new Date(y, m - 23, 1);
    precFin = new Date(y, m - 11, 0);
  }
  return { debut: isoDate(debut), fin: isoDate(finD), precDebut: isoDate(precDebut), precFin: isoDate(precFin) };
}

// ====================================================================
// Graphiques (SVG dessiné à la taille réelle du conteneur)
// ====================================================================

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function euroCourt(n) {
  const a = Math.abs(n);
  if (a >= 1000000) return (n / 1000000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M€';
  if (a >= 10000) return Math.round(n / 1000).toLocaleString('fr-FR') + ' k€';
  if (a >= 1000) return (n / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' k€';
  return Math.round(n).toLocaleString('fr-FR') + ' €';
}

// Maximum de l'axe : 4 graduations « rondes » (0, 500, 1 000, 1 500, 2 000…).
function niceMax(v) {
  if (v <= 0) return 100;
  const brut = v / 4;
  const p = Math.pow(10, Math.floor(Math.log10(brut)));
  for (const k of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * p >= brut) return k * p * 4;
  return 40 * p;
}

function barPath(x, y, w, h) {
  if (h <= 0) return '';
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

// Colonnes groupées : categories [{ label, tip }], series [{ name, color, values }].
function columnChart({ width, height = 220, categories, series, labelEvery = 1, highlight = -1 }) {
  const padL = 52;
  const padR = 8;
  const padT = 12;
  const padB = 26;
  const plotW = Math.max(100, width - padL - padR);
  const plotH = height - padT - padB;
  const max = niceMax(Math.max(...series.flatMap((s) => s.values), 0));
  const band = plotW / categories.length;
  const gap = 2;
  const barW = Math.max(2, Math.min(24, (band * 0.7 - gap * (series.length - 1)) / series.length));
  const groupW = barW * series.length + gap * (series.length - 1);
  const y = (v) => padT + plotH - (v / max) * plotH;
  let svg = `<svg class="chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">`;
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i;
    const yy = Math.round(y(v)) + 0.5;
    svg += `<line class="grid" x1="${padL}" x2="${width - padR}" y1="${yy}" y2="${yy}"/>`;
    svg += `<text class="tick" x="${padL - 8}" y="${yy + 4}" text-anchor="end">${euroCourt(v)}</text>`;
  }
  categories.forEach((c, i) => {
    const x0 = padL + band * i + (band - groupW) / 2;
    if (i === highlight) svg += `<rect class="today" x="${padL + band * i}" y="${padT}" width="${band}" height="${plotH}"/>`;
    series.forEach((s, j) => {
      const v = s.values[i];
      svg += `<path d="${barPath(x0 + j * (barW + gap), y(v), barW, padT + plotH - y(v))}" fill="${s.color}"/>`;
    });
    if ((i % labelEvery === 0 && Math.abs(i - highlight) >= labelEvery) || i === highlight) {
      svg += `<text class="tick${i === highlight ? ' strong' : ''}" x="${padL + band * i + band / 2}" y="${height - 8}" text-anchor="middle">${esc(c.label)}</text>`;
    }
    svg += `<rect class="hit" x="${padL + band * i}" y="${padT}" width="${band}" height="${plotH}" data-tip="${esc(c.tip)}"/>`;
  });
  return svg + '</svg>';
}

// Barres horizontales (meilleurs clients).
function barList(items, color) {
  const max = Math.max(...items.map((x) => x.value), 1);
  return `<ul class="barlist">${items.map((x) => `
    <li data-tip="${esc(x.label + ' : ' + euro(x.value) + ' HT')}">
      <span class="barlist-label">${esc(x.label)}</span>
      <span class="barlist-track"><span class="barlist-bar" style="width:${Math.max(2, (x.value / max) * 100)}%;background:${color}"></span></span>
      <span class="barlist-value">${euroCourt(x.value)}</span>
    </li>`).join('')}</ul>`;
}

function meter(valeur, plafond) {
  const pct = plafond ? (valeur / plafond) * 100 : 0;
  const niveau = pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'ok';
  return `<div class="meter meter-${niveau}"><span style="width:${Math.min(100, pct)}%"></span></div>`;
}

// Infobulle partagée par tous les graphiques.
function brancherInfobulles(root) {
  let tip = document.getElementById('chart-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'chart-tip';
    tip.hidden = true;
    document.body.appendChild(tip);
  }
  const montrer = (e) => {
    const cible = e.target.closest('[data-tip]');
    if (!cible || !root.contains(cible)) {
      tip.hidden = true;
      return;
    }
    tip.innerHTML = cible.dataset.tip.split('\n').map((l, i) => (i === 0 ? `<strong>${esc(l)}</strong>` : esc(l))).join('<br>');
    tip.hidden = false;
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    const yy = (e.touches ? e.touches[0].clientY : e.clientY);
    const w = tip.offsetWidth;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px';
    tip.style.top = Math.max(8, yy - tip.offsetHeight - 14) + 'px';
  };
  root.addEventListener('mousemove', montrer);
  root.addEventListener('touchstart', montrer, { passive: true });
  root.addEventListener('mouseleave', () => { tip.hidden = true; });
}

// ====================================================================
// Tableau de bord
// ====================================================================

function variation(actuel, precedent, hausseBonne) {
  if (!precedent) return '<span class="delta">Rien sur la période précédente</span>';
  const pct = ((actuel - precedent) / Math.abs(precedent)) * 100;
  if (Math.abs(pct) < 0.5) return '<span class="delta">= stable par rapport à la période précédente</span>';
  const bon = pct > 0 === hausseBonne;
  return `<span class="delta ${bon ? 'good' : 'bad'}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} % <span>vs période précédente</span></span>`;
}

function pageDashboard() {
  const e = data.entreprise;
  const pro = Abonnement.aAcces('pro');
  const regime = regimeFiscal(e);
  const now = new Date();
  const b = bornesPeriode(periodeChoisie, now);
  const actuel = bilan(b.debut, b.fin);
  const prec = bilan(b.precDebut, b.precFin);
  const charges = actuel.cotisations + actuel.impot;
  const chargesPrec = prec.cotisations + prec.impot;

  // Répartition du chiffre d'affaires
  const parts = [
    { nom: 'Dépenses', val: actuel.depHT, color: 'var(--s2)' },
    { nom: regime === 'is' ? 'Impôt sur les sociétés' : 'Cotisations sociales', val: regime === 'is' ? actuel.impot : actuel.cotisations, color: 'var(--s3)' },
    ...(regime === 'micro' && e.versementLiberatoire ? [{ nom: 'Impôt (versement libératoire)', val: actuel.impot, color: 'var(--s4)' }] : []),
    { nom: 'Il vous reste', val: Math.max(0, actuel.reste), color: 'var(--s1)' },
  ];
  const totalParts = parts.reduce((s, x) => s + x.val, 0) || 1;

  // Échéances
  const aPayer = data.documents.filter((d) => d.type === 'facture' && d.statut === 'a-payer')
    .map((d) => ({ d, ttc: computeTotals(d).ttc, retard: Math.floor((new Date(today()) - new Date(d.echeance)) / 86400000) }))
    .sort((a, b2) => b2.retard - a.retard);
  const enRetard = aPayer.filter((x) => x.retard > 0);

  // Devis
  const annee = String(now.getFullYear());
  const devisAnnee = data.documents.filter((d) => d.type === 'devis' && d.date.startsWith(annee));
  const devisEnAttente = data.documents.filter((d) => d.type === 'devis' && d.statut === 'envoye');
  const acceptes = devisAnnee.filter((d) => d.statut === 'accepte').length;
  const refuses = devisAnnee.filter((d) => d.statut === 'refuse').length;
  const tauxAcceptation = acceptes + refuses ? Math.round((acceptes / (acceptes + refuses)) * 100) : null;

  // Plafonds (année civile)
  const caAnnee = bilan(`${annee}-01-01`, `${annee}-12-31`).caHT;
  const m = MICRO[e.activiteMicro] || MICRO.services;

  // Meilleurs clients de l'année
  const parClient = {};
  encaissements().filter((x) => x.date.startsWith(annee)).forEach((x) => {
    parClient[x.client] = (parClient[x.client] || 0) + x.ht;
  });
  const topClients = Object.entries(parClient).map(([label, value]) => ({ label, value }))
    .sort((a, b2) => b2.value - a.value).slice(0, 5);

  const libelleRegime = regime === 'micro'
    ? `Micro-entreprise · cotisations ${tauxFr(m.cotis + m.cfp)} % du CA${e.versementLiberatoire ? ` · versement libératoire ${tauxFr(m.vl)} %` : ''}`
    : regime === 'is'
      ? `Société à l'IS · ${IS_TAUX_REDUIT} % jusqu'à ${euroCourt(IS_PLAFOND_REDUIT)} de bénéfice, ${IS_TAUX_NORMAL} % au-delà`
      : `Entreprise au réel · charges sociales estimées à ${tauxFr(Number(e.tauxCharges) || 45)} % du bénéfice`;

  view.innerHTML = `
    <div class="page-head">
      <h1>Tableau de bord</h1>
      <div class="actions">
        <button class="btn btn-primary" data-new="devis">+ Nouveau devis</button>
        <button class="btn" data-new="facture">+ Nouvelle facture</button>
        ${pro ? '<a class="btn" href="#/depenses?ajout=1">+ Dépense</a>' : ''}
      </div>
    </div>

    <div class="periodes" role="group" aria-label="Période">
      ${Object.entries(PERIODES).map(([k, v]) => `<button type="button" class="chip ${k === periodeChoisie ? 'active' : ''}" data-periode="${k}">${v}</button>`).join('')}
    </div>

    ${!pro ? Abonnement.carteUpsell('dashboard') : ''}
    ${pro ? `<section class="card hero-card">
      <div class="hero-main">
        <p class="kpi-label">Il vous reste (estimation, ${PERIODES[periodeChoisie].toLowerCase()})</p>
        <p class="hero-value ${actuel.reste < 0 ? 'neg' : ''}">${euro(actuel.reste)}</p>
        ${variation(actuel.reste, prec.reste, true)}
        <p class="hero-note">Chiffre d'affaires encaissé, moins vos dépenses, vos cotisations${actuel.impotCompris ? ' et vos impôts' : ''}.
          ${!actuel.impotCompris ? '<br>Avant impôt sur le revenu, qui dépend de la situation de votre foyer.' : ''}</p>
      </div>
      <div class="hero-split">
        ${actuel.caHT > 0 ? `
          <div class="split-bar" data-tip-root>
            ${parts.filter((x) => x.val > 0).map((x) => `<span style="flex:${x.val / totalParts};background:${x.color}" data-tip="${esc(x.nom + '\n' + euro(x.val) + ' · ' + Math.round((x.val / totalParts) * 100) + ' %')}"></span>`).join('')}
          </div>
          <ul class="legend">
            <li><span class="key key-none"></span>Chiffre d'affaires encaissé HT<strong>${euro(actuel.caHT)}</strong></li>
            ${parts.map((x) => `<li><span class="key" style="background:${x.color}"></span>${x.nom}<strong>${x.nom === 'Il vous reste' ? '' : '− '}${euro(x.val)}</strong></li>`).join('')}
          </ul>
          ${actuel.reste < 0 ? `<p class="status bad">⚠ Vos dépenses et charges dépassent votre chiffre d'affaires de ${euro(-actuel.reste)} sur cette période.</p>` : ''}
        ` : `<p class="empty-inline">Aucune facture encaissée sur cette période. Dès qu'une facture est marquée « payée », vous verrez ici ce qu'il vous reste.</p>`}
      </div>
    </section>` : ''}

    <div class="stats">
      <div class="stat"><div class="label">Chiffre d'affaires encaissé HT</div><div class="value">${euro(actuel.caHT)}</div>${variation(actuel.caHT, prec.caHT, true)}</div>
      <div class="stat"><div class="label">Dépenses HT</div><div class="value">${euro(actuel.depHT)}</div>${variation(actuel.depHT, prec.depHT, false)}</div>
      <div class="stat"><div class="label">${regime === 'is' ? 'Impôt sur les sociétés estimé' : 'Cotisations et impôts estimés'}</div><div class="value">${euro(charges)}</div>${variation(charges, chargesPrec, false)}</div>
      ${e.franchiseTva
        ? `<div class="stat"><div class="label">Factures à encaisser</div><div class="value">${euro(aPayer.reduce((s, x) => s + x.ttc, 0))}</div><span class="delta">${aPayer.length} facture${aPayer.length > 1 ? 's' : ''}</span></div>`
        : `<div class="stat"><div class="label">TVA à reverser</div><div class="value">${euro(actuel.tvaAReverser)}</div><span class="delta">${euro(actuel.tvaCollectee)} collectée − ${euro(actuel.tvaDeductible)} déductible</span></div>`}
    </div>

    ${pro ? `<section class="card">
      <div class="card-head">
        <h2>Mois par mois</h2>
        <ul class="legend inline"><li><span class="key" style="background:var(--s1)"></span>Chiffre d'affaires HT</li><li><span class="key" style="background:var(--s2)"></span>Dépenses HT</li></ul>
      </div>
      <div class="chart-box" id="chart-mois"></div>
      <details class="chart-table"><summary>Voir les chiffres</summary><div class="table-wrap" id="table-mois"></div></details>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Jour par jour · ${MOIS_COURTS[now.getMonth()].replace('.', '')} ${now.getFullYear()}</h2>
        <p class="card-sub" id="jours-resume"></p>
      </div>
      <div class="chart-box" id="chart-jours"></div>
    </section>` : ''}

    <div class="panels">
      <section class="card">
        <h2>À encaisser</h2>
        ${aPayer.length ? `
          <p class="big">${euro(aPayer.reduce((s, x) => s + x.ttc, 0))} <small>sur ${aPayer.length} facture${aPayer.length > 1 ? 's' : ''}</small></p>
          ${enRetard.length ? `<p class="status bad">⚠ ${enRetard.length} en retard · ${euro(enRetard.reduce((s, x) => s + x.ttc, 0))}</p>` : '<p class="status good">✓ Aucune facture en retard</p>'}
          <ul class="mini-list">
            ${aPayer.slice(0, 5).map((x) => `<li><a href="#/voir/${esc(x.d.id)}">${esc(x.d.numero)}</a> <span>${esc(clientName(x.d))}</span>
              <strong>${euro(x.ttc)}</strong>
              <em class="${x.retard > 0 ? 'late' : ''}">${x.retard > 0 ? `${x.retard} j de retard` : x.retard === 0 ? "échéance aujourd'hui" : `dans ${-x.retard} j`}</em></li>`).join('')}
          </ul>` : '<p class="empty-inline">Toutes vos factures sont payées. 👍</p>'}
      </section>

      <section class="card">
        <h2>Devis</h2>
        <p class="big">${devisEnAttente.length} <small>en attente de réponse · ${euro(devisEnAttente.reduce((s, d) => s + computeTotals(d).ttc, 0))}</small></p>
        <p class="kpi-label">Taux d'acceptation ${annee}</p>
        ${tauxAcceptation === null ? '<p class="empty-inline">Pas encore de devis accepté ou refusé cette année.</p>' : `
          <p class="big">${tauxAcceptation} % <small>${acceptes} accepté${acceptes > 1 ? 's' : ''}, ${refuses} refusé${refuses > 1 ? 's' : ''}</small></p>
          <div class="meter meter-ok"><span style="width:${tauxAcceptation}%"></span></div>`}
      </section>

      ${regime === 'micro' && pro ? `
      <section class="card">
        <h2>Plafonds ${annee}</h2>
        <p class="kpi-label">Plafond de la micro-entreprise</p>
        <p class="big">${euroCourt(caAnnee)} <small>sur ${euroCourt(m.plafond)} · ${Math.round((caAnnee / m.plafond) * 100)} %</small></p>
        ${meter(caAnnee, m.plafond)}
        ${e.franchiseTva ? `
          <p class="kpi-label" style="margin-top:14px">Seuil de franchise de TVA</p>
          <p class="big">${euroCourt(caAnnee)} <small>sur ${euroCourt(m.seuilTva)} · ${Math.round((caAnnee / m.seuilTva) * 100)} %</small></p>
          ${meter(caAnnee, m.seuilTva)}
          ${caAnnee >= m.seuilTva ? '<p class="status bad">⚠ Seuil dépassé : vous devrez facturer la TVA. Parlez-en à votre comptable.</p>' : caAnnee >= m.seuilTva * 0.8 ? '<p class="status warn">⚠ Vous approchez du seuil de TVA.</p>' : ''}` : ''}
      </section>` : ''}

      ${pro ? `<section class="card">
        <h2>Meilleurs clients ${annee}</h2>
        ${topClients.length ? barList(topClients, 'var(--s1)') : '<p class="empty-inline">Vos meilleurs clients apparaîtront ici dès les premières factures payées.</p>'}
      </section>` : ''}
    </div>

    <section class="card">
      <div class="page-head" style="margin-bottom:8px">
        <h2 style="margin:0">5 derniers documents</h2>
        ${data.documents.length > 5 ? `<a href="#/documents">Voir tout (${data.documents.length}) →</a>` : ''}
      </div>
      ${documentsTable(data.documents.slice().sort((a, b2) => b2.creeLe - a.creeLe).slice(0, 5))}
    </section>

    <p class="disclaimer">${esc(libelleRegime)}. Estimations indicatives calculées avec les taux 2026 ; elles ne remplacent pas votre comptable ni vos déclarations
      à l'Urssaf et aux impôts. Régime et taux modifiables dans <a href="#/parametres?champ=regimeFiscal">Mon entreprise</a>.</p>
  `;

  view.querySelectorAll('[data-periode]').forEach((btn) => btn.addEventListener('click', () => {
    periodeChoisie = btn.dataset.periode;
    pageDashboard();
  }));

  if (pro) dessinerGraphiques(now);
  brancherInfobulles(view);
}

function dessinerGraphiques(now) {
  const boxMois = document.getElementById('chart-mois');
  if (!boxMois) return;
  // 12 derniers mois
  const mois = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const debut = isoDate(d);
    const fin = isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    mois.push({ d, b: bilan(debut, fin) });
  }
  boxMois.innerHTML = columnChart({
    width: boxMois.clientWidth,
    categories: mois.map(({ d, b }) => ({
      label: MOIS_COURTS[d.getMonth()],
      tip: `${MOIS_COURTS[d.getMonth()]} ${d.getFullYear()}\nChiffre d'affaires HT : ${euro(b.caHT)}\nDépenses HT : ${euro(b.depHT)}\nCotisations et impôts : ${euro(b.cotisations + b.impot)}\nIl vous reste : ${euro(b.reste)}`,
    })),
    series: [
      { name: "Chiffre d'affaires HT", color: 'var(--s1)', values: mois.map((x) => x.b.caHT) },
      { name: 'Dépenses HT', color: 'var(--s2)', values: mois.map((x) => x.b.depHT) },
    ],
    labelEvery: boxMois.clientWidth < 500 ? 2 : 1,
    highlight: 11,
  });
  document.getElementById('table-mois').innerHTML = `<table>
    <thead><tr><th>Mois</th><th class="num">CA HT</th><th class="num">Dépenses HT</th><th class="num">Cotisations et impôts</th><th class="num">Reste</th></tr></thead>
    <tbody>${mois.map(({ d, b }) => `<tr><td>${MOIS_COURTS[d.getMonth()]} ${d.getFullYear()}</td><td class="num">${euro(b.caHT)}</td><td class="num">${euro(b.depHT)}</td><td class="num">${euro(b.cotisations + b.impot)}</td><td class="num">${euro(b.reste)}</td></tr>`).join('')}</tbody>
  </table>`;

  // Jours du mois en cours
  const boxJours = document.getElementById('chart-jours');
  const nbJours = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const parJour = Array(nbJours).fill(0);
  const prefixe = isoDate(now).slice(0, 8);
  encaissements().filter((x) => x.date.startsWith(prefixe)).forEach((x) => {
    parJour[Number(x.date.slice(8, 10)) - 1] += x.ht;
  });
  const total = parJour.reduce((s, v) => s + v, 0);
  const meilleur = parJour.indexOf(Math.max(...parJour));
  document.getElementById('jours-resume').textContent = total
    ? `${euro(total)} encaissés HT ce mois-ci · meilleur jour : le ${meilleur + 1} (${euro(parJour[meilleur])})`
    : 'Aucun encaissement ce mois-ci pour le moment.';
  boxJours.innerHTML = columnChart({
    width: boxJours.clientWidth,
    height: 180,
    categories: parJour.map((v, i) => ({
      label: String(i + 1),
      tip: `${i + 1} ${MOIS_COURTS[now.getMonth()]}\nEncaissé HT : ${euro(v)}`,
    })),
    series: [{ name: 'Encaissé HT', color: 'var(--s1)', values: parJour }],
    labelEvery: boxJours.clientWidth < 500 ? 7 : 3,
    highlight: now.getDate() - 1,
  });
}

// Redessine les graphiques quand la largeur change (rotation du téléphone...).
let minuteurRedim;
window.addEventListener('resize', () => {
  clearTimeout(minuteurRedim);
  minuteurRedim = setTimeout(() => {
    if (document.getElementById('chart-mois')) dessinerGraphiques(new Date());
  }, 200);
});

// ====================================================================
// Dépenses
// ====================================================================

function pageDepenses(params) {
  if (!data.depenses) data.depenses = [];
  const enEdition = params?.get('modifier') ? data.depenses.find((d) => d.id === params.get('modifier')) : null;
  const ouvert = Boolean(enEdition || params?.get('ajout'));
  const dep = enEdition || { date: today(), fournisseur: '', categorie: CATEGORIES_DEPENSES[0], montantTTC: '', tva: data.entreprise.franchiseTva ? 20 : 20, note: '' };
  const annee = String(new Date().getFullYear());
  const liste = data.depenses.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const totalAnneeHT = liste.filter((d) => (d.date || '').startsWith(annee)).reduce((s, d) => s + depenseHT(d), 0);

  // Répartition par catégorie (année)
  const parCat = {};
  liste.filter((d) => (d.date || '').startsWith(annee)).forEach((d) => {
    parCat[d.categorie] = (parCat[d.categorie] || 0) + depenseHT(d);
  });
  const cats = Object.entries(parCat).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  view.innerHTML = `
    <div class="page-head">
      <h1>Dépenses</h1>
      <button class="btn btn-primary" id="dep-ajout" ${ouvert ? 'hidden' : ''}>+ Ajouter une dépense</button>
    </div>

    <form id="dep-form" class="card" ${ouvert ? '' : 'hidden'} novalidate>
      <h2>${enEdition ? 'Modifier la dépense' : 'Nouvelle dépense'}</h2>
      <div class="grid-2">
        <div><label for="dep-date">Date *</label><input id="dep-date" name="date" type="date" value="${esc(dep.date)}" required></div>
        <div><label for="dep-fournisseur">Fournisseur</label><input id="dep-fournisseur" name="fournisseur" value="${esc(dep.fournisseur)}" placeholder="Ex : Point P, Total, Leroy Merlin"></div>
        <div><label for="dep-categorie">Catégorie</label>
          <select id="dep-categorie" name="categorie">${CATEGORIES_DEPENSES.map((c) => `<option ${c === dep.categorie ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div><label for="dep-montant">Montant TTC payé (€) *</label><input id="dep-montant" name="montantTTC" type="number" step="0.01" min="0" inputmode="decimal" value="${esc(dep.montantTTC)}" required></div>
        <div><label for="dep-tva">TVA sur la facture</label>
          <select id="dep-tva" name="tva">${[20, 10, 5.5, 2.1, 0].map((t) => `<option value="${t}" ${Number(dep.tva) === t ? 'selected' : ''}>${tauxFr(t)} %</option>`).join('')}</select>
          <small class="hint" id="dep-ht"></small></div>
        <div><label for="dep-note">Note</label><input id="dep-note" name="note" value="${esc(dep.note)}" placeholder="Ex : chantier Martin"></div>
      </div>
      <div class="actions" style="margin-top:16px">
        <button class="btn btn-primary" type="submit">${enEdition ? 'Enregistrer' : 'Ajouter'}</button>
        <a class="btn" href="#/depenses">Annuler</a>
      </div>
    </form>

    <div class="stats">
      <div class="stat"><div class="label">Dépenses HT ${annee}</div><div class="value">${euro(totalAnneeHT)}</div></div>
      <div class="stat"><div class="label">Nombre de dépenses ${annee}</div><div class="value">${liste.filter((d) => (d.date || '').startsWith(annee)).length}</div></div>
    </div>

    ${cats.length ? `<section class="card"><h2>Par catégorie · ${annee}</h2>${barList(cats, 'var(--s2)')}</section>` : ''}

    <section class="card">
      ${liste.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Fournisseur</th><th>Catégorie</th><th class="num">HT</th><th class="num">TTC</th><th class="num">Actions</th></tr></thead>
        <tbody>${liste.map((d) => `<tr>
          <td>${dateFr(d.date)}</td><td>${esc(d.fournisseur || '—')}${d.note ? `<br><small>${esc(d.note)}</small>` : ''}</td><td>${esc(d.categorie)}</td>
          <td class="num">${euro(depenseHT(d))}</td><td class="num">${euro(Number(d.montantTTC) || 0)}</td>
          <td><div class="row-actions"><a class="btn btn-sm" href="#/depenses?modifier=${esc(d.id)}">Modifier</a>
            <button class="btn btn-sm btn-danger" data-suppr-dep="${esc(d.id)}">Supprimer</button></div></td>
        </tr>`).join('')}</tbody></table></div>`
        : '<p class="empty">Aucune dépense enregistrée. Ajoutez vos achats de matériel, carburant, assurance… pour connaître votre vrai bénéfice.</p>'}
    </section>
  `;

  const form = document.getElementById('dep-form');
  const majHT = () => {
    const ht = depenseHT({ montantTTC: form.montantTTC.value, tva: form.tva.value });
    document.getElementById('dep-ht').textContent = form.montantTTC.value ? `Soit ${euro(ht)} HT et ${euro(Number(form.montantTTC.value) - ht)} de TVA` : '';
  };
  form.addEventListener('input', majHT);
  majHT();
  document.getElementById('dep-ajout').addEventListener('click', () => go('#/depenses?ajout=1'));
  if (ouvert) setTimeout(() => form.montantTTC.focus(), 50);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const v = Object.fromEntries(new FormData(form));
    if (!v.date || !(Number(v.montantTTC) > 0)) {
      await ask('Indiquez au moins la date et le montant TTC de la dépense.', "D'accord", false);
      return;
    }
    const valeurs = { ...v, montantTTC: Number(v.montantTTC), tva: Number(v.tva) };
    if (enEdition) Object.assign(enEdition, valeurs);
    else data.depenses.push({ id: newId(), ...valeurs });
    saveData();
    go('#/depenses');
  });

  view.querySelectorAll('[data-suppr-dep]').forEach((btn) => btn.addEventListener('click', async () => {
    const d = data.depenses.find((x) => x.id === btn.dataset.supprDep);
    if (d && (await ask(`Supprimer la dépense du ${dateFr(d.date)} (${euro(Number(d.montantTTC) || 0)}) ?`, 'Supprimer'))) {
      data.depenses = data.depenses.filter((x) => x.id !== d.id);
      saveData();
      render();
    }
  }));
  brancherInfobulles(view);
}
