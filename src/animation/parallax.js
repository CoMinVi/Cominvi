import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Initialise/rafraîchit le parallax des images (GSAP + ScrollTrigger, compatible Lenis)
export function initParallax(root = document) {
  try {
    if (
      Array.isArray(window.__parallaxTweens) &&
      window.__parallaxTweens.length
    ) {
      window.__parallaxTweens.forEach((tw) => {
        try {
          if (tw && tw.scrollTrigger) tw.scrollTrigger.kill()
          if (tw) tw.kill()
        } catch (err) {
          // ignore
        }
      })
    }
    // Detach previous resize handler if any
    if (window.__parallaxResizeHandler) {
      window.removeEventListener('resize', window.__parallaxResizeHandler)
    }
    if (
      Array.isArray(window.__parallaxDebugObservers) &&
      window.__parallaxDebugObservers.length
    ) {
      window.__parallaxDebugObservers.forEach((observer) => {
        try {
          if (observer && typeof observer.disconnect === 'function') {
            observer.disconnect()
          }
        } catch (e) {
          // ignore
        }
      })
    }
  } catch (err) {
    // ignore
  }

  const scope = root && root.querySelector ? root : document
  const images = scope.querySelectorAll('.image-p, .image-h-p')
  if (!images.length) {
    window.__parallaxTweens = []
    return []
  }

  const scroller = window.__lenisWrapper || undefined
  const tweens = []
  const debugObservers = []
  let parallaxRefreshTimer = null
  const scheduleParallaxRefresh = () => {
    clearTimeout(parallaxRefreshTimer)
    parallaxRefreshTimer = setTimeout(() => {
      try {
        images.forEach((img) => layoutImage(img))
      } catch (e) {
        // ignore
      }
      try {
        ScrollTrigger.refresh()
      } catch (e) {
        // ignore
      }
    }, 120)
  }
  const isMachineCardImage = (img) => {
    try {
      if (!img) return false
      if (img.classList && img.classList.contains('is-machine')) return true
      return !!(img.closest && img.closest('.machine-card_bg'))
    } catch (e) {
      return false
    }
  }

  const isHorizontalParallaxImage = (img) => {
    try {
      return !!(img && img.classList && img.classList.contains('image-h-p'))
    } catch (e) {
      return false
    }
  }

  const resetMachineCardImageLayout = (img) => {
    try {
      img.style.position = ''
      img.style.left = ''
      img.style.right = ''
      img.style.top = ''
      img.style.width = ''
      img.style.height = ''
      img.style.objectFit = ''
      img.style.willChange = ''
      img.style.transform = ''
    } catch (e) {
      // ignore
    }
  }

  const resetParallaxImageLayout = (img) => {
    try {
      img.style.position = ''
      img.style.left = ''
      img.style.right = ''
      img.style.top = ''
      img.style.width = ''
      img.style.height = ''
      img.style.objectFit = ''
      img.style.willChange = ''
      img.style.transform = ''
    } catch (e) {
      // ignore
    }
  }

  const layoutImage = (img) => {
    try {
      const container =
        img.closest('.image-wrapper, .machine-card_bg') || img.parentElement
      if (!container) return null

      if (isMachineCardImage(img)) {
        // Keep machine cards visually centered: no parallax sizing/offset inline styles.
        resetMachineCardImageLayout(img)
        return container
      }

      // Ensure container can clip the parallax overflow
      const cs = window.getComputedStyle(container)
      if (cs.position === 'static') container.style.position = 'relative'
      container.style.overflow = 'hidden'

      // Exceptions: do not resize containers inside `.section_img.is-big-safety`
      // and keep width of `.image-p.is-safety` inside that section
      const inBigSafetySection = !!(
        img.closest && img.closest('.section_img.is-big-safety')
      )
      const isImageSafety = !!(
        img.classList && img.classList.contains('is-safety')
      )

      // Compute container height from image intrinsic ratio
      const computeAndApplyHeight = () => {
        // Skip height adjustments for big safety sections
        if (inBigSafetySection) return
        const containerWidth = container.clientWidth || img.clientWidth
        let ratio = 0
        let canUseRenderedRatio = false
        try {
          const imgComputedStyle = window.getComputedStyle(img)
          const isAbsolute = imgComputedStyle.position === 'absolute'
          canUseRenderedRatio = !isAbsolute
        } catch (e) {
          canUseRenderedRatio = false
        }
        if (canUseRenderedRatio) {
          const renderedRect = img.getBoundingClientRect()
          if (renderedRect.width && renderedRect.height) {
            ratio = renderedRect.height / renderedRect.width
          }
        }
        if (!ratio && img.naturalWidth && img.naturalHeight) {
          ratio = img.naturalHeight / img.naturalWidth
        } else if (!ratio && img.clientWidth && img.clientHeight) {
          ratio = img.clientHeight / img.clientWidth
        } else if (!ratio) {
          ratio = 9 / 16
        }
        if (containerWidth) {
          container.style.height = `${Math.round(containerWidth * ratio)}px`
        }
      }

      // Special case: images inside RTE fullwidth figures on blog
      // Ensure height is applied after the layout has stabilized on mobile
      const fullwidthFigure = img.closest(
        'figure.w-richtext-figure-type-image.w-richtext-align-fullwidth'
      )
      if (fullwidthFigure) {
        // Defer to next frames so Webflow/layout can size the figure first
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            computeAndApplyHeight()
            try {
              ScrollTrigger.refresh()
            } catch (e) {
              // ignore
            }
          })
        })

        // Install a ResizeObserver once to keep height in sync on device rotate
        if (!container.__rteFwResizeObserver) {
          try {
            const ro = new ResizeObserver(() => {
              computeAndApplyHeight()
              try {
                ScrollTrigger.refresh()
              } catch (e) {
                // ignore
              }
            })
            ro.observe(container)
            container.__rteFwResizeObserver = ro
          } catch (e) {
            // Fallback if RO is unavailable
            setTimeout(() => {
              computeAndApplyHeight()
              try {
                ScrollTrigger.refresh()
              } catch (err) {
                // ignore
              }
            }, 60)
          }
        }
      } else {
        computeAndApplyHeight()
      }

      // Image should be larger than container to avoid gaps during travel.
      const amplitude = 10 // percent used in tween below
      const isHorizontal = isHorizontalParallaxImage(img)
      const overscanFactor = 1 + (2 * amplitude) / 100 // 1.2 when A=10
      const horizontalOverscanFactor = 1.25
      const topCompPercent = -((amplitude / 100) * overscanFactor * 100) // -12 when A=10
      const leftCompPercent = -(((horizontalOverscanFactor - 1) / 2) * 100)

      img.style.position = 'absolute'
      img.style.left = isHorizontal ? `${leftCompPercent}%` : '0'
      img.style.right = '0'
      img.style.top = isHorizontal ? '0' : `${topCompPercent}%`
      if (!(isImageSafety && inBigSafetySection)) {
        if (
          container.classList &&
          container.classList.contains('machine-card_bg')
        ) {
          img.style.width = '100%'
        } else {
          img.style.width = isHorizontal
            ? `${horizontalOverscanFactor * 100}%`
            : '120%'
        }
      }
      img.style.height = isHorizontal ? '100%' : `${overscanFactor * 100}%`
      img.style.objectFit = 'cover'
      img.style.willChange = 'transform'

      return container
    } catch (e) {
      return null
    }
  }

  const ensureLaidOut = (img) => {
    if (img.complete && img.naturalWidth) {
      return layoutImage(img)
    }
    // If not loaded yet, layout once it loads
    let laidOutContainer = null
    const onLoad = () => {
      laidOutContainer = layoutImage(img)
      img.removeEventListener('load', onLoad)
      ScrollTrigger.refresh()
    }
    img.addEventListener('load', onLoad)
    return laidOutContainer
  }

  /**
   * About : sticky texte + image courte — début sur le wrapper image,
   * fin alignée sur le bas de la rangée (.content.is-about) pour couvrir tout le scroll utile.
   */
  const getAboutParallaxScrollTrigger = (img, laidOutContainer) => {
    const closestContainer =
      (img.closest && img.closest('.image-wrapper, .machine-card_bg')) || null
    const parentContainer = img.parentElement || null
    // Keep trigger tied to the visual clipping container of the image.
    // Using a higher-level section causes start/end drift on pages that animate layout.
    const base =
      laidOutContainer ||
      closestContainer ||
      parentContainer ||
      (img.closest && img.closest('.section_img')) ||
      img
    const getScrollDistance = () => {
      try {
        const rect = base.getBoundingClientRect()
        const viewportH = Math.max(1, window.innerHeight || 0)
        // start = "top bottom"; to end at "bottom top", travel must be:
        // element height + viewport height
        return Math.max(1, Math.round(rect.height + viewportH))
      } catch (e) {
        return Math.max(1, window.innerHeight || 1)
      }
    }

    return {
      trigger: base,
      start: 'top bottom',
      end: () => `+=${getScrollDistance()}`,
      scrub: true,
      scroller,
      invalidateOnRefresh: true,
      markers: false,
    }
  }

  images.forEach((img) => {
    try {
      if (isMachineCardImage(img)) {
        ensureLaidOut(img)
        return
      }

      resetParallaxImageLayout(img)
      gsap.set(img, { willChange: 'transform' })

      const laidOut = ensureLaidOut(img) || null
      const isHorizontal = isHorizontalParallaxImage(img)
      const tween = gsap.fromTo(
        img,
        isHorizontal ? { xPercent: -10 } : { yPercent: -10 },
        {
          ...(isHorizontal ? { xPercent: 10 } : { yPercent: 10 }),
          ease: 'none',
          immediateRender: false,
          scrollTrigger: getAboutParallaxScrollTrigger(img, laidOut),
        }
      )
      tweens.push(tween)
      if (isHorizontal && typeof ResizeObserver !== 'undefined') {
        try {
          const observedContainer =
            laidOut ||
            (img.closest &&
              img.closest('.image-wrapper, .machine-card_bg, .section_img')) ||
            img.parentElement ||
            img
          if (observedContainer) {
            let lastHeight = Math.round(
              observedContainer.getBoundingClientRect().height
            )
            const ro = new ResizeObserver(() => {
              const nextHeight = Math.round(
                observedContainer.getBoundingClientRect().height
              )
              if (Math.abs(nextHeight - lastHeight) < 2) return
              lastHeight = nextHeight
              layoutImage(img)
              scheduleParallaxRefresh()
            })
            ro.observe(observedContainer)
            debugObservers.push(ro)
            // Late-layout fallback: if section is still collapsed at init, refresh once it expands.
            if (lastHeight < 20) {
              setTimeout(() => {
                layoutImage(img)
                scheduleParallaxRefresh()
              }, 220)
            }
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      // ignore per-image failure
    }
  })

  // Handle resize: re-layout containers and refresh triggers
  const resizeHandler = () => {
    images.forEach((img) => layoutImage(img))
    ScrollTrigger.refresh()
  }
  // Debounce a bit to avoid thrashing
  let resizeTimer
  window.__parallaxResizeHandler = () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(resizeHandler, 100)
  }
  window.addEventListener('resize', window.__parallaxResizeHandler)

  window.__parallaxTweens = tweens
  window.__parallaxDebugObservers = debugObservers
  ScrollTrigger.refresh()
  // Layout Webflow / fonts / Lenis : les métriques peuvent bouger après le premier refresh.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        ScrollTrigger.refresh()
      } catch (e) {
        // ignore
      }
    })
  })
  return tweens
}

// Parallax for hero background .background-inner inside .hero-background
// Does not modify element sizes; only translates along Y to create depth
export function initHeroBackgroundParallax(root = document) {
  try {
    if (window.__heroBgParallax) {
      try {
        if (window.__heroBgParallax.scrollTrigger)
          window.__heroBgParallax.scrollTrigger.kill()
      } catch (e) {
        // ignore
      }
      try {
        window.__heroBgParallax.kill()
      } catch (e) {
        // ignore
      }
      window.__heroBgParallax = null
    }
  } catch (err) {
    // ignore
  }

  const scope = root && root.querySelector ? root : document
  const bgInner =
    (scope.querySelector &&
      scope.querySelector('.hero-background .background-inner')) ||
    document.querySelector('.hero-background .background-inner')
  if (!bgInner) return null

  const scroller = window.__lenisWrapper || undefined
  // Small translation range to avoid revealing edges while preserving size
  const amplitudePx = 40

  try {
    gsap.set(bgInner, { willChange: 'transform' })
  } catch (e) {
    // ignore
  }

  const syncTweenToProgress = (st) => {
    try {
      if (!st) return
      const progress = Number.isFinite(st.progress) ? st.progress : 0
      gsap.set(bgInner, { y: progress * amplitudePx })
    } catch (e) {
      // ignore
    }
  }

  const triggerEl = bgInner.parentElement || bgInner
  const tween = gsap.fromTo(
    bgInner,
    { y: 0 },
    {
      y: amplitudePx,
      ease: 'none',
      immediateRender: false,
      scrollTrigger: {
        trigger: triggerEl,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        scroller,
        invalidateOnRefresh: true,
        // Keep the current interpolated position through refreshes to avoid visual snaps.
        onRefresh: syncTweenToProgress,
        onUpdate: syncTweenToProgress,
      },
    }
  )
  try {
    window.__heroBgParallax = tween
  } catch (e) {
    // ignore
  }
  return tween
}

// Parallax for the article hero image (.hero_blog-img > img)
// Does not modify element sizes; only translates along Y to create depth
export function initHeroBlogImageParallax(root = document) {
  try {
    if (window.__heroBlogParallax) {
      try {
        if (window.__heroBlogParallax.scrollTrigger)
          window.__heroBlogParallax.scrollTrigger.kill()
      } catch (e) {
        // ignore
      }
      try {
        window.__heroBlogParallax.kill()
      } catch (e) {
        // ignore
      }
      window.__heroBlogParallax = null
    }
  } catch (err) {
    // ignore
  }

  const scope = root && root.querySelector ? root : document
  const hero =
    (scope.querySelector && scope.querySelector('.hero_blog-img')) ||
    document.querySelector('.hero_blog-img')
  if (!hero) return null
  const img = hero.querySelector('img')
  if (!img) return null

  const scroller = window.__lenisWrapper || undefined
  const amplitudePx = 40

  try {
    gsap.set(img, { willChange: 'transform' })
  } catch (e) {
    // ignore
  }

  // Resolve start offset once from CSS (padding-top of the section)
  let startOffsetPx = 376
  try {
    const docEl = document.documentElement
    const bodyEl = document.body
    const sectionEl =
      hero.closest('.section_hero-blog') || hero.parentElement || bodyEl

    const fsSectionStr = getComputedStyle(sectionEl).fontSize
    const fsBodyStr = getComputedStyle(bodyEl).fontSize
    const fsHtmlStr = getComputedStyle(docEl).fontSize

    const fsSection = parseFloat(fsSectionStr)
    const fsBody = parseFloat(fsBodyStr)
    const fsHtml = parseFloat(fsHtmlStr)

    const candidates = [fsSection, fsBody, fsHtml, 16]
    const baseFs = candidates.find((v) => Number.isFinite(v) && v > 0) || 16
    startOffsetPx = Math.round(baseFs * 23.5)
  } catch (e) {
    // keep fallback
  }
  const startExpr = 'top top+=' + startOffsetPx

  // Do not alter the initial position; animate from current state when start is reached
  const tween = gsap.to(img, {
    y: amplitudePx,
    ease: 'none',
    immediateRender: false,
    scrollTrigger: {
      trigger: hero,
      start: startExpr,
      end: 'bottom top',
      scrub: true,
      scroller,
    },
  })
  try {
    window.__heroBlogParallax = tween
  } catch (e) {
    // ignore
  }
  try {
    ScrollTrigger.refresh()
  } catch (e) {
    // ignore
  }
  return tween
}

// Parallax for images inside .section_next .next_background
// Makes the background image translate on scroll while preventing edge gaps
export function initNextBackgroundParallax(root = document) {
  try {
    if (
      Array.isArray(window.__nextBgParallaxTweens) &&
      window.__nextBgParallaxTweens.length
    ) {
      window.__nextBgParallaxTweens.forEach((tw) => {
        try {
          if (tw && tw.scrollTrigger) tw.scrollTrigger.kill()
          if (tw) tw.kill()
        } catch (err) {
          // ignore
        }
      })
    }
    if (window.__nextBgParallaxResizeHandler) {
      window.removeEventListener('resize', window.__nextBgParallaxResizeHandler)
    }
    // Cancel any previous rAF loop used as a fallback updater
    if (window.__nextBgParallaxRafId) {
      try {
        cancelAnimationFrame(window.__nextBgParallaxRafId)
      } catch (e) {
        // ignore
      }
      window.__nextBgParallaxRafId = null
    }
    window.__nextBgParallaxCallbacks = []
  } catch (e) {
    // ignore
  }

  const scope = root && root.querySelector ? root : document
  const wrappers = scope.querySelectorAll('.section_next .next_background')
  if (!wrappers.length) {
    window.__nextBgParallaxTweens = []
    return []
  }

  // Ensure Lenis is initialized before creating ScrollTriggers to avoid
  // incorrect start/end calculations on hard loads.
  const scroller = window.__lenisWrapper || undefined
  if (!scroller) {
    // Defer once to the next frame so initLenis can set defaults/scrollerProxy
    if (!window.__deferNextBgOnce) {
      window.__deferNextBgOnce = true
      requestAnimationFrame(() => {
        try {
          window.__deferNextBgOnce = false
          initNextBackgroundParallax(root)
        } catch (e) {
          // ignore
        }
      })
    }
    return []
  }
  const tweens = []

  const layoutWrapper = (bg) => {
    try {
      const section = bg.closest('.section_next') || bg.parentElement
      const cs = window.getComputedStyle(bg)
      if (cs.position === 'static') bg.style.position = 'absolute'
      bg.style.inset = 'auto'
      bg.style.left = '50%'
      bg.style.top = '50%'
      bg.style.width = '120%'
      bg.style.height = '120%'
      bg.style.overflow = 'hidden'
      // Match the hero background: 120% base size plus scale(1.2).
      gsap.set(bg, {
        transformOrigin: '50% 50%',
        willChange: 'transform',
        xPercent: -50,
        yPercent: -50,
        scale: 1.2,
      })
      return section || bg
    } catch (e) {
      return bg
    }
  }

  const ensureLaidOut = (bg) => layoutWrapper(bg)

  wrappers.forEach((bg) => {
    try {
      const triggerEl = ensureLaidOut(bg) || bg
      const amplitudePx = 40
      const setY = gsap.quickSetter(bg, 'y', 'px')
      const updateY = () => {
        try {
          const rect = bg.getBoundingClientRect()
          const centerY = rect.top + rect.height / 2
          const viewportCenterY = window.innerHeight / 2
          const denom = Math.max(1, rect.height / 2 + window.innerHeight / 2)
          const t = (centerY - viewportCenterY) / denom // -1 .. 1
          const clamped = Math.max(-1, Math.min(1, t))
          setY(clamped * amplitudePx)
        } catch (e) {
          // ignore
        }
      }
      const st = ScrollTrigger.create({
        trigger: triggerEl,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
        scroller,
        invalidateOnRefresh: true,
        onInit: updateY,
        onRefresh: updateY,
        onUpdate: updateY,
      })
      tweens.push(st)
    } catch (err) {
      // ignore per-image failure
    }
  })

  const resizeHandler = () => {
    wrappers.forEach((bg) => layoutWrapper(bg))
    ScrollTrigger.refresh()
  }
  let resizeTimer
  window.__nextBgParallaxResizeHandler = () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(resizeHandler, 100)
  }
  window.addEventListener('resize', window.__nextBgParallaxResizeHandler)

  window.__nextBgParallaxTweens = tweens
  ScrollTrigger.refresh()
  return tweens
}

export function destroyNextButtonSticky(root = document) {
  try {
    if (window.__nextButtonStickyLenisHandler && window.lenis?.off) {
      window.lenis.off('scroll', window.__nextButtonStickyLenisHandler)
    }
    if (window.__nextButtonStickyOnTransition) {
      window.removeEventListener(
        'page:transition:after',
        window.__nextButtonStickyOnTransition
      )
    }
    if (window.__nextButtonStickyOnResize) {
      window.removeEventListener('resize', window.__nextButtonStickyOnResize)
    }
    if (window.__nextButtonStickyRafId) {
      cancelAnimationFrame(window.__nextButtonStickyRafId)
    }
  } catch (e) {
    // ignore
  }

  window.__nextButtonStickyLenisHandler = null
  window.__nextButtonStickyOnTransition = null
  window.__nextButtonStickyOnResize = null
  window.__nextButtonStickyRafId = null

  const scope = root && root.querySelector ? root : document
  scope
    .querySelectorAll('.section_next .next-button-wrapper')
    .forEach((wrapper) => {
      try {
        wrapper.style.removeProperty('transform')
      } catch (e) {
        // ignore
      }
    })
}

export function initNextButtonSticky(root = document) {
  const scope = root && root.querySelector ? root : document
  const wrappers = scope.querySelectorAll('.section_next .next-button-wrapper')
  destroyNextButtonSticky(scope)
  if (!wrappers.length) return

  const updateAll = () => {
    const nodes = scope.querySelectorAll('.section_next .next-button-wrapper')
    nodes.forEach((wrapper) => {
      const section = wrapper.closest('.section_next')
      if (!section) return
      const sectionTop = section.getBoundingClientRect().top
      const extraY = Math.min(0, Math.round(sectionTop))
      wrapper.style.transform = `translate(0, calc(-50% + ${extraY}px))`
    })
  }

  updateAll()

  let scrollRafId = null
  const onScroll = () => {
    if (scrollRafId != null) return
    scrollRafId = requestAnimationFrame(() => {
      scrollRafId = null
      updateAll()
    })
  }
  window.__nextButtonStickyLenisHandler = onScroll
  if (window.lenis && typeof window.lenis.on === 'function') {
    window.lenis.on('scroll', onScroll)
  }

  window.__nextButtonStickyOnTransition = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(updateAll)
    })
  }
  window.addEventListener(
    'page:transition:after',
    window.__nextButtonStickyOnTransition
  )

  window.__nextButtonStickyOnResize = () => updateAll()
  window.addEventListener('resize', window.__nextButtonStickyOnResize)
}
