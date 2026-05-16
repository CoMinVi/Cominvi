const HERO_VIDEO_SELECTOR = '.hero-background .background_video video'
const HERO_POSTER_PRELOAD_ATTR = 'data-cominvi-hero-poster-preload'

export function normalizeHeroPosterUrl(value) {
  if (!value || typeof value !== 'string') return ''
  let url = value.trim()
  const cssUrlMatch = url.match(/^url\((.*)\)$/i)
  if (cssUrlMatch && cssUrlMatch[1]) {
    url = cssUrlMatch[1].trim()
  }
  url = url.replace(/^['"]+|['")]+$/g, '').trim()
  url = url.replace(/;+$/g, '').trim()
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
  const video =
    (scope.querySelector && scope.querySelector(HERO_VIDEO_SELECTOR)) ||
    document.querySelector(HERO_VIDEO_SELECTOR)

  if (!video) return null

  const posterUrl = getPosterFromVideo(video)
  if (posterUrl) {
    video.setAttribute('poster', posterUrl)
    if (video.style) {
      video.style.backgroundImage = `url("${posterUrl}")`
    }
    ensureHeroPosterPreload(posterUrl)
  }

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

export function requestHeroVideoPlayback(root = document) {
  const prepared = prepareHeroMedia(root, { deferSources: false })
  const video = prepared && prepared.video
  if (!video) return null

  if (video.__cominviHeroPlayRequested && !video.paused) {
    return video
  }

  video.__cominviHeroPlayRequested = true
  restoreHeroVideoSources(video)
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

  return video
}
