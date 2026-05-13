import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)

const INTERACTION_DURATION = 0.5
const INTERACTION_EASE = CustomEase.create(
  'button-hover-webflow-ease',
  'M0,0 C0.6,0 0,1 1,1'
)
const COLOR_PRIMARY = 'rgb(21, 21, 21)'
const COLOR_ACCENT = 'rgb(244, 121, 32)'
const COLOR_WHITE = 'rgb(255, 255, 255)'

const BUTTON_BOUND_ATTR = 'data-button-hover-bound'
const CARD_BOUND_ATTR = 'data-button-sm-hover-bound'
const NAVLINK_BOUND_ATTR = 'data-navlink-hover-bound'
const handlersByElement = new WeakMap()

const getButtonParts = (button) => {
  const content = button.querySelector('.button-inner_content')
  const label = button.querySelector('.button_label')
  return { content, label }
}

const isMainBreakpoint = () => {
  try {
    return window.matchMedia('(min-width: 992px)').matches
  } catch (e) {
    return true
  }
}

const clearButtonInlineState = ({ content, label, button }) => {
  if (content) gsap.set(content, { clearProps: 'transform' })
  if (label) gsap.set(label, { clearProps: 'color' })
  if (button) gsap.set(button, { clearProps: 'backgroundColor' })
}

const setBaseState = (button, { content, label }) => {
  if (!isMainBreakpoint()) {
    clearButtonInlineState({ content, label, button })
    return
  }

  if (content) gsap.set(content, { x: '0em' })

  if (button.classList.contains('button')) {
    gsap.set(button, { backgroundColor: COLOR_PRIMARY })
    if (label && !label.classList.contains('is-black')) {
      gsap.set(label, { color: COLOR_WHITE })
    }
    return
  }

  if (button.classList.contains('button-white')) {
    gsap.set(button, { backgroundColor: COLOR_WHITE })
  }
}

const animateHoverIn = (button, { content, label }) => {
  if (!isMainBreakpoint()) return

  if (content) {
    gsap.to(content, {
      x: '2.5em',
      duration: INTERACTION_DURATION,
      ease: INTERACTION_EASE,
      overwrite: 'auto',
    })
  }

  if (button.classList.contains('button')) {
    gsap.to(button, {
      backgroundColor: COLOR_ACCENT,
      duration: INTERACTION_DURATION,
      ease: INTERACTION_EASE,
      overwrite: 'auto',
    })

    if (label && !label.classList.contains('is-black')) {
      gsap.to(label, {
        color: COLOR_PRIMARY,
        duration: INTERACTION_DURATION,
        ease: INTERACTION_EASE,
        overwrite: 'auto',
      })
    }
    return
  }

  if (button.classList.contains('button-white')) {
    gsap.to(button, {
      backgroundColor: COLOR_ACCENT,
      duration: INTERACTION_DURATION,
      ease: INTERACTION_EASE,
      overwrite: 'auto',
    })
  }
}

const animateHoverOut = (button, { content, label }) => {
  if (!isMainBreakpoint()) {
    setBaseState(button, { content, label })
    return
  }

  if (content) {
    gsap.to(content, {
      x: '0em',
      duration: INTERACTION_DURATION,
      ease: INTERACTION_EASE,
      overwrite: 'auto',
    })
  }

  if (button.classList.contains('button')) {
    gsap.to(button, {
      backgroundColor: COLOR_PRIMARY,
      duration: INTERACTION_DURATION,
      ease: INTERACTION_EASE,
      overwrite: 'auto',
    })

    if (label && !label.classList.contains('is-black')) {
      gsap.to(label, {
        color: COLOR_WHITE,
        duration: INTERACTION_DURATION,
        ease: INTERACTION_EASE,
        overwrite: 'auto',
      })
    }
    return
  }

  if (button.classList.contains('button-white')) {
    gsap.to(button, {
      backgroundColor: COLOR_WHITE,
      duration: INTERACTION_DURATION,
      ease: INTERACTION_EASE,
      overwrite: 'auto',
    })
  }
}

const bindButton = (button) => {
  if (!(button instanceof HTMLElement)) return
  if (button.getAttribute(BUTTON_BOUND_ATTR) === 'true') return

  const parts = getButtonParts(button)
  if (!parts.content) return

  setBaseState(button, parts)

  const onPointerEnter = () => animateHoverIn(button, parts)
  const onPointerLeave = () => animateHoverOut(button, parts)
  const onFocus = () => animateHoverIn(button, parts)
  const onBlur = () => animateHoverOut(button, parts)

  button.addEventListener('pointerenter', onPointerEnter)
  button.addEventListener('pointerleave', onPointerLeave)
  button.addEventListener('focusin', onFocus)
  button.addEventListener('focusout', onBlur)

  button.setAttribute(BUTTON_BOUND_ATTR, 'true')
  handlersByElement.set(button, {
    onPointerEnter,
    onPointerLeave,
    onFocus,
    onBlur,
  })
}

const getButtonSmParts = (card) => ({
  inner: card.querySelector('.button-sm_inner'),
  buttonSm: card.querySelector('.button-sm'),
})

const setButtonSmBaseState = ({ inner, buttonSm }) => {
  if (!isMainBreakpoint()) {
    if (inner) gsap.set(inner, { clearProps: 'transform' })
    if (buttonSm) gsap.set(buttonSm, { clearProps: 'backgroundColor' })
    return
  }
  if (inner) gsap.set(inner, { x: '-0.75em' })
  if (buttonSm) gsap.set(buttonSm, { backgroundColor: COLOR_WHITE })
}

const animateButtonSmIn = ({ inner, buttonSm }) => {
  if (!isMainBreakpoint()) return
  if (inner) {
    gsap.to(inner, {
      x: '0.25em',
      duration: INTERACTION_DURATION,
      ease: INTERACTION_EASE,
      overwrite: 'auto',
    })
  }
  if (buttonSm) {
    gsap.to(buttonSm, {
      backgroundColor: COLOR_ACCENT,
      duration: INTERACTION_DURATION,
      ease: INTERACTION_EASE,
      overwrite: 'auto',
    })
  }
}

const animateButtonSmOut = ({ inner, buttonSm }) => {
  if (!isMainBreakpoint()) {
    setButtonSmBaseState({ inner, buttonSm })
    return
  }
  if (inner) {
    gsap.to(inner, {
      x: '-0.75em',
      duration: INTERACTION_DURATION,
      ease: INTERACTION_EASE,
      overwrite: 'auto',
    })
  }
  if (buttonSm) {
    gsap.to(buttonSm, {
      backgroundColor: COLOR_WHITE,
      duration: INTERACTION_DURATION,
      ease: INTERACTION_EASE,
      overwrite: 'auto',
    })
  }
}

const bindButtonSm = (card) => {
  if (!(card instanceof HTMLElement)) return
  if (card.getAttribute(CARD_BOUND_ATTR) === 'true') return

  const parts = getButtonSmParts(card)
  if (!parts.inner || !parts.buttonSm) return

  setButtonSmBaseState(parts)

  const onPointerEnter = () => animateButtonSmIn(parts)
  const onPointerLeave = () => animateButtonSmOut(parts)
  const onFocus = () => animateButtonSmIn(parts)
  const onBlur = () => animateButtonSmOut(parts)

  card.addEventListener('pointerenter', onPointerEnter)
  card.addEventListener('pointerleave', onPointerLeave)
  card.addEventListener('focusin', onFocus)
  card.addEventListener('focusout', onBlur)

  card.setAttribute(CARD_BOUND_ATTR, 'true')
  handlersByElement.set(card, {
    onPointerEnter,
    onPointerLeave,
    onFocus,
    onBlur,
  })
}

const setNavlinkBaseState = (link) => {
  if (!isMainBreakpoint()) {
    gsap.set(link, { clearProps: 'transform' })
    return
  }
  gsap.set(link, { x: '-3.6em' })
}

const animateNavlinkIn = (link) => {
  if (!isMainBreakpoint()) return
  gsap.to(link, {
    x: '0em',
    duration: INTERACTION_DURATION,
    ease: INTERACTION_EASE,
    overwrite: 'auto',
  })
}

const animateNavlinkOut = (link) => {
  if (!isMainBreakpoint()) {
    setNavlinkBaseState(link)
    return
  }
  gsap.to(link, {
    x: '-3.6em',
    duration: INTERACTION_DURATION,
    ease: INTERACTION_EASE,
    overwrite: 'auto',
  })
}

const bindNavlink = (link) => {
  if (!(link instanceof HTMLElement)) return
  if (link.getAttribute(NAVLINK_BOUND_ATTR) === 'true') return

  setNavlinkBaseState(link)

  const onPointerEnter = () => animateNavlinkIn(link)
  const onPointerLeave = () => animateNavlinkOut(link)
  const onFocus = () => animateNavlinkIn(link)
  const onBlur = () => animateNavlinkOut(link)

  link.addEventListener('pointerenter', onPointerEnter)
  link.addEventListener('pointerleave', onPointerLeave)
  link.addEventListener('focusin', onFocus)
  link.addEventListener('focusout', onBlur)

  link.setAttribute(NAVLINK_BOUND_ATTR, 'true')
  handlersByElement.set(link, {
    onPointerEnter,
    onPointerLeave,
    onFocus,
    onBlur,
  })
}

export function initButtonHover(root = document) {
  const scope = root && root.querySelectorAll ? root : document
  const buttons = scope.querySelectorAll('.button, .button-white')
  const cards = scope.querySelectorAll('.card')
  const navlinks = scope.querySelectorAll('.navlink')

  buttons.forEach(bindButton)
  cards.forEach(bindButtonSm)
  navlinks.forEach(bindNavlink)
}

export function destroyButtonHover(root = document) {
  const scope = root && root.querySelectorAll ? root : document
  const boundElements = scope.querySelectorAll(
    `[${BUTTON_BOUND_ATTR}="true"], [${CARD_BOUND_ATTR}="true"], [${NAVLINK_BOUND_ATTR}="true"]`
  )

  boundElements.forEach((element) => {
    const handlers = handlersByElement.get(element)
    if (handlers) {
      element.removeEventListener('pointerenter', handlers.onPointerEnter)
      element.removeEventListener('pointerleave', handlers.onPointerLeave)
      element.removeEventListener('focusin', handlers.onFocus)
      element.removeEventListener('focusout', handlers.onBlur)
      handlersByElement.delete(element)
    }
    element.removeAttribute(BUTTON_BOUND_ATTR)
    element.removeAttribute(CARD_BOUND_ATTR)
    element.removeAttribute(NAVLINK_BOUND_ATTR)
  })
}
