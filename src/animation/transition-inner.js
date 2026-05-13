import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

import { initContact, initContactHero } from './contact.js'
import { heroAnimation } from './landing.js'
import { addMenuLinksCloseToTimeline } from './nav.js'
import {
  createViewportClipOverlay,
  resetOverlayClipBaseState,
  createClipForHost,
  resetHostClipBaseState,
} from './svg-clip-overlay.js'

gsap.registerPlugin(CustomEase)

// keep for parity with slide-scale if needed later
let lastTopOffsetPx = 0 // eslint-disable-line no-unused-vars
let baseTopPx = 0
const easeCurve = 'M0,0 C0.51,0 0,1 1,1'

function setMaskOverlayActive(active) {
  try {
    let container = document.querySelector('.mask-overlay')
    let created = null
    if (!container) {
      created = createViewportClipOverlay({ repeat: 0, yoyo: false })
      container = created && created.container
    }
    if (!container) return
    // Keep a global ref to overlay and its clip timeline
    try {
      const tlRef =
        (created && created.tl) ||
        (container && container.__overlay && container.__overlay.tl) ||
        (window.__maskOverlay && window.__maskOverlay.tl) ||
        null
      window.__maskOverlay = { container, tl: tlRef }
    } catch (e) {
      // ignore
    }
    if (active) {
      try {
        container.classList.add('is-active')
      } catch (e) {
        container.className += ' is-active'
      }
    } else {
      try {
        container.classList.remove('is-active')
      } catch (e) {
        container.className = container.className.replace(/\bis-active\b/, '')
      }
    }
  } catch (err) {
    // ignore
  }
}

// Track clicks on .pt-inner to control overlay display/animation
if (!window.__ptInnerClickListenerAttached) {
  window.__ptInnerClickListenerAttached = true
  const handler = (ev) => {
    try {
      const target = ev.target
      if (target && typeof target.closest === 'function') {
        const match = target.closest('.pt-inner')
        if (match) {
          window.__clickedPtInner = true
          // Reset geometry before making overlay active to ensure correct start state
          try {
            resetOverlayClipBaseState()
          } catch (e) {
            // ignore
          }
          setMaskOverlayActive(true)
          try {
            const container = document.querySelector('.mask-overlay')
            if (container) container.style.left = '0px'
            try {
              const clone = container.querySelector('.mask-overlay_page-info')
              if (clone) clone.style.display = 'flex'
            } catch (e) {
              // ignore
            }
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (err) {
      // ignore
    }
  }
  document.addEventListener('pointerdown', handler, true)
  document.addEventListener('mousedown', handler, true)
  document.addEventListener('touchstart', handler, {
    capture: true,
    passive: true,
  })
  document.addEventListener('click', handler, true)
}

function formatNamespaceName(ns) {
  try {
    return (ns || 'home')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase())
  } catch (err) {
    return ns || 'Home'
  }
}

export function slideScaleLeave({ current }) {
  const currentPage =
    current.container.querySelector('.page-wrap') || current.container
  const rect = currentPage.getBoundingClientRect()
  lastTopOffsetPx = Math.max(0, Math.round(rect.top))
  const pageInfo = document.querySelector('.page-info')
  baseTopPx = pageInfo
    ? Math.max(0, Math.round(pageInfo.getBoundingClientRect().height))
    : 0

  // Update #page-from with current page name
  try {
    const fromEl = document.querySelector('#page-from')
    if (fromEl) {
      const ns = current.container.getAttribute('data-barba-namespace') || ''
      fromEl.textContent = formatNamespaceName(ns)
    }
  } catch (err) {
    // ignore
  }

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
    zIndex: 3,
    y: 0,
  })

  // Pre-scale like nav open, then slide
  const viewportWidth = window.innerWidth
  const isTabletOrMobile =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(max-width: 991px)').matches
  // Compute side margin px using the same logic as clip overlay to keep parity
  function computeRootFontPx() {
    try {
      const cs =
        window.getComputedStyle &&
        window.getComputedStyle(document.documentElement)
      const n = parseFloat((cs && cs.fontSize) || '16')
      return Number.isFinite(n) ? n : 16
    } catch (e) {
      return 16
    }
  }
  function computeSiteMarginPx(rootPx) {
    try {
      const body = document.body || document.documentElement
      const cs = window.getComputedStyle && window.getComputedStyle(body)
      const val = (cs && cs.getPropertyValue('--_spacings---site-margin')) || ''
      const trimmed = String(val || '').trim()
      if (trimmed) {
        if (trimmed.endsWith('px')) {
          const n = parseFloat(trimmed)
          if (Number.isFinite(n)) return n
        }
        if (trimmed.endsWith('em')) {
          const em = parseFloat(trimmed)
          const basePx = parseFloat((cs && cs.fontSize) || String(rootPx || 16))
          const base = Number.isFinite(basePx) ? basePx : 16
          if (Number.isFinite(em)) return em * base
        }
      }
    } catch (e) {
      // ignore
    }
    const base = Number.isFinite(rootPx) ? rootPx : 16
    return (isTabletOrMobile ? 1 : 2) * base
  }
  const rootFontPx = computeRootFontPx()
  const sideMarginPx = computeSiteMarginPx(rootFontPx)
  try {
    window.__ptSideMarginPx = sideMarginPx
  } catch (e) {
    // ignore
  }
  gsap.set(currentPage, { transformOrigin: '50% 0%' })

  const tl = gsap.timeline()
  const preDur = 0.75
  const slideDur = 1.0
  // Ensure body background switches to accent at the very start of the transition
  try {
    tl.set(
      document.body,
      {
        backgroundColor: 'var(--accent)',
      },
      0
    )
  } catch (e) {
    // ignore
  }
  // Sync menu theme to the same as when opening the menu ("menu") at leave start
  tl.call(
    () => {
      try {
        // Lock theme controller (prevents scroll-based theme override)
        try {
          document.documentElement.setAttribute('data-menu-open', 'true')
        } catch (e) {
          // ignore
        }
        if (window.__theme && typeof window.__theme.menuOpen === 'function') {
          window.__theme.menuOpen()
        }
      } catch (e) {
        // ignore
      }
    },
    [],
    0
  )
  // Phase 1: top + scale + radius like nav open
  tl.to(
    currentPage,
    {
      top: baseTopPx,
      // Scale computed from the same side margins as the clip window
      scale:
        Math.max(0, viewportWidth - sideMarginPx * 2) > 0
          ? (viewportWidth - sideMarginPx * 2) / viewportWidth
          : 1,
      borderRadius: '1rem',
      duration: preDur,
      ease: gsap.parseEase(`custom(${easeCurve})`),
      overwrite: 'auto',
    },
    0
  )
  // Phase 2: slide out current page
  tl.addLabel('leave-slide', preDur)
  tl.call(
    () => {
      try {
        window.dispatchEvent(new CustomEvent('pt-leave-slide-start'))
      } catch (e) {
        // ignore
      }
    },
    [],
    'leave-slide'
  )
  tl.to(
    currentPage,
    {
      // Déplacement géométrique simple: 100vw - 2em (sans compensation de pre-scale)
      x: (function () {
        const twoEmPx = 1 * (Number.isFinite(rootFontPx) ? rootFontPx : 16)
        const distancePx = Math.max(0, viewportWidth - twoEmPx)
        return -distancePx
      })(),
      duration: slideDur,
      ease: gsap.parseEase(`custom(${easeCurve})`),
    },
    'leave-slide'
  )
  // Animate page-info: during position move to top (y:0), then lift up during slide
  tl.to(
    '.page-info_inner',
    {
      y: 0,
      duration: preDur,
      ease: gsap.parseEase(`custom(${easeCurve})`),
      overwrite: 'auto',
    },
    0
  )
  tl.to(
    '.page-info_inner',
    {
      y: '-7.5em',
      duration: slideDur,
      ease: gsap.parseEase(`custom(${easeCurve})`),
      overwrite: 'auto',
    },
    preDur
  )
  // No overlay slide here; mask will be applied on destination during enter
  return tl
}

export function slideScaleEnter({ next }) {
  const nextPage = next.container.querySelector('.page-wrap') || next.container

  // Initialize Contact page SDK map as early as possible for destination
  try {
    initContact(next && next.container)
  } catch (e) {
    // ignore
  }

  // Update #page-to with destination page name
  try {
    const toEl = document.querySelector('#page-to')
    if (toEl) {
      const ns = next.container.getAttribute('data-barba-namespace') || ''
      toEl.textContent = formatNamespaceName(ns)
    }
  } catch (err) {
    // ignore
  }

  // Destination under current
  gsap.set(next.container, {
    opacity: 1,
    visibility: 'visible',
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    top: 0,
    y: 0,
  })

  // Prepare timeline and labels before any calls
  const tl = gsap.timeline()
  // Durations
  const preDur = 1.0 // duration of lift-related tweens
  const slideDur = 1.0 // duration of slide-related tweens
  // Align start time of incoming slide with the outgoing slide start (0.75s)
  const liftStart = 0.75
  const liftDur = preDur
  const descaleStart = liftStart + liftDur // 1.75s
  tl.addLabel('lift', liftStart)
  tl.addLabel('descale', descaleStart)

  // Ensure menu-icon shows a primary border during the first phase (before descale)
  tl.call(
    () => {
      try {
        const el = document.querySelector('.menu-icon')
        const bars = document.querySelectorAll('.menu-icon_bar')
        if (el) {
          gsap.set(el, { borderColor: 'var(--primary)', overwrite: 'auto' })
        }
        if (bars && bars.length) {
          gsap.set(bars, {
            backgroundColor: 'var(--primary)',
            overwrite: 'auto',
          })
        }
      } catch (e) {
        // ignore
      }
    },
    [],
    0
  )

  // Ensure the mask is applied to destination as soon as it appears (t=0)
  tl.call(
    () => {
      try {
        const host = nextPage
        if (host) {
          let tries = 0
          const maxTries = 20 // ~333ms @ 60fps
          const attemptInit = () => {
            try {
              const rect = host.getBoundingClientRect()
              const ready = rect && rect.width > 1 && rect.height > 1
              if (!ready && tries < maxTries) {
                tries += 1
                return window.requestAnimationFrame(attemptInit)
              }
              const clip = createClipForHost(host, { repeat: 0, yoyo: false })
              if (clip) {
                resetHostClipBaseState(host, baseTopPx)
                try {
                  const rect2 = host.getBoundingClientRect()
                  let measured = 0
                  if (
                    rect2 &&
                    Number.isFinite(rect2.width) &&
                    rect2.width > 0
                  ) {
                    measured = rect2.width
                  } else if (
                    typeof window !== 'undefined' &&
                    Number.isFinite(window.innerWidth) &&
                    window.innerWidth > 0
                  ) {
                    measured = window.innerWidth
                  }
                  const hostW = measured > 1 ? measured : 1
                  window.__ptDestW = hostW
                } catch (e) {
                  // ignore
                }
              }
            } catch (e) {
              // ignore
            }
          }
          window.requestAnimationFrame(attemptInit)
        }
      } catch (err) {
        // ignore
      }
    },
    [],
    0
  )

  // Destination appears without pre-scale or top offset (no incoming slide)
  gsap.set(nextPage, { transformOrigin: '50% 0%' })

  // Démarrer le slide de la fenêtre de clip au même label 'lift' et sur la même timeline
  const clipProxy = { x: 1 }
  let clipTargetX = 0
  // Remettre la géométrie du clip à l'instant 'lift' puis animer via le même timeline
  tl.call(
    () => {
      try {
        const host = nextPage
        if (!host) return
        let clip = host.__clip
        if (!clip) {
          clip = createClipForHost(host, { repeat: 0, yoyo: false })
        }
        if (clip && clip.animState) {
          resetHostClipBaseState(host, baseTopPx)
          try {
            clipTargetX = clip.animState.x || 0
          } catch (e2) {
            clipTargetX = 0
          }
          clip.animState.x = 1
        }
      } catch (e) {
        // ignore
      }
    },
    [],
    'lift'
  )
  tl.to(
    clipProxy,
    {
      x: () => clipTargetX,
      duration: slideDur,
      ease: gsap.parseEase(`custom(${easeCurve})`),
      onUpdate: () => {
        try {
          const host = nextPage
          const clip = host && host.__clip
          if (
            clip &&
            clip.animState &&
            clip.clipPathRect &&
            clip.buildInsidePath
          ) {
            clip.animState.x = clipProxy.x
            const derivedY = 1 - clip.animState.h
            clip.clipPathRect.setAttribute(
              'd',
              clip.buildInsidePath(
                clip.animState.x,
                derivedY,
                clip.animState.w,
                clip.animState.h,
                clip.animState.rX,
                clip.animState.rY
              )
            )
          }
        } catch (e) {
          // ignore
        }
      },
    },
    'lift'
  )

  // Note: do not slide the destination container; the clip window handles the perceived slide.

  // Apply clip-path directly on destination page at descale (animate to fullscreen)
  tl.call(
    () => {
      try {
        const host = nextPage
        if (host) {
          let clip = host.__clip
          if (!clip) {
            clip = createClipForHost(host, { repeat: 0, yoyo: false })
          }
          if (clip && clip.tl) {
            // Use baseTopPx from leave (page-info height) as the top reference
            resetHostClipBaseState(host, baseTopPx)
            clip.tl.pause(0)
            // Scale background-inner during descale
            try {
              const bgInner =
                host.querySelector('.background-inner') ||
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
                  'descale'
                )
              }
            } catch (e) {
              // ignore
            }
            try {
              clip.tl.eventCallback('onComplete', () => {
                try {
                  // Final cleanup after transition fully ends
                  // 1) Hide page-info again
                  try {
                    const pi = document.querySelector('.page-info')
                    if (pi) pi.style.display = 'none'
                  } catch (e) {
                    // ignore
                  }
                  // 2) Reset destination label position
                  gsap.set('#page-to', { y: 0 })
                  // 3) Restore base offset of page-info_inner
                  gsap.set('.page-info_inner', { y: '7.5em' })
                  // 4) Restore body background to primary after transition completes
                  try {
                    gsap.set(document.body, {
                      backgroundColor: 'var(--primary)',
                    })
                  } catch (e2) {
                    // ignore
                  }
                } catch (e) {
                  // ignore
                }
              })
            } catch (e) {
              // ignore
            }
            clip.tl.play(0)
          }
        }
      } catch (err) {
        // ignore
      }
    },
    [],
    'descale'
  )
  // Pendant la descale, refermer visuellement les liens du menu
  addMenuLinksCloseToTimeline(tl, 'lift')
  // Anime les h1 spans de la page destination en synchro (au moment du descale)
  tl.call(
    () => {
      try {
        heroAnimation(next && next.container, {
          duration: 1.2,
          ease: gsap.parseEase(`custom(${easeCurve})`),
        })
        // Contact hero width adjustment at descale with matching timing/easing
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
    'descale'
  )
  // Apply destination theme only during descale (keep 'menu' theme until then)
  tl.call(
    () => {
      try {
        // Unlock theme controller and apply destination
        try {
          document.documentElement.setAttribute('data-menu-open', 'false')
        } catch (e) {
          // ignore
        }
        try {
          if (
            window.__theme &&
            typeof window.__theme.setIconThemeSuppressed === 'function'
          ) {
            // Allow icon colors to follow destination theme from descale on
            window.__theme.setIconThemeSuppressed(false)
          }
        } catch (e) {
          // ignore
        }
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
      } catch (err) {
        // ignore
      }
    },
    [],
    'descale'
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
        duration: liftDur,
        ease: gsap.parseEase(`custom(${easeCurve})`),
      },
      'lift'
    )
  }
  if (menuIconBar1) {
    tl.to(
      menuIconBar1,
      {
        backgroundColor: 'var(--primary)',
        rotation: 0,
        yPercent: 0,
        top: '42%',
        duration: liftDur,
        ease: gsap.parseEase(`custom(${easeCurve})`),
      },
      'lift'
    )
  }
  if (menuIconBar2) {
    tl.to(
      menuIconBar2,
      {
        backgroundColor: 'var(--primary)',
        rotation: 0,
        yPercent: 0,
        bottom: '42%',
        duration: liftDur,
        ease: gsap.parseEase(`custom(${easeCurve})`),
      },
      'lift'
    )
  }
  // Animate page-info during the slide window
  const pageInfoLiftY = '-7.5em'
  tl.to(
    '.page-info_inner',
    {
      y: pageInfoLiftY,
      duration: slideDur,
      ease: gsap.parseEase(`custom(${easeCurve})`),
    },
    'lift'
  )
  // During descale, move destination page name down by 7.5em
  tl.to(
    '#page-to',
    {
      y: '7.5em',
      duration: 1.2,
      ease: gsap.parseEase(`custom(${easeCurve})`),
    },
    'descale'
  )
  // After slide window, perform cleanup without descale on destination
  tl.call(
    () => {
      try {
        gsap.set(next.container, {
          clearProps: 'position,top,left,right,zIndex,visibility,opacity,y',
        })
      } catch (e) {
        // ignore
      }
      // Keep page-info transform until it is hidden externally
      // Do NOT remove .is-active here; it is removed in the clip timeline onComplete
    },
    [],
    liftStart + slideDur
  )
  return tl
}
