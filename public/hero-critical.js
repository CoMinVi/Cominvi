/**
 * Must run synchronously in <head>, before webflow.js and before first paint.
 * Loaded as a classic script (not type="module").
 */
;(function injectCominviHeroCriticalStyles() {
  if (document.querySelector('style[data-cominvi-hero-critical]')) return

  const LOCK_ATTR = 'data-cominvi-hero-locked'
  const POSTER_IMG_ATTR = 'data-cominvi-hero-poster-img'

  const style = document.createElement('style')
  style.setAttribute('data-cominvi-hero-critical', '')
  style.textContent = `
.hero-background {
  z-index: 0;
  display: flex;
  position: absolute;
  inset: 0;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}
.hero-background .background-inner {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 120%;
  height: 120%;
  flex: 0 0 auto;
}
.hero-background .is-video {
  width: 100%;
  height: 100%;
}
.hero-background .background_video,
.hero-background .background_video.w-background-video {
  position: relative;
  overflow: hidden;
  width: 100% !important;
  height: 100% !important;
  background-image: none !important;
}
.hero-background .background_video > video,
.hero-background .w-background-video > video {
  position: absolute !important;
  inset: 0 !important;
  margin: 0 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  object-position: 50% 50% !important;
  z-index: 1 !important;
  opacity: 0 !important;
  visibility: hidden !important;
}
.hero-background .background_video > img[data-cominvi-hero-poster-img="true"],
.hero-background .w-background-video > img[data-cominvi-hero-poster-img="true"] {
  position: absolute !important;
  inset: 0 !important;
  margin: 0 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  object-position: 50% 50% !important;
  z-index: 2 !important;
  pointer-events: none !important;
}
`

  const head = document.head || document.getElementsByTagName('head')[0]
  if (head) head.appendChild(style)

  function parsePosterUrl(video) {
    if (!video) return ''
    const poster = video.getAttribute('poster')
    if (poster && poster.trim()) return poster.trim()
    const bg = video.style && video.style.backgroundImage
    if (!bg) return ''
    const match = bg.match(/url\(["']?(.+?)["']?\)/i)
    return match && match[1] ? match[1].trim() : ''
  }

  function ensureEarlyPosterImg(video) {
    const posterUrl = parsePosterUrl(video)
    if (!posterUrl) return null

    const wrapper = video.closest('.background_video')
    if (!wrapper) return null

    let img = wrapper.querySelector(`img[${POSTER_IMG_ATTR}="true"]`)
    if (!img) {
      img = document.createElement('img')
      img.setAttribute(POSTER_IMG_ATTR, 'true')
      img.setAttribute('alt', '')
      img.decoding = 'async'
      wrapper.insertBefore(img, video)
    }

    if (img.getAttribute('src') !== posterUrl) {
      img.src = posterUrl
    }

    try {
      video.style.setProperty('background-image', 'none', 'important')
    } catch (e) {
      video.style.backgroundImage = 'none'
    }

    return img
  }

  function lockHeroVideo(video) {
    if (!video || video.getAttribute(LOCK_ATTR) === 'true') return
    video.setAttribute(LOCK_ATTR, 'true')

    const homeContainer = video.closest('[data-barba-namespace]')
    const isHome =
      homeContainer &&
      (homeContainer.getAttribute('data-barba-namespace') || '')
        .trim()
        .toLowerCase() === 'home'

    if (isHome) {
      video.setAttribute('data-cominvi-home-af-only', 'true')
    }

    const displayValue = isHome ? 'none' : 'block'
    ;[
      ['position', 'absolute'],
      ['inset', '0'],
      ['margin', '0'],
      ['width', '100%'],
      ['height', '100%'],
      ['object-fit', 'cover'],
      ['object-position', '50% 50%'],
      ['display', displayValue],
      ['z-index', '1'],
      ['opacity', '0'],
      ['visibility', 'hidden'],
    ].forEach(([prop, value]) => {
      try {
        video.style.setProperty(prop, value, 'important')
      } catch (e) {
        video.style[prop] = value
      }
    })

    const wrapper = video.closest('.background_video')
    if (!wrapper) return
    ;[
      ['position', 'relative'],
      ['overflow', 'hidden'],
      ['width', '100%'],
      ['height', '100%'],
      ['background-image', 'none'],
    ].forEach(([prop, value]) => {
      try {
        wrapper.style.setProperty(prop, value, 'important')
      } catch (e) {
        wrapper.style[prop] = value
      }
    })

    ensureEarlyPosterImg(video)
  }

  function scanHeroVideos() {
    document
      .querySelectorAll('.hero-background .background_video video')
      .forEach(lockHeroVideo)
  }

  scanHeroVideos()
  new MutationObserver(scanHeroVideos).observe(document.documentElement, {
    childList: true,
    subtree: true,
  })

  // Early size logger (before main.js). Same prefix as src/app/hero-size-debug.js
  ;(function startHeroSizeDebugEarly() {
    if (window.__cominviHeroSizeDebugEarly) return

    const PREFIX = '[cominvi-hero-size]'
    const store = []
    let lastKey = 'missing'

    function round(v) {
      return typeof v === 'number' && Number.isFinite(v)
        ? Math.round(v * 10) / 10
        : null
    }

    function read(tag) {
      const video = document.querySelector(
        '.hero-background .background_video video'
      )
      if (!video) return { tag, t: round(performance.now()), ready: false }

      const inner = document.querySelector('.hero-background .background-inner')
      const wrapper = video.closest('.background_video')
      const posterImg = wrapper
        ? wrapper.querySelector('img[data-cominvi-hero-poster-img="true"]')
        : null
      const posterRect = posterImg ? posterImg.getBoundingClientRect() : null
      const rect = posterRect || video.getBoundingClientRect()
      const cs = getComputedStyle(video)
      const innerRect = inner ? inner.getBoundingClientRect() : null
      const hasBg = cs.backgroundImage && cs.backgroundImage !== 'none'

      return {
        tag,
        t: round(performance.now()),
        ready: true,
        phase: posterImg
          ? 'placeholder-img'
          : hasBg
            ? 'placeholder-bg'
            : 'placeholder-poster',
        source: 'hero-critical',
        placeholder: {
          w: round(rect.width),
          h: round(rect.height),
          bg: cs.backgroundImage,
          zIndex: cs.zIndex,
          inset: cs.inset,
          objectFit: cs.objectFit,
        },
        video: {
          w: round(rect.width),
          h: round(rect.height),
          intrinsicW: video.videoWidth || 0,
          intrinsicH: video.videoHeight || 0,
        },
        inner: innerRect
          ? { w: round(innerRect.width), h: round(innerRect.height) }
          : null,
        wrapper: wrapper
          ? {
              w: round(wrapper.getBoundingClientRect().width),
              h: round(wrapper.getBoundingClientRect().height),
            }
          : null,
      }
    }

    function sizeKey(s) {
      if (!s.ready) return 'missing'
      return [
        s.placeholder.w,
        s.placeholder.h,
        s.video.w,
        s.video.h,
        s.video.intrinsicW,
        s.video.intrinsicH,
        s.wrapper && s.wrapper.w,
        s.wrapper && s.wrapper.h,
        s.inner && s.inner.w,
        s.inner && s.inner.h,
        s.phase,
      ].join('x')
    }

    function push(snapshot) {
      const k = sizeKey(snapshot)
      if (k === lastKey) return
      lastKey = k
      store.push(snapshot)
      if (snapshot.ready) {
        console.log(
          PREFIX,
          snapshot.tag,
          `placeholder=${snapshot.placeholder.w}x${snapshot.placeholder.h}`,
          `video=${snapshot.video.w}x${snapshot.video.h}`,
          `intrinsic=${snapshot.video.intrinsicW}x${snapshot.video.intrinsicH}`,
          snapshot.wrapper
            ? `wrapper=${snapshot.wrapper.w}x${snapshot.wrapper.h}`
            : 'wrapper=null',
          snapshot.inner
            ? `inner=${snapshot.inner.w}x${snapshot.inner.h}`
            : 'inner=null',
          snapshot
        )
      } else {
        console.log(PREFIX, snapshot.tag, 'video absent', snapshot)
      }
    }

    function tick() {
      push(read('early-raf'))
      window.__cominviHeroSizeDebugEarly.rafId =
        requestAnimationFrame(tick)
    }

    push(read('hero-critical-start'))
    window.__cominviHeroSizeDebugEarly = {
      store,
      rafId: requestAnimationFrame(tick),
      stop() {
        if (this.rafId) cancelAnimationFrame(this.rafId)
      },
    }
    console.info(PREFIX, 'early logger — logs uniquement si une taille change')
  })()

  ;(function preloadHomeAfAssetsEarly() {
    const path = (location.pathname || '/').replace(/\/$/, '') || '/'
    if (path !== '/' && !path.endsWith('/index.html')) return

    const ORIGIN = 'https://precious-hotteok-8da21f.netlify.app'
    const AF_URL = ORIGIN + '/cave-scene/cave-scene-full-sequence.af'
    const POSTER_URL = ORIGIN + '/cave-scene/frame_00001.avif'
    const head = document.head || document.getElementsByTagName('head')[0]
    if (!head) return

    if (!head.querySelector('link[data-cominvi-af-preconnect]')) {
      const preconnect = document.createElement('link')
      preconnect.rel = 'preconnect'
      preconnect.href = ORIGIN
      preconnect.crossOrigin = 'anonymous'
      preconnect.setAttribute('data-cominvi-af-preconnect', 'true')
      head.appendChild(preconnect)
    }

    if (!head.querySelector('link[data-cominvi-af-preload]')) {
      const preloadAf = document.createElement('link')
      preloadAf.rel = 'preload'
      preloadAf.as = 'fetch'
      preloadAf.href = AF_URL
      preloadAf.crossOrigin = 'anonymous'
      preloadAf.setAttribute('fetchpriority', 'high')
      preloadAf.setAttribute('data-cominvi-af-preload', 'true')
      head.appendChild(preloadAf)
    }

    if (!head.querySelector('link[data-cominvi-af-poster-preload]')) {
      const preloadPoster = document.createElement('link')
      preloadPoster.rel = 'preload'
      preloadPoster.as = 'image'
      preloadPoster.href = POSTER_URL
      preloadPoster.setAttribute('fetchpriority', 'high')
      preloadPoster.setAttribute('data-cominvi-af-poster-preload', 'true')
      head.appendChild(preloadPoster)
    }
  })()
})()
