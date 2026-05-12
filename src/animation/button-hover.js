import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)

const INTERACTION_DURATION = 0.5
const INTERACTION_EASE = CustomEase.create(
  'button-hover-webflow-ease',
  'M0,0 C0.6,0 0,1 1,1'
)

const BOUND_ATTR = 'data-button-hover-bound'
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

const setBaseState = (button, { content, label }) => {
  if (content) gsap.set(content, { x: '0em' })

  if (button.classList.contains('button')) {
    gsap.set(button, { backgroundColor: 'var(--primary)' })
    if (label && !label.classList.contains('is-black')) {
      gsap.set(label, { color: 'var(--white)' })
    }
    return
  }

  if (button.classList.contains('button-white')) {
    gsap.set(button, { backgroundColor: 'var(--white)' })
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
      backgroundColor: 'var(--accent)',
      duration: INTERACTION_DURATION,
      ease: INTERACTION_EASE,
      overwrite: 'auto',
    })

    if (label && !label.classList.contains('is-black')) {
      gsap.to(label, {
        color: 'var(--primary)',
        duration: INTERACTION_DURATION,
        ease: INTERACTION_EASE,
        overwrite: 'auto',
      })
    }
    return
  }

  if (button.classList.contains('button-white')) {
    gsap.to(button, {
      backgroundColor: 'var(--accent)',
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
      backgroundColor: 'var(--primary)',
      duration: INTERACTION_DURATION,
      ease: INTERACTION_EASE,
      overwrite: 'auto',
    })

    if (label && !label.classList.contains('is-black')) {
      gsap.to(label, {
        color: 'var(--white)',
        duration: INTERACTION_DURATION,
        ease: INTERACTION_EASE,
        overwrite: 'auto',
      })
    }
    return
  }

  if (button.classList.contains('button-white')) {
    gsap.to(button, {
      backgroundColor: 'var(--white)',
      duration: INTERACTION_DURATION,
      ease: INTERACTION_EASE,
      overwrite: 'auto',
    })
  }
}

const bindButton = (button) => {
  if (!(button instanceof HTMLElement)) return
  if (button.getAttribute(BOUND_ATTR) === 'true') return

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

  button.setAttribute(BOUND_ATTR, 'true')
  handlersByElement.set(button, {
    onPointerEnter,
    onPointerLeave,
    onFocus,
    onBlur,
  })
}

export function initButtonHover(root = document) {
  const scope = root && root.querySelectorAll ? root : document
  const buttons = scope.querySelectorAll('.button, .button-white')
  buttons.forEach(bindButton)
}

export function destroyButtonHover(root = document) {
  const scope = root && root.querySelectorAll ? root : document
  const buttons = scope.querySelectorAll(`[${BOUND_ATTR}="true"]`)

  buttons.forEach((button) => {
    const handlers = handlersByElement.get(button)
    if (handlers) {
      button.removeEventListener('pointerenter', handlers.onPointerEnter)
      button.removeEventListener('pointerleave', handlers.onPointerLeave)
      button.removeEventListener('focusin', handlers.onFocus)
      button.removeEventListener('focusout', handlers.onBlur)
      handlersByElement.delete(button)
    }
    button.removeAttribute(BOUND_ATTR)
  })
}
