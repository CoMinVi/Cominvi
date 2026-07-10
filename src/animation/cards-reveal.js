import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

let __cardsRevealPageBound = false

const SECTION_SELECTORS = '.section_services, .section_teams'
const CARD_SELECTOR = '.service-card, .team-card'
const PENDING_CLASS = 'is-card-reveal-pending'

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
    detachSectionListeners(section)
    section.__cardsRevealPlayed = false
    getRevealCards(section).forEach((card) => {
      card.__cardsRevealBound = false
      card.classList.remove(PENDING_CLASS)
      try {
        gsap.killTweensOf(card)
        gsap.set(card, { clearProps: 'opacity,visibility,transform' })
      } catch (e) {
        // ignore
      }
    })
  })
}

function sectionShouldReveal(section) {
  try {
    const rect = section.getBoundingClientRect()
    const vh = window.innerHeight || 1
    return rect.top < vh * 0.85 && rect.bottom > vh * 0.2
  } catch (e) {
    return false
  }
}

function whenLoaderReady(fn) {
  const run = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(fn)
    })
  }
  if (window.__loaderDone || !document.querySelector('.loader')) {
    run()
    return
  }
  document.addEventListener('loader:done', run, { once: true })
}

function setupCardsReveal(root = document) {
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
      card.classList.add(PENDING_CLASS)
      card.__cardsRevealBound = true
    })

    gsap.set(cards, {
      autoAlpha: 0,
      y: '2em',
      willChange: 'transform, opacity',
    })

    const playReveal = () => {
      if (section.__cardsRevealPlayed) return
      section.__cardsRevealPlayed = true
      detachSectionListeners(section)

      cards.forEach((card) => {
        card.classList.remove(PENDING_CLASS)
      })

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

    if (typeof IntersectionObserver !== 'undefined') {
      section.__cardsRevealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) maybePlay()
          })
        },
        { threshold: 0.01, rootMargin: '0px 0px -10% 0px' }
      )
      section.__cardsRevealObserver.observe(section)
    }

    const onScroll = () => maybePlay()
    section.__cardsRevealScrollListener = onScroll
    try {
      window.lenis?.on('scroll', onScroll)
    } catch (e) {
      // ignore
    }

    maybePlay()
  })

  try {
    ScrollTrigger.refresh()
  } catch (e) {
    // ignore
  }
}

export function initCardsViewportReveal(root = document) {
  whenLoaderReady(() => setupCardsReveal(root))

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
}
