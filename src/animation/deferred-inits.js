import { initSticky50 } from '../utils/base.js'
import { initAboutValuesScroll } from './about-scroll.js'
import { initAbout } from './about-us.js'
import { blogArticleInit } from './blog-article.js'
import { initBlog } from './blog.js'
import { initCylinder } from './cylinder.js'
import { initTeam } from './join-the-team.js'
import { initMap } from './map.js'
import { initMineralsCanvas } from './minerals-canvas-local-debug.js'
import { initMinerals } from './minerals.js'
import { initParallax, initNextBackgroundParallax } from './parallax.js'
import {
  initVideoClipStickyTransform,
  destroyVideoClipStickyTransform,
} from './process-images.js'
import { initProcessProgression } from './process-progression.js'
import { initScrollList } from './scroll-list.js'
import { initServiceCards } from './service-cards.js'
import {
  initIcons,
  resetServiceCardIcons,
  destroyIcons,
} from './service-icons.js'
import { initTestimonials } from './testimonials.js'
import { initTextDisplayReveal } from './text-display-reveal.js'
import { initTextReveal } from './text-reveal.js'
import { destroyWorkshopsStickyImages } from './workshops.js'

let technologyModulePromise = null
const loadTechnologyModule = () => {
  if (!technologyModulePromise) {
    technologyModulePromise = import('./technology.js')
  }
  return technologyModulePromise
}

let contactModulePromise = null
const loadContactModule = () => {
  if (!contactModulePromise) {
    contactModulePromise = import('./contact.js')
  }
  return contactModulePromise
}

const getNamespace = (scope = document) => {
  try {
    const ns =
      (scope &&
        scope.getAttribute &&
        scope.getAttribute('data-barba-namespace')) ||
      (scope &&
        scope.querySelector &&
        scope
          .querySelector('[data-barba="container"]')
          ?.getAttribute('data-barba-namespace')) ||
      ''
    return String(ns).trim().toLowerCase()
  } catch (e) {
    return ''
  }
}

function ensureLottieReady() {
  try {
    const wf = typeof window !== 'undefined' ? window.Webflow : null
    const mod =
      wf && typeof wf.require === 'function' ? wf.require('lottie') : null
    const ready = mod && typeof mod.ready === 'function' ? mod.ready : null
    if (ready) ready()
  } catch (e) {
    // ignore
  }
}

export function destroyIconsSafe(root = document) {
  try {
    destroyIcons(root)
  } catch (e) {
    // ignore
  }
}

export function resetServiceCardIconsSafe(root = document) {
  try {
    resetServiceCardIcons(root)
  } catch (e) {
    // ignore
  }
}

export function initIconsSafe(root = document) {
  try {
    initIcons(root)
  } catch (e) {
    // ignore
  }
}

export function runNonCriticalInits(
  container,
  { includeScrollRefresh = false, includeTransitionEvent = false } = {}
) {
  initParallax(container)
  initNextBackgroundParallax(container)
  initServiceCards(container)
  initIconsSafe(container)
  initTextReveal()
  initMinerals()
  initMineralsCanvas(container)
  initScrollList()
  initProcessProgression(container)
  initTestimonials()
  initTextDisplayReveal()
  try {
    initCylinder(container)
  } catch (e) {
    // ignore
  }
  try {
    initSticky50(container)
  } catch (e) {
    // ignore
  }
  try {
    initBlog(container)
  } catch (e) {
    // ignore
  }
  try {
    blogArticleInit(container)
  } catch (e) {
    // ignore
  }
  try {
    initTeam(container)
  } catch (e) {
    // ignore
  }
  try {
    destroyWorkshopsStickyImages()
  } catch (e) {
    // ignore
  }
  try {
    initAbout(container)
  } catch (e) {
    // ignore
  }
  try {
    initAboutValuesScroll(container)
  } catch (e) {
    // ignore
  }
  try {
    destroyVideoClipStickyTransform()
  } catch (e) {
    // ignore
  }
  initVideoClipStickyTransform(container)
  try {
    initMap(container)
  } catch (e) {
    // ignore
  }
  const namespace = getNamespace(container)
  if (namespace === 'technology') {
    loadTechnologyModule()
      .then((m) => {
        try {
          m.initTechnology(container)
        } catch (e) {
          // ignore
        }
      })
      .catch(() => {})
  }
  if (namespace === 'contact') {
    loadContactModule()
      .then((m) => {
        try {
          m.initContact(container)
        } catch (e) {
          // ignore
        }
      })
      .catch(() => {})
  }

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

export function runAfterEnterNonCritical(container) {
  try {
    initServiceCards(container)
  } catch (e) {
    // ignore
  }
  try {
    initAboutValuesScroll(container)
  } catch (e) {
    // ignore
  }
  try {
    requestAnimationFrame(() => {
      ensureLottieReady()
      resetServiceCardIconsSafe(container)
      initIconsSafe(container)
      Promise.resolve().then(() => {
        ensureLottieReady()
        initIconsSafe(container)
      })
    })
  } catch (e) {
    // ignore
  }
}
