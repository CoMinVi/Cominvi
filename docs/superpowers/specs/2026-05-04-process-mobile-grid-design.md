# Spécification – Process section mobile grid rewrite

## Objectif
Réorganiser dynamiquement la structure DOM et la mise en page de chaque bloc `.process` lorsque la largeur de la fenêtre est < 767 px.

## Contexte
- La section `.section_process` contient des répétitions `.process` composées de `.process_index`, `.process_inner`, et `.process-desc`.
- Sur mobile, la maquette attend que l’index s’affiche dans la même carte que le texte, en grille 4 colonnes.
- Le JS `initProcessProgression` gère déjà cette section (ticks, progression, etc.), ce qui en fait l’endroit naturel pour ajouter la logique responsive.

## Comportement attendu (< 767 px)
1. **Déplacement DOM**
   - Pour chaque `.process`, déplacer `div.process_index` au début de `div.process_inner` (si pas déjà présent).
   - Mémoriser le parent/frère d’origine pour pouvoir le remettre lorsque la largeur repasse >= 767 px.
2. **Mise en forme inline**
   - Sur `.process_inner` : `display:grid`, `grid-template-columns: repeat(4, 1fr)`, `column-gap: 1em`, `margin-left/right: 1em`.
   - Sur `.process_index` (désormais dans `.process_inner`) : `grid-column: 1 / 2`.
   - Sur `.process-desc` (ou son conteneur direct dans `.process_inner`) : `grid-column: 2 / 5`.
3. **Nettoyage / retour desktop**
   - Lorsque `window.innerWidth >= 767`, remettre la structure DOM initiale en se servant des références mémorisées.
   - Retirer toutes les propriétés inline appliquées côté mobile.

## Détails d’implémentation
- Ajouter un helper `syncProcessMobileLayout(section)` appelé depuis `initProcessProgression` après `setupVerticalTickHighlighting`.
- Ce helper gère :
  - un `Map` pour mémoriser parent/frère originaux (`originalParent`, `nextSibling`).
  - un listener `resize` partagé (réutiliser ou adapter `window.__processResizeHandler`).
  - une fonction `applyMobileLayout()` qui active le mode mobile, et `restoreDesktopLayout()` pour revenir au mode desktop.
- S’assurer que la logique est idempotente (ne pas déplacer deux fois le même nœud, ni effacer un style déjà vide).
- Nettoyer les listeners/références lors de la destruction si nécessaire (en cohérence avec le comportement existant du module).

## Non-objectifs
- Pas de modification des classes CSS globales ni des HTML statiques.
- Pas d’ajout de dépendances externes.

