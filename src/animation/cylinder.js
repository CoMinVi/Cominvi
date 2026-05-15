import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function initCylinder(root = document) {
  const scope = root && root.querySelector ? root : document

  // Scope EVERYTHING to the first visible cylinder wrapper on the page
  const wrapper = scope.querySelector('.cylindar__wrapper')
  if (!wrapper) return
  const items = wrapper.querySelectorAll('.cylindar__text__item')
  const textWrapper = wrapper.querySelector('.cylindar__text__wrapper')
  // Some pages may not have a title element; fall back to wrapper
  const triggerEl = wrapper.querySelector('.cylindar__text') || wrapper

  if (!items || !items.length || !textWrapper || !wrapper || !triggerEl) return
  // Zones configuration (defaults): divide circle into N zones, then choose how many zones to span
  const zoneCount = (() => {
    const v = parseInt(wrapper?.dataset?.cylinderZones, 10)
    return Number.isFinite(v) && v > 0 ? v : 10
  })()
  const textZones = (() => {
    const v = parseInt(
      wrapper?.dataset?.textZones ?? wrapper?.dataset?.zones,
      10
    )
    return Number.isFinite(v) && v > 0 ? v : 7 // ≈252° by default (close to existing 250°)
  })()
  const tickZones = (() => {
    const v = parseInt(
      wrapper?.dataset?.tickZones ?? wrapper?.dataset?.textZones,
      10
    )
    return Number.isFinite(v) && v > 0 ? v : textZones
  })()
  const tickMultiplier = (() => {
    const v = parseInt(
      wrapper?.dataset?.tickMultiplier ??
        wrapper?.dataset?.tickFactor ??
        wrapper?.dataset?.tickDensity,
      10
    )
    return Number.isFinite(v) && v > 0 ? v : 1
  })()

  const getViewportHeight = () => {
    try {
      const vv = window.visualViewport
      if (vv && Number.isFinite(vv.height) && vv.height > 0) return vv.height
    } catch (e) {
      // ignore
    }
    return window.innerHeight || document.documentElement.clientHeight || 0
  }

  const isMobileViewport = () =>
    Math.min(window.innerWidth || 0, getViewportHeight()) < 767

  const getCylinderScroller = () => {
    const lenisWrapper = window.__lenisWrapper || undefined
    if (!isMobileViewport()) return lenisWrapper

    try {
      const lenisLimit = window.lenis && Number(window.lenis.limit)
      const wrapperCanScroll =
        lenisWrapper &&
        lenisWrapper.scrollHeight > lenisWrapper.clientHeight + 1
      if ((Number.isFinite(lenisLimit) && lenisLimit > 1) || wrapperCanScroll) {
        return lenisWrapper
      }
    } catch (e) {
      // ignore
    }

    return window
  }

  const syncMobileViewportHeight = () => {
    try {
      if (!isMobileViewport()) {
        wrapper.style.removeProperty('--cylinder-viewport-height')
        return
      }
      const vh = Math.round(getViewportHeight())
      if (vh > 0) {
        wrapper.style.setProperty('--cylinder-viewport-height', `${vh}px`)
      }
    } catch (e) {
      // ignore
    }
  }

  const getViewportCenter = () => {
    try {
      const vv = window.visualViewport
      if (vv && Number.isFinite(vv.height)) {
        return (vv.offsetTop || 0) + vv.height / 2
      }
    } catch (e) {
      // ignore
    }
    return (window.innerHeight || 0) / 2
  }

  const getMobileCenterBias = () => {
    const value = parseFloat(wrapper?.dataset?.cylinderCenterBias)
    if (Number.isFinite(value)) return value
    return getViewportHeight() * -0.025
  }

  const getMobilePinTotal = () => 2500

  const getMobilePinDistance = () =>
    Math.max(1, getMobilePinTotal() - getViewportHeight())

  let isCylinderPinned = false

  const syncCylinderVisualOffset = () => {
    try {
      if (!isMobileViewport()) {
        wrapper.style.removeProperty('--cylinder-visual-offset')
        return
      }
      if (!isCylinderPinned) return

      for (let i = 0; i < 2; i += 1) {
        const textSpans = Array.from(
          wrapper.querySelectorAll('.cylindar__text__item .body-xl')
        )
        let top = Infinity
        let bottom = -Infinity
        textSpans.forEach((span) => {
          const rect = span.getBoundingClientRect()
          if (
            !Number.isFinite(rect.top) ||
            !Number.isFinite(rect.bottom) ||
            rect.width <= 0 ||
            rect.height <= 0
          ) {
            return
          }

          top = Math.min(top, rect.top)
          bottom = Math.max(bottom, rect.bottom)
        })

        if (
          !Number.isFinite(top) ||
          !Number.isFinite(bottom) ||
          bottom <= top
        ) {
          return
        }

        const targetCenter = getViewportCenter() + getMobileCenterBias()
        const visualCenter = top + (bottom - top) / 2
        const delta = targetCenter - visualCenter
        if (Math.abs(delta) < 0.5) return

        const currentOffset =
          parseFloat(
            wrapper.style.getPropertyValue('--cylinder-visual-offset') || '0'
          ) || 0
        wrapper.style.setProperty(
          '--cylinder-visual-offset',
          `${currentOffset + delta}px`
        )
      }
    } catch (e) {
      // ignore
    }
  }

  try {
    if (wrapper.__cylinderCleanup) wrapper.__cylinderCleanup()
  } catch (e) {
    // ignore
  }

  // Build dense tick rings inside scroll indicators and cache refs
  const scrollIndicators = Array.from(
    wrapper.querySelectorAll('.scroll-indicator_c')
  )

  const ensureTicks = (container, desiredCount) => {
    if (!container) return []
    // Ensure ticks are positioned relative to their left/right containers
    try {
      container.style.position = 'relative'
      container.style.transformStyle = 'preserve-3d'
      container.style.pointerEvents = 'none'
    } catch (e) {
      // ignore
    }

    // Create or clone a base tick element
    const base =
      container.querySelector('.scroll-tick') ||
      (() => {
        const el = document.createElement('div')
        el.className = 'scroll-tick'
        return el
      })()

    // If we already have EXACTLY the desired count, reuse; otherwise rebuild
    let ticks = Array.from(container.querySelectorAll('.scroll-tick'))
    if (ticks.length === desiredCount) {
      // Ensure absolute centering within the column so transforms match text origin
      ticks.forEach((t) => {
        t.style.position = 'absolute'
        t.style.top = '50%'
        t.style.left = '50%'
        t.style.transformStyle = 'preserve-3d'
      })
      return ticks
    }

    // Rebuild the list to guarantee contiguous indices and consistent styling
    try {
      container.innerHTML = ''
    } catch (e) {
      // ignore
    }
    const frag = document.createDocumentFragment()
    for (let i = 0; i < desiredCount; i += 1) {
      const tick = base.cloneNode(true)
      tick.style.position = 'absolute'
      tick.style.top = '50%'
      tick.style.left = '50%'
      tick.style.transformStyle = 'preserve-3d'
      frag.appendChild(tick)
    }
    container.appendChild(frag)
    return Array.from(container.querySelectorAll('.scroll-tick'))
  }

  // Match number of ticks to number of text items times multiplier
  const desiredTickCount = Math.max(items.length * tickMultiplier, 1)
  // Materialize ticks for each indicator now so we can position them
  const indicatorToTicks = new Map()
  scrollIndicators.forEach((ind) => {
    indicatorToTicks.set(ind, ensureTicks(ind, desiredTickCount))
  })

  const calculatePositions = () => {
    syncMobileViewportHeight()
    const count = items.length || 1
    const offset = 0.4
    const radius = Math.min(window.innerWidth, getViewportHeight()) * offset
    const zoneAngle = 360 / zoneCount
    const textSweep = zoneAngle * textZones
    const tickSweep = zoneAngle * tickZones
    // Use identical spacing for texts/ticks when zones equal
    // 14 items => 14 slots; use sweep/(count-1) so first/last align to sweep ends
    const textSpacing = count > 1 ? textSweep / (count - 1) : textSweep

    items.forEach((item, index) => {
      const angle = (index * textSpacing * Math.PI) / 180
      const rotationAngle = index * -textSpacing
      const x = 0
      const y = Math.sin(angle) * radius
      const z = Math.cos(angle) * radius
      item.style.transform = `translate3d(-50%, -50%, 0) translate3d(${x}px, ${y}px, ${z}px) rotateX(${rotationAngle}deg)`
    })

    // Ticks spacing: strictly equal to texts when zones equal, else proportional
    const tickCount = desiredTickCount
    const tickSpacing =
      tickZones === textZones
        ? textSpacing / tickMultiplier
        : tickCount > 1
        ? tickSweep / (tickCount - 1)
        : tickSweep
    indicatorToTicks.forEach((ticks) => {
      ticks.forEach((tick, idx) => {
        const tAngle = (idx * tickSpacing * Math.PI) / 180
        const tRot = idx * -tickSpacing
        const x = 0
        const y = Math.sin(tAngle) * radius
        const z = Math.cos(tAngle) * radius
        tick.style.transform = `translate3d(-50%, -50%, 0) translate3d(${x}px, ${y}px, ${z}px) rotateX(${tRot}deg)`
      })
    })
    syncCylinderVisualOffset()
  }

  calculatePositions()

  // Build a unified timeline so ticks and texts rotate together
  const tl = gsap.timeline({ defaults: { ease: 'none' } })
  // Aligner l'origine de rotation des conteneurs
  try {
    gsap.set([textWrapper, ...Array.from(scrollIndicators)], {
      transformOrigin: '50% 50% 0',
      force3D: true,
    })
  } catch (e) {
    // ignore
  }
  tl.fromTo(textWrapper, { rotateX: 0 }, { rotateX: 150 }, 0)
  // Animer aussi les conteneurs de ticks pour faire tourner l'ensemble du cylindre
  const indicatorNodes = Array.from(
    wrapper.querySelectorAll('.scroll-indicator_c')
  )
  if (indicatorNodes.length)
    tl.fromTo(indicatorNodes, { rotateX: 0 }, { rotateX: 160 }, 0)

  // Enforce a fixed .pin-spacer height on small mobile viewports
  const getPinSpacer = () => {
    try {
      const p = wrapper && wrapper.parentElement
      if (p && p.classList && p.classList.contains('pin-spacer')) return p
      const c = wrapper && wrapper.closest && wrapper.closest('.pin-spacer')
      if (c) return c
    } catch (e) {
      // ignore
    }
    return null
  }
  let spacerObserver = null
  let spacerObservedNode = null
  const attachSpacerObserver = (spacer) => {
    try {
      if (!spacer || typeof MutationObserver !== 'function') return
      if (spacerObservedNode === spacer && spacerObserver) return
      if (spacerObserver) {
        try {
          spacerObserver.disconnect()
        } catch (e) {
          /* ignore */
        }
        spacerObserver = null
        spacerObservedNode = null
      }
      spacerObserver = new MutationObserver(() => {
        try {
          enforceSpacerHeight()
        } catch (e) {
          /* ignore */
        }
      })
      spacerObserver.observe(spacer, {
        attributes: true,
        attributeFilter: ['style'],
      })
      spacerObservedNode = spacer
    } catch (e) {
      // ignore
    }
  }
  const getDurationPx = () => {
    try {
      if (
        trigger &&
        typeof trigger.start === 'number' &&
        typeof trigger.end === 'number'
      ) {
        return Math.max(0, Math.round(trigger.end - trigger.start))
      }
    } catch (e) {
      // ignore
    }
    // Fallback: parse svh value from end string
    try {
      if (isMobileViewport()) return Math.round(getMobilePinDistance())
      const match = (
        typeof trigger?.vars?.end === 'string' ? trigger.vars.end : '+=2000svh'
      ).match(/\+=\s*(\d+)\s*svh/i)
      const units = match && match[1] ? parseInt(match[1], 10) : 2000
      return Math.max(0, Math.round(units * getViewportHeight()))
    } catch (e) {
      return Math.max(0, Math.round(2000 * getViewportHeight()))
    }
  }
  const enforceSpacerHeight = () => {
    try {
      const spacer = getPinSpacer()
      if (!spacer) return
      const wrapperHeight = (() => {
        try {
          const r = wrapper.getBoundingClientRect()
          return Math.max(0, Math.round(r.height || 0))
        } catch (e) {
          return 0
        }
      })()
      const durationPx = getDurationPx()
      const desiredTotal = Math.max(wrapperHeight + durationPx, 1)
      const px = `${desiredTotal}px`
      spacer.style.setProperty('height', px, 'important')
      spacer.style.setProperty('min-height', px, 'important')
      attachSpacerObserver(spacer)
    } catch (e) {
      // ignore
    }
  }

  const cylinderScroller = getCylinderScroller()
  const usesWindowScroller = cylinderScroller === window

  const trigger = ScrollTrigger.create({
    trigger: triggerEl,
    scroller: cylinderScroller,
    start: () => (isMobileViewport() ? 'top top' : 'center center'),
    end: () =>
      isMobileViewport() ? `+=${getMobilePinDistance()}` : '+=2000svh',
    pin: wrapper,
    // Prevent visual jumps when ancestors transform (menu open/close)
    anticipatePin: 1,
    pinReparent: !usesWindowScroller,
    // keep default pinSpacing to preserve layout consistency
    invalidateOnRefresh: true,
    // pinSpacing: false,
    scrub: true,
    animation: tl,
    onRefresh: enforceSpacerHeight,
    onToggle: (self) => {
      isCylinderPinned = self.isActive
      if (!self.isActive && self.progress <= 0) {
        wrapper.style.removeProperty('--cylinder-visual-offset')
      }
      syncCylinderVisualOffset()
    },
    onUpdate: (self) => {
      isCylinderPinned = self.isActive
      syncCylinderVisualOffset()
    },
  })
  try {
    ScrollTrigger.addEventListener('refresh', enforceSpacerHeight)
  } catch (e) {
    // ignore
  }
  try {
    ScrollTrigger.addEventListener('refreshInit', enforceSpacerHeight)
  } catch (e) {
    // ignore
  }
  enforceSpacerHeight()
  // Handle device orientation toggles explicitly
  let recalcRaf = null
  const scheduleRecalc = () => {
    if (recalcRaf !== null) return
    recalcRaf = requestAnimationFrame(() => {
      recalcRaf = null
      try {
        syncMobileViewportHeight()
      } catch (e) {
        // ignore
      }
      try {
        calculatePositions()
      } catch (e) {
        // ignore
      }
      try {
        enforceSpacerHeight()
      } catch (e) {
        // ignore
      }
      try {
        ScrollTrigger.refresh()
      } catch (e) {
        // ignore
      }
    })
  }
  const onOrientationChange = () => scheduleRecalc()

  // Highlight: enlarge ticks closest to viewport center (like scroll-list)
  const updateTickHighlight = () => {
    // Freeze highlighting when the menu is open to keep the current active item
    try {
      if (
        typeof document !== 'undefined' &&
        document?.documentElement?.getAttribute('data-menu-open') === 'true'
      ) {
        return
      }
    } catch (e) {
      // ignore
    }
    // Highlight text item at viewport center with .is-active
    try {
      const textSpans = Array.from(items).map((el) =>
        el.querySelector('.body-xl, .body-xxl, .body-next')
      )
      if (textSpans.length) {
        const progress =
          trigger && Number.isFinite(trigger.progress) ? trigger.progress : 0
        const closestIdx = Math.max(
          0,
          Math.min(
            textSpans.length - 1,
            Math.round(progress * (textSpans.length - 1))
          )
        )
        textSpans.forEach(
          (s) => s && s.classList && s.classList.remove('is-active')
        )
        const active = textSpans[closestIdx]
        if (active) {
          active.classList.add('is-active')
          // Remove dimming combos if present when active
          active.classList.remove('is-o-15', 'is-o-20')
        }
        // Re-apply dim class to non-active items
        textSpans.forEach((s, idx) => {
          if (!s || idx === closestIdx) return
          s.classList.remove('is-active')
          if (!s.classList.contains('is-o-20')) s.classList.add('is-o-20')
        })
      }
    } catch (e) {
      // ignore
    }
    indicatorNodes.forEach((indicator) => {
      const ticks = Array.from(indicator.querySelectorAll('.scroll-tick'))
      if (!ticks.length) return
      const progress =
        trigger && Number.isFinite(trigger.progress) ? trigger.progress : 0
      const closestIndex = Math.max(
        0,
        Math.min(ticks.length - 1, Math.round(progress * (ticks.length - 1)))
      )
      // Reset classes
      ticks.forEach((t) => {
        t.classList.remove('is-xxl', 'is-xl', 'is-l', 'is-m')
      })
      const add = (i, cls) => {
        if (i >= 0 && i < ticks.length) ticks[i].classList.add(cls)
      }
      add(closestIndex, 'is-xxl')
      add(closestIndex - 1, 'is-xl')
      add(closestIndex + 1, 'is-xl')
      add(closestIndex - 2, 'is-l')
      add(closestIndex + 2, 'is-l')
      add(closestIndex - 3, 'is-m')
      add(closestIndex + 3, 'is-m')
    })
  }

  // Dedicated ScrollTrigger for tick highlighting (mirrors scroll-list logic)
  const highlightTrigger = ScrollTrigger.create({
    trigger: wrapper,
    scroller: cylinderScroller,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: updateTickHighlight,
    onEnter: updateTickHighlight,
    onEnterBack: updateTickHighlight,
  })
  // Also tick on every RAF to keep highlight smooth while pinned
  const tickerFn = () => updateTickHighlight()
  try {
    gsap.ticker.add(tickerFn)
  } catch (e) {
    // ignore
  }
  updateTickHighlight()

  const onResize = () => scheduleRecalc()
  window.addEventListener('resize', onResize)
  // Recompute after page transitions complete (Barba after hooks)
  try {
    window.addEventListener('page:transition:after', scheduleRecalc)
  } catch (e) {
    // ignore
  }
  try {
    if (
      window.visualViewport &&
      typeof window.visualViewport.addEventListener === 'function'
    ) {
      window.visualViewport.addEventListener('resize', scheduleRecalc)
      window.visualViewport.addEventListener('scroll', scheduleRecalc)
    }
  } catch (e) {
    // ignore
  }
  try {
    window.addEventListener('orientationchange', onOrientationChange)
  } catch (e) {
    // ignore
  }

  wrapper.__cylinderCleanup = () => {
    try {
      if (trigger && typeof trigger.kill === 'function') trigger.kill()
    } catch (e) {
      // ignore
    }
    try {
      if (tl && typeof tl.kill === 'function') tl.kill()
    } catch (e) {
      // ignore
    }
    try {
      window.removeEventListener('resize', onResize)
    } catch (e) {
      // ignore
    }
    try {
      window.removeEventListener('page:transition:after', scheduleRecalc)
    } catch (e) {
      // ignore
    }
    try {
      if (
        window.visualViewport &&
        typeof window.visualViewport.removeEventListener === 'function'
      ) {
        window.visualViewport.removeEventListener('resize', scheduleRecalc)
        window.visualViewport.removeEventListener('scroll', scheduleRecalc)
      }
    } catch (e) {
      // ignore
    }
    try {
      window.removeEventListener('orientationchange', onOrientationChange)
    } catch (e) {
      // ignore
    }
    try {
      if (recalcRaf !== null) {
        cancelAnimationFrame(recalcRaf)
        recalcRaf = null
      }
    } catch (e) {
      // ignore
    }
    try {
      if (highlightTrigger && typeof highlightTrigger.kill === 'function')
        highlightTrigger.kill()
    } catch (e) {
      // ignore
    }
    try {
      ScrollTrigger.removeEventListener('refresh', enforceSpacerHeight)
    } catch (e) {
      // ignore
    }
    try {
      ScrollTrigger.removeEventListener('refreshInit', enforceSpacerHeight)
    } catch (e) {
      // ignore
    }
    try {
      if (spacerObserver) spacerObserver.disconnect()
    } catch (e) {
      // ignore
    }
    try {
      wrapper.style.removeProperty('--cylinder-viewport-height')
      wrapper.style.removeProperty('--cylinder-visual-offset')
    } catch (e) {
      // ignore
    }
    try {
      if (tickerFn && gsap && gsap.ticker) gsap.ticker.remove(tickerFn)
    } catch (e) {
      // ignore
    }
    try {
      wrapper.__cylinderCleanup = null
    } catch (e) {
      // ignore
    }
  }
}
