import { bindHeroBackgroundOverlayGuard } from './animation/hero-sequence-controller.js'
import {
  initLoader as initHomeLoader,
  prefetchHomeSequenceBinary,
} from './animation/loader-af.js'
import { initLoader as initDefaultLoader } from './animation/loader-save.js'
import { initializeNav2 } from './animation/nav.js'
import { initializePageTransitionNav } from './animation/page-transition-nav.js'
import { initParallax } from './animation/parallax.js'
import { initLenis } from './animation/scroll.js'
import { createViewportClipOverlay } from './animation/svg-clip-overlay.js'
import { prepareHeroMedia } from './app/hero-media.js'
import { startHeroSizeDebug } from './app/hero-size-debug.js'
import { isHomeEntryUrl } from './app/home-entry.js'
import { prepareIcons } from './app/icons-runtime.js'
import { initContainerModules } from './app/page-registry.js'
import siteStyles from './styles/style.css?inline'

function injectSiteStyles() {
  try {
    if (document.querySelector('style[data-cominvi-site-styles]')) {
      return
    }
    const style = document.createElement('style')
    style.setAttribute('data-cominvi-site-styles', '')
    style.textContent = siteStyles
    document.head.appendChild(style)
  } catch (e) {
    // ignore
  }
}

injectSiteStyles()
startHeroSizeDebug()

if (isHomeEntryUrl()) {
  prefetchHomeSequenceBinary()
  if (typeof document !== 'undefined') {
    const hideHeroOverlay = () => {
      try {
        bindHeroBackgroundOverlayGuard(document)
      } catch (e) {
        // ignore
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', hideHeroOverlay, {
        once: true,
      })
    } else {
      hideHeroOverlay()
    }
  }
}

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
  injectSiteStyles()

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
  try {
    const eagerHeroVideo = isHomeNamespace(document)
    if (eagerHeroVideo) {
      prepareHeroMedia(document, { deferSources: false })
    } else {
      prepareHeroMedia(document)
    }
  } catch (e) {
    // ignore
  }
  if (isHomeNamespace(document)) {
    initHomeLoader()
  }
  initializePageTransitionNav()
  if (!isHomeNamespace(document)) {
    initDefaultLoader()
  }
  initLenis()
  initializeNav2()
  // Priorité home: initialiser d'abord le hero.
  initParallax()
  try {
    prepareIcons(document)
  } catch {
    // ignore
  }
  try {
    if (document.querySelector('.cylindar__wrapper')) {
      import('./animation/cylinder.js')
        .then(({ initCylinder }) => {
          try {
            initCylinder(document)
          } catch (e) {
            // ignore
          }
        })
        .catch(() => {})
    }
  } catch (e) {
    // ignore
  }
  const runNonCriticalInitializers = () => {
    initContainerModules(document, {
      includeScrollRefresh: true,
      includeParallax: true,
      includeButtonHover: true,
    })
      .then(() => {
        // Initialization complete
      })
      .catch(() => {
        // Initialization error
      })
  }

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
})
