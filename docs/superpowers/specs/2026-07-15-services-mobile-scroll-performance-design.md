# Performance du scroll mobile — Our Services

## Objectif

Réduire les pertes de frames sur `/our-services` sans modifier le comportement visuel, le `mix-blend-mode` de la navbar, ni l’architecture Lenis/ScrollTrigger.

## Diagnostic mesuré

Un geste mobile de 64 événements déclenche actuellement environ 800 mesures DOM :

- 448 mesures pour les 7 markers de la map, même lorsque la map est hors écran ;
- 320 mesures dans la progression Process, même lorsque Process est hors écran ;
- 37 rendus canvas supplémentaires dans Minerals.

Sous throttling CPU ×6, les pauses entre frames atteignent 68 à 136 ms. La position Lenis reste monotone : l’impression de saut provient de frames perdues, puis rattrapées.

## Conception

### Map

Observer `.section_projects` avec `IntersectionObserver` et synchroniser les hitboxes seulement lorsque la section est proche du viewport. Pour chaque synchronisation, lire d’abord les rectangles de tous les markers, puis appliquer toutes les écritures CSS dans une seconde passe. Cela supprime le travail hors écran et évite l’alternance lecture/écriture qui force des recalculs de layout.

### Process

Observer `.section_process` avec une marge d’anticipation. Ignorer les événements Lenis hors de cette zone, coalescer les mises à jour dans une seule RAF, mettre en cache les ticks et ne modifier leurs classes que lorsque l’index actif change. Un seul chemin de mise à jour pilotera la progression.

### Minerals

Conserver les dimensions CSS du canvas, mais plafonner sa résolution interne mobile à un DPR de 2. Les écrans desktop conservent leur DPR natif. Le rendu reste net tout en réduisant le nombre de pixels décodés et peints d’environ 56 % sur un appareil DPR 3.

## Validation

- tests unitaires des fonctions pures de visibilité, batching et DPR ;
- profil Playwright sur la page publiée/localement ;
- `yarn lint:fix` ;
- `yarn build`.

## Hors périmètre

- remplacement de Lenis ;
- changement du design de la section Minerals ;
- suppression du `mix-blend-mode` mobile ;
- refonte structurelle Webflow.
