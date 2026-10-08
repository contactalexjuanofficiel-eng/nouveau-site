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
    soloMois: '',
    soloAn: '',
    proMois: '',
    proAn: '',
    // Espace client Stripe (Paramètres > Facturation > Portail client) : changer de
    // carte, de formule, télécharger les factures, résilier.
    portail: '',
  },
};
