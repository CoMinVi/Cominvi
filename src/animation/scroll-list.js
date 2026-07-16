import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function initScrollList(root = document) {
  // Support multiple sections that share the same behavior
  const sections = Array.from(
    (root || document).querySelectorAll('.section_partners')
  )
  if (!sections.length) return

  sections.forEach((section) => {
    // 1) Activate the .scroll-item which crosses the viewport center
    initScrollItems(section)

    // 2) Build ticks to fill height on each side indicators
    const indicators = Array.from(
      section.querySelectorAll('.content_column > .scroll-indicator')
    )
    if (indicators.length) {
      buildAllIndicators(indicators)
      setupTickHighlighting(section, indicators)

      // Rebuild on resize/orientation changes
      let resizeTimer
      const handleRebuild = () => {
        clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
          buildAllIndicators(indicators)
          ScrollTrigger.refresh()
        }, 150)
      }
      window.addEventListener('resize', handleRebuild)
      window.addEventListener('orientationchange', handleRebuild)
    }
  })
}

function initScrollItems(section) {
  const items = Array.from(
    section.querySelectorAll('.scroll-list .scroll-item')
  )
  if (!items.length) return

  // Support different typography sizes used across sections
  const spans = items.map((el) =>
    el.querySelector('.body-xl, .body-xxl, .body-next')
  )

  // Ensure initial state: all dimmed (respect existing dim classes)
  spans.forEach((span) => {
    if (!span) return
    span.classList.remove('is-active')
    const dimClass = span.classList.contains('is-o-15') ? 'is-o-15' : 'is-o-20'
    span.dataset.dimClass = dimClass
    if (
      !span.classList.contains('is-o-15') &&
      !span.classList.contains('is-o-20')
    ) {
      span.classList.add(dimClass)
    }
  })

  let currentActive = null

  // (removed unused helper)

  items.forEach((item, index) => {
    const span = spans[index]
    if (!span) return
    ScrollTrigger.create({
      trigger: item,
      start: 'top center',
      end: 'bottom center',
      onToggle(self) {
        if (self.isActive) {
          if (currentActive && currentActive !== span) {
            currentActive.classList.remove('is-active')
            const prevDim = currentActive.dataset.dimClass || 'is-o-20'
            if (!currentActive.classList.contains(prevDim))
              currentActive.classList.add(prevDim)
          }
          const dim = span.dataset.dimClass || 'is-o-20'
          if (span.classList.contains(dim)) span.classList.remove(dim)
          span.classList.add('is-active')
          currentActive = span
        } else {
          // Deactivate immediately when leaving the center zone
          if (currentActive === span) {
            span.classList.remove('is-active')
            const dim = span.dataset.dimClass || 'is-o-20'
            if (!span.classList.contains(dim)) span.classList.add(dim)
            currentActive = null
          }
        }
      },
    })
  })
}

function buildAllIndicators(indicators) {
  indicators.forEach((indicator) => buildIndicator(indicator))
}

function buildIndicator(indicator) {
  // Measure container and a sample tick
  const style = getComputedStyle(indicator)
  const rowGap = parseFloat(
    style.rowGap || style.getPropertyValue('row-gap') || style.gridRowGap || 0
  )

  // Create a temporary sample tick to measure if needed
  let sample = indicator.querySelector('.scroll-tick')
  let createdTemp = false
  if (!sample) {
    sample = document.createElement('div')
    sample.className = 'scroll-tick'
    indicator.appendChild(sample)
    createdTemp = true
  }

  const tickRect = sample.getBoundingClientRect()
  const tickHeight = tickRect && tickRect.height ? tickRect.height : 0

  // Prefer the actual container height when it's meaningful, otherwise fall back to a
  // reasonable viewport-based height so mobile (where percentage heights may resolve to 0)
  // still gets a full stack of ticks. We do NOT modify any CSS heights.
  let containerHeight = indicator.clientHeight
  if (!containerHeight || containerHeight <= 0) {
    const r = indicator.getBoundingClientRect()
    containerHeight = r && r.height ? r.height : 0
  }
  // Prefer matching the scroll-list height so indicators mirror the list column
  const section = indicator.closest('.section_partners')
  if (section) {
    const list = section.querySelector('.scroll-list')
    if (list) {
      const lr = list.getBoundingClientRect()
      const listH = Math.max(
        (lr && lr.height) || 0,
        list.clientHeight || 0,
        list.scrollHeight || 0
      )
      if (listH && listH > 0) containerHeight = listH
    }
  }
  if (!containerHeight || containerHeight <= tickHeight * 2) {
    // Fallback to section or viewport heights when needed (mobile edge cases)
    let sectionH = 0
    if (section) {
      const cs = section.clientHeight || 0
      const rs = section.getBoundingClientRect()
      sectionH = Math.max(cs, (rs && rs.height) || 0)
    }
    let viewportH = window.innerHeight || 0
    if (!viewportH) {
      viewportH = document.documentElement
        ? document.documentElement.clientHeight
        : 0
    }
    const baseH = containerHeight || 0
    const max1 = baseH > sectionH ? baseH : sectionH
    const max2 = max1 > viewportH ? max1 : viewportH
    containerHeight = max2 > tickHeight ? max2 : tickHeight
  }

  // Ensure the column wrapper matches the computed height (do not touch .scroll-indicator)
  const column = indicator.closest('.content_column')
  if (column) {
    const colRect = column.getBoundingClientRect()
    const colRectH = (colRect && colRect.height) || 0
    const colClientH = column.clientHeight || 0
    const colH = colRectH > colClientH ? colRectH : colClientH
    if (!colH || Math.abs(colH - containerHeight) > 1) {
      column.style.height = containerHeight + 'px'
    }
  }

  // Compute number of ticks so that ticks + gaps fill the height
  const perUnit = tickHeight + rowGap
  let count =
    perUnit > 0
      ? Math.max(1, Math.floor((containerHeight + rowGap) / perUnit))
      : 1

  // Clear and rebuild ticks
  indicator.innerHTML = ''
  const frag = document.createDocumentFragment()
  for (let i = 0; i < count; i++) {
    const t = document.createElement('div')
    t.className = 'scroll-tick'
    frag.appendChild(t)
  }
  indicator.appendChild(frag)

  // Cleanup temp (already removed by innerHTML = '')
  if (createdTemp) {
    // no-op
  }
}

function setupTickHighlighting(section, indicators) {
  const wrapper =
    document.querySelector('.page-wrap') ||
    section.closest('.page-wrap') ||
    window

  // On tablet & mobile, center relative to 100svh (small viewport height)
  // to avoid browser UI chrome affecting the visual center. We measure 100svh
  // via a temporary element and cache it until the next resize/orientation.
  const isTabletOrMobile =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(max-width: 991px)').matches
      : false

  let cachedSVH = 0
  const measureSVH = () => {
    try {
      const el = document.createElement('div')
      el.style.position = 'fixed'
      el.style.top = '0'
      el.style.left = '0'
      el.style.height = '100svh'
      el.style.width = '0'
      el.style.pointerEvents = 'none'
      el.style.opacity = '0'
      el.style.visibility = 'hidden'
      document.documentElement.appendChild(el)
      const h = el.getBoundingClientRect().height || el.offsetHeight || 0
      el.remove()
      return h
    } catch (e) {
      return 0
    }
  }

  const refreshSVH = () => {
    cachedSVH = measureSVH()
  }

  if (isTabletOrMobile) {
    refreshSVH()
    const svhResizeHandler = () => {
      // Debounce to avoid excessive recalcs
      clearTimeout(svhResizeHandler._t)
      svhResizeHandler._t = setTimeout(refreshSVH, 100)
    }
    window.addEventListener('resize', svhResizeHandler)
    window.addEventListener('orientationchange', svhResizeHandler)
  }

  const updateTicks = () => {
    let viewportRect
    const viewportHeight =
      // Use 100svh on tablet/mobile when available; fallback to innerHeight
      isTabletOrMobile && cachedSVH > 0 ? cachedSVH : window.innerHeight

    if (wrapper === window) {
      // Center is half of 100svh or innerHeight
      viewportRect = { top: 0, height: viewportHeight }
    } else {
      const rect = wrapper.getBoundingClientRect()
      if (isTabletOrMobile) {
        // On tablet/mobile, always center relative to viewport 100svh, not wrapper
        viewportRect = { top: 0, height: viewportHeight }
      } else {
        viewportRect = { top: rect.top, height: rect.height }
      }
    }
    const viewportCenter = viewportRect.top + viewportRect.height / 2

    indicators.forEach((indicator) => {
      const ticks = Array.from(indicator.querySelectorAll('.scroll-tick'))
      if (!ticks.length) return

      // Find the tick whose center is closest to viewport center
      let closestIndex = 0
      let closestDist = Infinity
      ticks.forEach((tick, idx) => {
        const r = tick.getBoundingClientRect()
        const center = r.top + r.height / 2
        const d = Math.abs(center - viewportCenter)
        if (d < closestDist) {
          closestDist = d
          closestIndex = idx
        }
      })

      // Reset classes
      ticks.forEach((tick) => {
        tick.classList.remove('is-xxl', 'is-xl', 'is-l', 'is-m')
      })

      // Apply gradient classes around the closest tick
      const set = (i, cls) => {
        if (i >= 0 && i < ticks.length) ticks[i].classList.add(cls)
      }
      set(closestIndex, 'is-xxl')
      set(closestIndex - 1, 'is-xl')
      set(closestIndex + 1, 'is-xl')
      set(closestIndex - 2, 'is-l')
      set(closestIndex + 2, 'is-l')
      set(closestIndex - 3, 'is-m')
      set(closestIndex + 3, 'is-m')
    })
  }

  // Update while the partners section is near the viewport
  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: updateTicks,
    onEnter: updateTicks,
    onEnterBack: updateTicks,
  })

  // Initial update once
  updateTicks()
}
