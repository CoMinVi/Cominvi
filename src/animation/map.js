import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import Swiper from 'swiper'
import { Mousewheel } from 'swiper/modules'
gsap.registerPlugin(CustomEase)

const PROJECT_DESCRIPTION_SELECTOR =
  '.project-card_infos-col.is-left .eyebrow-l-alt'
const PROJECT_DESCRIPTION_EXPANDED_CLASS = 'is-project-description-open'
const PROJECT_READ_MORE_CLASS = 'project-card_read-more'

function hasClampedOverflow(textEl) {
  if (!textEl) return false
  const wasExpanded = textEl.classList.contains(
    PROJECT_DESCRIPTION_EXPANDED_CLASS
  )

  textEl.classList.remove(PROJECT_DESCRIPTION_EXPANDED_CLASS)
  const hasOverflow = textEl.scrollHeight > textEl.clientHeight + 1
  if (wasExpanded) textEl.classList.add(PROJECT_DESCRIPTION_EXPANDED_CLASS)

  return hasOverflow
}

function syncProjectCardReadMore(root = document) {
  const scope = root && root.querySelector ? root : document
  const descriptions = Array.from(
    scope.querySelectorAll(PROJECT_DESCRIPTION_SELECTOR)
  )

  descriptions.forEach((textEl) => {
    const text = (textEl.textContent || '').trim()
    const col = textEl.closest('.project-card_infos-col')
    if (!col || !text) return

    let button = col.querySelector(`.${PROJECT_READ_MORE_CLASS}`)
    if (!button) {
      button = document.createElement('button')
      button.type = 'button'
      button.className = PROJECT_READ_MORE_CLASS
      button.textContent = 'Show more'
      button.setAttribute('aria-expanded', 'false')
      col.appendChild(button)
    }

    if (!textEl.__projectReadMoreBound) {
      textEl.__projectReadMoreBound = true
      button.addEventListener('click', (ev) => {
        ev.preventDefault()
        const isExpanded = textEl.classList.toggle(
          PROJECT_DESCRIPTION_EXPANDED_CLASS
        )
        button.textContent = isExpanded ? 'Show less' : 'Show more'
        button.setAttribute('aria-expanded', isExpanded ? 'true' : 'false')
      })
    }

    const shouldShowButton = hasClampedOverflow(textEl)
    button.hidden = !shouldShowButton
    textEl.classList.toggle('has-project-read-more', shouldShowButton)
  })
}

function initProjectCardReadMore(root = document) {
  syncProjectCardReadMore(root)

  try {
    if (window.__projectReadMoreResizeBound) return
    window.__projectReadMoreResizeBound = true
    window.addEventListener('resize', () => {
      window.requestAnimationFrame(() => syncProjectCardReadMore(document))
    })
  } catch (e) {
    // ignore
  }
}

export function initMap(root = document) {
  const scope = root || document

  const getMarkerHitboxRoot = () => {
    try {
      if (
        scope &&
        scope.matches &&
        scope.matches('[data-barba="container"], .page-wrap')
      ) {
        return scope
      }
      const pageWrap = scope.querySelector && scope.querySelector('.page-wrap')
      return pageWrap || window.__lenisWrapper || document.body
    } catch (e) {
      return document.body
    }
  }

  // Fix: Ensure SVG groups don't display text tooltips
  try {
    const mapSvg = scope.querySelector('svg.is-map')
    if (mapSvg) {
      mapSvg.setAttribute(
        'aria-label',
        'Interactive map of CoMinVi mining locations'
      )
      mapSvg.setAttribute('role', 'img')

      // Hide any visible text from SVG group IDs by adding proper title elements
      const mapGroups = mapSvg.querySelectorAll('g[id]')
      mapGroups.forEach((group) => {
        // Remove any existing <title> elements that might display
        const existingTitles = group.querySelectorAll(':scope > title')
        existingTitles.forEach((title) => title.remove())
      })
    }
  } catch (e) {
    // ignore
  }

  // Collect elements
  const markers = Array.from(scope.querySelectorAll('.marker[id^="marker-"]'))
  const regions = Array.from(scope.querySelectorAll('.region[id^="region-"]'))
  const projectItems = Array.from(scope.querySelectorAll('.project-item'))
  const overlayItems = Array.from(
    scope.querySelectorAll('.projects-overlay-item')
  )

  if (!markers.length && !regions.length && !projectItems.length) return

  initProjectCardReadMore(scope)

  // Build lookups
  const pointToMarker = new Map()
  const markerToPoint = new Map()
  markers.forEach((markerEl) => {
    const id = markerEl.id || ''
    const m = id.match(/^marker-(.+)$/)
    if (m && m[1] != null) {
      const pointKey = String(m[1])
      pointToMarker.set(pointKey, markerEl)
      markerToPoint.set(markerEl, pointKey)
    }
  })

  // Create larger clickable buttons over each marker
  const markerHitboxPaddingPx = 12
  const markerToButton = new Map()
  const markerHitboxRoot = getMarkerHitboxRoot()
  const syncMarkerButton = (markerEl, btn) => {
    try {
      const rect = markerEl.getBoundingClientRect()
      btn.style.left = `${rect.left - markerHitboxPaddingPx}px`
      btn.style.top = `${rect.top - markerHitboxPaddingPx}px`
      btn.style.width = `${rect.width + markerHitboxPaddingPx * 2}px`
      btn.style.height = `${rect.height + markerHitboxPaddingPx * 2}px`
    } catch (e) {
      // ignore
    }
  }
  const syncAllMarkerButtons = () => {
    markerToButton.forEach((btn, markerEl) => syncMarkerButton(markerEl, btn))
  }
  try {
    markers.forEach((markerEl) => {
      // Avoid duplicating buttons if initMap runs multiple times
      if (markerToButton.has(markerEl)) return
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'marker-hitbox'
      btn.setAttribute('aria-label', 'Open project')
      Object.assign(btn.style, {
        position: 'fixed',
        left: '0px',
        top: '0px',
        width: '0px',
        height: '0px',
        padding: '0',
        margin: '0',
        background: 'transparent',
        border: '0',
        outline: 'none',
        cursor: 'pointer',
        zIndex: '4',
      })
      // Button takes over all marker interactions
      btn.addEventListener('mouseenter', () => {
        const pointKey = markerToPoint.get(markerEl)
        if (!pointKey) return
        highlightPointAndRegion(pointKey)
        // On desktop/tablet: slide to corresponding card
        if (!isMobileOnlyNow()) slideToPoint(pointKey)
        // On mobile: keep current behavior (no overlays)
        if (isMobileOnlyNow()) slideToPoint(pointKey)
      })
      btn.addEventListener('mouseleave', () => {
        const currentOverlays = (scope || document).querySelector(
          '.projects_overlays'
        )
        if (currentOverlays?.dataset?.open === 'true') return
        resetRegions()
        reapplyActiveMarker()
      })
      btn.addEventListener('click', (ev) => {
        ev.preventDefault()
        ev.stopPropagation()
        const pointKey = markerToPoint.get(markerEl)
        if (!pointKey) return
        // Always slide to the corresponding card; remove overlay open/close
        slideToPoint(pointKey)
      })
      markerHitboxRoot.appendChild(btn)
      markerToButton.set(markerEl, btn)
      syncMarkerButton(markerEl, btn)
    })
    // Keep positions in sync on resize/scroll
    const onResizeOrScroll = () => syncAllMarkerButtons()
    window.addEventListener('resize', onResizeOrScroll)
    window.addEventListener('scroll', onResizeOrScroll, true)
    // If a smooth-scroll wrapper exists, sync on its scroll as well
    try {
      const wrapper = window.__lenisWrapper || null
      if (wrapper && typeof wrapper.addEventListener === 'function') {
        wrapper.addEventListener('scroll', onResizeOrScroll)
      }
    } catch (e) {
      // ignore
    }
  } catch (e) {
    // ignore
  }

  const normalizeRegionKey = (raw) => {
    if (!raw && raw !== 0) return null
    try {
      let v = String(raw).trim().toLowerCase()
      if (v.startsWith('#')) v = v.slice(1)
      if (v.startsWith('region-')) v = v.slice(7)
      return v || null
    } catch (e) {
      return null
    }
  }

  const regionNameToRegion = new Map()
  regions.forEach((regionEl) => {
    const id = regionEl.id || ''
    const m = id.match(/^region-(.+)$/)
    if (m && m[1] != null) {
      const regionKey = normalizeRegionKey(m[1])
      regionNameToRegion.set(regionKey, regionEl)
    }
  })

  const pointToProjectItems = new Map()
  const regionNameToProjectItems = new Map()
  const pointToRegionName = new Map()
  projectItems.forEach((cardEl) => {
    const pointKey = cardEl?.dataset?.point
      ? String(cardEl.dataset.point)
      : null
    const regionKey = cardEl?.dataset?.region
      ? normalizeRegionKey(cardEl.dataset.region)
      : null

    if (pointKey) {
      const arr = pointToProjectItems.get(pointKey) || []
      arr.push(cardEl)
      pointToProjectItems.set(pointKey, arr)
    }
    if (regionKey) {
      const arr = regionNameToProjectItems.get(regionKey) || []
      arr.push(cardEl)
      regionNameToProjectItems.set(regionKey, arr)
    }
    if (pointKey && regionKey && !pointToRegionName.has(pointKey)) {
      pointToRegionName.set(pointKey, regionKey)
    }
  })

  const pointToOverlayItems = new Map()
  overlayItems.forEach((overlayEl) => {
    const pointKey = overlayEl?.dataset?.point
      ? String(overlayEl.dataset.point)
      : null
    if (pointKey) {
      const arr = pointToOverlayItems.get(pointKey) || []
      arr.push(overlayEl)
      pointToOverlayItems.set(pointKey, arr)
    }
  })

  // Helpers

  const isSafariLike = () => {
    try {
      if (typeof navigator === 'undefined') return false
      const ua = navigator.userAgent || ''
      const isIOS = /iP(ad|hone|od)/.test(ua)
      const isSafari =
        /Safari\//.test(ua) && !/Chrome\//.test(ua) && !/CriOS\//.test(ua)
      return isIOS || isSafari
    } catch (e) {
      return false
    }
  }

  const highlightMarkerWithoutDimming = (pointKey) => {
    try {
      const markerEl = pointToMarker.get(pointKey)
      // Ensure SVG filter exists in the nearest SVG for Safari/iOS support
      const ensureMarkerShadowFilter = (svgEl) => {
        try {
          if (!svgEl) return null
          const FILTER_ID = 'marker-shadow'
          // Try to find existing filter within this SVG
          let filterEl = svgEl.querySelector(`#${FILTER_ID}`)
          if (!filterEl) {
            let defs = svgEl.querySelector('defs')
            if (!defs) {
              defs = document.createElementNS(
                'http://www.w3.org/2000/svg',
                'defs'
              )
              svgEl.insertBefore(defs, svgEl.firstChild)
            }
            filterEl = document.createElementNS(
              'http://www.w3.org/2000/svg',
              'filter'
            )
            filterEl.setAttribute('id', FILTER_ID)
            // Use userSpaceOnUse to ensure visible shadow around small circles
            filterEl.setAttribute('x', '-50%')
            filterEl.setAttribute('y', '-50%')
            filterEl.setAttribute('width', '200%')
            filterEl.setAttribute('height', '200%')
            filterEl.setAttribute('filterUnits', 'userSpaceOnUse')
            filterEl.setAttribute('color-interpolation-filters', 'sRGB')
            // Approximate previous CSS drop-shadows with stacked feDropShadow
            const makeShadow = (dx, dy, stdDeviation, color) => {
              const fe = document.createElementNS(
                'http://www.w3.org/2000/svg',
                'feDropShadow'
              )
              fe.setAttribute('dx', String(dx))
              fe.setAttribute('dy', String(dy))
              fe.setAttribute('stdDeviation', String(stdDeviation))
              // Split opacity for Safari compatibility
              if (typeof color === 'object' && color) {
                const { hex, opacity } = color
                fe.setAttribute('flood-color', hex)
                fe.setAttribute('flood-opacity', String(opacity))
              } else {
                fe.setAttribute('flood-color', String(color))
              }
              return fe
            }
            // Layered shadows: subtle white halo + two orange glows
            filterEl.appendChild(
              makeShadow(0, 0, 2, { hex: '#ffffff', opacity: 0.5 })
            )
            filterEl.appendChild(
              makeShadow(0, 0, 5, { hex: '#ff8832', opacity: 1 })
            )
            filterEl.appendChild(
              makeShadow(0, 0, 12, { hex: '#ff8832', opacity: 1 })
            )

            // Fallback chain for older Safari: Gaussian blur + flood + merge
            const feGB = document.createElementNS(
              'http://www.w3.org/2000/svg',
              'feGaussianBlur'
            )
            feGB.setAttribute('in', 'SourceAlpha')
            feGB.setAttribute('stdDeviation', '4')
            feGB.setAttribute('result', 'blur')
            const feOf = document.createElementNS(
              'http://www.w3.org/2000/svg',
              'feOffset'
            )
            feOf.setAttribute('dx', '0')
            feOf.setAttribute('dy', '0')
            feOf.setAttribute('result', 'offsetBlur')
            const feFl = document.createElementNS(
              'http://www.w3.org/2000/svg',
              'feFlood'
            )
            feFl.setAttribute('flood-color', '#ff8832')
            feFl.setAttribute('flood-opacity', '0.8')
            feFl.setAttribute('result', 'color')
            const feCp = document.createElementNS(
              'http://www.w3.org/2000/svg',
              'feComposite'
            )
            feCp.setAttribute('in', 'color')
            feCp.setAttribute('in2', 'offsetBlur')
            feCp.setAttribute('operator', 'in')
            feCp.setAttribute('result', 'shadow')
            const feMg = document.createElementNS(
              'http://www.w3.org/2000/svg',
              'feMerge'
            )
            const feMn1 = document.createElementNS(
              'http://www.w3.org/2000/svg',
              'feMergeNode'
            )
            feMn1.setAttribute('in', 'shadow')
            const feMn2 = document.createElementNS(
              'http://www.w3.org/2000/svg',
              'feMergeNode'
            )
            feMn2.setAttribute('in', 'SourceGraphic')
            feMg.appendChild(feMn1)
            feMg.appendChild(feMn2)

            filterEl.appendChild(feGB)
            filterEl.appendChild(feOf)
            filterEl.appendChild(feFl)
            filterEl.appendChild(feCp)
            filterEl.appendChild(feMg)
            defs.appendChild(filterEl)
          }
          return FILTER_ID
        } catch (e) {
          return null
        }
      }

      const applyFilterToMarker = (el, active) => {
        try {
          const svg = el && el.closest ? el.closest('svg') : null
          if (!svg) return
          const filterId = ensureMarkerShadowFilter(svg)
          const targetCircle = el.querySelector
            ? el.querySelector('circle')
            : null
          const targetEl = targetCircle || el
          if (active && filterId) {
            if (isSafariLike()) {
              targetEl.setAttribute('filter', `url(#${filterId})`)
              // Force reflow to ensure filter is committed
              try {
                if (typeof targetEl.getBBox === 'function') targetEl.getBBox()
              } catch (err) {
                // ignore
              }
            }
          } else {
            if (isSafariLike()) {
              targetEl.removeAttribute('filter')
            }
          }
        } catch (e) {
          // ignore
        }
      }

      // Fallback glow for Safari/iOS that ignores filters: inject circle shadows
      const ensureGlowForMarker = (el, active) => {
        try {
          const svg = el && el.closest ? el.closest('svg') : null
          if (!svg) return
          const dot = el.querySelector ? el.querySelector('circle') : null
          if (!dot) return
          const cx = dot.getAttribute('cx') || '0'
          const cy = dot.getAttribute('cy') || '0'
          const rStr = dot.getAttribute('r') || '0'
          const r = Number(rStr) || 0
          // Remove previous glows
          const oldGlows = el.querySelectorAll('.marker-glow, .marker-glow-2')
          oldGlows.forEach((n) => n.parentNode && n.parentNode.removeChild(n))
          if (!active) return
          const makeCircle = (cls, radius, fill, opacity) => {
            const c = document.createElementNS(
              'http://www.w3.org/2000/svg',
              'circle'
            )
            c.setAttribute('class', cls)
            c.setAttribute('cx', cx)
            c.setAttribute('cy', cy)
            c.setAttribute('r', String(radius))
            c.setAttribute('fill', fill)
            c.setAttribute('opacity', String(opacity))
            return c
          }
          // Two-layer glow approximating CSS drop-shadows
          const glowOuter = makeCircle('marker-glow', r + 10, '#ff8832', 0.35)
          const glowInner = makeCircle('marker-glow-2', r + 5, '#ff8832', 0.6)
          // Insert behind the dot inside this marker group
          if (dot.parentNode) {
            dot.parentNode.insertBefore(glowOuter, dot)
            dot.parentNode.insertBefore(glowInner, dot)
          }
        } catch (e) {
          // ignore
        }
      }

      markers.forEach((m) => {
        const isActive = m === markerEl
        if (isActive) m.classList.add('highlight')
        else m.classList.remove('highlight')
        m.classList.remove('dimmed')
        if (isSafariLike()) ensureGlowForMarker(m, isActive)
        else applyFilterToMarker(m, isActive)
      })
    } catch (e) {
      // ignore
    }
  }

  // Resolve region key for a given point using mapping or card dataset
  const getRegionForPoint = (pointKey) => {
    try {
      if (!pointKey) return null
      const viaMap = pointToRegionName.get(pointKey)
      if (viaMap) return viaMap
      const card = Array.from(scope.querySelectorAll('.project-item')).find(
        (el) => String(el?.dataset?.point || '') === String(pointKey)
      )
      const rk = card?.dataset?.region
        ? normalizeRegionKey(card.dataset.region)
        : null
      return rk || null
    } catch (e) {
      return null
    }
  }

  // Highlight both marker and its corresponding region for an active point
  const highlightPointAndRegion = (pointKey) => {
    try {
      if (!pointKey) {
        resetMarkers()
        resetRegions()
        return
      }
      selectedPointKey = String(pointKey)
      highlightMarkerWithoutDimming(pointKey)
      const rk = getRegionForPoint(pointKey)
      if (rk) highlightRegionByName(rk)
      else resetRegions()
    } catch (e) {
      // ignore
    }
  }
  // Helper: treat phones (portrait and landscape) as <=767px
  const isMobileOnlyNow = () => {
    try {
      if (typeof window === 'undefined' || !window.matchMedia) return false
      return window.matchMedia('(max-width: 767px)').matches
    } catch (e) {
      return false
    }
  }

  // Helper: treat mobile/tablet as touch or <=991px
  const isTouchOrSmallNow = () => {
    try {
      if (typeof window === 'undefined' || !window.matchMedia) return false
      return (
        window.matchMedia('(pointer: coarse)').matches ||
        window.matchMedia('(max-width: 991px)').matches
      )
    } catch (e) {
      return false
    }
  }
  const resetMarkers = () => {
    markers.forEach((m) => {
      m.classList.remove('highlight')
      m.classList.remove('dimmed')
      try {
        const circle = m.querySelector ? m.querySelector('circle') : null
        const targetEl = circle || m
        if (isSafariLike()) targetEl.removeAttribute('filter')
        // Remove injected fallback glows if any
        const oldGlows = m.querySelectorAll('.marker-glow, .marker-glow-2')
        oldGlows.forEach((n) => n.parentNode && n.parentNode.removeChild(n))
      } catch (e) {
        // ignore
      }
    })
  }

  const resetRegions = () => {
    regions.forEach((r) => r.classList.remove('highlight'))
  }

  const resetCardsDimming = () => {
    projectItems.forEach((c) => c.classList.remove('is-dimmed'))
  }

  // Removed resetAll: behavior now persists the active marker instead of resetting everything

  // Initial state: highlight first card's marker only (no active classes on items)
  let initialActiveCard = projectItems.length ? projectItems[0] : null
  let initialPointKey = initialActiveCard?.dataset?.point
    ? String(initialActiveCard.dataset.point)
    : null
  let selectedPointKey = initialPointKey || null
  try {
    if (initialPointKey) highlightPointAndRegion(initialPointKey)
    // Also sync to Swiper's initial active slide (Webflow can reorder DOM)
    try {
      const container =
        scope.querySelector('.swiper.projects-wrapper') ||
        scope.querySelector('.projects-wrapper.swiper')
      const sw =
        container && (container.__projectsSwiper || container.swiper)
          ? container.__projectsSwiper || container.swiper
          : null
      if (sw && sw.slides && typeof sw.activeIndex === 'number') {
        const s = sw.slides[sw.activeIndex]
        const pk = s?.dataset?.point ? String(s.dataset.point) : null
        if (pk) highlightPointAndRegion(pk)
      }
      // Post-render fallback: ensure glow visible after initial paint
      try {
        if (
          typeof window !== 'undefined' &&
          typeof window.requestAnimationFrame === 'function'
        ) {
          window.requestAnimationFrame(() => {
            if (selectedPointKey) highlightPointAndRegion(selectedPointKey)
          })
        }
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // ignore
    }
  } catch (e) {
    // ignore
  }
  // We no longer toggle `is-active` on items per viewport

  const reapplyActiveMarker = () => {
    try {
      const pk = selectedPointKey
      if (pk) highlightPointAndRegion(pk)
      else {
        resetMarkers()
        resetRegions()
      }
    } catch (e) {
      // ignore
    }
  }

  const highlightRegionByName = (regionKey) => {
    const normalized = normalizeRegionKey(regionKey)
    if (!normalized) {
      resetRegions()
      return
    }
    const regionEl = regionNameToRegion.get(normalized)
    if (!regionEl) {
      // Clear any existing highlights if target missing
      resetRegions()
      return
    }
    regions.forEach((r) => {
      if (r === regionEl) r.classList.add('highlight')
      else r.classList.remove('highlight')
    })
    // Bring highlighted region to front so its contour is fully visible
    try {
      const parent = regionEl.parentNode
      if (parent && typeof parent.appendChild === 'function') {
        parent.appendChild(regionEl)
      }
    } catch (e) {
      // ignore
    }
  }

  // Deprecated: highlightMarkerForPoint replaced by highlightPointAndRegion

  // Removed dimCardsExceptPoint: no longer used (we keep cards visible and just toggle is-active)

  // Removed scrollMapSectionToCard: we no longer auto-center/scroll to cards on hover

  // Interactions now handled by marker-hitbox buttons

  // Initialize Swiper on the projects wrapper (no controls/pagination)
  try {
    const container =
      scope.querySelector('.swiper.projects-wrapper') ||
      scope.querySelector('.projects-wrapper.swiper')
    if (container && !container.__swiperInitialized) {
      container.__swiperInitialized = true
      const instance = new Swiper(container, {
        modules: [Mousewheel],
        slidesPerView: 1.1,
        speed: 600,
        loop: false,
        centeredSlides: false,
        observer: true,
        observeParents: true,
        allowTouchMove: true,
        simulateTouch: true,
        grabCursor: true,
        touchStartPreventDefault: false,
        passiveListeners: false,
        touchEventsTarget: 'container',
        preventClicks: true,
        preventClicksPropagation: true,
        threshold: 0,
        mousewheel: {
          enabled: true,
          forceToAxis: true,
          sensitivity: 1,
          releaseOnEdges: true,
        },
        // Desktop & tablet: exactly 1 card visible; keep mobile behavior unchanged
        breakpoints: {
          0: {
            slidesPerView: 1.1,
            centeredSlides: false,
            speed: 600,
          },
          768: {
            slidesPerView: 1,
            spaceBetween: 0,
            centeredSlides: false,
            speed: 0,
          },
        },
      })
      container.__projectsSwiper = instance
      // also align with Swiper's default el.swiper usage
      try {
        container.swiper = container.swiper || instance
      } catch (e) {
        /* ignore */
      }

      // When active slide changes, activate corresponding map marker/region
      const syncFromActiveSlide = (sw) => {
        try {
          const activeIdx =
            sw && typeof sw.activeIndex === 'number' ? sw.activeIndex : null
          const activeSlide =
            activeIdx != null && sw && sw.slides && sw.slides[activeIdx]
              ? sw.slides[activeIdx]
              : container.querySelector('.swiper-slide-active')
          if (!activeSlide) return
          const pointKey = activeSlide?.dataset?.point
            ? String(activeSlide.dataset.point)
            : null
          if (!pointKey) return
          highlightPointAndRegion(pointKey)

          // Animate project-card entrance
          const projectCard = activeSlide.querySelector('.project-card')
          if (projectCard) {
            gsap.fromTo(
              projectCard,
              {
                opacity: 0,
                scale: 0.95,
                y: 20,
              },
              {
                opacity: 1,
                scale: 1,
                y: 0,
                duration: 0.4,
                ease: 'power2.out',
              }
            )
          }
        } catch (e) {
          // ignore
        }
      }
      try {
        instance.on('slideChangeTransitionStart', () => {
          // Animate out the previous slide's project-card
          const prevSlide = instance.slides[instance.previousIndex]
          if (prevSlide) {
            const prevCard = prevSlide.querySelector('.project-card')
            if (prevCard) {
              gsap.to(prevCard, {
                opacity: 0,
                scale: 0.95,
                y: -10,
                duration: 0.3,
                ease: 'power2.in',
              })
            }
          }
        })
        instance.on('slideChange', () => syncFromActiveSlide(instance))
        instance.on('activeIndexChange', () => syncFromActiveSlide(instance))
        instance.on('transitionEnd', () => syncFromActiveSlide(instance))
      } catch (e) {
        // ignore
      }
      // Initial sync to currently active slide
      syncFromActiveSlide(instance)

      // Animate initial project-card on page load
      try {
        const initialSlide = instance.slides[instance.activeIndex]
        if (initialSlide) {
          const initialCard = initialSlide.querySelector('.project-card')
          if (initialCard) {
            gsap.fromTo(
              initialCard,
              {
                opacity: 0,
                scale: 0.95,
                y: 20,
              },
              {
                opacity: 1,
                scale: 1,
                y: 0,
                duration: 0.5,
                delay: 0.2,
                ease: 'power2.out',
              }
            )
          }
        }
      } catch (e) {
        // ignore
      }

      // Désactive la navigation manuelle hors mobile (desktop + tablette)
      const syncPointerControls = () => {
        try {
          const disableMouseSlide = !isMobileOnlyNow()
          instance.allowTouchMove = !disableMouseSlide
          instance.params.simulateTouch = !disableMouseSlide
          const wheelMethod = disableMouseSlide ? 'disable' : 'enable'
          if (
            instance.mousewheel &&
            typeof instance.mousewheel[wheelMethod] === 'function'
          ) {
            instance.mousewheel[wheelMethod]()
          } else if (instance.params.mousewheel) {
            instance.params.mousewheel.enabled = !disableMouseSlide
          }
        } catch (e) {
          // ignore
        }
      }
      syncPointerControls()
      window.addEventListener('resize', syncPointerControls)
    }
  } catch (e) {
    // ignore
  }

  // Helper: slide Swiper to the card matching a given point
  const slideToPoint = (pointKey) => {
    try {
      const container =
        scope.querySelector('.swiper.projects-wrapper') ||
        scope.querySelector('.projects-wrapper.swiper')
      const sw =
        container && (container.__projectsSwiper || container.swiper)
          ? container.__projectsSwiper || container.swiper
          : null
      if (!sw) return false
      const slides = sw.slides ? Array.from(sw.slides) : []
      const idx = slides.findIndex((el) => {
        const pk = el?.dataset?.point ? String(el.dataset.point) : null
        return pk && pk === String(pointKey)
      })
      if (idx >= 0) {
        // Instant on tablet/desktop, animated on mobile
        let duration = 300
        try {
          if (
            typeof window !== 'undefined' &&
            window.matchMedia &&
            window.matchMedia('(min-width: 768px)').matches
          ) {
            duration = 0
          }
        } catch (e) {
          // ignore
        }
        sw.slideTo(idx, duration)
        // Ensure sync both immediately and after transition
        try {
          highlightPointAndRegion(pointKey)
        } catch (e) {
          /* ignore */
        }
        try {
          if (typeof sw.once === 'function') {
            sw.once('transitionEnd', () => highlightPointAndRegion(pointKey))
          }
        } catch (e) {
          // ignore
        }
        return true
      }
    } catch (e) {
      // ignore
    }
    return false
  }

  // Also react to hovering actual marker SVGs (not only hitbox), desktop/tablet only
  try {
    const isDesktopOrTablet = () => {
      try {
        if (typeof window === 'undefined' || !window.matchMedia) return true
        return !window.matchMedia('(max-width: 767px)').matches
      } catch (e) {
        return true
      }
    }
    markers.forEach((markerEl) => {
      markerEl.addEventListener('mouseenter', () => {
        if (!isDesktopOrTablet()) return
        const pointKey = markerToPoint.get(markerEl)
        if (!pointKey) return
        highlightPointAndRegion(pointKey)
        slideToPoint(pointKey)
      })
    })
  } catch (e) {
    // ignore
  }

  regions.forEach((regionEl) => {
    regionEl.addEventListener('mouseenter', () => {
      // Only region highlight per spec
      const id = regionEl.id || ''
      const m = id.match(/^region-(.+)$/)
      const regionKey = m && m[1] ? normalizeRegionKey(m[1]) : null
      if (regionKey) highlightRegionByName(regionKey)
      else resetRegions()
    })
    regionEl.addEventListener('mouseleave', () => {
      reapplyActiveMarker()
    })
  })

  // On mobile/tablet, disable hover effects on project cards
  try {
    if (isTouchOrSmallNow()) {
      const projectButtons = Array.from(scope.querySelectorAll('.project-card'))
      projectButtons.forEach((btn) => {
        try {
          btn.style.transition = 'none'
        } catch (e) {
          // ignore
        }
      })
    }
  } catch (e) {
    // ignore
  }

  projectItems.forEach((cardEl) => {
    cardEl.addEventListener('mouseenter', () => {
      if (isTouchOrSmallNow()) return
      const pointKey = cardEl?.dataset?.point
        ? String(cardEl.dataset.point)
        : null
      /* keep direct normalization for potential future use */
      if (pointKey) highlightPointAndRegion(pointKey)
      // Also dim other points per spec
      if (!pointKey) return
      markers.forEach((m) => {
        const mkPoint = markerToPoint.get(m)
        if (mkPoint && mkPoint !== pointKey) {
          m.classList.add('dimmed')
          m.classList.remove('highlight')
        }
      })
      // Do not change is-active here; hover shouldn't change persistent selection
    })
    cardEl.addEventListener('mouseleave', () => {
      if (isTouchOrSmallNow()) return
      const currentOverlays = (scope || document).querySelector(
        '.projects_overlays'
      )
      if (currentOverlays?.dataset?.open === 'true') return
      // Reapply active marker AND region; do not clear region after
      reapplyActiveMarker()
    })
    cardEl.addEventListener('click', (ev) => {
      try {
        const pointKey = cardEl?.dataset?.point
          ? String(cardEl.dataset.point)
          : null
        if (!pointKey) return
        ev.preventDefault()
        ev.stopPropagation()
        // Persist selection & sync highlight; remove scroll/overlay
        selectedPointKey = String(pointKey)
        highlightMarkerWithoutDimming(selectedPointKey)
        try {
          const regionKeyRaw = cardEl?.dataset?.region
          const rk = regionKeyRaw
            ? normalizeRegionKey(regionKeyRaw)
            : pointToRegionName.get(selectedPointKey)
          if (rk) highlightRegionByName(rk)
          else resetRegions()
        } catch (e) {
          // ignore
        }
        slideToPoint(pointKey)
      } catch (e) {
        // ignore
      }
    })
  })

  // Keep cards dimmed until leaving the wrapper
  try {
    const cardsWrapper = scope.querySelector('.cards-wrapper')
    if (cardsWrapper && !cardsWrapper.__cardsWrapperHandlersAttached) {
      cardsWrapper.__cardsWrapperHandlersAttached = true
      cardsWrapper.addEventListener('mouseleave', () => {
        resetCardsDimming()
      })
    }
  } catch (e) {
    // ignore
  }

  // Attach close handlers for overlays (once)
  try {
    const overlays = scope.querySelector('.projects_overlays')
    if (overlays && !overlays.__overlayHandlersAttached) {
      overlays.__overlayHandlersAttached = true
      // Close on .close-button inside overlays
      overlays.addEventListener('click', (ev) => {
        const btn =
          ev.target && ev.target.closest
            ? ev.target.closest('.close-button')
            : null
        if (btn) {
          ev.preventDefault()
          ev.stopPropagation()
          try {
            mapClose(scope)
          } catch (e) {
            // ignore
          }
        }
      })
      // Close when clicking outside overlays (but ignore marker clicks)
      if (!window.__mapOverlayDocClick) {
        const handler = (ev) => {
          try {
            // Resolve current overlays dynamically (page transitions replace DOM)
            const currentOverlays = (scope || document).querySelector(
              '.projects_overlays'
            )
            // Only when overlay is currently open
            const isOpen = currentOverlays?.dataset?.open === 'true'
            if (!isOpen) return
            const t = ev.target
            if (!t) return
            if (currentOverlays && currentOverlays.contains(t)) return
            if (
              t.closest &&
              (t.closest('.marker') || t.closest('.projects_overlays'))
            )
              return
            mapClose(scope || document)
          } catch (e) {
            // ignore
          }
        }
        window.__mapOverlayDocClick = handler
        document.addEventListener('click', handler)
      }
    }
  } catch (e) {
    // ignore
  }

  // Return context for potential debugging/extension
  return {
    markers,
    regions,
    projectItems,
    overlayItems,
    lookups: {
      pointToMarker,
      markerToPoint,
      regionNameToRegion,
      pointToProjectItems,
      regionNameToProjectItems,
      pointToRegionName,
      pointToOverlayItems,
    },
  }
}

export function mapOpen() {
  // Overlays disabled by spec: no animations/open
}

export function mapClose() {
  // Overlays disabled by spec; no-op
}
