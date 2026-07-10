import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)
// Ensure a named custom ease exists (same curve as in nav.js)
try {
  CustomEase.create('custom', 'M0,0 C0.6,0 0,1 1,1 ')
} catch (err) {
  // ignore if already created
}

// --- Line split + slide-in helpers for testimonials ---
function getTestimonialTextElements(testimonialEl) {
  const nodes = Array.from(
    testimonialEl.querySelectorAll(
      '[data-animate-lines], .testimonial-text, .quote, .text, p.body-xl'
    ) || []
  )
  if (nodes.length) return nodes
  const fallback = testimonialEl.querySelector('p')
  return fallback ? [fallback] : [testimonialEl]
}

function ensureWordSpans(rootEl) {
  // Cache original text content using innerText which preserves all spacing
  if (!rootEl.dataset.origText) {
    rootEl.dataset.origText = rootEl.innerText || rootEl.textContent || ''
  }

  if (rootEl.dataset.wordsSplitted === 'true') return

  // Clear and rebuild from scratch each time
  rootEl.textContent = rootEl.dataset.origText

  // Now split all text nodes by whitespace
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null)
  const textNodes = []
  let tnode
  while ((tnode = walker.nextNode())) {
    if (tnode.nodeValue && tnode.nodeValue.trim().length > 0) {
      textNodes.push(tnode)
    }
  }

  if (!textNodes.length) {
    rootEl.dataset.wordsSplitted = 'true'
    return
  }

  // Process each text node
  textNodes.forEach((textNode) => {
    const parent = textNode.parentNode
    const text = textNode.nodeValue
    const parts = text.split(/(\s+)/)
    const frag = document.createDocumentFragment()

    parts.forEach((part) => {
      if (part.trim().length === 0) {
        frag.appendChild(document.createTextNode(part))
      } else {
        const span = document.createElement('span')
        span.className = 'testimonial-word'
        span.textContent = part
        span.style.display = 'inline-block'
        frag.appendChild(span)
      }
    })

    parent.replaceChild(frag, textNode)
  })

  rootEl.dataset.wordsSplitted = 'true'
}

function splitIntoVisualLines(rootEl) {
  // Reset temporary flags to ensure fresh split on each call
  delete rootEl.dataset.wordsSplitted
  delete rootEl.dataset.linesSplitted

  ensureWordSpans(rootEl)
  const words = Array.from(rootEl.querySelectorAll('.testimonial-word'))
  if (!words.length) return []

  const lines = []
  let currentTop = null
  let lineWords = []
  words.forEach((w) => {
    const top = w.offsetTop
    if (currentTop === null) {
      currentTop = top
    }
    if (top !== currentTop && lineWords.length) {
      lines.push(lineWords)
      lineWords = []
      currentTop = top
    }
    lineWords.push(w)
  })
  if (lineWords.length) lines.push(lineWords)

  // Build line wrappers
  const frag = document.createDocumentFragment()
  lines.forEach((line) => {
    const outer = document.createElement('span')
    outer.className = 'testimonial-line'
    outer.style.display = 'block'
    outer.style.overflow = 'hidden'

    const inner = document.createElement('span')
    inner.className = 'testimonial-line-inner'
    inner.style.display = 'inline-block'

    // Capture leading whitespace before first word
    const firstWord = line[0]
    if (firstWord) {
      const prevNode = firstWord.previousSibling
      if (
        prevNode &&
        prevNode.nodeType === Node.TEXT_NODE &&
        (prevNode.textContent || '').trim().length === 0
      ) {
        inner.appendChild(prevNode)
      }
    }

    line.forEach((w) => {
      // Capture the following whitespace BEFORE moving the word node
      const nextNode = w.nextSibling
      const shouldMoveSpace =
        nextNode &&
        nextNode.nodeType === Node.TEXT_NODE &&
        (nextNode.textContent || '').trim().length === 0

      // Append the word
      inner.appendChild(w)

      // Preserve following whitespace text node (spaces) if present
      if (shouldMoveSpace) {
        inner.appendChild(nextNode)
      }
    })

    // Capture trailing whitespace after the last word (only immediate next sibling)
    const lastWord = line[line.length - 1]
    if (lastWord) {
      const nextNode = lastWord.nextSibling
      if (
        nextNode &&
        nextNode.nodeType === Node.TEXT_NODE &&
        (nextNode.textContent || '').trim().length === 0
      ) {
        inner.appendChild(nextNode)
      }
    }
    outer.appendChild(inner)
    frag.appendChild(outer)
  })

  // Replace all children with the new line wrappers
  while (rootEl.firstChild) {
    rootEl.removeChild(rootEl.firstChild)
  }
  rootEl.appendChild(frag)
  rootEl.dataset.linesSplitted = 'true'
  return Array.from(rootEl.querySelectorAll('.testimonial-line-inner'))
}

// (Deprecated) animateLinesIn kept only for reference; replaced by animateElementsLinesStaggered

function animateElementsLinesStaggered(rootEls) {
  const allLines = []
  rootEls.forEach((el) => {
    const lines = splitIntoVisualLines(el)
    if (lines && lines.length) allLines.push(...lines)
  })
  if (!allLines.length) return
  gsap.killTweensOf(allLines)
  gsap.set(allLines, { yPercent: 100 })
  gsap.to(allLines, {
    yPercent: 0,
    duration: 0.6,
    ease: 'custom',
    stagger: 0.05,
    overwrite: 'auto',
  })
}

export function initTestimonials(root = document) {
  const containers = Array.from(root.querySelectorAll('.testimonials') || [])
  if (!containers.length) return

  containers.forEach((container) => {
    const options = container.querySelectorAll('.toggle-option')
    const indicator = container.querySelector('.toggle-indicator')
    if (!options.length || !indicator) return

    // Collect testimonial blocks (prefer .testimonial, fallback to direct children blocks)
    let testimonials = Array.from(
      container.querySelectorAll('.testimonial') || []
    )
    if (testimonials.length < 2) {
      const fallback = Array.from(
        container.querySelectorAll(':scope > .w-layout-vflex')
      ).filter((el) => el !== options[0]?.closest('.toggle'))
      if (fallback.length >= 2) {
        testimonials = fallback
      }
    }

    const toggleIds = container.querySelectorAll('.toggle-id')

    // Prepare initial opacity states
    const setInitialVisibility = (idx) => {
      if (testimonials.length >= 2) {
        testimonials.forEach((t, i) => {
          gsap.set(t, { opacity: i === idx ? 1 : 0 })
        })
      }
    }

    let activeIndex = 0

    const setActiveIndex = (i, animateIndicator = true) => {
      if (i === activeIndex) return
      // Move indicator with GSAP
      if (animateIndicator) {
        gsap.to(indicator, {
          duration: 0.6,
          xPercent: i * 110,
          ease: 'custom',
          overwrite: 'auto',
        })
      }

      // Option visual state per provided snippet
      options.forEach((o) => o.classList.remove('active'))
      options[i]?.classList.add('active')

      // Also align with existing CSS: toggle .toggle-id.is-active
      toggleIds.forEach((idEl, idx) => {
        if (idx === i) idEl.classList.add('is-active')
        else idEl.classList.remove('is-active')
      })

      // Toggle testimonial active state with opacity crossfade + text slide-in
      if (testimonials.length >= 2) {
        const prev = testimonials[activeIndex]
        const next = testimonials[i]
        if (prev && next && prev !== next) {
          prev.classList.remove('is-active')
          next.classList.add('is-active')
          // Prepare and animate incoming text lines
          const textEls = getTestimonialTextElements(next)
          animateElementsLinesStaggered(textEls)
          gsap.to(prev, {
            duration: 0.6,
            opacity: 0,
            ease: 'custom',
            overwrite: 'auto',
          })
          gsap.to(next, {
            duration: 0.6,
            opacity: 1,
            ease: 'custom',
            overwrite: 'auto',
          })
        }
      }

      activeIndex = i
    }

    // Initial position based on current active id
    let initial = 0
    toggleIds.forEach((idEl, idx) => {
      if (idEl.classList.contains('is-active')) initial = idx
    })
    activeIndex = initial
    setInitialVisibility(initial)
    // Ensure indicator reflects initial position without animation
    gsap.set(indicator, { xPercent: initial * 110 })

    // Auto-toggle when in view every 5 seconds
    let autoToggleInterval = null
    const startAutoToggle = () => {
      if (autoToggleInterval || options.length < 2) return
      autoToggleInterval = window.setInterval(() => {
        const nextIndex = (activeIndex + 1) % options.length
        setActiveIndex(nextIndex)
      }, 5000)
    }
    const stopAutoToggle = () => {
      if (autoToggleInterval) {
        clearInterval(autoToggleInterval)
        autoToggleInterval = null
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target !== container) return
          if (entry.isIntersecting) startAutoToggle()
          else stopAutoToggle()
        })
      },
      { threshold: 0.25 }
    )
    observer.observe(container)

    options.forEach((opt, i) => {
      // Animate indicator on hover
      opt.addEventListener('mouseenter', () => {
        gsap.to(indicator, {
          duration: 0.6,
          xPercent: i * 110,
          ease: 'custom',
          overwrite: 'auto',
        })
        // Eyebrow (toggle-id) color preview on hover
        toggleIds.forEach((idEl, idx) => {
          if (idx === i) idEl.classList.add('is-active')
          else idEl.classList.remove('is-active')
        })
      })

      // Switch testimonial on click without animating indicator (indicator handled by hover)
      opt.addEventListener('click', () => {
        stopAutoToggle()
        setActiveIndex(i, false)
        startAutoToggle()
      })
    })

    // When leaving the toggle area, return indicator to the active index
    container.addEventListener('mouseleave', () => {
      gsap.to(indicator, {
        duration: 0.6,
        xPercent: activeIndex * 110,
        ease: 'custom',
        overwrite: 'auto',
      })
      // Restore eyebrow (toggle-id) color to actual active
      toggleIds.forEach((idEl, idx) => {
        if (idx === activeIndex) idEl.classList.add('is-active')
        else idEl.classList.remove('is-active')
      })
    })
  })
}
