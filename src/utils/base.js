// Themes couleur
export const initializeNavbarTheme = {
  themes: {
    white: {
      navbarColor: 'var(--primary)',
      logoBgFill: 'var(--white)',
      logoPathFill: 'var(--primary)',
      menuIconBorder: 'var(--primary)',
      menuIconBg: 'var(--white)',
      menuIconBarsBg: 'var(--primary)',
    },
    lightgreen: {
      navbarColor: 'var(--primary)',
      logoBgFill: 'var(--light-green)',
      logoPathFill: 'var(--primary)',
      menuIconBorder: 'var(--primary)',
      menuIconBg: 'var(--light-green)',
      menuIconBarsBg: 'var(--primary)',
    },
    black: {
      navbarColor: 'var(--white)',
      logoBgFill: 'var(--black)',
      logoPathFill: 'var(--white)',
      menuIconBorder: 'var(--white)',
      menuIconBg: 'var(--black)',
      menuIconBarsBg: 'var(--white)',
    },
    hero: {
      navbarColor: 'var(--white)',
      logoBgFill: 'transparent',
      logoPathFill: 'var(--white)',
      menuIconBorder: 'var(--white)',
      menuIconBg: 'transparent',
      menuIconBarsBg: 'var(--white)',
    },
    menu: {
      navbarColor: 'var(--white)',
      logoBgFill: 'var(--accent)',
      logoPathFill: 'var(--white)',
      menuIconBorder: 'var(--primary)',
      menuIconBg: 'var(--accent)',
      menuIconBarsBg: 'var(--primary)',
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

// Centre verticalement les éléments sticky avec la classe .is-sticky-50
export function initSticky50(root = document) {
  try {
    const container = root && root.nodeType === 1 ? root : document
    const elements = Array.from(container.querySelectorAll('.is-sticky-50'))
    if (!elements.length) return

    const computeAndApply = (el) => {
      try {
        const height = el.offsetHeight || el.getBoundingClientRect().height || 0
        if (!height) return
        el.style.setProperty('--sticky-height', height + 'px')
        el.style.top = 'calc(50vh - (var(--sticky-height) / 2))'
      } catch (e) {
        // ignore
      }
    }

    elements.forEach((el) => {
      computeAndApply(el)
      try {
        if (window.ResizeObserver && !el.__sticky50Observed) {
          const ro = new ResizeObserver(() => computeAndApply(el))
          ro.observe(el)
          el.__sticky50Observed = ro
        }
      } catch (e) {
        // ignore
      }
    })

    try {
      if (!window.__sticky50ResizeBound) {
        const onWinResize = () => {
          try {
            const all = document.querySelectorAll('.is-sticky-50')
            all.forEach((el) => computeAndApply(el))
          } catch (e) {
            // ignore
          }
        }
        window.addEventListener('resize', onWinResize)
        window.__sticky50ResizeBound = true
      }
    } catch (e) {
      // ignore
    }

    try {
      if (
        typeof window !== 'undefined' &&
        window.ScrollTrigger &&
        typeof window.ScrollTrigger.refresh === 'function'
      ) {
        requestAnimationFrame(() => {
          try {
            window.ScrollTrigger.refresh()
          } catch (err) {
            // ignore
          }
        })
      }
    } catch (e) {
      // ignore
    }
  } catch (e) {
    // ignore
  }
}
