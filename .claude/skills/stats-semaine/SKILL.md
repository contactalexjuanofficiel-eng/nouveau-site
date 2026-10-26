---
name: stats-semaine
description: Faire le bilan de la semaine de Devizo (visites, sources, parcours d'inscription, comptes créés, abonnés, alertes de sécurité) à partir de Supabase, en lecture seule, puis donner 3 actions concrètes. À utiliser quand le propriétaire demande « les stats » ou « l'analyse de la semaine ».
---

# Bilan de la semaine

**Projet Supabase** : `ryiqhstcshbqvuldfhok` uniquement, jamais un autre projet. Uniquement des requêtes `select` (outil `execute_sql`) : aucune écriture.

1. **Découvrir les tables** si besoin : `list_tables`. Les visites et le parcours d'inscription sont dans la table `public.visites` (remplie par `js/stats.js` via la fonction `compter_visite`, voir `supabase/admin.sql` et `supabase/parcours.sql`). Étapes (`accueil`, `app`, `clic-essai`, `clic-google`, `formulaire`, `pdf-gratuit`…).
2. **Mesurer** sur les 7 derniers jours, puis comparer avec la semaine précédente :
   - **Visites** de l'accueil et **sources** (direct, Google, Instagram, Facebook…).
   - **Parcours** : clics sur « essai », clics sur Google, formulaires ouverts, PDF gratuits téléchargés.
   - **Comptes créés** (`auth.users`), espaces actifs, **abonnements** (formule, statut).
   - **Parrainages** et **demandes d'assistance** en attente.
3. **Sécurité** : `get_advisors` (security et performance). Les signaler, sans rien corriger sans accord.
4. **Rendu au propriétaire** en français, court :
   - un tableau des chiffres clés avec les flèches ↑ ↓ ;
   - le goulot d'étranglement en une phrase (trafic, inscription ou passage au payant) ;
   - **3 actions concrètes** pour la semaine suivante.
5. **Ne rien inventer** : si une donnée manque, le dire.
