import barba from '@barba/core'

import { suppressHomeHeroVideo } from '../app/hero-media.js'
import {
  prepareIcons,
  resetServiceCardIcons,
  destroyIcons,
} from '../app/icons-runtime.js'
import {
  initAfterEnterModules,
  initContainerModules,
} from '../app/page-registry.js'
import { reinitializeWebflowAnimations } from '../utils/base.js'
import {
  captureHomeHeroLeaveTransform,
  destroyHomeSequenceForTransition,
  suspendHomeSequenceForLeave,
  prefetchHomeSequenceBinary,
  showHomeSequenceFirstFrame,
  startHomeSequenceAfterTransition,
} from './loader-af.js'
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

function isLocaleSwitcherLink(el) {
  try {
    const anchor =
      el && el.closest ? el.closest('a') : el && el.tagName === 'A' ? el : null
    if (!anchor) return false
    if (anchor.closest('.locale-switch')) return true
    if (anchor.classList.contains('navlink-locale')) {
      return !!(
        anchor.closest('.locales-list') || anchor.closest('.w-locales-list')
      )
    }
    return false
  } catch (e) {
    return false
  }
}

function resetPageWrapTransitionState(container) {
  const reset = () => {
    const pageWrap = container?.matches?.('.page-wrap')
      ? container
      : container?.querySelector?.('.page-wrap')

    if (!pageWrap?.style) return
    ;[
      'transform',
      'transform-origin',
      'scale',
      'top',
      'right',
      'bottom',
      'left',
      'border-radius',
      'will-change',
    ].forEach((property) => pageWrap.style.removeProperty(property))
  }

  try {
    reset()
    // Webflow and the clip transition can complete after Barba's `after`
    // hook. Clear their final inline values once layout has settled.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(reset)
    })
  } catch (e) {
    // The next container may already have been removed by Barba.
  }
}

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
  const setTransitionBackground = () => {}
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
  document.addEventListener(
    'click',
    (event) => {
      try {
        const anchor = event.target?.closest?.('a[href]')
        const current = document.querySelector(
          '[data-barba="container"][data-barba-namespace="home"]'
        )
        if (!anchor || !current || isLocaleSwitcherLink(anchor)) return
        captureHomeHeroLeaveTransform(current)
      } catch (e) {
        // ignore
      }
    },
    true
  )
  const performPreInnerUI = () => {
    try {
      setTransitionBackground('var(--accent)')
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
        setTransitionBackground('var(--accent)')
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

  const destroyContactIfNeeded = (container) => {
    try {
      const ns = (getNamespaceFromContainer(container) || '')
        .trim()
        .toLowerCase()
      if (ns !== 'contact') return
      import('./contact.js')
        .then(({ destroyContact }) => {
          try {
            if (typeof destroyContact === 'function') destroyContact(container)
          } catch (e) {
            // ignore
          }
        })
        .catch(() => {})
    } catch (e) {
      // ignore
    }
  }

  const scheduleAfterHero = (fn) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(fn, { timeout: 180 })
        } else {
          setTimeout(fn, 48)
        }
      })
    })
  }

  const guardHomeHeroVideo = (container) => {
    if (!isHomeNamespace(container)) return
    try {
      suppressHomeHeroVideo(container)
    } catch (e) {
      // ignore
    }
  }

  const reinitializeWebflowForPage = (container) => {
    guardHomeHeroVideo(container)
    reinitializeWebflowAnimations()
    guardHomeHeroVideo(container)
    requestAnimationFrame(() => {
      guardHomeHeroVideo(container)
    })
    window.setTimeout(() => {
      guardHomeHeroVideo(container)
    }, 0)
  }

  const runNonCriticalInits = (
    container,
    { includeScrollRefresh = false, includeTransitionEvent = false } = {}
  ) => {
    initContainerModules(container, {
      includeScrollRefresh,
      includeTransitionEvent,
      includeParallax: true,
      includeButtonHover: true,
    })
  }

  const runPostTransitionInits = (
    container,
    { includeScrollRefresh = false, includeTransitionEvent = false } = {}
  ) => {
    // Priorité critique: hero de la home immédiatement.
    initHeroBackgroundParallax(container)
    if (isHomeNamespace(container)) {
      try {
        suppressHomeHeroVideo(container)
      } catch (e) {
        // ignore
      }
      try {
        showHomeSequenceFirstFrame(container)
      } catch (e) {
        // ignore
      }
      startHomeSequenceAfterTransition(container)
      requestAnimationFrame(() => {
        try {
          suppressHomeHeroVideo(container)
        } catch (e) {
          // ignore
        }
      })
      scheduleAfterHero(() =>
        runNonCriticalInits(container, {
          includeScrollRefresh,
          includeTransitionEvent,
        })
      )
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
    // Prevent Barba on load-more and locale switcher (full page reload instead)
    prevent: ({ el }) => {
      try {
        const anchor = el && el.closest ? el.closest('a.load-more') : null
        if (anchor) return true
        return isLocaleSwitcherLink(el)
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
          const leaveTimeline = nextLeave(data)
          leaveTimeline.call(
            () => {
              try {
                const current = data && data.current && data.current.container
                destroyIcons(current || document)
              } catch (e) {
                /* ignore */
              }
            },
            [],
            'sync+=1.4'
          )
          return leaveTimeline
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

          resetPageWrapTransitionState(next && next.container)
          destroyLenis()
          initLenis(next && next.container)
          // Re-init Webflow first, then (re)bind nav handlers/animations
          reinitializeWebflowForPage(next && next.container)
          // Reset service-card icons so they don't auto-play on viewport
          try {
            resetServiceCardIcons(next && next.container)
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
          setTransitionBackground('var(--primary)', next && next.container)
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
            destroyIcons(current || document)
          } catch (e) {
            /* ignore */
          }
          try {
            const current = data && data.current && data.current.container
            destroyIcons(current || document)
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

          resetPageWrapTransitionState(next && next.container)
          destroyLenis()
          initLenis(next && next.container)
          // Re-init Webflow first, then (re)bind nav handlers/animations
          reinitializeWebflowForPage(next && next.container)
          try {
            resetServiceCardIcons(next && next.container)
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
          setTransitionBackground('var(--primary)', next && next.container)
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
          setTransitionBackground(
            'var(--accent)',
            data && data.current && data.current.container
          )
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

          resetPageWrapTransitionState(next && next.container)
          destroyLenis()
          initLenis(next && next.container)
          // Re-init Webflow first, then (re)bind nav handlers/animations
          reinitializeWebflowForPage(next && next.container)
          resetMenuLinksAnimationState(next && next.container)
          initializeNav2()
          ensureNavbarInteractive(next && next.container)
          // Ensure icons are reset and bound for inner transitions as well
          try {
            resetServiceCardIcons(next && next.container)
          } catch (e) {
            /* ignore */
          }
          runPostTransitionInits(next && next.container)
          setTransitionBackground('var(--primary)', next && next.container)
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

          resetPageWrapTransitionState(next && next.container)
          destroyLenis()
          initLenis(next && next.container)
          // Re-init Webflow first, then (re)bind nav handlers/animations
          reinitializeWebflowForPage(next && next.container)
          initializeNav2()
          // Ensure icons are reset and bound for generic slide-scale transitions too
          try {
            resetServiceCardIcons(next && next.container)
          } catch (e) {
            /* ignore */
          }
          runPostTransitionInits(next && next.container, {
            includeScrollRefresh: true,
            includeTransitionEvent: true,
          })
          setTransitionBackground('var(--primary)', next && next.container)
        },
      },
    ],
  })

  // Ensure icon teardown on every transition
  barba.hooks.beforeLeave(({ current, trigger }) => {
    setTransitionBackground('var(--accent)', current && current.container)
    try {
      const isNextTransition =
        trigger?.closest && trigger.closest('[pt-next]') !== null
      if (!isNextTransition) {
        destroyIcons(current && current.container)
      }
    } catch (e) {
      /* ignore */
    }
    try {
      ;(current && current.container
        ? current.container.querySelectorAll('[fc-image-scrubbing="component"]')
        : []
      ).forEach((component) => {
        if (typeof component.__mineralsCanvasCleanup === 'function') {
          component.__mineralsCanvasCleanup()
        }
      })
    } catch (e) {
      /* ignore */
    }
    try {
      if (typeof window.__mapMarkerSyncCleanup === 'function') {
        window.__mapMarkerSyncCleanup()
      }
      if (typeof window.__processProgressionCleanup === 'function') {
        window.__processProgressionCleanup()
      }
      if (typeof window.__textRevealCleanup === 'function') {
        window.__textRevealCleanup()
      }
    } catch (e) {
      /* ignore */
    }
    destroyContactIfNeeded(current && current.container)
  })

  // Prefetch AF binary before leave; neutralize Home video before it enters the DOM.
  barba.hooks.beforeLeave(({ current, next }) => {
    try {
      if (isHomeNamespace(current && current.container)) {
        suspendHomeSequenceForLeave()
      }
      const container = next && next.container
      if (!isHomeNamespace(container)) return
      prefetchHomeSequenceBinary()
      suppressHomeHeroVideo(container)
    } catch (e) {
      // ignore
    }
  })

  barba.hooks.beforeEnter(({ next }) => {
    try {
      const container = next && next.container
      if (!isHomeNamespace(container)) return
      suppressHomeHeroVideo(container)
      showHomeSequenceFirstFrame(container)
    } catch (e) {
      // ignore
    }
  })

  // Global fallback for nav that bypasses custom transitions
  barba.hooks.after(({ current, next }) => {
    try {
      if (isHomeNamespace(current && current.container)) {
        destroyHomeSequenceForTransition()
      }
    } catch (e) {
      // ignore
    }

    // If a transition-specific after ran, still ensure icons are ready
    if (window.__barbaAfterHandled) {
      window.__barbaAfterHandled = false
      try {
        resetServiceCardIcons(next && next.container)
      } catch (e) {
        /* ignore */
      }
      try {
        prepareIcons(next && next.container)
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
      setTransitionBackground('var(--primary)', next && next.container)
      return
    }
    // Global fallback: ensure Finsweet Attributes are reinitialized
    reinitFsAttributes()

    resetPageWrapTransitionState(next && next.container)
    destroyLenis()
    initLenis(next && next.container)
    resetMenuLinksAnimationState(next && next.container)
    initializeNav2()
    ensureNavbarInteractive(next && next.container)
    // Reinitialize Webflow IX2/attributes before any custom init
    reinitializeWebflowForPage(next && next.container)
    try {
      resetServiceCardIcons(next && next.container)
    } catch (e) {
      /* ignore */
    }
    runPostTransitionInits(next && next.container)
    setTransitionBackground('var(--primary)', next && next.container)
  })

  // Ensure immediate init after the new container is attached
  barba.hooks.afterEnter(({ next }) => {
    const container = next && next.container
    const isHome = isHomeNamespace(container)
    const runAfterEnterNonCritical = () => {
      try {
        requestAnimationFrame(() => {
          // If icons still not ready in this frame, queue one more microtask
          try {
            // Re-assert Lottie registry readiness just before (re)binding
            try {
              const wf = typeof window !== 'undefined' ? window.Webflow : null
              const mod =
                wf && typeof wf.require === 'function'
                  ? wf.require('lottie')
                  : null
              const ready =
                mod && typeof mod.ready === 'function' ? mod.ready : null
              if (ready) ready()
            } catch (e) {
              /* ignore */
            }
            resetServiceCardIcons(container)
          } catch (e) {
            /* ignore */
          }
          try {
            initAfterEnterModules(container)
          } catch (e) {
            /* ignore */
          }
          try {
            Promise.resolve().then(() => {
              try {
                try {
                  const wf =
                    typeof window !== 'undefined' ? window.Webflow : null
                  const mod =
                    wf && typeof wf.require === 'function'
                      ? wf.require('lottie')
                      : null
                  const ready =
                    mod && typeof mod.ready === 'function' ? mod.ready : null
                  if (ready) ready()
                } catch (e) {
                  /* ignore */
                }
                prepareIcons(container)
              } catch (e) {
                /* ignore */
              }
            })
          } catch (e) {
            /* ignore */
          }
        })
      } catch (e) {
        /* ignore */
      }
    }

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
      reinitializeWebflowForPage(next && next.container)
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
      try {
        showHomeSequenceFirstFrame(container)
        suppressHomeHeroVideo(container)
      } catch (e) {
        // ignore
      }
      scheduleAfterHero(runAfterEnterNonCritical)
      return
    }
    runAfterEnterNonCritical()
  })
}
