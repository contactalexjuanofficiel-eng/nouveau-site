---
name: charte
description: Règles de design de Devizo (jetons de css/tokens.css, composants, points de rupture, inspirations). À charger avant d'écrire ou de modifier du CSS ou du HTML d'interface, pour que tout nouvel écran ait le même niveau de finition que la refonte.
---

# Charte graphique Devizo

Source de vérité : `css/tokens.css`. Aperçu visuel : `charte.html`.

## Règle d'or
Aucune valeur en dur. Utiliser les variables :

- **Texte**
  - tailles : `--fs-2xs` 11, `--fs-xs` 12, `--fs-sm` 13, `--fs-md` 14 (boutons, champs), `--fs-base` 15 (texte courant), `--fs-lg` 17, `--fs-xl` 20 (titre de carte), `--fs-2xl` 24 (titre de page sur téléphone), `--fs-3xl` 30, `--fs-4xl` 36, `--fs-5xl` 48 ;
  - graisses `--fw-*`, interlignes `--lh-*`, approches `--tracking-*`.
- **Espacements** : `--sp-1` 4, `--sp-2` 8, `--sp-3` 12, `--sp-4` 16, `--sp-5` 20, `--sp-6` 24, `--sp-8` 32, `--sp-10` 40, `--sp-12` 48, `--sp-16` 64, `--sp-20` 80. Il n'existe pas de `--sp-7`, `--sp-3-5`…
- **Arrondis** : `--r-sm` 6 · `--r-md` 8 (boutons, champs) · `--r-lg` 12 · `--r-xl` 16 (cartes) · `--r-2xl` 20 (fenêtres) · `--r-full`.
- **Hauteurs** : `--h-sm` 34 · `--h-md` 40 (boutons, champs) · `--h-lg` 48 · `--touch` 44 (minimum tactile).
- **Largeurs** : `--w-page`, `--w-content`, `--w-narrow`, `--w-form`, `--w-dialog`, `--w-dialog-lg`, `--w-sidebar`.
- **Ombres** : `--sh-xs` (cartes) à `--sh-xl` (fenêtres).
- **Couches** : `--z-sticky`, `--z-dropdown`, `--z-nav`, `--z-overlay`, `--z-dialog`, `--z-toast`.
- **Animations** : `--dur-fast`, `--dur`, `--dur-slow`, `--ease`.
- **Couleurs** (uniquement les rôles) : `--primary`, `--primary-soft`, `--on-primary`, `--text`, `--text-2`, `--muted`, `--faint`, `--bg`, `--bg-2`, `--card`, `--field`, `--border`, `--border-strong`, `--success`, `--warning`, `--danger` et leurs versions `-soft`, `--overlay`, `--ring`. Elles basculent toutes seules en mode sombre.

## Composants existants (à réutiliser avant d'en créer)
- Boutons : `.btn`, `.btn-primary`, `.btn-sm`, `.btn-lg`, `.btn-danger`, `.btn-ok`.
- Mise en page : `.card`, `.grid-2`, `.stats`, `.panels`, `.page-head` (titre + actions).
- Données : `.table-wrap` + `table` (`td.num` pour les montants).
- Statuts : `.badge` + `.badge-brouillon`, `-envoye`, `-accepte`, `-payee`, `-a-payer`, `-retard`, `-refuse`, `-annulee`…
- Choix : `.periodes` + `.chip` (contrôle segmenté).
- Fenêtres : `dialog.ask` (devient un volet du bas sur téléphone), `.toast`.
- Icônes : SVG Lucide (copier le tracé depuis lucide.dev) avec `class="ico"` et `aria-hidden="true"`.

## Mise en page
- Téléphone ≤ 760 px :
  - barre d'onglets en bas et menu « Plus » en volet ;
  - cibles tactiles de 44 px minimum ;
  - champs en 16 px pour que l'iPhone ne zoome pas ;
  - les tableaux de saisie deviennent des fiches (voir `.lines`).
- Tablette 761–1099 px : rail d'icônes de 76 px.
- Ordinateur ≥ 1100 px : barre latérale de 252 px.
- Les règles de mise en page de l'appli commencent par `body.app-shell`, pour ne pas toucher l'admin.

## Inspirations (le niveau visé)
- **Stripe Dashboard et Linear** : la densité, les tableaux nets, les titres de colonnes en petites capitales.
- **Qonto, Pennylane, Shine** : la finance claire pour les indépendants, avec de gros montants lisibles.
- **Apple (iOS)** :
  - les volets qui montent du bas et se ferment en glissant vers le bas ;
  - la barre d'onglets.

Un seul bouton principal (`.btn-primary`) par zone. Des libellés courts et concrets. Les montants avec des chiffres alignés (`font-variant-numeric: tabular-nums`).

## Avant de finir
Lancer le skill `verifier-ecrans` (téléphone, tablette, ordinateur, mode sombre).
