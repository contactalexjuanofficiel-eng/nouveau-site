/*
 * Captures d'écran de l'appli Devizo, sans toucher à la vraie base de données.
 *
 * Le script sert le site local, remplace Supabase par de fausses réponses
 * (un artisan « Dupont Plomberie » avec clients, devis, factures, dépenses),
 * se connecte, puis photographie chaque page sur téléphone, tablette et ordinateur.
 *
 *   node outils/tests/captures.mjs [options]
 *     --sortie DOSSIER        où enregistrer les images (défaut : captures/)
 *     --pages a,b             pages à photographier (défaut : toutes, voir PAGES)
 *     --ecrans tel,tab,pc     tailles d'écran (défaut : les trois)
 *     --sombre                ajoute le mode sombre sur ordinateur
 *     --pleine                page entière (attention : barres fixes mal placées)
 *     --menu                  photographie aussi le menu « Plus » ouvert (téléphone)
 *
 * Affiche à la fin les erreurs JavaScript rencontrées : « ERREURS [] » = tout va bien.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Playwright installé dans le projet (npm i playwright) ou, à défaut, celui de la machine.
const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (nom, defaut) => { const i = process.argv.indexOf('--' + nom); return i < 0 ? defaut : (process.argv[i + 1] || true); };
const OUT = path.resolve(arg('sortie', 'captures')); fs.mkdirSync(OUT, { recursive: true });

// Petit serveur : le site tel quel, sauf la config qui pointe vers un faux Supabase.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4' };
const serveur = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(RACINE, p === '/' ? 'index.html' : p);
  if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  let corps = fs.readFileSync(f);
  if (p === '/js/config.js') corps = corps.toString().replace(/https:\/\/[a-z]+\.supabase\.co/, 'https://test.supabase.co');
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(corps);
});
await new Promise((ok) => serveur.listen(0, ok));
const BASE = `http://localhost:${serveur.address().port}/`;
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

// ---------- Données de démonstration ----------
const k = (12 + 3 * (123456789 % 97)) % 97;
const jour = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const L = (description, quantite, unite, prixUnitaire, tva = 10) => ({ id: Math.random().toString(36).slice(2), description, quantite, unite, prixUnitaire, tva });
const profil = {
  entreprise: { nom: 'Dupont Plomberie', formeJuridique: 'micro', regime: 'micro', activiteMicro: 'services', adresse: '12 rue des Lilas\n69003 Lyon', rue: '12 rue des Lilas', codePostal: '69003', ville: 'Lyon',
    siret: '12345678900007', nonDecennale: false, assureur: 'MAAF Pro', numeroContrat: 'BTP-445512', zoneCouverture: 'France métropolitaine', franchiseTva: false,
    numeroTva: 'FR' + String(k).padStart(2, '0') + '123456789', email: 'contact@dupont-plomberie.fr', telephone: '06 12 34 56 78', iban: 'FR76 3000 6000 0112 3456 7890 189',
    delaiPaiement: 30, validiteDevis: 30, prefixeDevis: 'D', prefixeFacture: 'F', moyensPaiement: ['virement', 'cheque'] },
  clients: [
    { id: 'c1', nom: 'Mme Martin', adresse: '8 avenue Foch\n69006 Lyon', email: 'martin@exemple.fr', telephone: '06 00 00 00 01' },
    { id: 'c2', nom: 'M. Bernard', adresse: '3 rue Garibaldi\n69003 Lyon', email: 'bernard@exemple.fr' },
    { id: 'c3', nom: 'SCI Les Tilleuls', adresse: '21 quai Perrache\n69002 Lyon', email: 'gestion@tilleuls.fr', siret: '81234567800014' },
    { id: 'c4', nom: 'M. et Mme Petit', adresse: '5 rue Royale\n69001 Lyon', email: 'petit@exemple.fr' },
  ],
  documents: [
    { id: 'd1', type: 'devis', numero: 'D-2026-014', clientId: 'c1', date: jour(-2), echeance: jour(28), objet: 'Rénovation salle de bain', statut: 'envoye', creeLe: 14,
      lignes: [L('Dépose baignoire et évacuation', 1, 'forfait', 280), L('Receveur de douche 90×120', 1, 'u', 640), L('Mitigeur thermostatique', 1, 'u', 189), L("Main-d'œuvre installation", 6, 'h', 55)] },
    { id: 'd2', type: 'devis', numero: 'D-2026-013', clientId: 'c4', date: jour(-6), echeance: jour(24), objet: 'Remplacement chauffe-eau', statut: 'accepte', creeLe: 13,
      signature: { jeton: 'x', nom: 'Claire Petit', le: new Date(Date.now() - 4 * 864e5).toISOString() },
      lignes: [L('Chauffe-eau électrique 200 L', 1, 'u', 520), L("Main-d'œuvre", 3, 'h', 55)] },
    { id: 'f5', type: 'facture', numero: 'F-2026-031', clientId: 'c2', date: jour(-40), echeance: jour(-27), objet: 'Recherche de fuite', statut: 'a-payer', creeLe: 31,
      lignes: [L('Recherche de fuite non destructive', 1, 'forfait', 290), L('Réparation canalisation', 1, 'forfait', 180)] },
    { id: 'f4', type: 'facture', numero: 'F-2026-030', clientId: 'c3', date: jour(-12), echeance: jour(18), objet: 'Entretien chaudières', statut: 'a-payer', creeLe: 30,
      lignes: [L('Entretien chaudière gaz', 4, 'u', 120)] },
  ],
  depenses: [], catalogue: [
    { id: 'k1', description: 'Remplacement mitigeur', unite: 'u', prixUnitaire: 145, tva: 10 },
    { id: 'k2', description: 'Débouchage canalisation', unite: 'forfait', prixUnitaire: 120, tva: 10 },
    { id: 'k3', description: "Main-d'œuvre", unite: 'h', prixUnitaire: 55, tva: 10 },
  ],
};
// Factures payées sur 6 mois (tableau de bord) et dépenses.
const montants = [2850, 3420, 2980, 4150, 3760, 4480];
montants.forEach((m, i) => {
  const d = jour(-30 * (5 - i) - 5);
  profil.documents.push({ id: 'p' + i, type: 'facture', numero: 'F-2026-0' + (20 + i), clientId: ['c1', 'c2', 'c3', 'c4'][i % 4], date: d, echeance: d, statut: 'payee', datePaiement: d, creeLe: 20 + i,
    objet: 'Travaux de plomberie', lignes: [L('Travaux de plomberie', 1, 'forfait', m)] });
  profil.depenses.push({ id: 'x' + i, date: d, fournisseur: ['Point P', 'Cedeo', 'Leroy Merlin'][i % 3], categorie: 'materiel', montantTTC: Math.round(m * 0.22), tva: 20 });
  profil.depenses.push({ id: 'y' + i, date: d, fournisseur: 'TotalEnergies', categorie: 'carburant', montantTTC: 180, tva: 20 });
});



const PAGES = [['dashboard', '#/'], ['documents', '#/documents'], ['devis-edit', '#/modifier/d1'], ['devis-voir', '#/voir/d1'], ['clients', '#/clients'],
  ['client-fiche', '#/clients/c1'], ['depenses', '#/depenses'], ['catalogue', '#/catalogue'], ['entreprise', '#/parametres'], ['compte', '#/compte'],
  ['abonnement', '#/abonnement'], ['assistance', '#/assistance'], ['parrainage', '#/parrainage'], ['export', '#/export']];
const choix = arg('pages', null); const pages = choix ? PAGES.filter(([n]) => choix.split(',').includes(n)) : PAGES;
const ECRANS = { tel: [390, 844], tab: [820, 1100], pc: [1440, 900] };
const ecrans = String(arg('ecrans', 'tel,tab,pc')).split(',');

const b = await chromium.launch(); const errs = [];
for (const nomW of ecrans) {
  const [w, h] = ECRANS[nomW];
  for (const dark of (nomW === 'pc' && arg('sombre', false) ? [false, true] : [false])) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: dark ? 'dark' : 'light', isMobile: w < 500, hasTouch: w < 500, locale: 'fr-FR' });
    await ctx.addInitScript(() => { localStorage.setItem('devizo-cookies-vu', '1'); localStorage.setItem('devizo-install-vu', '1'); localStorage.setItem('devizo-installer-plus-tard', String(Date.now())); localStorage.setItem('devizo-langue', 'fr'); });
    const S = { espace: { donnees: JSON.parse(JSON.stringify(profil)), mis_a_jour: '2026-10-01T00:00:00+00:00' } };
    await ctx.route('https://test.supabase.co/**', async (route) => {
      const req = route.request(); const p = new URL(req.url()).pathname; const m = req.method();
      if (m === 'OPTIONS') return route.fulfill({ status: 200, headers: cors });
      const json = (s, body) => route.fulfill({ status: s, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const user = { id: 'u1', email: 'contact@dupont-plomberie.fr', aud: 'authenticated', created_at: new Date(Date.now() - 200 * 864e5).toISOString() };
      if (p === '/auth/v1/settings') return json(200, { external: { google: true } });
      if (p === '/auth/v1/token') return json(200, { access_token: 'tok', token_type: 'bearer', expires_in: 3600, expires_at: 9999999999, refresh_token: 'r', user });
      if (p === '/auth/v1/user') return json(200, user);
      if (p === '/rest/v1/rpc/mon_equipe') return json(200, { role: 'titulaire', membres: [] });
      if (p === '/rest/v1/rpc/est_admin') return json(200, false);
      if (p === '/rest/v1/rpc/mes_parrainages') return json(200, { code: 'DUPONT47', inscrits: 2, abonnes: 1, mois: 1, filleuls: [{ nom: 'Élec Services', inscrit_le: new Date(Date.now() - 20 * 864e5).toISOString(), abonne: true }, { nom: 'Martin Peinture', inscrit_le: new Date(Date.now() - 3 * 864e5).toISOString(), abonne: false }] });
      if (p === '/rest/v1/abonnements') return json(200, { user_id: 'u1', formule: 'equipe', statut: 'active', fin_periode: new Date(Date.now() + 9e8).toISOString() });
      if (p === '/rest/v1/demandes_assistance') return json(200, []);
      if (p === '/rest/v1/espaces') {
        if (m === 'GET') return json(200, [S.espace]);
        if (m === 'PATCH') { const c = JSON.parse(req.postData()); S.espace = { donnees: c.donnees, mis_a_jour: c.mis_a_jour.replace('Z', '+00:00') }; return json(200, [{ mis_a_jour: S.espace.mis_a_jour }]); }
      }
      return json(200, []);
    });
    const pg = await ctx.newPage(); pg.on('pageerror', (e) => errs.push(nomW + ' ' + e.message));
    const suffixe = nomW + (dark ? '-sombre' : '');
    await pg.goto(BASE + 'app.html#connexion'); await pg.waitForSelector('#auth-form'); await pg.waitForTimeout(400);
    if (!dark) await pg.screenshot({ path: `${OUT}/00-connexion-${suffixe}.png` });
    await pg.fill('#auth-email', 'contact@dupont-plomberie.fr'); await pg.fill('#auth-mdp', 'motdepasse1'); await pg.click('.auth-submit'); await pg.waitForTimeout(1300);
    for (const [nom, hash] of pages) {
      await pg.goto(BASE + 'app.html' + hash); await pg.waitForTimeout(650);
      await pg.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
      await pg.screenshot({ path: `${OUT}/${String(PAGES.findIndex((x) => x[0] === nom) + 1).padStart(2, '0')}-${nom}-${suffixe}.png`, fullPage: !!arg('pleine', false) });
    }
    if (arg('menu', false) && !dark && await pg.isVisible('#burger')) {
      await pg.click('#burger'); await pg.waitForTimeout(400);
      await pg.screenshot({ path: `${OUT}/30-menu-plus-${suffixe}.png` });
    }
    await ctx.close();
  }
}
await b.close(); serveur.close();
console.log('Captures dans', OUT);
console.log('ERREURS', errs);
