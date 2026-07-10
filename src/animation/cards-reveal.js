import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

let __cardsRevealPageBound = false

const SECTION_SELECTORS = '.section_services, .section_teams'
const CARD_SELECTOR = '.service-card, .team-card'

function getRevealCards(section) {
  return Array.from(section.querySelectorAll(CARD_SELECTOR))
}

function destroyCardsReveal(root = document) {
  const scope = root && root.querySelector ? root : document
  scope.querySelectorAll(SECTION_SELECTORS).forEach((section) => {
    if (section.__cardsRevealScrollTrigger) {
      try {
        section.__cardsRevealScrollTrigger.kill()
      } catch (e) {
        // ignore
      }
      section.__cardsRevealScrollTrigger = null
    }
    if (section.__cardsRevealTween) {
      try {
        section.__cardsRevealTween.kill()
      } catch (e) {
        // ignore
      }
      section.__cardsRevealTween = null
    }
    section.__cardsRevealPlayed = false
    getRevealCards(section).forEach((card) => {
      card.__cardsRevealBound = false
      try {
        gsap.killTweensOf(card)
        gsap.set(card, { clearProps: 'opacity,transform' })
      } catch (e) {
        // ignore
      }
    })
  })
}

async function refreshServiceCardsAfterReveal(root) {
  try {
    const mod = await import('./service-cards.js')
    if (typeof mod.refreshServiceCards === 'function') {
      mod.refreshServiceCards(root)
    }
  } catch (e) {
    // ignore
  }
}

function refreshCardsRevealTriggers() {
  try {
    ScrollTrigger.refresh()
  } catch (e) {
    // ignore
  }
}

export function initCardsViewportReveal(root = document) {
  const scope = root && root.querySelector ? root : document
  const sections = Array.from(scope.querySelectorAll(SECTION_SELECTORS))
  if (!sections.length) return

  destroyCardsReveal(scope)

  const scroller = window.__lenisWrapper || undefined

  sections.forEach((section) => {
    const cards = getRevealCards(section)
    if (!cards.length) return

    gsap.set(cards, {
      opacity: 0,
      y: '2em',
      willChange: 'transform, opacity',
    })
    cards.forEach((card) => {
      card.__cardsRevealBound = true
    })

    const tween = gsap.to(cards, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      stagger: 0.08,
      ease: 'power2.out',
      overwrite: 'auto',
      paused: true,
      onComplete: () => {
        section.__cardsRevealPlayed = true
        cards.forEach((card) => {
          try {
            card.style.willChange = ''
          } catch (e) {
            // ignore
          }
        })
        refreshServiceCardsAfterReveal(scope)
      },
    })

    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top 85%',
      once: true,
      scroller,
      invalidateOnRefresh: true,
      onEnter: () => {
        if (section.__cardsRevealPlayed) return
        tween.play(0)
      },
    })

    section.__cardsRevealTween = tween
    section.__cardsRevealScrollTrigger = st

    requestAnimationFrame(() => {
      try {
        const rect = section.getBoundingClientRect()
        const vh = window.innerHeight || 1
        if (
          rect.top < vh * 0.85 &&
          rect.bottom > 0 &&
          !section.__cardsRevealPlayed
        ) {
          tween.play(0)
        }
      } catch (e) {
        // ignore
      }
    })
  })

  if (!__cardsRevealPageBound) {
    __cardsRevealPageBound = true
    window.addEventListener('page:transition:after', () => {
      requestAnimationFrame(refreshCardsRevealTriggers)
    })
    document.addEventListener('loader:done', refreshCardsRevealTriggers, {
      once: true,
    })
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(refreshCardsRevealTriggers)
  })
}
