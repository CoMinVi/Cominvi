import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

const PROCESS_MOBILE_MAX = 767
const processIndexOrigins = new WeakMap()

const isProcessMobile = () => window.innerWidth < PROCESS_MOBILE_MAX

gsap.registerPlugin(ScrollTrigger)

export function initProcessProgression(root = document) {
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
    buildVerticalTicks(track, sticky)

    // De-dupe resize listener across transitions
    try {
      if (window.__processResizeHandler) {
        window.removeEventListener('resize', window.__processResizeHandler)
      }
      if (window.__processCleanupMobile) {
        window.__processCleanupMobile()
        window.__processCleanupMobile = null
      }
    } catch (e) {
      // ignore
    }
    let resizeTimer
    window.__processResizeHandler = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        buildVerticalTicks(track, sticky)
        ScrollTrigger.refresh()
      }, 150)
    }
    window.addEventListener('resize', window.__processResizeHandler)

    setupVerticalTickHighlighting(section, sticky, track, {
      numberTrack,
      numberInner,
      progressReadout,
    })

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
  requestAnimationFrame(() => requestAnimationFrame(doInit))
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

  track.innerHTML = ''
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

  const ticks = Array.from(track.querySelectorAll('.scroll-tick.vertical'))
  if (!ticks.length) return

  const processes = Array.from(section.querySelectorAll('.process'))
  const firstProcess = processes.length ? processes[0] : null
  const lastProcess = processes.length ? processes[processes.length - 1] : null

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

  const update = () => {
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
    // Lorsque le bas du dernier .process atteint (ou dépasse) le bas du viewport, verrouiller à 1
    if (lastProcess) {
      const r2 = lastProcess.getBoundingClientRect()
      if (Math.round(r2.bottom - viewportH) <= 1) progress = 1
    }

    // Highlight ticks around the current progress
    const exactIndex = progress * (ticks.length - 1)
    const activeIndex = Math.round(exactIndex)
    ticks.forEach((t) => t.classList.remove('is-xxl', 'is-xl', 'is-l', 'is-m'))
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
          const posPx = Math.min(travel, Math.max(0, travel * progress))
          extras.numberInner.style.left = `${posPx}px`
        }
      }
      if (extras && extras.progressReadout) {
        extras.progressReadout.textContent = String(pct)
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

  const rafUpdate = () => requestAnimationFrame(update)
  const bind = () => {
    if (window.lenis && typeof window.lenis.on === 'function') {
      const handler = () => rafUpdate()
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
    const handler = () => rafUpdate()
    window.addEventListener('scroll', handler, { passive: true })
    return () => {
      try {
        window.removeEventListener('scroll', handler)
      } catch (e) {
        // ignore
      }
    }
  }

  try {
    window.__processScrollListenerCleanup = bind()
  } catch (e) {
    // ignore
  }

  // Also listen to sticky position changes (smoother reaction when sticking/unsticking)
  ScrollTrigger.create({
    trigger: sticky,
    start: 'top top',
    end: () => 'bottom bottom',
    onUpdate: () => update(),
    pin: false,
  })

  update()
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

  const moveIndexInside = (proc) => {
    if (!proc) return
    const processIndex = proc.querySelector('.process_index')
    const inner = proc.querySelector('.process_inner')
    const processInfos = proc.querySelector('.process-infos')
    if (!processIndex || !inner) return
    if (processIndex.parentElement === inner) return

    const desc = inner.querySelector('.process-desc')

    if (!processIndexOrigins.has(processIndex)) {
      processIndexOrigins.set(processIndex, {
        parent: processIndex.parentElement,
        nextSibling: processIndex.nextElementSibling,
        innerStyles: {
          display: inner.style.display,
          gridTemplateColumns: inner.style.gridTemplateColumns,
          columnGap: inner.style.columnGap,
          marginLeft: inner.style.marginLeft,
          marginRight: inner.style.marginRight,
        },
        processIndexStyles: {
          gridColumn: processIndex.style.gridColumn,
          paddingTop: processIndex.style.paddingTop,
        },
        processInfosStyles: processInfos
          ? {
              node: processInfos,
              width: processInfos.style.width,
            }
          : null,
        descStyles: desc
          ? {
              node: desc,
              gridColumn: desc.style.gridColumn,
              display: desc.style.display,
            }
          : null,
      })
    }

    if (processInfos) {
      processInfos.style.width = '100%'
    }

    inner.prepend(processIndex)
    inner.style.display = 'grid'
    inner.style.gridTemplateColumns = 'repeat(4, 1fr)'
    inner.style.columnGap = '1em'
    inner.style.marginLeft = '0'
    inner.style.marginRight = '0'
    processIndex.style.gridColumn = '1 / 2'
    processIndex.style.paddingTop = '0'

    if (desc) {
      desc.style.gridColumn = '2 / 5'
      desc.style.display = 'block'
    }
  }

  const restoreIndex = (proc) => {
    if (!proc) return
    const processIndex = proc.querySelector('.process_index')
    const inner = proc.querySelector('.process_inner')
    if (!processIndex || !inner) return

    const origin = processIndexOrigins.get(processIndex)
    if (!origin) return

    const {
      parent,
      nextSibling,
      innerStyles,
      processIndexStyles,
      processInfosStyles,
      descStyles,
    } = origin

    if (parent) {
      if (nextSibling && parent.contains(nextSibling)) {
        parent.insertBefore(processIndex, nextSibling)
      } else {
        parent.appendChild(processIndex)
      }
    }

    restoreInlineStyles(inner, innerStyles)
    restoreInlineStyles(processIndex, processIndexStyles)
    if (processInfosStyles && processInfosStyles.node) {
      restoreInlineStyles(processInfosStyles.node, {
        width: processInfosStyles.width,
      })
    }

    if (descStyles && descStyles.node) {
      descStyles.node.style.gridColumn = descStyles.gridColumn ?? ''
      descStyles.node.style.display = descStyles.display ?? ''
    }

    processIndexOrigins.delete(processIndex)
  }

  const applyMobile = () => processes.forEach(moveIndexInside)
  const revertDesktop = () => processes.forEach(restoreIndex)

  let currentMobile = null
  const evaluate = () => {
    const shouldBeMobile = isProcessMobile()
    if (shouldBeMobile === currentMobile) return
    currentMobile = shouldBeMobile
    if (shouldBeMobile) {
      applyMobile()
    } else {
      revertDesktop()
    }
    notifyTextRevealReflow()
  }

  evaluate()
  window.addEventListener('resize', evaluate)

  return () => {
    window.removeEventListener('resize', evaluate)
    revertDesktop()
  }
}
