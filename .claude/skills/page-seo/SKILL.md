---
name: page-seo
description: Créer ou modifier une page de référencement Google de Devizo (page métier « devis et factures pour X », guide pratique, outil gratuit) via le générateur Python. À utiliser pour tout travail SEO sur le site public.
---

# Pages de référencement (SEO)

Les pages sont **générées** par `outils/seo/generer.py`. On ne modifie jamais le HTML produit à la main.

| Type | Données | Fichier produit |
|---|---|---|
| Métier | `outils/seo/metiers.py` (liste `METIERS`, clé `slug`) | `devis-facture-<slug>.html` |
| Guide | `outils/seo/guides.py` (liste `GUIDES`, clé `fichier`) | `guide-*.html` |
| Outil gratuit | `outils/seo/outils_gratuits.py` (+ le code dans `js/outils.js`) | `calcul-tva-travaux.html`… |

Le générateur produit aussi `devis-gratuit.html`, `404.html`, les liens entre pages et `sitemap.xml`.

## Étapes
1. Copier une entrée existante du même type et l'adapter. Champs principaux : `titre` (60 caractères maximum), `description` (155 maximum), `h1`, `lead`, sections, `faq`.
2. **Contenu** :
   - français simple ;
   - règles juridiques et fiscales rédigées prudemment, avec un renvoi vers la source officielle (impots.gouv.fr, urssaf.fr, service-public.fr) ;
   - pas de chiffres inventés sur Devizo (nombre de clients, avis…).
3. Régénérer avec `bash outils/nouvelle-version.sh`, qui régénère aussi le SEO.
4. Contrôler la page :
   - un seul `<h1>` ;
   - `<link rel="canonical">` présent ;
   - la page apparaît dans `sitemap.xml`.
5. Publier avec le skill `publier`.
6. Dire au propriétaire de demander l'indexation dans Google Search Console :
   - Inspection de l'URL ;
   - coller l'adresse de la page ;
   - « Demander une indexation ».
