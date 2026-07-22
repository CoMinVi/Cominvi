import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

// Minimal Lenis + ScrollTrigger setup using .page-wrap and .content-wrap
export function initLenis(root = document) {
  const wrapper =
    root.querySelector('.page-wrap') || document.querySelector('.page-wrap')
  const content =
    root.querySelector('.content-wrap') ||
    document.querySelector('.content-wrap')

  if (!wrapper || !content) {
    return null
  }

  const prefersCoarsePointer = (() => {
    try {
      return (
        window.matchMedia('(pointer: coarse)').matches ||
        window.matchMedia('(hover: none)').matches
      )
    } catch (e) {
      return false
    }
  })()

  const lenis = new Lenis({
    wrapper,
    content,
    lerp: 0.125,
    smoothWheel: true,
    // syncTouch is required in wrapper mode: .page-wrap uses overflow:hidden,
    // so native touch scroll cannot work when Lenis ignores touch gestures.
    syncTouch: true,
    // Slightly snappier touch response on mobile without disabling scroll.
    syncTouchLerp: prefersCoarsePointer ? 0.15 : 0.075,
    // Ensure input events are bound to the wrapper in wrapper mode
    wheelEventsTarget: wrapper,
  })
  window.lenis = lenis
  window.__lenisWrapper = wrapper

  // If a pt-inner clip hold is active, keep the fresh instance stopped
  // and re-bind hard lock listeners onto the new wrapper.
  try {
    if (window.__lenisHeldForClip || window.__hardScrollLockActive) {
      if (typeof lenis.stop === 'function') lenis.stop()
      // New page always starts at top; freeze lock position there
      try {
        window.__hardScrollLockY = 0
        wrapper.scrollTop = 0
      } catch (err) {
        // ignore
      }
      lockLenisScrollToWhileHeld()
      applyHardScrollLock()
    }
  } catch (err) {
    // ignore
  }

  // Synchronize Lenis with ScrollTrigger
  lenis.on('scroll', () => {
    ScrollTrigger.update()
  })

  // Drive Lenis from GSAP ticker to keep ScrollTrigger/Lenis perfectly in sync
  const tickerRaf = (time) => {
    try {
      // GSAP ticker sends seconds, Lenis expects milliseconds
      lenis.raf(time * 1000)
    } catch (err) {
      // ignore
    }
  }
  gsap.ticker.add(tickerRaf)
  // Prevent GSAP lag compensation from desyncing smooth scroll timing
  gsap.ticker.lagSmoothing(0)
  window.__lenisTickerRaf = tickerRaf

  // Let ScrollTrigger know how to handle the custom scroller (wrapper)
  ScrollTrigger.scrollerProxy(wrapper, {
    scrollTop(value) {
      if (arguments.length) {
        try {
          lenis.scrollTo(value, { immediate: true })
        } catch (err) {
          wrapper.scrollTop = value
        }
      }
      // Report Lenis' virtual scroll position for consistency
      try {
        return typeof lenis.scroll === 'number'
          ? lenis.scroll
          : wrapper.scrollTop
      } catch (err) {
        return wrapper.scrollTop
      }
    },
    getBoundingClientRect() {
      return {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      }
    },
    // Always use transform-based pinning because `.page-wrap` is animated/scaled
    // by the menu, and "fixed" pinning breaks inside transformed ancestors.
    pinType: 'transform',
  })

  // Default all ScrollTriggers to use the Lenis wrapper as scroller
  ScrollTrigger.defaults({ scroller: wrapper })
  // Force scroll position to the very top on init to avoid residual offsets
  try {
    // Hard reset any native positions (fallbacks)
    wrapper.scrollTop = 0
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  } catch (e) {
    // ignore
  }
  try {
    // Immediate reset for Lenis' virtual position
    if (typeof lenis.scrollTo === 'function') {
      lenis.scrollTo(0, { immediate: true })
    }
  } catch (e) {
    // ignore
  }
  // Some browsers (iOS/Safari) need a second frame to settle layout before refresh
  requestAnimationFrame(() => {
    try {
      if (typeof lenis.scrollTo === 'function') {
        lenis.scrollTo(0, { immediate: true })
      }
    } catch (e) {
      // ignore
    }
    try {
      ScrollTrigger.refresh()
    } catch (e) {
      // ignore
    }
  })

  return lenis
}

export function destroyLenis() {
  // Do not clear clip-hold watchers while a transition lock is active —
  // Barba swaps Lenis mid-transition and the hold must survive.
  if (!(window.__lenisHeldForClip || window.__hardScrollLockActive)) {
    try {
      if (window.__lenisClipHoldTimeout) {
        clearTimeout(window.__lenisClipHoldTimeout)
        window.__lenisClipHoldTimeout = null
      }
    } catch (err) {
      // ignore
    }
    try {
      if (window.__lenisClipPoll) {
        clearInterval(window.__lenisClipPoll)
        window.__lenisClipPoll = null
      }
    } catch (err) {
      // ignore
    }
  }
  // Keep __lenisHeldForClip: initLenis must re-apply the hold on the new instance
  try {
    if (window.__lenisTickerRaf) {
      gsap.ticker.remove(window.__lenisTickerRaf)
      window.__lenisTickerRaf = null
    }
  } catch (err) {
    // ignore
  }
  try {
    if (window.lenis && typeof window.lenis.destroy === 'function') {
      window.lenis.destroy()
    }
  } catch (err) {
    // ignore
  }
  try {
    window.lenis = null
  } catch (err) {
    // ignore
  }
}

export function stopLenis() {
  try {
    if (window.lenis && typeof window.lenis.stop === 'function') {
      window.lenis.stop()
    }
  } catch (err) {
    // ignore
  }
}

export function startLenis() {
  try {
    if (window.__lenisHeldForClip || window.__hardScrollLockActive) return
    if (window.lenis && typeof window.lenis.start === 'function') {
      window.lenis.start()
    }
  } catch (err) {
    // ignore
  }
}

function resolveClipHost(hostEl) {
  try {
    if (hostEl && hostEl.__clip) return hostEl
    if (hostEl && typeof hostEl.querySelector === 'function') {
      const nested = hostEl.querySelector('.page-wrap')
      if (nested && nested.__clip) return nested
      if (hostEl.classList && hostEl.classList.contains('page-wrap')) {
        return hostEl
      }
    }
    const fallback = document.querySelector('.page-wrap')
    return fallback || hostEl || null
  } catch (err) {
    return hostEl || null
  }
}

function getScrollLockTargets() {
  const targets = [window, document, document.documentElement, document.body]
  try {
    document.querySelectorAll('.page-wrap, .content-wrap').forEach((el) => {
      targets.push(el)
    })
  } catch (err) {
    // ignore
  }
  if (window.__lenisWrapper) targets.push(window.__lenisWrapper)
  return targets.filter(Boolean)
}

function applyHardScrollLock() {
  try {
    window.__lenisHeldForClip = true
  } catch (err) {
    // ignore
  }
  stopLenis()
  lockLenisScrollToWhileHeld()

  const wasActive = !!window.__hardScrollLockActive
  try {
    window.__hardScrollLockActive = true
  } catch (err) {
    // ignore
  }

  // Freeze CSS overflow / touch-action (iOS ignores Lenis.stop for native gestures).
  // Re-apply after Barba swaps so the new .page-wrap is also locked.
  try {
    const wraps = Array.from(
      document.querySelectorAll('.page-wrap, .content-wrap')
    )
    if (!wasActive || !window.__hardScrollLockStyles) {
      window.__hardScrollLockStyles = {
        htmlOverflow: document.documentElement.style.overflow,
        htmlTouch: document.documentElement.style.touchAction,
        htmlOverscroll: document.documentElement.style.overscrollBehavior,
        bodyOverflow: document.body.style.overflow,
        bodyTouch: document.body.style.touchAction,
        bodyOverscroll: document.body.style.overscrollBehavior,
        wraps: [],
      }
      try {
        window.__hardScrollLockY =
          window.lenis && typeof window.lenis.scroll === 'number'
            ? window.lenis.scroll
            : window.__lenisWrapper
            ? window.__lenisWrapper.scrollTop
            : window.scrollY || 0
      } catch (err) {
        window.__hardScrollLockY = 0
      }
    }
    const saved = window.__hardScrollLockStyles
    const known = new Set((saved.wraps || []).map((entry) => entry.el))
    wraps.forEach((el) => {
      if (!known.has(el)) {
        saved.wraps.push({
          el,
          overflow: el.style.overflow,
          touch: el.style.touchAction,
          overscroll: el.style.overscrollBehavior,
        })
        known.add(el)
      }
      el.style.setProperty('overflow', 'hidden')
      el.style.setProperty('touch-action', 'none')
      el.style.setProperty('overscroll-behavior', 'none')
    })
    document.documentElement.style.setProperty('overflow', 'hidden')
    document.body.style.setProperty('overflow', 'hidden')
    document.documentElement.style.setProperty('touch-action', 'none')
    document.body.style.setProperty('touch-action', 'none')
    document.documentElement.style.setProperty('overscroll-behavior', 'none')
    document.body.style.setProperty('overscroll-behavior', 'none')
  } catch (err) {
    // ignore
  }

  // Block native wheel / touch scrolling at capture phase
  try {
    if (!window.__hardScrollLockBlocker) {
      window.__hardScrollLockBlocker = (event) => {
        if (!(window.__lenisHeldForClip || window.__hardScrollLockActive)) {
          return
        }
        try {
          event.preventDefault()
        } catch (err) {
          // ignore
        }
        try {
          event.stopPropagation()
        } catch (err) {
          // ignore
        }
        // Snap scroll back if anything slipped through (iOS rubber-band)
        try {
          const y =
            typeof window.__hardScrollLockY === 'number'
              ? window.__hardScrollLockY
              : 0
          if (window.__lenisWrapper) {
            window.__lenisWrapper.scrollTop = y
          }
          if (
            window.lenis &&
            typeof window.lenis.__clipHoldOriginalScrollTo === 'function'
          ) {
            window.lenis.__clipHoldOriginalScrollTo(y, { immediate: true })
          }
          window.scrollTo(0, 0)
        } catch (err) {
          // ignore
        }
      }
    }
    const blocker = window.__hardScrollLockBlocker
    const opts = { passive: false, capture: true }
    const prevTargets = window.__hardScrollLockTargets || []
    const nextTargets = getScrollLockTargets()
    const prevSet = new Set(prevTargets)
    nextTargets.forEach((target) => {
      if (prevSet.has(target)) return
      try {
        target.addEventListener('touchmove', blocker, opts)
        target.addEventListener('wheel', blocker, opts)
      } catch (err) {
        // ignore
      }
    })
    window.__hardScrollLockTargets = Array.from(
      new Set([...prevTargets, ...nextTargets])
    )
  } catch (err) {
    // ignore
  }
}

function removeHardScrollLock() {
  try {
    const blocker = window.__hardScrollLockBlocker
    const opts = { capture: true }
    const targets = window.__hardScrollLockTargets || getScrollLockTargets()
    if (blocker) {
      targets.forEach((target) => {
        try {
          target.removeEventListener('touchmove', blocker, opts)
          target.removeEventListener('wheel', blocker, opts)
        } catch (err) {
          // ignore
        }
      })
    }
  } catch (err) {
    // ignore
  }

  try {
    const saved = window.__hardScrollLockStyles
    if (saved) {
      document.documentElement.style.overflow = saved.htmlOverflow || ''
      document.documentElement.style.touchAction = saved.htmlTouch || ''
      document.documentElement.style.overscrollBehavior =
        saved.htmlOverscroll || ''
      document.body.style.overflow = saved.bodyOverflow || ''
      document.body.style.touchAction = saved.bodyTouch || ''
      document.body.style.overscrollBehavior = saved.bodyOverscroll || ''
      ;(saved.wraps || []).forEach(({ el, overflow, touch, overscroll }) => {
        try {
          if (!el || !el.style) return
          el.style.overflow = overflow || ''
          el.style.touchAction = touch || ''
          el.style.overscrollBehavior = overscroll || ''
        } catch (err) {
          // ignore
        }
      })
    }
  } catch (err) {
    // ignore
  }

  try {
    window.__hardScrollLockStyles = null
    window.__hardScrollLockTargets = null
    window.__hardScrollLockY = null
    window.__hardScrollLockActive = false
  } catch (err) {
    // ignore
  }
}

/**
 * Hard-lock all scrolling during page transitions (Lenis + native touch/wheel).
 * - With hostEl: also waits for pt-inner clip.tl to finish, then auto-unlocks.
 * - Without hostEl: stays locked until unlockScrollForTransition() (slide-scale nav).
 */
export function lockScrollForTransition(hostEl) {
  applyHardScrollLock()
  if (hostEl) {
    return holdLenisUntilClipComplete(hostEl)
  }
  armClipHoldSafetyTimeout()
  return true
}

/** Release the hard scroll lock and restart Lenis. */
export function unlockScrollForTransition() {
  releaseLenisClipHold()
}

/**
 * Keep Lenis stopped until the host clip timeline reaches progress === 1.
 * Used during pt-inner transitions so early scroll cannot run while the
 * page-wrap clip-path is still in its inset "window" state.
 */
export function holdLenisUntilClipComplete(hostEl) {
  const host = resolveClipHost(hostEl)
  const clip = host && host.__clip

  applyHardScrollLock()

  // Clip not ready yet (leave/early enter): keep hold and poll briefly
  if (!clip || !clip.tl || typeof clip.tl.progress !== 'function') {
    pollForClipAndHold(hostEl)
    return true
  }

  try {
    if (clip.tl.progress() === 1) {
      releaseLenisClipHold()
      return false
    }
  } catch (err) {
    // ignore and hold below
  }

  attachClipCompleteRelease(clip)
  armClipHoldSafetyTimeout()
  return true
}

function releaseLenisClipHold() {
  try {
    if (window.__lenisClipHoldTimeout) {
      clearTimeout(window.__lenisClipHoldTimeout)
      window.__lenisClipHoldTimeout = null
    }
  } catch (err) {
    // ignore
  }
  try {
    if (window.__lenisClipPoll) {
      clearInterval(window.__lenisClipPoll)
      window.__lenisClipPoll = null
    }
  } catch (err) {
    // ignore
  }
  try {
    window.__lenisHeldForClip = false
  } catch (err) {
    // ignore
  }
  removeHardScrollLock()
  unlockLenisScrollTo()
  startLenis()
}

function attachClipCompleteRelease(clip) {
  if (!clip || !clip.tl) return
  try {
    const prevOnComplete = clip.tl.eventCallback('onComplete')
    clip.tl.eventCallback('onComplete', function onClipComplete() {
      try {
        if (typeof prevOnComplete === 'function') {
          prevOnComplete.apply(this, arguments)
        }
      } catch (err) {
        // ignore
      }
      try {
        if (
          typeof clip.tl.progress === 'function' &&
          clip.tl.progress() !== 1
        ) {
          return
        }
      } catch (err) {
        // ignore
      }
      releaseLenisClipHold()
    })
  } catch (err) {
    // ignore
  }
}

function pollForClipAndHold(hostEl) {
  try {
    if (window.__lenisClipPoll) clearInterval(window.__lenisClipPoll)
  } catch (err) {
    // ignore
  }
  let tries = 0
  try {
    window.__lenisClipPoll = setInterval(() => {
      tries += 1
      applyHardScrollLock()
      const host = resolveClipHost(hostEl)
      const clip = host && host.__clip
      if (clip && clip.tl && typeof clip.tl.progress === 'function') {
        try {
          clearInterval(window.__lenisClipPoll)
          window.__lenisClipPoll = null
        } catch (err) {
          // ignore
        }
        if (clip.tl.progress() === 1) {
          releaseLenisClipHold()
          return
        }
        attachClipCompleteRelease(clip)
        armClipHoldSafetyTimeout()
        stopLenis()
        return
      }
      if (tries > 100) {
        try {
          clearInterval(window.__lenisClipPoll)
          window.__lenisClipPoll = null
        } catch (err) {
          // ignore
        }
        // Don't leave scroll locked forever if no clip appears
        releaseLenisClipHold()
      }
    }, 50)
  } catch (err) {
    // ignore
  }
  armClipHoldSafetyTimeout()
}

function armClipHoldSafetyTimeout() {
  try {
    if (window.__lenisClipHoldTimeout) {
      clearTimeout(window.__lenisClipHoldTimeout)
    }
    // Menu + leave + descale + clip ≈ ~4s; keep a safety margin
    window.__lenisClipHoldTimeout = setTimeout(() => {
      releaseLenisClipHold()
    }, 8000)
  } catch (err) {
    // ignore
  }
}

function lockLenisScrollToWhileHeld() {
  try {
    const lenis = window.lenis
    if (!lenis || typeof lenis.scrollTo !== 'function') return
    if (lenis.__clipHoldScrollToPatched) return
    lenis.__clipHoldOriginalScrollTo = lenis.scrollTo.bind(lenis)
    lenis.scrollTo = function scrollToWhileHeld(target, options) {
      if (window.__lenisHeldForClip || window.__hardScrollLockActive) return
      return lenis.__clipHoldOriginalScrollTo(target, options)
    }
    lenis.__clipHoldScrollToPatched = true
  } catch (err) {
    // ignore
  }
}

function unlockLenisScrollTo() {
  try {
    const lenis = window.lenis
    if (!lenis || !lenis.__clipHoldScrollToPatched) return
    if (typeof lenis.__clipHoldOriginalScrollTo === 'function') {
      lenis.scrollTo = lenis.__clipHoldOriginalScrollTo
    }
    lenis.__clipHoldScrollToPatched = false
    lenis.__clipHoldOriginalScrollTo = null
  } catch (err) {
    // ignore
  }
}
