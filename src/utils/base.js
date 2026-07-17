// Themes couleur
export const initializeNavbarTheme = {
  themes: {
    white: {
      navbarColor: 'var(--primary)',
      logoBgFill: 'var(--white)',
      logoPathFill: 'var(--primary)',
      menuIconBorder: 'var(--primary)',
      menuIconBg: 'var(--white)',
      menuIconBarsBg: '#020202',
    },
    lightgreen: {
      navbarColor: 'var(--primary)',
      logoBgFill: 'var(--light-green)',
      logoPathFill: 'var(--primary)',
      menuIconBorder: 'var(--primary)',
      menuIconBg: 'var(--white)',
      menuIconBarsBg: '#020202',
    },
    black: {
      navbarColor: 'var(--white)',
      logoBgFill: 'var(--black)',
      logoPathFill: 'var(--white)',
      menuIconBorder: 'var(--white)',
      menuIconBg: 'var(--white)',
      menuIconBarsBg: '#020202',
    },
    hero: {
      navbarColor: 'var(--white)',
      logoBgFill: 'transparent',
      logoPathFill: 'var(--white)',
      menuIconBorder: 'var(--white)',
      menuIconBg: 'var(--white)',
      menuIconBarsBg: '#020202',
    },
    menu: {
      navbarColor: 'var(--white)',
      logoBgFill: 'var(--accent)',
      logoPathFill: 'var(--white)',
      menuIconBorder: 'var(--primary)',
      menuIconBg: 'var(--accent)',
      menuIconBarsBg: '#020202',
    },
  },
  transition: { duration: 1.2 },
}

// Ré-initialisation des animations Webflow (destroy → ready → ix2.init)
export function reinitializeWebflowAnimations() {
  const wf = window.Webflow
  if (!wf) return
  try {
    if (typeof wf.destroy === 'function') wf.destroy()
  } catch (err) {
    // ignore
  }
  try {
    if (typeof wf.ready === 'function') wf.ready()
  } catch (err) {
    // ignore
  }
  try {
    const ix2 = typeof wf.require === 'function' ? wf.require('ix2') : null
    if (ix2 && typeof ix2.init === 'function') ix2.init()
  } catch (err) {
    // ignore
  }
}

function measureSticky50Height(el) {
  try {
    const rect = el.getBoundingClientRect()
    const height = el.offsetHeight || rect.height || 0
    return Math.max(0, Math.round(height))
  } catch (e) {
    return 0
  }
}

function applySticky50Top(el) {
  if (!el || !el.style) return false

  const height = measureSticky50Height(el)
  if (!height) return false

  try {
    el.style.setProperty('--sticky-height', `${height}px`)
    el.style.top = 'max(0px, calc(50vh - (var(--sticky-height) / 2)))'
    return true
  } catch (e) {
    return false
  }
}

function scheduleSticky50Reflow(el) {
  if (!el) return

  const tick = () => {
    applySticky50Top(el)
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(tick)
  })
  setTimeout(tick, 120)
  setTimeout(tick, 320)

  try {
    if (document.fonts && typeof document.fonts.ready?.then === 'function') {
      document.fonts.ready.then(tick).catch(() => {})
    }
  } catch (e) {
    // ignore
  }
}

function ensureSticky50Observer(el) {
  if (!el || el.__sticky50Observed) return

  try {
    if (!window.ResizeObserver) return
    const ro = new ResizeObserver(() => {
      applySticky50Top(el)
    })
    ro.observe(el)
    el.__sticky50Observed = ro
  } catch (e) {
    // ignore
  }
}

function bindSticky50GlobalListeners() {
  if (window.__sticky50GlobalsBound) return
  window.__sticky50GlobalsBound = true

  const refreshAll = () => {
    try {
      document.querySelectorAll('.is-sticky-50').forEach((el) => {
        applySticky50Top(el)
        scheduleSticky50Reflow(el)
      })
    } catch (e) {
      // ignore
    }
  }

  try {
    window.addEventListener('resize', () => {
      document.querySelectorAll('.is-sticky-50').forEach((el) => {
        applySticky50Top(el)
      })
    })
    window.addEventListener('page:transition:after', refreshAll)
    document.addEventListener('menu:close-end', () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(refreshAll)
      })
    })
  } catch (e) {
    // ignore
  }
}

export function refreshSticky50(root = document) {
  try {
    const container = root && root.nodeType === 1 ? root : document
    container.querySelectorAll('.is-sticky-50').forEach((el) => {
      applySticky50Top(el)
      scheduleSticky50Reflow(el)
    })
  } catch (e) {
    // ignore
  }
}

// Centre verticalement les éléments sticky avec la classe .is-sticky-50
export function initSticky50(root = document) {
  try {
    bindSticky50GlobalListeners()

    const container = root && root.nodeType === 1 ? root : document
    const elements = Array.from(container.querySelectorAll('.is-sticky-50'))
    if (!elements.length) return

    elements.forEach((el) => {
      applySticky50Top(el)
      ensureSticky50Observer(el)
      scheduleSticky50Reflow(el)
    })

    requestAnimationFrame(() => {
      elements.forEach((el) => {
        applySticky50Top(el)
      })
      try {
        if (
          window.ScrollTrigger &&
          typeof window.ScrollTrigger.refresh === 'function'
        ) {
          window.ScrollTrigger.refresh()
        }
      } catch (err) {
        // ignore
      }
    })
  } catch (e) {
    // ignore
  }
}
