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

function detachSectionTriggers(section) {
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
}

function destroyCardsReveal(root = document) {
  const scope = root && root.querySelector ? root : document
  scope.querySelectorAll(SECTION_SELECTORS).forEach((section) => {
    detachSectionTriggers(section)
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

function whenLoaderReady(fn) {
  const run = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        try {
          const mod = await import('./service-cards.js')
          if (mod.refreshServiceCards) {
            mod.refreshServiceCards(document)
          }
        } catch (e) {
          // ignore
        }
        fn()
      })
    })
  }
  if (window.__loaderDone || !document.querySelector('.loader')) {
    run()
    return
  }
  document.addEventListener('loader:done', run, { once: true })
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

    const tween = gsap.fromTo(
      cards,
      {
        autoAlpha: 0,
        y: '2em',
      },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.08,
        ease: 'power2.out',
        immediateRender: false,
        onStart: () => {
          section.__cardsRevealPlayed = true
          cards.forEach((card) => {
            card.classList.remove(PENDING_CLASS)
          })
        },
        onComplete: () => {
          cards.forEach((card) => {
            try {
              card.style.willChange = ''
            } catch (e) {
              // ignore
            }
          })
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              refreshServiceCardsAfterReveal(scope)
            })
          })
        },
        scrollTrigger: {
          trigger: section,
          start: 'top 85%',
          once: true,
          scroller,
          invalidateOnRefresh: true,
        },
      }
    )

    section.__cardsRevealTween = tween
    section.__cardsRevealScrollTrigger = tween.scrollTrigger
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
