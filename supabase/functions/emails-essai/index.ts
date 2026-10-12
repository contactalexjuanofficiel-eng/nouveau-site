// Fonction Supabase « emails-essai » : e-mails automatiques pendant l'essai gratuit.
//
//   - « bienvenue »     : dans les heures qui suivent l'inscription (e-mail confirmé)
//   - « j-3 »           : quand il reste 3 jours d'essai ou moins
//   - « dernier-jour »  : le dernier jour de l'essai
//
// Appelée toutes les heures par pg_cron (voir supabase/emails-essai.sql). Elle
// n'envoie chaque e-mail qu'une fois par personne (table emails_auto), jamais à
// un abonné payant, à un membre d'équipe ou à un compte avec une formule offerte,
// et seulement entre 8 h et 20 h (heure de Paris). L'appeler plusieurs fois ne
// renvoie donc rien de plus : elle peut rester publique (« Verify JWT » désactivé).
//
// GET ?stop=<id>&k=<clé> : désinscription (lien en bas de chaque e-mail).
// Secrets utilisés : BREVO_API_KEY (déjà en place). Facultatif : SITE_URL, EXPEDITEUR.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const URL_SUPABASE = Deno.env.get('SUPABASE_URL') ?? '';
const CLE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const admin = createClient(URL_SUPABASE, CLE_SERVICE, { auth: { persistSession: false } });
const SITE = (Deno.env.get('SITE_URL') ?? 'https://devizo-app.fr').replace(/\/$/, '');
const EXPEDITEUR = Deno.env.get('EXPEDITEUR') ?? 'contact@devizo-app.fr';
const ESSAI_JOURS = 14;
const JOUR = 86400000;
const MAX_PAR_PASSAGE = 100;

const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Clé de désinscription : HMAC de l'identifiant, impossible à deviner sans la clé du serveur.
async function cleDesinscription(id: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(CLE_SERVICE), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('stop:' + id)));
  return [...sig.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function page(titre: string, texte: string, status = 200) {
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${echapper(titre)}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f4f6fb;color:#1c2333;padding:40px 16px"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
<p style="font-weight:bold;color:#1f5eff;font-size:18px;margin:0 0 16px">Devizo</p><h1 style="font-size:20px;margin:0 0 10px">${echapper(titre)}</h1><p style="line-height:1.55">${echapper(texte)}</p>
<p><a href="${SITE}/app.html" style="color:#1f5eff">Ouvrir Devizo</a></p></div></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function heureParis() {
  return Number(new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', hour12: false, timeZone: 'Europe/Paris' }).format(new Date()));
}

type Contenu = { objet: string; titre: string; paragraphes: string[]; bouton: [string, string]; ps?: string };

function contenu(type: string, finEssai: number): Contenu {
  const date = new Date(finEssai).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
  if (type === 'bienvenue') {
    return {
      objet: 'Bienvenue sur Devizo 👋',
      titre: 'Bienvenue sur Devizo !',
      paragraphes: [
        `Votre essai gratuit de 14 jours a commencé : vous avez accès à tout jusqu'au ${date}, sans carte bancaire.`,
        'Pour bien démarrer, trois étapes suffisent :',
        '1. Complétez « Mon entreprise » (SIRET, adresse, TVA, assurance) : vos documents seront conformes.',
        "2. Ajoutez votre premier client, ou créez-le directement depuis le devis.",
        '3. Faites votre premier devis et envoyez-le par e-mail : votre client peut le signer en ligne.',
        "Astuce : ajoutez Devizo à l'écran d'accueil de votre téléphone pour l'ouvrir comme une appli, même sur un chantier sans réseau.",
      ],
      bouton: ['Faire mon premier devis', `${SITE}/app.html#/documents`],
      ps: 'Une question ? Répondez simplement à cet e-mail, ou utilisez la page « Assistance » de l\'appli.',
    };
  }
  if (type === 'j-3') {
    return {
      objet: 'Plus que 3 jours d\'essai gratuit',
      titre: 'Votre essai se termine bientôt',
      paragraphes: [
        `Votre essai gratuit de Devizo se termine le ${date}.`,
        "Pour continuer à faire vos devis et vos factures sans interruption, choisissez la formule qui vous convient : Solo à 9 € HT par mois, Pro à 19 € HT ou Entreprise à 39 € HT. L'abonnement annuel vous offre 2 mois.",
        "Sans abonnement, rien n'est perdu : vos documents restent consultables, mais vous ne pourrez plus en créer de nouveaux.",
      ],
      bouton: ['Choisir ma formule', `${SITE}/app.html#/abonnement`],
      ps: "Sans engagement : vous arrêtez quand vous voulez, depuis l'appli.",
    };
  }
  return {
    objet: "Votre essai Devizo se termine aujourd'hui",
    titre: "Dernier jour d'essai gratuit",
    paragraphes: [
      "Votre essai gratuit de Devizo se termine aujourd'hui.",
      'Pour garder vos devis, vos factures, vos relances et votre tableau de bord sans interruption, choisissez une formule en deux minutes. Le paiement se fait par carte, en toute sécurité avec Stripe.',
      "Vos données restent conservées : vous pourrez toujours les consulter et vous abonner plus tard.",
    ],
    bouton: ['Continuer avec Devizo', `${SITE}/app.html#/abonnement`],
    ps: "Une question avant de vous décider ? Répondez simplement à cet e-mail.",
  };
}

function html(c: Contenu, lienStop: string) {
  const p = c.paragraphes.map((t) => `<p style="margin:0 0 14px;line-height:1.55">${echapper(t)}</p>`).join('');
  return `<div lang="fr" style="background:#f4f6fb;padding:28px 14px;font-family:Arial,Helvetica,sans-serif;color:#1c2333;font-size:15px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 26px">
    <p style="margin:0 0 20px;font-weight:bold;font-size:18px;color:#1f5eff">Devizo</p>
    <h1 style="margin:0 0 16px;font-size:21px">${echapper(c.titre)}</h1>
    ${p}
    <p style="margin:22px 0"><a href="${echapper(c.bouton[1])}" style="display:inline-block;background:#1f5eff;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">${echapper(c.bouton[0])}</a></p>
    ${c.ps ? `<p style="margin:0;color:#6b7385;font-size:14px">${echapper(c.ps)}</p>` : ''}
  </div>
  <p style="max-width:560px;margin:14px auto 0;font-size:12px;color:#8a91a3;text-align:center">Devizo · devis et factures pour artisans · devizo-app.fr<br>
    Vous recevez cet e-mail car vous avez créé un compte Devizo. <a href="${echapper(lienStop)}" style="color:#8a91a3">Ne plus recevoir ces conseils</a></p>
</div>`;
}

function texte(c: Contenu, lienStop: string) {
  return [c.titre, '', ...c.paragraphes, '', `${c.bouton[0]} : ${c.bouton[1]}`, '', c.ps ?? '', '', '--', 'Devizo · devizo-app.fr', `Ne plus recevoir ces conseils : ${lienStop}`].join('\n');
}

async function envoyer(email: string, c: Contenu, lienStop: string) {
  const cle = Deno.env.get('BREVO_API_KEY');
  if (!cle) throw new Error('BREVO_API_KEY manquante');
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': cle, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Devizo', email: EXPEDITEUR },
      to: [{ email }],
      replyTo: { email: 'devizocontact@gmail.com', name: 'Devizo' },
      subject: c.objet,
      htmlContent: html(c, lienStop),
      textContent: texte(c, lienStop),
      headers: { 'List-Unsubscribe': `<${lienStop}>` },
    }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status} ${await r.text()}`);
}

async function tousLesUtilisateurs() {
  const liste: { id: string; email?: string; created_at: string; email_confirmed_at?: string | null }[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    liste.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return liste;
}

// Adresse publique de cette fonction, quel que soit le nom choisi au déploiement.
let adresseFonction = `${URL_SUPABASE}/functions/v1/emails-essai`;

async function passage() {
  const heure = heureParis();
  if (heure < 8 || heure >= 20) return { envoyes: 0, raison: 'hors des heures d\'envoi (8 h – 20 h)' };

  const [utilisateurs, abos, membres, deja, refus] = await Promise.all([
    tousLesUtilisateurs(),
    admin.from('abonnements').select('user_id, formule, statut, fin_periode, offert'),
    admin.from('membres').select('membre').not('membre', 'is', null),
    admin.from('emails_auto').select('user_id, type'),
    admin.from('emails_auto_refus').select('user_id'),
  ]);
  for (const r of [abos, membres, deja, refus]) if (r.error) throw r.error;

  const aboDe = new Map((abos.data ?? []).map((a) => [a.user_id, a]));
  const estMembre = new Set((membres.data ?? []).map((m) => m.membre));
  const envoyes = new Set((deja.data ?? []).map((d) => `${d.user_id}:${d.type}`));
  const stop = new Set((refus.data ?? []).map((r) => r.user_id));
  const maintenant = Date.now();
  const bilan: string[] = [];

  for (const u of utilisateurs) {
    if (bilan.length >= MAX_PAR_PASSAGE) break;
    if (!u.email || !u.email_confirmed_at || stop.has(u.id) || estMembre.has(u.id)) continue;
    const a = aboDe.get(u.id);
    const enCours = a && ['active', 'trialing', 'past_due'].includes(a.statut) && (!a.fin_periode || Date.parse(a.fin_periode) > maintenant - 3 * JOUR);
    if (enCours && a.offert !== 'essai') continue; // abonné payant ou formule offerte
    const cree = Date.parse(u.created_at);
    const finEssai = Math.max(cree + ESSAI_JOURS * JOUR, a?.offert === 'essai' && a.fin_periode ? Date.parse(a.fin_periode) : 0);
    const reste = finEssai - maintenant;
    if (reste <= 0) continue;

    let type = '';
    if (reste <= JOUR) type = 'dernier-jour';
    else if (reste <= 3 * JOUR) type = 'j-3';
    else if (maintenant - cree <= 3 * JOUR) type = 'bienvenue';
    if (!type || envoyes.has(`${u.id}:${type}`)) continue;

    // On réserve l'envoi d'abord : si deux passages se croisent, un seul gagne.
    const { error: dejaPris } = await admin.from('emails_auto').insert({ user_id: u.id, type });
    if (dejaPris) continue;
    const lienStop = `${adresseFonction}?stop=${u.id}&k=${await cleDesinscription(u.id)}`;
    try {
      await envoyer(u.email, contenu(type, finEssai), lienStop);
      bilan.push(`${type} → ${u.email}`);
    } catch (e) {
      console.error('Envoi impossible', u.email, String(e));
      await admin.from('emails_auto').delete().eq('user_id', u.id).eq('type', type); // on réessaiera
    }
  }
  return { envoyes: bilan.length, detail: bilan };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const nom = url.pathname.split('/').filter(Boolean).pop();
  if (nom && /^[a-z0-9-]+$/.test(nom)) adresseFonction = `${URL_SUPABASE}/functions/v1/${nom}`;
  if (req.method === 'GET' && url.searchParams.has('stop')) {
    const id = url.searchParams.get('stop') ?? '';
    const k = url.searchParams.get('k') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(id) || k !== (await cleDesinscription(id))) {
      return page('Lien invalide', "Ce lien de désinscription n'est pas valable.", 400);
    }
    await admin.from('emails_auto_refus').upsert({ user_id: id });
    return page('C\'est noté', 'Vous ne recevrez plus les e-mails de conseils de Devizo. Les e-mails liés à votre compte (mot de passe, paiements) continueront de vous parvenir.');
  }
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 });
  try {
    const res = await passage();
    return new Response(JSON.stringify(res), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ erreur: 'Passage impossible : voir les logs de la fonction.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
