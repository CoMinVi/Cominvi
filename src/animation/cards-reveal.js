import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

let __cardsRevealPageBound = false

const SECTION_SELECTORS = '.section_services, .section_teams'
const CARD_SELECTOR = '.service-card, .team-card'

function getRevealCards(section) {
  return Array.from(section.querySelectorAll(CARD_SELECTOR))
}

function getRevealTarget(card) {
  return (
    card.querySelector('.card-inner') ||
    card.querySelector('.team-card_inner') ||
    card
  )
}

function detachLenisRevealCheck(section) {
  if (
    section.__cardsRevealLenisHandler &&
    window.lenis &&
    typeof window.lenis.off === 'function'
  ) {
    try {
      window.lenis.off('scroll', section.__cardsRevealLenisHandler)
    } catch (e) {
      // ignore
    }
    section.__cardsRevealLenisHandler = null
  }
}

function detachCardsRevealObservers(section) {
  detachLenisRevealCheck(section)
  if (section.__cardsRevealObserver) {
    try {
      section.__cardsRevealObserver.disconnect()
    } catch (e) {
      // ignore
    }
    section.__cardsRevealObserver = null
  }
}

function destroyCardsReveal(root = document) {
  const scope = root && root.querySelector ? root : document
  scope.querySelectorAll(SECTION_SELECTORS).forEach((section) => {
    detachCardsRevealObservers(section)
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
      const target = getRevealTarget(card)
      try {
        gsap.killTweensOf(target)
        gsap.set(target, { clearProps: 'opacity,transform' })
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

    const targets = cards.map((card) => {
      const target = getRevealTarget(card)
      if (!card.__cardsRevealBound) {
        gsap.set(target, {
          opacity: 0,
          y: 32,
          willChange: 'transform, opacity',
        })
        card.__cardsRevealBound = true
      }
      return target
    })

    const playReveal = () => {
      if (section.__cardsRevealPlayed) return
      section.__cardsRevealPlayed = true
      detachCardsRevealObservers(section)
      gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.08,
        ease: 'power2.out',
        overwrite: 'auto',
        onComplete: () => {
          targets.forEach((target) => {
            try {
              target.style.willChange = ''
            } catch (e) {
              // ignore
            }
          })
          refreshServiceCardsAfterReveal(scope)
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

    const checkRevealInView = () => {
      try {
        const rect = section.getBoundingClientRect()
        const vh = window.innerHeight || 1
        if (rect.top < vh * 0.85) playReveal()
      } catch (e) {
        // ignore
      }
    }

    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top 85%',
      once: true,
      scroller,
      onEnter: playReveal,
      invalidateOnRefresh: true,
    })
    section.__cardsRevealTrigger = st

    if (window.lenis && typeof window.lenis.on === 'function') {
      const onLenisScroll = () => checkRevealInView()
      window.lenis.on('scroll', onLenisScroll)
      section.__cardsRevealLenisHandler = onLenisScroll
    }

    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) playReveal()
          })
        },
        {
          root: null,
          rootMargin: '0px 0px -15% 0px',
          threshold: 0,
        }
      )
      observer.observe(section)
      section.__cardsRevealObserver = observer
    }

    requestAnimationFrame(() => {
      try {
        ScrollTrigger.refresh()
        checkRevealInView()
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
