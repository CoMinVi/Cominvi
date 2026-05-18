import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)

const INTERACTION_DURATION = 0.5
const INTERACTION_EASE = CustomEase.create(
  'button-hover-webflow-ease',
  'M0,0 C0.6,0 0,1 1,1'
)
const COLOR_ACCENT = 'rgb(244, 121, 32)'
const COLOR_WHITE = 'rgb(255, 255, 255)'

const BUTTON_BOUND_ATTR = 'data-button-hover-bound'
const CARD_BOUND_ATTR = 'data-button-sm-hover-bound'
const NAVLINK_BOUND_ATTR = 'data-navlink-hover-bound'
const handlersByElement = new WeakMap()

const getButtonParts = (button) => {
  const content = button.querySelector(
    '.button-inner_content, .button-white_inner-content'
  )
  return { content }
}

const isMainBreakpoint = () => {
  try {
    return window.matchMedia('(min-width: 992px)').matches
  } catch (e) {
    return true
  }
}

const parseCssLengthPx = (value, contextElement) => {
  const normalized = String(value || '').trim()
  if (!normalized || normalized === 'normal') return 0

  const numeric = parseFloat(normalized)
  if (!Number.isFinite(numeric)) return 0

  if (normalized.endsWith('rem')) {
    const rootFontSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize
    )
    return numeric * (Number.isFinite(rootFontSize) ? rootFontSize : 16)
  }

  if (normalized.endsWith('em')) {
    const elementFontSize = parseFloat(
      getComputedStyle(contextElement).fontSize
    )
    return numeric * (Number.isFinite(elementFontSize) ? elementFontSize : 16)
  }

  return numeric
}

const getNavlinkClosedX = (link) => {
  try {
    const icon = link.querySelector('.navlink_icon')
    const iconWidth = icon ? icon.getBoundingClientRect().width : 0
    const styles = getComputedStyle(link)
    const gap = parseCssLengthPx(styles.columnGap || styles.gap, link)
    const offset = iconWidth + gap

    if (offset > 0) return -offset
  } catch (e) {
    // fall through to CSS-derived fallback
  }

  return '-2.3em'
}

const clearButtonInlineState = ({ content }) => {
  if (content) gsap.set(content, { clearProps: 'transform' })
}

const setBaseState = ({ content }) => {
  if (!isMainBreakpoint()) {
    clearButtonInlineState({ content })
    return
  }

  if (content) gsap.set(content, { x: '0em' })
}

const animateHoverIn = ({ content }) => {
  if (!isMainBreakpoint()) return

  if (content) {
    gsap.to(content, {
      x: '2.25em',
      duration: INTERACTION_DURATION,
      ease: INTERACTION_EASE,
      overwrite: 'auto',
    })
  }
}

const animateHoverOut = ({ content }) => {
  if (!isMainBreakpoint()) {
    setBaseState({ content })
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
}

const bindButton = (button) => {
  if (!(button instanceof HTMLElement)) return
  if (button.getAttribute(BUTTON_BOUND_ATTR) === 'true') return

  const parts = getButtonParts(button)
  if (!parts.content) return

  setBaseState(parts)

  const onPointerEnter = () => animateHoverIn(parts)
  const onPointerLeave = () => animateHoverOut(parts)
  const onMouseEnter = () => animateHoverIn(parts)
  const onMouseLeave = () => animateHoverOut(parts)
  const onFocus = () => animateHoverIn(parts)
  const onBlur = () => animateHoverOut(parts)

  button.addEventListener('pointerenter', onPointerEnter)
  button.addEventListener('pointerleave', onPointerLeave)
  button.addEventListener('mouseenter', onMouseEnter)
  button.addEventListener('mouseleave', onMouseLeave)
  button.addEventListener('focusin', onFocus)
  button.addEventListener('focusout', onBlur)

  button.setAttribute(BUTTON_BOUND_ATTR, 'true')
  handlersByElement.set(button, {
    onPointerEnter,
    onPointerLeave,
    onMouseEnter,
    onMouseLeave,
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
  const onMouseEnter = () => animateButtonSmIn(parts)
  const onMouseLeave = () => animateButtonSmOut(parts)
  const onFocus = () => animateButtonSmIn(parts)
  const onBlur = () => animateButtonSmOut(parts)

  card.addEventListener('pointerenter', onPointerEnter)
  card.addEventListener('pointerleave', onPointerLeave)
  card.addEventListener('mouseenter', onMouseEnter)
  card.addEventListener('mouseleave', onMouseLeave)
  card.addEventListener('focusin', onFocus)
  card.addEventListener('focusout', onBlur)

  card.setAttribute(CARD_BOUND_ATTR, 'true')
  handlersByElement.set(card, {
    onPointerEnter,
    onPointerLeave,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
  })
}

const setNavlinkBaseState = (link) => {
  if (!isMainBreakpoint()) {
    gsap.set(link, { clearProps: 'transform' })
    return
  }
  gsap.set(link, { x: getNavlinkClosedX(link) })
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
    x: getNavlinkClosedX(link),
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
  const onMouseEnter = () => animateNavlinkIn(link)
  const onMouseLeave = () => animateNavlinkOut(link)
  const onFocus = () => animateNavlinkIn(link)
  const onBlur = () => animateNavlinkOut(link)

  link.addEventListener('pointerenter', onPointerEnter)
  link.addEventListener('pointerleave', onPointerLeave)
  link.addEventListener('mouseenter', onMouseEnter)
  link.addEventListener('mouseleave', onMouseLeave)
  link.addEventListener('focusin', onFocus)
  link.addEventListener('focusout', onBlur)

  link.setAttribute(NAVLINK_BOUND_ATTR, 'true')
  handlersByElement.set(link, {
    onPointerEnter,
    onPointerLeave,
    onMouseEnter,
    onMouseLeave,
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
      element.removeEventListener('mouseenter', handlers.onMouseEnter)
      element.removeEventListener('mouseleave', handlers.onMouseLeave)
      element.removeEventListener('focusin', handlers.onFocus)
      element.removeEventListener('focusout', handlers.onBlur)
      handlersByElement.delete(element)
    }
    element.removeAttribute(BUTTON_BOUND_ATTR)
    element.removeAttribute(CARD_BOUND_ATTR)
    element.removeAttribute(NAVLINK_BOUND_ATTR)
  })
}
