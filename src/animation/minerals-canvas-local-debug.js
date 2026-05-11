import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const LOG = '[minerals-canvas]'
const ALLOWED_NAMESPACES = new Set(['home', 'services'])
const LOOP_COUNT = 5

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

export function initMineralsCanvas(root = document) {
  try {
    if (!isAllowedPage(root)) return null

    const scope = root && root.querySelector ? root : document
    const component = scope.querySelector('[fc-image-scrubbing="component"]')
    if (!component) return null

    const urlsAttrValue = component.getAttribute('fc-image-scrubbing-urls')
    const fallbackUrlHolder = scope.querySelector('[fc-image-scrubbing-urls]')
    const fallbackUrls = fallbackUrlHolder
      ? fallbackUrlHolder.getAttribute('fc-image-scrubbing-urls')
      : ''
    const urls = parseImageUrls(urlsAttrValue || fallbackUrls)
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

    let fps = parseInt(
      component.getAttribute('fc-image-scrubbing-fps') || '24',
      10
    )
    if (!Number.isFinite(fps) || fps <= 0) fps = 24

    const state = { frame: 0 }
    const maxLinearFrame = Math.max(0, urls.length * LOOP_COUNT - 1)
    const images = []
    let firstLoadedIndex = -1
    let loadedCount = 0
    let lastDrawnFrame = -1
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

    const drawImageAt = (index) => {
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

      ctx.clearRect(0, 0, canvasWidth, canvasHeight)
      ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
      return true
    }

    const renderCurrentFrame = () => {
      const targetLinearFrame = Math.max(
        0,
        Math.min(maxLinearFrame, Math.round(state.frame))
      )
      const targetFrame =
        targetLinearFrame >= maxLinearFrame
          ? images.length - 1
          : targetLinearFrame % images.length

      if (targetFrame === lastDrawnFrame && canvas.__highResReady) return

      if (!canvas.__highResReady) {
        resizeCanvas()
        canvas.__highResReady = true
      }

      const drawn = drawImageAt(targetFrame)
      if (!drawn && firstLoadedIndex >= 0) {
        drawImageAt(firstLoadedIndex)
      }

      lastDrawnFrame = targetFrame
    }

    urls.forEach((url, index) => {
      const image = new Image()

      image.onload = () => {
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
      }

      image.onerror = () => {
        err('Echec de chargement image:', url)
      }

      image.src = url
      images.push(image)
    })

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
        scrub: true,
      },
    })

    info('Init', {
      images: urls.length,
      loops: LOOP_COUNT,
      fps,
      canvasWidth: canvas.clientWidth,
      canvasHeight: canvas.clientHeight,
    })

    const cleanup = () => {
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
