import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger, CustomEase)

const TEAM_INTERACTION_EASE = CustomEase.create(
  'team-interaction-ease',
  'M0,0 C0.6,0 0,1 1,1'
)

function buildIndicator(indicator) {
  const style = getComputedStyle(indicator)
  const rowGap = parseFloat(
    style.rowGap || style.getPropertyValue('row-gap') || style.gridRowGap || 0
  )

  // Ensure we always have a measurable tick
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

  // Compute a robust container height with mobile fallbacks
  let containerHeight = indicator.clientHeight
  if (!containerHeight || containerHeight <= 0) {
    const r = indicator.getBoundingClientRect()
    containerHeight = r && r.height ? r.height : 0
  }
  // Try to mirror the scroll-list column height inside this section
  const section = indicator.closest('.section_work-team')
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
    // Fallback to section or viewport height to ensure a visible stack on mobile
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

  // Keep the column wrapper in sync so layout is correct without CSS hacks
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

  const perUnit = tickHeight + rowGap
  let count =
    perUnit > 0
      ? Math.max(1, Math.floor((containerHeight + rowGap) / perUnit))
      : 1

  indicator.innerHTML = ''
  const frag = document.createDocumentFragment()
  for (let i = 0; i < count; i++) {
    const t = document.createElement('div')
    t.className = 'scroll-tick'
    frag.appendChild(t)
  }
  indicator.appendChild(frag)

  if (createdTemp) {
    // no-op
  }
}

function buildAllIndicators(indicators) {
  indicators.forEach((indicator) => buildIndicator(indicator))
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

      ticks.forEach((tick) => {
        tick.classList.remove('is-xxl', 'is-xl', 'is-l', 'is-m')
      })

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

  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: updateTicks,
    onEnter: updateTicks,
    onEnterBack: updateTicks,
  })

  // Expose an updater for external recalculation (resize/orientation/font load)
  try {
    section._updateTeamTicks = updateTicks
  } catch (e) {
    // ignore
  }

  // Recalculate once fonts are ready (line heights may change)
  try {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => updateTicks())
    }
  } catch (e) {
    // ignore
  }

  updateTicks()
}

function initWorkTeamSection(section) {
  if (!section) return

  const items = Array.from(
    section.querySelectorAll('.scroll-list .scroll-item')
  )
  if (items.length) {
    const spans = items
      .map((el) => el.querySelector('.body-xl, .body-xxl, .body-next'))
      .filter(Boolean)

    spans.forEach((span) => {
      span.classList.remove('is-active')
      const dimClass = span.classList.contains('is-o-15')
        ? 'is-o-15'
        : 'is-o-20'
      span.dataset.dimClass = dimClass
      if (
        !span.classList.contains('is-o-15') &&
        !span.classList.contains('is-o-20')
      ) {
        span.classList.add(dimClass)
      }
    })

    let currentActive = null
    const activateSpan = (span) => {
      if (!span) return
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
    }
    const deactivateSpan = (span) => {
      if (!span) return
      span.classList.remove('is-active')
      const dim = span.dataset.dimClass || 'is-o-20'
      if (!span.classList.contains(dim)) span.classList.add(dim)
      if (currentActive === span) currentActive = null
    }
    items.forEach((item, index) => {
      const span = spans[index]
      if (!span) return
      ScrollTrigger.create({
        trigger: item,
        start: 'top center',
        end: 'bottom center',
        onToggle(self) {
          if (self.isActive) {
            activateSpan(span)
          } else if (currentActive === span) {
            const isLast = index === items.length - 1
            const isFirst = index === 0
            // Keep last active when scrolling down past the list
            if (isLast && self.direction > 0) return
            // Keep first active when scrolling up past the list
            if (isFirst && self.direction < 0) return
            deactivateSpan(span)
          }
        },
      })
    })

    // Center-based active selection to avoid keeping the first item active while scrolling down
    const updateActiveToCenter = () => {
      const winH = typeof window !== 'undefined' ? window.innerHeight : 0
      if (!winH) return
      const viewportCenter = winH / 2
      let closest = null
      let closestDist = Infinity
      spans.forEach((span) => {
        const r = span.getBoundingClientRect()
        const center = r.top + r.height / 2
        const d = Math.abs(center - viewportCenter)
        if (d < closestDist) {
          closestDist = d
          closest = span
        }
      })
      if (closest) activateSpan(closest)
    }

    ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: updateActiveToCenter,
      onEnter: updateActiveToCenter,
      onEnterBack: updateActiveToCenter,
    })

    // Initial center-based selection
    updateActiveToCenter()
  }

  // Be flexible: some exports may wrap indicators differently on mobile
  const indicators = [
    ...section.querySelectorAll('.content_column > .scroll-indicator'),
    ...section.querySelectorAll(
      '.content_column.scroll-indicator > .scroll-indicator'
    ),
  ]
  if (indicators.length) {
    buildAllIndicators(indicators)
    setupTickHighlighting(section, indicators)

    let resizeTimer
    const recalc = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        buildAllIndicators(indicators)
        ScrollTrigger.refresh()
        try {
          if (typeof section._updateTeamTicks === 'function') {
            section._updateTeamTicks()
          }
        } catch (e) {
          // ignore
        }
      }, 150)
    }
    window.addEventListener('resize', recalc)
    window.addEventListener('orientationchange', recalc)
    window.addEventListener('load', recalc)
  }
}

function initEquitySlider(section) {
  if (!section) return
  const column = section.querySelector('.equity-slider_slide_column')
  if (!column) return
  const stage =
    section.closest('.equity-stage') || section.querySelector('.equity-stage')

  gsap.set(column, { yPercent: 0 })

  const tl = gsap.timeline({
    paused: true,
    defaults: { ease: TEAM_INTERACTION_EASE },
  })
  tl.to(column, { yPercent: -50, duration: 0.8 }, 0)

  // Circle tick reveal (like minerals): drive conic mask arc (start/end) in two phases
  const darkSvg = section.querySelector('.circle.is-2')
  if (darkSvg) {
    const maskCSS =
      'conic-gradient(from 0deg at 50% 50%, transparent 0deg var(--start, 0deg), #fff var(--start, 0deg) var(--end, 0deg), transparent var(--end, 0deg) 360deg)'
    darkSvg.style.webkitMaskImage = maskCSS
    darkSvg.style.maskImage = maskCSS
    darkSvg.style.maskMode = 'luminance'
    darkSvg.style.webkitMaskRepeat = 'no-repeat'
    darkSvg.style.maskRepeat = 'no-repeat'
    darkSvg.style.webkitMaskPosition = 'center'
    darkSvg.style.maskPosition = 'center'
    darkSvg.style.setProperty('--start', '0deg')
    darkSvg.style.setProperty('--end', '0deg')
    darkSvg.style.willChange = 'transform, -webkit-mask-image, mask-image'

    // Color active ticks to var(--accent)
    try {
      const accent = 'var(--accent)'
      const lines = darkSvg.querySelectorAll('line')
      lines.forEach((ln) => {
        ln.style.stroke = accent
      })
    } catch (e) {
      // ignore
    }

    const arc = { start: 0, end: 0 }
    tl.to(
      arc,
      {
        end: 126, // 35% of 360°
        duration: 0.27,
        onUpdate: () => {
          try {
            darkSvg.style.setProperty('--start', arc.start + 'deg')
            darkSvg.style.setProperty('--end', arc.end + 'deg')
          } catch (e) {
            // ignore
          }
        },
      },
      0
    )
    tl.to(
      arc,
      {
        // Sweep with a 65% arc (234°) by the end of phase 2
        start: 126, // 35%
        end: 360, // 100%
        duration: 0.53,
        onUpdate: () => {
          try {
            darkSvg.style.setProperty('--start', arc.start + 'deg')
            darkSvg.style.setProperty('--end', arc.end + 'deg')
          } catch (e) {
            // ignore
          }
        },
      },
      0.27
    )
  }

  const labels = Array.from(
    section.querySelectorAll('.equity-slider_slide.is-2 .body-l')
  )
  if (labels.length) {
    gsap.set(labels, { yPercent: 0 })
    tl.to(labels, { yPercent: -100, duration: 0.8 }, 0)
  }

  ScrollTrigger.create({
    trigger: stage || section,
    start: () => `top ${Math.round(window.innerHeight * 0.1)}px`,
    invalidateOnRefresh: true,
    once: true,
    onEnter: () => tl.play(),
  })
}

export function initTeam(root = document) {
  const teamSection = (root || document).querySelector('.section_work-team')
  if (teamSection) initWorkTeamSection(teamSection)

  const equityInner = (root || document).querySelector('.equity-inner')
  if (equityInner) initEquitySlider(equityInner)

  // Abbreviate eyebrows in positions section (first word → 3 letters)
  const positionsSection = (root || document).querySelector(
    '.section_positions'
  )
  // Only apply on screens wider than 767px (disable on mobile)
  if (
    positionsSection &&
    typeof window !== 'undefined' &&
    window.innerWidth > 767
  )
    abbreviatePositionsEyebrows(positionsSection)

  // Toggle abbreviation on breakpoint changes (desktop ↔ mobile)
  if (positionsSection && typeof window !== 'undefined') {
    let wasDesktop = window.innerWidth > 767
    let resizeTimer
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const isDesktop = window.innerWidth > 767
        if (isDesktop !== wasDesktop) {
          if (isDesktop) {
            abbreviatePositionsEyebrows(positionsSection)
          } else {
            restorePositionsEyebrows(positionsSection)
          }
          wasDesktop = isDesktop
        }
      }, 150)
    })
  }
}

function abbreviatePositionsEyebrows(section) {
  try {
    const eyebrowElements = Array.from(
      section.querySelectorAll('.sissmac-row .eyebrow-wrapper .eyebrow-m')
    )
    if (!eyebrowElements.length) return
    eyebrowElements.forEach((element) => {
      if (element.dataset.abbrevApplied === '1') return
      if (!element.dataset.abbrevOriginal) {
        // store original HTML so we can restore on mobile
        element.dataset.abbrevOriginal = element.innerHTML
      }
      const originalText = element.textContent || ''
      if (!originalText.trim()) return
      const match = originalText.match(/^(\s*)(\S+)([\s\S]*)$/)
      if (!match) return
      const prefix = match[1] || ''
      const firstWord = match[2] || ''
      const tail = match[3] || ''
      const abbreviated = firstWord.slice(0, 3)
      let result = prefix + abbreviated + tail
      // Insert a line break after the first comma
      result = result.replace(/,\s*/, ',<br> ')
      element.innerHTML = result
      element.dataset.abbrevApplied = '1'
    })
  } catch (e) {
    // ignore
  }
}

function restorePositionsEyebrows(section) {
  try {
    const eyebrowElements = Array.from(
      section.querySelectorAll('.sissmac-row .eyebrow-wrapper .eyebrow-m')
    )
    if (!eyebrowElements.length) return
    eyebrowElements.forEach((element) => {
      if (element.dataset.abbrevApplied === '1') {
        const original = element.dataset.abbrevOriginal
        if (typeof original === 'string') {
          element.innerHTML = original
        }
        delete element.dataset.abbrevApplied
        delete element.dataset.abbrevOriginal
      }
    })
  } catch (e) {
    // ignore
  }
}
