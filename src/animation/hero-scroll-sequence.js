import { afResizeLog } from '../app/af-resize-debug.js'
import { getScrollFrameCount, getScrollFrameUrl } from './hero-manifest.js'

const SCROLL_FRAME_HYSTERESIS = 0.2

function createImageLoader() {
  const cache = new Map()
  const inflight = new Map()

  const load = (url) => {
    if (!url) return Promise.resolve(null)
    if (cache.has(url)) return Promise.resolve(cache.get(url))

    if (inflight.has(url)) return inflight.get(url)

    const promise = new Promise((resolve) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => {
        cache.set(url, img)
        inflight.delete(url)
        resolve(img)
      }
      img.onerror = () => {
        inflight.delete(url)
        resolve(null)
      }
      img.src = url
    })

    inflight.set(url, promise)
    return promise
  }

  return {
    load,
    get(url) {
      return cache.get(url) || null
    },
    has(url) {
      return cache.has(url)
    },
  }
}

export function createHeroScrollSequence({
  backgroundInner,
  variant,
  manifest,
  indexPad = 5,
}) {
  const noop = {
    ready: Promise.resolve(),
    setProgress: () => {},
    setFrame: () => {},
    show: () => {},
    hide: () => {},
    repaint: () => false,
    destroy: () => {},
  }

  if (!backgroundInner || !variant?.scroll) return noop

  const mediaHost =
    backgroundInner.querySelector('.background_video') || backgroundInner

  if (getComputedStyle(mediaHost).position === 'static') {
    mediaHost.style.position = 'relative'
  }
  mediaHost.style.overflow = 'hidden'

  let canvas =
    mediaHost.querySelector('[data-loader-sequence-canvas="true"]') || null

  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.setAttribute('data-loader-sequence-canvas', 'true')
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      display: 'block',
      pointerEvents: 'none',
      zIndex: '3',
      opacity: '0',
      visibility: 'hidden',
    })
    mediaHost.appendChild(canvas)
  }

  const ctx =
    canvas.getContext('2d', { alpha: false, willReadFrequently: true }) ||
    canvas.getContext('2d')

  if (!ctx) return noop

  const scrollConfig = variant.scroll
  const frameCount = Math.max(1, getScrollFrameCount(variant, manifest))
  const images = createImageLoader()
  let requestedFrame = 0
  let hysteresisFrame = null
  let hasRenderedFrame = false
  let rafToken = 0

  const fitCanvas = () => {
    const rect = mediaHost.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) return false

    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const width = Math.max(1, Math.round(rect.width * dpr))
    const height = Math.max(1, Math.round(rect.height * dpr))

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    return true
  }

  const drawCoverImage = (source, srcW, srcH) => {
    if (!source || !srcW || !srcH) return false
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
    return true
  }

  const getFrameUrl = (index) =>
    getScrollFrameUrl(scrollConfig, index, indexPad)

  const preloadFrame = (index) => {
    const url = getFrameUrl(index)
    if (!url) return Promise.resolve(null)
    return images.load(url)
  }

  const preloadInitialBatches = async () => {
    const firstBatchCount = scrollConfig.batches?.[0]?.count || 30
    const secondBatchCount = scrollConfig.batches?.[1]?.count || 0
    const total = Math.min(
      frameCount,
      Math.max(firstBatchCount, 1) + Math.max(secondBatchCount, 0)
    )

    const jobs = []
    for (let i = 0; i < total; i += 1) {
      jobs.push(preloadFrame(i))
    }
    await Promise.all(jobs)
  }

  const preloadAround = (index) => {
    const ahead = 12
    const behind = 4
    const start = Math.max(0, index - behind)
    const end = Math.min(frameCount - 1, index + ahead)
    for (let i = start; i <= end; i += 1) {
      preloadFrame(i)
    }
  }

  const paintFrame = (index, reason = 'paint') => {
    const url = getFrameUrl(index)
    const img = images.get(url)

    if (!img) {
      preloadFrame(index).then((loaded) => {
        if (!loaded) return
        if (requestedFrame === index) {
          paintFrame(index, `${reason}-async`)
        }
      })
      return false
    }

    const painted = drawCoverImage(img, img.naturalWidth, img.naturalHeight)
    if (!painted) return false

    canvas.style.opacity = '1'
    canvas.style.visibility = 'visible'
    hasRenderedFrame = true
    afResizeLog('hero-scroll:paint', { reason, index })
    return true
  }

  const flushFrame = () => {
    rafToken = 0
    const frame = Math.max(0, Math.min(frameCount - 1, requestedFrame))
    preloadAround(frame)
    paintFrame(frame, 'flush')
  }

  const requestFrame = (frame) => {
    requestedFrame = Math.round(frame)
    if (rafToken) return
    rafToken = window.requestAnimationFrame(flushFrame)
  }

  const resolveFrameFromProgress = (progress) => {
    const p = Math.max(0, Math.min(Number(progress) || 0, 1))
    const end = Math.max(0, frameCount - 1)
    const raw = p * end

    if (hysteresisFrame == null) {
      hysteresisFrame = Math.round(raw)
      return hysteresisFrame
    }

    let next = hysteresisFrame
    if (raw >= hysteresisFrame + 1 + SCROLL_FRAME_HYSTERESIS) {
      next = Math.floor(raw - SCROLL_FRAME_HYSTERESIS + 1e-6)
    } else if (raw < hysteresisFrame - SCROLL_FRAME_HYSTERESIS) {
      next = Math.floor(raw + SCROLL_FRAME_HYSTERESIS + 1e-6)
    }

    next = Math.max(0, Math.min(end, next))
    hysteresisFrame = next
    return next
  }

  const ready = preloadInitialBatches()

  return {
    ready,
    frameCount,
    setProgress(progress) {
      const frame = resolveFrameFromProgress(progress)
      requestFrame(frame)
    },
    setFrame(frame) {
      hysteresisFrame = null
      requestFrame(frame)
    },
    show() {
      if (hasRenderedFrame) {
        canvas.style.opacity = '1'
        canvas.style.visibility = 'visible'
      }
    },
    hide() {
      canvas.style.opacity = '0'
      canvas.style.visibility = 'hidden'
    },
    repaint(reason = 'repaint') {
      fitCanvas()
      return paintFrame(requestedFrame, reason)
    },
    destroy() {
      if (rafToken) {
        window.cancelAnimationFrame(rafToken)
        rafToken = 0
      }
      try {
        canvas.remove()
      } catch (e) {
        // ignore
      }
    },
  }
}
