import { initLoader } from './animation/loader.js'
import { initializeNav2 } from './animation/nav.js'
import { initializePageTransitionNav } from './animation/page-transition-nav.js'
import { initParallax } from './animation/parallax.js'
import { initLenis } from './animation/scroll.js'
import { createViewportClipOverlay } from './animation/svg-clip-overlay.js'
import { prepareHeroMedia } from './app/hero-media.js'
import { prepareIcons } from './app/icons-runtime.js'
import { initContainerModules } from './app/page-registry.js'
import siteStyles from './styles/style.css?inline'

const DEBUG_PREFIX = '[cominvi-debug]'

function logDebug(label, data = {}) {
  try {
    console.log(DEBUG_PREFIX, label, data)
  } catch (e) {
    // ignore
  }
}

function injectSiteStyles() {
  try {
    if (document.querySelector('style[data-cominvi-site-styles]')) {
      logDebug('site-css:already-injected')
      return
    }
    const style = document.createElement('style')
    style.setAttribute('data-cominvi-site-styles', '')
    style.textContent = siteStyles
    document.head.appendChild(style)
    logDebug('site-css:injected', {
      length: siteStyles.length,
      pageWrapOverflow:
        window.getComputedStyle &&
        document.querySelector('.page-wrap') &&
        getComputedStyle(document.querySelector('.page-wrap')).overflow,
    })
  } catch (e) {
    logDebug('site-css:error', { message: e && e.message })
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
  logDebug('dom-ready', {
    namespace: getCurrentNamespace(document),
    readyState: document.readyState,
    scripts: [...document.scripts].map((script) => script.src).filter(Boolean),
  })

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
    const heroMedia = prepareHeroMedia(document)
    logDebug('shell:hero-media-prepared', {
      hasVideo: !!(heroMedia && heroMedia.video),
      posterUrl: heroMedia && heroMedia.posterUrl,
    })
  } catch (e) {
    logDebug('shell:hero-media-error', { message: e && e.message })
  }
  logDebug('shell:init:start')
  initializePageTransitionNav()
  logDebug('shell:barba-ready')
  initLoader()
  logDebug('shell:loader-ready')
  initLenis()
  logDebug('shell:lenis-init-called', {
    hasLenis: !!window.lenis,
    hasWrapper: !!window.__lenisWrapper,
  })
  initializeNav2()
  logDebug('shell:nav-ready')
  // Priorité home: initialiser d'abord le hero.
  initParallax()
  logDebug('shell:hero-parallax-ready')
  try {
    prepareIcons(document)
    logDebug('shell:icons-prepared')
  } catch (e) {
    logDebug('shell:icons-prepare-error', { message: e && e.message })
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
    logDebug('dynamic:init-current:start', {
      namespace: getCurrentNamespace(document),
    })
    initContainerModules(document, {
      includeParallax: false,
      includeButtonHover: true,
    })
      .then(() => {
        logDebug('dynamic:init-current:done', {
          namespace: getCurrentNamespace(document),
        })
      })
      .catch((e) => {
        logDebug('dynamic:init-current:error', {
          message: e && e.message,
          stack: e && e.stack,
        })
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
