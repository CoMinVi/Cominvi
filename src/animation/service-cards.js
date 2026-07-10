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

const measureServiceBodyLOffset = (card, bloc, bodyL) => {
  if (
    card.classList.contains('is-card-reveal-pending') &&
    typeof bodyL.__svcBottomOffsetPx === 'number' &&
    bodyL.__svcBottomOffsetPx > 0
  ) {
    return bodyL.__svcBottomOffsetPx
  }

  bodyL.style.transform = ''
  const cardRect = card.getBoundingClientRect()
  const bodyLRect = bodyL.getBoundingClientRect()
  const padBottom = parseFloat(getComputedStyle(card).paddingBottom) || 0
  const measured = Math.max(
    0,
    Math.round(cardRect.bottom - padBottom - bodyLRect.bottom)
  )
  const previous =
    typeof bodyL.__svcBottomOffsetPx === 'number'
      ? bodyL.__svcBottomOffsetPx
      : 0
  const distanceToBottom = measured > 0 ? measured : previous
  bodyL.__svcBottomOffsetPx = distanceToBottom
  card.style.setProperty('--svc-bodyl-offset', `${distanceToBottom}px`)
  return distanceToBottom
}

const setServiceCardBodyLClosed = (bodyL, offset, { instant = false } = {}) => {
  if (!bodyL) return
  const easing = 'transform 0.8s cubic-bezier(0.5, 0, 0, 1)'
  if (instant) {
    bodyL.style.transition = 'none'
    bodyL.style.transform = `translateY(${offset}px)`
    void bodyL.offsetWidth
    bodyL.style.transition = easing
    return
  }
  bodyL.style.transition = easing
  bodyL.style.transform = `translateY(${offset}px)`
}

const hideServiceCardBodySLines = (small, { instant = false } = {}) => {
  if (!small) return
  const inners = small.__lineInners || []
  inners.forEach((el, i) => {
    el.style.transitionDelay = instant ? '0s' : `${i * 0.03}s`
    el.style.removeProperty('transform')
    el.style.transform = 'translateY(100%)'
  })
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
      el.style.transition = 'transform 0.8s cubic-bezier(0.5, 0, 0, 1)'
    })
    small.__lineInners = inners
    return inners
  } catch (e) {
    return []
  }
}

const applyServiceCardDesktopClosedState = (
  card,
  bloc,
  desc,
  { instant = false } = {}
) => {
  const small = desc.querySelector('.body-s')
  splitServiceCardBodyS(small)

  const bodyL = bloc.querySelector('.body-l')
  if (bodyL) {
    const previousOffset =
      typeof bodyL.__svcBottomOffsetPx === 'number'
        ? bodyL.__svcBottomOffsetPx
        : 0
    const measuredOffset = measureServiceBodyLOffset(card, bloc, bodyL)
    const distanceToBottom =
      __svcMenuTransitionActive && measuredOffset === 0 && previousOffset > 0
        ? previousOffset
        : measuredOffset
    bodyL.__svcBottomOffsetPx = distanceToBottom
    card.style.setProperty('--svc-bodyl-offset', `${distanceToBottom}px`)
    if (!isServiceCardHovered(card)) {
      setServiceCardBodyLClosed(bodyL, distanceToBottom, { instant })
    }
  }

  if (!isServiceCardHovered(card)) {
    hideServiceCardBodySLines(small, { instant })
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
    const bodyL = bloc.querySelector('.body-l')
    const isPending = card.classList.contains('is-card-reveal-pending')
    if (
      isPending &&
      bodyL &&
      typeof bodyL.__svcBottomOffsetPx === 'number' &&
      bodyL.__svcBottomOffsetPx > 0
    ) {
      return
    }
    applyServiceCardDesktopClosedState(card, bloc, desc, { instant: true })
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
  const cards = scope.querySelectorAll('.service-card')
  const updateServiceCardBaseState = (card) => {
    const desc = card.querySelector('.desc')
    const bloc = card.querySelector('.card-inner') || desc
    if (!desc || !bloc) return
    const isTablet = isTabletOrBelowNow()
    try {
      if (!isTablet) {
        applyServiceCardDesktopClosedState(card, bloc, desc, {
          instant: !isServiceCardHovered(card),
        })
      } else {
        // Mobile/tablet: reset transforms
        bloc.style.transition = ''
        bloc.style.transform = ''
        bloc.style.willChange = ''
        const bodyL = bloc.querySelector('.body-l')
        if (bodyL) {
          bodyL.style.transition = ''
          bodyL.style.transform = ''
        }
        const small = desc.querySelector('.body-s')
        if (small) {
          // Revert split if present
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
        }
      }
      const existing = card.style.transition?.trim()
      card.style.transition = existing
        ? `${existing}, background-color 0.8s cubic-bezier(0.5, 0, 0, 1)`
        : 'background-color 0.8s cubic-bezier(0.5, 0, 0, 1)'
      if (!card.style.backgroundColor) {
        card.style.backgroundColor = 'var(--white)'
      }
    } catch (e) {
      // ignore
    }
  }
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
        if (bodyL) {
          const previousOffset =
            typeof bodyL.__svcBottomOffsetPx === 'number'
              ? bodyL.__svcBottomOffsetPx
              : 0
          let back = measureServiceBodyLOffset(card, bloc, bodyL)
          if (__svcMenuTransitionActive && back === 0 && previousOffset > 0) {
            back = previousOffset
            bodyL.__svcBottomOffsetPx = back
            card.style.setProperty('--svc-bodyl-offset', `${back}px`)
          }
          bodyL.style.transition = 'transform 0.8s cubic-bezier(0.5, 0, 0, 1)'
          if (menuIsOpen) {
            bodyL.style.setProperty(
              'transform',
              `translateY(${back}px)`,
              'important'
            )
          } else {
            bodyL.style.removeProperty('transform')
            bodyL.style.transform = `translateY(${back}px)`
          }
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
        applyServiceCardDesktopClosedState(card, bloc, desc, { instant: true })
      } else {
        // On tablet/mobile: reset transforms and revert splits
        bloc.style.transition = ''
        bloc.style.transform = ''
        bloc.style.willChange = ''
        const bodyL = bloc.querySelector('.body-l')
        if (bodyL) {
          bodyL.style.transition = ''
          bodyL.style.transform = ''
        }
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
      const STAGGER_S = 0.03
      const animateSmallLines = (to) => {
        if (!small || !small.__lineInners) return
        small.__lineInners.forEach((el, i) => {
          el.style.transitionDelay = `${i * STAGGER_S}s`
          el.style.transform = `translateY(${to})`
        })
      }
      const moveBodyL = (toPx) => {
        if (!bodyL) return
        bodyL.style.transition = 'transform 0.8s cubic-bezier(0.5, 0, 0, 1)'
        bodyL.style.transform = `translateY(${toPx}px)`
      }
      const onHoverEnter = () => {
        if (isTabletOrBelowNow() || isMenuOpenNow() || card.__svcHoverActive)
          return
        card.__svcHoverActive = true
        moveBodyL(0)
        animateSmallLines('0%')
        card.style.backgroundColor = 'var(--accent)'
      }
      const onHoverLeave = () => {
        if (isTabletOrBelowNow()) return
        card.__svcHoverActive = false
        let back = 0
        if (bodyL && typeof bodyL.__svcBottomOffsetPx === 'number') {
          back = bodyL.__svcBottomOffsetPx
        }
        moveBodyL(back)
        animateSmallLines('100%')
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

    // Split text into visual lines (using SplitType) and prepare wrappers
    try {
      if (!textEl.__splitLines) {
        const split = new SplitType(textEl, { types: 'lines', tagName: 'span' })
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
        if (!isServiceCardHovered(card)) {
          const desc = card.querySelector('.desc')
          const bloc = card.querySelector('.card-inner') || desc
          const bodyL = bloc && bloc.querySelector('.body-l')
          const small = desc && desc.querySelector('.body-s')
          if (bodyL && bloc) {
            const offset = measureServiceBodyLOffset(card, bloc, bodyL)
            setServiceCardBodyLClosed(bodyL, offset, { instant: true })
          }
          hideServiceCardBodySLines(small, { instant: true })
          card.style.backgroundColor = 'var(--white)'
        }
      })
      allCards.forEach((c) => updateServiceCardBaseState(c))
      // Recompute .body-l bottom offsets and rebuild .body-s splits for desktop
      allCards.forEach((card) => {
        const desc = card.querySelector('.desc')
        const bloc = card.querySelector('.card-inner') || desc
        if (!desc || !bloc) return
        if (isTabletOrBelowNow()) {
          const bodyL = bloc.querySelector('.body-l')
          if (bodyL) {
            bodyL.style.transition = ''
            bodyL.style.transform = ''
          }
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
        const bodyL = bloc.querySelector('.body-l')
        if (bodyL) {
          bodyL.style.transform = ''
          const blocRect = bloc.getBoundingClientRect()
          const bodyLRect = bodyL.getBoundingClientRect()
          const offsetWithinBloc = bodyLRect.bottom - blocRect.bottom
          const distanceToBottom = Math.max(0, Math.round(-offsetWithinBloc))
          bodyL.__svcBottomOffsetPx = distanceToBottom
          card.style.setProperty('--svc-bodyl-offset', `${distanceToBottom}px`)
          bodyL.style.transition = 'none'
          bodyL.style.transform = `translateY(${distanceToBottom}px)`
          void bodyL.offsetWidth
          bodyL.style.transition = 'transform 0.5s ease'
        }
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
              el.style.transition = 'transform 0.4s ease'
            })
            small.__lineInners = inners
          } catch (e) {
            // ignore
          }
        })
      })

      const machineCards = scope.querySelectorAll('.machine-card')
      machineCards.forEach((card) => {
        const bloc = card.querySelector('.machine-card_inner')
        if (!bloc) {
          return
        }

        const textEl =
          bloc.querySelector('p, .body-s, .body-m, .body-l') || bloc

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
      })

      // Refresh viewer bindings/state according to viewport
      serviceCardsHover(scope)
    } catch (e) {
      // ignore
    }
  }

  if (!__svcResizeBound) {
    __svcResizeHandler = debounce(recalcOnResize, 150)
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
      focusMachineCardBg(card)
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

    const onResize = () => ensureMobileState()
    if (!card.__machineMobileResizeBound) {
      window.addEventListener('resize', onResize)
      card.__machineMobileResizeBound = true
    }

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
