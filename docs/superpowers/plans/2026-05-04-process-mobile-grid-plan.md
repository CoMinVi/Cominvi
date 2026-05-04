# Process Mobile Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inject a responsive layout helper so that each `.process` block rearranges its index and text into a four-column grid whenever the viewport width is under 767 px.

**Architecture:** Extend `src/animation/process-progression.js` with a dedicated helper that (a) detects the breakpoint, (b) re-parents `.process_index` nodes into `.process_inner`, (c) applies/removes inline grid styles, and (d) restores the original DOM/state when leaving the breakpoint. The helper hooks into the existing resize lifecycle managed by `initProcessProgression`.

**Tech Stack:** JavaScript (ESM), GSAP ScrollTrigger, Vite toolchain (`yarn` scripts).

---

### Task 1: Introduire l’état et les utilitaires globaux

**Files:**
- Modify: `src/animation/process-progression.js`

- [ ] **Étape 1 : Ajouter constantes & Map**
  ```javascript
  const PROCESS_MOBILE_MAX = 767
  const processIndexOrigins = new WeakMap()
  ```
  Place these near the top of the module (after imports) to reuse across helpers.

- [ ] **Étape 2 : Définir un helper `isProcessMobile()`**
  ```javascript
  const isProcessMobile = () => window.innerWidth < PROCESS_MOBILE_MAX
  ```
  Keeps breakpoint logic centralized.

- [ ] **Étape 3 : Exporter un stub `syncProcessMobileLayout(section)`**
  ```javascript
  function syncProcessMobileLayout(section) {
    if (!section) return () => {}
    const processes = Array.from(section.querySelectorAll('.process'))
    return () => {}
  }
  ```
  Place it below existing helpers so later tasks can flesh it out. Return a cleanup noop for now.

- [ ] **Étape 4 : Vérifier lint rapide**
  ```bash
  yarn lint:fix --dry-run
  ```
  Confirms no syntax errors before continuing.

### Task 2: Implémenter l’application/rollback mobile

**Files:**
- Modify: `src/animation/process-progression.js`

- [ ] **Étape 1 : Compléter `syncProcessMobileLayout`**
  ```javascript
  function syncProcessMobileLayout(section) {
    if (!section) return () => {}
    const processes = Array.from(section.querySelectorAll('.process'))

    const moveIndexInside = (proc) => {
      const index = proc.querySelector('.process_index')
      const inner = proc.querySelector('.process_inner')
      if (!index || !inner || inner.contains(index)) return
      const descriptor = {
        parent: index.parentElement,
        nextSibling: index.nextElementSibling,
      }
      processIndexOrigins.set(index, descriptor)
      inner.prepend(index)
      inner.style.display = 'grid'
      inner.style.gridTemplateColumns = 'repeat(4, 1fr)'
      inner.style.columnGap = '1em'
      inner.style.marginLeft = '1em'
      inner.style.marginRight = '1em'
      index.style.gridColumn = '1 / 2'
      const desc = inner.querySelector('.process-desc')
      if (desc) desc.style.gridColumn = '2 / 5'
    }

    const restoreIndex = (proc) => {
      const index = proc.querySelector('.process_index')
      if (!index) return
      const origin = processIndexOrigins.get(index)
      if (origin && origin.parent) {
        if (origin.nextSibling) {
          origin.parent.insertBefore(index, origin.nextSibling)
        } else {
          origin.parent.appendChild(index)
        }
      }
      const inner = proc.querySelector('.process_inner')
      if (inner) {
        inner.style.display = ''
        inner.style.gridTemplateColumns = ''
        inner.style.columnGap = ''
        inner.style.marginLeft = ''
        inner.style.marginRight = ''
      }
      index.style.gridColumn = ''
      const desc = proc.querySelector('.process_inner .process-desc')
      if (desc) desc.style.gridColumn = ''
    }
  ```
  Keep code idempotent: `inner.contains(index)` prevents double moves.

- [ ] **Étape 2 : Ajouter gestion `applyMobile` / `revertDesktop`**
  ```javascript
    const applyMobile = () => processes.forEach(moveIndexInside)
    const revertDesktop = () => processes.forEach(restoreIndex)
  ```

- [ ] **Étape 3 : Brancher sur `window.resize` via closure**
  ```javascript
    let currentMobile = null
    const evaluate = () => {
      const shouldBeMobile = isProcessMobile()
      if (shouldBeMobile === currentMobile) return
      currentMobile = shouldBeMobile
      if (currentMobile) {
        applyMobile()
      } else {
        revertDesktop()
      }
    }
    evaluate()
    window.addEventListener('resize', evaluate)
    return () => {
      window.removeEventListener('resize', evaluate)
      revertDesktop()
    }
  }
  ```
  Ensures cleanup handler removes listener and restores DOM.

- [ ] **Étape 4 : `yarn lint:fix --dry-run`** pour sécuriser le format.

### Task 3: Intégrer et tester manuellement

**Files:**
- Modify: `src/animation/process-progression.js`

- [ ] **Étape 1 : Appeler le helper dans `initProcessProgression`**
  ```javascript
    const doInit = () => {
      buildVerticalTicks(track, sticky)
      // ...existing code...
      const cleanupMobile = syncProcessMobileLayout(section)
      window.__processCleanupMobile = cleanupMobile
    }
  ```
  Stocker la fonction de cleanup pour la libération ultérieure.

- [ ] **Étape 2 : Étendre le teardown existant**
  À l’endroit où `window.__processResizeHandler` est retiré, ajouter :
  ```javascript
  try {
    if (window.__processCleanupMobile) {
      window.__processCleanupMobile()
      window.__processCleanupMobile = null
    }
  } catch (e) {
    // ignore
  }
  ```
  Garantit que l’état mobile est réinitialisé lors des transitions.

- [ ] **Étape 3 : Vérification manuelle**
  ```bash
  yarn dev
  ```
  - Ouvrir `http://localhost:3000`.
  - Redimensionner la fenêtre < 767 px : vérifier que l’index entre dans la carte, grid 4 colonnes, marges 1 em.
  - Repasser > 767 px : s’assurer que le DOM revient à l’état initial et que les styles inline disparaissent.

- [ ] **Étape 4 : Commit final**
  ```bash
  git add src/animation/process-progression.js docs/superpowers/specs/2026-05-04-process-mobile-grid-design.md
  git commit -m "feat: reorganize process layout on mobile"
  ```

---
