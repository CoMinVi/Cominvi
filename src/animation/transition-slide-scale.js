import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

import { initContact, initContactHero } from './contact.js'
import { heroAnimation } from './landing.js'
import { addMenuLinksCloseToTimeline } from './nav.js'

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

let lastTopOffsetPx = 0
const easeCurve = 'M0,0 C0.6,0 0,1 1,1 '

// Récupération sûre du thème destination sans ternaires/parenthèses qui gênent Prettier
function getDestinationTheme() {
  try {
    const api = window.__theme
    if (!api || typeof api.getThemeFor !== 'function') return null
    const key = api && api.destinationKey ? api.destinationKey : 'white'
    const t = api.getThemeFor(key)
    return t || null
  } catch (e) {
    return null
  }
}

export function slideScaleLeave({ current }) {
  const currentPage =
    current.container.querySelector('.page-wrap') || current.container
  const rect = currentPage.getBoundingClientRect()
  lastTopOffsetPx = Math.max(0, Math.round(rect.top))

  if (window.lenis && typeof window.lenis.stop === 'function') {
    try {
      window.lenis.stop()
    } catch (err) {
      // ignore
    }
  }

  gsap.set(current.container, {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    y: lastTopOffsetPx,
  })

  return gsap.to(currentPage, {
    xPercent: -100,
    duration: 1.2,
    ease: gsap.parseEase(`custom(${easeCurve})`),
  })
}

export function slideScaleEnter({ next }) {
  const nextPage = next.container.querySelector('.page-wrap') || next.container

  // Initialize Contact page SDK map as early as possible for destination
  try {
    initContact(next && next.container)
  } catch (e) {
    // ignore
  }

  // Ensure next container is on top and visible while we animate its page
  gsap.set(next.container, {
    opacity: 1,
    visibility: 'visible',
    position: 'absolute',
    inset: 0,
    zIndex: 2,
    y: lastTopOffsetPx,
  })

  const viewportWidth = window.innerWidth
  const isTabletOrBelow =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 991px)').matches
  const horizontalGutter = isTabletOrBelow ? 32 : 64
  const targetWidth = Math.max(0, viewportWidth - horizontalGutter)
  const startScale = targetWidth > 0 ? targetWidth / viewportWidth : 1

  // Next page starts to the right and slightly scaled, with rounded corners
  gsap.set(nextPage, { transformOrigin: '50% 0%' })
  gsap.set(nextPage, {
    scale: startScale,
    xPercent: 100,
    borderRadius: '1rem',
  })

  const tl = gsap.timeline()
  tl.to(nextPage, {
    xPercent: 0,
    duration: 1.2,
    ease: gsap.parseEase(`custom(${easeCurve})`),
  })
  tl.addLabel('lift')
  // Ramène la navbar à son offset de base (responsive) en synchro avec le "descale" (lift)
  let navbar = document.querySelector('.navbar')
  if (!navbar && next && next.container && next.container.querySelector) {
    navbar = next.container.querySelector('.navbar')
  }
  if (navbar) {
    tl.to(
      navbar,
      {
        left: getNavbarBaseOffset(),
        right: getNavbarBaseOffset(),
        pointerEvents: 'auto',
        duration: 1.2,
        ease: gsap.parseEase(`custom(${easeCurve})`),
        overwrite: 'auto',
      },
      'lift'
    )
  }
  // Normalize background-inner scale perceptually by compensating page pre-scale
  try {
    const bgInner =
      nextPage.querySelector('.background-inner') ||
      document.querySelector('.background-inner')
    if (bgInner) {
      gsap.set(bgInner, { transformOrigin: '50% 50%' })
      // Scale by 1.2 relative to perceived page scale so effect matches loader
      const targetScale = 1.2
      const compensated = targetScale // page descale will visually cancel pre-scale
      tl.to(
        bgInner,
        {
          scale: compensated,
          transformOrigin: '50% 50%',
          duration: 1.2,
          ease: gsap.parseEase(`custom(${easeCurve})`),
          overwrite: 'auto',
        },
        'lift'
      )
    }
  } catch (err) {
    // ignore
  }
  // Pendant la descale, refermer visuellement les liens du menu
  addMenuLinksCloseToTimeline(tl, 'lift')
  // Anime les h1 spans de la page destination en synchro
  tl.call(
    () => {
      try {
        heroAnimation(next && next.container, {
          duration: 1.2,
          ease: gsap.parseEase(`custom(${easeCurve})`),
        })
        // Contact hero width adjustment at descale-equivalent moment (lift)
        initContactHero(next && next.container, {
          animate: true,
          duration: 1.2,
          ease: gsap.parseEase(`custom(${easeCurve})`),
        })
      } catch (err) {
        // ignore
      }
    },
    [],
    'lift'
  )
  // Scale background-inner during descale (lift)
  try {
    const bgInner =
      nextPage.querySelector('.background-inner') ||
      document.querySelector('.background-inner')
    if (bgInner) {
      gsap.set(bgInner, { transformOrigin: '50% 50%', scale: 1 })
      tl.to(
        bgInner,
        {
          scale: 1.2,
          transformOrigin: '50% 50%',
          duration: 1.2,
          ease: gsap.parseEase(`custom(${easeCurve})`),
          overwrite: 'auto',
        },
        'lift'
      )
    }
  } catch (err) {
    // ignore
  }
  // Compute and apply destination theme at the same moment bars close
  tl.call(
    () => {
      try {
        if (
          window.__theme &&
          typeof window.__theme.setDestination === 'function'
        ) {
          window.__theme.setDestination(next && next.container)
        }
        if (
          window.__theme &&
          typeof window.__theme.applyDestination === 'function'
        ) {
          window.__theme.applyDestination(false)
        }
        // Immediately reflect destination theme on menu-icon during descale
        try {
          const theme = getDestinationTheme()
          const el = document.querySelector('.menu-icon')
          const bars = document.querySelectorAll('.menu-icon_bar')
          if (theme && el) {
            gsap.set(el, {
              backgroundColor: theme.menuIconBg,
              borderColor: theme.menuIconBorder,
              overwrite: 'auto',
            })
          }
          if (theme && bars && bars.length) {
            gsap.set(bars, {
              backgroundColor: theme.menuIconBarsBg,
              overwrite: 'auto',
            })
          }
        } catch (e) {
          // ignore
        }
      } catch (err) {
        // ignore
      }
    },
    [],
    'lift'
  )
  // Animate menu icon back to closed state while destination page descales
  const menuIconElement = document.querySelector('.menu-icon')
  const menuIconBar1 = document.querySelector(
    '.menu-icon_bar.is-1, .menu-icon_bar .is-1'
  )
  const menuIconBar2 = document.querySelector(
    '.menu-icon_bar.is-2, .menu-icon_bar .is-2'
  )
  if (menuIconElement) {
    tl.to(
      menuIconElement,
      {
        gap: '5px',
        rotation: 0,
        duration: 1.2,
        ease: gsap.parseEase(`custom(${easeCurve})`),
      },
      'lift'
    )
  }
  if (menuIconBar1) {
    tl.to(
      menuIconBar1,
      {
        rotation: 0,
        yPercent: 0,
        top: '42%',
        duration: 1.2,
        ease: gsap.parseEase(`custom(${easeCurve})`),
      },
      'lift'
    )
  }
  if (menuIconBar2) {
    tl.to(
      menuIconBar2,
      {
        rotation: 0,
        yPercent: 0,
        bottom: '42%',
        duration: 1.2,
        ease: gsap.parseEase(`custom(${easeCurve})`),
      },
      'lift'
    )
  }
  // Ensure final state after descale: reset icon and bars to initial closed positions
  tl.call(
    () => {
      try {
        const el = document.querySelector('.menu-icon')
        const bar1 = document.querySelector(
          '.menu-icon_bar.is-1, .menu-icon_bar .is-1'
        )
        const bar2 = document.querySelector(
          '.menu-icon_bar.is-2, .menu-icon_bar .is-2'
        )
        if (el) gsap.set(el, { rotation: 0, gap: '5px', overwrite: 'auto' })
        if (bar1)
          gsap.set(bar1, {
            rotation: 0,
            yPercent: 0,
            top: '42%',
            overwrite: 'auto',
          })
        if (bar2)
          gsap.set(bar2, {
            rotation: 0,
            yPercent: 0,
            bottom: '42%',
            overwrite: 'auto',
          })
      } catch (e) {
        // ignore
      }
    },
    [],
    'lift+=1.2'
  )
  tl.to(
    [next.container, nextPage],
    {
      duration: 1.2,
      ease: gsap.parseEase(`custom(${easeCurve})`),
      onComplete: () => {
        gsap.set(next.container, {
          clearProps: 'position,top,left,right,zIndex,visibility,opacity,y',
        })
      },
      y: (i, target) => (target === next.container ? 0 : undefined),
      borderRadius: (i, target) => (target === nextPage ? '0rem' : undefined),
      scale: (i, target) => (target === nextPage ? 1 : undefined),
    },
    'lift'
  )
  return tl
}
