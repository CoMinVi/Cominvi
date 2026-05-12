import 'maplibre-gl/dist/maplibre-gl.css'
import './styles/style.css'
import { initLoader } from './animation/loader.js'
import { initializeNav2 } from './animation/nav.js'
import { initializePageTransitionNav } from './animation/page-transition-nav.js'
import { initHeroBackgroundParallax } from './animation/parallax.js'
import { initLenis } from './animation/scroll.js'
import { createViewportClipOverlay } from './animation/svg-clip-overlay.js'
// (deduped)

document.addEventListener('DOMContentLoaded', () => {
  const getCurrentNamespace = (scope = document) => {
    try {
      const container = scope.querySelector('[data-barba="container"]')
      return (container && container.getAttribute('data-barba-namespace')) || ''
    } catch (e) {
      return ''
    }
  }
  const isHomeNamespace = (scope = document) =>
    getCurrentNamespace(scope).trim().toLowerCase() === 'home'
  const scheduleDeferredInit = (fn) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(fn, { timeout: 180 })
        } else {
          setTimeout(fn, 48)
        }
      })
    })
  }
  let deferredInitsPromise = null
  const loadDeferredInits = () => {
    if (!deferredInitsPromise) {
      deferredInitsPromise = import('./animation/deferred-inits.js')
    }
    return deferredInitsPromise
  }

  try {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
    // Defensive: ensure we start at top on hard loads
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  } catch (e) {
    // ignore
  }
  initializePageTransitionNav()
  initLoader()
  initLenis()
  initializeNav2()
  // Priorité home: initialiser d'abord le hero.
  initHeroBackgroundParallax(document)
  const runNonCriticalInitializers = () =>
    loadDeferredInits()
      .then((m) => m.runNonCriticalInits(document))
      .catch(() => {})

  if (isHomeNamespace(document)) {
    scheduleDeferredInit(runNonCriticalInitializers)
  } else {
    runNonCriticalInitializers()
  }

  // Pre-instantiate mask overlay in DOM (hidden) so it exists before any transition
  try {
    const { tl } = createViewportClipOverlay({})
    if (tl && typeof tl.pause === 'function') tl.pause(0)
  } catch (err) {
    // ignore
  }
  // Option: you can call splitIntoWordSpans here if you need a manual split elsewhere
})
