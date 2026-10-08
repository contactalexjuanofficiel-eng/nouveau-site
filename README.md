# Devizo

Application de devis et factures pour artisans (plombiers, électriciens, peintres...).

## Lancer le site

Ouvrir `index.html` dans un navigateur, ou lancer un petit serveur local :

```bash
python3 -m http.server 8000
```

puis aller sur http://localhost:8000

## Fonctionnalités (version 1)

- Informations de l'entreprise (nom, SIRET, adresse, IBAN, TVA ou franchise de TVA)
- Gestion des clients
- Création de devis avec lignes de prestations, calcul automatique HT / TVA / TTC
- Transformation d'un devis en facture en un clic
- Numérotation automatique (D-2026-001, F-2026-001)
- Mentions légales obligatoires sur les factures
- Export PDF via l'impression du navigateur
- Tableau de bord : chiffre encaissé, factures à encaisser, devis en attente

Les données sont enregistrées dans le navigateur (localStorage) : rien n'est envoyé sur un serveur.

## Structure

- `index.html` : page de présentation
- `app.html` : l'application
- `js/app.js` : toute la logique
- `css/style.css` : le style

## Mettre à jour le site

Après chaque modification de `css/style.css` ou `js/app.js`, augmenter le numéro
`?v=` dans `app.html` et `index.html` pour que les navigateurs chargent la nouvelle version.

## Tableau de bord et dépenses

- `js/dashboard.js` : tableau de bord de gestion (ce qu'il reste après dépenses,
  cotisations et impôts, graphiques mois par mois et jour par jour, échéances,
  devis, plafonds micro et TVA, meilleurs clients) et page Dépenses.
- Les taux 2026 (micro-entreprise, impôt sur les sociétés) sont en haut du fichier.
  Ce sont des estimations : à vérifier chaque année sur urssaf.fr et impots.gouv.fr.
- `js/catalogue.js` : catalogue de prestations et de prix (page Catalogue,
  suggestions dans les lignes de devis, étoile pour enregistrer une ligne).
