import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import SplitType from 'split-type'

import {
  getProcessLineRevealOpacity,
  shouldUseProcessLineReveal,
} from './process-line-reveal.js'

gsap.registerPlugin(ScrollTrigger)

let __textRevealResizeAttached = false
let __textRevealResizeTimeout = null

function registerTextRevealCleanup(root) {
  try {
    window.__textRevealCleanupRoot = root
    window.__textRevealCleanup = () => destroyTextReveal(root)
  } catch (e) {
    // ignore
  }
}

function attachTextRevealResizeHandler() {
  if (typeof window === 'undefined') return
  if (__textRevealResizeAttached) return
  const handler = () => {
    if (__textRevealResizeTimeout) clearTimeout(__textRevealResizeTimeout)
    __textRevealResizeTimeout = setTimeout(() => {
      try {
        destroyTextReveal(document)
      } catch (e) {
        // ignore
      }
      try {
        initTextReveal(document)
      } catch (e) {
        // ignore
      }
    }, 200)
  }
  try {
    window.addEventListener('resize', handler)
    window.addEventListener('orientationchange', handler)
    // expose for potential cleanup elsewhere
    window.__textRevealOnResize = handler
  } catch (e) {
    // ignore
  }
  __textRevealResizeAttached = true
}

function createLetterRevealTimeline(element) {
  const split = new SplitType(element, {
    types: 'lines,words,chars',
    tagName: 'span',
  })
  const characters = split.chars || []
  const words = split.words || []
  const lines = split.lines || []

  if (!characters.length) return null

  // Keep words intact on a single line to avoid mid-word wraps
  gsap.set(words, {
    display: 'inline-block',
    whiteSpace: 'nowrap',
  })

  gsap.set(characters, {
    opacity: 0.2,
    display: 'inline-block',
    willChange: 'opacity',
  })

  const scroller = window.__lenisWrapper || undefined
  // Create one ScrollTrigger per visual line so each line animates from 85% → 50%
  const tweens = []
  lines.forEach((line) => {
    try {
      const lineChars = characters.filter((ch) => line.contains(ch))
      if (!lineChars.length) return
      const tween = gsap.to(lineChars, {
        opacity: 1,
        stagger: { each: 0.02, from: 'start' },
        ease: 'none',
        scrollTrigger: {
          trigger: line,
          start: 'top 85%',
          end: 'top 50%',
          scrub: true,
          scroller,
        },
      })
      tweens.push(tween)
    } catch (e) {
      // ignore
    }
  })

  element.__textRevealSplit = split
  element.__textRevealLineTweens = tweens

  // Return the array for possible external bookkeeping, though caller doesn't require it
  return tweens
}

function parseRgbColor(value) {
  try {
    const match = String(value || '').match(
      /rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i
    )
    if (match) return [match[1], match[2], match[3]]
  } catch (e) {
    // ignore
  }
  return ['0', '0', '0']
}

function createMobileProcessLineReveal(process) {
  const textNodes = Array.from(
    process.querySelectorAll('.process-infos h3, .process-desc p')
  )
  const splits = textNodes.map(
    (element) =>
      new SplitType(element, {
        types: 'lines',
        tagName: 'span',
      })
  )
  const lines = splits.flatMap((split) => split.lines || [])
  const eyebrows = Array.from(
    process.querySelectorAll(
      '.process_index .eyebrow-m, .process_index .eyebrow-s'
    )
  )
  const inner = process.querySelector('.process_inner')
  const colorAnchor = textNodes[0] || eyebrows[0] || process
  const rgb = parseRgbColor(getComputedStyle(colorAnchor).color)

  gsap.set(lines, {
    opacity: 0.2,
    display: 'block',
    willChange: 'opacity',
  })
  gsap.set(eyebrows, { opacity: 0.2, willChange: 'opacity' })

  const applyProgress = (progress) => {
    const count = Math.max(1, lines.length)
    lines.forEach((line, index) => {
      line.style.opacity = String(
        getProcessLineRevealOpacity(progress, index, count)
      )
    })
    const groupOpacity = getProcessLineRevealOpacity(progress)
    eyebrows.forEach((eyebrow) => {
      eyebrow.style.opacity = String(groupOpacity)
    })
    if (inner) {
      const rgba = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${groupOpacity})`
      inner.style.borderBottomColor = rgba
      inner.style.borderBottom = `1px solid ${rgba}`
    }
  }

  const scrollTrigger = ScrollTrigger.create({
    trigger: process,
    start: 'top 90%',
    end: 'bottom 10%',
    scrub: true,
    scroller: window.__lenisWrapper || undefined,
    onUpdate: (self) => applyProgress(self.progress),
    onLeave: () => applyProgress(1),
    onLeaveBack: () => applyProgress(0),
  })

  process.__processMobileLineST = scrollTrigger
  process.__processMobileLineSplits = splits
  applyProgress(scrollTrigger.progress || 0)
  return scrollTrigger
}

export function initTextReveal(root = document) {
  const useMobileProcessLines = shouldUseProcessLineReveal(
    window.innerWidth || document.documentElement.clientWidth || 0
  )

  // Ensure process section texts also get the same opacity animation as .intro
  try {
    const scope = root && root.querySelectorAll ? root : document
    // Only mark titles and descriptions; eyebrows are handled by custom process logic
    const PROCESS_TEXT_SELECTOR = [
      '.section_process .process-infos h3',
      '.section_process .process-desc p',
    ].join(', ')
    const processTextNodes = scope.querySelectorAll(PROCESS_TEXT_SELECTOR)
    processTextNodes.forEach((el) => {
      try {
        if (useMobileProcessLines) {
          el.removeAttribute('tr')
        } else if (!el.hasAttribute('tr')) {
          el.setAttribute('tr', '1')
        }
      } catch (e) {
        // ignore
      }
    })
    // If any eyebrows were previously tagged for text-reveal, clean them up and remove the attribute
    try {
      const EYEBROW_SELECTOR =
        '.section_process .process-infos .process_index .eyebrow-m, .section_process .process-infos .process_index .eyebrow-s'
      const bad = scope.querySelectorAll(EYEBROW_SELECTOR)
      bad.forEach((el) => {
        try {
          if (el.hasAttribute('tr')) el.removeAttribute('tr')
        } catch (e1) {
          // ignore
        }
        try {
          const arr = el.__textRevealLineTweens
          if (arr && Array.isArray(arr)) {
            arr.forEach((tw) => {
              try {
                if (tw && tw.scrollTrigger) tw.scrollTrigger.kill()
                if (tw && typeof tw.kill === 'function') tw.kill()
              } catch (e2) {
                // ignore
              }
            })
            el.__textRevealLineTweens = null
          }
        } catch (e3) {
          // ignore
        }
        try {
          const split = el.__textRevealSplit
          if (split && typeof split.revert === 'function') {
            split.revert()
            el.__textRevealSplit = null
          }
        } catch (e4) {
          // ignore
        }
      })
    } catch (e) {
      // ignore
    }
  } catch (e) {
    // ignore
  }

  const targets = root.querySelectorAll('[tr="1"]')
  if (!targets.length && !useMobileProcessLines) return null

  // Ensure the resize/orientationchange re-init is attached once
  attachTextRevealResizeHandler()
  registerTextRevealCleanup(root)

  const timelines = []
  targets.forEach((el) => {
    if (useMobileProcessLines && el.closest('.section_process')) return
    const tl = createLetterRevealTimeline(el)
    if (tl) timelines.push(tl)
  })

  if (useMobileProcessLines) {
    const processes = Array.from(
      root.querySelectorAll('.section_process .process')
    )
    processes.forEach((process) => {
      try {
        timelines.push(createMobileProcessLineReveal(process))
      } catch (e) {
        // keep other process reveals functional
      }
    })
    ScrollTrigger.refresh()
    return timelines
  }

  // Fallback fade-in for process texts if letter splitting didn't attach (0.2 -> 1 like intro)
  try {
    const scope = root && root.querySelectorAll ? root : document
    const PROCESS_TEXT_SELECTOR = [
      '.section_process .process-infos h3',
      '.section_process .process-desc p',
    ].join(', ')
    const nodes = Array.from(scope.querySelectorAll(PROCESS_TEXT_SELECTOR))
    const scroller = window.__lenisWrapper || undefined
    nodes.forEach((el) => {
      try {
        const arr = el.__textRevealLineTweens
        if (arr && Array.isArray(arr)) {
          // Letter-based reveal is active; no fallback needed
          return
        }
        gsap.set(el, { opacity: 0.2 })
        const st = ScrollTrigger.create({
          trigger: el,
          start: 'top 85%',
          end: 'top 50%',
          scrub: true,
          scroller,
          onUpdate(self) {
            const p = self.progress
            el.style.opacity = String(0.2 + 0.8 * p)
          },
        })
        el.__processInFadeST = st
      } catch (e) {
        // ignore
      }
    })
  } catch (e) {
    // ignore
  }

  // Add reverse fade (1 -> 0.2) only when elements pass 12em from top going upward (after intro)
  try {
    const scope = root && root.querySelectorAll ? root : document
    const scroller = window.__lenisWrapper || undefined
    const PROCESS_TEXT_SELECTOR = [
      '.section_process .process-infos h3',
      '.section_process .process-desc p',
    ].join(', ')
    const fadeOutNodes = scope.querySelectorAll(PROCESS_TEXT_SELECTOR)
    fadeOutNodes.forEach((node) => {
      try {
        // Ensure starting opacity = 1
        gsap.set(node, { opacity: 1 })
        const st = ScrollTrigger.create({
          trigger: node,
          start: 'top 12em',
          end: 'top -12em',
          scroller,
          onUpdate(self) {
            // Map smoothly both ways (scrub) so 0.2 -> 1 and 1 -> 0.2 are symmetric
            const p = self.progress
            const opacity = 1 - 0.8 * p // 1 -> 0.2 across the range
            node.style.opacity = String(opacity)
          },
          onLeave() {
            // Fully faded when far above
            node.style.opacity = '0.2'
          },
          // No explicit onEnter/onEnterBack: let onUpdate handle smooth ramp
        })
        try {
          node.__processFadeST = st
        } catch (e2) {
          // ignore
        }
      } catch (e) {
        // ignore
      }
    })
  } catch (e) {
    // ignore
  }

  // Color and border behaviors for processes: on viewport entry, switch to white; at 12em top upward, animate eyebrow and border
  try {
    const scope = root && root.querySelectorAll ? root : document
    const scroller = window.__lenisWrapper || undefined
    const processes = Array.from(
      scope.querySelectorAll('.section_process .process')
    )
    processes.forEach((proc) => {
      try {
        const inner = proc.querySelector('.process_inner')
        const EYEBROW_SELECTOR =
          '.process_index .eyebrow-m, .process_index .eyebrow-s'
        const eyebrowNodes = Array.from(proc.querySelectorAll(EYEBROW_SELECTOR))

        // Smooth transitions for color/border
        eyebrowNodes.forEach((ey) => {
          try {
            ey.style.transition =
              'color 0.5s ease, background-color 0.5s ease, border-color 0.5s ease, opacity 0.3s ease'
          } catch (e) {
            // ignore
          }
        })
        if (inner && !inner.__processBorderTransitionSet) {
          try {
            inner.style.transition =
              'border-bottom-color 0.5s ease, border-bottom 0.5s ease'
            inner.__processBorderTransitionSet = true
          } catch (e) {
            // ignore
          }
        }

        // Determine border color from the nearest live text color on each frame, then animate only its alpha
        const colorAnchor =
          proc.querySelector('.process-desc p') ||
          proc.querySelector('.process-infos h3') ||
          eyebrowNodes[0] ||
          proc
        const parseRGB = (val) => {
          try {
            if (!val) return [0, 0, 0]
            const m = String(val).match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
            if (m)
              return [
                parseInt(m[1], 10),
                parseInt(m[2], 10),
                parseInt(m[3], 10),
              ]
          } catch (e) {
            // ignore
          }
          return [0, 0, 0]
        }
        const setBorderAlpha = (alpha = 1) => {
          if (!inner) return
          try {
            const a = Math.max(0, Math.min(1, alpha))
            let rgb = [0, 0, 0]
            try {
              const cs = getComputedStyle(colorAnchor)
              rgb = parseRGB(cs && cs.color)
            } catch (e1) {
              // ignore
            }
            const rgba = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`
            inner.style.borderBottomColor = rgba
            inner.style.borderBottom = `1px solid ${rgba}`
          } catch (e) {
            // ignore
          }
        }
        // Initialize to the same opacity as texts at rest
        setBorderAlpha(0.2)

        // On viewport entry: no direct changes (fade-in handled by dedicated triggers)
        const stEnter = ScrollTrigger.create({
          trigger: proc,
          start: 'top 100%',
          end: 'bottom 0%',
          scroller,
          onEnter() {},
          onEnterBack() {},
          onLeave() {},
          onLeaveBack() {},
        })

        // Eyebrows: fade in like other process texts when entering viewport (0.2 -> 1)
        const EY_IN_TRIGGERS = []
        eyebrowNodes.forEach((ey) => {
          try {
            gsap.set(ey, { opacity: 0.2 })
            const stIn = ScrollTrigger.create({
              trigger: ey,
              start: 'top 85%',
              end: 'top 50%',
              scroller,
              scrub: true,
              onUpdate(self) {
                const p = self.progress
                const op = 0.2 + 0.8 * p
                ey.style.opacity = String(op)
              },
            })
            EY_IN_TRIGGERS.push(stIn)
          } catch (e) {
            // ignore
          }
        })

        // Border: fade in (0.2 -> 1) in sync with nearest text element on entry
        const borderAnchor = colorAnchor || inner || proc
        const stBorderIn = ScrollTrigger.create({
          trigger: borderAnchor,
          // Start a bit later than texts to avoid leading the fade-in
          start: 'top 90%',
          end: 'top 55%',
          scroller,
          scrub: true,
          onUpdate(self) {
            const p = self.progress
            setBorderAlpha(0.2 + 0.8 * p)
          },
        })

        // At 12em from top while moving upward, animate eyebrow opacity and border alpha (1 -> 0.2)
        const stTop = ScrollTrigger.create({
          trigger: proc,
          // Delay border fade-out slightly compared to texts to prevent leading
          start: 'top 12.75em',
          end: 'top -12.75em',
          scroller,
          onUpdate(self) {
            if (!inner) return
            const p = self.progress
            const alpha = 1 - 0.8 * p
            eyebrowNodes.forEach((ey) => (ey.style.opacity = String(alpha)))
            // Border alpha follows the same alpha as texts
            setBorderAlpha(alpha)
          },
          onLeave() {
            eyebrowNodes.forEach((ey) => (ey.style.opacity = '0.2'))
            setBorderAlpha(0.2)
          },
          // No explicit onEnter/onEnterBack: onUpdate provides smooth ramp both ways
        })

        try {
          proc.__processEnterST = stEnter
          proc.__processTopST = stTop
          proc.__processEyInST = EY_IN_TRIGGERS
          proc.__processBorderInST = stBorderIn
        } catch (e) {
          // ignore
        }
      } catch (e) {
        // ignore
      }
    })
  } catch (e) {
    // ignore
  }

  // Ensure ScrollTrigger recalculates after DOM mutations from SplitType
  ScrollTrigger.refresh()

  return timelines
}

export function destroyTextReveal(root = document) {
  if (__textRevealResizeTimeout) {
    clearTimeout(__textRevealResizeTimeout)
    __textRevealResizeTimeout = null
  }
  const targets = root.querySelectorAll('[tr="1"]')
  targets.forEach((el) => {
    try {
      if (el.__textRevealTimeline) {
        if (el.__textRevealTimeline.scrollTrigger) {
          el.__textRevealTimeline.scrollTrigger.kill()
        }
        el.__textRevealTimeline.kill()
        el.__textRevealTimeline = null
      }
    } catch (err) {
      // ignore
    }
    try {
      if (
        el.__textRevealLineTweens &&
        Array.isArray(el.__textRevealLineTweens)
      ) {
        el.__textRevealLineTweens.forEach((tw) => {
          try {
            if (tw && tw.scrollTrigger) tw.scrollTrigger.kill()
            if (tw && typeof tw.kill === 'function') tw.kill()
          } catch (e) {
            // ignore
          }
        })
        el.__textRevealLineTweens = null
      }
    } catch (e) {
      // ignore
    }
    try {
      if (
        el.__textRevealSplit &&
        typeof el.__textRevealSplit.revert === 'function'
      ) {
        el.__textRevealSplit.revert()
        el.__textRevealSplit = null
      }
    } catch (err) {
      // ignore
    }
  })
  try {
    const scope = root && root.querySelectorAll ? root : document
    const processes = Array.from(
      scope.querySelectorAll('.section_process .process')
    )
    processes.forEach((proc) => {
      try {
        if (proc.__processMobileLineST) {
          proc.__processMobileLineST.kill()
          proc.__processMobileLineST = null
        }
        if (
          proc.__processMobileLineSplits &&
          Array.isArray(proc.__processMobileLineSplits)
        ) {
          proc.__processMobileLineSplits.forEach((split) => {
            if (split && typeof split.revert === 'function') split.revert()
          })
          proc.__processMobileLineSplits = null
        }
      } catch (e) {
        // ignore
      }
      try {
        if (proc.__processEnterST) {
          proc.__processEnterST.kill()
          proc.__processEnterST = null
        }
      } catch (e) {
        // ignore
      }
      try {
        if (proc.__processTopST) {
          proc.__processTopST.kill()
          proc.__processTopST = null
        }
      } catch (e) {
        // ignore
      }
      try {
        if (proc.__processBorderInST) {
          proc.__processBorderInST.kill()
          proc.__processBorderInST = null
        }
      } catch (e) {
        // ignore
      }
      try {
        if (proc.__processEyInST && Array.isArray(proc.__processEyInST)) {
          proc.__processEyInST.forEach((st) => {
            try {
              if (st && typeof st.kill === 'function') st.kill()
            } catch (e2) {
              // ignore
            }
          })
          proc.__processEyInST = null
        }
      } catch (e) {
        // ignore
      }
      try {
        const EYEBROW_SELECTOR =
          '.process_index .eyebrow-m, .process_index .eyebrow-s'
        const eyebrowNodes = proc.querySelectorAll(EYEBROW_SELECTOR)
        eyebrowNodes.forEach((ey) => {
          ey.style.opacity = ''
          ey.style.willChange = ''
        })
        const inner = proc.querySelector('.process_inner')
        if (inner) {
          inner.style.borderBottomColor = ''
          inner.style.borderBottom = ''
        }
      } catch (e) {
        // ignore
      }
    })
  } catch (e) {
    // ignore
  }
  try {
    // Cleanup fallback process text fades
    const scope = root && root.querySelectorAll ? root : document
    const PROCESS_TEXT_SELECTOR = [
      '.section_process .process-infos h3',
      '.section_process .process-desc p',
    ].join(', ')
    const nodes = Array.from(scope.querySelectorAll(PROCESS_TEXT_SELECTOR))
    nodes.forEach((el) => {
      try {
        const st = el.__processInFadeST
        if (st && typeof st.kill === 'function') st.kill()
        el.__processInFadeST = null
        const fadeST = el.__processFadeST
        if (fadeST && typeof fadeST.kill === 'function') fadeST.kill()
        el.__processFadeST = null
      } catch (e) {
        // ignore
      }
    })
  } catch (e) {
    // ignore
  }
  try {
    if (window.__textRevealCleanupRoot === root) {
      window.__textRevealCleanup = null
      window.__textRevealCleanupRoot = null
    }
  } catch (e) {
    // ignore
  }
  ScrollTrigger.refresh()
}

// No auto-init here; main.js controls timing after Lenis setup
