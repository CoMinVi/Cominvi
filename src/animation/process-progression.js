import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import {
  getIntersectionObserverRoot,
  isNearViewport,
} from './scroll-performance.js'

let processInitRafId = null
let processInitInnerRafId = null
let processResizeTimer = null

gsap.registerPlugin(ScrollTrigger)

export function destroyProcessProgression() {
  if (processInitRafId != null) cancelAnimationFrame(processInitRafId)
  if (processInitInnerRafId != null) cancelAnimationFrame(processInitInnerRafId)
  if (processResizeTimer != null) clearTimeout(processResizeTimer)
  processInitRafId = null
  processInitInnerRafId = null
  processResizeTimer = null

  try {
    if (window.__processResizeHandler) {
      window.removeEventListener('resize', window.__processResizeHandler)
      window.__processResizeHandler = null
    }
    if (window.__processScrollListenerCleanup) {
      window.__processScrollListenerCleanup()
      window.__processScrollListenerCleanup = null
    }
    if (window.__processCleanupMobile) {
      window.__processCleanupMobile()
      window.__processCleanupMobile = null
    }
    window.__processProgressionCleanup = null
  } catch (e) {
    // ignore cleanup failures from detached Barba containers
  }
}

export function initProcessProgression(root = document) {
  destroyProcessProgression()
  const section =
    root.querySelector('.section_process') ||
    document.querySelector('.section_process')
  if (!section) return

  const sticky = section.querySelector('.process-progression-inner')
  const track = section.querySelector('.process-progression')
  if (!sticky || !track) return

  // Clean up any existing triggers from a previous page to avoid duplicates
  try {
    const wrapEl =
      section.querySelector('.process-progression-wrap') ||
      sticky.parentElement ||
      section
    const all = ScrollTrigger.getAll()
    all.forEach((st) => {
      try {
        if (
          st &&
          st.vars &&
          (st.vars.trigger === wrapEl || st.vars.trigger === sticky)
        ) {
          st.kill()
        }
      } catch (e) {
        // ignore
      }
    })
  } catch (e) {
    // ignore
  }

  // Optional number track and readout (support both 'process' and 'procress' typos)
  const numberTrack =
    section.querySelector('.process-progression_number') ||
    section.querySelector('.procress-progression_number') ||
    null
  let numberInner = null
  if (numberTrack) {
    numberInner = numberTrack.querySelector('.process-progression_number-inner')
    if (!numberInner) {
      numberInner = numberTrack.querySelector(
        '.procress-progression_number-inner'
      )
    }
  }
  let progressReadout = section.querySelector(
    '.process-progression #process-progress'
  )
  if (!progressReadout) {
    progressReadout = section.querySelector(
      '.procress-progression #process-progress'
    )
  }
  if (!progressReadout) {
    progressReadout = section.querySelector('#process-progress')
  }

  // Ensure the number indicator can move using absolute positioning
  try {
    if (numberTrack && !numberTrack.style.position) {
      numberTrack.style.position = 'relative'
    }
    if (numberInner) {
      numberInner.style.position = 'absolute'
      numberInner.style.left = '0%'
      numberInner.style.top = '50%'
      numberInner.style.transform = 'translateY(-50%)'
      numberInner.style.willChange = 'left'
    }
  } catch (e) {
    // ignore
  }

  try {
    track.style.height = '100%'
    track.style.flexDirection = 'row'
    track.style.justifyContent = 'flex-start'
    track.style.alignItems = 'flex-end'
  } catch (e) {
    // ignore
  }

  const doInit = () => {
    processInitInnerRafId = null
    buildVerticalTicks(track, sticky)
    syncLastProcessEndAlignment(section, sticky)
    let runTickUpdate = null
    let runTickRefresh = null
    let controls = null
    let resizePending = false

    const rebuildForResize = () => {
      resizePending = false
      buildVerticalTicks(track, sticky)
      syncLastProcessEndAlignment(section, sticky)
      ScrollTrigger.refresh()
      if (typeof runTickRefresh === 'function') runTickRefresh()
      if (typeof runTickUpdate === 'function') runTickUpdate()
    }
    window.__processResizeHandler = () => {
      if (processResizeTimer != null) clearTimeout(processResizeTimer)
      processResizeTimer = setTimeout(() => {
        processResizeTimer = null
        syncLastProcessEndAlignment(section, sticky)
        if (controls && !controls.isNear()) {
          resizePending = true
          return
        }
        rebuildForResize()
      }, 150)
    }
    window.addEventListener('resize', window.__processResizeHandler)

    controls = setupVerticalTickHighlighting(section, sticky, track, {
      numberTrack,
      numberInner,
      progressReadout,
      onNear: () => {
        if (resizePending) rebuildForResize()
      },
    })
    if (controls && typeof controls.update === 'function') {
      runTickUpdate = controls.update
    }
    if (controls && typeof controls.refreshTicks === 'function') {
      runTickRefresh = controls.refreshTicks
    }

    const cleanupMobileLayout = syncProcessMobileLayout(section)
    window.__processCleanupMobile = cleanupMobileLayout

    // Ensure triggers calculate with settled layout
    try {
      ScrollTrigger.refresh()
    } catch (e) {
      // ignore
    }
  }

  // Defer initialization slightly to let the destination layout settle after transition-next
  window.__processProgressionCleanup = destroyProcessProgression
  processInitRafId = requestAnimationFrame(() => {
    processInitRafId = null
    processInitInnerRafId = requestAnimationFrame(doInit)
  })
}

function syncLastProcessEndAlignment(section, sticky) {
  if (!section || !sticky) return

  const processes = section.querySelector('.processes')
  const wrap = processes?.querySelector(':scope > .process-progression-wrap')
  const video = processes?.querySelector(':scope > .video')
  const media = video?.querySelector('.video-inner, video, img')
  const processItems = Array.from(processes?.querySelectorAll('.process') || [])
  const lastProcess = processItems[processItems.length - 1]
  const lastBorder = lastProcess?.querySelector('.process_inner')
  if (!wrap || !video || !media || !lastProcess || !lastBorder) return

  try {
    if (wrap.__processProgressionOriginalBottom === undefined) {
      wrap.__processProgressionOriginalBottom = wrap.style.bottom
    }
    if (lastProcess.__processProgressionOriginalHeight === undefined) {
      lastProcess.__processProgressionOriginalHeight = lastProcess.style.height
    }
    wrap.style.bottom = wrap.__processProgressionOriginalBottom
    lastProcess.style.height = lastProcess.__processProgressionOriginalHeight

    const processesStyle = getComputedStyle(processes)
    const wrapStyle = getComputedStyle(wrap)
    const videoStyle = getComputedStyle(video)
    if (wrapStyle.display === 'none' || videoStyle.position !== 'sticky') return

    const processesPaddingBottom = parseFloat(processesStyle.paddingBottom) || 0
    const videoTop = parseFloat(videoStyle.top) || 0
    const videoMarginBottom = parseFloat(videoStyle.marginBottom) || 0
    const stickyRect = sticky.getBoundingClientRect()
    const videoRect = video.getBoundingClientRect()
    const mediaRect = media.getBoundingClientRect()
    const lastProcessRect = lastProcess.getBoundingClientRect()
    const lastBorderRect = lastBorder.getBoundingClientRect()
    const videoReleaseOffset =
      processesPaddingBottom +
      videoTop +
      videoRect.height +
      videoMarginBottom -
      stickyRect.height
    wrap.style.bottom = `${Math.max(0, videoReleaseOffset)}px`

    const contentBottomAtRelease =
      stickyRect.height + videoReleaseOffset - processesPaddingBottom
    const mediaBottomAtRelease = videoTop + (mediaRect.bottom - videoRect.top)
    const borderBottomWithinLastProcess =
      lastBorderRect.bottom - lastProcessRect.top
    const borderBottomAtRelease =
      contentBottomAtRelease -
      lastProcessRect.height +
      borderBottomWithinLastProcess
    const borderGap = borderBottomAtRelease - mediaBottomAtRelease

    lastProcess.style.height = `${Math.max(
      0,
      lastProcessRect.height + borderGap
    )}px`
  } catch (e) {
    // Keep the Webflow layout as fallback when measurements are unavailable.
  }
}

function buildVerticalTicks(track, sticky) {
  const style = getComputedStyle(track)
  const gap = parseFloat(
    style.columnGap || style.getPropertyValue('column-gap') || style.gap || 0
  )

  let sample = track.querySelector('.scroll-tick.vertical')
  let createdTemp = false
  if (!sample) {
    sample = document.createElement('div')
    sample.className = 'scroll-tick vertical'
    track.appendChild(sample)
    createdTemp = true
  }

  const tickRect = sample.getBoundingClientRect()
  const tickWidth = tickRect.width || 2
  let containerWidth = track.clientWidth
  if (!containerWidth && sticky) {
    try {
      const s = getComputedStyle(sticky)
      const pl = parseFloat(s.paddingLeft || 0)
      const pr = parseFloat(s.paddingRight || 0)
      containerWidth = Math.max(0, sticky.clientWidth - pl - pr)
    } catch (e) {
      containerWidth = sticky.clientWidth || 0
    }
  }
  const perUnit = tickWidth + gap
  const count =
    perUnit > 0 ? Math.max(1, Math.floor((containerWidth + gap) / perUnit)) : 1

  const oldTicks = Array.from(track.querySelectorAll('.scroll-tick.vertical'))
  oldTicks.forEach((node) => node.remove())

  const frag = document.createDocumentFragment()
  for (let i = 0; i < count; i++) {
    const t = document.createElement('div')
    t.className = 'scroll-tick vertical'
    frag.appendChild(t)
  }
  track.appendChild(frag)

  if (createdTemp) {
    // no-op
  }
}

function setupVerticalTickHighlighting(section, sticky, track, extras = {}) {
  // Map progress exactly as requested:
  // 0% when the first .process enters the viewport, stays 0 until its top hits the viewport top,
  // progresses from there, and reaches 100% when the bottom of the last .process hits the viewport bottom.

  const processes = Array.from(section.querySelectorAll('.process'))
  const firstProcess = processes.length ? processes[0] : null
  const lastProcess = processes.length ? processes[processes.length - 1] : null

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
  let ticks = Array.from(track.querySelectorAll('.scroll-tick.vertical'))
  let activeTickIndex = -1
  let lastProgressPx = null
  let lastProgressPercent = null
  let sectionIsNear = isNearViewport(
    section.getBoundingClientRect(),
    window.innerHeight || document.documentElement.clientHeight || 0,
    0.5
  )

  const update = () => {
    if (!sectionIsNear || !ticks.length) return

    const viewportH =
      window.innerHeight || document.documentElement.clientHeight || 0

    // Mesure purement via getBoundingClientRect (indépendant de Lenis)
    let startRel = 0
    let endRel = 1
    if (firstProcess) {
      const r1 = firstProcess.getBoundingClientRect()
      startRel = Math.round(r1.top) // top du premier .process vs viewport top (0)
    }
    if (lastProcess) {
      const r2 = lastProcess.getBoundingClientRect()
      endRel = Math.round(r2.bottom - viewportH) // bottom du dernier .process vs viewport bottom (0)
    }
    if (endRel <= startRel) endRel = startRel + 1 // éviter division par 0

    // Progression basée sur la position actuelle du viewport (0)
    let progress = clamp01((0 - startRel) / (endRel - startRel))
    if (endRel <= 1) progress = 1

    // Highlight ticks around the current progress
    const exactIndex = progress * (ticks.length - 1)
    const activeIndex = Math.round(exactIndex)
    if (activeIndex !== activeTickIndex) {
      ticks.forEach((t) =>
        t.classList.remove('is-xxl', 'is-xl', 'is-l', 'is-m')
      )
      const set = (i, cls) => {
        if (i >= 0 && i < ticks.length) ticks[i].classList.add(cls)
      }
      set(activeIndex, 'is-xxl')
      set(activeIndex - 1, 'is-xl')
      set(activeIndex + 1, 'is-xl')
      set(activeIndex - 2, 'is-l')
      set(activeIndex + 2, 'is-l')
      set(activeIndex - 3, 'is-m')
      set(activeIndex + 3, 'is-m')
      activeTickIndex = activeIndex
    }

    // Drive the number indicator and textual %
    try {
      const pct = Math.round(progress * 100)
      if (extras && extras.numberInner) {
        const container = extras.numberInner.parentElement
        if (container) {
          const cw =
            container.clientWidth ||
            container.getBoundingClientRect().width ||
            0
          const iw = extras.numberInner.getBoundingClientRect().width || 0
          const travel = Math.max(0, cw - iw)
          const posPx =
            Math.round(Math.min(travel, Math.max(0, travel * progress)) * 10) /
            10
          if (posPx !== lastProgressPx) {
            extras.numberInner.style.left = `${posPx}px`
            lastProgressPx = posPx
          }
        }
      }
      if (extras && extras.progressReadout && lastProgressPercent !== pct) {
        extras.progressReadout.textContent = String(pct)
        lastProgressPercent = pct
      }
    } catch (e) {
      // ignore
    }
  }

  // Drive updates on real scroll events (Lenis or native), decoupled from triggers
  try {
    // Cleanup any previous scroll listener
    if (window.__processScrollListenerCleanup) {
      window.__processScrollListenerCleanup()
      window.__processScrollListenerCleanup = null
    }
  } catch (e) {
    // ignore
  }

  let rafId = null
  let proximityObserver = null
  const rafUpdate = () => {
    if (!sectionIsNear || rafId != null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      update()
    })
  }
  const bind = () => {
    if (window.lenis && typeof window.lenis.on === 'function') {
      const handler = rafUpdate
      window.lenis.on('scroll', handler)
      return () => {
        try {
          if (typeof window.lenis.off === 'function')
            window.lenis.off('scroll', handler)
        } catch (e) {
          // ignore
        }
      }
    }
    const handler = rafUpdate
    window.addEventListener('scroll', handler, { passive: true })
    return () => {
      try {
        window.removeEventListener('scroll', handler)
      } catch (e) {
        // ignore
      }
    }
  }

  const unbindScroll = bind()
  if ('IntersectionObserver' in window) {
    const wrapper = window.__lenisWrapper || null
    proximityObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        sectionIsNear = !!entry && entry.isIntersecting
        if (sectionIsNear) {
          if (typeof extras.onNear === 'function') extras.onNear()
          rafUpdate()
        }
      },
      {
        root: getIntersectionObserverRoot(wrapper, section),
        rootMargin: '50% 0px 50% 0px',
        threshold: 0,
      }
    )
    proximityObserver.observe(section)
  }

  try {
    window.__processScrollListenerCleanup = () => {
      unbindScroll()
      if (proximityObserver) proximityObserver.disconnect()
      if (rafId != null) cancelAnimationFrame(rafId)
      rafId = null
    }
  } catch (e) {
    // ignore
  }

  update()
  return {
    update: rafUpdate,
    refreshTicks() {
      ticks = Array.from(track.querySelectorAll('.scroll-tick.vertical'))
      activeTickIndex = -1
      rafUpdate()
    },
    isNear() {
      return sectionIsNear
    },
  }
}

export function syncProcessMobileLayout(section) {
  if (!section) return () => {}
  const processes = Array.from(section.querySelectorAll('.process'))
  if (!processes.length) return () => {}

  const notifyTextRevealReflow = () => {
    if (typeof window === 'undefined') return
    try {
      if (typeof window.__textRevealOnResize === 'function') {
        window.__textRevealOnResize()
        return
      }
    } catch (e) {
      // ignore
    }
    try {
      window.dispatchEvent(new Event('resize'))
    } catch (e) {
      // ignore
    }
  }

  const restoreInlineStyles = (target, styles) => {
    if (!target || !styles) return
    Object.entries(styles).forEach(([prop, value]) => {
      target.style[prop] = value ?? ''
    })
  }

  const restoreIndex = (proc) => {
    if (!proc) return
    const processIndex = proc.querySelector('.process_index')
    const title = proc.querySelector('.process-title')
    const inner = proc.querySelector('.process_inner')
    const processInfos = proc.querySelector('.process-infos')
    const desc = inner?.querySelector('.process-desc')
    if (!processIndex) return

    if (title && processIndex.parentElement !== title) {
      const heading = title.querySelector('h3, .body-l')
      if (heading) title.insertBefore(processIndex, heading)
      else title.prepend(processIndex)
    }

    if (inner) {
      restoreInlineStyles(inner, {
        display: '',
        gridTemplateColumns: '',
        columnGap: '',
        marginLeft: '',
        marginRight: '',
      })
    }
    restoreInlineStyles(processIndex, {
      gridColumn: '',
      paddingTop: '',
    })
    if (processInfos) {
      restoreInlineStyles(processInfos, { width: '' })
    }
    if (desc) {
      desc.style.gridColumn = ''
      desc.style.display = ''
    }
  }

  const revertDesktop = () => processes.forEach(restoreIndex)

  revertDesktop()
  notifyTextRevealReflow()

  return () => {
    revertDesktop()
  }
}
