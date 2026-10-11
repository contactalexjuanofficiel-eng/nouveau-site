// Fonction Supabase « envoyer-email » : envoie un devis ou une facture au
// client de l'artisan (avec le PDF et, pour un devis, le lien de signature),
// via Brevo, depuis contact@devizo-app.fr avec réponse vers l'artisan.
//
// Secret à définir dans Supabase (Edge Functions > Secrets) :
//   BREVO_API_KEY   clé API Brevo (xkeysib-...)
// Facultatif : SITE_URL (par défaut https://devizo-app.fr), EXPEDITEUR (par défaut contact@devizo-app.fr).
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.
//
// À déployer avec « Verify JWT » ACTIVÉ : seul un artisan connecté peut envoyer.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);
const SITE = (Deno.env.get('SITE_URL') ?? 'https://devizo-app.fr').replace(/\/$/, '');
const EXPEDITEUR = Deno.env.get('EXPEDITEUR') ?? 'contact@devizo-app.fr';
const LIMITE_JOUR = 40; // e-mails par compte et par 24 h (anti-abus)
const ESSAI_JOURS = 14;

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

function abonnementActif(a: { formule: string; statut: string; fin_periode: string | null } | null, formules: string[]) {
  if (!a || !formules.includes(a.formule) || !['active', 'trialing', 'past_due'].includes(a.statut)) return false;
  return !a.fin_periode || Date.parse(a.fin_periode) > Date.now() - 3 * 86400000;
}

async function enEssai(uid: string) {
  const { data } = await admin.auth.admin.getUserById(uid);
  const cree = data?.user?.created_at ? Date.parse(data.user.created_at) : 0;
  return cree > Date.now() - ESSAI_JOURS * 86400000;
}

async function abonnementDe(uid: string) {
  const { data } = await admin.from('abonnements').select('formule, statut, fin_periode').eq('user_id', uid).maybeSingle();
  return data;
}

// Formule Pro ou Entreprise (ou essai) ; un membre d'équipe dépend du titulaire.
// Renvoie l'identifiant de l'espace (titulaire) si l'envoi est autorisé.
async function espaceAutorise(uid: string): Promise<string | null> {
  const { data: membre } = await admin.from('membres').select('proprietaire').eq('membre', uid).maybeSingle();
  if (membre?.proprietaire) {
    const p = membre.proprietaire as string;
    const ok = (await enEssai(p)) || abonnementActif(await abonnementDe(p), ['equipe']);
    return ok ? p : null;
  }
  const ok = (await enEssai(uid)) || abonnementActif(await abonnementDe(uid), ['pro', 'equipe']);
  return ok ? uid : null;
}

function corpsHtml(message: string, entreprise: string, lien: string | null, libelleLien: string) {
  const paragraphes = echapper(message).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.55">${p.replace(/\n/g, '<br>')}</p>`).join('');
  const bouton = lien
    ? `<p style="margin:22px 0"><a href="${echapper(lien)}" style="display:inline-block;background:#1f5eff;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">${echapper(libelleLien)}</a></p>`
    : '';
  return `<div style="background:#f4f6fb;padding:28px 14px;font-family:Arial,Helvetica,sans-serif;color:#1c2333;font-size:15px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 26px">
    <p style="margin:0 0 20px;font-weight:bold;font-size:18px">${echapper(entreprise)}</p>
    ${paragraphes}${bouton}
  </div>
  <p style="max-width:560px;margin:14px auto 0;font-size:12px;color:#8a91a3;text-align:center">Envoyé avec Devizo · devis et factures pour artisans · devizo-app.fr</p>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reponse(405, { erreur: 'Méthode non autorisée' });

  // 1. Qui envoie ?
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
  const a = String(corps.a ?? '').trim();
  const objet = String(corps.objet ?? '').trim();
  const message = String(corps.message ?? '').trim();
  const entreprise = String(corps.entreprise ?? '').trim().slice(0, 80) || 'Votre artisan';
  const repondreA = String(corps.repondreA ?? '').trim() || user.email || '';
  const piece = corps.pieceJointe as { nom?: string; base64?: string } | undefined;
  const jetonPartage = corps.jetonPartage ? String(corps.jetonPartage) : null;

  // 2. Contrôles
  if (!emailValide(a)) return reponse(400, { erreur: "L'adresse e-mail du client n'est pas valide." });
  if (!objet || objet.length > 200) return reponse(400, { erreur: "Indiquez un objet (200 caractères au plus)." });
  if (!message || message.length > 6000) return reponse(400, { erreur: 'Le message est vide ou trop long.' });
  if (piece && (!piece.base64 || piece.base64.length > 4_000_000 || !/^[\w .,()'-]+\.pdf$/i.test(piece.nom ?? ''))) {
    return reponse(400, { erreur: 'La pièce jointe doit être un PDF de moins de 3 Mo.' });
  }

  const espace = await espaceAutorise(user.id);
  if (!espace) return reponse(403, { erreur: "L'envoi par e-mail est inclus dans les formules Pro et Entreprise." });

  const depuis = new Date(Date.now() - 86400000).toISOString();
  const { count } = await admin.from('emails_envoyes').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).gte('envoye_le', depuis);
  if ((count ?? 0) >= LIMITE_JOUR) {
    return reponse(429, { erreur: `Limite de ${LIMITE_JOUR} e-mails par jour atteinte. Réessayez demain.` });
  }

  // 3. Lien de signature : seulement un partage de cet espace.
  let lien: string | null = null;
  if (jetonPartage) {
    const { data: p } = await admin.from('partages').select('jeton').eq('jeton', jetonPartage).eq('proprietaire', espace).maybeSingle();
    if (!p) return reponse(400, { erreur: 'Lien de signature introuvable.' });
    lien = `${SITE}/signer.html?j=${p.jeton}`;
  }

  // 4. Envoi par Brevo
  const cle = Deno.env.get('BREVO_API_KEY');
  if (!cle) return reponse(500, { erreur: "L'envoi d'e-mails n'est pas encore configuré (clé Brevo manquante)." });
  const envoi = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': cle, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: `${entreprise} via Devizo`.slice(0, 70), email: EXPEDITEUR },
      to: [{ email: a }],
      replyTo: emailValide(repondreA) ? { email: repondreA, name: entreprise } : undefined,
      subject: objet,
      htmlContent: corpsHtml(message, entreprise, lien, 'Voir et signer le devis'),
      textContent: message + (lien ? `\n\nVoir et signer le devis : ${lien}` : '') + '\n\n--\nEnvoyé avec Devizo · devizo-app.fr',
      attachment: piece ? [{ name: piece.nom, content: piece.base64 }] : undefined,
    }),
  });
  if (!envoi.ok) {
    console.error('Brevo', envoi.status, await envoi.text());
    return reponse(502, { erreur: "L'e-mail n'a pas pu partir. Réessayez dans quelques minutes." });
  }

  await admin.from('emails_envoyes').insert({ user_id: user.id, destinataire: a, objet });
  return reponse(200, { envoye: true, lien });
});
