import { logHeroSizeSnapshot } from './hero-size-debug.js'

const HERO_VIDEO_SELECTOR = '.hero-background .background_video video'
const HERO_POSTER_PRELOAD_ATTR = 'data-cominvi-hero-poster-preload'
const HERO_POSTER_IMG_ATTR = 'data-cominvi-hero-poster-img'
const HERO_VIDEO_READY_ATTR = 'data-cominvi-hero-video-ready'
const HERO_VIDEO_LISTENERS_ATTR = 'data-cominvi-hero-video-listeners'
const HERO_VIDEO_PLAY_UNLOCKED_ATTR = 'data-cominvi-hero-play-unlocked'
export const HOME_AF_ONLY_ATTR = 'data-cominvi-home-af-only'
export const HOME_AF_PLACEHOLDER_URL =
  'https://cominvi.netlify.app/cave-scene/poster/frame_00000.webp'

function getHeroVideosInScope(root = document) {
  const scope = root && root.querySelector ? root : document
  if (!scope.querySelectorAll) return []
  return Array.from(scope.querySelectorAll(HERO_VIDEO_SELECTOR))
}

function hideHomeHeroVideoElement(video) {
  if (!video || !video.setAttribute) return

  video.setAttribute(HOME_AF_ONLY_ATTR, 'true')
  video.setAttribute(HERO_VIDEO_READY_ATTR, 'false')

  try {
    video.style.setProperty('display', 'none', 'important')
    video.style.setProperty('visibility', 'hidden', 'important')
    video.style.setProperty('opacity', '0', 'important')
    video.style.setProperty('pointer-events', 'none', 'important')
  } catch (e) {
    video.style.display = 'none'
    video.style.visibility = 'hidden'
    video.style.opacity = '0'
    video.style.pointerEvents = 'none'
  }
}

function neutralizeHomeHeroVideoWrapper(video) {
  const wrapper = getVideoWrapper(video)
  if (!wrapper) return

  wrapper.classList.remove('w-background-video', 'w-background-video-atom')
  wrapper.setAttribute('data-autoplay', 'false')
  wrapper.setAttribute('data-wf-ignore', 'true')

  try {
    wrapper
      .querySelectorAll(
        '.w-background-video--control, [data-w-bg-video-control]'
      )
      .forEach((control) => {
        control.style.display = 'none'
      })
  } catch (e) {
    // ignore
  }
}

function stripHeroVideoSources(video) {
  if (!video) return

  deferHeroVideoSources(video)

  getHeroVideoSources(video).forEach((source) => {
    try {
      if (source.removeAttribute) source.removeAttribute('src')
    } catch (e) {
      // ignore
    }
  })

  try {
    if (video.removeAttribute) video.removeAttribute('src')
    video.src = ''
    video.removeAttribute('autoplay')
    video.autoplay = false
    video.preload = 'none'
    if (video.setAttribute) video.setAttribute('preload', 'none')
  } catch (e) {
    // ignore
  }
}

function bindHomeHeroVideoGuard(video) {
  if (!video || video.__cominviHomeAfGuardBound) return
  video.__cominviHomeAfGuardBound = true

  let isBlocking = false
  const blockPlayback = () => {
    if (isBlocking) return
    isBlocking = true
    try {
      stripHeroVideoSources(video)
      lockHeroVideoPlayback(video)
      hideHomeHeroVideoElement(video)
      neutralizeHomeHeroVideoWrapper(video)
    } catch (e) {
      // ignore
    } finally {
      isBlocking = false
    }
  }

  ;['play', 'playing', 'loadeddata', 'canplay', 'canplaythrough'].forEach(
    (eventName) => {
      video.addEventListener(eventName, blockPlayback)
    }
  )

  try {
    const observer = new MutationObserver((mutations) => {
      const shouldBlock = mutations.some((mutation) => {
        if (mutation.type !== 'attributes') return false
        const name = mutation.attributeName
        if (name === 'autoplay') return !!video.autoplay
        if (name !== 'src') return false
        const target = mutation.target
        if (target === video) return !!video.getAttribute('src')
        return !!(target.getAttribute && target.getAttribute('src'))
      })
      if (shouldBlock) blockPlayback()
    })
    observer.observe(video, {
      attributes: true,
      attributeFilter: ['src', 'autoplay'],
    })
    getHeroVideoSources(video).forEach((source) => {
      observer.observe(source, {
        attributes: true,
        attributeFilter: ['src'],
      })
    })
    video.__cominviHomeAfGuardObserver = observer
  } catch (e) {
    // ignore
  }

  blockPlayback()
}

export function unbindHomeHeroVideoGuard(video) {
  if (!video) return
  if (
    video.__cominviHomeAfGuardObserver &&
    typeof video.__cominviHomeAfGuardObserver.disconnect === 'function'
  ) {
    try {
      video.__cominviHomeAfGuardObserver.disconnect()
    } catch (e) {
      // ignore
    }
  }
  video.__cominviHomeAfGuardObserver = null
  video.__cominviHomeAfGuardBound = false
}

function isHomeScope(root = document) {
  const scope = root && root.querySelector ? root : document
  const container =
    (scope.querySelector && scope.querySelector('[data-barba="container"]')) ||
    scope
  const namespace =
    (container.getAttribute &&
      container.getAttribute('data-barba-namespace')) ||
    ''
  return namespace.trim().toLowerCase() === 'home'
}

export function normalizeHeroPosterUrl(value) {
  if (!value || typeof value !== 'string') return ''
  let url = value.trim()
  const cssUrlMatch = url.match(/^url\((.*)\)$/i)
  if (cssUrlMatch && cssUrlMatch[1]) {
    url = cssUrlMatch[1].trim()
  }
  url = url.replace(/^['"]+|['")]+$/g, '').trim()
  url = url.replace(/;+$/g, '').trim()
  if (!url) return ''
  const lowered = url.toLowerCase()
  if (
    lowered === 'none' ||
    lowered === 'initial' ||
    lowered === 'inherit' ||
    lowered === 'unset'
  ) {
    return ''
  }
  return url
}

export function buildHeroImagePreloadAttrs(href) {
  return {
    rel: 'preload',
    as: 'image',
    href,
    fetchPriority: 'high',
  }
}

function getHeroVideoSources(video) {
  if (!video || typeof video.querySelectorAll !== 'function') return []
  return Array.from(video.querySelectorAll('source'))
}

function shouldEagerLoadHeroVideo() {
  try {
    if (typeof window === 'undefined') return false
    if (window.matchMedia && window.matchMedia('(max-width: 991px)').matches) {
      return true
    }
    return window.innerWidth <= 991
  } catch (e) {
    return false
  }
}

export function deferHeroVideoSources(video) {
  if (!video) return false

  let changed = false
  getHeroVideoSources(video).forEach((source) => {
    const src = source.getAttribute && source.getAttribute('src')
    if (!src) return
    if (source.setAttribute && !source.getAttribute('data-src')) {
      source.setAttribute('data-src', src)
    }
    if (source.removeAttribute) {
      source.removeAttribute('src')
      changed = true
    }
  })

  video.preload = 'none'
  if (video.setAttribute) {
    video.setAttribute('preload', 'none')
  }

  return changed
}

export function restoreHeroVideoSources(video) {
  if (!video) return false

  let changed = false
  getHeroVideoSources(video).forEach((source) => {
    const dataSrc = source.getAttribute && source.getAttribute('data-src')
    if (!dataSrc) return
    if (source.getAttribute('src') === dataSrc) return
    if (source.setAttribute) {
      source.setAttribute('src', dataSrc)
      changed = true
    }
  })

  if (changed && typeof video.load === 'function') {
    video.load()
  }

  return changed
}

function getPosterFromVideo(video) {
  if (!video) return ''

  const existingPoster = normalizeHeroPosterUrl(video.getAttribute('poster'))
  if (existingPoster) return existingPoster

  const backgroundImage = video.style && video.style.backgroundImage
  const fromStyle = normalizeHeroPosterUrl(backgroundImage)
  if (fromStyle) return fromStyle

  const wrapper = video.closest && video.closest('.background_video')
  const fromWrapper = normalizeHeroPosterUrl(
    wrapper && wrapper.getAttribute('data-poster-url')
  )
  return fromWrapper
}

function getVideoWrapper(video) {
  if (!video || typeof video.closest !== 'function') return null
  return video.closest('.background_video')
}

function getHeroPosterImg(video) {
  const wrapper = getVideoWrapper(video)
  if (!wrapper || !wrapper.querySelector) return null
  return wrapper.querySelector(`img[${HERO_POSTER_IMG_ATTR}="true"]`)
}

function ensureHeroPosterImg(video, posterUrl) {
  if (!video || !posterUrl) return null

  const wrapper = getVideoWrapper(video)
  if (!wrapper) return null

  let img = getHeroPosterImg(video)
  if (!img) {
    img = document.createElement('img')
    img.setAttribute(HERO_POSTER_IMG_ATTR, 'true')
    img.setAttribute('alt', '')
    img.decoding = 'async'
    Object.assign(img.style, {
      position: 'absolute',
      inset: '0',
      margin: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: 'center center',
      display: 'block',
      pointerEvents: 'none',
      zIndex: '2',
    })
    wrapper.insertBefore(img, video)
  }

  if (img.getAttribute('src') !== posterUrl) {
    img.src = posterUrl
  }

  return img
}

function removeHeroPosterImg(video) {
  const img = getHeroPosterImg(video)
  if (img) img.remove()
}

function clearHeroVideoPosterBackground(video) {
  if (!video || !video.style) return
  try {
    video.style.setProperty('background-image', 'none', 'important')
  } catch (e) {
    video.style.backgroundImage = 'none'
  }
}

function neutralizeWrapperPosterLayer(wrapper) {
  if (!wrapper || !wrapper.style) return
  try {
    wrapper.style.setProperty('background-image', 'none', 'important')
    wrapper.style.setProperty('background-position', '50% 50%', 'important')
    wrapper.style.setProperty('background-size', 'cover', 'important')
    wrapper.style.setProperty('background-repeat', 'no-repeat', 'important')
  } catch (e) {
    // ignore
  }
}

function lockHeroVideoPlayback(video) {
  if (!video || !video.setAttribute) return
  video.setAttribute(HERO_VIDEO_PLAY_UNLOCKED_ATTR, 'false')
  try {
    video.autoplay = false
    video.removeAttribute('autoplay')
    video.pause()
    if (video.currentTime > 0.01) video.currentTime = 0
  } catch (e) {
    // ignore lock failures
  }
}

function unlockHeroVideoPlayback(video) {
  if (!video || !video.setAttribute) return
  video.setAttribute(HERO_VIDEO_PLAY_UNLOCKED_ATTR, 'true')
}

function isHeroVideoPlaybackUnlocked(video) {
  if (!video || !video.getAttribute) return false
  return video.getAttribute(HERO_VIDEO_PLAY_UNLOCKED_ATTR) === 'true'
}

export function enforceHeroMediaGeometry(video) {
  if (!video || !video.style) return
  const wrapper = getVideoWrapper(video)
  if (wrapper && wrapper.style) {
    wrapper.style.position = 'relative'
    wrapper.style.overflow = 'hidden'
    wrapper.style.width = '100%'
    wrapper.style.height = '100%'
    neutralizeWrapperPosterLayer(wrapper)
  }

  video.style.position = 'absolute'
  video.style.inset = '0'
  video.style.margin = '0'
  video.style.display = 'block'
  video.style.width = '100%'
  video.style.height = '100%'
  video.style.objectFit = 'cover'
  video.style.objectPosition = 'center center'
  video.style.zIndex = '1'
  logHeroSizeSnapshot(document, 'enforceHeroMediaGeometry')
}

function showHeroPosterLayer(video) {
  if (!video || !video.style) return
  video.style.opacity = '0'
  video.style.visibility = 'hidden'
  video.style.zIndex = '1'
  const img = getHeroPosterImg(video)
  if (img && img.style) {
    img.style.opacity = '1'
    img.style.visibility = 'visible'
    img.style.zIndex = '2'
  }
}

function showHeroVideoLayer(video) {
  if (!video || !video.style) return
  video.style.opacity = '1'
  video.style.visibility = 'visible'
  video.style.zIndex = '3'
}

function clearHeroPosterLayers(video) {
  if (!video || !video.style) return
  clearHeroVideoPosterBackground(video)
  neutralizeWrapperPosterLayer(getVideoWrapper(video))
  removeHeroPosterImg(video)
  logHeroSizeSnapshot(document, 'clearHeroPosterLayers')
}

function revealHeroVideo(video) {
  if (!video || !video.style) return

  video.setAttribute(HERO_VIDEO_READY_ATTR, 'true')
  showHeroVideoLayer(video)
  logHeroSizeSnapshot(document, 'revealHeroVideo:start')

  const finishReveal = () => {
    clearHeroPosterLayers(video)
  }

  if (typeof video.requestVideoFrameCallback === 'function') {
    video.requestVideoFrameCallback(() => {
      video.requestVideoFrameCallback(finishReveal)
    })
    return
  }

  video.addEventListener('playing', finishReveal, { once: true })
}

function prepareHeroVideoPlaceholder(video, posterUrl) {
  if (!video || !video.style) return
  const wrapper = getVideoWrapper(video)

  lockHeroVideoPlayback(video)
  enforceHeroMediaGeometry(video)
  video.setAttribute(HERO_VIDEO_READY_ATTR, 'false')

  if (posterUrl && video.setAttribute) {
    video.setAttribute('poster', posterUrl)
  }

  neutralizeWrapperPosterLayer(wrapper)
  ensureHeroPosterImg(video, posterUrl)
  clearHeroVideoPosterBackground(video)
  showHeroPosterLayer(video)
  video.style.transition = 'none'
  logHeroSizeSnapshot(document, 'prepareHeroVideoPlaceholder')
}

function ensureHeroVideoRevealHandlers(video) {
  if (!video || !video.addEventListener) return
  if (video.getAttribute(HERO_VIDEO_LISTENERS_ATTR) === 'true') return
  video.setAttribute(HERO_VIDEO_LISTENERS_ATTR, 'true')

  const guardPlayback = () => {
    if (isHeroVideoPlaybackUnlocked(video)) return
    try {
      video.pause()
      if (video.currentTime > 0.01) video.currentTime = 0
    } catch (e) {
      // ignore guard failures
    }
  }

  const onReady = () => {
    guardPlayback()
    if (isHeroVideoPlaybackUnlocked(video)) {
      revealHeroVideo(video)
    }
  }

  video.addEventListener('play', guardPlayback)
  video.addEventListener('loadeddata', onReady)
  video.addEventListener('canplay', onReady)
  video.addEventListener('playing', onReady)
}

function ensureHeroPosterPreload(posterUrl) {
  if (!posterUrl || typeof document === 'undefined') return null

  const selector = `link[${HERO_POSTER_PRELOAD_ATTR}="true"]`
  const existing = document.head && document.head.querySelector(selector)
  if (existing) {
    if (existing.getAttribute('href') !== posterUrl) {
      existing.setAttribute('href', posterUrl)
    }
    return existing
  }

  const attrs = buildHeroImagePreloadAttrs(posterUrl)
  const link = document.createElement('link')
  link.setAttribute(HERO_POSTER_PRELOAD_ATTR, 'true')
  link.rel = attrs.rel
  link.as = attrs.as
  link.href = attrs.href
  link.fetchPriority = attrs.fetchPriority
  document.head.appendChild(link)
  return link
}

export function prepareHeroMedia(root = document, opts = {}) {
  const scope = root && root.querySelector ? root : document
  const videos = getHeroVideosInScope(scope)
  const video = videos[0]

  if (!video) return null

  const isHome = isHomeScope(scope)
  let posterUrl = getPosterFromVideo(video)
  if (isHome) {
    posterUrl = HOME_AF_PLACEHOLDER_URL
  }
  if (posterUrl) {
    ensureHeroPosterPreload(posterUrl)
  }

  if (isHome) {
    prepareHeroVideoPlaceholder(video, posterUrl)
    suppressHomeHeroVideo(scope)
    return { video, posterUrl }
  }

  prepareHeroVideoPlaceholder(video, posterUrl)
  ensureHeroVideoRevealHandlers(video)

  video.muted = true
  video.playsInline = true
  video.setAttribute('playsinline', '')
  video.setAttribute('muted', '')

  if (opts.deferSources === false || shouldEagerLoadHeroVideo()) {
    restoreHeroVideoSources(video)
    video.preload = 'metadata'
    if (video.setAttribute) {
      video.setAttribute('preload', 'metadata')
    }
  } else {
    deferHeroVideoSources(video)
  }

  return { video, posterUrl }
}

export function suppressHomeHeroVideo(root = document) {
  const scope = root && root.querySelector ? root : document
  if (!isHomeScope(scope)) return null

  const videos = getHeroVideosInScope(scope)
  if (!videos.length) return null

  videos.forEach((video) => {
    stripHeroVideoSources(video)
    lockHeroVideoPlayback(video)
    hideHomeHeroVideoElement(video)
    neutralizeHomeHeroVideoWrapper(video)
    bindHomeHeroVideoGuard(video)
  })

  return videos[0]
}

export function requestHeroVideoPlayback(root = document) {
  const scope = root && root.querySelector ? root : document
  if (isHomeScope(scope)) {
    suppressHomeHeroVideo(scope)
    return null
  }
  const existingVideo = getHeroVideosInScope(scope)[0]

  if (
    existingVideo &&
    existingVideo.__cominviHeroPlayRequested &&
    !existingVideo.paused
  ) {
    unlockHeroVideoPlayback(existingVideo)
    enforceHeroMediaGeometry(existingVideo)
    revealHeroVideo(existingVideo)
    return existingVideo
  }

  const prepared = prepareHeroMedia(scope, { deferSources: false })
  const video = prepared && prepared.video
  if (!video) return null

  unlockHeroVideoPlayback(video)
  enforceHeroMediaGeometry(video)
  logHeroSizeSnapshot(document, 'requestHeroVideoPlayback')

  if (video.__cominviHeroPlayRequested && !video.paused) {
    revealHeroVideo(video)
    return video
  }

  video.__cominviHeroPlayRequested = true
  restoreHeroVideoSources(video)

  const startPlaybackFromZero = () => {
    try {
      video.pause()
    } catch (e) {
      // ignore
    }
    try {
      video.currentTime = 0
    } catch (e) {
      // ignore seek failures
    }
    const playPromise = video.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        try {
          video.muted = true
          video.play().catch(() => void 0)
        } catch (e) {
          // ignore autoplay failures
        }
      })
    }
  }

  const shouldDeferUntilLoaderDone =
    !window.__loaderDone && !!document.querySelector('.loader')

  if (shouldDeferUntilLoaderDone) {
    try {
      video.pause()
      video.currentTime = 0
    } catch (e) {
      // ignore
    }

    if (!video.__cominviLoaderDonePlayBound) {
      video.__cominviLoaderDonePlayBound = true
      document.addEventListener(
        'loader:done',
        () => {
          startPlaybackFromZero()
        },
        { once: true }
      )
    }
    return video
  }

  startPlaybackFromZero()

  return video
}

export { HERO_VIDEO_SELECTOR }
