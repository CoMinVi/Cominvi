let iconsModule = null
let iconsModulePromise = null

const ICON_CARD_SELECTOR = '.service-card, .team-card, .stats-card, .stat-card'
const ICON_PREPARED_ATTR = 'data-lottie-lazy-prepared'
const ICON_PLACEHOLDER_ATTR = 'data-lottie-placeholder-ready'
const ICON_WARMUP_ROOT_MARGIN = '900px 0px'
const ICON_SECTION_WARMUP_ROOT_MARGIN = '1200px 0px'
const ICON_SECTION_SELECTOR =
  '.section_about, .section_services, .section_work-team, .section_teams'
const ICON_SELECTOR =
  '.service-card .service-icon_icon, .team-card .service-icon_icon, .stats-card .service-icon_icon, .stat-card .service-icon_icon'

function getScope(root = document) {
  return root && root.querySelector ? root : document
}

function getIconTargets(root = document) {
  try {
    const scope = getScope(root)
    return Array.from(scope.querySelectorAll(ICON_SELECTOR))
  } catch (e) {
    return []
  }
}

function getIconCard(icon) {
  try {
    return icon.closest(ICON_CARD_SELECTOR) || icon
  } catch (e) {
    return icon
  }
}

function prepareIconPlaceholder(icon) {
  try {
    if (!icon || icon.getAttribute(ICON_PLACEHOLDER_ATTR) === 'true') return
    icon.setAttribute(ICON_PLACEHOLDER_ATTR, 'true')
    icon.setAttribute('aria-hidden', 'true')

    if (icon.innerHTML.trim()) {
      icon.__lottieLazyPlaceholderHTML = icon.innerHTML
    }

    icon.style.visibility = 'visible'
    icon.style.opacity = '1'
    if (!icon.style.display) icon.style.display = 'block'
  } catch (e) {
    // keep the existing visual state
  }
}

function prepareIconPlaceholders(root = document) {
  const icons = getIconTargets(root)
  icons.forEach(prepareIconPlaceholder)
  return icons
}

export function hasIconTargets(root = document) {
  try {
    const scope = getScope(root)
    return !!(
      scope &&
      scope.querySelector &&
      scope.querySelector(ICON_SELECTOR)
    )
  } catch (e) {
    return false
  }
}

export function preloadIcons() {
  if (iconsModule) return Promise.resolve(iconsModule)
  if (!iconsModulePromise) {
    iconsModulePromise = import('../animation/service-icons.js').then((mod) => {
      iconsModule = mod
      return mod
    })
  }
  return iconsModulePromise
}

function loadIconsFor(root, reason, icon = null) {
  return preloadIcons()
    .then((mod) => {
      try {
        if (typeof mod.initIcons === 'function') {
          mod.initIcons(root, { reason, icon })
        }
      } catch (e) {
        // keep placeholders visible
      }
      return mod
    })
    .catch(() => null)
}

function attachIntersectionWarmup(root, icons) {
  if (typeof IntersectionObserver === 'undefined') return false
  try {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const icon = entry.target
          observer.unobserve(icon)
          loadIconsFor(root, 'intersection', icon)
        })
      },
      {
        root: null,
        rootMargin: ICON_WARMUP_ROOT_MARGIN,
        threshold: 0.01,
      }
    )

    icons.forEach((icon) => {
      if (icon.__lottieLazyIntersectionObserver) return
      observer.observe(icon)
      icon.__lottieLazyIntersectionObserver = observer
    })
    return true
  } catch (e) {
    return false
  }
}

function attachSectionWarmup(root, icons) {
  if (typeof IntersectionObserver === 'undefined') return false
  try {
    const scope = getScope(root)
    const sections = Array.from(scope.querySelectorAll(ICON_SECTION_SELECTOR))
      .map((section) => ({
        section,
        icons: icons.filter((icon) => section.contains(icon)),
      }))
      .filter((item) => item.icons.length)

    if (!sections.length) return false

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const section = entry.target
          observer.unobserve(section)
          const item = sections.find(
            (candidate) => candidate.section === section
          )
          if (!item) return
          item.icons.forEach((icon) => {
            loadIconsFor(root, 'section-intersection', icon)
          })
        })
      },
      {
        root: null,
        rootMargin: ICON_SECTION_WARMUP_ROOT_MARGIN,
        threshold: 0.01,
      }
    )

    sections.forEach(({ section, icons: sectionIcons }) => {
      if (section.__lottieLazySectionObserver) return
      observer.observe(section)
      section.__lottieLazySectionObserver = observer
      sectionIcons.forEach((icon) => {
        icon.__lottieLazySectionObserver = observer
      })
    })
    return true
  } catch (e) {
    return false
  }
}

function attachPointerWarmup(root, icons) {
  icons.forEach((icon) => {
    const card = getIconCard(icon)
    if (!card || card.__lottieLazyPointerBound) return

    const onPointerEnter = () => {
      try {
        icon.__lottieLazyPendingHover = 'enter'
      } catch (e) {
        // ignore
      }
      loadIconsFor(root, 'pointerenter', icon)
    }
    const onPointerLeave = () => {
      try {
        icon.__lottieLazyPendingHover = null
      } catch (e) {
        // ignore
      }
    }

    card.addEventListener('pointerenter', onPointerEnter, { passive: true })
    card.addEventListener('mouseenter', onPointerEnter)
    card.addEventListener('pointerleave', onPointerLeave, { passive: true })
    card.addEventListener('mouseleave', onPointerLeave)
    card.__lottieLazyPointerEnter = onPointerEnter
    card.__lottieLazyPointerLeave = onPointerLeave
    card.__lottieLazyPointerBound = true
  })
}

function attachLazyTriggers(root, icons) {
  attachSectionWarmup(root, icons)
  const hasIntersection = attachIntersectionWarmup(root, icons)
  attachPointerWarmup(root, icons)

  if (!hasIntersection) {
    try {
      window.requestIdleCallback
        ? window.requestIdleCallback(
            () => loadIconsFor(root, 'idle-fallback'),
            {
              timeout: 2000,
            }
          )
        : setTimeout(() => loadIconsFor(root, 'timer-fallback'), 2000)
    } catch (e) {
      setTimeout(() => loadIconsFor(root, 'timer-fallback'), 2000)
    }
  }
}

function destroyLazyRuntime(root = document) {
  const icons = getIconTargets(root)
  icons.forEach((icon) => {
    try {
      if (
        icon.__lottieLazyIntersectionObserver &&
        typeof icon.__lottieLazyIntersectionObserver.unobserve === 'function'
      ) {
        icon.__lottieLazyIntersectionObserver.unobserve(icon)
      }
      icon.__lottieLazyIntersectionObserver = null
      icon.__lottieLazySectionObserver = null
      icon.__lottieLazyPendingHover = null
    } catch (e) {
      // ignore
    }
  })

  try {
    const scope = getScope(root)
    Array.from(scope.querySelectorAll(ICON_CARD_SELECTOR)).forEach((card) => {
      if (card.__lottieLazyPointerBound && card.__lottieLazyPointerEnter) {
        card.removeEventListener('pointerenter', card.__lottieLazyPointerEnter)
        card.removeEventListener('mouseenter', card.__lottieLazyPointerEnter)
      }
      if (card.__lottieLazyPointerBound && card.__lottieLazyPointerLeave) {
        card.removeEventListener('pointerleave', card.__lottieLazyPointerLeave)
        card.removeEventListener('mouseleave', card.__lottieLazyPointerLeave)
      }
      card.__lottieLazyPointerEnter = null
      card.__lottieLazyPointerLeave = null
      card.__lottieLazyPointerBound = false
    })
    Array.from(scope.querySelectorAll(ICON_SECTION_SELECTOR)).forEach(
      (section) => {
        if (
          section.__lottieLazySectionObserver &&
          typeof section.__lottieLazySectionObserver.unobserve === 'function'
        ) {
          section.__lottieLazySectionObserver.unobserve(section)
        }
        section.__lottieLazySectionObserver = null
      }
    )
  } catch (e) {
    // ignore
  }
}

export function prepareIcons(root = document) {
  const icons = prepareIconPlaceholders(root)
  if (!icons.length) return
  icons.forEach((icon) => {
    try {
      icon.setAttribute(ICON_PREPARED_ATTR, 'true')
    } catch (e) {
      // ignore
    }
  })
  attachLazyTriggers(root, icons)
}

export function initIcons(root = document, opts = {}) {
  if (!hasIconTargets(root)) return Promise.resolve(null)
  const reason = opts && opts.reason ? opts.reason : 'manual'
  const icon = opts && opts.icon ? opts.icon : null
  return loadIconsFor(root, reason, icon)
}

export function resetServiceCardIcons(root = document) {
  try {
    if (
      iconsModule &&
      typeof iconsModule.resetServiceCardIcons === 'function'
    ) {
      iconsModule.resetServiceCardIcons(root)
    }
  } catch (e) {
    // ignore
  }
}

export function destroyIcons(root = document) {
  destroyLazyRuntime(root)
  try {
    if (iconsModule && typeof iconsModule.destroyIcons === 'function') {
      iconsModule.destroyIcons(root)
    }
  } catch (e) {
    // ignore
  }
}
