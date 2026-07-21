import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import SplitType from 'split-type'

// Debounce utility for resize-driven recalculations
const debounce = (fn, wait = 150) => {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn.apply(null, args), wait)
  }
}

let __svcResizeBound = false
let __svcResizeHandler = null
let __svcMenuStateResetBound = false
let __svcMenuTransitionActive = false
let __svcMenuTransitionUnlockTimer = null
let __svcPageRefreshBound = false
let __svcViewportWidth = null

const getViewportWidth = () =>
  window.innerWidth || document.documentElement.clientWidth || 0

const isTabletOrBelowNow = () => {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 991px)').matches
    )
  } catch (e) {
    return false
  }
}

const isMenuOpenNow = () => {
  try {
    return document.documentElement.getAttribute('data-menu-open') === 'true'
  } catch (e) {
    return false
  }
}

const isServiceCardHovered = (card) => {
  try {
    return !!card.matches(':hover')
  } catch (e) {
    return false
  }
}

const initMachineCardImagesPreload = (root = document) => {
  if (!isTabletOrBelowNow() || typeof IntersectionObserver === 'undefined') {
    return
  }

  const section = root.querySelector('.section_technology')
  if (!section || section.__machineImagesPreloadObserver) return

  const images = Array.from(section.querySelectorAll('.machine-card img'))
  if (!images.length) return

  const preloadImages = () => {
    section.__machineImagesPreloadObserver?.disconnect()
    section.__machineImagesPreloadObserver = null

    images.forEach((image) => {
      if (image.dataset.machinePreloadState === 'ready') return
      image.loading = 'eager'
      image.decoding = 'async'
      image.dataset.machinePreloadState = 'loading'

      const markResult = () => {
        image.dataset.machinePreloadState =
          image.complete && image.naturalWidth > 0 ? 'ready' : 'error'
      }

      if (typeof image.decode === 'function') {
        image
          .decode()
          .then(markResult)
          .catch(() => {
            image.addEventListener('load', markResult, { once: true })
            image.addEventListener('error', markResult, { once: true })
          })
      } else if (image.complete) {
        markResult()
      } else {
        image.addEventListener('load', markResult, { once: true })
        image.addEventListener('error', markResult, { once: true })
      }
    })
  }

  const wrapper =
    section.closest('.page-wrap') ||
    document.querySelector('.page-wrap') ||
    null
  const preloadDistance = Math.max(1, Math.round(window.innerHeight * 3))
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) preloadImages()
    },
    {
      root: wrapper,
      rootMargin: `${preloadDistance}px 0px`,
      threshold: 0,
    }
  )

  section.__machineImagesPreloadObserver = observer
  observer.observe(section)
}

const SVC_EASING = 'cubic-bezier(0.5, 0, 0, 1)'
const SVC_DURATION = '0.8s'
const SVC_STAGGER_S = 0.03
const DESC_TRANSITION = `height ${SVC_DURATION} ${SVC_EASING}, opacity ${SVC_DURATION} ${SVC_EASING}`
const TITLE_TRANSITION = `transform ${SVC_DURATION} ${SVC_EASING}`

const setServiceCardDescClosed = (desc, { instant = false } = {}) => {
  if (!desc) return
  if (instant) desc.style.transition = 'none'
  else desc.style.transition = DESC_TRANSITION
  desc.style.height = '0'
  desc.style.maxHeight = ''
  desc.style.opacity = '0'
  desc.style.overflow = 'hidden'
  desc.style.pointerEvents = 'none'
  if (instant) {
    void desc.offsetHeight
    desc.style.transition = DESC_TRANSITION
  }
}

const setServiceCardDescOpen = (desc, heightPx, { instant = false } = {}) => {
  if (!desc) return
  const h = Math.max(0, Math.round(heightPx || 0))
  if (instant) desc.style.transition = 'none'
  else desc.style.transition = DESC_TRANSITION
  desc.style.height = `${h}px`
  desc.style.maxHeight = ''
  desc.style.opacity = h > 0 ? '1' : '0'
  desc.style.overflow = 'hidden'
  desc.style.pointerEvents = h > 0 ? '' : 'none'
  if (instant) {
    void desc.offsetHeight
    desc.style.transition = DESC_TRANSITION
  }
}

const getServiceTitleLiftPx = (desc, bloc) => {
  const contentH = desc?.__svcContentHeightPx || 0
  if (!contentH) return 0
  const gap =
    parseFloat(getComputedStyle(bloc).rowGap) ||
    parseFloat(getComputedStyle(bloc).gap) ||
    0
  return Math.round(contentH + gap)
}

const setServiceTitleLift = (bodyL, liftPx, { instant = false } = {}) => {
  if (!bodyL) return
  const lift = Math.max(0, Math.round(liftPx || 0))
  if (instant) bodyL.style.transition = 'none'
  else bodyL.style.transition = TITLE_TRANSITION
  bodyL.style.transform = lift > 0 ? `translateY(-${lift}px)` : ''
  if (instant) {
    void bodyL.offsetWidth
    bodyL.style.transition = TITLE_TRANSITION
  }
}

const measureServiceDescContentHeight = (desc, small) => {
  if (!desc) return 0
  const inners = small?.__lineInners || []
  const savedTransforms = inners.map((el) => el.style.transform)
  const savedTransition = desc.style.transition

  desc.style.transition = 'none'
  desc.style.height = 'auto'
  desc.style.maxHeight = 'none'
  desc.style.opacity = '1'
  desc.style.overflow = 'visible'
  desc.style.visibility = 'hidden'
  desc.style.pointerEvents = 'none'
  inners.forEach((el) => {
    el.style.transitionDelay = '0s'
    el.style.transform = 'translateY(0%)'
  })

  const height = Math.round(desc.scrollHeight)

  desc.style.visibility = ''
  desc.style.height = '0'
  desc.style.maxHeight = ''
  desc.style.opacity = '0'
  desc.style.overflow = 'hidden'
  desc.style.transition = savedTransition || DESC_TRANSITION
  inners.forEach((el, i) => {
    el.style.transform = savedTransforms[i] || 'translateY(100%)'
  })

  return height
}

const storeServiceDescContentHeight = (desc, small) => {
  if (!desc) return 0
  const height = measureServiceDescContentHeight(desc, small)
  desc.__svcContentHeightPx = height
  return height
}

const revealServiceCardBodySLines = (small) => {
  if (!small) return
  const inners = small.__lineInners || []
  inners.forEach((el, i) => {
    el.style.transitionDelay = `${i * SVC_STAGGER_S}s`
    el.style.transform = 'translateY(0%)'
  })
}

const hideServiceCardBodySLines = (
  small,
  { instant = false, reverse = false } = {}
) => {
  if (!small) return
  const inners = small.__lineInners || []
  const ordered = reverse ? inners.slice().reverse() : inners
  ordered.forEach((el, i) => {
    el.style.transitionDelay = instant ? '0s' : `${i * SVC_STAGGER_S}s`
    el.style.removeProperty('transform')
    el.style.transform = 'translateY(100%)'
  })
}

const openServiceCardDesktop = (
  card,
  bloc,
  desc,
  bodyL,
  small,
  { instant = false } = {}
) => {
  const contentH =
    desc.__svcContentHeightPx || storeServiceDescContentHeight(desc, small)
  const lift = getServiceTitleLiftPx(desc, bloc)
  setServiceCardDescOpen(desc, contentH, { instant })
  setServiceTitleLift(bodyL, lift, { instant })
  if (instant) hideServiceCardBodySLines(small, { instant: true })
  else revealServiceCardBodySLines(small)
}

const closeServiceCardDesktop = (
  card,
  bloc,
  desc,
  bodyL,
  small,
  { instant = false } = {}
) => {
  setServiceCardDescClosed(desc, { instant })
  hideServiceCardBodySLines(small, { instant, reverse: !instant })
  setServiceTitleLift(bodyL, 0, { instant })
}

const resetServiceCardDesktopLayout = (card, bloc, desc, bodyL) => {
  if (!card || !bloc || !desc) return
  bloc.style.transition = ''
  bloc.style.transform = ''
  if (bodyL) {
    bodyL.style.transition = ''
    bodyL.style.transform = ''
    bodyL.style.removeProperty('bottom')
    bodyL.style.removeProperty('position')
    bodyL.style.removeProperty('left')
    bodyL.style.removeProperty('right')
  }
  desc.style.height = ''
  desc.style.maxHeight = ''
  desc.style.opacity = ''
  desc.style.overflow = ''
  desc.style.pointerEvents = ''
  desc.style.transition = ''
  desc.style.removeProperty('position')
  desc.style.removeProperty('bottom')
  desc.style.removeProperty('left')
  desc.style.removeProperty('right')
  bloc.style.removeProperty('position')
  bloc.style.removeProperty('min-height')
}

const splitServiceCardBodyS = (small) => {
  if (!small) return []
  try {
    if (small.__splitLines && typeof small.__splitLines.revert === 'function') {
      small.__splitLines.revert()
      small.__splitLines = null
      small.__lines = null
      small.__lineInners = null
    }
    const split = new SplitType(small, {
      types: 'lines',
      tagName: 'span',
    })
    small.__splitLines = split
    small.__lines = split.lines || []
    const inners = []
    small.__lines.forEach((line) => {
      line.style.display = 'block'
      line.style.overflow = 'hidden'
      if (!line.__inner) {
        const inner = document.createElement('span')
        inner.className = 'line-inner'
        inner.style.display = 'inline-block'
        while (line.firstChild) inner.appendChild(line.firstChild)
        line.appendChild(inner)
        line.__inner = inner
      }
      inners.push(line.__inner)
    })
    inners.forEach((el) => {
      el.style.transform = 'translateY(100%)'
      el.style.willChange = 'transform'
      el.style.transition = `transform ${SVC_DURATION} ${SVC_EASING}`
    })
    small.__lineInners = inners
    return inners
  } catch (e) {
    return []
  }
}

const ensureServiceCardBodySSplit = (small, { force = false } = {}) => {
  if (!small) return []
  if (
    !force &&
    small.__lineInners?.length &&
    small.__splitLines &&
    small.__lines?.length
  ) {
    return small.__lineInners
  }
  return splitServiceCardBodyS(small)
}

const applyServiceCardDesktopClosedState = (card, bloc, desc) => {
  const small = desc.querySelector('.body-s')
  const bodyL = bloc.querySelector('.body-l')
  ensureServiceCardBodySSplit(small)
  storeServiceDescContentHeight(desc, small)

  if (!isServiceCardHovered(card)) {
    card.classList.remove('is-svc-hover')
    closeServiceCardDesktop(card, bloc, desc, bodyL, small, { instant: true })
    card.style.removeProperty('background-color')
    card.style.backgroundColor = 'var(--white)'
  }
}

export function refreshServiceCards(root = document) {
  if (isTabletOrBelowNow() || isMenuOpenNow()) return

  const scope = root && root.querySelector ? root : document
  scope.querySelectorAll('.service-card').forEach((card) => {
    const desc = card.querySelector('.desc')
    const bloc = card.querySelector('.card-inner') || desc
    if (!desc || !bloc) return
    const isPending = card.classList.contains('is-card-reveal-pending')
    if (
      isPending &&
      typeof desc.__svcContentHeightPx === 'number' &&
      desc.__svcContentHeightPx > 0
    ) {
      return
    }
    applyServiceCardDesktopClosedState(card, bloc, desc)
  })
}

const scheduleServiceCardsRefresh = (root = document) => {
  const run = () => {
    try {
      refreshServiceCards(root)
    } catch (e) {
      // ignore
    }
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(run)
  })
  try {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(run).catch(() => {})
    }
  } catch (e) {
    // ignore
  }
}

const bindServiceCardsPageRefresh = () => {
  if (__svcPageRefreshBound) return
  __svcPageRefreshBound = true
  window.addEventListener('page:transition:after', () => {
    requestAnimationFrame(() => refreshServiceCards(document))
  })
  document.addEventListener(
    'loader:done',
    () => {
      scheduleServiceCardsRefresh(document)
    },
    { once: true }
  )
}

// Ensure the same custom ease as Technology
if (!gsap.parseEase('machinesStep')) {
  try {
    CustomEase.create('machinesStep', 'M0,0 C0.6,0 0,1 1,1')
  } catch (e) {
    // ignore
  }
}
export function initServiceCards(root = document) {
  const scope = root && root.querySelector ? root : document
  initMachineCardImagesPreload(scope)
  const cards = scope.querySelectorAll('.service-card')
  const resetServiceCardsHoverState = (targetScope = scope) => {
    const target =
      targetScope && targetScope.querySelector ? targetScope : document
    const allCards = target.querySelectorAll('.service-card')
    const menuIsOpen = isMenuOpenNow()
    allCards.forEach((card) => {
      const desc = card.querySelector('.desc')
      const bloc = card.querySelector('.card-inner') || desc
      if (!desc || !bloc) return

      try {
        const bodyL = bloc.querySelector('.body-l')
        const small = desc.querySelector('.body-s')
        closeServiceCardDesktop(card, bloc, desc, bodyL, small, {
          instant: true,
        })
        if (menuIsOpen) {
          if (bodyL) {
            bodyL.style.setProperty('transform', 'translateY(0)', 'important')
          }
          desc.style.setProperty('height', '0', 'important')
          desc.style.setProperty('opacity', '0', 'important')
        }

        const smallNodes = Array.from(desc.querySelectorAll('.body-s'))
        smallNodes.forEach((small) => {
          const inners = small.__lineInners || []
          inners.forEach((el) => {
            el.style.transitionDelay = '0s'
            if (menuIsOpen) {
              el.style.setProperty('transform', 'translateY(100%)', 'important')
            } else {
              el.style.removeProperty('transform')
              el.style.transform = 'translateY(100%)'
            }
          })
        })

        if (menuIsOpen) {
          card.style.setProperty(
            'background-color',
            'var(--white)',
            'important'
          )
          card.style.setProperty('pointer-events', 'none', 'important')
        } else {
          card.style.removeProperty('background-color')
          card.style.removeProperty('pointer-events')
          card.style.backgroundColor = 'var(--white)'
        }

        card.classList.remove('is-svc-hover')
        if (!isTabletOrBelowNow()) {
          closeServiceCardDesktop(card, bloc, desc, bodyL, small, {
            instant: true,
          })
        }
      } catch (e) {
        // ignore
      }
    })
  }
  const setServiceCardsMenuInteractivity = (
    isInteractive,
    targetScope = scope
  ) => {
    const target =
      targetScope && targetScope.querySelector ? targetScope : document
    const allCards = target.querySelectorAll('.service-card')
    allCards.forEach((card) => {
      try {
        card.style.pointerEvents = isInteractive ? '' : 'none'
      } catch (e) {
        // ignore
      }
    })
  }
  cards.forEach((card) => {
    if (card.__serviceCardsBound) return
    const desc = card.querySelector('.desc')
    const bloc = card.querySelector('.card-inner') || desc
    if (!desc || !bloc) return

    // Detect tablet/mobile viewport
    let isTabletOrBelow = false
    try {
      isTabletOrBelow =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(max-width: 991px)').matches
    } catch (e) {
      isTabletOrBelow = false
    }

    // Set initial reveal state (no flicker on arrival)
    try {
      if (!isTabletOrBelow) {
        applyServiceCardDesktopClosedState(card, bloc, desc)
      } else {
        resetServiceCardDesktopLayout(
          card,
          bloc,
          desc,
          bloc.querySelector('.body-l')
        )
        const smallNodes = Array.from(desc.querySelectorAll('.body-s'))
        smallNodes.forEach((small) => {
          try {
            if (
              small.__splitLines &&
              typeof small.__splitLines.revert === 'function'
            ) {
              small.__splitLines.revert()
              small.__splitLines = null
              small.__lines = null
              small.__lineInners = null
            }
          } catch (e) {
            // ignore
          }
        })
      }
      // Prepare background-color transition on the card itself
      const existing = card.style.transition?.trim()
      card.style.transition = existing
        ? `${existing}, background-color 0.8s cubic-bezier(0.5, 0, 0, 1)`
        : 'background-color 0.8s cubic-bezier(0.5, 0, 0, 1)'
      // Ensure initial bg is white
      if (!card.style.backgroundColor) {
        card.style.backgroundColor = 'var(--white)'
      }
    } catch (err) {
      // ignore
    }
    if (!isTabletOrBelow) {
      const small = desc.querySelector('.body-s')
      const bodyL = bloc.querySelector('.body-l')
      const onHoverEnter = () => {
        if (isTabletOrBelowNow() || isMenuOpenNow() || card.__svcHoverActive)
          return
        card.__svcHoverActive = true
        card.classList.add('is-svc-hover')
        openServiceCardDesktop(card, bloc, desc, bodyL, small)
        card.style.backgroundColor = 'var(--accent)'
      }
      const onHoverLeave = () => {
        if (isTabletOrBelowNow()) return
        card.__svcHoverActive = false
        card.classList.remove('is-svc-hover')
        closeServiceCardDesktop(card, bloc, desc, bodyL, small)
        card.style.backgroundColor = 'var(--white)'
      }

      card.addEventListener('mouseenter', onHoverEnter)
      card.addEventListener('mouseleave', onHoverLeave)
      card.addEventListener('pointerenter', onHoverEnter)
      card.addEventListener('pointerleave', onHoverLeave)

      // Icons hover logic moved to service-icons.js
    }

    card.__serviceCardsBound = true
  })
  // Team card icon behaviors moved to service-icons.js

  // Apply same reveal behavior to technology machine cards
  const machineCards = Array.from(scope.querySelectorAll('.machine-card'))

  const ensureMachineCardBg = (card) => {
    if (card.__machineCardBg !== undefined) return card.__machineCardBg
    const bg = card.querySelector('.machine-card_bg') || null
    if (bg && !bg.style.transition) {
      bg.style.transition = 'opacity 0.4s cubic-bezier(0.5, 0, 0, 1)'
    }
    card.__machineCardBg = bg
    return bg
  }

  const dimOtherMachineCardBgs = (activeCard) => {
    machineCards.forEach((otherCard) => {
      if (otherCard === activeCard) return
      const bg = ensureMachineCardBg(otherCard)
      if (bg) {
        bg.style.opacity = '0.4'
      }
    })
  }

  const resetMachineCardBgs = () => {
    machineCards.forEach((card) => {
      const bg = ensureMachineCardBg(card)
      if (bg) {
        bg.style.opacity = '1'
      }
    })
  }

  const focusMachineCardBg = (card) => {
    const bg = ensureMachineCardBg(card)
    if (bg) {
      bg.style.opacity = '1'
    }
    dimOtherMachineCardBgs(card)
  }

  const resetMachineBgsIfIdle = () => {
    const hasHoveringCard =
      !isTabletOrBelowNow() && scope.querySelector('.machine-card:hover')
    if (hasHoveringCard) return
    if (scope.querySelector('.machine-card.is-open')) return
    resetMachineCardBgs()
  }

  machineCards.forEach((card) => {
    if (card.__machineCardsBound) return
    const bloc = card.querySelector('.machine-card_inner')
    if (!bloc) return

    // Find the primary text element inside the bloc
    const textEl = bloc.querySelector('p, .body-s, .body-m, .body-l') || bloc

    // Desktop-only hover content: avoid creating hidden line layers on touch devices.
    if (!isTabletOrBelowNow()) {
      try {
        if (!textEl.__splitLines) {
          const split = new SplitType(textEl, {
            types: 'lines',
            tagName: 'span',
          })
          textEl.__splitLines = split
          textEl.__lines = split.lines || []
        }
        const lines = textEl.__lines || []
        const inners = []
        lines.forEach((line) => {
          // Ensure outer line wrapper constrains overflow
          line.style.display = 'block'
          line.style.overflow = 'hidden'
          if (!line.__inner) {
            const inner = document.createElement('span')
            inner.className = 'line-inner'
            inner.style.display = 'inline-block'
            // Move existing children into inner once
            while (line.firstChild) inner.appendChild(line.firstChild)
            line.appendChild(inner)
            line.__inner = inner
          }
          inners.push(line.__inner)
        })
        // Initial state: lines hidden below
        inners.forEach((el) => {
          el.style.transform = 'translateY(100%)'
          el.style.willChange = 'transform'
          el.style.transition = 'transform 0.4s ease'
        })
        bloc.__lineInners = inners
      } catch (err) {
        // ignore
      }
    }

    const STAGGER_S = 0.03
    const revealLines = () => {
      const inners = bloc.__lineInners || []
      inners.forEach((el, i) => {
        el.style.transitionDelay = `${i * STAGGER_S}s`
        el.style.transform = 'translateY(0)'
      })
    }
    const hideLines = () => {
      const inners = bloc.__lineInners || []
      // reverse for a slightly nicer closing effect
      inners
        .slice()
        .reverse()
        .forEach((el, i) => {
          el.style.transitionDelay = `${i * STAGGER_S}s`
          el.style.transform = 'translateY(100%)'
        })
    }

    card.addEventListener('mouseenter', () => {
      if (isTabletOrBelowNow() || isMenuOpenNow()) return
      revealLines()
      focusMachineCardBg(card)
    })
    card.addEventListener('mouseleave', () => {
      if (isTabletOrBelowNow()) return
      hideLines()
      resetMachineBgsIfIdle()
    })
    // Pointer events for broader support
    card.addEventListener('pointerenter', () => {
      if (isTabletOrBelowNow() || isMenuOpenNow()) return
      revealLines()
      focusMachineCardBg(card)
    })
    card.addEventListener('pointerleave', () => {
      if (isTabletOrBelowNow()) return
      hideLines()
      resetMachineBgsIfIdle()
    })

    card.__machineCardsBound = true
  })

  // Also bind the hover → viewer image logic
  serviceCardsHover(scope)

  // Debounced resize recalculation for service and machine cards
  const recalcOnResize = () => {
    try {
      if (__svcMenuTransitionActive) return
      const allCards = scope.querySelectorAll('.service-card')
      allCards.forEach((card) => {
        const desc = card.querySelector('.desc')
        const bloc = card.querySelector('.card-inner') || desc
        if (!desc || !bloc) return

        if (isTabletOrBelowNow()) {
          resetServiceCardDesktopLayout(
            card,
            bloc,
            desc,
            bloc.querySelector('.body-l')
          )
          const smallNodes = Array.from(desc.querySelectorAll('.body-s'))
          smallNodes.forEach((small) => {
            try {
              if (
                small.__splitLines &&
                typeof small.__splitLines.revert === 'function'
              ) {
                small.__splitLines.revert()
                small.__splitLines = null
                small.__lines = null
                small.__lineInners = null
              }
            } catch (e) {
              // ignore
            }
          })
          return
        }

        const small = desc.querySelector('.body-s')
        const bodyL = bloc.querySelector('.body-l')
        const shouldRemainOpen =
          card.classList.contains('is-svc-hover') && isServiceCardHovered(card)

        // SplitType only determines visual lines when it is instantiated. Rebuild
        // them at each desktop width change, including for the currently hovered
        // card, so a line wrapper cannot contain several visual lines.
        ensureServiceCardBodySSplit(small, { force: true })
        storeServiceDescContentHeight(desc, small)

        if (shouldRemainOpen) {
          openServiceCardDesktop(card, bloc, desc, bodyL, small, {
            instant: true,
          })
        } else {
          applyServiceCardDesktopClosedState(card, bloc, desc)
        }
      })

      const machineCards = scope.querySelectorAll('.machine-card')
      machineCards.forEach((card) => {
        const bloc = card.querySelector('.machine-card_inner')
        if (!bloc) {
          return
        }

        const textEl =
          bloc.querySelector('p, .body-s, .body-m, .body-l') || bloc

        if (isTabletOrBelowNow()) {
          try {
            if (
              textEl.__splitLines &&
              typeof textEl.__splitLines.revert === 'function'
            ) {
              textEl.__splitLines.revert()
            }
          } catch (e) {
            // ignore
          }
          textEl.__splitLines = null
          textEl.__lines = null
          bloc.__lineInners = null
          if (typeof card.__ensureMachineMobileState === 'function') {
            card.__ensureMachineMobileState()
          }
          return
        }

        try {
          if (
            textEl.__splitLines &&
            typeof textEl.__splitLines.revert === 'function'
          ) {
            textEl.__splitLines.revert()
            textEl.__splitLines = null
            textEl.__lines = null
          }
          const split = new SplitType(textEl, {
            types: 'lines',
            tagName: 'span',
          })
          textEl.__splitLines = split
          textEl.__lines = split.lines || []
          const inners = []
          textEl.__lines.forEach((line) => {
            line.style.display = 'block'
            line.style.overflow = 'hidden'
            if (!line.__inner) {
              const inner = document.createElement('span')
              inner.className = 'line-inner'
              inner.style.display = 'inline-block'
              while (line.firstChild) inner.appendChild(line.firstChild)
              line.appendChild(inner)
              line.__inner = inner
            }
            inners.push(line.__inner)
          })
          inners.forEach((el) => {
            el.style.transform = 'translateY(100%)'
            el.style.willChange = 'transform'
            el.style.transition = 'transform 0.4s ease'
          })
          bloc.__lineInners = inners
        } catch (e) {
          // ignore
        }
        if (typeof card.__ensureMachineMobileState === 'function') {
          card.__ensureMachineMobileState()
        }
      })

      // Refresh viewer bindings/state according to viewport
      serviceCardsHover(scope)
    } catch (e) {
      // ignore
    }
  }

  if (!__svcResizeBound) {
    __svcViewportWidth = getViewportWidth()
    __svcResizeHandler = debounce(() => {
      const nextWidth = getViewportWidth()
      if (nextWidth === __svcViewportWidth) return
      __svcViewportWidth = nextWidth
      recalcOnResize()
    }, 150)
    window.addEventListener('resize', __svcResizeHandler)
    __svcResizeBound = true
  }

  if (!__svcMenuStateResetBound) {
    const onMenuOpenStart = () => {
      __svcMenuTransitionActive = true
      if (__svcMenuTransitionUnlockTimer) {
        clearTimeout(__svcMenuTransitionUnlockTimer)
        __svcMenuTransitionUnlockTimer = null
      }
      setServiceCardsMenuInteractivity(false, document)
      resetServiceCardsHoverState(document)
      requestAnimationFrame(() => {
        resetServiceCardsHoverState(document)
      })
    }
    const onMenuCloseEnd = () => {
      __svcMenuTransitionActive = true
      if (__svcMenuTransitionUnlockTimer) {
        clearTimeout(__svcMenuTransitionUnlockTimer)
        __svcMenuTransitionUnlockTimer = null
      }
      setServiceCardsMenuInteractivity(true, document)
      resetServiceCardsHoverState(document)
      requestAnimationFrame(() => {
        resetServiceCardsHoverState(document)
      })
      __svcMenuTransitionUnlockTimer = setTimeout(() => {
        __svcMenuTransitionActive = false
      }, 500)
    }
    document.addEventListener('menu:open-start', onMenuOpenStart)
    document.addEventListener('menu:close-end', onMenuCloseEnd)
    __svcMenuStateResetBound = true
  }

  // Mobile & Tablet: click a .machine-card to expand its .machine-bottom-wrap to reveal content
  const isTabletOrBelowViewport = () => {
    try {
      return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(max-width: 991px)').matches
      )
    } catch (e) {
      return false
    }
  }

  const machineCardsForToggle = scope.querySelectorAll('.machine-card')
  machineCardsForToggle.forEach((card) => {
    if (card.__machineMobileBound) return
    const bottomWrap = card.querySelector('.machine-bottom-wrap')
    const labelRow = bottomWrap && bottomWrap.querySelector('.machines_label')
    if (!bottomWrap || !labelRow) {
      card.__machineMobileBound = true
      return
    }

    const getCollapsedHeightPx = () => {
      try {
        const rect = labelRow.getBoundingClientRect()
        return Math.max(0, Math.round(rect.height)) || 24
      } catch (e) {
        return 24
      }
    }

    const toggleButtons = (isOpen) => {
      try {
        const btnWrap = bottomWrap.querySelector('.machine_button-wrap')
        const btns = btnWrap
          ? btnWrap.querySelectorAll('.machine_button, .machines_button')
          : []
        if (btns && btns.length) {
          gsap.to(btns, {
            yPercent: isOpen ? -100 : 0,
            duration: 1.2,
            ease: gsap.parseEase('machinesStep') || ((t) => t),
          })
        }
        const closePlus = btnWrap
          ? btnWrap.querySelector('.machines_button.is-close > .is-plus')
          : null
        if (closePlus) {
          gsap.to(closePlus, {
            rotate: isOpen ? 135 : 0,
            duration: 1.2,
            ease: gsap.parseEase('machinesStep') || ((t) => t),
          })
        }
      } catch (e) {
        // ignore
      }
    }

    const ensureMobileState = () => {
      const isMobile = isTabletOrBelowViewport()
      if (!isMobile) {
        // Reset inline styles on desktop
        bottomWrap.style.transition = ''
        bottomWrap.style.height = ''
        bottomWrap.style.willChange = ''
        card.classList.remove('is-open')
        toggleButtons(false)
        return
      }
      bottomWrap.style.overflow = 'hidden'
      // Do not set CSS transition; GSAP will handle animations
      if (card.classList.contains('is-open')) {
        // Maintain natural height when already open
        bottomWrap.style.height = 'auto'
        toggleButtons(true)
      } else {
        bottomWrap.style.height = getCollapsedHeightPx() + 'px'
        toggleButtons(false)
      }
    }

    // No CSS transitionend handler needed when animating via GSAP

    const openCard = () => {
      const collapsed = getCollapsedHeightPx()
      const target = bottomWrap.scrollHeight
      if (bottomWrap.style.height === 'auto') {
        bottomWrap.style.height = bottomWrap.scrollHeight + 'px'
      }
      bottomWrap.style.height = collapsed + 'px'
      card.classList.add('is-open')
      gsap.to(bottomWrap, {
        height: target,
        duration: 1.2,
        ease: gsap.parseEase('machinesStep') || ((t) => t),
        onComplete: () => {
          if (!card.__contentObserver) {
            const contentObserver = new ResizeObserver(() => {
              if (card.classList.contains('is-open')) {
                bottomWrap.style.height = bottomWrap.scrollHeight + 'px'
              }
            })
            const innerContent = bottomWrap.querySelector(
              '.machine-card_inner, .machine-desc'
            )
            if (innerContent) {
              contentObserver.observe(innerContent)
            }
            card.__contentObserver = contentObserver
          }
        },
      })
      toggleButtons(true)
    }

    const closeCard = () => {
      const collapsed = getCollapsedHeightPx()
      const currentAuto = bottomWrap.style.height === 'auto'
      if (currentAuto) {
        bottomWrap.style.height = bottomWrap.scrollHeight + 'px'
      }
      card.classList.remove('is-open')
      resetMachineBgsIfIdle()
      gsap.to(bottomWrap, {
        height: collapsed,
        duration: 1.2,
        ease: gsap.parseEase('machinesStep') || ((t) => t),
        onComplete: () => {
          resetMachineBgsIfIdle()
        },
      })
      toggleButtons(false)
    }

    card.__closeMachineCard = closeCard

    const onClick = () => {
      if (!isTabletOrBelowViewport()) return
      const isOpen = card.classList.contains('is-open')
      if (!isOpen) {
        machineCardsForToggle.forEach((otherCard) => {
          if (
            otherCard !== card &&
            otherCard.classList.contains('is-open') &&
            typeof otherCard.__closeMachineCard === 'function'
          ) {
            otherCard.__closeMachineCard()
          }
        })
        openCard()
      } else {
        closeCard()
      }
    }

    if (!card.__machineMobileClickBound) {
      card.addEventListener('click', onClick)
      card.__machineMobileClickBound = true
    }

    card.__ensureMachineMobileState = ensureMobileState
    ensureMobileState()
    card.__machineMobileBound = true
  })

  bindServiceCardsPageRefresh()
  scheduleServiceCardsRefresh(scope)
}

// Reset all Lottie icons inside service/team cards to frame 0 after transitions
// Icon reset moved to service-icons.js

export function serviceCardsHover(root = document) {
  const scope = root && root.querySelector ? root : document
  // Support both class names: .service-viewer and .services-viewer (per HTML)
  let viewer = scope.querySelector('.service-viewer, .services-viewer')
  if (!viewer && scope !== document) {
    // Barba/Webflow can momentarily place/rebuild the viewer outside the scoped root.
    // Fall back to the document to keep hover-image bindings alive after transitions.
    viewer = document.querySelector('.service-viewer, .services-viewer')
  }
  if (!viewer) {
    if (
      !scope.__svcViewerWaitObserver &&
      typeof MutationObserver !== 'undefined'
    ) {
      const waitObserver = new MutationObserver(() => {
        try {
          const maybeViewer =
            scope.querySelector &&
            scope.querySelector('.service-viewer, .services-viewer')
              ? scope.querySelector('.service-viewer, .services-viewer')
              : document.querySelector('.service-viewer, .services-viewer')
          const maybeCard = scope.querySelector
            ? scope.querySelector('.service-card')
            : null
          if (maybeViewer && maybeCard) {
            waitObserver.disconnect()
            scope.__svcViewerWaitObserver = null
            serviceCardsHover(scope)
          }
        } catch (e) {
          // ignore
        }
      })
      waitObserver.observe(scope, { childList: true, subtree: true })
      scope.__svcViewerWaitObserver = waitObserver
    }
    return
  }

  // Allow re-invocation for base state refresh; keep from double-binding with flags below
  // if (viewer.__serviceViewerBound) return

  // Detect tablet/mobile viewport (local helper)
  const isTabletOrBelowNow = () => {
    try {
      return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(max-width: 991px)').matches
      )
    } catch (e) {
      return false
    }
  }
  const isMenuOpenNow = () => {
    try {
      return document.documentElement.getAttribute('data-menu-open') === 'true'
    } catch (e) {
      return false
    }
  }

  const images = Array.from(viewer.querySelectorAll('.service-image'))
  const OPACITY_EASING = 'cubic-bezier(0.5, 0, 0, 1)'
  const viewerButton = viewer.querySelector('.button')
  // Ensure base state
  images.forEach((img) => {
    img.style.transition = `opacity 0.8s ${OPACITY_EASING}`
    if (!img.style.position) {
      // don't force; assume CSS sets absolute if already configured
    }
    img.style.opacity = '0'
    img.style.zIndex = '0'
    img.style.display = 'none'
    if (!img.__svcOpacityBound) {
      img.addEventListener('transitionend', (e) => {
        if (e.propertyName !== 'opacity') return
        const style = window.getComputedStyle(img)
        if (parseFloat(style.opacity || '0') === 0) {
          img.style.display = 'none'
          img.style.zIndex = '0'
        }
      })
      img.__svcOpacityBound = true
    }
  })

  // Button initial state: visible when no image is shown
  if (viewerButton) {
    viewerButton.style.transition = `opacity 0.8s ${OPACITY_EASING}`
    viewerButton.style.opacity = '1'
    viewerButton.style.display = 'block'
  }

  // Section variant .section_services.is-2 can disable hover in some contexts.
  // On the dedicated Services page, keep the same hover behavior as Home.
  const containerNamespace = (() => {
    try {
      const container =
        scope &&
        scope.getAttribute &&
        scope.getAttribute('data-barba') === 'container'
          ? scope
          : scope.querySelector &&
            scope.querySelector('[data-barba="container"]')
      return (
        (container &&
          container.getAttribute &&
          container.getAttribute('data-barba-namespace')) ||
        ''
      )
        .trim()
        .toLowerCase()
    } catch (e) {
      return ''
    }
  })()
  const disableHoverForThisViewer = !!(
    viewer.closest &&
    viewer.closest('.section_services.is-2') &&
    containerNamespace !== 'services'
  )
  if (disableHoverForThisViewer) {
    const fixedImage = viewer.querySelector('.service-image.is-4')
    // Ensure current state respects the rule: .service-image.is-4 must not be display:none
    if (fixedImage) {
      fixedImage.style.display = 'block'
      fixedImage.style.opacity = '1'
      fixedImage.style.zIndex = '2'
    }
    if (!viewer.__svcViewerNoHoverResizeBound) {
      const onResize = debounce(() => {
        images.forEach((img) => {
          img.style.transition = `opacity 0.8s ${OPACITY_EASING}`
          if (fixedImage && img === fixedImage) {
            img.style.display = 'block'
            img.style.opacity = '1'
            img.style.zIndex = '2'
          } else {
            img.style.opacity = '0'
            img.style.zIndex = '0'
            img.style.display = 'none'
          }
        })
        if (viewerButton) {
          viewerButton.style.display = 'block'
          viewerButton.style.opacity = '1'
        }
      }, 150)
      window.addEventListener('resize', onResize)
      viewer.__svcViewerNoHoverResizeBound = true
    }
    viewer.__serviceViewerBound = true
    return
  }

  // Button initial state handled above; if mobile, don't bind hover handlers
  if (isTabletOrBelowNow()) {
    if (!viewer.__svcViewerResizeBound) {
      const onResize = debounce(() => {
        // Re-apply base state when viewport crosses breakpoints
        images.forEach((img) => {
          img.style.transition = `opacity 0.8s ${OPACITY_EASING}`
          img.style.opacity = '0'
          img.style.zIndex = '0'
          img.style.display = 'none'
        })
        if (viewerButton) {
          viewerButton.style.display = 'block'
          viewerButton.style.opacity = '1'
        }
      }, 150)
      window.addEventListener('resize', onResize)
      viewer.__svcViewerResizeBound = true
    }
    viewer.__serviceViewerBound = true
    return
  }
  const cards = Array.from(scope.querySelectorAll('.service-card'))
  const forceHoverRebind = !!scope.__svcViewerForceRebind
  scope.__svcViewerForceRebind = false

  if (
    !scope.__svcViewerRebindObserver &&
    typeof MutationObserver !== 'undefined'
  ) {
    const rebindHover = debounce(() => {
      try {
        serviceCardsHover(scope)
      } catch (e) {
        // ignore
      }
    }, 80)
    const rebindObserver = new MutationObserver((mutations) => {
      try {
        const shouldRebind = mutations.some((mutation) => {
          if (!mutation.addedNodes || !mutation.addedNodes.length) return false
          return Array.from(mutation.addedNodes).some((node) => {
            if (!(node instanceof Element)) return false
            if (
              node.matches &&
              node.matches(
                '.service-card, .service-image, .service-viewer, .services-viewer'
              )
            ) {
              return true
            }
            return !!node.querySelector(
              '.service-card, .service-image, .service-viewer, .services-viewer'
            )
          })
        })
        if (shouldRebind) {
          scope.__svcViewerForceRebind = true
          rebindHover()
        }
      } catch (e) {
        // ignore
      }
    })
    rebindObserver.observe(scope, { childList: true, subtree: true })
    scope.__svcViewerRebindObserver = rebindObserver
  }

  const showImageByIndex = (index) => {
    if (isTabletOrBelowNow() || isMenuOpenNow()) return
    images.forEach((img, i) => {
      if (i === index) {
        img.style.display = 'block'
        void img.offsetWidth
        img.style.transition = `opacity 0.5s ${OPACITY_EASING}`
        img.style.opacity = '1'
        img.style.zIndex = '2'
      } else {
        img.style.transition = `opacity 0.5s ${OPACITY_EASING}`
        img.style.opacity = '0'
        img.style.zIndex = '0'
      }
    })
    if (viewerButton) {
      // Cancel any pending transitionend handler from a previous hide
      if (viewerButton.__onOpacityEnd) {
        try {
          viewerButton.removeEventListener(
            'transitionend',
            viewerButton.__onOpacityEnd
          )
        } catch (err) {
          // ignore
        }
        viewerButton.__onOpacityEnd = null
      }
      viewerButton.style.transition = `opacity 0.5s ${OPACITY_EASING}`
      viewerButton.style.opacity = '0'
      // hide on transition end for accessibility
      const onEnd = (e) => {
        if (e.propertyName !== 'opacity') return
        // Only hide if the button is still supposed to be hidden now
        const style = window.getComputedStyle(viewerButton)
        if (parseFloat(style.opacity || '0') === 0) {
          viewerButton.style.display = 'none'
        }
        viewerButton.removeEventListener('transitionend', onEnd)
        viewerButton.__onOpacityEnd = null
      }
      viewerButton.addEventListener('transitionend', onEnd)
      viewerButton.__onOpacityEnd = onEnd
    }
  }

  const hideImageByIndex = (index) => {
    if (isTabletOrBelowNow()) return
    const img = images[index]
    if (!img) return
    img.style.transition = `opacity 0.5s ${OPACITY_EASING}`
    img.style.opacity = '0'
    img.style.zIndex = '0'
  }

  const removeViewerBindings = (card) => {
    try {
      const handlers = card.__serviceViewerHandlers
      if (!handlers) return
      if (handlers.mouseenter)
        card.removeEventListener('mouseenter', handlers.mouseenter)
      if (handlers.mouseleave)
        card.removeEventListener('mouseleave', handlers.mouseleave)
      if (handlers.pointerenter)
        card.removeEventListener('pointerenter', handlers.pointerenter)
      if (handlers.pointerleave)
        card.removeEventListener('pointerleave', handlers.pointerleave)
      if (handlers.focus) card.removeEventListener('focus', handlers.focus)
      if (handlers.blur) card.removeEventListener('blur', handlers.blur)
    } catch (e) {
      // ignore
    } finally {
      card.__serviceViewerHandlers = null
      card.__serviceViewerHoverBound = false
      card.__serviceViewerBoundTo = null
    }
  }

  cards.forEach((card, idx) => {
    // Map card order (0-based) → .service-image.is-(idx+1)
    const target = viewer.querySelector(`.service-image.is-${idx + 1}`)
    if (!target) {
      removeViewerBindings(card)
      return
    }

    const indexInImages = images.indexOf(target)
    if (indexInImages === -1) {
      removeViewerBindings(card)
      return
    }

    const alreadyBoundToCurrentViewer =
      card.__serviceViewerHoverBound &&
      card.__serviceViewerBoundTo === viewer &&
      card.__serviceViewerBoundIndex === indexInImages
    if (alreadyBoundToCurrentViewer && !forceHoverRebind) return

    removeViewerBindings(card)

    const onEnter = () => {
      if (isTabletOrBelowNow() || isMenuOpenNow()) return
      showImageByIndex(indexInImages)
      if (viewerButton) {
        viewerButton.style.opacity = '0'
      }
    }
    const onLeave = () => {
      if (isTabletOrBelowNow()) return
      hideImageByIndex(indexInImages)
      // Show button only if no card is hovered anymore
      if (viewerButton && !scope.querySelector('.service-card:hover')) {
        // Cancel any pending hide handler
        if (viewerButton.__onOpacityEnd) {
          try {
            viewerButton.removeEventListener(
              'transitionend',
              viewerButton.__onOpacityEnd
            )
          } catch (err) {
            // ignore
          }
          viewerButton.__onOpacityEnd = null
        }
        viewerButton.style.display = 'block'
        void viewerButton.offsetWidth
        viewerButton.style.opacity = '1'
      }
    }
    const onPointerEnter = () => {
      if (isTabletOrBelowNow() || isMenuOpenNow()) return
      showImageByIndex(indexInImages)
      if (viewerButton) {
        viewerButton.style.opacity = '0'
      }
    }
    const onPointerLeave = () => {
      if (isTabletOrBelowNow()) return
      hideImageByIndex(indexInImages)
      if (viewerButton && !scope.querySelector('.service-card:hover')) {
        if (viewerButton.__onOpacityEnd) {
          try {
            viewerButton.removeEventListener(
              'transitionend',
              viewerButton.__onOpacityEnd
            )
          } catch (err) {
            // ignore
          }
          viewerButton.__onOpacityEnd = null
        }
        viewerButton.style.display = 'block'
        void viewerButton.offsetWidth
        viewerButton.style.opacity = '1'
      }
    }
    const onFocus = () => {
      if (isTabletOrBelowNow() || isMenuOpenNow()) return
      showImageByIndex(indexInImages)
      if (viewerButton) {
        viewerButton.style.opacity = '0'
      }
    }
    const onBlur = () => {
      if (isTabletOrBelowNow()) return
      hideImageByIndex(indexInImages)
      if (viewerButton && !scope.querySelector('.service-card:hover')) {
        if (viewerButton.__onOpacityEnd) {
          try {
            viewerButton.removeEventListener(
              'transitionend',
              viewerButton.__onOpacityEnd
            )
          } catch (err) {
            // ignore
          }
          viewerButton.__onOpacityEnd = null
        }
        viewerButton.style.display = 'block'
        void viewerButton.offsetWidth
        viewerButton.style.opacity = '1'
      }
    }

    card.addEventListener('mouseenter', onEnter)
    card.addEventListener('mouseleave', onLeave)
    card.addEventListener('pointerenter', onPointerEnter)
    card.addEventListener('pointerleave', onPointerLeave)
    card.addEventListener('focus', onFocus)
    card.addEventListener('blur', onBlur)
    card.__serviceViewerHandlers = {
      mouseenter: onEnter,
      mouseleave: onLeave,
      pointerenter: onPointerEnter,
      pointerleave: onPointerLeave,
      focus: onFocus,
      blur: onBlur,
    }
    card.__serviceViewerHoverBound = true
    card.__serviceViewerBoundTo = viewer
    card.__serviceViewerBoundIndex = indexInImages
  })

  viewer.__serviceViewerBound = true
}
