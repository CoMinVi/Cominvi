import { initSticky50, refreshSticky50 } from '../utils/base.js'
import { prepareIcons, resetServiceCardIcons } from './icons-runtime.js'

function getScope(root = document) {
  return root && root.querySelector ? root : document
}

export function getNamespace(root = document) {
  try {
    const scope = getScope(root)
    const container =
      root &&
      root.getAttribute &&
      root.getAttribute('data-barba') === 'container'
        ? root
        : scope.querySelector('[data-barba="container"]')
    return (
      (container &&
        container.getAttribute &&
        container.getAttribute('data-barba-namespace')) ||
      ''
    ).trim()
  } catch (e) {
    return ''
  }
}

function getNamespaceKey(root = document) {
  const ns = getNamespace(root).toLowerCase()
  if (ns === 'about us') return 'about'
  if (ns === 'join the team') return 'team'
  return ns
}

function has(root, selector) {
  try {
    const scope = getScope(root)
    return !!(scope && scope.querySelector && scope.querySelector(selector))
  } catch (e) {
    return false
  }
}

function idle() {
  return new Promise((resolve) => {
    try {
      if (typeof window !== 'undefined' && window.requestIdleCallback) {
        window.requestIdleCallback(resolve, { timeout: 180 })
        return
      }
    } catch (e) {
      // ignore
    }
    setTimeout(resolve, 48)
  })
}

async function importAndRun(importer, exportName, root, ...args) {
  try {
    const mod = await importer()
    const fn = mod && mod[exportName]
    if (typeof fn === 'function') {
      fn(root, ...args)
    }
    return mod
  } catch (e) {
    // Import error
    return null
  }
}

async function initSharedSections(root, options = {}) {
  const {
    includeParallax = true,
    includeButtonHover = false,
    destroyVideoBeforeInit = true,
  } = options

  const jobs = []

  if (includeButtonHover) {
    jobs.push(
      importAndRun(
        () => import('../animation/button-hover.js'),
        'initButtonHover',
        root
      )
    )
  }

  if (includeParallax) {
    jobs.push(
      import('../animation/parallax.js').then((mod) => {
        try {
          mod.initParallax(root)
          mod.initNextBackgroundParallax(root)
        } catch (e) {
          // ignore
        }
      })
    )
  } else {
    jobs.push(
      importAndRun(
        () => import('../animation/parallax.js'),
        'initNextBackgroundParallax',
        root
      )
    )
  }

  if (has(root, '.service-card, .team-card, .machine-card')) {
    jobs.push(
      importAndRun(
        () => import('../animation/service-cards.js'),
        'initServiceCards',
        root
      )
    )
  }

  if (
    has(
      root,
      '.service-icon_icon, [data-lottie], .stats-card, .stat-card, .service-card, .team-card'
    )
  ) {
    try {
      prepareIcons(root)
    } catch (e) {
      // keep page init resilient
    }
  }

  if (has(root, '[tr="1"], .section_process')) {
    jobs.push(
      importAndRun(
        () => import('../animation/text-reveal.js'),
        'initTextReveal',
        root
      )
    )
  }

  if (has(root, '.section_minerals')) {
    jobs.push(
      importAndRun(
        () => import('../animation/minerals.js'),
        'initMinerals',
        root
      )
    )
  }

  if (has(root, '.section_minerals')) {
    jobs.push(
      importAndRun(
        () => import('../animation/minerals-canvas-local-debug.js'),
        'initMineralsCanvas',
        root
      )
    )
  }

  if (has(root, '.section_safety')) {
    jobs.push(
      importAndRun(
        () => import('../animation/safety-sticky.js'),
        'initSafetySticky',
        root
      )
    )
  }

  if (has(root, '.section_partners, .scroll-list')) {
    jobs.push(
      importAndRun(
        () => import('../animation/scroll-list.js'),
        'initScrollList',
        root
      )
    )
  }

  if (has(root, '.section_process, .process-progression-inner')) {
    jobs.push(
      importAndRun(
        () => import('../animation/process-progression.js'),
        'initProcessProgression',
        root
      )
    )
  }

  if (has(root, '.testimonials')) {
    jobs.push(
      importAndRun(
        () => import('../animation/testimonials.js'),
        'initTestimonials',
        root
      )
    )
  }

  if (has(root, '.title-big, .display-text, .overlay-gradient')) {
    jobs.push(
      importAndRun(
        () => import('../animation/text-display-reveal.js'),
        'initTextDisplayReveal',
        root
      )
    )
  }

  if (has(root, '.cylindar__wrapper')) {
    jobs.push(
      importAndRun(
        () => import('../animation/cylinder.js'),
        'initCylinder',
        root
      )
    )
  }

  if (has(root, '.is-sticky-50')) {
    try {
      initSticky50(root)
    } catch (e) {
      // ignore
    }
  }

  if (has(root, '.video-clip-inner, .video.is-fixed')) {
    jobs.push(
      import('../animation/process-images.js').then((mod) => {
        try {
          if (
            destroyVideoBeforeInit &&
            typeof mod.destroyVideoClipStickyTransform === 'function'
          ) {
            mod.destroyVideoClipStickyTransform()
          }
          mod.initVideoClipStickyTransform(root)
        } catch (e) {
          // ignore
        }
      })
    )
  }

  if (
    has(
      root,
      '.marker[id^="marker-"], .region[id^="region-"], .projects-wrapper.swiper, .swiper.projects-wrapper'
    )
  ) {
    jobs.push(
      importAndRun(() => import('../animation/map.js'), 'initMap', root)
    )
  }

  await Promise.all(jobs)

  if (has(root, '.is-sticky-50')) {
    try {
      refreshSticky50(root)
    } catch (e) {
      // ignore
    }
  }
}

async function initNamespace(root) {
  const key = getNamespaceKey(root)

  if (key === 'contact') {
    await importAndRun(
      () => import('../animation/contact.js'),
      'initContact',
      root
    )
    return
  }

  if (key === 'technology') {
    await importAndRun(
      () => import('../animation/technology.js'),
      'initTechnology',
      root
    )
    return
  }

  if (key === 'about') {
    try {
      const workshops = await import('../animation/workshops.js')
      if (
        workshops &&
        typeof workshops.destroyWorkshopsStickyImages === 'function'
      ) {
        workshops.destroyWorkshopsStickyImages()
      }
    } catch (e) {
      // ignore
    }
    await Promise.all([
      importAndRun(() => import('../animation/about-us.js'), 'initAbout', root),
      importAndRun(
        () => import('../animation/about-scroll.js'),
        'initAboutValuesScroll',
        root
      ),
    ])
    return
  }

  if (key === 'blog') {
    await importAndRun(() => import('../animation/blog.js'), 'initBlog', root)
    return
  }

  if (key === 'article') {
    await importAndRun(
      () => import('../animation/blog-article.js'),
      'blogArticleInit',
      root
    )
    return
  }

  if (key === 'team') {
    await importAndRun(
      () => import('../animation/join-the-team.js'),
      'initTeam',
      root
    )
  }
}

export async function initContainerModules(root = document, options = {}) {
  const {
    includeScrollRefresh = false,
    includeTransitionEvent = false,
    includeParallax = true,
    includeButtonHover = false,
    waitForIdle = false,
  } = options

  if (waitForIdle) await idle()

  await initSharedSections(root, {
    includeParallax,
    includeButtonHover,
    destroyVideoBeforeInit: true,
  })
  await initNamespace(root)

  if (includeScrollRefresh) {
    try {
      const st = window.ScrollTrigger
      if (st && typeof st.refresh === 'function') {
        requestAnimationFrame(() => st.refresh())
      }
    } catch (e) {
      // ignore
    }
  }

  if (includeTransitionEvent) {
    try {
      window.dispatchEvent(new Event('page:transition:after'))
    } catch (e) {
      // ignore
    }
  }
}

export async function initAfterEnterModules(root = document) {
  if (has(root, '.section_minerals')) {
    await importAndRun(
      () => import('../animation/minerals.js'),
      'initMinerals',
      root
    )
  }

  if (has(root, '.section_minerals')) {
    await importAndRun(
      () => import('../animation/minerals-canvas-local-debug.js'),
      'initMineralsCanvas',
      root
    )
  }

  if (has(root, '.service-card, .team-card, .machine-card')) {
    await importAndRun(
      () => import('../animation/service-cards.js'),
      'initServiceCards',
      root
    )
  }

  if (getNamespaceKey(root) === 'about') {
    await importAndRun(
      () => import('../animation/about-scroll.js'),
      'initAboutValuesScroll',
      root
    )
  }

  try {
    resetServiceCardIcons(root)
  } catch (e) {
    // ignore
  }
  try {
    prepareIcons(root)
  } catch (e) {
    // keep transition resilient
  }
}
