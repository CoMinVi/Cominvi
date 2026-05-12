import maplibreCssUrl from 'maplibre-gl/dist/maplibre-gl.css?url'

import { initLoader } from './animation/loader.js'
import { initializeNav2 } from './animation/nav.js'
import { initializePageTransitionNav } from './animation/page-transition-nav.js'
import { initHeroBackgroundParallax } from './animation/parallax.js'
import { initLenis } from './animation/scroll.js'
import { createViewportClipOverlay } from './animation/svg-clip-overlay.js'
import appCssUrl from './styles/style.css?url'
// (deduped)

document.addEventListener('DOMContentLoaded', () => {
  const ensureStylesheet = (href) => {
    if (!href) return
    try {
      const links = Array.from(
        document.querySelectorAll('link[rel="stylesheet"][href]')
      )
      const alreadyLoaded = links.some((link) => {
        const raw = link.getAttribute('href') || ''
        return raw === href || raw.includes(href)
      })
      if (alreadyLoaded) return
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      document.head.appendChild(link)
    } catch (e) {
      // ignore
    }
  }

  const hasMapContent = (scope = document) => {
    try {
      return Boolean(
        scope.querySelector(
          '.map, .map-wrap, .map-section, .project-item, .marker[id^="marker-"], .region[id^="region-"]'
        )
      )
    } catch (e) {
      return false
    }
  }

  if (hasMapContent(document)) ensureStylesheet(maplibreCssUrl)
  ensureStylesheet(appCssUrl)

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
  const scheduleDeferredInit = (fn, { timeout = 180 } = {}) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(fn, { timeout })
        } else {
          setTimeout(fn, Math.min(timeout, 300))
        }
      })
    })
  }
  const runAfterWindowLoad = (fn) => {
    try {
      if (document.readyState === 'complete') {
        fn()
        return
      }
      window.addEventListener('load', fn, { once: true })
    } catch (e) {
      fn()
    }
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
    // Home: keep non-critical chunk/CSS/JSON out of the initial critical path.
    runAfterWindowLoad(() => {
      scheduleDeferredInit(runNonCriticalInitializers, { timeout: 1800 })
    })
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
