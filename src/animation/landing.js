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

gsap.registerPlugin(CustomEase)

const easeCurve = 'M0,0 C0.6,0 0,1 1,1 '

// Fait slider les .is-h1-span de y:110% à y:0 avec la même durée/ease que le dé-scale
export function heroAnimation(root = document, opts = {}) {
  const scope = root && root.querySelector ? root : document
  // Start hero background video immediately
  try {
    requestHeroVideoPlayback(scope)
  } catch (err) {
    // ignore
  }
  const spans = Array.from(scope.querySelectorAll('.is-h1-span'))
  const bodies = Array.from(
    scope.querySelectorAll('.section_hero .body-xl, .eyebrow-l')
  )
  const elements = [...spans, ...bodies]
  if (!elements.length) return
  const duration = typeof opts.duration === 'number' ? opts.duration : 1.2
  const ease = opts.ease || gsap.parseEase(`custom(${easeCurve})`)

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

  // Cartes du hero: première depuis 120%, seconde depuis 100%
  const cards = Array.from(scope.querySelectorAll('.section_hero .card'))
  if (cards.length) {
    const starts = [110, 120]
    // Démarrer les cartes 500ms après le début des animations de texte
    const base = 0.5
    cards.forEach((card, i) => {
      const startPercent = starts[i] != null ? starts[i] : 100
      const pos = base
      tl.set(card, { autoAlpha: 1 }, pos)
      tl.fromTo(
        card,
        { yPercent: startPercent, y: 0 },
        { yPercent: 0, y: 0, duration, ease, overwrite: 'auto' },
        pos
      )
    })
  }
}
