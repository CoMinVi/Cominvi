import barba from '@barba/core'
import { gsap } from 'gsap'

import { reinitializeWebflowAnimations } from '../utils/base.js'
import { initializeNav2, resetMenuLinksAnimationState } from './nav.js'
import { initHeroBackgroundParallax } from './parallax.js'
import { initLenis, destroyLenis } from './scroll.js'
import {
  createViewportClipOverlay,
  resetOverlayClipBaseState,
} from './svg-clip-overlay.js'
import {
  slideScaleLeave as innerLeave,
  slideScaleEnter as innerEnter,
} from './transition-inner.js'
import { nextLeave, nextEnter } from './transition-next.js'
import { slideScaleLeave, slideScaleEnter } from './transition-slide-scale.js'

// Minimal Barba setup that focuses only on nav-related transitions
export function initializePageTransitionNav() {
  const reinitFsAttributes = () => {
    try {
      const fs = window && window.fsAttributes
      if (!fs) return
      try {
        if (typeof fs.destroy === 'function') fs.destroy()
      } catch (e) {
        // ignore
      }
      try {
        if (typeof fs.init === 'function') fs.init()
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // ignore
    }
  }
  // Flag history navigations so we can route them to the same transition as pt-inner
  try {
    window.addEventListener('popstate', () => {
      try {
        window.__barbaHistoryNav = true
      } catch (e) {
        // ignore
      }
    })
  } catch (e) {
    // ignore
  }
  // Track UI visibility adjustments for pt-inner clicks
  const isVisible = (el) => {
    if (!el) return false
    const cs = getComputedStyle(el)
    return (
      cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0'
    )
  }
  const cache = {
    wasNavVisible: false,
    forcedPageInfoFlex: false,
  }
  const setPageInfoLabels = ({ from, to }) => {
    try {
      const apply = (root) => {
        if (!root || !root.querySelector) return
        const fromEl = root.querySelector('#page-from')
        const toEl = root.querySelector('#page-to')
        if (fromEl && typeof from === 'string') fromEl.textContent = from
        if (toEl && typeof to === 'string') toEl.textContent = to
      }
      apply(document)
      try {
        const overlay = document.querySelector('.mask-overlay')
        if (overlay) {
          const clone = overlay.querySelector('.mask-overlay_page-info')
          if (clone) apply(clone)
        }
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      /* ignore */
    }
  }
  const getCurrentLabel = () => {
    try {
      const el =
        document.querySelector('#page-to') ||
        document.querySelector('#page-from')
      if (el && el.textContent) return el.textContent.trim()
    } catch (e) {
      /* ignore */
    }
    try {
      return (document.title || '').trim()
    } catch (e) {
      return ''
    }
  }
  const getLabelFromTrigger = (trigger) => {
    try {
      if (!trigger) return ''
      // Prefer closest anchor
      const a = trigger.closest ? trigger.closest('a') : null
      const root = a || trigger
      const label =
        (root.querySelector && root.querySelector('.navlink_label')) ||
        (root.querySelector && root.querySelector('.button-white_label')) ||
        (root.querySelector && root.querySelector('.button_label')) ||
        root
      const txt = (label.textContent || '').trim()
      return txt
    } catch (e) {
      return ''
    }
  }
  const getLabelFromNext = (root) => {
    try {
      const container = root && root.querySelector ? root : document
      const path = (location && location.pathname ? location.pathname : '')
        .split('/')
        .pop()
      if (path) {
        const a =
          container.querySelector(`a[href$="${path}"]`) ||
          container.querySelector(`a[href$='/${path}']`)
        if (a) {
          const label = a.querySelector('.navlink_label') || a
          const txt = (label.textContent || '').trim()
          if (txt) return txt
        }
      }
      return (document.title || '').trim()
    } catch (e) {
      return ''
    }
  }

  // Namespaces helpers (source of truth for page names)
  const getNamespaceFromContainer = (container) => {
    try {
      if (container && container.getAttribute) {
        const ns = container.getAttribute('data-barba-namespace')
        return (ns || '').trim()
      }
    } catch (e) {
      /* ignore */
    }
    return ''
  }
  // Note: we derive namespaces directly from containers to avoid ambiguity

  const rememberFromLabel = (from) => {
    try {
      window.__pageInfoFromLabel = from || ''
    } catch (e) {
      /* ignore */
    }
  }
  const ensureNavbarInteractive = (root = document) => {
    try {
      const scope = root && root.querySelector ? root : document
      const navbar =
        (scope.querySelector && scope.querySelector('.navbar')) ||
        document.querySelector('.navbar')
      if (!navbar) return
      // Intentionnellement vide : nous n'imposons plus de pointer-events ici.
    } catch (e) {
      /* ignore */
    }
  }
  const consumeFromLabel = () => {
    try {
      const v = window.__pageInfoFromLabel || ''
      window.__pageInfoFromLabel = ''
      return v
    } catch (e) {
      return ''
    }
  }
  const performPreInnerUI = () => {
    try {
      const isVisible = (el) => {
        if (!el) return false
        const cs = getComputedStyle(el)
        return (
          cs.display !== 'none' &&
          cs.visibility !== 'hidden' &&
          cs.opacity !== '0'
        )
      }
      const navInner = document.querySelector('.nav-inner')
      const pageInfo = document.querySelector('.page-info')
      cache.wasNavVisible = isVisible(navInner)
      cache.forcedPageInfoFlex = false
      if (cache.wasNavVisible && navInner) navInner.style.display = 'none'
      if (pageInfo && !isVisible(pageInfo)) {
        pageInfo.style.display = 'flex'
        cache.forcedPageInfoFlex = true
      }
      let overlay = document.querySelector('.mask-overlay')
      if (!overlay) {
        const created = createViewportClipOverlay({ repeat: 0, yoyo: false })
        overlay = created && created.container
        try {
          window.__maskOverlay = {
            container: overlay,
            tl: created && created.tl,
          }
        } catch (e) {
          /* ignore */
        }
      }
      if (overlay) {
        try {
          resetOverlayClipBaseState()
        } catch (e) {
          /* ignore */
        }
        try {
          overlay.classList.add('is-active')
        } catch (e) {
          overlay.className += ' is-active'
        }
        overlay.style.left = '0px'
        try {
          const clone = overlay.querySelector('.mask-overlay_page-info')
          if (clone) clone.style.display = 'flex'
        } catch (e) {
          /* ignore */
        }
      }
      window.__ptInnerFlags = { ...cache }
    } catch (e) {
      /* ignore */
    }
  }
  document.addEventListener(
    'click',
    (ev) => {
      const target =
        ev.target && ev.target.closest
          ? ev.target.closest('[pt-inner], [data-pt-inner], #pt-inner')
          : null
      if (!target) return
      try {
        const navInner = document.querySelector('.nav-inner')
        const pageInfo = document.querySelector('.page-info')
        cache.wasNavVisible = isVisible(navInner)
        cache.forcedPageInfoFlex = false
        if (cache.wasNavVisible && navInner) {
          navInner.style.display = 'none'
        }
        if (pageInfo && !isVisible(pageInfo)) {
          pageInfo.style.display = 'flex'
          cache.forcedPageInfoFlex = true
        }
        // Ensure mask-overlay exists and becomes active immediately on click
        try {
          let overlay = document.querySelector('.mask-overlay')
          if (!overlay) {
            const created = createViewportClipOverlay({
              repeat: 0,
              yoyo: false,
            })
            overlay = created && created.container
            try {
              window.__maskOverlay = {
                container: overlay,
                tl: created && created.tl,
              }
            } catch (e) {
              // ignore
            }
          }
          if (overlay) {
            try {
              // Ensure start geometry is reset before showing
              resetOverlayClipBaseState()
            } catch (e) {
              // ignore
            }
            try {
              overlay.classList.add('is-active')
            } catch (e) {
              overlay.className += ' is-active'
            }
            overlay.style.left = '0px'
            try {
              const clone = overlay.querySelector('.mask-overlay_page-info')
              if (clone) clone.style.display = 'flex'
            } catch (e) {
              // ignore
            }
          }
        } catch (e) {
          // ignore
        }
        // expose for transition after hook
        window.__ptInnerFlags = { ...cache }
      } catch (err) {
        // ignore
      }
    },
    true
  )

  const isHomeNamespace = (container) => {
    const ns = (getNamespaceFromContainer(container) || '').trim().toLowerCase()
    return ns === 'home'
  }

  let deferredInitsPromise = null
  const loadDeferredInits = () => {
    if (!deferredInitsPromise) {
      deferredInitsPromise = import('./deferred-inits.js')
    }
    return deferredInitsPromise
  }

  const destroyIconsSafe = (root = document) => {
    loadDeferredInits()
      .then((m) => m.destroyIconsSafe(root))
      .catch(() => {})
  }

  const resetServiceCardIconsSafe = (root = document) => {
    loadDeferredInits()
      .then((m) => m.resetServiceCardIconsSafe(root))
      .catch(() => {})
  }

  const initIconsSafe = (root = document) => {
    loadDeferredInits()
      .then((m) => m.initIconsSafe(root))
      .catch(() => {})
  }

  const scheduleAfterHero = (fn, { timeout = 180 } = {}) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(fn, { timeout })
        } else {
          setTimeout(fn, Math.min(timeout, 300))
        }
      })
    })
  }
  const runAfterWindowLoad = (fn) => {
    try {
      if (document.readyState === 'complete') {
        fn()
        return
      }
      window.addEventListener('load', fn, { once: true })
    } catch (e) {
      fn()
    }
  }

  const runNonCriticalInits = (
    container,
    { includeScrollRefresh = false, includeTransitionEvent = false } = {}
  ) =>
    loadDeferredInits()
      .then((m) =>
        m.runNonCriticalInits(container, {
          includeScrollRefresh,
          includeTransitionEvent,
        })
      )
      .catch(() => {})

  const runPostTransitionInits = (
    container,
    { includeScrollRefresh = false, includeTransitionEvent = false } = {}
  ) => {
    // Priorité critique: hero de la home immédiatement.
    initHeroBackgroundParallax(container)
    if (isHomeNamespace(container)) {
      runAfterWindowLoad(() => {
        scheduleAfterHero(
          () =>
            runNonCriticalInits(container, {
              includeScrollRefresh,
              includeTransitionEvent,
            }),
          { timeout: 1800 }
        )
      })
      return
    }
    runNonCriticalInits(container, {
      includeScrollRefresh,
      includeTransitionEvent,
    })
  }

  barba.init({
    preventRunning: true,
    schema: { namespace: 'data-barba-namespace' },
    // Prevent Barba transitions on load more anchor links
    prevent: ({ el }) => {
      try {
        const anchor = el && el.closest ? el.closest('a.load-more') : null
        return !!anchor
      } catch (e) {
        return false
      }
    },
    transitions: [
      {
        name: 'next-scroll-and-reveal',
        sync: true,
        custom: ({ trigger }) => {
          try {
            if (!trigger) return false
            const match = trigger.closest ? trigger.closest('[pt-next]') : null
            return !!match
          } catch (err) {
            return false
          }
        },
        leave: (data) => {
          try {
            const current = data && data.current && data.current.container
            destroyIconsSafe(current || document)
          } catch (e) {
            /* ignore */
          }
          // Ensure page-info/mask behavior mirrors inner on pt-next clicks
          performPreInnerUI()
          try {
            const fromNs = getNamespaceFromContainer(
              data && data.current && data.current.container
            )
            const toNs = getNamespaceFromContainer(
              data && data.next && data.next.container
            )
            const from = fromNs || getCurrentLabel()
            const to = toNs || getLabelFromTrigger(data && data.trigger)
            setPageInfoLabels({ from, to })
            rememberFromLabel(from)
          } catch (e) {
            /* ignore */
          }
          return nextLeave(data)
        },
        enter: (data) => {
          try {
            const nextContainer = data && data.next && data.next.container
            const toNs = getNamespaceFromContainer(nextContainer)
            const to = toNs || getLabelFromNext(nextContainer)
            const fromStored = consumeFromLabel()
            const fromFallback = getNamespaceFromContainer(
              data && data.current && data.current.container
            )
            const from = fromStored || fromFallback || getCurrentLabel()
            setPageInfoLabels({ from, to })
          } catch (e) {
            /* ignore */
          }
          return nextEnter({ next: data && data.next })
        },
        after: ({ next }) => {
          // Re-initialize Finsweet Attributes (CMS Filter) after the new DOM is in place
          reinitFsAttributes()
          // Mark that the transition after hook handled re-inits to avoid duplicate work in global hook
          try {
            window.__barbaAfterHandled = true
          } catch (err) {
            // ignore
          }

          // Restore UI according to pre-click state for pt-next
          try {
            const flags = window.__ptInnerFlags || {}
            const navInner = document.querySelector('.nav-inner')
            const pageInfo = document.querySelector('.page-info')
            if (flags.wasNavVisible && navInner) {
              navInner.style.display = 'flex'
              // Keep pageInfo visible until transition ends
            }
            if (flags.forcedPageInfoFlex && pageInfo) {
              // Keep pageInfo visible until transition ends
            }
            window.__ptInnerFlags = undefined
          } catch (err) {
            // ignore
          }

          destroyLenis()
          initLenis(next && next.container)
          // Re-init Webflow first, then (re)bind nav handlers/animations
          reinitializeWebflowAnimations()
          // Reset service-card icons so they don't auto-play on viewport
          try {
            resetServiceCardIconsSafe(next && next.container)
          } catch (e) {
            /* ignore */
          }
          resetMenuLinksAnimationState(next && next.container)
          initializeNav2()
          ensureNavbarInteractive(next && next.container)
          runPostTransitionInits(next && next.container, {
            includeScrollRefresh: true,
            includeTransitionEvent: true,
          })
          // Ensure body background resets to primary after transition animation
          try {
            gsap.set(document.body, { backgroundColor: 'var(--primary)' })
          } catch (e) {
            /* ignore */
          }
        },
      },
      {
        name: 'slide-scale-history-inner',
        sync: true,
        custom: ({ trigger }) => {
          try {
            // Browser back/forward → Barba trigger is often null/undefined
            // Also honor explicit flag set on popstate
            return !trigger || window.__barbaHistoryNav === true
          } catch (err) {
            return false
          }
        },
        leave: (data) => {
          try {
            const current = data && data.current && data.current.container
            destroyIconsSafe(current || document)
          } catch (e) {
            /* ignore */
          }
          try {
            const current = data && data.current && data.current.container
            destroyIconsSafe(current || document)
          } catch (e) {
            /* ignore */
          }
          performPreInnerUI()
          const fromNs = getNamespaceFromContainer(
            data && data.current && data.current.container
          )
          const toNs = getNamespaceFromContainer(
            data && data.next && data.next.container
          )
          const from = fromNs || getCurrentLabel()
          const to = toNs || getCurrentLabel()
          rememberFromLabel(from)
          setPageInfoLabels({ from, to })
          return innerLeave(data)
        },
        enter: (data) => {
          try {
            const nextContainer = data && data.next && data.next.container
            const toNs = getNamespaceFromContainer(nextContainer)
            const to = toNs || getLabelFromNext(nextContainer)
            const fromStored = consumeFromLabel()
            const fromFallback = getNamespaceFromContainer(
              data && data.current && data.current.container
            )
            const from = fromStored || fromFallback || getCurrentLabel()
            setPageInfoLabels({ from, to })
          } catch (e) {
            /* ignore */
          }
          return innerEnter({ next: data && data.next })
        },
        after: ({ next }) => {
          // Re-initialize Finsweet Attributes (CMS Filter) after the new DOM is in place
          reinitFsAttributes()
          // Mark that the transition after hook handled re-inits to avoid duplicate work in global hook
          try {
            window.__barbaAfterHandled = true
          } catch (err) {
            // ignore
          }

          // Restore UI according to pre-click state for history nav (inner-like)
          try {
            const flags = window.__ptInnerFlags || {}
            const navInner = document.querySelector('.nav-inner')
            const pageInfo = document.querySelector('.page-info')
            if (flags && flags.wasNavVisible && navInner) {
              navInner.style.display = 'flex'
            }
            if (flags && flags.forcedPageInfoFlex && pageInfo) {
              // Keep pageInfo visible until transition ends
            }
            window.__ptInnerFlags = undefined
          } catch (err) {
            // ignore
          }

          destroyLenis()
          initLenis(next && next.container)
          // Re-init Webflow first, then (re)bind nav handlers/animations
          reinitializeWebflowAnimations()
          try {
            resetServiceCardIconsSafe(next && next.container)
          } catch (e) {
            /* ignore */
          }
          resetMenuLinksAnimationState(next && next.container)
          initializeNav2()
          ensureNavbarInteractive(next && next.container)
          runPostTransitionInits(next && next.container, {
            includeScrollRefresh: true,
          })
          try {
            window.__barbaHistoryNav = false
          } catch (e) {
            /* ignore */
          }
          // Notify components that rely on layout to recalc after transition
          try {
            window.dispatchEvent(new Event('page:transition:after'))
          } catch (e) {
            /* ignore */
          }
          // Ensure body background resets to primary after transition animation
          try {
            gsap.set(document.body, { backgroundColor: 'var(--primary)' })
          } catch (e) {
            /* ignore */
          }
        },
      },
      {
        name: 'slide-scale-inner',
        sync: true,
        custom: ({ trigger }) => {
          try {
            if (!trigger) return false
            const match = trigger.closest
              ? trigger.closest('[pt-inner], [data-pt-inner], #pt-inner')
              : null
            return !!match
          } catch (err) {
            return false
          }
        },
        leave: (data) => {
          try {
            const fromNs = getNamespaceFromContainer(
              data && data.current && data.current.container
            )
            const toNs = getNamespaceFromContainer(
              data && data.next && data.next.container
            )
            const from = fromNs || getCurrentLabel()
            const to = toNs || getLabelFromTrigger(data && data.trigger)
            setPageInfoLabels({ from, to })
            rememberFromLabel(from)
          } catch (e) {
            /* ignore */
          }
          return innerLeave(data)
        },
        enter: (data) => {
          try {
            const nextContainer = data && data.next && data.next.container
            const toNs = getNamespaceFromContainer(nextContainer)
            const to = toNs || getLabelFromNext(nextContainer)
            const fromStored = consumeFromLabel()
            const fromFallback = getNamespaceFromContainer(
              data && data.current && data.current.container
            )
            const from = fromStored || fromFallback || getCurrentLabel()
            setPageInfoLabels({ from, to })
          } catch (e) {
            /* ignore */
          }
          return innerEnter({ next: data && data.next })
        },
        after: ({ next }) => {
          // Re-initialize Finsweet Attributes (CMS Filter) after the new DOM is in place
          reinitFsAttributes()
          // Mark that the transition after hook handled re-inits to avoid duplicate work in global hook
          try {
            window.__barbaAfterHandled = true
          } catch (err) {
            // ignore
          }

          // Restore UI according to pre-click state for pt-inner
          try {
            const flags = window.__ptInnerFlags || {}
            const navInner = document.querySelector('.nav-inner')
            const pageInfo = document.querySelector('.page-info')
            if (flags.wasNavVisible && navInner) {
              navInner.style.display = 'flex'
              // Keep pageInfo visible until transition ends
            }
            if (flags.forcedPageInfoFlex && pageInfo) {
              // Keep pageInfo visible until transition ends
            }
            window.__ptInnerFlags = undefined
          } catch (err) {
            // ignore
          }

          destroyLenis()
          initLenis(next && next.container)
          // Re-init Webflow first, then (re)bind nav handlers/animations
          reinitializeWebflowAnimations()
          resetMenuLinksAnimationState(next && next.container)
          initializeNav2()
          ensureNavbarInteractive(next && next.container)
          // Ensure icons are reset and bound for inner transitions as well
          try {
            resetServiceCardIconsSafe(next && next.container)
          } catch (e) {
            /* ignore */
          }
          runPostTransitionInits(next && next.container)
          // Ensure body background resets to primary after transition animation
          try {
            gsap.set(document.body, { backgroundColor: 'var(--primary)' })
          } catch (e) {
            /* ignore */
          }
        },
      },
      {
        name: 'slide-scale',
        sync: true,
        leave: slideScaleLeave,
        enter: ({ next }) => slideScaleEnter({ next }),
        after: ({ next }) => {
          // Re-initialize Finsweet Attributes (CMS Filter) after the new DOM is in place
          reinitFsAttributes()
          // Mark that the transition after hook handled re-inits to avoid duplicate work in global hook
          try {
            window.__barbaAfterHandled = true
          } catch (err) {
            // ignore
          }

          destroyLenis()
          initLenis(next && next.container)
          // Re-init Webflow first, then (re)bind nav handlers/animations
          reinitializeWebflowAnimations()
          initializeNav2()
          // Ensure icons are reset and bound for generic slide-scale transitions too
          try {
            resetServiceCardIconsSafe(next && next.container)
          } catch (e) {
            /* ignore */
          }
          runPostTransitionInits(next && next.container, {
            includeScrollRefresh: true,
            includeTransitionEvent: true,
          })
        },
      },
    ],
  })

  // Ensure icon teardown on every transition
  barba.hooks.beforeLeave(({ current }) => {
    try {
      destroyIconsSafe(current && current.container)
    } catch (e) {
      /* ignore */
    }
  })

  // Global fallback for nav that bypasses custom transitions
  barba.hooks.after(({ next }) => {
    // If a transition-specific after ran, still ensure icons are ready
    if (window.__barbaAfterHandled) {
      window.__barbaAfterHandled = false
      try {
        resetServiceCardIconsSafe(next && next.container)
      } catch (e) {
        /* ignore */
      }
      try {
        initIconsSafe(next && next.container)
      } catch (e) {
        /* ignore */
      }
      // Also ensure nav animations re-init in this fast path
      try {
        resetMenuLinksAnimationState(next && next.container)
      } catch (e) {
        /* ignore */
      }
      try {
        initializeNav2()
      } catch (e) {
        /* ignore */
      }
      try {
        ensureNavbarInteractive(next && next.container)
      } catch (e) {
        /* ignore */
      }
      // Ensure body background resets to primary after handled transition
      try {
        gsap.set(document.body, { backgroundColor: 'var(--primary)' })
      } catch (e) {
        /* ignore */
      }
      return
    }
    // Global fallback: ensure Finsweet Attributes are reinitialized
    reinitFsAttributes()

    destroyLenis()
    initLenis(next && next.container)
    resetMenuLinksAnimationState(next && next.container)
    initializeNav2()
    ensureNavbarInteractive(next && next.container)
    // Reinitialize Webflow IX2/attributes before any custom init
    reinitializeWebflowAnimations()
    const nextContainer = next && next.container
    if (!isHomeNamespace(nextContainer)) {
      try {
        resetServiceCardIconsSafe(nextContainer)
      } catch (e) {
        /* ignore */
      }
    }
    runPostTransitionInits(nextContainer)
    // Ensure body background resets to primary after fallback transition
    try {
      gsap.set(document.body, { backgroundColor: 'var(--primary)' })
    } catch (e) {
      /* ignore */
    }
  })

  // Ensure immediate init after the new container is attached
  barba.hooks.afterEnter(({ next }) => {
    const container = next && next.container
    const isHome = isHomeNamespace(container)
    const runAfterEnterNonCritical = () =>
      loadDeferredInits()
        .then((m) => m.runAfterEnterNonCritical(container))
        .catch(() => {})

    // Ensure Webflow's Lottie registry is ready before binding icons
    try {
      const wf = typeof window !== 'undefined' ? window.Webflow : null
      const mod =
        wf && typeof wf.require === 'function' ? wf.require('lottie') : null
      const ready = mod && typeof mod.ready === 'function' ? mod.ready : null
      if (ready) ready()
    } catch (e) {
      /* ignore */
    }
    try {
      reinitializeWebflowAnimations()
    } catch (e) {
      /* ignore */
    }
    try {
      resetMenuLinksAnimationState(next && next.container)
      initializeNav2()
      ensureNavbarInteractive(next && next.container)
    } catch (e) {
      /* ignore */
    }
    if (isHome) {
      runAfterWindowLoad(() => {
        scheduleAfterHero(runAfterEnterNonCritical, { timeout: 1800 })
      })
      return
    }
    runAfterEnterNonCritical()
  })
}
