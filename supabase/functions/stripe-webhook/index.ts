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

// Produit « Devizo Solo » ou « Devizo Pro » : métadonnée formule=solo|pro,
// à défaut le nom du produit.
function formuleDe(sub: Stripe.Subscription): 'solo' | 'pro' {
  const produit = sub.items.data[0]?.price?.product as Stripe.Product | string | undefined;
  if (produit && typeof produit === 'object') {
    const meta = produit.metadata?.formule;
    if (meta === 'solo' || meta === 'pro') return meta;
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
    stripe_client: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripe_abonnement: sub.id,
    mis_a_jour: new Date().toISOString(),
  });
  if (error) throw new Error('Enregistrement impossible : ' + error.message);
  console.log(`Abonnement ${sub.id} : ${sub.status} (${formuleDe(sub)}) pour ${uid}`);
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
    console.error(err);
    // Stripe renverra l'événement plus tard.
    return new Response('Erreur de traitement', { status: 500 });
  }

  return new Response(JSON.stringify({ recu: true }), { headers: { 'Content-Type': 'application/json' } });
});
