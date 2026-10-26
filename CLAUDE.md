# Devizo

Logiciel de devis et factures pour artisans du bâtiment et auto-entrepreneurs.
Site : https://devizo-app.fr (GitHub Pages, publié à chaque push sur la branche de travail).

## Le propriétaire

- Il parle **français** : toujours répondre en français, simplement, sans jargon. Il préfère des explications simples et travaille souvent sur iPhone.
- Il veut des fichiers et des textes **envoyés directement** (images, texte prêt à copier-coller), pas de zip.
- Ton : chaleureux, phrases courtes, étapes numérotées quand il doit faire quelque chose lui-même.

## Règles à ne jamais enfreindre

- Ne jamais lui demander d'envoyer une clé secrète (`sk_…`, `whsec_…`, `xkeysib-…`, `xsmtpsib-…`, la clé `service_role`, le secret client Google). Elles se collent uniquement dans Supabase. La clé `anon`, les liens de paiement Stripe et la balise Search Console peuvent être partagés.
- Le seul projet Supabase de Devizo est `ryiqhstcshbqvuldfhok` (Paris, eu-west-3) : ne jamais agir sur un autre projet Supabase, ni sur le compte Stripe de son autre site.
- Pas de faux chiffres, faux avis, faux témoignages, ni de fausses infos légales (les infos de la SASU restent `[à compléter]` tant qu'il ne les a pas données).
- Pas de collecte automatique (scraping) ni d'envoi d'e-mails en masse à des artisans.
- Base de données : lecture seule par défaut ; toute modification (SQL, migration, fonction) seulement avec son accord.
- Ne jamais mettre le nom d'un modèle d'IA dans les commits ou le code.

## Structure

- Site statique en JavaScript sans framework, navigation par `#/…` (hash).
- `index.html` accueil · `app.html` l'appli · `admin.html` · `signer.html` (signature client) · pages légales `cgv.html`, `mentions-legales.html`, `confidentialite.html` · `charte.html` (charte graphique, non indexée).
- `js/app.js` : cœur de l'appli (rendu des pages, devis, factures, navigation). Autres modules : `compte.js` (connexion, Google), `dashboard.js`, `pdf.js`, `envoi.js`, `parrainage.js`, `stats.js`, `traduction.js`…
- `css/tokens.css` : **la charte graphique** (toutes les valeurs). `css/style.css` : composants de l'appli. `landing.css`, `seo.css`, `admin.css`, `signer.css`, `legal.css`.
- `fonts/` : Inter et Bricolage Grotesque hébergées sur le site.
- Pages SEO **générées** : ne pas modifier à la main `devis-facture-*.html`, `guide-*.html`, `devis-gratuit.html`, `calcul-tva-travaux.html`, `simulateur-*.html`, `verifier-siret.html`, `404.html`, `sitemap.xml`. Modifier `outils/seo/metiers.py`, `guides.py`, `outils_gratuits.py` ou `generer.py`, puis régénérer.
- `js/langues/` : traductions de l'appli (10 langues). Les textes ajoutés après coup vont dans `js/langues/app-plus.js`, dans les 9 blocs de langue.
- `supabase/` : SQL (RLS, fonctions RPC) et `functions/` (fonctions edge : `stripe-webhook`, `envoyer-email`, `emails-essai`, `admin`).

## Charte graphique (à respecter dans tout nouveau code)

- Jamais de valeur en dur : tailles `--fs-*`, espacements `--sp-*` (grille de 4 px), arrondis `--r-*`, hauteurs `--h-*`, largeurs `--w-*`, ombres `--sh-*`, couleurs de rôle (`--primary`, `--text`, `--text-2`, `--muted`, `--bg`, `--card`, `--border`, `--success`, `--warning`, `--danger`…).
- Polices : `--font-sans` (Inter) partout, `--font-display` (Bricolage) pour les grands titres du site public.
- Icônes : SVG Lucide en ligne, classe `.ico` (20 px, trait 1,8, `currentColor`).
- Points de rupture : téléphone ≤ 760 px (barre d'onglets en bas + menu « Plus »), tablette 761–1099 px (rail d'icônes), ordinateur ≥ 1100 px (barre latérale). La mise en page de l'appli est limitée à `body.app-shell`.
- Sur téléphone : cibles tactiles de 44 px minimum, champs en 16 px (sinon l'iPhone zoome), fenêtres en volet qui monte du bas.
- Toujours vérifier le mode sombre.

## Commandes utiles

- Nouvelle version (obligatoire avant de publier un changement CSS/JS) : `bash outils/nouvelle-version.sh`
- Captures d'écran de l'appli avec de fausses données : `node outils/tests/captures.mjs --sortie captures --menu --sombre`
  (options `--pages dashboard,documents`, `--ecrans tel,tab,pc`). « ERREURS [] » = aucune erreur JavaScript.
- Régénérer les pages SEO seules : `python3 outils/seo/generer.py <version>`

## Commits

Messages en français, clairs. Terminer par les lignes d'attribution demandées par la session.
