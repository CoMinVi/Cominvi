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
    if (section.__cardsRevealTrigger) {
      try {
        section.__cardsRevealTrigger.kill()
      } catch (e) {
        // ignore
      }
      section.__cardsRevealTrigger = null
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

export function initCardsViewportReveal(root = document) {
  const scope = root && root.querySelector ? root : document
  const sections = Array.from(scope.querySelectorAll(SECTION_SELECTORS))
  if (!sections.length) return

  destroyCardsReveal(scope)

  const scroller = window.__lenisWrapper || undefined

  sections.forEach((section) => {
    section.__cardsRevealPlayed = false
    const cards = getRevealCards(section)
    if (!cards.length) return

    cards.forEach((card) => {
      if (card.__cardsRevealBound) return
      gsap.set(card, { opacity: 0, y: 32, willChange: 'transform, opacity' })
      card.__cardsRevealBound = true
    })

    const playReveal = () => {
      if (section.__cardsRevealPlayed) return
      section.__cardsRevealPlayed = true
      gsap.to(cards, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.08,
        ease: 'power2.out',
        overwrite: 'auto',
        onComplete: () => {
          cards.forEach((card) => {
            try {
              card.style.willChange = ''
            } catch (e) {
              // ignore
            }
          })
        },
      })
      if (section.__cardsRevealTrigger) {
        try {
          section.__cardsRevealTrigger.kill()
        } catch (e) {
          // ignore
        }
        section.__cardsRevealTrigger = null
      }
    }

    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top 85%',
      once: true,
      scroller,
      onEnter: playReveal,
    })
    section.__cardsRevealTrigger = st

    requestAnimationFrame(() => {
      try {
        const rect = section.getBoundingClientRect()
        const vh = window.innerHeight || 1
        if (rect.top < vh * 0.85) playReveal()
      } catch (e) {
        // ignore
      }
    })
  })

  if (!__cardsRevealPageBound) {
    __cardsRevealPageBound = true
    window.addEventListener('page:transition:after', () => {
      requestAnimationFrame(() => {
        try {
          ScrollTrigger.refresh()
        } catch (e) {
          // ignore
        }
      })
    })
  }

  try {
    ScrollTrigger.refresh()
  } catch (e) {
    // ignore
  }
}
