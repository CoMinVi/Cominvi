import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

import { heroAnimation } from './landing.js'
import { addMenuLinksCloseToTimeline } from './nav.js'
import {
  createViewportClipOverlay,
  playOverlayClipOnceWithTop,
  resetOverlayClipBaseState,
} from './svg-clip-overlay.js'

gsap.registerPlugin(CustomEase)

// keep for parity with slide-scale if needed later
let lastTopOffsetPx = 0 // eslint-disable-line no-unused-vars
let baseTopPx = 0
const easeCurve = 'M0,0 C0.6,0 0,1 1,1 '

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
  gsap.set(currentPage, { transformOrigin: '50% 0%' })

  const tl = gsap.timeline()
  const preDur = 1.2
  const slideDur = 1.2
  // Phase 1: top + scale + radius like nav open
  tl.to(
    currentPage,
    {
      top: baseTopPx,
      // keep scale change as previously defined by nav-open parity
      // remove if not needed
      scale:
        Math.max(0, viewportWidth - 64) > 0
          ? (viewportWidth - 64) / viewportWidth
          : 1,
      borderRadius: '1rem',
      duration: preDur,
      ease: gsap.parseEase(`custom(${easeCurve})`),
      overwrite: 'auto',
    },
    0
  )
  // Ensure overlay element exists and initial position
  let overlayTarget = null
  try {
    overlayTarget = document.querySelector('.mask-overlay')
    if (!overlayTarget) {
      const created = createViewportClipOverlay({ repeat: 0, yoyo: false })
      overlayTarget = created && created.container
    }
  } catch (e) {
    overlayTarget = null
  }
  if (overlayTarget) {
    tl.set(overlayTarget, { left: '0px', display: 'block' }, 0)
  }
  tl.call(
    () => {
      try {
        const el = document.querySelector('.mask-overlay')
        if (el) {
          // Timeline started
        }
      } catch (e) {
        // ignore
      }
    },
    [],
    0
  )
  // Phase 2: slide out (current page as before) and slide overlay in sync (left: 0 -> -50vw)
  tl.to(currentPage, {
    xPercent: -100,
    duration: slideDur,
    ease: gsap.parseEase(`custom(${easeCurve})`),
  })
  if (overlayTarget) {
    tl.to(
      overlayTarget,
      {
        left: () => `${-1 * window.innerWidth}px`,
        duration: slideDur,
        ease: gsap.parseEase(`custom(${easeCurve})`),
        overwrite: 'auto',
      },
      '<'
    )
  }
  // Immediately after the overlay slide completes, play the rectangle clip animation once
  tl.call(() => {
    try {
      // Use the same top offset as the departing page baseTopPx
      playOverlayClipOnceWithTop(baseTopPx, true)
    } catch (e) {
      /* ignore */
    }
  })
  // Immediately after the overlay slide completes, play the rectangle clip animation once
  tl.call(() => {
    try {
      const ref = window.__maskOverlay
      if (ref && ref.tl) {
        ref.tl.pause(0)
        ref.tl.play(0)
      }
    } catch (e) {
      // ignore
    }
  })
  return tl
}

export function slideScaleEnter({ next }) {
  const nextPage = next.container.querySelector('.page-wrap') || next.container

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

  // no-op; previously used values removed

  // Destination appears without pre-scale or top offset (no incoming slide)
  gsap.set(nextPage, { transformOrigin: '50% 0%' })

  const tl = gsap.timeline()
  const preDur = 1.2
  const slideDur = 1.2
  // No top offset / scale for destination at start
  // No incoming slide; current page handles the slide out
  tl.addLabel('lift', preDur)
  tl.addLabel('descale', preDur + slideDur)

  // Overlay visibility and play clip once at descale
  tl.call(
    () => {
      try {
        const container = document.querySelector('.mask-overlay')
        if (window.__clickedPtInner) {
          if (container) {
            try {
              container.classList.add('is-active')
            } catch (e) {
              // ignore
            }
            container.style.left = '0px'
          } else {
            const { container: c, tl: ctl } = createViewportClipOverlay({
              fill: 'var(--accent)',
              repeat: 0,
              yoyo: false,
            })
            try {
              c.classList.add('is-active')
            } catch (e) {
              // ignore
            }
            c.style.left = '0px'
            try {
              ctl.pause(0)
              ctl.play(0)
            } catch (e) {
              // ignore
            }
            window.__maskOverlay = { container: c, tl: ctl }
          }
          // If overlay TL exists globally, play once
          try {
            if (window.__maskOverlay && window.__maskOverlay.tl) {
              window.__maskOverlay.tl.pause(0)
              window.__maskOverlay.tl.play(0)
            }
          } catch (e) {
            // ignore
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
      } catch (err) {
        // ignore
      }
    },
    [],
    'descale'
  )
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
  // Animate page-info during the slide window
  tl.to(
    '.page-info_inner',
    {
      y: '-4.5em',
      duration: slideDur,
      ease: gsap.parseEase(`custom(${easeCurve})`),
    },
    'lift'
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
      try {
        gsap.set('.page-info_inner', { y: 0 })
      } catch (e) {
        // ignore
      }
      // Do NOT remove .is-active here; it is removed in the clip timeline onComplete
    },
    [],
    preDur + slideDur
  )
  return tl
}
