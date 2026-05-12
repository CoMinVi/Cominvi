import maplibreCssUrl from 'maplibre-gl/dist/maplibre-gl.css?url'

import appCssUrl from './styles/style.css?url'
// (deduped)

document.addEventListener('DOMContentLoaded', () => {
  let coreAnimationsPromise = null
  const loadCoreAnimations = () => {
    if (!coreAnimationsPromise) {
      coreAnimationsPromise = Promise.all([
        import('./animation/loader.js'),
        import('./animation/parallax.js'),
        import('./animation/scroll.js'),
      ])
    }
    return coreAnimationsPromise
  }

  let navSystemPromise = null
  const loadNavSystem = () => {
    if (!navSystemPromise) {
      navSystemPromise = import('./animation/nav.js')
    }
    return navSystemPromise
  }

  let transitionSystemPromise = null
  const loadTransitionSystem = () => {
    if (!transitionSystemPromise) {
      transitionSystemPromise = Promise.all([
        import('./animation/page-transition-nav.js'),
        import('./animation/svg-clip-overlay.js'),
      ])
    }
    return transitionSystemPromise
  }
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
  loadCoreAnimations()
    .then(([loaderMod, parallaxMod, scrollMod]) => {
      try {
        loaderMod.initLoader()
      } catch (e) {
        // ignore
      }
      try {
        scrollMod.initLenis()
      } catch (e) {
        // ignore
      }
      // Priorité home: initialiser d'abord le hero.
      try {
        parallaxMod.initHeroBackgroundParallax(document)
      } catch (e) {
        // ignore
      }
    })
    .catch(() => {})
  const runNonCriticalInitializers = () =>
    loadDeferredInits()
      .then((m) => m.runNonCriticalInits(document))
      .catch(() => {})

  const runAfterInteractionOrTimeout = (fn, { timeout = 3200 } = {}) => {
    let started = false
    const start = () => {
      if (started) return
      started = true
      cleanup()
      fn()
    }
    const onInteraction = () => start()
    const cleanup = () => {
      window.removeEventListener('pointerdown', onInteraction, true)
      window.removeEventListener('touchstart', onInteraction, true)
      window.removeEventListener('keydown', onInteraction, true)
      window.removeEventListener('scroll', onInteraction, true)
    }

    window.addEventListener('pointerdown', onInteraction, {
      capture: true,
      passive: true,
    })
    window.addEventListener('touchstart', onInteraction, {
      capture: true,
      passive: true,
    })
    window.addEventListener('keydown', onInteraction, true)
    window.addEventListener('scroll', onInteraction, {
      capture: true,
      passive: true,
      once: true,
    })

    // Fallback: ensure features still initialize without user interaction.
    setTimeout(start, timeout)
  }

  runAfterInteractionOrTimeout(
    () => {
      loadNavSystem()
        .then((m) => {
          try {
            m.initializeNav2()
          } catch (e) {
            // ignore
          }
        })
        .catch(() => {})

      loadTransitionSystem()
        .then(([ptMod, overlayMod]) => {
          try {
            ptMod.initializePageTransitionNav()
          } catch (e) {
            // ignore
          }
          // Pre-instantiate mask overlay in DOM (hidden) so it exists before transitions.
          try {
            const { tl } = overlayMod.createViewportClipOverlay({})
            if (tl && typeof tl.pause === 'function') tl.pause(0)
          } catch (err) {
            // ignore
          }
        })
        .catch(() => {})
    },
    { timeout: 900 }
  )

  if (isHomeNamespace(document)) {
    // Home: keep non-critical chunk/CSS/JSON out of the initial critical path.
    runAfterWindowLoad(() => {
      runAfterInteractionOrTimeout(
        () =>
          scheduleDeferredInit(runNonCriticalInitializers, {
            timeout: 2200,
          }),
        { timeout: 15000 }
      )
    })
  } else {
    runNonCriticalInitializers()
  }

  // Option: you can call splitIntoWordSpans here if you need a manual split elsewhere
})
