---
name: publier
description: Publier une modification du site Devizo en ligne (nouvelle version des fichiers, vérifications, commit, push, contrôle du déploiement GitHub Pages). À utiliser dès qu'un changement est prêt à partir sur devizo-app.fr.
---

# Publier sur devizo-app.fr

1. **Nouvelle version** : `bash outils/nouvelle-version.sh`. Le script ajoute 1 au numéro `?v=N` partout, régénère les pages SEO et vérifie la syntaxe de tous les fichiers JS. S'il échoue, corriger avant d'aller plus loin.
2. **Captures** : si le changement touche l'affichage (CSS, HTML, rendu JS), lancer le skill `verifier-ecrans` et regarder les images.
3. **Relire le diff** : `git diff --stat`, puis le détail. Pas de clé secrète, pas de faux chiffres, pas de modification à la main d'une page SEO générée.
4. **Commit** en français : un titre court, puis la liste des changements. Terminer par les lignes d'attribution de la session.
5. **Push** : `git push -u origin <branche de travail>`. En cas d'erreur réseau, réessayer après 2 s, 4 s, 8 s puis 16 s.
6. **Déploiement** : avec l'outil GitHub `actions_list` (`list_workflow_runs`), vérifier que « pages build and deployment » est en `success` sur le dernier commit. S'il reste « queued » plus de 10 minutes, un nouveau push le débloque.
7. **Message au propriétaire**, en français et en quelques lignes :
   - ce qui a changé ;
   - le lien à tester ;
   - sur iPhone, s'il voit encore l'ancienne version : recharger la page, ou fermer puis rouvrir l'appli installée.
