import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

function getScope(root = document) {
  return root && root.querySelector ? root : document
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

function findStickyParagraph(section) {
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

  const scroller = getScroller()
  if (!scroller) return

  scope.querySelectorAll('.section_safety').forEach((section) => {
    const bodyM = findStickyParagraph(section)
    if (!bodyM) return

    const stickyWrap =
      bodyM.closest('.sticky-wrap, .is-s-wrap') || bodyM.parentElement
    if (!stickyWrap) return

    const stickyTopPx = parseStickyTopPx(bodyM)
    bodyM.setAttribute('data-lenis-sticky', 'true')
    section.classList.add('is-lenis-sticky')

    const st = ScrollTrigger.create({
      trigger: bodyM,
      endTrigger: stickyWrap,
      scroller,
      start: () => `top ${stickyTopPx}px`,
      end: () => {
        const releasePx = stickyTopPx + (bodyM.offsetHeight || 0)
        return `bottom top+=${releasePx}px`
      },
      pin: bodyM,
      pinSpacing: false,
      invalidateOnRefresh: true,
      markers: false,
    })

    section.__safetyStickyST = st
  })
}
