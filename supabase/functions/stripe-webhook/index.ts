// Fonction Supabase « stripe-webhook » : reçoit les événements de Stripe et
// enregistre l'abonnement de chaque compte dans la table « abonnements ».
//
// Secrets à définir dans Supabase (Edge Functions > Secrets) :
//   STRIPE_SECRET_KEY      clé secrète Stripe (sk_test_... puis sk_live_...)
//   STRIPE_WEBHOOK_SECRET  secret de signature du webhook (whsec_...)
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.
//
// À déployer avec « Enforce JWT verification » désactivé : Stripe n'envoie pas
// de jeton Supabase ; la sécurité vient de la signature Stripe vérifiée ici.

import Stripe from 'npm:stripe@14.25.0';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

// Produit « Devizo Solo », « Devizo Pro » ou « Devizo Équipe » : métadonnée
// formule=solo|pro|equipe, à défaut le nom du produit.
type Formule = 'solo' | 'pro' | 'equipe';
function formuleDe(sub: Stripe.Subscription): Formule {
  const produit = sub.items.data[0]?.price?.product as Stripe.Product | string | undefined;
  if (produit && typeof produit === 'object') {
    const meta = produit.metadata?.formule;
    if (meta === 'solo' || meta === 'pro' || meta === 'equipe') return meta;
    if (/[ée]quipe/i.test(produit.name ?? '')) return 'equipe';
    if (/solo/i.test(produit.name ?? '')) return 'solo';
  }
  return 'pro';
}

async function lireAbonnement(id: string): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.retrieve(id, { expand: ['items.data.price.product'] });
}

async function enregistrer(sub: Stripe.Subscription, userId?: string | null) {
  let uid = userId || sub.metadata?.user_id || null;
  if (!uid) {
    // Abonnement déjà connu (changement de formule, renouvellement, résiliation).
    const { data } = await admin.from('abonnements').select('user_id').eq('stripe_abonnement', sub.id).maybeSingle();
    uid = data?.user_id ?? null;
  }
  if (!uid) {
    console.log(`Abonnement ${sub.id} sans compte associé pour l'instant : ignoré.`);
    return;
  }
  const { error } = await admin.from('abonnements').upsert({
    user_id: uid,
    formule: formuleDe(sub),
    statut: sub.status,
    fin_periode: new Date(sub.current_period_end * 1000).toISOString(),
    // Résilié « à la fin de la période » : reste actif jusque-là, sans renouvellement.
    fin_prevue: Boolean(sub.cancel_at_period_end || sub.cancel_at),
    stripe_client: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripe_abonnement: sub.id,
    mis_a_jour: new Date().toISOString(),
  });
  if (error) throw new Error('Enregistrement impossible : ' + error.message);
  console.log(`Abonnement ${sub.id} : ${sub.status} (${formuleDe(sub)}) pour ${uid}`);
  if (sub.status === 'active') await recompenserParrain(uid);
}

// Parrainage : quand un filleul paie pour la première fois, son parrain gagne
// 1 mois offert (12 au maximum par an). S'il paie déjà par Stripe, le mois est
// déduit de sa prochaine facture ; sinon son essai (ou sa formule offerte) est
// prolongé de 30 jours.
const PRIX_MOIS_TTC: Record<Formule, number> = { solo: 1080, pro: 2280, equipe: 4680 }; // en centimes
const MAX_PAR_AN = 12;

async function recompenserParrain(filleul: string) {
  // Une seule récompense par filleul : la ligne est « réservée » d'un coup.
  const { data: pris, error } = await admin.from('parrainages')
    .update({ recompense_le: new Date().toISOString() })
    .eq('filleul', filleul).is('recompense_le', null)
    .select('parrain');
  if (error) { console.error('Parrainage illisible', error.message); return; }
  const parrain = pris?.[0]?.parrain as string | undefined;
  if (!parrain) return; // pas de parrain, ou déjà récompensé
  const noter = (recompense: string) => admin.from('parrainages').update({ recompense }).eq('filleul', filleul);
  try {
    const { count } = await admin.from('parrainages').select('filleul', { count: 'exact', head: true })
      .eq('parrain', parrain).in('recompense', ['credit', 'essai', 'offre'])
      .gte('recompense_le', new Date(Date.now() - 365 * 86400000).toISOString());
    if ((count ?? 0) >= MAX_PAR_AN) { await noter('plafond'); console.log(`Parrain ${parrain} : plafond annuel atteint.`); return; }

    const { data: a } = await admin.from('abonnements').select('formule, statut, offert, stripe_client, stripe_abonnement').eq('user_id', parrain).maybeSingle();
    if (a?.stripe_client && a.stripe_abonnement && !a.offert && ['active', 'trialing', 'past_due'].includes(a.statut)) {
      const formule = (a.formule in PRIX_MOIS_TTC ? a.formule : 'pro') as Formule;
      await stripe.customers.createBalanceTransaction(a.stripe_client, {
        amount: -PRIX_MOIS_TTC[formule],
        currency: 'eur',
        description: 'Parrainage Devizo : 1 mois offert',
      });
      await noter('credit');
      console.log(`Parrain ${parrain} : 1 mois déduit de sa prochaine facture.`);
    } else {
      const { data: type, error: e2 } = await admin.rpc('parrainage_prolonger', { p: parrain });
      if (e2) throw new Error(e2.message);
      await noter(String(type));
      console.log(`Parrain ${parrain} : 1 mois offert (${type}).`);
    }
  } catch (err) {
    // On libère la ligne : la récompense sera retentée au prochain événement de ce filleul.
    console.error('Récompense de parrainage impossible', err);
    await admin.from('parrainages').update({ recompense_le: null, recompense: null }).eq('filleul', filleul);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 });
  const signature = req.headers.get('stripe-signature');
  const corps = await req.text();
  let evenement: Stripe.Event;
  try {
    evenement = await stripe.webhooks.constructEventAsync(
      corps, signature ?? '', Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '', undefined, cryptoProvider,
    );
  } catch (err) {
    console.error('Signature Stripe invalide', err);
    return new Response('Signature invalide', { status: 400 });
  }

  try {
    switch (evenement.type) {
      case 'checkout.session.completed': {
        const session = evenement.data.object as Stripe.Checkout.Session;
        // client_reference_id = identifiant du compte Devizo, ajouté au lien de paiement.
        if (session.mode === 'subscription' && session.subscription && session.client_reference_id) {
          const id = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
          // On garde le compte dans l'abonnement pour les événements suivants.
          await stripe.subscriptions.update(id, { metadata: { user_id: session.client_reference_id } });
          await enregistrer(await lireAbonnement(id), session.client_reference_id);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = evenement.data.object as Stripe.Subscription;
        await enregistrer(await lireAbonnement(sub.id));
        break;
      }
      default:
        break;
    }
  } catch (err) {
    // Abonnement inexistant (par exemple un « événement de test » envoyé depuis Stripe) : rien à enregistrer.
    if ((err as { code?: string })?.code === 'resource_missing') {
      console.log('Abonnement introuvable chez Stripe (événement de test ?) : ignoré.');
      return new Response(JSON.stringify({ recu: true, ignore: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    console.error(err);
    // Stripe renverra l'événement plus tard.
    return new Response('Erreur de traitement', { status: 500 });
  }

  return new Response(JSON.stringify({ recu: true }), { headers: { 'Content-Type': 'application/json' } });
});
