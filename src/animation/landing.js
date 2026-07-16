import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

import { requestHeroVideoPlayback } from '../app/hero-media.js'

// Helper local pour éviter les retours d'import/order
function getNavbarBaseOffset() {
  try {
    const isTabletOrBelow =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 991px)').matches
    return isTabletOrBelow ? '1em' : '2em'
  } catch (e) {
    return '2em'
  }
}

function isTabletOrBelowViewport() {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 991px)').matches
    )
  } catch (e) {
    return false
  }
}

gsap.registerPlugin(CustomEase)

const easeCurve = 'M0,0 C0.6,0 0,1 1,1 '

export const HERO_CARDS_REVEAL_DELAY = 0.5
export const HERO_CARDS_REVEAL_DURATION = 1.2
export const HERO_CARDS_MOBILE_SETTLE_MS = 320

export function getHeroCardsRevealEndTime(opts = {}) {
  const duration =
    typeof opts.duration === 'number'
      ? opts.duration
      : HERO_CARDS_REVEAL_DURATION
  return HERO_CARDS_REVEAL_DELAY + duration
}

export function deferAfterHeroCardsSettled(callback) {
  if (typeof callback !== 'function') return

  if (!isTabletOrBelowViewport()) {
    callback()
    return
  }

  const runAfterSettle = () => {
    window.setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            document.dispatchEvent(new CustomEvent('hero:cards-settled'))
          } catch (e) {
            // ignore
          }
          callback()
        })
      })
    }, HERO_CARDS_MOBILE_SETTLE_MS)
  }

  try {
    const tl = window.__heroAnimationTimeline
    const endTime = getHeroCardsRevealEndTime()
    if (tl && typeof tl.time === 'function') {
      const remainingMs = Math.max(0, endTime - tl.time()) * 1000
      if (remainingMs > 0) {
        window.setTimeout(runAfterSettle, remainingMs)
        return
      }
    }
  } catch (e) {
    // ignore
  }

  runAfterSettle()
}

function getHeroCardRevealDistance(card, startPercent) {
  if (!card) return 0
  const height = card.offsetHeight || card.getBoundingClientRect().height || 0
  return height * (startPercent / 100)
}

// Fait slider les .is-h1-span de y:110% à y:0 avec la même durée/ease que le dé-scale
export function heroAnimation(root = document, opts = {}) {
  const scope = root && root.querySelector ? root : document
  try {
    window.__heroAnimationStarted = true
    document.dispatchEvent(new CustomEvent('hero:ready'))
  } catch (err) {
    // ignore
  }
  // Start hero background video immediately (home uses AF sequence instead)
  try {
    const container =
      (scope.querySelector &&
        scope.querySelector('[data-barba="container"]')) ||
      document.querySelector('[data-barba="container"]')
    const namespace =
      (container && container.getAttribute('data-barba-namespace')) || ''
    if (namespace.trim().toLowerCase() !== 'home') {
      requestHeroVideoPlayback(scope)
    }
  } catch (err) {
    // ignore
  }
  const spans = Array.from(scope.querySelectorAll('.is-h1-span'))
  const bodies = Array.from(
    scope.querySelectorAll('.section_hero .body-xl, .eyebrow-l')
  )
  const elements = [...spans, ...bodies]
  const cards = Array.from(scope.querySelectorAll('.section_hero .card'))
  const duration =
    typeof opts.duration === 'number'
      ? opts.duration
      : HERO_CARDS_REVEAL_DURATION
  const ease = opts.ease || gsap.parseEase(`custom(${easeCurve})`)
  const useMobileCardReveal = isTabletOrBelowViewport()

  if (!elements.length && !cards.length) return null

  // Timeline par élément pour remonter l'opacité à 1 juste au démarrage, puis slider
  const tl = gsap.timeline()
  // Si la navbar a été écartée par le scroll, on la ramène à sa position d'origine
  try {
    const navbar =
      scope.querySelector('.navbar') || document.querySelector('.navbar')
    if (navbar) {
      const cs = getComputedStyle(navbar)
      const base = getNavbarBaseOffset()
      const isOffset = cs.left !== base || cs.right !== base
      if (isOffset) {
        tl.to(
          navbar,
          { left: base, right: base, duration, ease, overwrite: 'auto' },
          0
        )
      }
    }
  } catch (err) {
    // ignore
  }
  const each = 0.03
  elements.forEach((el, index) => {
    const position = index * each
    // Rétablit l'opacité (ou visibilité) à 1 au moment où l'anim de cet élément démarre
    tl.set(el, { autoAlpha: 1 }, position)
    // Puis effectue le slide depuis 110% vers 0 en neutralisant tout décalage en pixels
    const startPercent = el.matches('.eyebrow-l') ? 130 : 110
    tl.fromTo(
      el,
      { yPercent: startPercent, y: 0 },
      { yPercent: 0, y: 0, duration, ease, overwrite: 'auto' },
      position
    )
  })

  // Cartes du hero: première depuis 110%, seconde depuis 120%
  if (cards.length) {
    const starts = [110, 120]
    const base = HERO_CARDS_REVEAL_DELAY

    cards.forEach((card, i) => {
      const startPercent = starts[i] != null ? starts[i] : 100
      const pos = base
      const startY = getHeroCardRevealDistance(card, startPercent)

      tl.set(card, { autoAlpha: 1 }, pos)

      if (useMobileCardReveal) {
        // y en pixels: évite les arrondis yPercent + ne touche pas au DOM/layout
        tl.fromTo(
          card,
          { y: startY },
          { y: 0, duration, ease, overwrite: 'auto' },
          pos
        )
      } else {
        tl.fromTo(
          card,
          { yPercent: startPercent },
          { yPercent: 0, duration, ease, overwrite: 'auto' },
          pos
        )
      }
    })
  }

  try {
    window.__heroAnimationTimeline = tl
  } catch (e) {
    // ignore
  }

  return tl
}
