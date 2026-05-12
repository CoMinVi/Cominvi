import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const LOG = '[minerals-canvas]'
const ALLOWED_NAMESPACES = new Set(['home', 'services'])
const LOOP_COUNT = 1
const SCRUB_SMOOTHING = 0.4
const ENABLE_FRAME_BLEND = false
const DEFAULT_INITIAL_PRELOAD = 12
const DEFAULT_PRELOAD_AHEAD = 6
const DEFAULT_PRELOAD_BEHIND = 2
const DEFAULT_CONCURRENCY = 6

function info(...args) {
  // eslint-disable-next-line no-console
  console.log(LOG, ...args)
}

function err(...args) {
  // eslint-disable-next-line no-console
  console.error(LOG, ...args)
}

function parseImageUrls(raw) {
  return String(raw || '')
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean)
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
    const responsiveUrls = {
      desktop: getAttrFromComponentOrScope('fc-image-scrubbing-urls-desktop'),
      tablet: getAttrFromComponentOrScope('fc-image-scrubbing-urls-tablet'),
      mobile: getAttrFromComponentOrScope('fc-image-scrubbing-urls-mobile'),
    }
    const baseUrls = getAttrFromComponentOrScope('fc-image-scrubbing-urls')
    const urls = parseImageUrls(
      responsiveUrls[bp] ||
        responsiveUrls.desktop ||
        responsiveUrls.tablet ||
        responsiveUrls.mobile ||
        baseUrls
    )
    if (!urls.length) {
      err('La liste d’images est vide.')
      return null
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

    // Evite les doublons lors des transitions Barba.
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
    const maxConcurrency = Math.max(
      1,
      parsePositiveInt(
        component.getAttribute('fc-image-scrubbing-concurrency'),
        DEFAULT_CONCURRENCY
      )
    )

    const state = { frame: 0 }
    const maxLinearFrame = Math.max(0, urls.length * LOOP_COUNT - 1)
    const images = new Array(urls.length)
    const loadStates = new Array(urls.length).fill('idle')
    const pendingQueue = []
    let firstLoadedIndex = -1
    let loadedCount = 0
    let activeLoads = 0
    let destroyed = false
    let lastRenderSignature = ''
    let lastLinearFrame = 0
    let tween = null
    let resizeObserver = null

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
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

          if (loadedCount === 1) {
            info('Premiere image chargee', {
              index,
              total: urls.length,
              canvasWidth: canvas.clientWidth,
              canvasHeight: canvas.clientHeight,
            })
            renderCurrentFrame()
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

      while (activeLoads < maxConcurrency && pendingQueue.length > 0) {
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

    const scheduleDirectionalPreload = (linearFrame) => {
      const baseIndex = Math.max(
        0,
        Math.min(urls.length - 1, Math.floor(linearFrame))
      )
      const direction = baseIndex >= lastLinearFrame ? 1 : -1
      lastLinearFrame = baseIndex

      // Toujours prioriser la frame courante pour éviter les trous visuels.
      queueLoad(baseIndex, true)

      for (let i = 1; i <= preloadAhead; i += 1) {
        queueLoad(baseIndex + direction * i, true)
      }
      for (let i = 1; i <= preloadBehind; i += 1) {
        queueLoad(baseIndex - direction * i, false)
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

    const initialCap = Math.min(urls.length, Math.max(1, initialPreloadCount))
    for (let index = 0; index < initialCap; index += 1) {
      queueLoad(index, true)
    }
    for (let index = initialCap; index < urls.length; index += 1) {
      queueLoad(index, false)
    }
    pumpQueue()

    const onResize = () => {
      canvas.__highResReady = false
      renderCurrentFrame()
    }

    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(onResize)
      resizeObserver.observe(canvas)
    } else {
      window.addEventListener('resize', onResize)
    }

    const scrollStart =
      component.getAttribute('fc-image-scrubbing-start-point') || 'top top'
    const scrollEnd =
      component.getAttribute('fc-image-scrubbing-end-point') || 'bottom bottom'

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
      maxConcurrency,
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
      if (!resizeObserver) {
        window.removeEventListener('resize', onResize)
      }
      component.__mineralsCanvasCleanup = null
    }

    component.__mineralsCanvasCleanup = cleanup

    window.__mineralsCanvasDebug = {
      state,
      images,
      render: renderCurrentFrame,
      canvas,
      component,
      cleanup,
    }

    return { cleanup, component, canvas }
  } catch (error) {
    err('Erreur fatale:', error)
    return null
  }
}
