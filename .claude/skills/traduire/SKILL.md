---
name: traduire
description: Ajouter les traductions des nouveaux textes de l'appli Devizo dans les 9 langues (en, es, pt, it, de, ar, tr, ro, pl). À utiliser chaque fois qu'un texte visible est ajouté ou modifié dans l'appli.
---

# Traduire un nouveau texte de l'appli

- **Fonctionnement** : `js/traduction.js` remplace automatiquement chaque texte français de la page par sa traduction. Sont traduits le texte et les attributs `placeholder`, `title`, `aria-label` et `data-label`.
- **Ce qui ne se traduit jamais** : les devis, les factures et les avoirs (zone `.doc`), car la loi impose le français. Tout élément marqué `data-no-trad` non plus.

## Étapes
1. Repérer les nouveaux textes **exacts**, avec la ponctuation et les espaces.
2. Ajouter les traductions dans `js/langues/app-plus.js`, dans **chacun des 9 blocs** (`en:`, `es:`, `pt:`, `it:`, `de:`, `ar:`, `tr:`, `ro:`, `pl:`), sous un commentaire indiquant la fonctionnalité. Exemple :
   ```js
   // Parrainage
   "Parrainage": "Referral",
   ```
3. Pour un texte avec une valeur variable, utiliser `{0}`, `{1}`, comme dans les entrées existantes (`'Payée le {0}': 'Paid on {0}'`).
4. Avant d'ajouter, vérifier que la clé n'existe pas déjà : `grep -n '"Mon texte"' js/langues/*.js`.
5. Vérifier la syntaxe : `node --check js/langues/app-plus.js`.
6. Pour l'arabe, le sens de lecture de droite à gauche est géré automatiquement. Garder des traductions courtes pour les boutons et les menus.
