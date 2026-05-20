import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { animateNavbarSpreadForGrid } from './nav'
import { initParallax, initNextBackgroundParallax } from './parallax.js'
import { initWorkshopsStickyImages } from './workshops'

gsap.registerPlugin(ScrollTrigger, CustomEase)
// Smooth, slightly springy step ease
if (!gsap.parseEase('machinesStep')) {
  CustomEase.create('machinesStep', 'M0,0 C0.6,0 0,1 1,1')
}

function getLogoIdentityKey(el) {
  try {
    if (!el) return ''
    const tagName = (el.tagName || '').toLowerCase()
    if (tagName === 'img') {
      const src = el.getAttribute('src') || ''
      if (src) return `img:${src.split('?')[0]}`
    }

    if (tagName === 'svg') {
      const viewBox = el.getAttribute('viewBox') || el.getAttribute('viewbox')
      const shapeNodes = Array.from(
        el.querySelectorAll(
          'path, line, rect, circle, ellipse, polygon, polyline'
        )
      )
      const shapeSignature = shapeNodes
        .map((node) => {
          const attrs = Array.from(node.attributes || [])
            .filter(
              (attr) => attr && attr.name !== 'class' && attr.name !== 'id'
            )
            .map((attr) => `${attr.name}:${attr.value}`)
            .sort()
            .join(';')
          return `${(node.tagName || '').toLowerCase()}[${attrs}]`
        })
        .join('|')
      if (viewBox && shapeSignature) return `svg:${viewBox}:${shapeSignature}`
    }

    return (
      el.getAttribute('aria-label') ||
      el.getAttribute('data-name') ||
      el.getAttribute('alt') ||
      el.textContent ||
      el.outerHTML ||
      ''
    )
  } catch (e) {
    return (el && el.outerHTML) || ''
  }
}

export function computeLogoSlotShowStartTimes({
  currentConfig,
  nextConfig,
  duration,
  delayBetweenSlots,
}) {
  const current = Array.isArray(currentConfig) ? currentConfig : []
  const next = Array.isArray(nextConfig) ? nextConfig : []
  const hideEnds = next.map((_, i) => i * delayBetweenSlots + duration)

  return next.map((nextIdx, i) => {
    let showStart = hideEnds[i]
    const adjacentSlots = [i - 1, i + 1]

    adjacentSlots.forEach((adjacentIndex) => {
      if (adjacentIndex < 0 || adjacentIndex >= next.length) return
      const adjacentChanges = current[adjacentIndex] !== next[adjacentIndex]
      if (adjacentChanges && current[adjacentIndex] === nextIdx) {
        showStart = Math.max(showStart, hideEnds[adjacentIndex])
      }
    })

    return showStart
  })
}

export function initTechnology(root = document) {
  // Support being called with the Barba container element itself
  try {
    const container = root && root.nodeType === 1 ? root : document
    const isSelfTechnology =
      container &&
      container.getAttribute &&
      container.getAttribute('data-barba-namespace') === 'technology'
    const page = isSelfTechnology
      ? container
      : container.querySelector('[data-barba-namespace="technology"]')
    if (!page) return
    // From here on, treat `root` as the page container for scoped queries
    root = page
  } catch (err) {
    // If anything goes wrong with detection, bail out to avoid double-binding
    return
  }

  const machinesGridWrapper = root.querySelector('.machines-grid-wrapper')
  if (!machinesGridWrapper) return

  const scroller =
    window.__lenisWrapper || root.querySelector('.page-wrap') || window
  let isScrollLocked = false

  // Tablet detection for responsive animation values
  const getViewportWidth = () => {
    try {
      if (typeof window === 'undefined') return 0
      if (typeof window.innerWidth === 'number') return window.innerWidth
      let docEl = null
      if (typeof document !== 'undefined') {
        if (document.documentElement) {
          docEl = document.documentElement
        }
      }
      if (docEl && typeof docEl.clientWidth === 'number') {
        return docEl.clientWidth
      }
      return 0
    } catch (err) {
      return 0
    }
  }
  const isTablet = () => {
    const w = getViewportWidth()
    return w >= 768 && w <= 991
  }

  // Workshops images pin (2em from top)
  try {
    initWorkshopsStickyImages(root)
  } catch (err) {
    // ignore
  }

  // Logos slider control
  try {
    const control = root.querySelector('.logos-slider_control')
    const inner =
      root.querySelector('.logos-slider_inner') ||
      root.querySelector('.logos-slider')
    const buttons = control ? control.querySelectorAll('button.body-m') : []
    const prevBtn = buttons && buttons.length ? buttons[0] : null
    const nextBtn = buttons && buttons.length > 1 ? buttons[1] : null

    if (inner && !inner.__logosSliderInitialized) {
      inner.__logosSliderInitialized = true
      try {
        inner.style.willChange = 'transform'
      } catch (e) {
        // ignore
      }
      // Prépare les slots (6 cases max) et la liste complète des logos
      const logoWraps = Array.from(
        root.querySelectorAll('.logos-slider_logo-wrap')
      )
      const slots = logoWraps.slice(0, 6)
      const allLogos = Array.from(root.querySelectorAll('.logos-slider_logo'))
      const seenKeys = new Set()
      const logoTemplates = []
      allLogos.forEach((el) => {
        const key = getLogoIdentityKey(el)
        if (seenKeys.has(key)) {
          try {
            el.parentNode && el.parentNode.removeChild(el)
          } catch (e) {
            // ignore
          }
          return
        }
        seenKeys.add(key)
        logoTemplates.push({ key, html: el.outerHTML })
        try {
          el.parentNode && el.parentNode.removeChild(el)
        } catch (e) {
          // ignore
        }
      })
      const totalLogos = logoTemplates.length
      if (!slots.length || totalLogos < slots.length) {
        return
      }
      let currentConfig = [] // indices de logos affichés par slot
      const slotElements = slots.map(() => null) // DOM node actuellement affiché par slot
      let logosTl = null
      let cycleTimeoutId = null
      const ensureEase = () => {
        try {
          if (!gsap.parseEase('wsEase'))
            CustomEase.create('wsEase', 'M0,0 C0.6,0 0,1 1,1')
        } catch (e) {
          // ignore
        }
      }
      const getRandomConfig = (prevConfig) => {
        const slotCount = slots.length
        if (!slotCount || totalLogos === 0) return []
        const prev =
          Array.isArray(prevConfig) && prevConfig.length === slotCount
            ? prevConfig.slice()
            : []
        const indices = Array.from({ length: totalLogos }, (_, i) => i)
        const hasAdjacentDuplicate = (config) => {
          for (let i = 1; i < config.length; i++) {
            const prev = logoTemplates[config[i - 1]]
            const current = logoTemplates[config[i]]
            if (prev && current && prev.key === current.key) return true
          }
          return false
        }
        const maxAttempts = 20
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const shuffled = indices.slice()
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            const tmp = shuffled[i]
            shuffled[i] = shuffled[j]
            shuffled[j] = tmp
          }
          const candidate = shuffled.slice(0, slotCount)
          if (!prev.length) return candidate
          let hasSame = false
          for (let i = 0; i < slotCount; i++) {
            if (candidate[i] === prev[i]) {
              hasSame = true
              break
            }
          }
          // On accepte seulement si aucun logo n'est resté dans le même slot
          if (!hasSame && !hasAdjacentDuplicate(candidate)) return candidate
        }
        if (!prev.length) {
          return Array.from({ length: slots.length }, (_, i) => i % totalLogos)
        }
        // Fallback déterministe : même logos mais décalés d'un slot pour garantir le mouvement
        return prev.map((idx, i) => {
          const shifted = prev[(i + 1) % prev.length]
          const baseIndex = typeof shifted === 'number' ? shifted : 0
          return baseIndex % totalLogos
        })
      }
      const createLogoElement = (idx) => {
        try {
          const template = logoTemplates[idx] ? logoTemplates[idx].html : ''
          const wrapper = document.createElement('div')
          wrapper.innerHTML = template
          const logo = wrapper.firstElementChild
          if (logo) logo.dataset.logoTemplateIndex = String(idx)
          return logo
        } catch (e) {
          return null
        }
      }
      const clearCycleTimeout = () => {
        if (cycleTimeoutId) {
          clearTimeout(cycleTimeoutId)
          cycleTimeoutId = null
        }
      }
      const getVisibleLogos = (slot) => {
        try {
          return Array.from(slot.querySelectorAll('.logos-slider_logo')).filter(
            (el) => {
              const styles = window.getComputedStyle(el)
              const opacity = parseFloat(styles.opacity || '1')
              return styles.display !== 'none' && opacity > 0.01
            }
          )
        } catch (e) {
          return []
        }
      }
      const pruneSlotLogos = (slot, keep) => {
        try {
          Array.from(slot.querySelectorAll('.logos-slider_logo')).forEach(
            (el) => {
              if (el !== keep && el.parentNode) el.parentNode.removeChild(el)
            }
          )
        } catch (e) {
          // ignore
        }
      }
      const normalizeSlotElements = () => {
        slots.forEach((slot, i) => {
          try {
            const visibleLogos = getVisibleLogos(slot)
            let keep = null
            if (visibleLogos.length > 0) {
              keep = visibleLogos[visibleLogos.length - 1]
            } else if (slotElements[i] && slot.contains(slotElements[i])) {
              keep = slotElements[i]
            }
            if (keep) {
              gsap.set(keep, { opacity: 1, display: 'block' })
              const keepIndex = Number(keep.dataset.logoTemplateIndex)
              if (Number.isInteger(keepIndex)) currentConfig[i] = keepIndex
            }
            pruneSlotLogos(slot, keep)
            slotElements[i] = keep
          } catch (e) {
            // ignore
          }
        })
      }
      const scheduleNextCycle = () => {
        clearCycleTimeout()
        try {
          cycleTimeoutId = setTimeout(() => {
            try {
              setPage()
            } catch (err) {
              // ignore
            }
          }, 3000)
        } catch (err) {
          // ignore
        }
      }
      const applyConfig = (nextConfig, animate) => {
        const slotCount = slots.length
        if (!slotCount || !Array.isArray(nextConfig) || !nextConfig.length) {
          return
        }
        ensureEase()
        const duration = 0.5
        const delayBetweenSlots = 1 // 1 seconde entre chaque slot
        try {
          // Cancel any in-flight sequence
          if (logosTl) {
            logosTl.kill()
            logosTl = null
          }
        } catch (e) {
          // ignore
        }
        normalizeSlotElements()
        const showStartTimes = computeLogoSlotShowStartTimes({
          currentConfig,
          nextConfig,
          duration,
          delayBetweenSlots,
        })
        // Préparer tous les logos pour cette config et construire la timeline cascade
        const slotAnimations = [] // { slotIndex, hide, show }
        for (let i = 0; i < slotCount; i++) {
          const slot = slots[i]
          const nextIdx = nextConfig[i]
          const nextLogo =
            typeof nextIdx === 'number' && nextIdx >= 0 && nextIdx < totalLogos
              ? createLogoElement(nextIdx)
              : null
          const prevLogo = slotElements[i] || null
          if (!slot || !nextLogo) continue
          try {
            slot.appendChild(nextLogo)
          } catch (e) {
            // ignore
          }
          slotElements[i] = nextLogo
          if (!animate || !prevLogo) {
            try {
              gsap.set(nextLogo, { opacity: 1, display: 'block' })
              pruneSlotLogos(slot, nextLogo)
            } catch (e) {
              // ignore
            }
            continue
          }
          // Préparer le prochain logo : présent dans le slot mais invisible
          try {
            gsap.set(nextLogo, { opacity: 0, display: 'none' })
          } catch (e) {
            // ignore
          }
          slotAnimations.push({
            slotIndex: i,
            hide: prevLogo,
            show: nextLogo,
          })
        }
        if (!animate) {
          currentConfig = nextConfig
          return
        }
        try {
          const tl = gsap.timeline()
          logosTl = tl
          tl.eventCallback('onComplete', () => {
            logosTl = null
          })
          if (slotAnimations.length === 0) {
            // Pas de slots à animer, rien à faire
            currentConfig = nextConfig
            return
          }
          if (!slotAnimations.length) {
            currentConfig = nextConfig
            scheduleNextCycle()
          } else {
            // Créer une animation cascade : chaque slot s'anime avec délai
            slotAnimations.forEach((anim, idx) => {
              const delay = idx * delayBetweenSlots
              const showStart =
                showStartTimes[anim.slotIndex] || delay + duration
              tl.to(anim.hide, { opacity: 0, duration }, delay)
              tl.add(() => {
                try {
                  anim.hide.style.display = 'none'
                } catch (e) {
                  // ignore
                }
              }, delay + duration)
              tl.add(() => {
                try {
                  anim.show.style.display = 'block'
                  gsap.set(anim.show, { opacity: 0 })
                } catch (e) {
                  // ignore
                }
              }, showStart)
              tl.to(anim.show, { opacity: 1, duration }, showStart)
            })
            tl.eventCallback('onComplete', () => {
              logosTl = null
              currentConfig = nextConfig
              slotAnimations.forEach((anim) => {
                try {
                  if (anim.hide && anim.hide.parentNode) {
                    anim.hide.parentNode.removeChild(anim.hide)
                  }
                  if (anim.show) {
                    gsap.set(anim.show, { opacity: 1, display: 'block' })
                    pruneSlotLogos(slots[anim.slotIndex], anim.show)
                    slotElements[anim.slotIndex] = anim.show
                  }
                } catch (e) {
                  // ignore
                }
              })
              scheduleNextCycle()
            })
          }
        } catch (e) {
          // ignore
        }
      }
      const setPage = () => {
        clearCycleTimeout()
        const nextConfig = getRandomConfig(currentConfig)
        applyConfig(nextConfig, true)
      }

      // Wire events
      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.preventDefault()
          setPage()
        })
      }
      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.preventDefault()
          setPage()
        })
      }
      // État initial des logos : tout cacher puis générer une première config
      try {
        allLogos.forEach((el) => {
          try {
            gsap.set(el, { opacity: 0, display: 'none' })
          } catch (e) {
            // ignore
          }
        })
        const initialConfig = getRandomConfig([])
        currentConfig = initialConfig
        applyConfig(initialConfig, false)
        scheduleNextCycle()
      } catch (e) {
        // ignore
      }
    }
  } catch (err) {
    // ignore
  }

  // Post-init safety: after the destination page is fully laid out, refresh ScrollTrigger once more
  try {
    requestAnimationFrame(() => {
      try {
        if (
          window.ScrollTrigger &&
          typeof window.ScrollTrigger.refresh === 'function'
        ) {
          window.ScrollTrigger.refresh()
        }
      } catch (e) {
        // ignore
      }
    })
  } catch (e) {
    // ignore
  }

  const lockScroll = () => {
    if (isScrollLocked) return
    try {
      if (window.lenis && typeof window.lenis.stop === 'function') {
        window.lenis.stop()
      }
    } catch (err) {
      // ignore
    }
    try {
      const targetEl =
        scroller && scroller !== window ? scroller : document.documentElement
      if (targetEl) {
        targetEl.style.overflow = 'hidden'
        targetEl.style.touchAction = 'none'
      }
      if (targetEl !== document.documentElement) {
        document.documentElement.style.overflow = 'hidden'
        document.body.style.overflow = 'hidden'
        document.body.style.touchAction = 'none'
      }
    } catch (err) {
      // ignore
    }
    isScrollLocked = true
  }
  const unlockScroll = () => {
    if (!isScrollLocked) return
    try {
      if (window.lenis && typeof window.lenis.start === 'function') {
        window.lenis.start()
      }
    } catch (err) {
      // ignore
    }
    try {
      const targetEl =
        scroller && scroller !== window ? scroller : document.documentElement
      if (targetEl) {
        targetEl.style.overflow = ''
        targetEl.style.touchAction = ''
      }
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    } catch (err) {
      // ignore
    }
    isScrollLocked = false
  }

  // ---------- Grid view: expand item fullscreen and push others ----------
  try {
    let gridList = null
    let gridItems = []
    let gridButtons = []
    if (machinesGridWrapper) {
      gridList = machinesGridWrapper.querySelector('.machines-grid_list')
      gridItems = Array.from(
        machinesGridWrapper.querySelectorAll('.machines-grid_item')
      )
      gridButtons = Array.from(
        machinesGridWrapper.querySelectorAll('.machines-grid_button')
      )
    }

    if (
      machinesGridWrapper &&
      gridList &&
      gridItems.length &&
      gridButtons.length
    ) {
      let openItem = null
      let openClone = null
      let resizeHandler = null
      // Keep a persistent description overlay and its mask while open
      let descOverlay = null
      let descMaskSvgEl = null
      let descMaskHoleEl = null
      let descMaskUpdate = null
      let syncOverlayDescRect = null
      let finalOverlayDescRect = null
      // Close on user interactions while open
      let removeInteractionHandlers = null
      // Track opening timeline to handle mid-open closes safely
      let openingTimeline = null

      const clearItemInlineStyles = (el) => {
        try {
          el.style.position = ''
          el.style.left = ''
          el.style.top = ''
          el.style.width = ''
          el.style.height = ''
          el.style.padding = ''
          el.style.zIndex = ''
          el.style.margin = ''
        } catch (e) {
          // ignore
        }
      }

      const pushOthersOut = (selected, tl) => {
        const selRect = selected.getBoundingClientRect()
        const cx = selRect.left + selRect.width / 2
        const cy = selRect.top + selRect.height / 2
        gridItems.forEach((item) => {
          if (item === selected) return
          const r = item.getBoundingClientRect()
          const ox = r.left + r.width / 2
          const oy = r.top + r.height / 2
          const dx = ox - cx
          const dy = oy - cy
          const sameRowThreshold = selRect.height * 0.6
          const sameRow = Math.abs(dy) <= sameRowThreshold
          let toVars = { x: 0, y: 0 }
          if (sameRow) {
            // Always push horizontally for items in the same row
            toVars.x =
              dx < 0
                ? -(r.left + r.width + 50)
                : window.innerWidth - r.left + 50
          } else {
            // Push vertically for items in other rows
            toVars.y =
              dy < 0
                ? -(r.top + r.height + 50)
                : window.innerHeight - r.top + 50
          }
          const anim = {
            x: toVars.x,
            y: toVars.y,
            duration: 1.2,
            ease: gsap.parseEase('machinesStep') || 'power2.inOut',
            overwrite: 'auto',
          }
          if (tl) tl.to(item, anim, 0)
          else gsap.to(item, anim)
        })
      }

      const resetOthers = (tl) => {
        gridItems.forEach((item) => {
          if (item === openItem) return
          const anim = {
            x: 0,
            y: 0,
            duration: 1.2,
            ease: gsap.parseEase('machinesStep') || 'power2.inOut',
            clearProps: 'transform',
            overwrite: 'auto',
          }
          if (tl) tl.to(item, anim, 0)
          else gsap.to(item, anim)
        })
      }

      // Split a paragraph into visual lines and return inner wrappers for animation
      const splitLines = (textEl) => {
        try {
          if (!textEl || textEl.__gridLines) return textEl && textEl.__gridLines
          const original = textEl.textContent || ''
          const words = original.split(' ')
          // Prime with word spans to measure natural wrapping
          textEl.textContent = ''
          const tempWordSpans = []
          words.forEach((w, idx) => {
            const span = document.createElement('span')
            span.textContent = w
            span.style.display = 'inline-block'
            textEl.appendChild(span)
            if (idx < words.length - 1)
              textEl.appendChild(document.createTextNode(' '))
            tempWordSpans.push(span)
          })
          // Group by offsetTop (tolerate 1-2px)
          const lines = []
          let currentTop = null
          let current = []
          tempWordSpans.forEach((span) => {
            const top = span.offsetTop
            if (currentTop == null || Math.abs(top - currentTop) < 2) {
              current.push(span.textContent || '')
              currentTop = top
            } else {
              lines.push(current)
              current = [span.textContent || '']
              currentTop = top
            }
          })
          if (current.length) lines.push(current)
          // Rebuild with line wrappers
          textEl.textContent = ''
          const innerList = []
          lines.forEach((lineWords) => {
            const wrap = document.createElement('span')
            wrap.style.display = 'block'
            wrap.style.overflow = 'hidden'
            const inner = document.createElement('span')
            inner.style.display = 'inline-block'
            // compose words back with spaces
            lineWords.forEach((w, idx) => {
              const ws = document.createElement('span')
              ws.textContent = w
              ws.style.display = 'inline'
              inner.appendChild(ws)
              if (idx < lineWords.length - 1)
                inner.appendChild(document.createTextNode(' '))
            })
            wrap.appendChild(inner)
            textEl.appendChild(wrap)
            innerList.push(inner)
          })
          textEl.__gridLines = innerList
          return innerList
        } catch (e) {
          return []
        }
      }

      // (removed maintainFullscreenSize; handled via resizeHandler)

      const openGridItem = (item) => {
        if (openItem === item) return
        openItem = item
        // Capture current scroll to prevent any auto-scroll on click/focus
        let savedTop = 0
        let savedLeft = 0
        let wrapper = null
        try {
          wrapper = window.__lenisWrapper || null
          if (wrapper) {
            savedTop = wrapper.scrollTop
            savedLeft = wrapper.scrollLeft || 0
          } else {
            savedTop =
              window.pageYOffset || document.documentElement.scrollTop || 0
            savedLeft =
              window.pageXOffset || document.documentElement.scrollLeft || 0
          }
        } catch (e) {
          // ignore
        }
        lockScroll()
        // Restore scroll immediately after locking to neutralize any jump
        try {
          if (wrapper) {
            wrapper.scrollTop = savedTop
            if (typeof wrapper.scrollLeft === 'number')
              wrapper.scrollLeft = savedLeft
          } else {
            window.scrollTo(savedLeft, savedTop)
          }
        } catch (e) {
          // ignore
        }
        const r = item.getBoundingClientRect()
        // Create a visual duplicate to animate, keep original in flow (opacity 0)
        try {
          openClone = item.cloneNode(true)
          // Remove the name wrap from the clone; keep it only in the original
          try {
            const clonedName = openClone.querySelector(
              '.machines-grid_name-wrap'
            )
            if (clonedName && clonedName.parentNode)
              clonedName.parentNode.removeChild(clonedName)
          } catch (e0) {
            // ignore
          }
          // Remove the inner name and close button from the clone; they'll be rendered via the overlay only
          try {
            const cloneNameInnerEl = openClone.querySelector(
              '.machines-grid_name-inner'
            )
            if (cloneNameInnerEl && cloneNameInnerEl.parentNode)
              cloneNameInnerEl.parentNode.removeChild(cloneNameInnerEl)
          } catch (e0a) {
            // ignore
          }
          try {
            const cloneCloseBtnEl = openClone.querySelector(
              '.machines-grid_close-button'
            )
            if (cloneCloseBtnEl && cloneCloseBtnEl.parentNode)
              cloneCloseBtnEl.parentNode.removeChild(cloneCloseBtnEl)
          } catch (e0b) {
            // ignore
          }
          // Base rect is the image wrapper if present, else the item rect
          const imgWrap = item.querySelector('.machines-grid_img-wrap')
          const br = imgWrap ? imgWrap.getBoundingClientRect() : r
          openClone.classList.add('machines-grid_item-clone')
          // Prevent first-frame flash: hide until initial layout is applied
          try {
            openClone.style.visibility = 'hidden'
          } catch (evis) {
            /* ignore */
          }
          document.body.appendChild(openClone)
          gsap.set(openClone, {
            position: 'fixed',
            left: br.left,
            top: br.top,
            width: br.width,
            height: br.height,
            padding: 0,
            margin: 0,
            zIndex: 6,
            overflow: 'hidden',
            pointerEvents: 'none',
          })
          // Hide the original image while opening so the clone visually takes over
          try {
            if (imgWrap) gsap.set(imgWrap, { opacity: 0 })
          } catch (eimg) {
            // ignore
          }
          // Keep original visible; the clone will cover it progressively
        } catch (e) {
          // Fallback: animate the original if cloning fails
          openClone = null
          gsap.set(item, {
            position: 'fixed',
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            padding: 0,
            margin: 0,
            zIndex: 5,
          })
        }
        const targetEl = openClone || item
        const tl = gsap.timeline({ defaults: { overwrite: 'auto' } })
        // Keep a reference to the opening animation timeline
        openingTimeline = tl
        tl.to(
          targetEl,
          {
            left: 0,
            top: 0,
            width: window.innerWidth,
            height: window.innerHeight,
            padding: '1em',
            duration: 1.2,
            ease: gsap.parseEase('machinesStep') || 'power2.out',
          },
          0
        )
        // Drop reference when the opening animation completes or is interrupted
        try {
          tl.eventCallback('onComplete', () => {
            openingTimeline = null
          })
          tl.eventCallback('onInterrupt', () => {
            openingTimeline = null
          })
        } catch (e) {
          // ignore
        }

        // Ensure only the clone's close button appears (display:flex immediately, then fade to 1)
        try {
          if (openClone) {
            const cloneCloseBtn = openClone.querySelector(
              '.machines-grid_close-button'
            )
            if (cloneCloseBtn) {
              tl.set(cloneCloseBtn, { display: 'flex', opacity: 0 }, 0)
              tl.to(
                cloneCloseBtn,
                {
                  opacity: 1,
                  duration: 1.2,
                  ease: gsap.parseEase('machinesStep') || 'power2.out',
                },
                0
              )
            }
          }
        } catch (eCloseBtn) {
          // ignore
        }

        // Move clone name inner into view (translateY(0)) and ensure only it is visible
        try {
          if (openClone) {
            const cloneNameInner = openClone.querySelector(
              '.machines-grid_name-inner'
            )
            if (cloneNameInner) {
              tl.set(cloneNameInner, { opacity: 1 }, 0)
              tl.to(
                cloneNameInner,
                {
                  y: 0,
                  duration: 1.2,
                  ease: gsap.parseEase('machinesStep') || 'power2.out',
                },
                0
              )
            }
          }
        } catch (eName) {
          // ignore
        }

        // Animate the clone's image from a fixed base (left:50%, top:50%, width:24em)
        try {
          if (openClone) {
            const clonedImg = openClone.querySelector('.machines-grid_img')
            if (clonedImg) {
              const startLeft = '50%'
              const startTop = '50%'
              const startWidth = '24em'
              // Persist for reverse
              clonedImg.dataset.gridStartLeft = startLeft
              clonedImg.dataset.gridStartTop = startTop
              clonedImg.dataset.gridStartWidth = startWidth
              // Place image absolutely inside clone at its current position
              gsap.set(clonedImg, {
                position: 'absolute',
                left: startLeft,
                top: startTop,
                width: startWidth,
                height: 'auto',
                margin: 0,
                zIndex: 2,
                pointerEvents: 'none',
                objectFit: 'contain',
              })
              const targetLeft = isTablet() ? '50%' : '80%'
              const targetTop = isTablet() ? '35%' : '70%'
              tl.to(
                clonedImg,
                {
                  left: targetLeft,
                  top: targetTop,
                  width: '60em',
                  duration: 1.2,
                  ease: gsap.parseEase('machinesStep') || 'power2.out',
                },
                0
              )
            }
          }
        } catch (eImgAnim) {
          // ignore
        }
        // Reveal the clone only after initial positions are set
        try {
          tl.set(openClone, { visibility: 'visible' }, 0)
        } catch (evis2) {
          /* ignore */
        }
        // Spread navbar horizontally like on scroll down
        try {
          animateNavbarSpreadForGrid(true, root)
        } catch (e) {
          // ignore
        }
        // Animate the clone description lines from y 100% to 0%
        try {
          if (openClone) {
            const cloneDesc = openClone.querySelector('.machines-grid_desc')
            if (cloneDesc) gsap.set(cloneDesc, { opacity: 1 })
            const cloneDescText = openClone.querySelector('.is-grid-desc')
            const lineInners = splitLines(cloneDescText)
            if (lineInners && lineInners.length) {
              gsap.set(lineInners, { yPercent: 100 })
              tl.to(
                lineInners,
                {
                  yPercent: 0,
                  duration: 1.2,
                  ease: gsap.parseEase('machinesStep') || 'power2.out',
                },
                0
              )
            }
          }
        } catch (eDesc) {
          // ignore
        }
        // Fade in infos overlay (fixed) masked to the clone bounds
        try {
          const origInfos = item.querySelector('.machines-grid_infos')
          if (origInfos) {
            const NS = 'http://www.w3.org/2000/svg'
            const svg = document.createElementNS(NS, 'svg')
            const defs = document.createElementNS(NS, 'defs')
            const mask = document.createElementNS(NS, 'mask')
            const bg = document.createElementNS(NS, 'rect')
            const hole = document.createElementNS(NS, 'rect')
            const vw = window.innerWidth
            const vh = window.innerHeight
            const maskId = `gridDescMask_${Date.now()}`
            svg.setAttribute('width', '0')
            svg.setAttribute('height', '0')
            svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`)
            svg.setAttribute('preserveAspectRatio', 'none')
            mask.setAttribute('id', maskId)
            mask.setAttribute('maskUnits', 'userSpaceOnUse')
            mask.setAttribute('maskContentUnits', 'userSpaceOnUse')
            mask.setAttribute('style', 'mask-type:luminance;')
            bg.setAttribute('x', '0')
            bg.setAttribute('y', '0')
            bg.setAttribute('width', String(vw))
            bg.setAttribute('height', String(vh))
            bg.setAttribute('fill', 'black')
            const br2 = openClone ? openClone.getBoundingClientRect() : r
            hole.setAttribute('x', String(br2.left))
            hole.setAttribute('y', String(br2.top))
            hole.setAttribute('width', String(br2.width))
            hole.setAttribute('height', String(br2.height))
            hole.setAttribute('fill', 'white')
            mask.appendChild(bg)
            mask.appendChild(hole)
            defs.appendChild(mask)
            svg.appendChild(defs)
            document.body.appendChild(svg)
            // Build a full-viewport overlay container and place infos inside at its fixed viewport coords
            const overlayContainer = document.createElement('div')
            overlayContainer.className = 'grid-desc-overlay'
            document.body.appendChild(overlayContainer)
            gsap.set(overlayContainer, {
              position: 'fixed',
              left: 0,
              top: 0,
              width: window.innerWidth,
              height: window.innerHeight,
              margin: 0,
              zIndex: 7,
              pointerEvents: 'auto',
              opacity: 0,
            })
            // Use webkitMask first for Safari/WebKit compatibility; fallback to standard mask
            overlayContainer.style.webkitMaskImage = `url(#${maskId})`
            overlayContainer.style.maskImage = `url(#${maskId})`
            const overlayInfos = origInfos.cloneNode(true)
            overlayContainer.appendChild(overlayInfos)
            // Measure final rect using a hidden full-screen clone to avoid visible movement on first open
            const applyOverlayInfosRect = (rect) => {
              if (!rect) return
              try {
                gsap.set(overlayInfos, {
                  position: 'absolute',
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  minHeight: rect.height,
                  height: 'auto',
                  margin: 0,
                  opacity: 1,
                  pointerEvents: 'none',
                  display: 'flex',
                })
                const overlayDescEl = overlayInfos.querySelector(
                  '.machines-grid_desc'
                )
                if (overlayDescEl) gsap.set(overlayDescEl, { opacity: 1 })
              } catch (e) {
                // ignore
              }
            }
            const measureFinalInfosRect = () => {
              try {
                const source = openClone || item
                const temp = source.cloneNode(true)
                document.body.appendChild(temp)
                gsap.set(temp, {
                  position: 'fixed',
                  left: 0,
                  top: 0,
                  width: window.innerWidth,
                  height: window.innerHeight,
                  padding: '1em',
                  visibility: 'hidden',
                  margin: 0,
                  zIndex: -1,
                })
                // Force layout to ensure correct measurements
                void temp.offsetWidth
                const tempInfos = temp.querySelector('.machines-grid_infos')
                if (tempInfos) {
                  gsap.set(tempInfos, {
                    display: 'flex',
                    opacity: 1,
                  })
                  const tempDesc = tempInfos.querySelector(
                    '.machines-grid_desc'
                  )
                  if (tempDesc) gsap.set(tempDesc, { opacity: 1 })
                }
                let rect = null
                if (tempInfos) {
                  const infosRect = tempInfos.getBoundingClientRect()
                  const measuredHeight = Math.max(
                    infosRect.height,
                    tempInfos.scrollHeight || 0
                  )
                  rect = {
                    left: infosRect.left,
                    top: infosRect.top,
                    width: infosRect.width,
                    height: measuredHeight,
                  }
                }
                temp.remove()
                return rect
              } catch (e) {
                return null
              }
            }
            const initialFinal = measureFinalInfosRect()
            if (!initialFinal || !initialFinal.width || !initialFinal.height) {
              requestAnimationFrame(() => {
                finalOverlayDescRect = measureFinalInfosRect()
                applyOverlayInfosRect(finalOverlayDescRect)
              })
            } else {
              finalOverlayDescRect = initialFinal
              applyOverlayInfosRect(finalOverlayDescRect)
            }
            // Keep overlay infos rect static during animation; only recompute on resize
            syncOverlayDescRect = () => {
              if (!overlayInfos) return
              if (!finalOverlayDescRect) return
              applyOverlayInfosRect(finalOverlayDescRect)
            }
            // Animate overlay description by lines from y 100% to 0%
            try {
              const overlayGridDesc =
                overlayInfos.querySelector('.is-grid-desc')
              const lineInnersOverlay = splitLines(overlayGridDesc)
              if (lineInnersOverlay && lineInnersOverlay.length) {
                gsap.set(lineInnersOverlay, { yPercent: 100 })
                tl.to(
                  lineInnersOverlay,
                  {
                    yPercent: 0,
                    duration: 1.2,
                    ease: gsap.parseEase('machinesStep') || 'power2.out',
                  },
                  0
                )
              }
            } catch (eDescOv) {
              // ignore
            }
            // Animate the name inner from overlay infos to avoid clipping by clone overflow
            try {
              if (openClone) {
                const overlayName = overlayInfos.querySelector(
                  '.machines-grid_name-inner'
                )
                if (overlayName) {
                  // Keep the title slightly higher in open state so the paragraph remains visible.
                  const overlayNameClosedY = '-10em'
                  const overlayNameOpenY = 0
                  gsap.set(overlayName, {
                    display: 'block',
                    opacity: 1,
                    y: overlayNameClosedY,
                  })
                  // Split words, then letters inside each word (no mid-word breaks), animate letters from yPercent:-100 to 0
                  try {
                    const textEl =
                      overlayName.querySelector('.body-xl') || overlayName
                    if (textEl && !textEl.__gridSplit) {
                      const original = textEl.textContent || ''
                      const frag = document.createDocumentFragment()
                      const words = original.split(' ')
                      words.forEach((word, wIdx) => {
                        const wordWrap = document.createElement('span')
                        wordWrap.style.display = 'inline-block'
                        wordWrap.style.whiteSpace = 'nowrap'
                        // build letters inside word
                        for (let i = 0; i < word.length; i++) {
                          const ch = word[i]
                          const letter = document.createElement('span')
                          letter.textContent = ch
                          letter.style.display = 'inline-block'
                          wordWrap.appendChild(letter)
                        }
                        frag.appendChild(wordWrap)
                        // re-add normal breaking space between words (except after last word)
                        if (wIdx < words.length - 1) {
                          frag.appendChild(document.createTextNode(' '))
                        }
                      })
                      textEl.textContent = ''
                      textEl.appendChild(frag)
                      textEl.__gridSplit = true
                    }
                    const lettersRoot =
                      overlayName.querySelector('.body-xl') || overlayName
                    const letters = Array.from(
                      lettersRoot.querySelectorAll('span > span')
                    )
                    if (letters.length) {
                      gsap.set(letters, { yPercent: -100 })
                      tl.to(
                        letters,
                        {
                          yPercent: 0,
                          duration: 1.2,
                          ease: gsap.parseEase('machinesStep') || 'power2.out',
                          stagger: 0.02,
                        },
                        0
                      )
                    }
                  } catch (esplit) {
                    // ignore
                  }
                  tl.to(
                    overlayName,
                    {
                      y: overlayNameOpenY,
                      duration: 1.2,
                      ease: gsap.parseEase('machinesStep') || 'power2.out',
                    },
                    0
                  )
                }
                // Move clone close button into the overlay as well
                const sourceCloseBtn = item.querySelector(
                  '.machines-grid_close-button'
                )
                if (sourceCloseBtn) {
                  const overlayClose = sourceCloseBtn.cloneNode(true)
                  overlayContainer.appendChild(overlayClose)
                  gsap.set(overlayClose, {
                    position: 'absolute',
                    left: 'auto',
                    right: '3em',
                    top: '3em',
                    margin: 0,
                    display: 'flex',
                    opacity: 0,
                    zIndex: 8,
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                  })
                  tl.to(
                    overlayClose,
                    {
                      opacity: 1,
                      duration: 1.2,
                      ease: gsap.parseEase('machinesStep') || 'power2.out',
                    },
                    0
                  )

                  // GSAP-driven hover interactions for the overlay close button
                  try {
                    const ensureLetters = (labelEl) => {
                      if (!labelEl) return []
                      if (labelEl.__split) return labelEl.__split
                      const text = labelEl.textContent || ''
                      const frag = document.createDocumentFragment()
                      const letters = []
                      for (let i = 0; i < text.length; i++) {
                        const ch = text[i]
                        const span = document.createElement('span')
                        span.textContent = ch === ' ' ? '\u00A0' : ch
                        span.style.display = 'inline-block'
                        frag.appendChild(span)
                        letters.push(span)
                      }
                      labelEl.textContent = ''
                      labelEl.appendChild(frag)
                      labelEl.__split = letters
                      return letters
                    }

                    const setupCloseHover = (btn) => {
                      if (!btn) return
                      const inner = btn.querySelector(
                        '.machines-grid_close-button_inner'
                      )
                      const row1Label =
                        btn.querySelector(
                          '.machines-grid_close-button_row:nth-of-type(1) .button_label'
                        ) ||
                        btn.querySelector(
                          '.machine-grid_close-button_row:nth-of-type(1) .button_label'
                        )
                      const row2Label =
                        btn.querySelector(
                          '.machines-grid_close-button_row:nth-of-type(2) .button_label'
                        ) ||
                        btn.querySelector(
                          '.machine-grid_close-button_row:nth-of-type(2) .button_label'
                        )
                      const plus =
                        btn.querySelector(
                          '.machines-grid_close-button_row:nth-of-type(2) .is-plus'
                        ) ||
                        btn.querySelector(
                          '.machine-grid_close-button_row:nth-of-type(2) .is-plus'
                        )

                      const letters1 = ensureLetters(row1Label)
                      const letters2 = ensureLetters(row2Label)

                      // Initial states
                      if (inner) gsap.set(inner, { yPercent: 0 })
                      if (plus)
                        gsap.set(plus, {
                          rotate: 0,
                          transformOrigin: '50% 50%',
                        })
                      if (letters1.length) gsap.set(letters1, { yPercent: 0 })
                      if (letters2.length) gsap.set(letters2, { yPercent: 100 })

                      const tlHover = gsap.timeline({
                        paused: true,
                        defaults: {
                          duration: 0.5,
                          ease: gsap.parseEase('machinesStep') || 'power2.out',
                        },
                      })
                      if (inner) tlHover.to(inner, { yPercent: -50 }, 0)
                      tlHover.to(btn, { backgroundColor: 'var(--accent)' }, 0)
                      if (plus) tlHover.to(plus, { rotate: 90 }, 0)
                      if (letters2.length)
                        tlHover.to(letters2, { yPercent: 0, stagger: 0.02 }, 0)
                      if (letters1.length)
                        tlHover.to(
                          letters1,
                          { yPercent: -100, stagger: 0.02 },
                          0
                        )

                      btn.__hoverTl = tlHover
                      btn.addEventListener('mouseenter', () => {
                        btn.__hoverTl && btn.__hoverTl.play()
                      })
                      btn.addEventListener('mouseleave', () => {
                        btn.__hoverTl && btn.__hoverTl.reverse()
                      })
                    }

                    setupCloseHover(overlayClose)
                  } catch (ehover) {
                    // ignore
                  }
                }
              }
            } catch (eov) {
              // ignore
            }
            // Store for later (stay visible after open)
            descOverlay = overlayContainer
            descMaskSvgEl = svg
            descMaskHoleEl = hole
            tl.to(
              overlayContainer,
              {
                opacity: 1,
                duration: 1.2,
                ease: gsap.parseEase('machinesStep') || 'power2.out',
              },
              0
            )
            // Also clip the clone's name and close button with the same mask
            try {
              if (openClone) {
                const nameInnerEl = openClone.querySelector(
                  '.machines-grid_name-inner'
                )
                const closeBtnEl = openClone.querySelector(
                  '.machines-grid_close-button'
                )
                const applyMask = (el) => {
                  if (!el) return
                  el.style.webkitMaskImage = `url(#${maskId})`
                  el.style.maskImage = `url(#${maskId})`
                  el.style.webkitMaskRepeat = 'no-repeat'
                  el.style.maskRepeat = 'no-repeat'
                  el.style.webkitMaskSize = '100% 100%'
                  el.style.maskSize = '100% 100%'
                  el.style.webkitMaskPosition = '0 0'
                  el.style.maskPosition = '0 0'
                }
                applyMask(nameInnerEl)
                applyMask(closeBtnEl)
              }
            } catch (em) {
              // ignore
            }
            // Animate mask hole to follow the clone expansion (from clone rect to full viewport)
            // Prepare onUpdate to keep mask hole following the clone's live bounds (with corner radius)
            const computeRadiusPx = (el) => {
              try {
                const cs = window.getComputedStyle(el)
                const v = cs.borderTopLeftRadius || '0'
                const num = parseFloat(v) || 0
                return num
              } catch (e) {
                return 0
              }
            }
            descMaskUpdate = () => {
              try {
                const el = openClone || item
                const rr = el.getBoundingClientRect()
                descMaskHoleEl.setAttribute('x', String(rr.left))
                descMaskHoleEl.setAttribute('y', String(rr.top))
                descMaskHoleEl.setAttribute('width', String(rr.width))
                descMaskHoleEl.setAttribute('height', String(rr.height))
                const rad = computeRadiusPx(el)
                if (rad > 0) {
                  descMaskHoleEl.setAttribute('rx', String(rad))
                  descMaskHoleEl.setAttribute('ry', String(rad))
                }
              } catch (e) {
                // ignore
              }
            }
            // Initial sync and hook into timeline updates
            descMaskUpdate()
            tl.eventCallback('onUpdate', () => {
              try {
                if (descMaskUpdate) descMaskUpdate()
              } catch (e) {
                // ignore
              }
              try {
                if (syncOverlayDescRect) syncOverlayDescRect()
              } catch (e) {
                // ignore
              }
            })
          }
        } catch (ed) {
          // ignore
        }
        // Fade out all grid item names (wrap) and hide all name inners while opening
        try {
          gridItems.forEach((gi) => {
            const name = gi.querySelector('.machines-grid_name-wrap')
            if (name) {
              tl.to(
                name,
                {
                  opacity: 0,
                  duration: 1.2,
                  ease: gsap.parseEase('machinesStep') || 'power2.out',
                },
                0
              )
            }
            // Hide inner names instantly so only the clone's name appears
            const nameInner = gi.querySelector('.machines-grid_name-inner')
            if (nameInner) {
              tl.set(nameInner, { opacity: 0 }, 0)
            }
          })
        } catch (en) {
          // ignore
        }
        pushOthersOut(item, tl)
        // Keep sizing correct on resize while open
        resizeHandler = () => {
          const el = openClone || item
          try {
            gsap.set(el, {
              left: 0,
              top: 0,
              width: window.innerWidth,
              height: window.innerHeight,
            })
          } catch (e) {
            // ignore
          }
          try {
            if (descMaskUpdate) descMaskUpdate()
          } catch (e) {
            // ignore
          }
          try {
            // Recompute the final rect using hidden full-screen measurement clone
            if (descOverlay) {
              const measureFinalInfosRect = () => {
                try {
                  const source = openClone || item
                  const temp = source.cloneNode(true)
                  document.body.appendChild(temp)
                  gsap.set(temp, {
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    width: window.innerWidth,
                    height: window.innerHeight,
                    padding: '1em',
                    visibility: 'hidden',
                    margin: 0,
                    zIndex: -1,
                  })
                  void temp.offsetWidth
                  const tempInfos = temp.querySelector('.machines-grid_infos')
                  if (tempInfos) {
                    gsap.set(tempInfos, { display: 'flex', opacity: 1 })
                    const tempDesc = tempInfos.querySelector(
                      '.machines-grid_desc'
                    )
                    if (tempDesc) gsap.set(tempDesc, { opacity: 1 })
                  }
                  let rect = null
                  if (tempInfos) {
                    const infosRect = tempInfos.getBoundingClientRect()
                    const measuredHeight = Math.max(
                      infosRect.height,
                      tempInfos.scrollHeight || 0
                    )
                    rect = {
                      left: infosRect.left,
                      top: infosRect.top,
                      width: infosRect.width,
                      height: measuredHeight,
                    }
                  }
                  temp.remove()
                  return rect
                } catch (e) {
                  return null
                }
              }
              finalOverlayDescRect = measureFinalInfosRect()
              if (syncOverlayDescRect) syncOverlayDescRect()
            }
          } catch (e) {
            // ignore
          }
        }
        window.addEventListener('resize', resizeHandler)

        // Add interaction handlers (click anywhere, wheel/touchmove attempts) to close
        try {
          if (removeInteractionHandlers) removeInteractionHandlers()
          const onDocClickCapture = (ev) => {
            try {
              // Ignore clicks on the item button itself to avoid immediate close if any event slips
              if (
                ev &&
                ev.target &&
                ev.target.closest &&
                ev.target.closest('.machines-grid_button')
              )
                return
            } catch (e) {
              // ignore
            }
            closeGridItem()
          }
          const onWheel = () => closeGridItem()
          const onTouchMove = () => closeGridItem()
          // Defer adding to next frame so we don't catch the opening click
          requestAnimationFrame(() => {
            document.addEventListener('click', onDocClickCapture, true)
            window.addEventListener('wheel', onWheel, {
              passive: true,
              capture: true,
            })
            window.addEventListener('touchmove', onTouchMove, {
              passive: true,
              capture: true,
            })
          })
          removeInteractionHandlers = () => {
            try {
              document.removeEventListener('click', onDocClickCapture, true)
            } catch (e) {
              // ignore
            }
            try {
              window.removeEventListener('wheel', onWheel, {
                passive: true,
                capture: true,
              })
            } catch (e) {
              // ignore
            }
            try {
              window.removeEventListener('touchmove', onTouchMove, {
                passive: true,
                capture: true,
              })
            } catch (e) {
              // ignore
            }
          }
        } catch (e) {
          // ignore
        }
      }

      const closeGridItem = () => {
        if (!openItem) return
        const item = openItem
        openItem = null
        // If user closes during opening, stop the opening timeline first
        try {
          if (openingTimeline) {
            openingTimeline.kill()
            openingTimeline = null
          }
        } catch (e) {
          // ignore
        }
        window.removeEventListener('resize', resizeHandler)
        resizeHandler = null
        // Remove interaction handlers
        try {
          if (removeInteractionHandlers) removeInteractionHandlers()
        } catch (e) {
          // ignore
        }
        // Animate back to the image wrapper's rect (or item rect if missing)
        const imgWrapClose = item.querySelector('.machines-grid_img-wrap')
        const gridRect = imgWrapClose
          ? imgWrapClose.getBoundingClientRect()
          : item.getBoundingClientRect()
        const el = openClone || item
        if (!openClone) {
          // If we animated the original, ensure it starts from its current visual position
          const currentRect = el.getBoundingClientRect()
          gsap.set(el, {
            position: 'fixed',
            left: currentRect.left,
            top: currentRect.top,
            width: currentRect.width,
            height: currentRect.height,
            padding: '2em',
            zIndex: 5,
          })
        }
        const tl = gsap.timeline({
          onComplete: () => {
            if (openClone) {
              try {
                openClone.remove()
              } catch (e) {
                // ignore
              }
              openClone = null
            } else {
              clearItemInlineStyles(item)
            }
            // Clean up desc overlay and mask
            try {
              if (descOverlay) {
                descOverlay.remove()
              }
              if (descMaskSvgEl) {
                descMaskSvgEl.remove()
              }
            } catch (ecl) {
              // ignore
            }
            descOverlay = null
            descMaskSvgEl = null
            descMaskHoleEl = null
            // Restore names opacity for all items after closing
            try {
              gridItems.forEach((gi) => {
                const name = gi.querySelector('.machines-grid_name-wrap')
                if (name) gsap.set(name, { opacity: 1 })
                const nameInner = gi.querySelector('.machines-grid_name-inner')
                if (nameInner) gsap.set(nameInner, { opacity: 0 })
              })
            } catch (er) {
              // ignore
            }
            // Restore original image opacity after closing
            try {
              const imgWrap = item.querySelector('.machines-grid_img-wrap')
              if (imgWrap) gsap.set(imgWrap, { opacity: 1 })
            } catch (eop) {
              // ignore
            }
            // Final sweep: remove any stray clones that might still be in the DOM
            try {
              const strayClones = document.querySelectorAll(
                '.machines-grid_item-clone'
              )
              strayClones.forEach((node) => {
                try {
                  if (node && node.parentNode) node.parentNode.removeChild(node)
                } catch (e) {
                  // ignore
                }
              })
            } catch (e) {
              // ignore
            }
            unlockScroll()
            // Re-init parallax and refresh triggers after closing overlay
            try {
              initNextBackgroundParallax(root)
            } catch (e0) {
              // ignore
            }
            try {
              initParallax(root)
            } catch (e1) {
              // ignore
            }
            try {
              if (
                window.ScrollTrigger &&
                typeof window.ScrollTrigger.refresh === 'function'
              ) {
                window.ScrollTrigger.refresh()
              }
            } catch (e2) {
              // ignore
            }
          },
          onInterrupt: () => {
            // If timeline is interrupted, ensure clone and overlays are removed soon after
            try {
              setTimeout(() => {
                try {
                  if (openClone) {
                    openClone.remove()
                    openClone = null
                  }
                } catch (e) {
                  // ignore
                }
                try {
                  if (descOverlay) descOverlay.remove()
                  if (descMaskSvgEl) descMaskSvgEl.remove()
                  descOverlay = null
                  descMaskSvgEl = null
                  descMaskHoleEl = null
                } catch (e) {
                  // ignore
                }
              }, 0)
            } catch (e) {
              // ignore
            }
            try {
              initNextBackgroundParallax(root)
            } catch (e0) {
              // ignore
            }
            try {
              initParallax(root)
            } catch (e1) {
              // ignore
            }
            try {
              if (
                window.ScrollTrigger &&
                typeof window.ScrollTrigger.refresh === 'function'
              ) {
                window.ScrollTrigger.refresh()
              }
            } catch (e2) {
              // ignore
            }
          },
        })
        // Bring navbar back to 2em in parallel with the close animation
        try {
          animateNavbarSpreadForGrid(false, root)
        } catch (e) {
          // ignore
        }
        tl.to(
          el,
          {
            left: gridRect.left,
            top: gridRect.top,
            width: gridRect.width,
            height: gridRect.height,
            padding: 0,
            duration: 1.2,
            ease: gsap.parseEase('machinesStep') || 'power2.inOut',
          },
          0
        )

        // Reverse clone image back to its starting offsets/size inside clone
        try {
          if (openClone) {
            const clonedImg = openClone.querySelector('.machines-grid_img')
            if (clonedImg) {
              const startLeft = clonedImg.dataset.gridStartLeft || '50%'
              const startTop = clonedImg.dataset.gridStartTop || '50%'
              const startWidth = clonedImg.dataset.gridStartWidth || '24em'
              tl.to(
                clonedImg,
                {
                  left: startLeft,
                  top: startTop,
                  width: startWidth,
                  duration: 1.2,
                  ease: gsap.parseEase('machinesStep') || 'power2.inOut',
                },
                0
              )
            }
          }
        } catch (eImgRev) {
          // ignore
        }
        // Fade out desc overlay and move mask hole back to image rect while closing
        try {
          if (descOverlay) {
            // Animate overlay description lines out (0% -> 100%) during close
            try {
              const overlayGridDesc = descOverlay.querySelector('.is-grid-desc')
              const lineInnersOverlay = splitLines(overlayGridDesc)
              if (lineInnersOverlay && lineInnersOverlay.length) {
                gsap.set(lineInnersOverlay, { yPercent: 0 })
                tl.to(
                  lineInnersOverlay,
                  {
                    yPercent: 100,
                    duration: 1.2,
                    ease: gsap.parseEase('machinesStep') || 'power2.inOut',
                  },
                  0
                )
              }
            } catch (eOL) {
              // ignore
            }
            // Fade description overlay out during the close animation
            tl.to(
              descOverlay,
              {
                opacity: 0,
                duration: 1.2,
                ease: gsap.parseEase('machinesStep') || 'power2.inOut',
              },
              0
            )
          }
          // Animate clone description lines out as well
          try {
            if (openClone) {
              const cloneGridDesc = openClone.querySelector('.is-grid-desc')
              const lineInnersClone = splitLines(cloneGridDesc)
              if (lineInnersClone && lineInnersClone.length) {
                gsap.set(lineInnersClone, { yPercent: 0 })
                tl.to(
                  lineInnersClone,
                  {
                    yPercent: 100,
                    duration: 1.2,
                    ease: gsap.parseEase('machinesStep') || 'power2.inOut',
                  },
                  0
                )
              }
            }
          } catch (eCL) {
            // ignore
          }
          if (descMaskHoleEl) {
            tl.to(
              descMaskHoleEl,
              {
                attr: {
                  x: gridRect.left,
                  y: gridRect.top,
                  width: gridRect.width,
                  height: gridRect.height,
                },
                duration: 1.2,
                ease: gsap.parseEase('machinesStep') || 'power2.inOut',
              },
              0
            )
          }
          // Move overlay name inner out of view again (translateY(-8em))
          try {
            if (descOverlay) {
              const overlayNameInner = descOverlay.querySelector(
                '.machines-grid_name-inner'
              )
              if (overlayNameInner) {
                tl.to(
                  overlayNameInner,
                  {
                    y: '-10em',
                    duration: 1.2,
                    ease: gsap.parseEase('machinesStep') || 'power2.inOut',
                  },
                  0
                )
              }
            }
          } catch (eNameClose) {
            // ignore
          }
        } catch (eclose) {
          // ignore
        }
        // Fade back in names (wrap) for all grid items while closing
        try {
          gridItems.forEach((gi) => {
            const name = gi.querySelector('.machines-grid_name-wrap')
            if (name) {
              tl.to(
                name,
                {
                  opacity: 1,
                  duration: 1.2,
                  ease: gsap.parseEase('machinesStep') || 'power2.inOut',
                },
                0
              )
            }
          })
        } catch (en) {
          // ignore
        }
        resetOthers(tl)
      }

      // Assign stable unique ids to items/buttons for robust mapping
      try {
        const listItems = Array.from(
          gridList.querySelectorAll('.machines-grid_item')
        )
        listItems.forEach((it, i) => {
          const uid = it.dataset.gridUid || String(i + 1)
          it.dataset.gridUid = uid
          const b = it.querySelector('.machines-grid_button')
          if (b) b.dataset.gridUid = uid
        })
      } catch (e) {
        // ignore
      }

      // Helper: find the visually nearest item to a click point (favor vertical proximity)
      const findNearestItemByPoint = (x, y) => {
        try {
          const items = Array.from(
            gridList.querySelectorAll('.machines-grid_item')
          )
          let best = null
          let bestScore = Infinity
          items.forEach((it) => {
            const r = it.getBoundingClientRect()
            const cx = r.left + r.width / 2
            const cy = r.top + r.height / 2
            const dy = Math.abs(y - cy)
            const dx = Math.abs(x - cx)
            // Strongly prioritize vertical distance to avoid selecting far below in same column
            const score = dy * 1000 + dx
            if (score < bestScore) {
              bestScore = score
              best = it
            }
          })
          return best
        } catch (e) {
          return null
        }
      }

      // Always keep all name inners hidden by default in grid view
      const hideAllNameInners = () => {
        try {
          const inners = machinesGridWrapper.querySelectorAll(
            '.machines-grid_name-inner'
          )
          inners.forEach((el) => gsap.set(el, { opacity: 0 }))
        } catch (e) {
          // ignore
        }
      }
      hideAllNameInners()

      // Per-item handler to avoid any ambiguity with ordering/duplication
      const attachClickForItem = (item) => {
        try {
          const btn = item.querySelector('.machines-grid_button')
          if (!btn || btn.__gridHandlerAttached) return
          btn.__gridHandlerAttached = true
          btn.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (typeof e.stopImmediatePropagation === 'function') {
              e.stopImmediatePropagation()
            }
            try {
              btn.blur()
              if (document.activeElement && document.activeElement.blur)
                document.activeElement.blur()
            } catch (e2) {
              // ignore
            }
            // Resolve the target by click position to avoid any overlay/duplication issues
            const target = findNearestItemByPoint(e.clientX, e.clientY) || item
            if (openItem && openItem === target) closeGridItem()
            else openGridItem(target)
          })
        } catch (e) {
          // ignore
        }
      }

      gridItems.forEach((it) => attachClickForItem(it))

      // Hover interactions: custom cursor + name translate/dimming
      try {
        const cursor = document.querySelector('.cursor-pointer')
        if (cursor) {
          // Prepare cursor initial state (hidden, no pointer events)
          try {
            cursor.style.display = 'none'
            cursor.style.pointerEvents = 'none'
          } catch (e0) {
            // ignore
          }
          // Prepare inner transition for enter/leave like blog
          try {
            const inner =
              cursor.querySelector('.cursor-pointer_inner') ||
              cursor.firstElementChild
            if (inner) {
              const current = getComputedStyle(inner).transition || ''
              if (!/transform/.test(current)) {
                inner.style.transition =
                  (current ? current + ', ' : '') +
                  'transform 300ms cubic-bezier(0.6, 0, 0, 1)'
              }
              inner.style.transform = 'translateY(100%)'
              // Cache inner size so container keeps stable size on enter
              const prevVis = cursor.style.visibility
              const prevDisp = cursor.style.display
              const wasHidden = getComputedStyle(cursor).display === 'none'
              if (wasHidden) {
                cursor.style.visibility = 'hidden'
                cursor.style.display = 'flex'
              }
              const rect = inner.getBoundingClientRect()
              cursor.dataset.__cursorInnerW = String(Math.ceil(rect.width))
              cursor.dataset.__cursorInnerH = String(Math.ceil(rect.height))
              if (wasHidden) {
                cursor.style.display = prevDisp || 'none'
                cursor.style.visibility = prevVis || ''
              }
            }
          } catch (e1) {
            // ignore
          }

          let cursorOffsetPx = 8
          let endHandler = null
          const computeCursorOffset = () => {
            try {
              const fs = parseFloat(getComputedStyle(cursor).fontSize) || 16
              cursorOffsetPx = fs
            } catch (e) {
              cursorOffsetPx = 8
            }
          }
          computeCursorOffset()

          const onCursorEnter = () => {
            const inner =
              cursor.querySelector('.cursor-pointer_inner') ||
              cursor.firstElementChild
            cursor.style.display = 'flex'
            if (inner) {
              if (endHandler) {
                try {
                  inner.removeEventListener('transitionend', endHandler)
                } catch (e) {
                  // ignore
                }
                endHandler = null
              }
              inner.style.transform = 'translateY(100%)'
              void inner.getBoundingClientRect()
              inner.style.transform = 'translateY(0)'
            }
          }
          const onCursorLeave = () => {
            const inner =
              cursor.querySelector('.cursor-pointer_inner') ||
              cursor.firstElementChild
            if (inner) {
              endHandler = () => {
                cursor.style.display = 'none'
                try {
                  inner.removeEventListener('transitionend', endHandler)
                } catch (e) {
                  // ignore
                }
                endHandler = null
                inner.style.transform = 'translateY(100%)'
              }
              // Manually remove listener inside handler to simulate once behavior
              inner.addEventListener('transitionend', endHandler)
              inner.style.transform = 'translateY(100%)'
            } else {
              cursor.style.display = 'none'
            }
          }
          const onCursorMove = (e) => {
            cursor.style.left = e.pageX + cursorOffsetPx + 'px'
            cursor.style.top = e.pageY + cursorOffsetPx + 'px'
          }

          const ease = gsap.parseEase('machinesStep') || ((t) => t)

          const getMachineNameHoverTranslateYPx = (wrap) => {
            if (!wrap) return 0
            try {
              const line = wrap.querySelector('.body-m')
              if (line) {
                let h = line.offsetHeight
                if (!h) {
                  const cs = getComputedStyle(line)
                  const lh = cs.lineHeight
                  if (lh && lh !== 'normal') h = parseFloat(lh) || 0
                }
                if (h > 0) return -Math.round(h)
              }
              const clip = wrap.closest('.machines-grid_name-wrap')
              const ch = clip?.offsetHeight ?? 0
              if (ch > 0) return -Math.round(ch)
            } catch (e) {
              /* ignore */
            }
            return 0
          }

          const bindHoverHandlers = (item) => {
            if (!item || item.__gridHoverBound) return
            item.__gridHoverBound = true

            const nameWrap = item.querySelector('.is-m-name_wrap')

            const onEnter = () => {
              onCursorEnter()
              if (nameWrap) {
                try {
                  gsap.killTweensOf(nameWrap)
                } catch (e) {
                  // ignore
                }
                const yPx = getMachineNameHoverTranslateYPx(nameWrap)
                gsap.to(nameWrap, {
                  y: yPx !== 0 ? yPx : '-1.8em',
                  opacity: 1,
                  duration: 0.3,
                  ease,
                })
              }
              // Dim other items' names
              try {
                gridItems.forEach((other) => {
                  if (other === item) return
                  const otherWrap = other.querySelector('.is-m-name_wrap')
                  if (otherWrap) {
                    gsap.to(otherWrap, { opacity: 0.4, duration: 0.3, ease })
                  }
                })
              } catch (e) {
                // ignore
              }
            }

            const onLeave = () => {
              onCursorLeave()
              if (nameWrap) {
                try {
                  gsap.killTweensOf(nameWrap)
                } catch (e) {
                  // ignore
                }
                gsap.to(nameWrap, { y: 0, duration: 0.3, ease })
              }
              // Restore others
              try {
                gridItems.forEach((other) => {
                  const otherWrap = other.querySelector('.is-m-name_wrap')
                  if (otherWrap) {
                    gsap.to(otherWrap, { opacity: 1, duration: 0.3, ease })
                  }
                })
              } catch (e) {
                // ignore
              }
            }

            const onMove = (e) => onCursorMove(e)

            item.addEventListener('mouseenter', onEnter)
            item.addEventListener('mouseleave', onLeave)
            item.addEventListener('mousemove', onMove)
          }

          // Ensure a clean initial state
          try {
            const allNameWraps =
              machinesGridWrapper.querySelectorAll('.is-m-name_wrap')
            if (allNameWraps && allNameWraps.length) {
              allNameWraps.forEach((el) => gsap.set(el, { opacity: 1, y: 0 }))
            }
          } catch (e) {
            // ignore
          }

          gridItems.forEach((it) => bindHoverHandlers(it))

          // Observe dynamic changes (Webflow CMS, filters, pagination) and bind on the fly
          try {
            const mo = new MutationObserver(() => {
              try {
                gridItems = Array.from(
                  machinesGridWrapper.querySelectorAll('.machines-grid_item')
                )
              } catch (e) {
                gridItems = []
              }
              gridItems.forEach((it) => bindHoverHandlers(it))
            })
            mo.observe(gridList || machinesGridWrapper, {
              childList: true,
              subtree: true,
            })
          } catch (e) {
            // ignore
          }

          // Recompute cursor offset on resize
          try {
            window.addEventListener('resize', computeCursorOffset)
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {
        // ignore
      }

      // Also support close via inner close button when available
      machinesGridWrapper
        .querySelectorAll(
          '.machines-grid_close-button, .machines-grid_button_label'
        )
        .forEach((el) => {
          el.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (openItem) closeGridItem()
          })
        })
    }
  } catch (err) {
    // ignore
  }
}
