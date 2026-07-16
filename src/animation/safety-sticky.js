import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const SAFETY_STICKY_MEDIA_QUERY = '(min-width: 992px)'

function getScope(root = document) {
  return root && root.querySelector ? root : document
}

function shouldEnableSafetySticky() {
  try {
    return window.matchMedia(SAFETY_STICKY_MEDIA_QUERY).matches
  } catch (e) {
    return true
  }
}

function getScroller() {
  try {
    const defaults = ScrollTrigger.defaults()
    if (defaults && defaults.scroller) return defaults.scroller
  } catch (e) {
    // ignore
  }
  return document.querySelector('.page-wrap')
}

function measureElementHeight(el) {
  if (!el) return 0
  try {
    const height = el.offsetHeight || el.getBoundingClientRect().height || 0
    return Math.max(0, Math.round(height))
  } catch (e) {
    return 0
  }
}

function findStickyParagraph(section) {
  const homeBody = section.querySelector('.text-cta.h100 > .body-m')
  if (homeBody) return homeBody

  const candidates = section.querySelectorAll(
    '.content-s .body-m, .sticky-wrap .body-m, .content_column .body-m'
  )
  for (const el of candidates) {
    try {
      if (getComputedStyle(el).position === 'sticky') return el
    } catch (e) {
      // ignore
    }
  }
  return null
}

function parseStickyTopPx(el) {
  try {
    const top = getComputedStyle(el).top
    if (!top || top === 'auto') return 0
    if (top.endsWith('px')) return parseFloat(top) || 0
    if (top.endsWith('em')) {
      const fontSize = parseFloat(getComputedStyle(el).fontSize) || 16
      return (parseFloat(top) || 0) * fontSize
    }
  } catch (e) {
    // ignore
  }
  return 0
}

function resolveStickyTopPx(el) {
  const cssTop = parseStickyTopPx(el)
  if (cssTop > 0) return cssTop

  const height = measureElementHeight(el)
  if (!height) return 0

  return Math.max(0, Math.round(window.innerHeight * 0.5 - height * 0.5))
}

function scheduleSafetyStickyReflow() {
  const run = () => {
    try {
      if (
        window.ScrollTrigger &&
        typeof window.ScrollTrigger.refresh === 'function'
      ) {
        window.ScrollTrigger.refresh()
      }
    } catch (e) {
      // ignore
    }
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(run)
  })
  setTimeout(run, 120)
  setTimeout(run, 320)

  try {
    if (document.fonts && typeof document.fonts.ready?.then === 'function') {
      document.fonts.ready.then(run).catch(() => {})
    }
  } catch (e) {
    // ignore
  }
}

function bindSafetyStickyGlobalListeners() {
  if (window.__safetyStickyGlobalsBound) return
  window.__safetyStickyGlobalsBound = true
  let viewportWidth =
    window.innerWidth || document.documentElement.clientWidth || 0
  let resizeTimer = null

  const refreshAll = () => {
    try {
      refreshSafetySticky(document)
    } catch (e) {
      // ignore
    }
  }

  try {
    window.addEventListener('resize', () => {
      const nextWidth =
        window.innerWidth || document.documentElement.clientWidth || 0
      if (nextWidth === viewportWidth) return
      viewportWidth = nextWidth
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        try {
          const section = document.querySelector('.section_safety')
          const isEnabled = Boolean(section?.__safetyStickyST)
          if (section && isEnabled !== shouldEnableSafetySticky()) {
            refreshAll()
            return
          }
          if (
            window.ScrollTrigger &&
            typeof window.ScrollTrigger.refresh === 'function'
          ) {
            window.ScrollTrigger.refresh()
          }
        } catch (e) {
          // ignore
        }
      }, 120)
    })
    window.addEventListener('page:transition:after', refreshAll)
    document.addEventListener('menu:close-end', () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(refreshAll)
      })
    })
  } catch (e) {
    // ignore
  }
}

export function destroySafetySticky(root = document) {
  const scope = getScope(root)
  scope.querySelectorAll('.section_safety').forEach((section) => {
    section.classList.remove('is-lenis-sticky')
    if (section.__safetyStickyST) {
      try {
        section.__safetyStickyST.kill(true)
      } catch (e) {
        // ignore
      }
      section.__safetyStickyST = null
    }
    section.querySelectorAll('.body-m[data-lenis-sticky]').forEach((el) => {
      el.removeAttribute('data-lenis-sticky')
    })
  })
}

/**
 * Remplace le sticky CSS Webflow sur `.section_safety .body-m`, incompatible
 * avec le scroll Lenis (ralentissement mesurable sur tout le bloc, image incluse).
 */
export function initSafetySticky(root = document) {
  const scope = getScope(root)
  destroySafetySticky(scope)
  bindSafetyStickyGlobalListeners()

  if (!shouldEnableSafetySticky()) return

  const scroller = getScroller()
  if (!scroller) return

  scope.querySelectorAll('.section_safety').forEach((section) => {
    const bodyM = findStickyParagraph(section)
    if (!bodyM) return

    const stickyWrap =
      bodyM.closest('.sticky-wrap, .is-s-wrap') || bodyM.parentElement
    if (!stickyWrap) return

    bodyM.setAttribute('data-lenis-sticky', 'true')
    section.classList.add('is-lenis-sticky')

    const st = ScrollTrigger.create({
      trigger: bodyM,
      endTrigger: stickyWrap,
      scroller,
      start: () => `top ${resolveStickyTopPx(bodyM)}px`,
      end: () => {
        const topPx = resolveStickyTopPx(bodyM)
        const releasePx = topPx + measureElementHeight(bodyM)
        return `bottom top+=${releasePx}px`
      },
      pin: bodyM,
      pinSpacing: false,
      invalidateOnRefresh: true,
      markers: false,
    })

    section.__safetyStickyST = st
  })

  scheduleSafetyStickyReflow()
}

export function refreshSafetySticky(root = document) {
  initSafetySticky(root)
}
