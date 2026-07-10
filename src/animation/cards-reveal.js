import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

let __cardsRevealPageBound = false

const SECTION_SELECTORS = '.section_services, .section_teams'
const CARD_SELECTOR = '.service-card, .team-card'

function getRevealCards(section) {
  return Array.from(section.querySelectorAll(CARD_SELECTOR))
}

function detachSectionListeners(section) {
  if (section.__cardsRevealScrollListener) {
    try {
      window.lenis?.off('scroll', section.__cardsRevealScrollListener)
    } catch (e) {
      // ignore
    }
    section.__cardsRevealScrollListener = null
  }
  if (section.__cardsRevealScrollTrigger) {
    try {
      section.__cardsRevealScrollTrigger.kill()
    } catch (e) {
      // ignore
    }
    section.__cardsRevealScrollTrigger = null
  }
}

function destroyCardsReveal(root = document) {
  const scope = root && root.querySelector ? root : document
  scope.querySelectorAll(SECTION_SELECTORS).forEach((section) => {
    detachSectionListeners(section)
    section.__cardsRevealPlayed = false
    getRevealCards(section).forEach((card) => {
      card.__cardsRevealBound = false
      try {
        gsap.killTweensOf(card)
        gsap.set(card, { clearProps: 'opacity,visibility,transform' })
      } catch (e) {
        // ignore
      }
    })
  })
}

function refreshCardsRevealTriggers() {
  try {
    ScrollTrigger.refresh()
  } catch (e) {
    // ignore
  }
}

function sectionShouldReveal(section) {
  try {
    const rect = section.getBoundingClientRect()
    const vh = window.innerHeight || 1
    return rect.top < vh * 0.85 && rect.bottom > 0
  } catch (e) {
    return false
  }
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

    gsap.set(cards, {
      autoAlpha: 0,
      y: '2em',
      willChange: 'transform, opacity',
    })
    cards.forEach((card) => {
      card.__cardsRevealBound = true
    })

    const playReveal = () => {
      if (section.__cardsRevealPlayed) return
      section.__cardsRevealPlayed = true
      detachSectionListeners(section)

      gsap.to(cards, {
        autoAlpha: 1,
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
    }

    const maybePlay = () => {
      if (sectionShouldReveal(section)) playReveal()
    }

    section.__cardsRevealScrollTrigger = ScrollTrigger.create({
      trigger: section,
      start: 'top 85%',
      once: true,
      scroller,
      invalidateOnRefresh: true,
      onEnter: playReveal,
    })

    const onScroll = () => maybePlay()
    section.__cardsRevealScrollListener = onScroll
    try {
      window.lenis?.on('scroll', onScroll)
    } catch (e) {
      // ignore
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(maybePlay)
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
