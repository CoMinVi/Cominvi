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

function detachCardTriggers(card) {
  if (card.__cardsRevealScrollTrigger) {
    try {
      card.__cardsRevealScrollTrigger.kill()
    } catch (e) {
      // ignore
    }
    card.__cardsRevealScrollTrigger = null
  }
  if (card.__cardsRevealTween) {
    try {
      card.__cardsRevealTween.kill()
    } catch (e) {
      // ignore
    }
    card.__cardsRevealTween = null
  }
}

function destroyCardsReveal(root = document) {
  const scope = root && root.querySelector ? root : document
  scope.querySelectorAll(SECTION_SELECTORS).forEach((section) => {
    getRevealCards(section).forEach((card) => {
      detachCardTriggers(card)
      card.__cardsRevealPlayed = false
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
    const cards = getRevealCards(section)
    if (!cards.length) return

    cards.forEach((card) => {
      card.__cardsRevealPlayed = false
      card.classList.add(PENDING_CLASS)
      card.__cardsRevealBound = true

      const tween = gsap.fromTo(
        card,
        {
          autoAlpha: 0,
          y: '2em',
        },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          ease: 'power2.out',
          immediateRender: false,
          onStart: () => {
            card.__cardsRevealPlayed = true
            card.classList.remove(PENDING_CLASS)
          },
          onComplete: () => {
            try {
              card.style.willChange = ''
            } catch (e) {
              // ignore
            }
            if (card.classList.contains('service-card')) {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  refreshServiceCardsAfterReveal(card)
                })
              })
            }
          },
          scrollTrigger: {
            trigger: card,
            start: 'top 85%',
            once: true,
            scroller,
            invalidateOnRefresh: true,
          },
        }
      )

      card.__cardsRevealTween = tween
      card.__cardsRevealScrollTrigger = tween.scrollTrigger
    })
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
