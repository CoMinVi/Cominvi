# Sauvegarde Partners — cylindre et indicators 3D

Cette sauvegarde pointe vers l’état exact de l’animation avant le passage des
indicators en 2D.

- Commit source immuable : `246303c`
- JavaScript : `src/animation/cylinder.js`
- Styles : bloc `.cylindar__wrapper` à `.scroll-indicator_c .scroll-tick` dans
  `src/styles/style.css`

## Restaurer le JavaScript

```bash
git show 246303c:src/animation/cylinder.js > src/animation/cylinder.js
```

## Restaurer les indicators 3D dans le code actuel

Si les autres améliorations du cylindre doivent être conservées, reprendre
seulement ces éléments depuis le commit :

```bash
git diff 246303c -- src/animation/cylinder.js src/styles/style.css
git show 246303c:src/animation/cylinder.js
git show 246303c:src/styles/style.css
```

Les parties à restaurer sont :

1. le placement sphérique des ticks dans `calculatePositions()`;
2. le tween `rotateX` des `.scroll-indicator_c`;
3. `transform-style: preserve-3d` et le décalage vertical des indicators.

Ce fichier n’est importé par aucun point d’entrée applicatif.
