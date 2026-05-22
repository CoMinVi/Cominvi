import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { ActiveFrame } from './active-frame-player.js'
import { initContactHero } from './contact-hero.js'
import { heroAnimation } from './landing.js'
import { initHeroBackgroundParallax } from './parallax.js'

const INTRO_FRAME_COUNT = 126
const SCROLL_RANGE_VH = 100
const CAVE_AF_URL =
  'https://precious-hotteok-8da21f.netlify.app/cave-scene/cave-scene-full-sequence.af'

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
    window.__homeSequenceLenis = null
    window.__homeSequenceLenisHandler = null
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

function createSequenceCanvas(backgroundInner) {
  if (!backgroundInner) return null

  if (getComputedStyle(backgroundInner).position === 'static') {
    backgroundInner.style.position = 'relative'
  }
  backgroundInner.style.overflow = 'hidden'

  const existing = backgroundInner.querySelector(
    '[data-loader-sequence-canvas="true"]'
  )
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

  backgroundInner.appendChild(canvas)
  return canvas
}

function createNoopSequenceController() {
  return {
    ready: Promise.resolve(),
    setIntroProgress: () => {},
    setScrollProgress: () => {},
    setFrame: () => {},
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

  const ctx =
    canvas.getContext('2d', { alpha: false, desynchronized: true }) ||
    canvas.getContext('2d')
  if (!ctx) return createNoopSequenceController()

  const fitCanvas = () => {
    const rect = backgroundInner.getBoundingClientRect()
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const width = Math.max(1, Math.round(rect.width * dpr))
    const height = Math.max(1, Math.round(rect.height * dpr))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
  }

  const drawCover = (frame) => {
    fitCanvas()
    const destW = canvas.width
    const destH = canvas.height
    const srcW = frame.displayWidth || frame.codedWidth
    const srcH = frame.displayHeight || frame.codedHeight
    const scale = Math.max(destW / srcW, destH / srcH)
    const drawW = srcW * scale
    const drawH = srcH * scale
    const offsetX = (destW - drawW) * 0.5
    const offsetY = (destH - drawH) * 0.5

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, destW, destH)
    ctx.drawImage(frame, 0, 0, srcW, srcH, offsetX, offsetY, drawW, drawH)
  }

  let activeFrame = null
  let totalFrames = 0
  let introEndIndex = 0
  let requestedFrame = 0
  let rafToken = 0

  const flushFrameRequest = () => {
    rafToken = 0
    if (!activeFrame || !activeFrame.manifest) return
    const maxFrame = Math.max(0, totalFrames - 1)
    const frame = Math.max(0, Math.min(maxFrame, requestedFrame))
    activeFrame.setFrame(frame)
  }

  const requestFrame = (frame) => {
    requestedFrame = Math.round(frame)
    if (rafToken) return
    rafToken = window.requestAnimationFrame(flushFrameRequest)
  }

  const setIntroProgress = (progress) => {
    if (!totalFrames) return
    const p = Math.max(0, Math.min(progress, 1))
    const frame = Math.round(p * introEndIndex)
    requestFrame(frame)
  }

  const setScrollProgress = (progress) => {
    if (!totalFrames) return
    const p = Math.max(0, Math.min(progress, 1))
    const end = Math.max(0, totalFrames - 1)
    const frame = Math.round(introEndIndex + p * (end - introEndIndex))
    requestFrame(frame)
  }

  const afUrl = CAVE_AF_URL
  const hardwareAcceleration = /\bAndroid\b/i.test(navigator.userAgent || '')
    ? 'prefer-software'
    : 'prefer-hardware'

  activeFrame = new ActiveFrame(afUrl, {
    hardwareAcceleration,
    process: (frame) => {
      drawCover(frame)
    },
  })

  const ready = activeFrame.loading.then(() => {
    totalFrames = Math.max(1, activeFrame.manifest.totalFrames || 1)
    introEndIndex = Math.min(INTRO_FRAME_COUNT - 1, totalFrames - 1)
    fitCanvas()
    requestFrame(0)
  })

  const onResize = () => {
    fitCanvas()
    flushFrameRequest()
  }
  window.addEventListener('resize', onResize)
  window.__homeSequenceResizeCleanup = () => {
    window.removeEventListener('resize', onResize)
  }

  return {
    ready,
    setIntroProgress,
    setScrollProgress,
    setFrame: requestFrame,
    destroy: () => {
      if (rafToken) {
        window.cancelAnimationFrame(rafToken)
        rafToken = 0
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

function initScrollDrivenSequence(sequenceController) {
  const scroller = getHomeSequenceScroller()
  const trigger = scroller === window ? document.documentElement : scroller

  window.__homeSequenceScrollTrigger = ScrollTrigger.create({
    trigger,
    scroller: scroller === window ? undefined : scroller,
    start: 0,
    end: () => `+=${SCROLL_RANGE_VH}vh`,
    scrub: 0.15,
    onUpdate: (self) => {
      sequenceController.setScrollProgress(self.progress)
    },
    onRefresh: (self) => {
      sequenceController.setScrollProgress(self.progress)
    },
  })

  try {
    if (window.lenis && typeof window.lenis.on === 'function') {
      const onLenisScroll = (event) => {
        const distance = window.innerHeight * (SCROLL_RANGE_VH / 100)
        const raw = event && typeof event.scroll === 'number' ? event.scroll : 0
        const progress = Math.max(0, Math.min(raw / distance, 1))
        sequenceController.setScrollProgress(progress)
      }
      window.__homeSequenceLenis = window.lenis
      window.__homeSequenceLenisHandler = onLenisScroll
      window.lenis.on('scroll', onLenisScroll)
    }
  } catch (e) {
    // ignore
  }
}

function startHeroAfterLogo(loaderEase, sequenceController) {
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
    initScrollDrivenSequence(sequenceController)
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

    const loader = document.querySelector('.loader')
    const logoWrap = document.querySelector('.loader-logo_wrap')
    const logoInner = document.querySelector('.logo-inner')
    const logoIcon = document.querySelector('.logo-icon')
    const logoSquare = document.querySelector('.logo-square')
    const textBox = document.querySelector('.is-logo-text')
    const logoText = document.querySelector('.is-logo-text .logo-text')
    const backgroundInner = document.querySelector(
      '.hero-background .background-inner'
    )

    if (
      !loader ||
      !logoWrap ||
      !logoInner ||
      !logoIcon ||
      !logoSquare ||
      !textBox ||
      !logoText ||
      !backgroundInner
    ) {
      return null
    }

    cleanupHomeSequenceBindings()
    const sequenceController =
      createActiveFrameSequenceController(backgroundInner)
    window.__homeSequenceController = sequenceController

    const easeCurve = 'M0,0 C0.6,0 0,1 1,1 '
    const loaderEase = CustomEase.create('loaderEase', easeCurve)
    const logoTargetWidthPx = logoInner.getBoundingClientRect().width || 0
    const textPaths = Array.from(logoText.querySelectorAll('path'))

    gsap.set(loader, { backgroundColor: 'transparent' })
    gsap.set('.loader_mask', { backgroundColor: 'transparent' })
    gsap.set(textBox, { opacity: 0 })
    gsap.set(logoWrap, { backgroundColor: 'transparent' })
    gsap.set(logoSquare, { width: '0%', height: '0%' })

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
    tl.add(() => {
      startHeroAfterLogo(loaderEase, sequenceController)
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

    tl.eventCallback('onUpdate', () => {
      sequenceController.setIntroProgress(tl.progress())
    })

    let started = false
    const startTimeline = () => {
      if (started) return
      started = true
      sequenceController.setFrame(0)
      tl.play(0)
    }

    sequenceController.ready.then(startTimeline).catch(startTimeline)
    window.setTimeout(startTimeline, 1500)

    return tl
  } catch (err) {
    return null
  }
}
