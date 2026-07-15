# Our Services Mobile Scroll Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Éliminer le travail de scroll hors viewport et alléger le canvas Minerals sur mobile.

**Architecture:** Extraire de petites fonctions pures testables pour décider de l’activité des sections, batcher les mesures de markers et calculer le DPR du canvas. Les modules existants restent responsables de leur cycle de vie et de leur nettoyage Barba.

**Tech Stack:** JavaScript ES modules, Node test runner, Lenis, GSAP ScrollTrigger, IntersectionObserver, Canvas 2D.

## Global Constraints

- Conserver `mix-blend-mode: difference` sur mobile.
- Conserver Lenis et `syncTouch: true`.
- Ne pas modifier les fichiers HTML Webflow comme source structurelle.
- Ne pas modifier `dist/` manuellement ; le régénérer avec Vite.

---

### Task 1: Utilitaires de performance testables

**Files:**
- Create: `src/animation/scroll-performance.js`
- Create: `src/animation/scroll-performance.test.mjs`

**Interfaces:**
- Produces: `isNearViewport(rect, viewportHeight, marginRatio): boolean`
- Produces: `readMarkerRects(entries, padding): Array<{ button, left, top, width, height }>`
- Produces: `getCanvasPixelRatio(devicePixelRatio, isMobile): number`

- [ ] Écrire des tests qui exigent l’arrêt hors viewport, une mesure unique par marker et un DPR mobile plafonné à 2.
- [ ] Exécuter `node --test src/animation/scroll-performance.test.mjs` et vérifier l’échec dû au module absent.
- [ ] Implémenter les trois fonctions pures.
- [ ] Réexécuter le test et vérifier son succès.

### Task 2: Map active uniquement à proximité

**Files:**
- Modify: `src/animation/map.js`

**Interfaces:**
- Consumes: `isNearViewport`, `readMarkerRects`

- [ ] Ajouter un `IntersectionObserver` avec marge verticale de 50 % autour de `.section_projects`.
- [ ] Ne planifier aucune synchronisation tant que la section est hors zone.
- [ ] Remplacer les lectures/écritures alternées par une lecture groupée puis une écriture groupée.
- [ ] Nettoyer l’ancien observer/listener lors d’une réinitialisation.

### Task 3: Process actif uniquement à proximité

**Files:**
- Modify: `src/animation/process-progression.js`

**Interfaces:**
- Consumes: `isNearViewport`

- [ ] Mettre en cache les ticks et l’index actif.
- [ ] Coalescer les événements Lenis dans une seule RAF.
- [ ] Suspendre les mesures et écritures lorsque `.section_process` est hors de la marge de 50 %.
- [ ] Nettoyer observer, RAF, listener et ScrollTrigger lors d’une réinitialisation.

### Task 4: Canvas mobile allégé

**Files:**
- Modify: `src/animation/minerals-canvas-local-debug.js`

**Interfaces:**
- Consumes: `getCanvasPixelRatio`

- [ ] Utiliser un DPR plafonné à 2 pour les breakpoints mobile/tablette.
- [ ] Conserver le DPR natif sur desktop.
- [ ] Vérifier que les dimensions CSS du canvas ne changent pas.

### Task 5: Vérification

**Files:**
- Regenerate: `dist/`

- [ ] Exécuter les tests Node.
- [ ] Exécuter `yarn lint:fix`.
- [ ] Exécuter `yarn build`.
- [ ] Profiler un geste sur services, minerals, projects, process et footer ; vérifier l’absence de mesures map/process hors zone.
- [ ] Committer et pousser les changements.
