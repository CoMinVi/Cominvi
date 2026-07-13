import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { afResizeLog, isAfResizeDebugEnabled } from '../app/af-resize-debug.js'
import { prepareHeroMedia, suppressHomeHeroVideo } from '../app/hero-media.js'
import { isSafariBrowser } from '../app/safari-detect.js'
import { initContactHero } from './contact-hero.js'
import {
  HOME_HERO_MANIFEST_URL,
  getScrollFrameUrl,
  loadHeroManifest,
  pickHeroVariant,
  resolveHeroAssetUrl,
} from './hero-manifest.js'
import {
  createHeroSequenceController,
  bindHeroBackgroundOverlayGuard,
} from './hero-sequence-controller.js'
import { heroAnimation } from './landing.js'
import { initHeroBackgroundParallax } from './parallax.js'

const SCROLL_RANGE_VH = 100
const HERO_INTRO_SCALE_DURATION = 3.2
const HERO_REVEAL_MASK_BG_FADE_DURATION = HERO_INTRO_SCALE_DURATION * 0.5
export const HOME_AF_SEQUENCE_URL =
  'https://cominvi.netlify.app/cave-scene/cave-scene-full-sequence.af'
export { HOME_HERO_MANIFEST_URL }

function getHomeSequenceScroller() {
  try {
    return (
      window.__lenisWrapper || document.querySelector('.page-wrap') || window
    )
  } catch (e) {
    return window
  }
}

function cleanupHomeSequenceBindings({ destroyController = true } = {}) {
  if (window.__homeSequenceScrollTrigger) {
    window.__homeSequenceScrollTrigger.kill()
    window.__homeSequenceScrollTrigger = null
  }

  if (
    window.__homeSequenceLenis &&
    window.__homeSequenceLenisHandler &&
    typeof window.__homeSequenceLenis.off === 'function'
  ) {
    try {
      window.__homeSequenceLenis.off(
        'scroll',
        window.__homeSequenceLenisHandler
      )
    } catch (e) {
      // ignore
    }
    window.__homeSequenceLenis = null
    window.__homeSequenceLenisHandler = null
  }

  if (
    window.__homeSequenceRefreshRepaintCleanup &&
    typeof window.__homeSequenceRefreshRepaintCleanup === 'function'
  ) {
    try {
      window.__homeSequenceRefreshRepaintCleanup()
    } catch (e) {
      // ignore
    }
    window.__homeSequenceRefreshRepaintCleanup = null
  }

  if (
    window.__homeSequenceResizeCleanup &&
    typeof window.__homeSequenceResizeCleanup === 'function'
  ) {
    try {
      window.__homeSequenceResizeCleanup()
    } catch (e) {
      // ignore
    }
    window.__homeSequenceResizeCleanup = null
  }

  if (!destroyController) return

  if (
    window.__homeSequenceController &&
    typeof window.__homeSequenceController.destroy === 'function'
  ) {
    try {
      window.__homeSequenceController.destroy()
    } catch (e) {
      // ignore
    }
    window.__homeSequenceController = null
  }
}

function getBackgroundInner(scope = document) {
  const root = scope && scope.querySelector ? scope : document
  return root.querySelector('.hero-background .background-inner')
}

function bindHomeSequenceRefreshRepaint(repaintFn) {
  if (
    window.__homeSequenceRefreshRepaintCleanup &&
    typeof window.__homeSequenceRefreshRepaintCleanup === 'function'
  ) {
    try {
      window.__homeSequenceRefreshRepaintCleanup()
    } catch (e) {
      // ignore
    }
  }

  const onGlobalRefresh = () => {
    afResizeLog('scrolltrigger:refresh')
    if (typeof repaintFn === 'function') repaintFn('scrolltrigger-refresh')
  }

  ScrollTrigger.addEventListener('refresh', onGlobalRefresh)
  window.__homeSequenceRefreshRepaintCleanup = () => {
    ScrollTrigger.removeEventListener('refresh', onGlobalRefresh)
  }
}

function beginScrollDrivenSequence(sequenceController) {
  if (window.__homeSequenceScrollTrigger) return

  const startScrollDriver = () => {
    window.requestAnimationFrame(() => {
      initScrollDrivenSequence(sequenceController)
      try {
        ScrollTrigger.refresh()
      } catch (e) {
        // ignore
      }
    })
  }

  if (typeof sequenceController.finishIntroHandoff === 'function') {
    const handoffResult = sequenceController.finishIntroHandoff()
    if (handoffResult && typeof handoffResult.then === 'function') {
      handoffResult.then(startScrollDriver).catch(startScrollDriver)
      return
    }
    startScrollDriver()
    return
  }

  if (typeof sequenceController.setScrollProgress === 'function') {
    sequenceController.setScrollProgress(0)
  }
  if (typeof sequenceController.repaint === 'function') {
    sequenceController.repaint('intro-handoff')
  }

  startScrollDriver()
}

function initScrollDrivenSequence(sequenceController) {
  const scroller = getHomeSequenceScroller()
  const trigger = scroller === window ? document.documentElement : scroller
  const hasLenisDriver =
    !!window.lenis &&
    typeof window.lenis.on === 'function' &&
    typeof window.lenis.off === 'function'

  const applyLenisProgress = (rawScroll) => {
    const distance = window.innerHeight * (SCROLL_RANGE_VH / 100)
    const progress = Math.max(0, Math.min((rawScroll || 0) / distance, 1))
    sequenceController.setScrollProgress(progress)
  }

  window.__homeSequenceScrollTrigger = ScrollTrigger.create({
    trigger,
    scroller: scroller === window ? undefined : scroller,
    start: 0,
    end: () => `+=${SCROLL_RANGE_VH}vh`,
    scrub: 0.15,
    onUpdate: (self) => {
      if (hasLenisDriver) return
      sequenceController.setScrollProgress(self.progress)
    },
    onRefresh: (self) => {
      if (hasLenisDriver) {
        const raw =
          window.lenis && typeof window.lenis.scroll === 'number'
            ? window.lenis.scroll
            : 0
        applyLenisProgress(raw)
      } else {
        sequenceController.setScrollProgress(self.progress)
      }
      afResizeLog('scrolltrigger:onRefresh', { progress: self.progress })
      if (typeof sequenceController.repaint === 'function') {
        sequenceController.repaint('scrolltrigger-onRefresh')
      }
    },
  })

  if (typeof sequenceController.repaint === 'function') {
    bindHomeSequenceRefreshRepaint(sequenceController.repaint)
  }

  if (hasLenisDriver) {
    // Keep Lenis as the only progress driver when available; ScrollTrigger stays
    // for lifecycle/refresh. This preserves the expected 100vh mapping and avoids
    // dual-driver frame oscillation.
    const onLenisScroll = (event) => {
      const raw = event && typeof event.scroll === 'number' ? event.scroll : 0
      applyLenisProgress(raw)
    }
    window.__homeSequenceLenis = window.lenis
    window.__homeSequenceLenisHandler = onLenisScroll
    window.lenis.on('scroll', onLenisScroll)
  } else {
    window.__homeSequenceLenis = null
    window.__homeSequenceLenisHandler = null
  }
}

function startHeroAfterLogo(loaderEase, sequenceController, opts = {}) {
  const scope = opts.scope || document

  if (!opts.skipHeroAnimation) {
    try {
      heroAnimation(scope)
    } catch (e) {
      // ignore
    }
  }

  if (!opts.skipContactHero) {
    try {
      initContactHero(scope, {
        animate: true,
        duration: HERO_INTRO_SCALE_DURATION,
        ease: loaderEase,
      })
    } catch (e) {
      // ignore
    }
  }

  try {
    initHeroBackgroundParallax(scope)
  } catch (e) {
    // ignore
  }

  if (opts.deferScrollSequence) return

  beginScrollDrivenSequence(sequenceController)
}

export function initLoader() {
  try {
    gsap.registerPlugin(CustomEase, ScrollTrigger)
    afResizeLog('initLoader:start', {
      debugEnabled: isAfResizeDebugEnabled(),
      href: typeof window !== 'undefined' ? window.location.href : null,
    })

    const loader = document.querySelector('.loader')
    const loaderInner = document.querySelector('.loader_inner')
    const logoWrap = loader?.querySelector('.loader-logo_wrap')
    const logoInner = loader?.querySelector('.logo-inner')
    const iconBox = loader?.querySelector('.is-logo-icon')
    const logoIcon = loader?.querySelector('.logo-icon')
    const logoSquare = loader?.querySelector('.logo-square')
    const textBox = loader?.querySelector('.is-logo-text')
    const logoText = loader?.querySelector('.is-logo-text .logo-text')
    const backgroundInner = getBackgroundInner(document)
    bindHeroBackgroundOverlayGuard(document)

    if (
      !loader ||
      !loaderInner ||
      !logoWrap ||
      !logoInner ||
      !iconBox ||
      !logoIcon ||
      !logoSquare ||
      !textBox ||
      !logoText ||
      !backgroundInner
    ) {
      return null
    }

    const existingController = window.__homeSequenceController
    let sequenceController = null
    if (
      existingController &&
      existingController.__hostEl === backgroundInner &&
      typeof existingController.setIntroProgress === 'function'
    ) {
      sequenceController = existingController
    } else {
      cleanupHomeSequenceBindings()
      sequenceController = createHeroSequenceController(backgroundInner)
      sequenceController.__hostEl = backgroundInner
      window.__homeSequenceController = sequenceController
    }

    const easeCurve = 'M0,0 C0.6,0 0,1 1,1 '
    const loaderEase = CustomEase.create('loaderEase', easeCurve)
    const logoTargetWidthPx = logoInner.getBoundingClientRect().width || 0
    const textPaths = Array.from(logoText.querySelectorAll('path'))
    const computePxFromEm = (el, emValue) => {
      const fontSizePx = parseFloat(getComputedStyle(el).fontSize) || 16
      return emValue * fontSizePx
    }
    const widthAfterPx = computePxFromEm(logoWrap, 7.46)

    gsap.set(textBox, { opacity: 0 })
    gsap.set(logoWrap, { backgroundColor: 'transparent' })
    gsap.set(logoSquare, { width: '0%', height: '0%' })
    gsap.set(iconBox, { overflow: 'hidden' })
    gsap.set(logoIcon, {
      autoAlpha: 0,
      yPercent: 100,
      rotation: 70,
      transformOrigin: '50% 50%',
    })
    gsap.set(backgroundInner, { transformOrigin: '50% 50%', scale: 1 })

    let outlineEl = null
    let syncOutlineSize = null
    let handleResize = null
    try {
      outlineEl = document.createElement('div')
      outlineEl.className = 'loader-logo_outline'
      document.body.appendChild(outlineEl)
      gsap.set(outlineEl, {
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: 2147483647,
        autoAlpha: 0,
        mixBlendMode: 'normal',
      })
      syncOutlineSize = () => {
        const rect = logoWrap.getBoundingClientRect()
        gsap.set(outlineEl, {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        })
      }
      syncOutlineSize()
      gsap.ticker.add(syncOutlineSize)
      handleResize = () => syncOutlineSize()
      window.addEventListener('resize', handleResize)
    } catch (e) {
      outlineEl = null
      syncOutlineSize = null
      handleResize = null
    }

    const cleanupOutlineOverlay = () => {
      try {
        if (syncOutlineSize) gsap.ticker.remove(syncOutlineSize)
        if (handleResize) window.removeEventListener('resize', handleResize)
        if (outlineEl) outlineEl.remove()
      } catch (e) {
        // ignore
      }
    }

    const finishLoader = () => {
      cleanupOutlineOverlay()
      try {
        loader.remove()
      } catch (e) {
        // ignore
      }
      try {
        window.__loaderDone = true
        document.dispatchEvent(new CustomEvent('loader:done'))
      } catch (e) {
        // ignore
      }
      beginScrollDrivenSequence(sequenceController)
    }

    const tl = gsap.timeline({ paused: true, defaults: { ease: loaderEase } })

    tl.to(
      logoSquare,
      {
        width: '100%',
        height: '100%',
        duration: 0.8,
      },
      0
    )
    tl.to(
      logoIcon,
      {
        autoAlpha: 1,
        yPercent: 0,
        rotation: 0,
        duration: 0.8,
      },
      0
    )
    tl.set(logoWrap, { backgroundColor: 'var(--primary)' }, '>')
    if (outlineEl) {
      tl.set(outlineEl, { autoAlpha: 1 }, '>')
    }
    tl.to(textBox, { opacity: 1, duration: 0.3 }, '<')
    tl.to(logoWrap, { width: logoTargetWidthPx, duration: 0.8 }, '<')
    tl.from(
      textPaths,
      {
        yPercent: (index) => 100 + index * 40,
        stagger: 0.02,
        duration: 0.8,
      },
      '<'
    )

    tl.set(logoWrap, { justifyContent: 'flex-end' })
    tl.to(logoWrap, { width: widthAfterPx, duration: 0.3 })

    const isTabletOrMobile =
      (window.matchMedia && window.matchMedia('(max-width: 991px)').matches) ||
      window.innerWidth <= 991

    const hasCssSupports = !!(window.CSS && CSS.supports)
    const supportsTouchCallout =
      hasCssSupports && CSS.supports('-webkit-touch-callout', 'none')
    const isMacPlatform =
      typeof navigator !== 'undefined' &&
      typeof navigator.platform === 'string' &&
      navigator.platform.startsWith('Mac')
    const hasNavigator = typeof navigator !== 'undefined'
    const ua =
      hasNavigator && typeof navigator.userAgent === 'string'
        ? navigator.userAgent
        : ''
    const vendor =
      hasNavigator && typeof navigator.vendor === 'string'
        ? navigator.vendor
        : ''
    const isSafariUA =
      /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Brave/i.test(ua)
    const isSafariVendor = /Apple/i.test(vendor)
    const isSafariMac =
      (!!supportsTouchCallout && !!isMacPlatform) ||
      (isMacPlatform && (isSafariUA || isSafariVendor))

    const heroScaleTween = {
      scale: 1.2,
      transformOrigin: '50% 50%',
      duration: HERO_INTRO_SCALE_DURATION,
      ease: loaderEase,
      force3D: true,
      overwrite: 'auto',
      onStart: () => {
        sequenceController.startIntroPlayback?.(HERO_INTRO_SCALE_DURATION)
      },
      onUpdate: function onHeroScaleUpdate() {
        if (!isSafariBrowser()) return
        sequenceController.setIntroProgress?.(this.progress())
      },
      onComplete: () => {
        try {
          initHeroBackgroundParallax(document)
        } catch (e) {
          // ignore
        }
      },
    }

    if (isTabletOrMobile || isSafariMac) {
      tl.add(cleanupOutlineOverlay)
      tl.add(() => {
        startHeroAfterLogo(loaderEase, sequenceController, {
          deferScrollSequence: true,
        })
      }, '>')
      tl.addLabel('heroIntro', '<')
      tl.to(backgroundInner, heroScaleTween, '<')
      tl.to(
        loader,
        { opacity: 0, duration: HERO_INTRO_SCALE_DURATION, ease: loaderEase },
        '<'
      )
      tl.add(finishLoader)
    } else {
      let holeRectRef = null
      tl.add(() => {
        const textRect = textBox.getBoundingClientRect()
        const logoRect = logoText.getBoundingClientRect()
        const csText = getComputedStyle(textBox)
        const marginLeftPx = parseFloat(csText.marginLeft || '0') || 0

        document.body.appendChild(textBox)
        iconBox.remove()
        logoWrap.remove()
        cleanupOutlineOverlay()

        Object.assign(textBox.style, {
          position: 'fixed',
          left: `${textRect.left - marginLeftPx}px`,
          top: `${textRect.top}px`,
          width: `${textRect.width}px`,
          height: `${textRect.height}px`,
          overflow: 'visible',
          zIndex: '1001',
        })

        Object.assign(logoText.style, {
          position: 'fixed',
          left: `${logoRect.left}px`,
          top: `${logoRect.top}px`,
          width: `${logoRect.width}px`,
          height: `${logoRect.height}px`,
          pointerEvents: 'none',
          zIndex: '1002',
          willChange: 'opacity',
          backfaceVisibility: 'hidden',
          transform: 'translateZ(0)',
        })

        const NS = 'http://www.w3.org/2000/svg'
        const svg = document.createElementNS(NS, 'svg')
        const defs = document.createElementNS(NS, 'defs')
        const svgMask = document.createElementNS(NS, 'mask')
        const whiteRect = document.createElementNS(NS, 'rect')
        const holeRect = document.createElementNS(NS, 'rect')

        const vw = window.innerWidth
        const vh = window.innerHeight

        svg.setAttribute('width', '0')
        svg.setAttribute('height', '0')
        svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`)
        svg.setAttribute('preserveAspectRatio', 'none')
        Object.assign(svg.style, {
          position: 'absolute',
          width: '0',
          height: '0',
        })

        svgMask.setAttribute('id', 'pageRevealMask')
        svgMask.setAttribute('maskUnits', 'userSpaceOnUse')
        svgMask.setAttribute('maskContentUnits', 'userSpaceOnUse')
        svgMask.setAttribute('style', 'mask-type:luminance;')

        whiteRect.setAttribute('x', '0')
        whiteRect.setAttribute('y', '0')
        whiteRect.setAttribute('width', String(vw))
        whiteRect.setAttribute('height', String(vh))
        whiteRect.setAttribute('fill', 'white')

        const rootFs =
          parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
        const radiusPx =
          parseFloat(csText.borderTopLeftRadius || '0') || rootFs * 0.5
        holeRect.setAttribute('x', String(textRect.left))
        holeRect.setAttribute('y', String(textRect.top))
        holeRect.setAttribute('width', String(textRect.width))
        holeRect.setAttribute('height', String(textRect.height))
        holeRect.setAttribute('fill', 'black')
        holeRect.setAttribute('rx', String(radiusPx))
        holeRect.setAttribute('ry', String(radiusPx))

        svgMask.appendChild(whiteRect)
        svgMask.appendChild(holeRect)
        defs.appendChild(svgMask)
        svg.appendChild(defs)
        textBox.appendChild(svg)

        loader.style.mask = 'url(#pageRevealMask)'
        loader.style.webkitMask = 'url(#pageRevealMask)'

        holeRectRef = holeRect
      })

      tl.to(textBox, {
        left: () => `-24px`,
        top: () => `-24px`,
        width: () => `${window.innerWidth + 48}px`,
        height: () => `${window.innerHeight + 48}px`,
        marginLeft: 0,
        duration: HERO_INTRO_SCALE_DURATION,
        ease: loaderEase,
      })
      tl.to(
        textBox,
        {
          backgroundColor: 'transparent',
          duration: HERO_REVEAL_MASK_BG_FADE_DURATION,
          ease: loaderEase,
        },
        '<'
      )
      tl.add(() => {
        if (!holeRectRef) return
        const vw = window.innerWidth
        const vh = window.innerHeight
        gsap.to(holeRectRef, {
          attr: { x: -24, y: -24, width: vw + 48, height: vh + 48 },
          duration: HERO_INTRO_SCALE_DURATION,
          ease: loaderEase,
        })
      }, '<')
      tl.add(() => {
        startHeroAfterLogo(loaderEase, sequenceController, {
          deferScrollSequence: true,
        })
      }, '<')
      tl.addLabel('heroIntro', '<')
      tl.to(backgroundInner, heroScaleTween, '<')
      tl.to(
        logoText,
        { opacity: 0, duration: HERO_INTRO_SCALE_DURATION, ease: loaderEase },
        '<'
      )
      tl.add(() => {
        try {
          textBox.remove()
        } catch (e) {
          // ignore
        }
        finishLoader()
      })
    }

    let started = false
    const startTimeline = () => {
      if (started) return
      started = true
      sequenceController.setIntroProgress(0)
      tl.play(0)
    }

    sequenceController.ready.then(startTimeline).catch(startTimeline)
    window.setTimeout(startTimeline, 1500)

    return tl
  } catch (err) {
    return null
  }
}

export function prefetchHomeSequenceBinary() {
  try {
    if (typeof document === 'undefined') return

    const head = document.head
    if (!head) return

    const preloadAsset = (href, as, attr) => {
      if (!href || head.querySelector(`link[${attr}="true"]`)) return
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = as
      link.href = href
      link.setAttribute(attr, 'true')
      if (as === 'fetch' || as === 'video') {
        link.crossOrigin = 'anonymous'
      }
      head.appendChild(link)
    }

    loadHeroManifest()
      .then((manifest) => {
        const variant = pickHeroVariant(manifest)
        if (variant?.intro?.mp4) {
          preloadAsset(
            resolveHeroAssetUrl(variant.intro.mp4),
            'fetch',
            'data-cominvi-hero-intro-preload'
          )
        }

        const scrollConfig = variant?.scroll
        const indexPad = manifest?.scroll?.indexPad || 5
        const firstBatchCount = scrollConfig?.batches?.[0]?.count || 8
        const prefetchCount = Math.min(8, Math.max(1, firstBatchCount))
        for (let index = 0; index < prefetchCount; index += 1) {
          const href = getScrollFrameUrl(scrollConfig, index, indexPad)
          if (!href) continue
          preloadAsset(
            href,
            'image',
            `data-cominvi-hero-scroll-preload-${index}`
          )
        }
      })
      .catch(() => {})

    preloadAsset(
      resolveHeroAssetUrl(HOME_HERO_MANIFEST_URL),
      'fetch',
      'data-cominvi-hero-manifest-preload'
    )
    preloadAsset(
      resolveHeroAssetUrl('/cave-scene/poster/frame_00000.webp'),
      'image',
      'data-cominvi-hero-poster-preload'
    )
  } catch (e) {
    // ignore
  }
}

export function suspendHomeSequenceForLeave() {
  if (
    window.__homeSequenceTransitionTimeline &&
    typeof window.__homeSequenceTransitionTimeline.kill === 'function'
  ) {
    try {
      window.__homeSequenceTransitionTimeline.kill()
    } catch (e) {
      // ignore
    }
    window.__homeSequenceTransitionTimeline = null
  }
  window.__homeSequenceTransitionStarted = false

  const controller = window.__homeSequenceController
  if (typeof controller?.freezeForTransitionLeave === 'function') {
    try {
      controller.freezeForTransitionLeave()
    } catch (e) {
      // ignore
    }
  }

  cleanupHomeSequenceBindings({ destroyController: false })
  afResizeLog('suspendHomeSequenceForLeave')
}

export function destroyHomeSequenceForTransition() {
  if (
    window.__homeSequenceTransitionTimeline &&
    typeof window.__homeSequenceTransitionTimeline.kill === 'function'
  ) {
    try {
      window.__homeSequenceTransitionTimeline.kill()
    } catch (e) {
      // ignore
    }
    window.__homeSequenceTransitionTimeline = null
  }
  window.__homeSequenceTransitionStarted = false
  cleanupHomeSequenceBindings({ destroyController: true })
}

export function preloadHomeSequenceForTransition(scope = document) {
  prefetchHomeSequenceBinary()
  return showHomeSequenceFirstFrame(scope)
}

function getOrCreateHomeSequenceController(backgroundInner) {
  const existingController = window.__homeSequenceController
  if (
    existingController &&
    existingController.__hostEl &&
    existingController.__hostEl !== backgroundInner
  ) {
    cleanupHomeSequenceBindings()
  }

  let sequenceController = window.__homeSequenceController
  if (
    !sequenceController ||
    sequenceController.__hostEl !== backgroundInner ||
    typeof sequenceController.setFrame !== 'function'
  ) {
    sequenceController = createHeroSequenceController(backgroundInner)
    sequenceController.__hostEl = backgroundInner
    window.__homeSequenceController = sequenceController
  }

  return sequenceController
}

export function showHomeSequenceFirstFrame(scope = document) {
  try {
    const root = scope && scope.querySelector ? scope : document

    try {
      suppressHomeHeroVideo(root)
      prepareHeroMedia(root)
    } catch (e) {
      // ignore
    }

    const backgroundInner = getBackgroundInner(root)
    if (!backgroundInner) return null

    const sequenceController =
      getOrCreateHomeSequenceController(backgroundInner)
    let painted = false

    const paintFrame0 = (reason = 'transition-first-frame') => {
      if (painted) return
      const host =
        backgroundInner.querySelector('.background_video') || backgroundInner
      const rect = host.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) return false

      painted = true
      sequenceController.setFrame(0)
      if (typeof sequenceController.repaint === 'function') {
        sequenceController.repaint(reason)
      }
      afResizeLog('showHomeSequenceFirstFrame:painted', { reason })
      return true
    }

    const waitForLayoutAndPaint = (tries = 0) => {
      if (paintFrame0('transition-first-frame-layout')) return
      if (tries >= 40) {
        sequenceController.setFrame(0)
        return
      }
      window.requestAnimationFrame(() => waitForLayoutAndPaint(tries + 1))
    }

    sequenceController.ready
      .then(() => {
        waitForLayoutAndPaint()
      })
      .catch(() => {
        waitForLayoutAndPaint()
      })

    waitForLayoutAndPaint()

    return sequenceController
  } catch (e) {
    return null
  }
}

export function startHomeSequenceAfterTransition(scope = document, opts = {}) {
  const { skipHeroAnimation = true, skipContactHero = true } = opts

  try {
    if (window.__homeSequenceTransitionStarted) {
      return window.__homeSequenceController || null
    }

    gsap.registerPlugin(CustomEase, ScrollTrigger)

    const root = scope && scope.querySelector ? scope : document
    const loader = root.querySelector('.loader')
    if (loader) {
      try {
        loader.remove()
      } catch (e) {
        // ignore
      }
    }

    try {
      suppressHomeHeroVideo(root)
      prepareHeroMedia(root)
    } catch (e) {
      // ignore
    }

    const backgroundInner = getBackgroundInner(root)
    if (!backgroundInner) return null

    const sequenceController =
      getOrCreateHomeSequenceController(backgroundInner)

    window.__homeSequenceTransitionStarted = true

    const easeCurve = 'M0,0 C0.6,0 0,1 1,1 '
    const loaderEase = CustomEase.create('loaderEase', easeCurve)
    afResizeLog('startHomeSequenceAfterTransition', {
      skipHeroAnimation,
      skipContactHero,
      skipIntro: true,
    })

    let started = false
    const startAfterTransition = () => {
      if (started || !window.__homeSequenceTransitionStarted) return
      started = true

      try {
        window.__loaderDone = true
        document.dispatchEvent(new CustomEvent('loader:done'))
      } catch (e) {
        // ignore
      }

      startHeroAfterLogo(loaderEase, sequenceController, {
        skipHeroAnimation,
        skipContactHero,
        scope: root,
        deferScrollSequence: true,
      })

      beginScrollDrivenSequence(sequenceController)

      window.__homeSequenceTransitionStarted = false
      window.__homeSequenceTransitionTimeline = null
    }

    sequenceController.ready
      .then(startAfterTransition)
      .catch(startAfterTransition)
    window.setTimeout(startAfterTransition, 1500)

    return sequenceController
  } catch (e) {
    window.__homeSequenceTransitionStarted = false
    return null
  }
}
