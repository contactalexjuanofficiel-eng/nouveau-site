/*
 * Configuration des comptes en ligne (Supabase).
 * Collez ici l'adresse du projet et la clé publique « anon », trouvées dans
 * Supabase : Project Settings > API. La clé « anon » est faite pour être
 * publique : la sécurité est assurée par les règles de la base (voir
 * supabase/schema.sql). Ne mettez JAMAIS la clé « service_role » ici.
 *
 * Laissés vides, le site fonctionne sans compte : les données restent
 * seulement sur l'appareil.
 */
window.DEVIZO_CONFIG = {
  supabaseUrl: 'https://ryiqhstcshbqvuldfhok.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5aXFoc3Rjc2hicXZ1bGRmaG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0ODkzOTIsImV4cCI6MjEwNzA2NTM5Mn0.qvUr4p_pg-BrMcAevc0LVTK0BQfe1ZcxcPVhLaSpjZY',
  // Liens de paiement Stripe (Stripe > Liens de paiement), un par formule.
  // Vides : le paiement est affiché « bientôt disponible ».
  stripe: {
    soloMois: 'https://buy.stripe.com/4gM5kvdJOgj5fb0a7N2ZO00',
    soloAn: 'https://buy.stripe.com/8x28wH5dieaXbYOeo32ZO01',
    proMois: 'https://buy.stripe.com/eVq5kv5di3wje6W93J2ZO02',
    proAn: 'https://buy.stripe.com/14A9AL5di2sfbYO2Fl2ZO03',
    equipeMois: 'https://buy.stripe.com/8x200b0X27Mz9QG7ZF2ZO04',
    equipeAn: 'https://buy.stripe.com/6oUeV5bBG6Ive6W7ZF2ZO05',
    // Espace client Stripe (Paramètres > Facturation > Portail client) : changer de
    // carte, de formule, télécharger les factures, résilier.
    portail: 'https://billing.stripe.com/p/login/4gM5kvdJOgj5fb0a7N2ZO00',
  },
};
