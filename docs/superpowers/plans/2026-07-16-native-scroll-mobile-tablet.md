# Native Mobile and Tablet Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Désactiver réellement Lenis jusqu’à 991 px et conserver un scroll natif compatible avec ScrollTrigger, la navigation, le hero et Barba.

**Architecture:** `scroll.js` devient l’unique sélecteur entre le moteur Lenis desktop et le moteur natif mobile/tablette. Le mode natif expose `window` comme scroller partagé, active un état CSS explicite et remet les defaults ScrollTrigger sur le viewport. Les consommateurs qui écoutaient le wrapper Lenis utilisent ensuite cette cible partagée, ce qui garde leurs nettoyages symétriques.

**Tech Stack:** JavaScript ES modules, Lenis 1.x, GSAP ScrollTrigger, Barba, Vite 2, Playwright, CSS Webflow.

## Global Constraints

- Le mode natif s’applique exactement à `max-width: 991px`.
- Lenis reste inchangé à partir de `992px`.
- Le scroll doit atteindre toutes les sections de la home, y compris Technology et Partners.
- Les initialisations Barba doivent pouvoir alterner entre les deux modes sans listener ni référence obsolète.
- `dist/` est généré uniquement par `yarn build` et n’est jamais édité manuellement.

---

### Task 1: Sélection et cycle de vie du moteur de scroll

**Files:**
- Create: `src/animation/native-scroll.playwright.mjs`
- Modify: `src/animation/scroll.js`
- Modify: `src/styles/style.css`
- Modify: `package.json`

**Interfaces:**
- Produces: `usesNativeScroll(viewportMatcher?: Function): boolean`
- Produces: `initLenis(root?: Document|Element): Lenis|null`, qui initialise désormais soit Lenis soit le mode natif.
- Produces: `window.__lenisWrapper`, égal au wrapper desktop ou à `window` en mode natif.

- [ ] **Step 1: Écrire le test navigateur en échec**

Créer un test Playwright qui visite la home aux largeurs `390`, `768`, `991` et
`992`, puis vérifie :

```js
const state = await page.evaluate(() => ({
  hasLenis: Boolean(window.lenis),
  nativeClass: document.documentElement.classList.contains('is-native-scroll'),
  sharedScrollerIsWindow: window.__lenisWrapper === window,
  pageOverflow: getComputedStyle(document.querySelector('.page-wrap')).overflow,
  maxScroll: document.documentElement.scrollHeight - window.innerHeight,
}))
```

Pour `390`, `768` et `991`, attendre `hasLenis === false`,
`nativeClass === true`, `sharedScrollerIsWindow === true`,
`pageOverflow !== 'hidden'` et `maxScroll > innerHeight`. Faire ensuite
`window.scrollTo(0, document.documentElement.scrollHeight)` et vérifier que
`window.scrollY > innerHeight`. À `992`, vérifier Lenis présent, classe absente
et wrapper partagé différent de `window`.

- [ ] **Step 2: Exécuter le test et confirmer l’échec attendu**

Run: `yarn dev --host 127.0.0.1`, puis
`yarn test:native-scroll`

Expected: FAIL à `390`, `768` et `991` car Lenis est présent et
`.page-wrap` conserve `overflow: hidden`.

- [ ] **Step 3: Implémenter le sélecteur et le mode natif minimal**

Dans `scroll.js`, extraire :

```js
export const NATIVE_SCROLL_QUERY = '(max-width: 991px)'

export function usesNativeScroll(
  viewportMatcher = (query) => window.matchMedia(query).matches
) {
  try {
    return Boolean(viewportMatcher(NATIVE_SCROLL_QUERY))
  } catch (e) {
    return false
  }
}
```

Au début de `initLenis`, nettoyer une instance précédente, puis, si le matcher
retourne vrai :

```js
document.documentElement.classList.add('is-native-scroll')
window.lenis = null
window.__lenisWrapper = window
ScrollTrigger.defaults({ scroller: window })
wrapper.scrollTop = 0
window.scrollTo(0, 0)
requestAnimationFrame(() => ScrollTrigger.refresh())
return null
```

En desktop, retirer `is-native-scroll` avant de conserver le chemin Lenis
existant. Dans `destroyLenis`, retirer le ticker, détruire Lenis, remettre les
références globales à `null` et supprimer l’état CSS.

Ajouter au CSS, avec une spécificité supérieure aux règles Webflow :

```css
html.is-native-scroll .page-wrap {
  height: auto;
  min-height: 100dvh;
  overflow: visible;
}

html.is-native-scroll .content-wrap {
  will-change: auto;
}
```

- [ ] **Step 4: Exécuter le test et vérifier le passage au vert**

Run: `yarn test:native-scroll`

Expected: PASS aux quatre largeurs.

- [ ] **Step 5: Commit**

```bash
git add package.json src/animation/native-scroll.playwright.mjs src/animation/scroll.js src/styles/style.css
git commit -m "feat(scroll): utiliser le scroll natif jusqu’à 991px"
```

### Task 2: Consommateurs du scroll natif et initialisations uniques

**Files:**
- Modify: `src/animation/nav.js`
- Modify: `src/animation/parallax.js`
- Modify: `src/main.js`
- Modify: `src/animation/native-scroll.playwright.mjs`

**Interfaces:**
- Consumes: `window.__lenisWrapper`, qui vaut `window` en mode natif.
- Produces: listeners de navigation et bouton Next attachés à la cible partagée et retirés de la même cible.

- [ ] **Step 1: Étendre le test avec les comportements consommateurs**

Ajouter, pour les viewports natifs :

```js
await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2))
await page.waitForTimeout(700)
const nativeEffects = await page.evaluate(() => ({
  scrollY: window.scrollY,
  navbarLeft: getComputedStyle(document.querySelector('.navbar')).left,
  nextTransform:
    document.querySelector('.section_next .next-button-wrapper')?.style
      .transform || '',
}))
```

Vérifier que `scrollY` progresse, que la navbar reçoit un décalage après le
scroll et qu’après un scroll jusqu’à `.section_next`, `nextTransform` est
renseigné. Réinitialiser les modules via la navigation Barba vers une page puis
retour à la home et vérifier que chaque scroll ne déclenche qu’une seule mise à
jour RAF visible.

- [ ] **Step 2: Exécuter le test et confirmer l’échec attendu**

Run: `yarn test:native-scroll`

Expected: FAIL car `initializeNavbarScroll`, le thème et
`initNextButtonSticky` écoutent encore `.page-wrap` ou Lenis.

- [ ] **Step 3: Brancher et nettoyer les listeners sur la cible partagée**

Dans `nav.js` :

- retourner `window.scrollY` dans `getCurrentScrollPosition` lorsque
  `window.__lenisWrapper === window` ;
- dans `initializeNavbarScroll`, utiliser
  `window.__lenisWrapper || wrapperElement` pour le fallback natif, stocker le
  handler sur cette cible et retirer l’ancien handler avant de le remplacer ;
- dans `bindScroll`, utiliser la même cible partagée pour le thème.

Dans `parallax.js`, stocker `window.__nextButtonStickyScrollTarget`, attacher
`onScroll` à cette cible quand Lenis est absent, puis le retirer dans
`destroyNextButtonSticky`.

Dans `main.js`, retirer les initialisations immédiates de `initParallax` et
`initCylinder`; elles sont déjà exécutées une fois par `initContainerModules`.

- [ ] **Step 4: Exécuter le test complet et vérifier le passage au vert**

Run: `yarn test:native-scroll`

Expected: PASS pour progression, navbar, bouton Next et navigation Barba.

- [ ] **Step 5: Commit**

```bash
git add src/animation/nav.js src/animation/parallax.js src/main.js src/animation/native-scroll.playwright.mjs
git commit -m "fix(scroll): adapter les modules au viewport natif"
```

### Task 3: Vérification de non-régression

**Files:**
- Modify generated output only through: `yarn build`

**Interfaces:**
- Consumes: tous les changements des tâches 1 et 2.
- Produces: preuve de lint, build et comportement mobile/tablette/desktop.

- [ ] **Step 1: Corriger uniquement le lint des fichiers modifiés**

Run:

```bash
yarn eslint src/animation/scroll.js src/animation/nav.js src/animation/parallax.js src/main.js src/animation/native-scroll.playwright.mjs --fix
```

Expected: exit 0, sans erreur restante.

- [ ] **Step 2: Relancer le test navigateur**

Run: `yarn test:native-scroll`

Expected: PASS à `390`, `768`, `991` et `992`.

- [ ] **Step 3: Construire la version de production**

Run: `yarn build`

Expected: exit 0 sans nouveau warning applicatif. Vérifier que seules les
sorties Vite attendues de `dist/` changent.

- [ ] **Step 4: Vérifier le diff final**

Run: `git diff --check && git status --short`

Expected: aucun défaut d’espace; uniquement sources, test, plan et sorties Vite
attendues.

- [ ] **Step 5: Commit final si le formatage ou le build a modifié des fichiers**

```bash
git add src package.json dist
git commit -m "chore: valider le scroll natif responsive"
```
