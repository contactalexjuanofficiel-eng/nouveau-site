#!/usr/bin/env bash
# Passe le site à la version suivante (?v=N sur les CSS/JS, pour que les
# navigateurs et l'appli installée téléchargent les nouveaux fichiers),
# régénère les pages SEO et vérifie la syntaxe de tous les fichiers JS.
#   bash outils/nouvelle-version.sh        → version actuelle + 1
#   bash outils/nouvelle-version.sh 120    → version 120
set -euo pipefail
cd "$(dirname "$0")/.."
actuelle=$(grep -oE 'style\.css\?v=[0-9]+' app.html | head -1 | grep -oE '[0-9]+$')
v=${1:-$((actuelle + 1))}
sed -i -E "s/\?v=[0-9]+/?v=$v/g" ./*.html js/pdf.js
python3 outils/seo/generer.py "$v"
for f in js/*.js js/langues/*.js; do node --check "$f"; done
echo "Version $actuelle → $v, syntaxe JS OK"
