import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { afResizeLog, isAfResizeDebugEnabled } from '../app/af-resize-debug.js'
import { prepareHeroMedia, suppressHomeHeroVideo } from '../app/hero-media.js'
import { ActiveFrame } from './active-frame-player.js'
import { initContactHero } from './contact-hero.js'
import { heroAnimation } from './landing.js'
import { initHeroBackgroundParallax } from './parallax.js'

const INTRO_FRAME_COUNT = 126
const SCROLL_RANGE_VH = 100
export const HOME_AF_SEQUENCE_URL =
  'https://precious-hotteok-8da21f.netlify.app/cave-scene/cave-scene-full-sequence.af'
const CAVE_AF_URL = HOME_AF_SEQUENCE_URL
const HERO_POSTER_IMG_SELECTOR = 'img[data-cominvi-hero-poster-img="true"]'

function getHomeSequenceScroller() {
  try {
    return (
      window.__lenisWrapper || document.querySelector('.page-wrap') || window
    )
  } catch (e) {
    return window
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg'

function parseSvgViewBox(svgEl, fallback = '0 0 32 33') {
  const raw =
    svgEl?.getAttribute('viewBox') || svgEl?.getAttribute('viewbox') || fallback
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
    return { x: 0, y: 0, width: 32, height: 33 }
  }
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] }
}

function buildIconCutoutMaskUrl(pathD, viewBox) {
  const svg = [
    `<svg xmlns='${SVG_NS}' viewBox='${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}'>`,
    `<path fill='black' fill-rule='evenodd' clip-rule='evenodd' d='${pathD}'/>`,
    '</svg>',
  ].join('')
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

function setupLoaderIconVideoMask(logoSquare, logoIcon) {
  const iconPath = logoIcon?.querySelector('path')
  const pathD = iconPath?.getAttribute('d')
  if (!logoSquare || !logoIcon || !pathD) {
    return () => {}
  }

  const viewBox = parseSvgViewBox(logoIcon)
  const cutoutUrl = buildIconCutoutMaskUrl(pathD, viewBox)
  const solidMask = 'linear-gradient(#fff, #fff)'

  const updateMaskGeometry = () => {
    const squareRect = logoSquare.getBoundingClientRect()
    const iconRect = logoIcon.getBoundingClientRect()
    if (
      !squareRect.width ||
      !squareRect.height ||
      !iconRect.width ||
      !iconRect.height
    ) {
      return
    }

    const iconLeft = iconRect.left - squareRect.left
    const iconTop = iconRect.top - squareRect.top
    const maskLayers = `${solidMask}, ${cutoutUrl}`
    const maskSize = `100% 100%, ${iconRect.width}px ${iconRect.height}px`
    const maskPosition = `0 0, ${iconLeft}px ${iconTop}px`

    logoSquare.style.setProperty('-webkit-mask-image', maskLayers)
    logoSquare.style.setProperty('mask-image', maskLayers)
    logoSquare.style.setProperty('-webkit-mask-size', maskSize)
    logoSquare.style.setProperty('mask-size', maskSize)
    logoSquare.style.setProperty('-webkit-mask-position', maskPosition)
    logoSquare.style.setProperty('mask-position', maskPosition)
    logoSquare.style.setProperty('-webkit-mask-repeat', 'no-repeat')
    logoSquare.style.setProperty('mask-repeat', 'no-repeat')
    logoSquare.style.setProperty('-webkit-mask-composite', 'destination-out')
    logoSquare.style.setProperty('mask-composite', 'subtract')
  }

  updateMaskGeometry()

  return updateMaskGeometry
}

function cleanupHomeSequenceBindings() {
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

function createSequenceCanvas(backgroundInner) {
  if (!backgroundInner) return null

  const mediaHost =
    backgroundInner.querySelector('.background_video') || backgroundInner

  if (getComputedStyle(mediaHost).position === 'static') {
    mediaHost.style.position = 'relative'
  }
  mediaHost.style.overflow = 'hidden'

  const misplaced = backgroundInner.querySelector(
    '[data-loader-sequence-canvas="true"]'
  )
  if (misplaced && misplaced.parentElement !== mediaHost) {
    mediaHost.appendChild(misplaced)
  }

  const existing = mediaHost.querySelector(
    '[data-loader-sequence-canvas="true"]'
  )
  if (existing) return existing

  const canvas = document.createElement('canvas')
  canvas.setAttribute('data-loader-sequence-canvas', 'true')
  mediaHost.appendChild(canvas)
  return canvas
}

function hideHeroPosterPlaceholder(backgroundInner) {
  if (!backgroundInner || !backgroundInner.querySelector) return

  const wrapper = backgroundInner.querySelector('.background_video')
  if (!wrapper) return

  const posterImg = wrapper.querySelector(HERO_POSTER_IMG_SELECTOR)
  if (posterImg && posterImg.style) {
    posterImg.style.opacity = '0'
    posterImg.style.visibility = 'hidden'
    posterImg.style.pointerEvents = 'none'
  }

  const video = wrapper.querySelector('video')
  if (video && video.style) {
    try {
      video.style.setProperty('background-image', 'none', 'important')
    } catch (e) {
      video.style.backgroundImage = 'none'
    }
  }
}

function createNoopSequenceController() {
  return {
    ready: Promise.resolve(),
    setIntroProgress: () => {},
    setScrollProgress: () => {},
    setFrame: () => {},
    repaint: () => {},
    destroy: () => {},
  }
}

function createActiveFrameSequenceController(backgroundInner) {
  const hasWebCodecs =
    typeof window !== 'undefined' &&
    'VideoDecoder' in window &&
    'EncodedVideoChunk' in window

  if (!hasWebCodecs) return createNoopSequenceController()

  const canvas = createSequenceCanvas(backgroundInner)
  if (!canvas) return createNoopSequenceController()

  const mediaHost = canvas.parentElement || backgroundInner

  const ctx =
    canvas.getContext('2d', { alpha: false, willReadFrequently: true }) ||
    canvas.getContext('2d')
  if (!ctx) return createNoopSequenceController()

  const fitCanvas = () => {
    const rect = mediaHost.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) {
      afResizeLog('fitCanvas:skip-tiny-host', {
        host: { w: rect.width, h: rect.height },
      })
      return false
    }

    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const width = Math.max(1, Math.round(rect.width * dpr))
    const height = Math.max(1, Math.round(rect.height * dpr))
    const resized = canvas.width !== width || canvas.height !== height
    if (resized) {
      canvas.width = width
      canvas.height = height
      afResizeLog('fitCanvas:resize-buffer', {
        buffer: { w: width, h: height },
        host: { w: rect.width, h: rect.height },
      })
    }
    return resized
  }

  let displayImg = null
  let displayImgUrl = null

  const ensureDisplayImg = () => {
    if (displayImg) return displayImg

    displayImg = document.createElement('img')
    displayImg.setAttribute('data-cominvi-af-display', 'true')
    displayImg.setAttribute('alt', '')
    displayImg.decoding = 'async'
    Object.assign(displayImg.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: 'center center',
      margin: '0',
      display: 'block',
      pointerEvents: 'none',
      zIndex: '4',
      backfaceVisibility: 'visible',
      opacity: '0',
      visibility: 'hidden',
    })
    mediaHost.appendChild(displayImg)
    afResizeLog('displayImg:created')
    return displayImg
  }

  const syncDisplayImgFromSnapshot = (reason = 'unknown') => {
    if (!frameSnapshot || !frameSnapshotW || !frameSnapshotH) {
      afResizeLog('displayImg:skip-no-snapshot', { reason })
      return false
    }

    ensureDisplayImg()
    try {
      if (displayImgUrl) {
        URL.revokeObjectURL(displayImgUrl)
        displayImgUrl = null
      }

      frameSnapshot.toBlob(
        (blob) => {
          if (!blob || !displayImg) return
          displayImgUrl = URL.createObjectURL(blob)
          displayImg.src = displayImgUrl
          displayImg.style.opacity = '1'
          displayImg.style.visibility = 'visible'
          afResizeLog('displayImg:synced', { reason, blobSize: blob.size })
        },
        'image/jpeg',
        0.92
      )
      return true
    } catch (e) {
      afResizeLog('displayImg:error', { reason, message: e?.message })
      return false
    }
  }

  const hideDisplayImg = (reason = 'unknown') => {
    if (!displayImg) return
    displayImg.style.opacity = '0'
    displayImg.style.visibility = 'hidden'
    afResizeLog('displayImg:hidden', { reason })
  }

  const nudgeSurfaceComposite = () => {
    try {
      canvas.style.transform = 'translateZ(0)'
      void canvas.offsetHeight
    } catch (e) {
      // ignore
    }
  }

  const drawCoverImage = (source, srcW, srcH) => {
    fitCanvas()
    const destW = canvas.width
    const destH = canvas.height
    const scale = Math.max(destW / srcW, destH / srcH)
    const drawW = srcW * scale
    const drawH = srcH * scale
    const offsetX = (destW - drawW) * 0.5
    const offsetY = (destH - drawH) * 0.5

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, destW, destH)
    ctx.drawImage(source, 0, 0, srcW, srcH, offsetX, offsetY, drawW, drawH)
  }

  let frameSnapshot = null
  let frameSnapshotCtx = null
  let frameSnapshotW = 0
  let frameSnapshotH = 0

  const cacheFrameSnapshot = (frame, srcW, srcH) => {
    if (!frameSnapshot) {
      frameSnapshot = document.createElement('canvas')
      frameSnapshotCtx = frameSnapshot.getContext('2d', { alpha: false })
    }
    if (!frameSnapshotCtx) return

    if (frameSnapshot.width !== srcW || frameSnapshot.height !== srcH) {
      frameSnapshot.width = srcW
      frameSnapshot.height = srcH
    }

    frameSnapshotCtx.setTransform(1, 0, 0, 1, 0, 0)
    frameSnapshotCtx.clearRect(0, 0, srcW, srcH)
    frameSnapshotCtx.drawImage(frame, 0, 0, srcW, srcH)
    frameSnapshotW = srcW
    frameSnapshotH = srcH
  }

  const paintCachedSnapshot = (reason = 'unknown') => {
    if (!frameSnapshot || !frameSnapshotW || !frameSnapshotH) {
      afResizeLog('paintCachedSnapshot:miss', { reason })
      return false
    }
    drawCoverImage(frameSnapshot, frameSnapshotW, frameSnapshotH)
    syncDisplayImgFromSnapshot(reason)
    afResizeLog('paintCachedSnapshot:ok', { reason })
    return true
  }

  const drawCover = (frame, reason = 'decode') => {
    const srcW = frame.displayWidth || frame.codedWidth
    const srcH = frame.displayHeight || frame.codedHeight
    drawCoverImage(frame, srcW, srcH)
    cacheFrameSnapshot(frame, srcW, srcH)
    hideDisplayImg(reason)
    afResizeLog('drawCover', { reason, frame: { w: srcW, h: srcH } })
  }

  const clearBackgroundFallback = () => {
    try {
      hideHeroPosterPlaceholder(backgroundInner)

      const heroBackground =
        (backgroundInner.closest &&
          backgroundInner.closest('.hero-background')) ||
        document
      const overlay =
        (heroBackground.querySelector &&
          heroBackground.querySelector('.background-overlay')) ||
        document.querySelector('.background-overlay')
      if (overlay) {
        overlay.style.opacity = '0'
        overlay.style.visibility = 'hidden'
        overlay.style.pointerEvents = 'none'
      }
    } catch (e) {
      // ignore
    }
  }

  let activeFrame = null
  let totalFrames = 0
  let introEndIndex = 0
  let requestedFrame = 0
  let rafToken = 0
  let resizeEndTimer = 0
  let hasRenderedAfFrame = false
  let scrollHysteresisFrame = null
  const SCROLL_FRAME_HYSTERESIS = 0.2

  const resolveScrollFrameFromProgress = (progress) => {
    if (!totalFrames) return 0
    const p = Math.max(0, Math.min(Number(progress) || 0, 1))
    const end = Math.max(0, totalFrames - 1)
    const raw = introEndIndex + p * (end - introEndIndex)

    if (scrollHysteresisFrame == null) {
      scrollHysteresisFrame = Math.floor(raw + 1e-6)
      return scrollHysteresisFrame
    }

    let next = scrollHysteresisFrame

    // Schmitt trigger on frame boundaries to avoid slow-scroll N<->N-1 jitter.
    if (raw >= scrollHysteresisFrame + 1 + SCROLL_FRAME_HYSTERESIS) {
      next = Math.floor(raw - SCROLL_FRAME_HYSTERESIS + 1e-6)
    } else if (raw < scrollHysteresisFrame - SCROLL_FRAME_HYSTERESIS) {
      next = Math.floor(raw + SCROLL_FRAME_HYSTERESIS + 1e-6)
    }

    next = Math.max(introEndIndex, Math.min(end, next))
    scrollHysteresisFrame = next
    return next
  }

  const syncRequestedFrameFromScroll = () => {
    try {
      const st = window.__homeSequenceScrollTrigger
      if (!st || !totalFrames) return
      const progress = Math.max(0, Math.min(Number(st.progress) || 0, 1))
      requestedFrame = resolveScrollFrameFromProgress(progress)
    } catch (e) {
      // ignore
    }
  }

  const flushFrameRequest = () => {
    rafToken = 0
    if (!activeFrame || !activeFrame.manifest) return
    const maxFrame = Math.max(0, totalFrames - 1)
    const frame = Math.max(0, Math.min(maxFrame, requestedFrame))
    const currentFrame = activeFrame.frame
    activeFrame.setFrame(frame)
    exposeDebugState()
    if (currentFrame === frame && activeFrame.frame === frame) {
      if (paintCachedSnapshot('flush-same-frame')) {
        nudgeSurfaceComposite()
      }
    }
  }

  const repaintVisibleFrame = (reason = 'unknown') => {
    syncRequestedFrameFromScroll()
    if (hasRenderedAfFrame) {
      hideHeroPosterPlaceholder(backgroundInner)
    }

    afResizeLog('repaint:start', {
      reason,
      requestedFrame,
      hasRenderedAfFrame,
      hasSnapshot: !!(frameSnapshot && frameSnapshotW && frameSnapshotH),
    })

    if (hasRenderedAfFrame && paintCachedSnapshot(reason)) {
      nudgeSurfaceComposite()
      afResizeLog('repaint:snapshot-only', { reason, requestedFrame })
      return true
    }

    if (activeFrame && activeFrame.manifest) {
      activeFrame.redrawFrame(requestedFrame)
      afResizeLog('repaint:redrawFrame', { reason, requestedFrame })
      return true
    }

    flushFrameRequest()
    afResizeLog('repaint:flush', { reason, requestedFrame })
    return false
  }

  const handleLayoutChange = (reason = 'layout') => {
    repaintVisibleFrame(reason)
  }

  const requestFrame = (frame) => {
    requestedFrame = Math.round(frame)
    if (rafToken) return
    rafToken = window.requestAnimationFrame(flushFrameRequest)
  }

  const exposeDebugState = () => {
    if (!isAfResizeDebugEnabled()) return
    if (!window.__homeSequenceController) return
    window.__homeSequenceController.__debugRequestedFrame = requestedFrame
    window.__homeSequenceController.__debugHasSnapshot = !!(
      frameSnapshot &&
      frameSnapshotW &&
      frameSnapshotH
    )
  }

  const setIntroProgress = (progress) => {
    if (!totalFrames) return
    const p = Math.max(0, Math.min(progress, 1))
    const frame = Math.round(p * introEndIndex)
    scrollHysteresisFrame = null
    requestFrame(frame)
  }

  const setScrollProgress = (progress) => {
    if (!totalFrames) return
    const frame = resolveScrollFrameFromProgress(progress)
    requestFrame(frame)
  }

  const afUrl = CAVE_AF_URL
  const hardwareAcceleration = /\bAndroid\b/i.test(navigator.userAgent || '')
    ? 'prefer-software'
    : 'prefer-hardware'

  activeFrame = new ActiveFrame(afUrl, {
    hardwareAcceleration,
    process: (frame) => {
      drawCover(frame, 'decode')
      nudgeSurfaceComposite()
      exposeDebugState()
      if (!hasRenderedAfFrame) {
        hasRenderedAfFrame = true
        clearBackgroundFallback()
        afResizeLog('first-frame-rendered')
      }
    },
  })

  window.__homeSequenceActiveFrame = activeFrame

  const ready = activeFrame.loading.then(() => {
    totalFrames = Math.max(1, activeFrame.manifest.totalFrames || 1)
    introEndIndex = Math.min(INTRO_FRAME_COUNT - 1, totalFrames - 1)
    fitCanvas()
    requestFrame(0)
    afResizeLog('sequence:ready', { totalFrames, introEndIndex })
  })

  const onResize = () => {
    afResizeLog('window:resize')
    handleLayoutChange('window-resize')

    if (resizeEndTimer) {
      window.clearTimeout(resizeEndTimer)
    }

    resizeEndTimer = window.setTimeout(() => {
      resizeEndTimer = 0
      afResizeLog('window:resize-settled')
      handleLayoutChange('window-resize-settled')
    }, 200)
  }

  let layoutObserver = null
  try {
    layoutObserver = new ResizeObserver(() => {
      afResizeLog('resize-observer')
      handleLayoutChange('resize-observer')
    })
    layoutObserver.observe(mediaHost)
    layoutObserver.observe(backgroundInner)
  } catch (e) {
    // ignore
  }

  window.addEventListener('resize', onResize)
  window.__homeSequenceResizeCleanup = () => {
    window.removeEventListener('resize', onResize)
    if (layoutObserver) {
      layoutObserver.disconnect()
      layoutObserver = null
    }
    if (resizeEndTimer) {
      window.clearTimeout(resizeEndTimer)
      resizeEndTimer = 0
    }
  }

  return {
    ready,
    setIntroProgress,
    setScrollProgress,
    setFrame: requestFrame,
    repaint: repaintVisibleFrame,
    destroy: () => {
      if (rafToken) {
        window.cancelAnimationFrame(rafToken)
        rafToken = 0
      }
      if (resizeEndTimer) {
        window.clearTimeout(resizeEndTimer)
        resizeEndTimer = 0
      }
      if (displayImgUrl) {
        URL.revokeObjectURL(displayImgUrl)
        displayImgUrl = null
      }
      try {
        if (activeFrame) activeFrame.destroy()
      } catch (e) {
        // ignore
      }
      activeFrame = null
    },
  }
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

  if (typeof sequenceController.setIntroProgress === 'function') {
    sequenceController.setIntroProgress(1)
  }
  if (typeof sequenceController.repaint === 'function') {
    sequenceController.repaint('intro-handoff')
  }

  requestAnimationFrame(() => {
    initScrollDrivenSequence(sequenceController)
    try {
      ScrollTrigger.refresh()
    } catch (e) {
      // ignore
    }
  })
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
        duration: 1.2,
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
    const logoWrap = loader?.querySelector('.loader-logo_wrap')
    const logoInner = loader?.querySelector('.logo-inner')
    const iconBox = loader?.querySelector('.is-logo-icon')
    const logoIcon = loader?.querySelector('.logo-icon')
    const logoSquare = loader?.querySelector('.logo-square')
    const textBox = loader?.querySelector('.is-logo-text')
    const logoText = loader?.querySelector('.is-logo-text .logo-text')
    const backgroundInner = getBackgroundInner(document)

    if (
      !loader ||
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
      sequenceController = createActiveFrameSequenceController(backgroundInner)
      sequenceController.__hostEl = backgroundInner
      window.__homeSequenceController = sequenceController
    }

    const easeCurve = 'M0,0 C0.6,0 0,1 1,1 '
    const loaderEase = CustomEase.create('loaderEase', easeCurve)
    const logoTargetWidthPx = logoInner.getBoundingClientRect().width || 0
    const textPaths = Array.from(logoText.querySelectorAll('path'))

    gsap.set(loader, { backgroundColor: 'transparent' })
    gsap.set('.loader_mask', { backgroundColor: 'transparent' })
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

    const isWhiteLoader =
      loader.getAttribute('data-wf--loader--variant') === 'is-white'
    const updateLoaderIconMask = isWhiteLoader
      ? setupLoaderIconVideoMask(logoSquare, logoIcon)
      : () => {}
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
      if (isWhiteLoader) {
        gsap.set(outlineEl, { outlineColor: 'var(--white)' })
      }
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

    const tl = gsap.timeline({ defaults: { ease: loaderEase } })
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
    tl.to(textBox, { opacity: 1, duration: 0.3 }, '>')
    if (outlineEl) {
      tl.set(outlineEl, { autoAlpha: 1 }, '>')
    }
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
    tl.add(() => {
      startHeroAfterLogo(loaderEase, sequenceController, {
        deferScrollSequence: true,
      })
    })
    if (outlineEl) {
      tl.to([loader, outlineEl], { autoAlpha: 0, duration: 0.35 })
    } else {
      tl.to(loader, { autoAlpha: 0, duration: 0.35 })
    }
    tl.add(() => {
      try {
        if (syncOutlineSize) gsap.ticker.remove(syncOutlineSize)
        if (handleResize) window.removeEventListener('resize', handleResize)
        if (outlineEl) outlineEl.remove()
      } catch (e) {
        // ignore
      }
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
    })

    tl.eventCallback('onUpdate', () => {
      sequenceController.setIntroProgress(tl.progress())
      updateLoaderIconMask()
    })

    sequenceController.setFrame(0)

    return tl
  } catch (err) {
    return null
  }
}

export function prefetchHomeSequenceBinary() {
  try {
    if (
      typeof window === 'undefined' ||
      !('VideoDecoder' in window) ||
      !('EncodedVideoChunk' in window)
    ) {
      return
    }
    new ActiveFrame(CAVE_AF_URL, { process: () => {} })
  } catch (e) {
    // ignore
  }
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
  cleanupHomeSequenceBindings()
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
    sequenceController = createActiveFrameSequenceController(backgroundInner)
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
    })

    let started = false
    const startPlayback = () => {
      if (started || !window.__homeSequenceTransitionStarted) return
      started = true

      sequenceController.setFrame(0)
      if (typeof sequenceController.repaint === 'function') {
        sequenceController.repaint('transition-start')
      }

      const tl = gsap.timeline({
        onUpdate: () => {
          sequenceController.setIntroProgress(tl.progress())
        },
      })
      window.__homeSequenceTransitionTimeline = tl

      tl.to({}, { duration: 1.6, ease: loaderEase })
      tl.add(() => {
        startHeroAfterLogo(loaderEase, sequenceController, {
          skipHeroAnimation,
          skipContactHero,
          scope: root,
          deferScrollSequence: true,
        })
      })
      tl.to({}, { duration: 0.35, ease: loaderEase })
      tl.add(() => {
        beginScrollDrivenSequence(sequenceController)
        window.__homeSequenceTransitionStarted = false
        window.__homeSequenceTransitionTimeline = null
      })
    }

    sequenceController.ready.then(startPlayback).catch(startPlayback)
    window.setTimeout(startPlayback, 1500)

    return sequenceController
  } catch (e) {
    window.__homeSequenceTransitionStarted = false
    return null
  }
}
