# Defer Lottie Initial Render Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Lottie JSON and SVG creation from the initial render path while preserving the exact visual frame-0 appearance and hover behavior.

**Architecture:** Keep the lightweight `icons-runtime` in the shell, but change it from "load `service-icons.js` as soon as matching icons exist" to "prepare static placeholders and lazy-load the Lottie engine only near viewport or on first interaction." `service-icons.js` becomes an idempotent lazy controller with per-icon state, intersection warmup, pointerenter priority, Barba cleanup, and reset semantics.

**Tech Stack:** Vite, vanilla JavaScript, Barba, Webflow Lottie exports, `lottie-web`, IntersectionObserver, pointer events, existing `src/app/page-registry.js` and `src/app/icons-runtime.js`.

---

## Current Problem

Performance trace shows the current chain:

`main.js` → `service-icons-*.js` → multiple Lottie JSON files.

That means the code split succeeded technically, but the home page still asks for `service-icons` and many JSON animations during initial idle work because `page-registry.js` calls `initIcons(root)` whenever service/stat/team icon targets exist.

The target behavior is:

- The first paint still shows the same icon visual state.
- Lottie JS and JSON are not loaded until an icon is close to the viewport or the user interacts.
- First hover should either play immediately if prewarmed, or queue the hover and play as soon as the animation is ready.
- Barba transitions should not leak observers, listeners, or Lottie instances.

## File Structure

### Modify: `src/app/icons-runtime.js`

Responsibility after this plan:

- Stay tiny and shell-safe.
- Detect icon targets.
- Prepare static placeholders without importing `service-icons.js`.
- Attach near-viewport and first-pointer interaction triggers.
- Import `service-icons.js` only when one of those triggers fires.
- Cache the imported module.
- Route `initIcons`, `resetServiceCardIcons`, and `destroyIcons` safely whether or not the heavy module has loaded.

### Modify: `src/animation/service-icons.js`

Responsibility after this plan:

- Manage actual `lottie-web` instances only for icons requested by the runtime.
- Preserve frame-0 visuals through placeholder replacement.
- Resolve asset paths exactly as today, including Webflow CDN URLs and `/lottie/icon-XX.json` on the Netlify origin.
- Support queued hover while animation is loading.
- Provide robust cleanup for Barba leave.

### Modify: `src/app/page-registry.js`

Responsibility after this plan:

- Continue detecting icon sections, but call the new lightweight `prepareIcons(root)` instead of eagerly loading `service-icons.js`.
- Keep page/section init ordering unchanged.

### Modify: `src/animation/page-transition-nav.js`

Responsibility after this plan:

- Keep `destroyIcons(current.container)` in `beforeLeave`.
- Keep `resetServiceCardIcons(next.container)` and after-enter icon preparation, but avoid forcing heavy Lottie creation just because a transition completed.

### Optional Create: `src/app/lottie-placeholder-registry.js`

Responsibility if placeholders need more than inline data attributes:

- Provide a local mapping from `data-lottie` IDs to static SVG/HTML frame-0 markup.
- Keep fallback behavior explicit for icons that do not yet have exact static markup.

Do not create this file if existing DOM already contains an acceptable first-frame SVG from Webflow or if placeholders can be preserved by leaving the current children in place until replacement.

---

## Task 1: Capture Current Icon States Before Changing Behavior

**Files:**
- Inspect only: `src/animation/service-icons.js`
- Inspect only: affected rendered pages in DevTools
- Document observations in implementation notes or PR summary

- [ ] **Step 1: Capture the icon target matrix**

Use DevTools on staging and collect:

```js
(() => {
  return Array.from(
    document.querySelectorAll(
      '.service-card .service-icon_icon, .team-card .service-icon_icon, .stats-card .service-icon_icon, .stat-card .service-icon_icon, .service-card [data-lottie], .team-card [data-lottie], .stats-card [data-lottie], .stat-card [data-lottie]'
    )
  ).map((icon, index) => ({
    index,
    dataLottie: icon.getAttribute('data-lottie'),
    dataSrc: icon.getAttribute('data-src'),
    dataAnimationPath: icon.getAttribute('data-animation-path'),
    hasSvg: !!icon.querySelector('svg'),
    htmlLength: icon.innerHTML.length,
    cardClass: icon.closest('.service-card, .team-card, .stats-card, .stat-card')?.className || '',
    rect: icon.getBoundingClientRect().toJSON(),
  }))
})()
```

Expected:

- Service/team/stat icons have stable `.service-icon_icon` targets.
- Some icons may already contain Webflow-generated SVG before custom `service-icons.js` runs.
- IDs `1-10` map to Webflow CDN JSON, IDs `11-16` map to local `/lottie/icon-XX.json`.

- [ ] **Step 2: Capture frame-0 screenshot references**

Use screenshots for:

- Home service cards before scroll.
- Services page icon section.
- Any stats-card icons.
- Team card icons if present.

Expected:

- These screenshots become the visual reference for the placeholder.
- If a placeholder does not match exactly, the implementation must preserve existing DOM children instead of inventing a new generic placeholder.

- [ ] **Step 3: Capture current network baseline**

Run a Performance trace and record whether these requests occur before first interaction:

```text
service-icons-*.js
/lottie/icon-*.json
CoMinVi - Icon *.json
```

Expected before implementation:

- `service-icons-*.js` and many JSON files appear in the initial home chain.

Expected after implementation:

- `service-icons-*.js` should not appear until intersection warmup or interaction.
- JSON files should appear only for icons being prepared/played.

---

## Task 2: Define Icon Runtime State Without Loading Lottie

**Files:**
- Modify: `src/app/icons-runtime.js`

- [ ] **Step 1: Add runtime constants and state helpers**

Add these helpers near the top of `src/app/icons-runtime.js`:

```js
const ICON_CARD_SELECTOR = '.service-card, .team-card, .stats-card, .stat-card'
const ICON_PREPARED_ATTR = 'data-lottie-lazy-prepared'
const ICON_PLACEHOLDER_ATTR = 'data-lottie-placeholder-ready'

function getIconTargets(root = document) {
  try {
    const scope = getScope(root)
    return Array.from(scope.querySelectorAll(ICON_SELECTOR))
  } catch (e) {
    return []
  }
}

function getIconCard(icon) {
  try {
    return icon.closest(ICON_CARD_SELECTOR) || icon
  } catch (e) {
    return icon
  }
}
```

Expected:

- Runtime can enumerate icons and associated cards without importing `service-icons.js`.

- [ ] **Step 2: Add placeholder preparation that preserves existing DOM**

Add:

```js
function prepareIconPlaceholder(icon) {
  try {
    if (!icon || icon.getAttribute(ICON_PLACEHOLDER_ATTR) === 'true') return
    icon.setAttribute(ICON_PLACEHOLDER_ATTR, 'true')
    icon.setAttribute('aria-hidden', 'true')

    if (icon.innerHTML.trim()) {
      icon.__lottieLazyPlaceholderHTML = icon.innerHTML
    }

    icon.style.visibility = 'visible'
    icon.style.opacity = '1'
    if (!icon.style.display) icon.style.display = 'block'
  } catch (e) {
    // keep the existing visual state
  }
}

function prepareIconPlaceholders(root = document) {
  const icons = getIconTargets(root)
  icons.forEach(prepareIconPlaceholder)
  return icons
}
```

Expected:

- Existing Webflow SVG remains visible.
- Empty icons remain visible containers, ready for a later exact placeholder mapping if needed.
- No Lottie module import happens in this step.

- [ ] **Step 3: Add a public `prepareIcons` function**

Export:

```js
export function prepareIcons(root = document) {
  const icons = prepareIconPlaceholders(root)
  if (!icons.length) return
  attachLazyTriggers(root, icons)
}
```

Expected:

- `page-registry.js` can call `prepareIcons(root)` as the cheap initial operation.

---

## Task 3: Add Intersection And Pointer Triggers

**Files:**
- Modify: `src/app/icons-runtime.js`

- [ ] **Step 1: Add a single import trigger helper**

Add:

```js
function loadIconsFor(root, reason, icon = null) {
  return preloadIcons()
    .then((mod) => {
      try {
        if (typeof mod.initIcons === 'function') {
          mod.initIcons(root, { reason, icon })
        }
      } catch (e) {
        // keep placeholders visible
      }
      return mod
    })
    .catch(() => null)
}
```

Expected:

- The heavy module loads once and receives the reason and optional icon.

- [ ] **Step 2: Add IntersectionObserver warmup**

Add:

```js
function attachIntersectionWarmup(root, icons) {
  if (typeof IntersectionObserver === 'undefined') return false
  try {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const icon = entry.target
          observer.unobserve(icon)
          loadIconsFor(root, 'intersection', icon)
        })
      },
      {
        root: null,
        rootMargin: '350px 0px',
        threshold: 0.01,
      }
    )

    icons.forEach((icon) => {
      if (icon.__lottieLazyIntersectionObserver) return
      observer.observe(icon)
      icon.__lottieLazyIntersectionObserver = observer
    })
    return true
  } catch (e) {
    return false
  }
}
```

Expected:

- Icons begin loading before they are visible, but not during initial top-of-page work unless they are close enough to viewport.
- If home has above-the-fold icons, those specific icons may still warm quickly; this is acceptable only if they are visible immediately.

- [ ] **Step 3: Add first-pointer trigger**

Add:

```js
function attachPointerWarmup(root, icons) {
  icons.forEach((icon) => {
    const card = getIconCard(icon)
    if (!card || card.__lottieLazyPointerBound) return

    const onPointerEnter = () => {
      try {
        icon.__lottieLazyPendingHover = 'enter'
      } catch (e) {
        // ignore
      }
      loadIconsFor(root, 'pointerenter', icon)
    }

    card.addEventListener('pointerenter', onPointerEnter, { passive: true })
    card.addEventListener('mouseenter', onPointerEnter)
    card.__lottieLazyPointerEnter = onPointerEnter
    card.__lottieLazyPointerBound = true
  })
}
```

Expected:

- First hover queues intent and starts loading immediately.
- Once loaded, `service-icons.js` should see `icon.__lottieLazyPendingHover === 'enter'` and play the first segment.

- [ ] **Step 4: Add fallback for browsers without IntersectionObserver**

In `attachLazyTriggers`:

```js
function attachLazyTriggers(root, icons) {
  const hasIntersection = attachIntersectionWarmup(root, icons)
  attachPointerWarmup(root, icons)

  if (!hasIntersection) {
    try {
      window.requestIdleCallback
        ? window.requestIdleCallback(() => loadIconsFor(root, 'idle-fallback'), {
            timeout: 2000,
          })
        : setTimeout(() => loadIconsFor(root, 'timer-fallback'), 2000)
    } catch (e) {
      setTimeout(() => loadIconsFor(root, 'timer-fallback'), 2000)
    }
  }
}
```

Expected:

- Old browsers still get Lottie, but delayed.
- Pointer interaction remains the fastest path.

---

## Task 4: Update Registry To Prepare, Not Load

**Files:**
- Modify: `src/app/page-registry.js`

- [ ] **Step 1: Change imports**

Replace:

```js
import { initIcons, resetServiceCardIcons } from './icons-runtime.js'
```

with:

```js
import {
  prepareIcons,
  initIcons,
  resetServiceCardIcons,
} from './icons-runtime.js'
```

Expected:

- Existing `initIcons` remains available for after-enter paths that explicitly need it.

- [ ] **Step 2: Change initial shared-section icon path**

In `initSharedSections`, replace:

```js
jobs.push(initIcons(root))
```

with:

```js
try {
  prepareIcons(root)
} catch (e) {
  // keep page init resilient
}
```

Expected:

- Initial page init no longer imports `service-icons.js`.
- Placeholders and lazy triggers are ready.

- [ ] **Step 3: Keep after-enter safe**

In `initAfterEnterModules`, replace the unconditional final call:

```js
await initIcons(root)
```

with:

```js
try {
  prepareIcons(root)
} catch (e) {
  // keep transition resilient
}
```

Expected:

- Barba after-enter does not force Lottie JSON immediately.
- If icons are already loaded from a prior page, `resetServiceCardIcons` remains functional.

---

## Task 5: Make `service-icons.js` Per-Icon And Hover-Aware

**Files:**
- Modify: `src/animation/service-icons.js`

- [ ] **Step 1: Extend `initIcons` signature**

Change:

```js
export function initIcons(root = document) {
```

to:

```js
export function initIcons(root = document, opts = {}) {
```

At the start of the function add:

```js
const requestedIcon = opts && opts.icon ? opts.icon : null
const reason = opts && opts.reason ? opts.reason : 'manual'
```

Expected:

- Runtime can initialize either all icons in scope or a specific icon.

- [ ] **Step 2: Narrow icon list when a single icon triggered loading**

After `let icons = Array.from(scope.querySelectorAll(ICON_SELECTOR))`, add:

```js
if (requestedIcon && icons.includes(requestedIcon)) {
  icons = [requestedIcon]
}
```

Expected:

- Pointerenter on one card does not create all animations immediately.
- Intersection can initialize one icon at a time.

- [ ] **Step 3: Preserve pending hover**

Near `const pending = { pending: null }`, replace it with:

```js
const pending = {
  pending: icon.__lottieLazyPendingHover === 'enter' ? 'first' : null,
}
icon.__lottieLazyPendingHover = null
```

Expected:

- If the user hovers before Lottie is ready, the first segment plays once ready.

- [ ] **Step 4: Restore placeholder when animation cannot be created**

Where `recreateAnimation(icon)` clears children before `loadAnimation`, move the destructive clear until after a valid Lottie library and path are known. Keep the current logic:

```js
if (!lottie || !path) return null
```

before:

```js
while (icon.firstChild) icon.removeChild(icon.firstChild)
```

Expected:

- If the JSON path fails or library is unavailable, the frame-0 placeholder remains visible.

- [ ] **Step 5: Mark loaded icons**

After successful `lottie.loadAnimation`, add:

```js
try {
  icon.__lottieLazyLoaded = true
  icon.setAttribute('data-lottie-lazy-loaded', reason)
} catch (e) {
  // ignore
}
```

Expected:

- DevTools can confirm whether an icon loaded because of `intersection`, `pointerenter`, or fallback.

---

## Task 6: Cleanup Must Remove Lazy Observers And Pointer Handlers

**Files:**
- Modify: `src/app/icons-runtime.js`
- Modify: `src/animation/service-icons.js`

- [ ] **Step 1: Add lightweight runtime cleanup**

In `src/app/icons-runtime.js`, update `destroyIcons(root)` so it always clears runtime handlers, even if `service-icons.js` never loaded:

```js
function destroyLazyRuntime(root = document) {
  const icons = getIconTargets(root)
  icons.forEach((icon) => {
    try {
      if (
        icon.__lottieLazyIntersectionObserver &&
        typeof icon.__lottieLazyIntersectionObserver.unobserve === 'function'
      ) {
        icon.__lottieLazyIntersectionObserver.unobserve(icon)
      }
      icon.__lottieLazyIntersectionObserver = null
      icon.__lottieLazyPendingHover = null
    } catch (e) {
      // ignore
    }
  })

  try {
    const scope = getScope(root)
    Array.from(scope.querySelectorAll(ICON_CARD_SELECTOR)).forEach((card) => {
      if (card.__lottieLazyPointerBound && card.__lottieLazyPointerEnter) {
        card.removeEventListener('pointerenter', card.__lottieLazyPointerEnter)
        card.removeEventListener('mouseenter', card.__lottieLazyPointerEnter)
      }
      card.__lottieLazyPointerEnter = null
      card.__lottieLazyPointerBound = false
    })
  } catch (e) {
    // ignore
  }
}
```

Then:

```js
export function destroyIcons(root = document) {
  destroyLazyRuntime(root)
  try {
    if (iconsModule && typeof iconsModule.destroyIcons === 'function') {
      iconsModule.destroyIcons(root)
    }
  } catch (e) {
    // ignore
  }
}
```

Expected:

- Leaving a page before an icon loads does not leave observers/listeners attached to old Barba containers.

- [ ] **Step 2: Expand heavy cleanup selector**

In `src/animation/service-icons.js`, update the card selector inside `destroyIcons` from:

```js
scope.querySelectorAll('.service-card, .team-card')
```

to:

```js
scope.querySelectorAll('.service-card, .team-card, .stats-card, .stat-card')
```

Expected:

- Stats-card hover/listener cleanup is symmetrical with init.

---

## Task 7: Reset Semantics With Unloaded Icons

**Files:**
- Modify: `src/app/icons-runtime.js`
- Modify: `src/animation/service-icons.js`

- [ ] **Step 1: Keep reset as no-op for unloaded placeholders**

In `src/app/icons-runtime.js`, keep this behavior:

```js
export function resetServiceCardIcons(root = document) {
  try {
    if (
      iconsModule &&
      typeof iconsModule.resetServiceCardIcons === 'function'
    ) {
      iconsModule.resetServiceCardIcons(root)
    }
  } catch (e) {
    // ignore
  }
}
```

Expected:

- If no Lottie has loaded, reset does not force loading.
- Placeholder remains unchanged.

- [ ] **Step 2: Reset loaded icons only**

In `src/animation/service-icons.js`, keep `resetServiceCardIcons` querying icons, but add at the top of each loop:

```js
if (!icon.__lottieLazyLoaded && !icon.__svcAnim) return
```

Expected:

- Reset after Barba does not create or query animations unnecessarily.

---

## Task 8: Verify Network And Interaction Behavior

**Files:**
- No source changes unless verification fails.

- [ ] **Step 1: Build**

Run:

```bash
yarn build
```

Expected:

- Exit code `0`.
- `dist/main.js` still contains the lightweight runtime.
- `service-icons-*.js` remains a separate async chunk.

- [ ] **Step 2: Hard-load home and inspect network**

In DevTools, hard reload `https://cominvi-staging.webflow.io/`.

Expected before scroll/hover:

```text
service-icons-*.js should not be requested unless an icon is within 350px of viewport.
/lottie/icon-*.json should not be requested unless its icon warmed or hovered.
```

If above-the-fold icons are inside the `350px` margin, reduce `rootMargin` to `150px 0px` and rerun.

- [ ] **Step 3: Hover first visible icon**

Expected:

- `service-icons-*.js` loads if not already loaded.
- Only the hovered icon's JSON loads first.
- The hover animation plays after loading.
- Before animation is ready, the placeholder remains visible and does not flash blank.

- [ ] **Step 4: Scroll toward icon sections**

Expected:

- Icons begin loading shortly before entering the viewport.
- Frame 0 is visible before animation creation.
- No layout shift is caused by SVG insertion.

- [ ] **Step 5: Barba transition verification**

Test:

- Home → Services.
- Services → Home.
- Home → About us.
- Back/forward navigation.
- Transition while pointer is over a service card.

Expected:

- No duplicate hover events.
- No old page icons animate after leaving.
- `destroyIcons(current.container)` clears observers and heavy Lottie instances.
- New page placeholders prepare again.

- [ ] **Step 6: Performance trace**

Run a new Performance trace.

Expected:

- LCP stays fast.
- The critical chain no longer includes `service-icons-*.js` unless icons are close to first viewport.
- The Lottie JSON files are no longer all started in the same initial cluster.
- CLS does not regress.

---

## Task 9: Guardrails And Rollback Criteria

**Files:**
- Modify only files from previous tasks if a guardrail fails.

- [ ] **Step 1: Preserve exact visual fallback**

If an icon is empty before Lottie loads and no exact placeholder exists, do not ship a generic icon. Add a static frame-0 SVG/HTML mapping for that specific `data-lottie` ID.

Implementation shape if needed:

```js
const STATIC_FRAME_ZERO = {
  11: '<svg aria-hidden="true" viewBox="0 0 100 100">...</svg>',
}
```

Only use this mapping with verified, exact frame-0 markup captured from the existing rendered Lottie.

- [ ] **Step 2: Avoid global eager preload**

Do not add:

```js
preloadIcons()
```

inside `initSharedSections`, `initAfterEnterModules`, or `DOMContentLoaded`.

Expected:

- The heavy Lottie chunk is gated only by intersection, pointer, or no-IntersectionObserver fallback.

- [ ] **Step 3: Keep debug logs temporary**

During implementation, use existing prefixes:

```text
[cominvi-icons]
[cominvi-registry]
```

Before final production cleanup, remove noisy per-icon logs or guard them behind:

```js
const DEBUG_LOTTIE = false
```

Expected:

- Debugging remains possible without permanently noisy console output.

---

## Self-Review

- Spec coverage: The plan covers initial placeholder preservation, lazy loading by intersection, first-hover behavior, Barba cleanup, reset semantics, asset path preservation, no-IntersectionObserver fallback, performance verification, and rollback criteria.
- Placeholder scan: No step relies on an undefined implementation choice. If exact static frame-0 markup is needed, the plan requires capturing and using verified markup rather than generic placeholders.
- Type consistency: Public runtime APIs are `prepareIcons(root)`, `initIcons(root)`, `resetServiceCardIcons(root)`, and `destroyIcons(root)`. Heavy module API remains `initIcons(root, opts)`, `resetServiceCardIcons(root)`, and `destroyIcons(root)`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-14-defer-lottie-initial-render-plan.md`.

Execution options:

1. Subagent-driven execution: implement one task at a time with review checkpoints.
2. Inline execution: implement in this session using the plan step-by-step.

