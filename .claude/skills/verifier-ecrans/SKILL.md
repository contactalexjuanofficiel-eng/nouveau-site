---
name: verifier-ecrans
description: Photographier l'appli Devizo sur téléphone, tablette et ordinateur (clair et sombre) avec de fausses données, puis repérer les problèmes d'affichage et les erreurs JavaScript. À utiliser après toute modification visuelle, avant de publier.
---

# Vérifier l'affichage sur tous les écrans

1. Lancer les captures (aucune connexion à la vraie base, les données sont fausses) :
   ```
   node outils/tests/captures.mjs --sortie captures --menu --sombre
   ```
   - Pour aller plus vite, ne garder que les pages concernées : `--pages dashboard,documents,devis-edit`.
   - Pages disponibles : dashboard, documents, devis-edit, devis-voir, clients, client-fiche, depenses, catalogue, entreprise, compte, abonnement, assistance, parrainage, export.
   - Écrans : `--ecrans tel,tab,pc` (390, 820 et 1440 px de large).
2. La dernière ligne doit être `ERREURS []`. Sinon, corriger chaque erreur JavaScript affichée.
3. Ouvrir les images avec l'outil Read et contrôler :
   - **Débordements** : texte coupé, éléments qui sortent d'une carte, défilement horizontal.
   - **Navigation** :
     - téléphone : barre d'onglets en bas, menu « Plus » lisible et non grisé ;
     - tablette : rail d'icônes ;
     - ordinateur : barre latérale.
   - **Alignements** : espacements réguliers, boutons de même hauteur sur une même ligne.
   - **Mode sombre** : aucun fond blanc, texte assez contrasté.
   - **Écran de connexion** (`00-connexion-*`).
4. Pour une capture avec un geste (glisser, toucher), écrire un petit script Playwright à part. Utiliser une session CDP et `Input.dispatchTouchEvent`.
5. Le site public (index.html, pages SEO, admin.html) n'est pas couvert par ce script. Pour ces pages, une capture Playwright simple suffit : le script sert déjà le site, s'en inspirer.
6. Envoyer au propriétaire 3 à 5 captures représentatives avec SendUserFile, sans les zipper.
