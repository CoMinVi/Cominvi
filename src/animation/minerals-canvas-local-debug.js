import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { ActiveFrame } from './active-frame-player.js'
import { buildMineralsLocalUrls } from './minerals-frame-urls.js'
import { getCanvasPixelRatio } from './scroll-performance.js'

gsap.registerPlugin(ScrollTrigger)

const LOG = '[minerals-canvas]'
const ALLOWED_NAMESPACES = new Set(['home', 'services'])
const LOOP_COUNT = 1
const SCRUB_SMOOTHING = 0.4
const ENABLE_FRAME_BLEND = false
const DEFAULT_MINERALS_AF_PATH =
  'https://cominvi.netlify.app/minerals/minerals-sequence.af'
const DEFAULT_MINERALS_TOTAL_FRAMES = 600
const DEFAULT_INITIAL_PRELOAD = 40
const DEFAULT_PRELOAD_AHEAD = 6
const DEFAULT_PRELOAD_BEHIND = 2
const DEFAULT_MEDIUM_PRELOAD_AHEAD = 16
const DEFAULT_FAST_PRELOAD_AHEAD = 32
const DEFAULT_MAX_LOAD_PLAN = 40
const DEFAULT_BACKGROUND_BATCH_SIZE = 60
const DEFAULT_CONCURRENCY = 4
const DEFAULT_ACTIVE_CONCURRENCY = 6

function clampIndex(index, total) {
  return Math.max(0, Math.min(total - 1, index))
}

function addPlanItem(plan, seen, index, total, highPriority) {
  const normalizedIndex = clampIndex(index, total)
  if (seen.has(normalizedIndex)) return
  seen.add(normalizedIndex)
  plan.push({ index: normalizedIndex, highPriority: !!highPriority })
}

export function getMineralsFrameLoadPlan({
  targetIndex,
  previousIndex = targetIndex,
  total,
  baseAhead = DEFAULT_PRELOAD_AHEAD,
  baseBehind = DEFAULT_PRELOAD_BEHIND,
  mediumAhead = DEFAULT_MEDIUM_PRELOAD_AHEAD,
  fastAhead = DEFAULT_FAST_PRELOAD_AHEAD,
  maxPlan = DEFAULT_MAX_LOAD_PLAN,
} = {}) {
  const frameCount = Math.max(0, Math.floor(total || 0))
  if (!frameCount) return []

  const target = clampIndex(Math.floor(targetIndex || 0), frameCount)
  const previous = clampIndex(Math.floor(previousIndex || 0), frameCount)
  const delta = target - previous
  const direction = delta >= 0 ? 1 : -1
  const speed = Math.abs(delta)
  const ahead = speed >= 24 ? fastAhead : speed >= 8 ? mediumAhead : baseAhead
  const boundedMaxPlan = Math.max(1, Math.min(frameCount, maxPlan))
  const plan = []
  const seen = new Set()

  addPlanItem(plan, seen, target, frameCount, true)

  for (
    let offset = 1;
    offset <= ahead && plan.length < boundedMaxPlan;
    offset += 1
  ) {
    addPlanItem(plan, seen, target + direction * offset, frameCount, true)
  }

  for (
    let offset = 1;
    offset <= baseBehind && plan.length < boundedMaxPlan;
    offset += 1
  ) {
    addPlanItem(plan, seen, target - direction * offset, frameCount, false)
  }

  return plan
}

export function getMineralsBatchPreloadPlan({
  total,
  startIndex = 0,
  batchSize = DEFAULT_BACKGROUND_BATCH_SIZE,
} = {}) {
  const frameCount = Math.max(0, Math.floor(total || 0))
  if (!frameCount) return []

  const start = Math.max(0, Math.floor(startIndex || 0))
  const size = Math.max(1, Math.floor(batchSize || 1))
  if (start >= frameCount) return []

  const plan = []
  const seen = new Set()

  for (
    let index = start;
    index < frameCount && index < start + size;
    index += 1
  ) {
    addPlanItem(plan, seen, index, frameCount, false)
  }

  return plan
}

export function getMineralsInitialPreloadCount({
  requestedCount,
  minimumCount = DEFAULT_INITIAL_PRELOAD,
  total,
} = {}) {
  const frameCount = Math.max(0, Math.floor(total || 0))
  if (!frameCount) return 0

  const requested = Math.max(1, Math.floor(requestedCount || 0))
  const minimum = Math.max(1, Math.floor(minimumCount || 1))
  return Math.min(frameCount, Math.max(requested, minimum))
}

export function shouldKeepMineralsQueuedIndex({
  index,
  plannedIndices,
  initialPreloadIndices,
  backgroundBatchIndices,
} = {}) {
  return !!(
    (plannedIndices && plannedIndices.has(index)) ||
    (initialPreloadIndices && initialPreloadIndices.has(index)) ||
    (backgroundBatchIndices && backgroundBatchIndices.has(index))
  )
}

function info(...args) {
  // eslint-disable-next-line no-console
  console.log(LOG, ...args)
}

function err(...args) {
  // eslint-disable-next-line no-console
  console.error(LOG, ...args)
}

function parsePositiveInt(raw, fallback) {
  const n = parseInt(String(raw || ''), 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

function getContainer(scope) {
  if (
    scope &&
    scope.getAttribute &&
    scope.getAttribute('data-barba') === 'container'
  ) {
    return scope
  }
  if (!scope || !scope.querySelector) return null
  return scope.querySelector('[data-barba="container"]')
}

function isAllowedPage(scope) {
  const container = getContainer(scope || document)
  if (!container) return false
  const ns = (container.getAttribute('data-barba-namespace') || '')
    .trim()
    .toLowerCase()
  return ALLOWED_NAMESPACES.has(ns)
}

function getBreakpoint() {
  const width = window.innerWidth || document.documentElement.clientWidth || 0
  if (width <= 767) return 'mobile'
  if (width <= 991) return 'tablet'
  return 'desktop'
}

export function initMineralsCanvas(root = document) {
  try {
    if (!isAllowedPage(root)) return null

    const scope = root && root.querySelector ? root : document
    const component = scope.querySelector('[fc-image-scrubbing="component"]')
    if (!component) return null

    const getAttrFromComponentOrScope = (attrName) => {
      const own = component.getAttribute(attrName)
      if (own) return own
      const holder = scope.querySelector(`[${attrName}]`)
      return holder ? holder.getAttribute(attrName) : ''
    }

    const bp = getBreakpoint()
    const afUrl = DEFAULT_MINERALS_AF_PATH

    const hasWebCodecs =
      typeof window !== 'undefined' &&
      'VideoDecoder' in window &&
      'EncodedVideoChunk' in window
    const shouldUseAf = !!afUrl && hasWebCodecs

    let urls = []
    if (!shouldUseAf) {
      const fallbackFrameCount = parsePositiveInt(
        getAttrFromComponentOrScope('fc-image-scrubbing-total-frames'),
        DEFAULT_MINERALS_TOTAL_FRAMES
      )
      urls = buildMineralsLocalUrls(fallbackFrameCount)
    }

    const canvas = component.querySelector('canvas')
    if (!canvas) {
      err('Canvas introuvable dans le composant.')
      return null
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      err('Contexte 2D indisponible.')
      return null
    }

    // Les hooks d'initialisation peuvent se chevaucher sur le même container.
    // Réutiliser le contrôleur actif évite un second téléchargement de 4,9 Mo.
    if (component.__mineralsCanvasController) {
      return component.__mineralsCanvasController
    }

    // Nettoie uniquement un éventuel contrôleur d'une ancienne version.
    if (typeof component.__mineralsCanvasCleanup === 'function') {
      component.__mineralsCanvasCleanup()
    }

    const fit = {
      base: component.getAttribute('fc-image-scrubbing-fit') || 'contain',
      landscape: component.getAttribute('fc-image-scrubbing-fit-landscape'),
      portrait: component.getAttribute('fc-image-scrubbing-fit-portrait'),
    }

    let fps = parsePositiveInt(
      component.getAttribute('fc-image-scrubbing-fps'),
      24
    )
    if (!Number.isFinite(fps) || fps <= 0) fps = 30

    const scrollStart =
      component.getAttribute('fc-image-scrubbing-start-point') || 'top top'
    const scrollEnd =
      component.getAttribute('fc-image-scrubbing-end-point') || 'bottom bottom'

    if (shouldUseAf) {
      let destroyed = false
      let rafToken = 0
      let requestedFrame = 0
      let maxFrame = 0
      let tween = null
      let resizeObserver = null
      let fallbackImage = null
      let controller = null
      const state = { frame: 0 }

      const resizeCanvas = () => {
        const dpr = getCanvasPixelRatio(
          window.devicePixelRatio,
          getBreakpoint() !== 'desktop'
        )
        const width = Math.max(canvas.clientWidth || 0, 1)
        const height = Math.max(canvas.clientHeight || 0, 1)
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(dpr, dpr)
      }

      const getFitMode = () => {
        const isPortrait =
          window.matchMedia &&
          window.matchMedia('(orientation: portrait)').matches
        const isLandscape =
          window.matchMedia &&
          window.matchMedia('(orientation: landscape)').matches
        if (isPortrait && fit.portrait) return fit.portrait
        if (isLandscape && fit.landscape) return fit.landscape
        return fit.base || 'contain'
      }

      const drawSource = (source, sourceWidth, sourceHeight) => {
        if (!canvas.__highResReady) {
          resizeCanvas()
          canvas.__highResReady = true
        }
        const canvasWidth = Math.max(canvas.clientWidth || 0, 1)
        const canvasHeight = Math.max(canvas.clientHeight || 0, 1)
        if (!sourceWidth || !sourceHeight) return

        const canvasRatio = canvasWidth / canvasHeight
        const sourceRatio = sourceWidth / sourceHeight
        const mode = getFitMode()

        let drawWidth = 0
        let drawHeight = 0
        if (mode === 'cover') {
          if (sourceRatio > canvasRatio) {
            drawHeight = canvasHeight
            drawWidth = canvasHeight * sourceRatio
          } else {
            drawWidth = canvasWidth
            drawHeight = canvasWidth / sourceRatio
          }
        } else if (sourceRatio > canvasRatio) {
          drawWidth = canvasWidth
          drawHeight = canvasWidth / sourceRatio
        } else {
          drawHeight = canvasHeight
          drawWidth = canvasHeight * sourceRatio
        }

        const offsetX = (canvasWidth - drawWidth) * 0.5
        const offsetY = (canvasHeight - drawHeight) * 0.5
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)
        ctx.drawImage(
          source,
          0,
          0,
          sourceWidth,
          sourceHeight,
          offsetX,
          offsetY,
          drawWidth,
          drawHeight
        )
      }

      const drawAfFrame = (frame) => {
        drawSource(
          frame,
          frame.displayWidth || frame.codedWidth,
          frame.displayHeight || frame.codedHeight
        )
      }

      const drawFallbackFrame = () => {
        if (
          destroyed ||
          !fallbackImage ||
          !fallbackImage.complete ||
          !fallbackImage.naturalWidth
        ) {
          return false
        }
        drawSource(
          fallbackImage,
          fallbackImage.naturalWidth,
          fallbackImage.naturalHeight
        )
        canvas.__mineralsFallbackDrawn = true
        return true
      }

      const loadFallbackFrame = () => {
        fallbackImage = new Image()
        fallbackImage.crossOrigin = 'anonymous'
        fallbackImage.decoding = 'async'
        fallbackImage.onload = () => {
          if (!drawFallbackFrame()) return
          info('Frame statique Minerals affichee')
        }
        fallbackImage.onerror = () => {
          err('Echec chargement frame statique Minerals')
        }
        fallbackImage.src = buildMineralsLocalUrls(1)[0]
      }

      // Affiche rapidement une image, puis la séquence AF la remplace lorsqu'elle
      // est prête. Cette image reste visible si WebCodecs ou le réseau échoue.
      loadFallbackFrame()

      const flushFrameRequest = () => {
        rafToken = 0
        if (!activeFrame || !activeFrame.manifest || destroyed) return
        const target = Math.max(0, Math.min(maxFrame, requestedFrame))
        activeFrame.setFrame(target)
      }

      const requestFrame = (frame) => {
        requestedFrame = Math.round(frame)
        if (rafToken) return
        rafToken = window.requestAnimationFrame(flushFrameRequest)
      }

      const hardwareAcceleration = /\bAndroid\b/i.test(
        navigator.userAgent || ''
      )
        ? 'prefer-software'
        : 'prefer-hardware'

      const activeFrame = new ActiveFrame(afUrl, {
        hardwareAcceleration,
        process: (frame) => {
          if (destroyed) return
          drawAfFrame(frame)
        },
      })

      activeFrame.loading
        .then(() => {
          maxFrame = Math.max(0, (activeFrame.manifest?.totalFrames || 1) - 1)
          state.frame = 0
          requestFrame(0)
        })
        .catch((error) => {
          err('Echec chargement .af, frame statique conservee', {
            afUrl,
            error,
          })
          drawFallbackFrame()
        })

      const onResize = () => {
        resizeCanvas()
        canvas.__highResReady = true
        drawFallbackFrame()
        requestFrame(state.frame)
      }

      if ('ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(onResize)
        resizeObserver.observe(canvas)
      } else {
        window.addEventListener('resize', onResize)
      }

      tween = gsap.to(state, {
        frame: () => maxFrame,
        duration: () => Math.max(1, (maxFrame + 1) / fps),
        ease: 'none',
        onUpdate: () => requestFrame(state.frame),
        scrollTrigger: {
          trigger: component,
          start: scrollStart,
          end: scrollEnd,
          scrub: SCRUB_SMOOTHING,
          invalidateOnRefresh: true,
        },
      })

      info('Init AF', {
        afUrl,
        scrub: SCRUB_SMOOTHING,
        fps,
        breakpoint: bp,
        canvasWidth: canvas.clientWidth,
        canvasHeight: canvas.clientHeight,
      })

      const cleanup = () => {
        destroyed = true
        if (rafToken) {
          window.cancelAnimationFrame(rafToken)
          rafToken = 0
        }
        try {
          if (tween && typeof tween.kill === 'function') tween.kill()
        } catch (e) {
          // ignore
        }
        try {
          if (resizeObserver) resizeObserver.disconnect()
        } catch (e) {
          // ignore
        }
        if (!resizeObserver) {
          window.removeEventListener('resize', onResize)
        }
        try {
          activeFrame.destroy()
        } catch (e) {
          // ignore
        }
        if (fallbackImage) {
          fallbackImage.onload = null
          fallbackImage.onerror = null
          fallbackImage = null
        }
        if (component.__mineralsCanvasController === controller) {
          component.__mineralsCanvasController = null
          component.__mineralsCanvasCleanup = null
        }
      }

      component.__mineralsCanvasCleanup = cleanup
      controller = { cleanup, component, canvas }
      component.__mineralsCanvasController = controller
      return controller
    }

    if (!urls.length) {
      err('Aucune source de sequence (ni .af ni images).')
      return null
    }

    const initialPreloadCount = parsePositiveInt(
      component.getAttribute('fc-image-scrubbing-initial-preload'),
      DEFAULT_INITIAL_PRELOAD
    )
    const preloadAhead = parsePositiveInt(
      component.getAttribute('fc-image-scrubbing-preload-ahead'),
      DEFAULT_PRELOAD_AHEAD
    )
    const preloadBehind = parsePositiveInt(
      component.getAttribute('fc-image-scrubbing-preload-behind'),
      DEFAULT_PRELOAD_BEHIND
    )
    const mediumPreloadAhead = parsePositiveInt(
      component.getAttribute('fc-image-scrubbing-medium-preload-ahead'),
      DEFAULT_MEDIUM_PRELOAD_AHEAD
    )
    const fastPreloadAhead = parsePositiveInt(
      component.getAttribute('fc-image-scrubbing-fast-preload-ahead'),
      DEFAULT_FAST_PRELOAD_AHEAD
    )
    const maxLoadPlan = parsePositiveInt(
      component.getAttribute('fc-image-scrubbing-max-load-plan'),
      DEFAULT_MAX_LOAD_PLAN
    )
    const backgroundBatchSize = parsePositiveInt(
      component.getAttribute('fc-image-scrubbing-background-batch-size'),
      DEFAULT_BACKGROUND_BATCH_SIZE
    )
    const maxConcurrency = Math.max(
      1,
      parsePositiveInt(
        component.getAttribute('fc-image-scrubbing-concurrency'),
        DEFAULT_CONCURRENCY
      )
    )
    const activeConcurrency = Math.max(
      maxConcurrency,
      parsePositiveInt(
        component.getAttribute('fc-image-scrubbing-active-concurrency'),
        DEFAULT_ACTIVE_CONCURRENCY
      )
    )

    const state = { frame: 0 }
    const maxLinearFrame = Math.max(0, urls.length * LOOP_COUNT - 1)
    const images = new Array(urls.length)
    const loadStates = new Array(urls.length).fill('idle')
    const pendingQueue = []
    const initialPreloadIndices = new Set()
    const backgroundBatchIndices = new Set()
    let firstLoadedIndex = -1
    let loadedCount = 0
    let activeLoads = 0
    let destroyed = false
    let lastRenderSignature = ''
    let lastLinearFrame = 0
    let hasDrawnFrameZero = false
    let isSequenceNearViewport = false
    let currentMaxConcurrency = maxConcurrency
    let tween = null
    let resizeObserver = null

    const resizeCanvas = () => {
      const dpr = getCanvasPixelRatio(
        window.devicePixelRatio,
        getBreakpoint() !== 'desktop'
      )
      const width = Math.max(canvas.clientWidth || 0, 1)
      const height = Math.max(canvas.clientHeight || 0, 1)

      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }

    const getFitMode = () => {
      const isPortrait =
        window.matchMedia &&
        window.matchMedia('(orientation: portrait)').matches
      const isLandscape =
        window.matchMedia &&
        window.matchMedia('(orientation: landscape)').matches
      if (isPortrait && fit.portrait) return fit.portrait
      if (isLandscape && fit.landscape) return fit.landscape
      return fit.base || 'contain'
    }

    const drawImageAt = (index, options = {}) => {
      const image = images[index]
      if (
        !image ||
        !image.complete ||
        !image.naturalWidth ||
        !image.naturalHeight
      ) {
        return false
      }

      const canvasWidth = Math.max(canvas.clientWidth || 0, 1)
      const canvasHeight = Math.max(canvas.clientHeight || 0, 1)
      const canvasRatio = canvasWidth / canvasHeight
      const imageRatio = image.naturalWidth / image.naturalHeight
      const mode = getFitMode()
      let drawWidth = 0
      let drawHeight = 0

      if (mode === 'cover') {
        if (imageRatio > canvasRatio) {
          drawHeight = canvasHeight
          drawWidth = canvasHeight * imageRatio
        } else {
          drawWidth = canvasWidth
          drawHeight = canvasWidth / imageRatio
        }
      } else if (imageRatio > canvasRatio) {
        drawWidth = canvasWidth
        drawHeight = canvasWidth / imageRatio
      } else {
        drawHeight = canvasHeight
        drawWidth = canvasHeight * imageRatio
      }

      const offsetX = (canvasWidth - drawWidth) / 2
      const offsetY = (canvasHeight - drawHeight) / 2

      if (!options.skipClear) {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)
      }
      ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
      return true
    }

    const findClosestLoadedIndex = (targetIndex) => {
      if (!urls.length) return -1
      if (loadStates[targetIndex] === 'loaded') return targetIndex

      for (let offset = 1; offset < urls.length; offset += 1) {
        const left = targetIndex - offset
        if (left >= 0 && loadStates[left] === 'loaded') return left
        const right = targetIndex + offset
        if (right < urls.length && loadStates[right] === 'loaded') return right
      }
      return -1
    }

    const queueLoad = (index, highPriority = false) => {
      if (destroyed) return
      if (index < 0 || index >= urls.length) return

      const currentState = loadStates[index]
      if (currentState === 'loaded' || currentState === 'loading') return

      if (currentState === 'queued') {
        if (highPriority) {
          const queuedIndex = pendingQueue.indexOf(index)
          if (queuedIndex > 0) {
            pendingQueue.splice(queuedIndex, 1)
            pendingQueue.unshift(index)
          }
        }
        return
      }

      loadStates[index] = 'queued'
      if (highPriority) pendingQueue.unshift(index)
      else pendingQueue.push(index)
    }

    const loadOneImage = (index) =>
      new Promise((resolve) => {
        if (destroyed) {
          resolve()
          return
        }

        const image = new Image()
        image.onload = () => {
          if (destroyed) {
            resolve()
            return
          }
          images[index] = image
          loadStates[index] = 'loaded'
          loadedCount += 1
          if (firstLoadedIndex === -1) firstLoadedIndex = index

          // Garantit que la vraie première frame est visible dès qu'elle existe.
          if (index === 0 && !hasDrawnFrameZero) {
            state.frame = 0
            canvas.__highResReady = false
            renderCurrentFrame()
            hasDrawnFrameZero = true
          }

          if (loadedCount === 1) {
            info('Premiere image chargee', {
              index,
              total: urls.length,
              canvasWidth: canvas.clientWidth,
              canvasHeight: canvas.clientHeight,
            })
            if (index === 0 || hasDrawnFrameZero) {
              renderCurrentFrame()
            }
          }
          resolve()
        }

        image.onerror = () => {
          if (!destroyed) {
            loadStates[index] = 'error'
            err('Echec de chargement image:', urls[index])
          }
          resolve()
        }

        image.src = urls[index]
      })

    const pumpQueue = () => {
      if (destroyed) return

      while (activeLoads < currentMaxConcurrency && pendingQueue.length > 0) {
        const index = pendingQueue.shift()
        if (typeof index !== 'number') continue
        if (loadStates[index] !== 'queued') continue

        loadStates[index] = 'loading'
        activeLoads += 1

        loadOneImage(index).finally(() => {
          activeLoads -= 1
          pumpQueue()
        })
      }
    }

    const prunePendingQueue = (keepIndices) => {
      if (!keepIndices || !pendingQueue.length) return

      for (let i = pendingQueue.length - 1; i >= 0; i -= 1) {
        const queuedIndex = pendingQueue[i]
        if (
          shouldKeepMineralsQueuedIndex({
            index: queuedIndex,
            plannedIndices: keepIndices,
            initialPreloadIndices,
            backgroundBatchIndices,
          })
        ) {
          continue
        }
        pendingQueue.splice(i, 1)
        if (loadStates[queuedIndex] === 'queued') {
          loadStates[queuedIndex] = 'idle'
        }
      }
    }

    const scheduleDirectionalPreload = (linearFrame) => {
      const baseIndex = Math.max(
        0,
        Math.min(urls.length - 1, Math.floor(linearFrame))
      )
      const previousIndex = lastLinearFrame
      const speed = Math.abs(baseIndex - previousIndex)
      lastLinearFrame = baseIndex
      currentMaxConcurrency =
        isSequenceNearViewport || speed >= 8
          ? activeConcurrency
          : maxConcurrency

      const plan = getMineralsFrameLoadPlan({
        targetIndex: baseIndex,
        previousIndex,
        total: urls.length,
        baseAhead: preloadAhead,
        baseBehind: preloadBehind,
        mediumAhead: mediumPreloadAhead,
        fastAhead: fastPreloadAhead,
        maxPlan: maxLoadPlan,
      })
      prunePendingQueue(new Set(plan.map((item) => item.index)))
      for (let i = plan.length - 1; i >= 0; i -= 1) {
        const item = plan[i]
        queueLoad(item.index, item.highPriority)
      }

      pumpQueue()
    }

    const drawBlendedFrame = (linearFrame) => {
      const total = images.length
      if (!total) return false

      // Fin de séquence: garde explicitement la dernière frame.
      if (linearFrame >= maxLinearFrame) {
        return drawImageAt(total - 1)
      }

      const baseLinear = Math.floor(linearFrame)
      const baseIndex = ((baseLinear % total) + total) % total
      const nextIndex = (baseIndex + 1) % total
      const t = Math.max(0, Math.min(1, linearFrame - baseLinear))
      const isLoopSeam = baseIndex === total - 1 && nextIndex === 0

      if (!ENABLE_FRAME_BLEND) {
        return drawImageAt(baseIndex)
      }

      const baseImg = images[baseIndex]
      const nextImg = images[nextIndex]
      const baseReady =
        !!baseImg &&
        baseImg.complete &&
        !!baseImg.naturalWidth &&
        !!baseImg.naturalHeight
      const nextReady =
        !!nextImg &&
        nextImg.complete &&
        !!nextImg.naturalWidth &&
        !!nextImg.naturalHeight

      if (!baseReady && !nextReady) return false

      // Si une frame manque, fallback sans interpolation.
      if (!baseReady) return drawImageAt(nextIndex)
      if (!nextReady) return drawImageAt(baseIndex)

      // Evite le flash visible sur la jonction fin->debut de boucle.
      if (isLoopSeam) {
        return drawImageAt(baseIndex)
      }

      // Evite les blends inutiles tres proches des bornes.
      if (t <= 0.001) return drawImageAt(baseIndex)
      if (t >= 0.999) return drawImageAt(nextIndex)

      // Blend entre deux frames pour éviter les micro-saccades à basse vitesse.
      const canvasWidth = Math.max(canvas.clientWidth || 0, 1)
      const canvasHeight = Math.max(canvas.clientHeight || 0, 1)
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)

      ctx.save()
      ctx.globalAlpha = 1 - t
      drawImageAt(baseIndex, { skipClear: true })
      ctx.restore()

      ctx.save()
      ctx.globalAlpha = t
      drawImageAt(nextIndex, { skipClear: true })
      ctx.restore()

      return true
    }

    const renderCurrentFrame = () => {
      const linearFrame = Math.max(0, Math.min(maxLinearFrame, state.frame))
      const baseLinear = Math.floor(linearFrame)
      const signature = ENABLE_FRAME_BLEND
        ? `${baseLinear}:${linearFrame.toFixed(3)}`
        : String(baseLinear)

      scheduleDirectionalPreload(linearFrame)

      if (signature === lastRenderSignature && canvas.__highResReady) return

      if (!canvas.__highResReady) {
        resizeCanvas()
        canvas.__highResReady = true
      }

      const drawn = drawBlendedFrame(linearFrame)
      if (!drawn) {
        const fallbackIndex = findClosestLoadedIndex(baseLinear)
        if (fallbackIndex >= 0) {
          drawImageAt(fallbackIndex)
        } else if (firstLoadedIndex >= 0) {
          drawImageAt(firstLoadedIndex)
        }
      }

      lastRenderSignature = signature
    }

    const initialCap = getMineralsInitialPreloadCount({
      requestedCount: initialPreloadCount,
      minimumCount: DEFAULT_INITIAL_PRELOAD,
      total: urls.length,
    })
    // Priorité absolue: index 0, pour affichage immédiat de la première frame.
    queueLoad(0, true)
    initialPreloadIndices.add(0)
    for (let index = 1; index < initialCap; index += 1) {
      initialPreloadIndices.add(index)
      queueLoad(index, false)
    }
    pumpQueue()

    let backgroundBatchStarted = false
    let nextBackgroundBatchIndex = initialCap
    let backgroundBatchTimer = null

    const clearBackgroundBatchTimer = () => {
      if (backgroundBatchTimer) {
        clearTimeout(backgroundBatchTimer)
        backgroundBatchTimer = null
      }
    }

    const queueNextBackgroundBatch = () => {
      if (destroyed || !backgroundBatchStarted) return

      while (
        nextBackgroundBatchIndex < urls.length &&
        loadStates[nextBackgroundBatchIndex] !== 'idle'
      ) {
        nextBackgroundBatchIndex += 1
      }

      if (nextBackgroundBatchIndex >= urls.length) return

      const batch = getMineralsBatchPreloadPlan({
        total: urls.length,
        startIndex: nextBackgroundBatchIndex,
        batchSize: backgroundBatchSize,
      })
      if (!batch.length) return

      batch.forEach((item) => {
        backgroundBatchIndices.add(item.index)
        queueLoad(item.index, item.highPriority)
      })
      nextBackgroundBatchIndex = batch[batch.length - 1].index + 1
      pumpQueue()

      const waitForBatch = () => {
        if (destroyed) return
        const hasActiveBatchWork = batch.some((item) => {
          const stateName = loadStates[item.index]
          return stateName === 'queued' || stateName === 'loading'
        })
        if (hasActiveBatchWork) {
          backgroundBatchTimer = setTimeout(waitForBatch, 120)
          return
        }
        batch.forEach((item) => backgroundBatchIndices.delete(item.index))
        backgroundBatchTimer = setTimeout(queueNextBackgroundBatch, 120)
      }

      clearBackgroundBatchTimer()
      backgroundBatchTimer = setTimeout(waitForBatch, 120)
    }

    const startBackgroundBatchPreload = () => {
      if (destroyed || backgroundBatchStarted) return
      backgroundBatchStarted = true
      currentMaxConcurrency = activeConcurrency
      queueNextBackgroundBatch()
    }

    const BACKGROUND_PRELOAD_DELAY_AFTER_HERO = 0
    const BACKGROUND_PRELOAD_DELAY_AFTER_LOAD = 1000
    const cleanupCallbacks = []

    const scheduleBackgroundPreload = (delay) => {
      const timerId = setTimeout(startBackgroundBatchPreload, delay)
      cleanupCallbacks.push(() => clearTimeout(timerId))
    }

    if (window.__heroAnimationStarted) {
      scheduleBackgroundPreload(BACKGROUND_PRELOAD_DELAY_AFTER_HERO)
    } else {
      const onHeroReady = () =>
        scheduleBackgroundPreload(BACKGROUND_PRELOAD_DELAY_AFTER_HERO)
      document.addEventListener('hero:ready', onHeroReady, { once: true })
      cleanupCallbacks.push(() =>
        document.removeEventListener('hero:ready', onHeroReady)
      )

      // Filet de sécurité si l'event ne se déclenche pas (pages sans loader, etc.)
      const onWindowLoad = () =>
        scheduleBackgroundPreload(BACKGROUND_PRELOAD_DELAY_AFTER_LOAD)
      if (document.readyState === 'complete') {
        scheduleBackgroundPreload(BACKGROUND_PRELOAD_DELAY_AFTER_LOAD)
      } else {
        window.addEventListener('load', onWindowLoad, { once: true })
        cleanupCallbacks.push(() =>
          window.removeEventListener('load', onWindowLoad)
        )
      }
    }

    // Backup: si la section approche du viewport, on active seulement le buffer
    // adaptatif autour de la frame courante au lieu de charger les 600 frames.
    let proximityObserver = null
    if ('IntersectionObserver' in window) {
      proximityObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            isSequenceNearViewport = true
            scheduleDirectionalPreload(state.frame)
            if (proximityObserver) {
              proximityObserver.disconnect()
              proximityObserver = null
            }
          }
        },
        { rootMargin: '100% 0px' }
      )
      proximityObserver.observe(component)
      cleanupCallbacks.push(() => {
        try {
          if (proximityObserver) proximityObserver.disconnect()
        } catch (e) {
          // ignore
        }
      })
    }

    const onResize = () => {
      resizeCanvas()
      canvas.__highResReady = true
      renderCurrentFrame()
    }

    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(onResize)
      resizeObserver.observe(canvas)
    } else {
      window.addEventListener('resize', onResize)
    }

    tween = gsap.to(state, {
      frame: maxLinearFrame,
      duration: images.length / fps,
      ease: 'none',
      onUpdate: renderCurrentFrame,
      scrollTrigger: {
        trigger: component,
        start: scrollStart,
        end: scrollEnd,
        scrub: SCRUB_SMOOTHING,
        invalidateOnRefresh: true,
      },
    })

    info('Init', {
      images: urls.length,
      loops: LOOP_COUNT,
      scrub: SCRUB_SMOOTHING,
      fps,
      breakpoint: bp,
      initialPreloadCount: initialCap,
      preloadAhead,
      preloadBehind,
      mediumPreloadAhead,
      fastPreloadAhead,
      maxLoadPlan,
      backgroundBatchSize,
      maxConcurrency,
      activeConcurrency,
      canvasWidth: canvas.clientWidth,
      canvasHeight: canvas.clientHeight,
    })

    const cleanup = () => {
      destroyed = true
      pendingQueue.length = 0
      try {
        if (tween && typeof tween.kill === 'function') tween.kill()
      } catch (e) {
        // ignore
      }
      try {
        if (resizeObserver) resizeObserver.disconnect()
      } catch (e) {
        // ignore
      }
      clearBackgroundBatchTimer()
      if (!resizeObserver) {
        window.removeEventListener('resize', onResize)
      }
      cleanupCallbacks.forEach((fn) => {
        try {
          fn()
        } catch (e) {
          // ignore
        }
      })
      cleanupCallbacks.length = 0
      if (component.__mineralsCanvasController === controller) {
        component.__mineralsCanvasController = null
        component.__mineralsCanvasCleanup = null
      }
    }

    component.__mineralsCanvasCleanup = cleanup
    const controller = { cleanup, component, canvas }
    component.__mineralsCanvasController = controller

    window.__mineralsCanvasDebug = {
      state,
      images,
      loadStates,
      pendingQueue,
      initialPreloadIndices,
      backgroundBatchIndices,
      render: renderCurrentFrame,
      canvas,
      component,
      cleanup,
      getLoadPlan: getMineralsFrameLoadPlan,
    }

    return controller
  } catch (error) {
    err('Erreur fatale:', error)
    return null
  }
}
