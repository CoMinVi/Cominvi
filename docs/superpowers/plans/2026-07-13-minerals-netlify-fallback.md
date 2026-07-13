# Minerals Netlify Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Charger les 600 frames AVIF depuis Netlify lorsque WebCodecs est indisponible.

**Architecture:** Le lecteur `.af` reste prioritaire. Le mode images génère directement les URLs du dossier public Netlify selon le nommage réel `minerals-000${frame}.avif`, sans dépendre des attributs Webflow.

**Tech Stack:** JavaScript ES modules, Node test runner, Vite.

---

### Task 1: Tester la génération des URLs locales

**Files:**
- Create: `src/animation/minerals-canvas-local-debug.test.js`
- Modify: `src/animation/minerals-canvas-local-debug.js`

- [ ] **Step 1: Écrire le test échouant**

Tester que `buildMineralsLocalUrls(600)` retourne 600 URLs Netlify et que les indices 0, 9, 99 et 599 correspondent aux noms réels.

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test src/animation/minerals-canvas-local-debug.test.js`

Expected: FAIL car la fonction n'est pas exportée et génère une origine/un padding incorrects.

- [ ] **Step 3: Implémenter le minimum**

Exporter le générateur, utiliser la base `https://cominvi.netlify.app/minerals` et construire `minerals-000${frame}.avif`.

- [ ] **Step 4: Vérifier le test**

Run: `node --test src/animation/minerals-canvas-local-debug.test.js`

Expected: PASS.

### Task 2: Utiliser systématiquement les URLs locales en fallback

**Files:**
- Modify: `src/animation/minerals-canvas-local-debug.js`

- [ ] **Step 1: Remplacer la lecture des 600 URLs Webflow**

Quand `shouldUseAf` est faux, appeler directement `buildMineralsLocalUrls(totalFrames)`.

- [ ] **Step 2: Vérifier les assets**

Confirmer que `public/minerals/` contient 600 AVIF.

- [ ] **Step 3: Vérifier le projet**

Run: `yarn lint:fix && yarn build`

Expected: lint et build réussis.

- [ ] **Step 4: Livrer**

Commit, push, création et merge de la PR.
