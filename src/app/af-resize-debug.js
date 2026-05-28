const MAX_EVENTS = 300
const READ_CTX_KEY = '__cominviAfReadCtx'

function getCanvasReadContext(canvas) {
  if (!canvas) return null
  if (canvas[READ_CTX_KEY]) return canvas[READ_CTX_KEY]

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (ctx) canvas[READ_CTX_KEY] = ctx
  return ctx
}

export function isAfResizeDebugEnabled() {
  if (typeof window === 'undefined') return false
  if (window.__cominviAfResizeDebugForce) return true

  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('af-debug') === '1') return true
  } catch (e) {
    // ignore
  }

  return import.meta.env?.DEV === true
}

function round(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 10) / 10
    : null
}

function readCanvasPixels(canvas) {
  if (!canvas || !canvas.width || !canvas.height) {
    return { ready: false }
  }

  try {
    const ctx = getCanvasReadContext(canvas)
    if (!ctx) return { ready: false }

    const cx = Math.floor(canvas.width / 2)
    const cy = Math.floor(canvas.height / 2)
    const center = [...ctx.getImageData(cx, cy, 1, 1).data.slice(0, 4)]
    const brightness = center[0] + center[1] + center[2] + (center[3] ?? 255)

    return {
      ready: true,
      bufW: canvas.width,
      bufH: canvas.height,
      center,
      nonEmpty: brightness > 24,
    }
  } catch (e) {
    return { ready: false, error: e?.message || 'read-failed' }
  }
}

export function readAfSurfaceSnapshot(root = document) {
  const scope = root && root.querySelector ? root : document
  const canvas = scope.querySelector('[data-loader-sequence-canvas="true"]')
  const displayImg = scope.querySelector('[data-cominvi-af-display="true"]')
  const poster = scope.querySelector('img[data-cominvi-hero-poster-img="true"]')
  const mediaHost =
    scope.querySelector('.hero-background .background_video') ||
    canvas?.parentElement
  const inner = scope.querySelector('.hero-background .background-inner')
  const hero = scope.querySelector('.hero-background')
  const pageWrap = scope.querySelector('.page-wrap')

  const canvasCs = canvas ? getComputedStyle(canvas) : null
  const displayCs = displayImg ? getComputedStyle(displayImg) : null
  const posterCs = poster ? getComputedStyle(poster) : null
  const canvasRect = canvas?.getBoundingClientRect?.()
  const hostRect = mediaHost?.getBoundingClientRect?.()
  const heroRect = hero?.getBoundingClientRect?.()

  return {
    t: round(performance.now()),
    win: {
      w: window.innerWidth,
      h: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
    },
    scroll: {
      lenis: window.lenis?.scroll ?? null,
      stProgress: window.__homeSequenceScrollTrigger?.progress ?? null,
    },
    canvas: canvas
      ? {
          parent: canvas.parentElement?.className || null,
          css: {
            opacity: canvasCs.opacity,
            visibility: canvasCs.visibility,
            zIndex: canvasCs.zIndex,
            transform: canvasCs.transform,
            display: canvasCs.display,
          },
          rect: canvasRect
            ? {
                w: round(canvasRect.width),
                h: round(canvasRect.height),
                top: round(canvasRect.top),
                left: round(canvasRect.left),
              }
            : null,
          pixels: readCanvasPixels(canvas),
        }
      : null,
    displayImg: displayImg
      ? {
          hasSrc: !!displayImg.currentSrc,
          srcLen: displayImg.currentSrc?.length || 0,
          css: {
            opacity: displayCs.opacity,
            visibility: displayCs.visibility,
            zIndex: displayCs.zIndex,
          },
          rect: (() => {
            const rect = displayImg.getBoundingClientRect()
            return {
              w: round(rect.width),
              h: round(rect.height),
              top: round(rect.top),
            }
          })(),
        }
      : null,
    poster: poster
      ? {
          css: {
            opacity: posterCs.opacity,
            visibility: posterCs.visibility,
            zIndex: posterCs.zIndex,
          },
        }
      : null,
    mediaHost: hostRect
      ? { w: round(hostRect.width), h: round(hostRect.height) }
      : null,
    inner: inner
      ? {
          rect: (() => {
            const rect = inner.getBoundingClientRect()
            return { w: round(rect.width), h: round(rect.height) }
          })(),
          transform: getComputedStyle(inner).transform,
          willChange: getComputedStyle(inner).willChange,
        }
      : null,
    hero: heroRect
      ? { w: round(heroRect.width), h: round(heroRect.height) }
      : null,
    pageWrap: pageWrap
      ? { transform: getComputedStyle(pageWrap).transform }
      : null,
    controller: {
      exists: !!window.__homeSequenceController,
      requestedFrame:
        window.__homeSequenceController?.__debugRequestedFrame ?? null,
      decodedFrame: window.__homeSequenceActiveFrame?.frame ?? null,
      hasSnapshot: !!window.__homeSequenceController?.__debugHasSnapshot,
    },
  }
}

export function afResizeLog(event, data = {}, root = document) {
  if (!isAfResizeDebugEnabled()) return null

  if (!window.__cominviAfResizeDebug) {
    window.__cominviAfResizeDebug = {
      events: [],
      dump() {
        return this.events.slice()
      },
    }
  }

  const entry = {
    event,
    ...data,
    snapshot: readAfSurfaceSnapshot(root),
  }

  window.__cominviAfResizeDebug.events.push(entry)
  if (window.__cominviAfResizeDebug.events.length > MAX_EVENTS) {
    window.__cominviAfResizeDebug.events.shift()
  }

  return entry
}
