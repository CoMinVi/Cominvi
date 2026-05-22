import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { ActiveFrame } from './active-frame-player.js'
import { initContactHero } from './contact-hero.js'
import { heroAnimation } from './landing.js'
import { initHeroBackgroundParallax } from './parallax.js'

const CAVE_FRAME_START = 120
const CAVE_FRAME_END = 270
const CAVE_FRAME_PATH = '/cave-scene/Cave_scene_v06_1920p_'
const CAVE_AF_PATH = '/cave-scene/cave-scene-full-sequence.af'
const INTRO_END_FRAME_ONE_BASED = 126
const INTRO_END_FRAME_ZERO_BASED = INTRO_END_FRAME_ONE_BASED - 1

function resolveAssetOrigin(video) {
  const fallbackOrigin =
    typeof window !== 'undefined' && window.location
      ? window.location.origin
      : ''

  if (!video) return fallbackOrigin

  const sourceNodes = Array.from(video.querySelectorAll('source'))
  for (const source of sourceNodes) {
    const src = source.getAttribute('src') || source.getAttribute('data-src')
    if (!src) continue
    try {
      return new URL(src, fallbackOrigin || 'http://localhost').origin
    } catch (e) {
      // ignore invalid source URL
    }
  }

  return fallbackOrigin
}

function buildCaveFrameUrls(video) {
  const assetOrigin = resolveAssetOrigin(video)
  const urls = []
  for (let index = CAVE_FRAME_START; index <= CAVE_FRAME_END; index += 1) {
    urls.push(
      `${assetOrigin}${CAVE_FRAME_PATH}${String(index).padStart(5, '0')}.webp`
    )
  }
  return urls
}

function ensureHeroVideoSources(video) {
  if (!video) return

  const sourceNodes = Array.from(video.querySelectorAll('source'))
  sourceNodes.forEach((source) => {
    const dataSrc = source.getAttribute('data-src')
    const src = source.getAttribute('src')
    if (!src && dataSrc) source.setAttribute('src', dataSrc)
  })
}

function createSequenceFrameElement(wrapper) {
  if (!wrapper) return null
  const existing = wrapper.querySelector('[data-loader-sequence-frame="true"]')
  if (existing) return existing

  const img = document.createElement('img')
  img.setAttribute('data-loader-sequence-frame', 'true')
  img.alt = ''
  Object.assign(img.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    display: 'block',
    opacity: '1',
    pointerEvents: 'none',
    zIndex: '1',
  })

  if (getComputedStyle(wrapper).position === 'static') {
    wrapper.style.position = 'relative'
  }
  wrapper.appendChild(img)
  return img
}

function createSequenceCanvasElement(wrapper) {
  if (!wrapper) return null
  const existing = wrapper.querySelector('[data-loader-sequence-canvas="true"]')
  if (existing) return existing

  const canvas = document.createElement('canvas')
  canvas.setAttribute('data-loader-sequence-canvas', 'true')
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    display: 'block',
    pointerEvents: 'none',
    zIndex: '1',
  })

  if (getComputedStyle(wrapper).position === 'static') {
    wrapper.style.position = 'relative'
  }
  wrapper.appendChild(canvas)
  return canvas
}

function getHomeSequenceScroller() {
  try {
    return (
      window.__lenisWrapper || document.querySelector('.page-wrap') || window
    )
  } catch (e) {
    return window
  }
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
    window.__homeSequenceActiveFrame &&
    typeof window.__homeSequenceActiveFrame.destroy === 'function'
  ) {
    try {
      window.__homeSequenceActiveFrame.destroy()
    } catch (e) {
      // ignore
    }
    window.__homeSequenceActiveFrame = null
  }

  if (
    window.__homeSequenceVideoEndedCleanup &&
    typeof window.__homeSequenceVideoEndedCleanup === 'function'
  ) {
    try {
      window.__homeSequenceVideoEndedCleanup()
    } catch (e) {
      // ignore
    }
    window.__homeSequenceVideoEndedCleanup = null
  }
}

function prepareVideoSequenceLayering(video) {
  if (!video) return
  const wrapper = video.closest('.background_video')
  if (!wrapper) return

  if (getComputedStyle(wrapper).position === 'static') {
    wrapper.style.position = 'relative'
  }
  wrapper.style.overflow = 'hidden'

  video.style.position = 'absolute'
  video.style.inset = '0'
  video.style.width = '100%'
  video.style.height = '100%'
  video.style.objectFit = 'cover'
  video.style.objectPosition = 'center center'
  video.style.zIndex = '2'
  video.style.opacity = '1'
  video.style.visibility = 'visible'
}

function bindHideVideoWhenSequenceReady(video, isSequenceReady) {
  if (!video) return () => {}

  let ended = false
  let hidden = false

  const hideVideo = () => {
    if (hidden) return
    hidden = true
    video.style.opacity = '0'
    video.style.visibility = 'hidden'
    video.style.pointerEvents = 'none'
    try {
      video.pause()
    } catch (e) {
      // ignore
    }
  }

  const tryHide = () => {
    if (!ended) return
    if (!isSequenceReady()) return
    hideVideo()
  }

  const onEnded = () => {
    ended = true
    tryHide()
  }

  video.addEventListener('ended', onEnded)

  if (video.ended) {
    ended = true
    tryHide()
  }

  return () => {
    video.removeEventListener('ended', onEnded)
  }
}

function initHomeScrollSequenceFallback(video) {
  if (!video) return
  const wrapper = video.closest('.background_video')
  if (!wrapper) return
  prepareVideoSequenceLayering(video)

  const frames = buildCaveFrameUrls(video)
  if (!frames.length) return

  const sequenceFrame = createSequenceFrameElement(wrapper)
  if (!sequenceFrame) return

  const frameState = frames.map((url, index) => ({
    url,
    index,
    loaded: index === 0,
  }))
  let activeFrameIndex = 0
  let requestedFrameIndex = 0

  const findNearestLoadedIndex = (targetIndex) => {
    if (frameState[targetIndex] && frameState[targetIndex].loaded) {
      return targetIndex
    }
    for (let distance = 1; distance < frameState.length; distance += 1) {
      const prev = targetIndex - distance
      const next = targetIndex + distance
      if (prev >= 0 && frameState[prev].loaded) return prev
      if (next < frameState.length && frameState[next].loaded) return next
    }
    return 0
  }

  const renderFrameByIndex = (index) => {
    const clamped = Math.max(0, Math.min(index, frames.length - 1))
    if (clamped === activeFrameIndex && sequenceFrame.getAttribute('src')) {
      return
    }
    activeFrameIndex = clamped
    sequenceFrame.src = frameState[clamped].url
  }

  const setFrame = (index) => {
    const clamped = Math.max(0, Math.min(index, frames.length - 1))
    requestedFrameIndex = clamped
    const bestLoaded = findNearestLoadedIndex(clamped)
    renderFrameByIndex(bestLoaded)
  }

  renderFrameByIndex(0)

  const isSequenceReady = () => !!sequenceFrame.getAttribute('src')
  window.__homeSequenceVideoEndedCleanup = bindHideVideoWhenSequenceReady(
    video,
    isSequenceReady
  )

  frames.slice(1).forEach((url, localIndex) => {
    const img = new Image()
    const frameIndex = localIndex + 1
    img.decoding = 'async'
    img.loading = 'eager'
    img.fetchPriority = frameIndex < 24 ? 'high' : 'auto'
    img.addEventListener('load', () => {
      frameState[frameIndex].loaded = true
      if (frameIndex === requestedFrameIndex) {
        renderFrameByIndex(frameIndex)
      }
    })
    img.src = url
  })

  cleanupHomeSequenceBindings()
  const scroller = getHomeSequenceScroller()
  const trigger = scroller === window ? document.documentElement : scroller
  window.__homeSequenceScrollTrigger = ScrollTrigger.create({
    trigger,
    scroller: scroller === window ? undefined : scroller,
    start: 0,
    end: () => window.innerHeight,
    scrub: 0.2,
    onUpdate: (self) => {
      const index = Math.round(self.progress * (frames.length - 1))
      setFrame(index)
    },
    onRefresh: (self) => {
      const index = Math.round(self.progress * (frames.length - 1))
      setFrame(index)
    },
  })

  // Fallback robuste: synchroniser aussi depuis Lenis directement.
  // Utile si ScrollTrigger ne reçoit pas tous les ticks sur certains devices.
  try {
    if (window.lenis && typeof window.lenis.on === 'function') {
      const onLenisScroll = (event) => {
        const raw = event && typeof event.scroll === 'number' ? event.scroll : 0
        const progress = Math.max(0, Math.min(raw / window.innerHeight, 1))
        const index = Math.round(progress * (frames.length - 1))
        setFrame(index)
      }
      window.__homeSequenceLenis = window.lenis
      window.__homeSequenceLenisHandler = onLenisScroll
      window.lenis.on('scroll', onLenisScroll)
    }
  } catch (e) {
    // ignore
  }
}

function initHomeScrollSequence(video) {
  if (!video) return

  const wrapper = video.closest('.background_video')
  if (!wrapper) return
  prepareVideoSequenceLayering(video)

  const hasWebCodecs =
    typeof window !== 'undefined' &&
    'VideoDecoder' in window &&
    'EncodedVideoChunk' in window

  if (!hasWebCodecs) {
    initHomeScrollSequenceFallback(video)
    return
  }

  cleanupHomeSequenceBindings()

  const canvas = createSequenceCanvasElement(wrapper)
  if (!canvas) {
    initHomeScrollSequenceFallback(video)
    return
  }

  const ctx =
    canvas.getContext('2d', { alpha: false, desynchronized: true }) ||
    canvas.getContext('2d')
  if (!ctx) {
    initHomeScrollSequenceFallback(video)
    return
  }

  const fitCanvasToWrapper = () => {
    const rect = wrapper.getBoundingClientRect()
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const nextWidth = Math.max(1, Math.round(rect.width * dpr))
    const nextHeight = Math.max(1, Math.round(rect.height * dpr))
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth
      canvas.height = nextHeight
    }
  }

  const drawImageCover = (frame) => {
    fitCanvasToWrapper()
    const destW = canvas.width
    const destH = canvas.height
    const sw = frame.displayWidth || frame.codedWidth
    const sh = frame.displayHeight || frame.codedHeight
    const scale = Math.max(destW / sw, destH / sh)
    const tw = sw * scale
    const th = sh * scale
    const ox = (destW - tw) * 0.5
    const oy = (destH - th) * 0.5

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, destW, destH)
    ctx.drawImage(frame, 0, 0, sw, sh, ox, oy, tw, th)
  }

  let pendingProgress = 0
  let firstFrameRendered = false
  let activeFrame = null
  window.__homeSequenceVideoEndedCleanup = bindHideVideoWhenSequenceReady(
    video,
    () => firstFrameRendered
  )

  const assetOrigin = resolveAssetOrigin(video)
  const afUrl = `${assetOrigin}${CAVE_AF_PATH}`
  const hardwareAcceleration = /\bAndroid\b/i.test(navigator.userAgent || '')
    ? 'prefer-software'
    : 'prefer-hardware'

  const setProgress = (progress) => {
    pendingProgress = Math.max(0, Math.min(progress, 1))
    if (!activeFrame || !activeFrame.manifest) return
    const target = Math.round(
      pendingProgress * Math.max(0, activeFrame.manifest.totalFrames - 1)
    )
    activeFrame.setFrame(target)
  }

  try {
    activeFrame = new ActiveFrame(afUrl, {
      hardwareAcceleration,
      process: (frame) => {
        drawImageCover(frame)
        if (!firstFrameRendered) firstFrameRendered = true
      },
    })
  } catch (e) {
    initHomeScrollSequenceFallback(video)
    return
  }

  window.__homeSequenceActiveFrame = activeFrame
  activeFrame.loading
    .then(() => {
      setProgress(0)
      requestAnimationFrame(() => setProgress(pendingProgress))
    })
    .catch(() => {
      cleanupHomeSequenceBindings()
      initHomeScrollSequenceFallback(video)
    })

  const scroller = getHomeSequenceScroller()
  const trigger = scroller === window ? document.documentElement : scroller
  window.__homeSequenceScrollTrigger = ScrollTrigger.create({
    trigger,
    scroller: scroller === window ? undefined : scroller,
    start: 0,
    end: () => window.innerHeight,
    scrub: 0.15,
    onUpdate: (self) => {
      setProgress(self.progress)
    },
    onRefresh: (self) => {
      setProgress(self.progress)
    },
  })

  try {
    if (window.lenis && typeof window.lenis.on === 'function') {
      const onLenisScroll = (event) => {
        const raw = event && typeof event.scroll === 'number' ? event.scroll : 0
        const progress = Math.max(0, Math.min(raw / window.innerHeight, 1))
        setProgress(progress)
      }
      window.__homeSequenceLenis = window.lenis
      window.__homeSequenceLenisHandler = onLenisScroll
      window.lenis.on('scroll', onLenisScroll)
    }
  } catch (e) {
    // ignore
  }

  const onResize = () => {
    fitCanvasToWrapper()
    setProgress(pendingProgress)
  }
  window.addEventListener('resize', onResize)
  window.__homeSequenceResizeCleanup = () => {
    window.removeEventListener('resize', onResize)
  }
}

function initUnifiedActiveFrameSequence(video) {
  const noopController = {
    setIntroProgress: () => {},
    activateScrollRange: () => {},
  }

  if (!video) return noopController
  const wrapper = video.closest('.background_video')
  if (!wrapper) return noopController

  const hasWebCodecs =
    typeof window !== 'undefined' &&
    'VideoDecoder' in window &&
    'EncodedVideoChunk' in window
  if (!hasWebCodecs) return noopController

  cleanupHomeSequenceBindings()
  prepareVideoSequenceLayering(video)
  ensureHeroVideoSources(video)

  const canvas = createSequenceCanvasElement(wrapper)
  if (!canvas) return noopController

  const ctx =
    canvas.getContext('2d', { alpha: false, desynchronized: true }) ||
    canvas.getContext('2d')
  if (!ctx) return noopController

  const fitCanvasToWrapper = () => {
    const rect = wrapper.getBoundingClientRect()
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const nextWidth = Math.max(1, Math.round(rect.width * dpr))
    const nextHeight = Math.max(1, Math.round(rect.height * dpr))
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth
      canvas.height = nextHeight
    }
  }

  const drawImageCover = (frame) => {
    fitCanvasToWrapper()
    const destW = canvas.width
    const destH = canvas.height
    const sw = frame.displayWidth || frame.codedWidth
    const sh = frame.displayHeight || frame.codedHeight
    const scale = Math.max(destW / sw, destH / sh)
    const tw = sw * scale
    const th = sh * scale
    const ox = (destW - tw) * 0.5
    const oy = (destH - th) * 0.5
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, destW, destH)
    ctx.drawImage(frame, 0, 0, sw, sh, ox, oy, tw, th)
  }

  const assetOrigin = resolveAssetOrigin(video)
  const afUrl = `${assetOrigin}${CAVE_AF_PATH}`
  const hardwareAcceleration = /\bAndroid\b/i.test(navigator.userAgent || '')
    ? 'prefer-software'
    : 'prefer-hardware'

  let activeFrame = null
  let isLoaded = false
  let totalFrames = 0
  let pendingFrameIndex = 0
  let pendingIntroProgress = 0
  const clamp01 = (value) => Math.max(0, Math.min(value, 1))

  const renderFrameIndex = (index) => {
    pendingFrameIndex = Math.max(0, Math.round(index))
    if (!isLoaded || !activeFrame || !activeFrame.manifest) return
    const maxFrame = Math.max(0, totalFrames - 1)
    activeFrame.setFrame(Math.max(0, Math.min(pendingFrameIndex, maxFrame)))
  }

  const setIntroProgress = (progress) => {
    pendingIntroProgress = clamp01(progress)
    if (!isLoaded || !totalFrames) return
    const introEnd = Math.min(INTRO_END_FRAME_ZERO_BASED, totalFrames - 1)
    const frame = Math.round(pendingIntroProgress * introEnd)
    renderFrameIndex(frame)
  }

  const activateScrollRange = () => {
    if (!isLoaded || !totalFrames) return
    cleanupHomeSequenceBindings()
    window.__homeSequenceActiveFrame = activeFrame

    const startFrame = Math.min(INTRO_END_FRAME_ZERO_BASED, totalFrames - 1)
    const endFrame = Math.max(startFrame, totalFrames - 1)
    renderFrameIndex(startFrame)

    const scroller = getHomeSequenceScroller()
    const trigger = scroller === window ? document.documentElement : scroller
    window.__homeSequenceScrollTrigger = ScrollTrigger.create({
      trigger,
      scroller: scroller === window ? undefined : scroller,
      start: 0,
      end: () => window.innerHeight,
      scrub: 0.15,
      onUpdate: (self) => {
        const progress = clamp01(self.progress)
        const frame = Math.round(
          startFrame + progress * (endFrame - startFrame)
        )
        renderFrameIndex(frame)
      },
      onRefresh: (self) => {
        const progress = clamp01(self.progress)
        const frame = Math.round(
          startFrame + progress * (endFrame - startFrame)
        )
        renderFrameIndex(frame)
      },
    })

    try {
      if (window.lenis && typeof window.lenis.on === 'function') {
        const onLenisScroll = (event) => {
          const raw =
            event && typeof event.scroll === 'number' ? event.scroll : 0
          const progress = clamp01(raw / window.innerHeight)
          const frame = Math.round(
            startFrame + progress * (endFrame - startFrame)
          )
          renderFrameIndex(frame)
        }
        window.__homeSequenceLenis = window.lenis
        window.__homeSequenceLenisHandler = onLenisScroll
        window.lenis.on('scroll', onLenisScroll)
      }
    } catch (e) {
      // ignore
    }
  }

  try {
    activeFrame = new ActiveFrame(afUrl, {
      hardwareAcceleration,
      process: (frame) => {
        drawImageCover(frame)
      },
    })
  } catch (e) {
    return noopController
  }

  activeFrame.loading
    .then(() => {
      isLoaded = true
      totalFrames = Math.max(1, activeFrame.manifest.totalFrames || 1)
      window.__homeSequenceActiveFrame = activeFrame
      renderFrameIndex(0)
      setIntroProgress(pendingIntroProgress)
      video.style.opacity = '0'
      video.style.visibility = 'hidden'
      video.style.pointerEvents = 'none'
      try {
        video.pause()
      } catch (e) {
        // ignore
      }
    })
    .catch(() => {
      isLoaded = false
    })

  const onResize = () => {
    fitCanvasToWrapper()
    renderFrameIndex(pendingFrameIndex)
  }
  window.addEventListener('resize', onResize)
  window.__homeSequenceResizeCleanup = () => {
    window.removeEventListener('resize', onResize)
  }

  return {
    setIntroProgress,
    activateScrollRange,
  }
}

function startHeroAfterLogo(loaderEase, heroVideo, sequenceController) {
  try {
    heroAnimation()
  } catch (e) {
    // ignore
  }
  try {
    initContactHero(document, {
      animate: true,
      duration: 1.2,
      ease: loaderEase,
    })
  } catch (e) {
    // ignore
  }
  try {
    initHeroBackgroundParallax(document)
  } catch (e) {
    // ignore
  }

  requestAnimationFrame(() => {
    if (
      sequenceController &&
      typeof sequenceController.activateScrollRange === 'function'
    ) {
      sequenceController.activateScrollRange()
    } else {
      initHomeScrollSequence(heroVideo)
    }
    try {
      ScrollTrigger.refresh()
    } catch (e) {
      // ignore
    }
  })
}

export function initLoader() {
  try {
    gsap.registerPlugin(CustomEase, ScrollTrigger)

    const easeCurve = 'M0,0 C0.6,0 0,1 1,1 '
    const loaderEase = CustomEase.create('loaderEase', easeCurve)
    const loader = document.querySelector('.loader')
    const logoWrap = document.querySelector('.loader-logo_wrap')
    const logoInner = document.querySelector('.logo-inner')
    const logoIcon = document.querySelector('.logo-icon')
    const logoSquare = document.querySelector('.logo-square')
    const textBox = document.querySelector('.is-logo-text')
    const logoText = document.querySelector('.is-logo-text .logo-text')
    const heroVideo = document.querySelector(
      '.hero-background .background_video video'
    )

    if (
      !loader ||
      !logoWrap ||
      !logoInner ||
      !logoIcon ||
      !logoSquare ||
      !textBox ||
      !logoText
    ) {
      return null
    }

    ensureHeroVideoSources(heroVideo)
    const sequenceController = initUnifiedActiveFrameSequence(heroVideo)

    const logoTargetWidthPx = logoInner.getBoundingClientRect().width || 0
    const textPaths = Array.from(logoText.querySelectorAll('path'))

    gsap.set(loader, { backgroundColor: 'transparent' })
    gsap.set('.loader_mask', { backgroundColor: 'transparent' })
    gsap.set(textBox, { opacity: 0 })
    gsap.set(logoWrap, { backgroundColor: 'transparent' })
    gsap.set(logoSquare, { width: '0%', height: '0%' })

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
    tl.from(
      logoIcon,
      {
        yPercent: 100,
        rotation: 70,
        transformOrigin: '50% 50%',
        duration: 0.8,
      },
      0
    )
    tl.to(textBox, { opacity: 1, duration: 0.3 }, '>')
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

    tl.eventCallback('onUpdate', () => {
      try {
        if (
          sequenceController &&
          typeof sequenceController.setIntroProgress === 'function'
        ) {
          sequenceController.setIntroProgress(tl.progress())
        }
      } catch (e) {
        // ignore
      }
    })

    tl.add(() => {
      startHeroAfterLogo(loaderEase, heroVideo, sequenceController)
    })
    tl.to(loader, { autoAlpha: 0, duration: 0.35 })
    tl.add(() => {
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
    })

    return tl
  } catch (err) {
    return null
  }
}
