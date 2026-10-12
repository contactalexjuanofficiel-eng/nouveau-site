// Fonction Supabase « admin » : actions du panel d'administration qui
// demandent une clé secrète. Réservée aux comptes de la table « admins »,
// sauf l'action « assistance » ouverte à tout utilisateur connecté.
//
//   { action: 'email', a: 'client@exemple.fr', objet, message }
//       envoie un e-mail à un utilisateur depuis contact@devizo-app.fr (Brevo)
//   { action: 'revenus' }
//       chiffre d'affaires encaissé par mois sur 12 mois (factures Stripe payées)
//   { action: 'assistance', id }
//       (tout utilisateur connecté) prévient l'équipe Devizo par e-mail d'une
//       demande d'assistance qu'il vient d'enregistrer
//
// Secrets déjà en place : BREVO_API_KEY, STRIPE_SECRET_KEY.
// Facultatif : EXPEDITEUR (par défaut contact@devizo-app.fr), REPONDRE_A.
// À déployer avec « Verify JWT » DÉSACTIVÉ : la fonction vérifie elle-même
// que l'appel vient d'un administrateur connecté.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);
const EXPEDITEUR = Deno.env.get('EXPEDITEUR') ?? 'contact@devizo-app.fr';
const REPONDRE_A = Deno.env.get('REPONDRE_A') ?? 'devizocontact@gmail.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reponse(status: number, corps: Record<string, unknown>) {
  return new Response(JSON.stringify(corps), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const emailValide = (e: unknown) => typeof e === 'string' && e.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e);

function corpsHtml(message: string) {
  const paragraphes = echapper(message).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.55">${p.replace(/\n/g, '<br>')}</p>`).join('');
  return `<div lang="fr" style="background:#f4f6fb;padding:28px 14px;font-family:Arial,Helvetica,sans-serif;color:#1c2333;font-size:15px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 26px">
    <p style="margin:0 0 20px;font-weight:bold;font-size:18px;color:#1f5eff">Devizo</p>
    ${paragraphes}
  </div>
  <p style="max-width:560px;margin:14px auto 0;font-size:12px;color:#8a91a3;text-align:center">Devizo · devis et factures pour artisans · devizo-app.fr</p>
</div>`;
}

async function envoyerEmail(corps: Record<string, unknown>, expediteurId: string) {
  const a = String(corps.a ?? '').trim();
  const objet = String(corps.objet ?? '').trim();
  const message = String(corps.message ?? '').trim();
  if (!emailValide(a)) return reponse(400, { erreur: "L'adresse e-mail n'est pas valide." });
  if (!objet || objet.length > 200) return reponse(400, { erreur: 'Indiquez un objet (200 caractères au plus).' });
  if (!message || message.length > 10000) return reponse(400, { erreur: 'Le message est vide ou trop long.' });
  const cle = Deno.env.get('BREVO_API_KEY');
  if (!cle) return reponse(500, { erreur: 'Clé Brevo manquante (secret BREVO_API_KEY).' });
  const envoi = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': cle, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Devizo', email: EXPEDITEUR },
      to: [{ email: a }],
      replyTo: { email: REPONDRE_A, name: 'Devizo' },
      subject: objet,
      htmlContent: corpsHtml(message),
      textContent: message + '\n\n--\nDevizo · devizo-app.fr',
    }),
  });
  if (!envoi.ok) {
    const detail = await envoi.text();
    console.error('Brevo', envoi.status, detail);
    return reponse(502, { erreur: `Brevo a refusé l'envoi (${envoi.status}).` });
  }
  await admin.from('emails_envoyes').insert({ user_id: expediteurId, destinataire: a, objet: '[admin] ' + objet });
  return reponse(200, { envoye: true });
}

const CATEGORIES: Record<string, string> = {
  question: 'Question', probleme: 'Problème / bug', abonnement: 'Abonnement / paiement', suggestion: 'Suggestion',
};

// Nouvelle demande d'assistance : e-mail à l'équipe, réponse directe à l'utilisateur.
async function notifierAssistance(corps: Record<string, unknown>, userId: string) {
  const id = Number(corps.id);
  if (!Number.isInteger(id) || id < 1) return reponse(400, { erreur: 'Demande inconnue' });
  const { data: d } = await admin.from('demandes_assistance').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (!d) return reponse(404, { erreur: 'Demande introuvable' });
  if (d.notifiee) return reponse(200, { envoye: false });
  const cle = Deno.env.get('BREVO_API_KEY');
  if (!cle) return reponse(500, { erreur: 'Clé Brevo manquante (secret BREVO_API_KEY).' });
  const { data: espace } = await admin.from('espaces').select('donnees').eq('user_id', userId).maybeSingle();
  const entreprise = String(espace?.donnees?.entreprise?.nom ?? '');
  const contexte = d.contexte ? Object.entries(d.contexte).map(([k, v]) => `${k} : ${v}`).join('\n') : '';
  const lignes = [
    `${d.prioritaire ? '⚡ DEMANDE PRIORITAIRE (formule Entreprise)\n\n' : ''}De : ${d.email}${entreprise ? ` (${entreprise})` : ''}`,
    `Formule : ${String(d.formule ?? '—').replace('equipe', 'Entreprise').replace('pro', 'Pro').replace('solo', 'Solo')}`,
    `Catégorie : ${CATEGORIES[d.categorie] ?? d.categorie}`,
    `Sujet : ${d.sujet}`,
    `Message :\n${d.message}`,
    contexte ? `Informations techniques :\n${contexte}` : '',
    `Répondez simplement à cet e-mail : la réponse part directement à ${d.email}.\nToutes les demandes : https://devizo-app.fr/admin.html`,
  ].filter(Boolean);
  const envoi = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': cle, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Assistance Devizo', email: EXPEDITEUR },
      to: [{ email: REPONDRE_A }],
      replyTo: emailValide(d.email) ? { email: d.email } : undefined,
      subject: `${d.prioritaire ? '⚡ [PRIORITAIRE] ' : ''}Assistance : ${d.sujet}`.slice(0, 200),
      htmlContent: corpsHtml(lignes.join('\n\n')),
      textContent: lignes.join('\n\n'),
    }),
  });
  if (!envoi.ok) {
    console.error('Brevo', envoi.status, await envoi.text());
    return reponse(502, { erreur: "La notification n'a pas pu partir." });
  }
  await admin.from('demandes_assistance').update({ notifiee: true }).eq('id', id);
  return reponse(200, { envoye: true });
}

// Factures Stripe payées sur les 12 derniers mois, regroupées par mois.
async function revenus() {
  const cle = Deno.env.get('STRIPE_SECRET_KEY');
  if (!cle) return reponse(500, { erreur: 'Clé Stripe manquante (secret STRIPE_SECRET_KEY).' });
  const maintenant = new Date();
  const debut = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - 11, 1));
  const mois = new Map<string, { mois: string; factures: number; ht: number; ttc: number }>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + i, 1));
    const cleMois = d.toISOString().slice(0, 7);
    mois.set(cleMois, { mois: cleMois, factures: 0, ht: 0, ttc: 0 });
  }
  let apres = '';
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({ status: 'paid', limit: '100', 'created[gte]': String(Math.floor(debut.getTime() / 1000) - 86400 * 40) });
    if (apres) params.set('starting_after', apres);
    const r = await fetch(`https://api.stripe.com/v1/invoices?${params}`, { headers: { Authorization: `Bearer ${cle}` } });
    if (!r.ok) {
      console.error('Stripe', r.status, await r.text());
      return reponse(502, { erreur: `Stripe a refusé la lecture des factures (${r.status}).` });
    }
    const lot = await r.json();
    for (const f of lot.data ?? []) {
      if (!f.amount_paid) continue;
      const payeLe = f.status_transitions?.paid_at ?? f.created;
      const cleMois = new Date(payeLe * 1000).toISOString().slice(0, 7);
      const m = mois.get(cleMois);
      if (!m) continue;
      m.factures += 1;
      m.ttc += f.amount_paid / 100;
      m.ht += (f.total_excluding_tax ?? f.amount_paid) / 100;
    }
    if (!lot.has_more || !lot.data?.length) break;
    apres = lot.data[lot.data.length - 1].id;
  }
  const liste = [...mois.values()].map((m) => ({ ...m, ht: Math.round(m.ht * 100) / 100, ttc: Math.round(m.ttc * 100) / 100 }));
  return reponse(200, { mois: liste });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reponse(405, { erreur: 'Méthode non autorisée' });

  const jeton = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await admin.auth.getUser(jeton);
  const user = auth?.user;
  if (!user) return reponse(401, { erreur: 'Connexion requise' });

  let corps: Record<string, unknown>;
  try {
    corps = await req.json();
  } catch {
    return reponse(400, { erreur: 'Demande illisible' });
  }
  // Seule action ouverte à tous les utilisateurs connectés.
  if (corps.action === 'assistance') return notifierAssistance(corps, user.id);

  const { data: estAdmin } = await admin.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!estAdmin) return reponse(403, { erreur: 'Accès réservé aux administrateurs' });

  if (corps.action === 'email') return envoyerEmail(corps, user.id);
  if (corps.action === 'revenus') return revenus();
  return reponse(400, { erreur: 'Action inconnue' });
});
