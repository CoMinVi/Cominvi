import { afResizeLog } from '../app/af-resize-debug.js'
import { getScrollFrameCount, getScrollFrameUrl } from './hero-manifest.js'

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
      img.crossOrigin = 'anonymous'
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
    lockSurfaceForLeave: () => false,
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
  let paintedFrame = -1
  let rafToken = 0
  let surfaceLocked = false

  let displayImg = null
  let displayImgUrl = null
  let frameSnapshot = null
  let frameSnapshotCtx = null
  let frameSnapshotW = 0
  let frameSnapshotH = 0

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
      display: 'block',
      objectFit: 'cover',
      objectPosition: 'center center',
      pointerEvents: 'none',
      zIndex: '4',
      opacity: '0',
      visibility: 'hidden',
    })
    mediaHost.appendChild(displayImg)
    afResizeLog('hero-scroll:displayImg-created')
    return displayImg
  }

  const hideDisplayImg = (reason = 'unknown') => {
    if (!displayImg) return
    displayImg.style.opacity = '0'
    displayImg.style.visibility = 'hidden'
    afResizeLog('hero-scroll:displayImg-hidden', { reason })
  }

  const showDisplayImg = (reason = 'unknown') => {
    ensureDisplayImg()
    displayImg.style.opacity = '1'
    displayImg.style.visibility = 'visible'
    afResizeLog('hero-scroll:displayImg-shown', { reason })
  }

  const cacheFrameSnapshot = (source, srcW, srcH) => {
    if (!source || !srcW || !srcH) return false

    if (!frameSnapshot) {
      frameSnapshot = document.createElement('canvas')
      frameSnapshotCtx = frameSnapshot.getContext('2d', { alpha: false })
    }
    if (!frameSnapshotCtx) return false

    if (frameSnapshot.width !== srcW || frameSnapshot.height !== srcH) {
      frameSnapshot.width = srcW
      frameSnapshot.height = srcH
    }

    frameSnapshotCtx.setTransform(1, 0, 0, 1, 0, 0)
    frameSnapshotCtx.clearRect(0, 0, srcW, srcH)
    frameSnapshotCtx.drawImage(source, 0, 0, srcW, srcH)
    frameSnapshotW = srcW
    frameSnapshotH = srcH
    return true
  }

  const syncDisplayImgFromSnapshotSync = (reason = 'unknown') => {
    if (!frameSnapshot || !frameSnapshotW || !frameSnapshotH) {
      afResizeLog('hero-scroll:displayImg-skip-no-snapshot', { reason })
      return false
    }

    ensureDisplayImg()

    try {
      if (displayImgUrl) {
        URL.revokeObjectURL(displayImgUrl)
        displayImgUrl = null
      }
      displayImg.src = frameSnapshot.toDataURL('image/jpeg', 0.92)
      showDisplayImg(reason)
      return true
    } catch (e) {
      afResizeLog('hero-scroll:displayImg-error', {
        reason,
        message: e?.message,
      })
      return false
    }
  }

  const syncDisplayImgFromSnapshot = (reason = 'unknown') => {
    if (!frameSnapshot || !frameSnapshotW || !frameSnapshotH) {
      afResizeLog('hero-scroll:displayImg-skip-no-snapshot', { reason })
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
          showDisplayImg(reason)
        },
        'image/jpeg',
        0.92
      )
      return true
    } catch (e) {
      afResizeLog('hero-scroll:displayImg-error', {
        reason,
        message: e?.message,
      })
      return false
    }
  }

  const nudgeSurfaceComposite = () => {
    try {
      canvas.style.transform = 'translateZ(0)'
      void canvas.offsetHeight
    } catch (e) {
      // ignore
    }
  }

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

  const paintCachedSnapshot = (reason = 'unknown') => {
    if (!frameSnapshot || !frameSnapshotW || !frameSnapshotH) {
      afResizeLog('hero-scroll:snapshot-miss', { reason })
      return false
    }

    drawCoverImage(frameSnapshot, frameSnapshotW, frameSnapshotH)
    syncDisplayImgFromSnapshot(reason)
    canvas.style.opacity = '1'
    canvas.style.visibility = 'visible'
    afResizeLog('hero-scroll:snapshot-painted', { reason })
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
    const ahead = 24
    const behind = 6
    const start = Math.max(0, index - behind)
    const end = Math.min(frameCount - 1, index + ahead)
    for (let i = start; i <= end; i += 1) {
      preloadFrame(i)
    }
  }

  const paintFrame = (index, reason = 'paint') => {
    if (surfaceLocked) return false

    const url = getFrameUrl(index)
    const img = images.get(url)

    if (!img) {
      preloadFrame(index).then((loaded) => {
        if (!loaded || surfaceLocked) return
        if (requestedFrame === index) {
          paintFrame(index, `${reason}-async`)
        }
      })
      return false
    }

    const painted = drawCoverImage(img, img.naturalWidth, img.naturalHeight)
    if (!painted) return false

    cacheFrameSnapshot(img, img.naturalWidth, img.naturalHeight)
    hideDisplayImg(`${reason}-canvas-active`)
    paintedFrame = index
    canvas.style.opacity = '1'
    canvas.style.visibility = 'visible'
    nudgeSurfaceComposite()
    afResizeLog('hero-scroll:paint', { reason, index })
    return true
  }

  const flushFrame = () => {
    rafToken = 0
    const frame = Math.max(0, Math.min(frameCount - 1, requestedFrame))
    preloadAround(frame)
    paintFrame(frame, 'flush')
  }

  const schedulePaint = () => {
    if (rafToken || surfaceLocked) return
    rafToken = window.requestAnimationFrame(flushFrame)
  }

  const requestFrame = (frame) => {
    const next = Math.max(0, Math.min(frameCount - 1, Math.round(frame)))
    if (next === requestedFrame && next === paintedFrame) return

    requestedFrame = next
    preloadAround(next)

    const url = getFrameUrl(next)
    if (images.has(url)) {
      if (rafToken) {
        window.cancelAnimationFrame(rafToken)
        rafToken = 0
      }
      paintFrame(next, 'sync')
      return
    }

    schedulePaint()
  }

  const resolveFrameFromProgress = (progress) => {
    const p = Math.max(0, Math.min(Number(progress) || 0, 1))
    const end = Math.max(0, frameCount - 1)
    return Math.round(p * end)
  }

  const ready = preloadInitialBatches()

  return {
    ready,
    frameCount,
    setProgress(progress) {
      if (surfaceLocked) return
      requestFrame(resolveFrameFromProgress(progress))
    },
    setFrame(frame) {
      if (surfaceLocked) return
      requestFrame(frame)
    },
    show() {
      if (surfaceLocked) {
        showDisplayImg('show-while-locked')
        return
      }
      canvas.style.opacity = '1'
      canvas.style.visibility = 'visible'
    },
    hide() {
      canvas.style.opacity = '0'
      canvas.style.visibility = 'hidden'
      hideDisplayImg('hide')
    },
    repaint(reason = 'repaint') {
      if (surfaceLocked) {
        return syncDisplayImgFromSnapshot(reason)
      }

      if (paintedFrame >= 0 && paintCachedSnapshot(reason)) {
        nudgeSurfaceComposite()
        return true
      }

      return paintFrame(requestedFrame, reason)
    },
    lockSurfaceForLeave(reason = 'transition-leave-freeze') {
      surfaceLocked = true

      if (rafToken) {
        window.cancelAnimationFrame(rafToken)
        rafToken = 0
      }

      if (paintedFrame < 0) {
        paintFrame(requestedFrame, `${reason}-prime`)
      }

      if (!frameSnapshot || !frameSnapshotW || !frameSnapshotH) {
        return false
      }

      syncDisplayImgFromSnapshotSync(reason)
      canvas.style.opacity = '0'
      canvas.style.visibility = 'hidden'
      afResizeLog('hero-scroll:lock-surface', {
        reason,
        requestedFrame,
        paintedFrame,
      })
      return true
    },
    destroy() {
      surfaceLocked = false
      if (rafToken) {
        window.cancelAnimationFrame(rafToken)
        rafToken = 0
      }
      if (displayImgUrl) {
        URL.revokeObjectURL(displayImgUrl)
        displayImgUrl = null
      }
      try {
        displayImg?.remove()
      } catch (e) {
        // ignore
      }
      displayImg = null
      try {
        canvas.remove()
      } catch (e) {
        // ignore
      }
    },
  }
}
