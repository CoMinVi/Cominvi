let iconsModule = null
let iconsModulePromise = null
const DEBUG_PREFIX = '[cominvi-icons]'

const ICON_SELECTOR =
  '.service-card .service-icon_icon, .team-card .service-icon_icon, .stats-card .service-icon_icon, .stat-card .service-icon_icon, .service-card [data-lottie], .team-card [data-lottie], .stats-card [data-lottie], .stat-card [data-lottie]'

function getScope(root = document) {
  return root && root.querySelector ? root : document
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
    try {
      console.log(DEBUG_PREFIX, 'preload:start')
    } catch (e) {
      // ignore
    }
    iconsModulePromise = import('../animation/service-icons.js').then((mod) => {
      iconsModule = mod
      try {
        console.log(DEBUG_PREFIX, 'preload:done', Object.keys(mod))
      } catch (e) {
        // ignore
      }
      return mod
    })
  }
  return iconsModulePromise
}

export function initIcons(root = document) {
  if (!hasIconTargets(root)) return Promise.resolve(null)
  return preloadIcons()
    .then((mod) => {
      try {
        mod.initIcons(root)
      } catch (e) {
        // ignore
      }
      return mod
    })
    .catch(() => null)
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
  try {
    if (iconsModule && typeof iconsModule.destroyIcons === 'function') {
      iconsModule.destroyIcons(root)
    }
  } catch (e) {
    // ignore
  }
}
