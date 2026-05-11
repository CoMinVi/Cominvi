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
  if (!wrapper || !content) return null

  const lenis = new Lenis({
    wrapper,
    content,
    lerp: 0.125,
    smoothWheel: true,
    smoothTouch: true,
    syncTouch: true,
    // Ensure input events are bound to the wrapper in wrapper mode
    wheelEventsTarget: wrapper,
  })
  window.lenis = lenis
  window.__lenisWrapper = wrapper

  // Synchronize Lenis with ScrollTrigger
  lenis.on('scroll', ScrollTrigger.update)

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
