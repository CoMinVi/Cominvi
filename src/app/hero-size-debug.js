const MAX_STORED = 400

function round(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 10) / 10
    : null
}

function shortBg(value) {
  if (!value || value === 'none') return 'none'
  if (value.length <= 72) return value
  return `${value.slice(0, 69)}...`
}

export function readHeroSizeSnapshot(root = document, tag = 'sample') {
  const scope = root && root.querySelector ? root : document
  const video =
    (scope.querySelector &&
      scope.querySelector('.hero-background .background_video video')) ||
    document.querySelector('.hero-background .background_video video')
  const wrapper =
    (video && video.closest && video.closest('.background_video')) ||
    scope.querySelector('.hero-background .background_video')
  const inner =
    scope.querySelector('.hero-background .background-inner') ||
    document.querySelector('.hero-background .background-inner')

  if (!video) {
    return {
      tag,
      t: round(performance.now()),
      ready: false,
    }
  }

  const rect = video.getBoundingClientRect()
  const wrapRect = wrapper ? wrapper.getBoundingClientRect() : null
  const innerRect = inner ? inner.getBoundingClientRect() : null
  const posterImg =
    wrapper && wrapper.querySelector
      ? wrapper.querySelector('img[data-cominvi-hero-poster-img="true"]')
      : null
  const posterRect = posterImg ? posterImg.getBoundingClientRect() : null
  const cs = getComputedStyle(video)
  const wrapCs = wrapper ? getComputedStyle(wrapper) : null
  const innerCs = inner ? getComputedStyle(inner) : null

  const hasBgImage = cs.backgroundImage && cs.backgroundImage !== 'none'
  const isPlaying = !video.paused && video.currentTime > 0
  const phase = posterImg
    ? 'placeholder-img'
    : isPlaying
    ? 'video'
    : hasBgImage
    ? 'placeholder-bg'
    : 'placeholder-poster'

  return {
    tag,
    t: round(performance.now()),
    ready: true,
    phase,
    placeholder: {
      w: round(posterRect ? posterRect.width : rect.width),
      h: round(posterRect ? posterRect.height : rect.height),
      bg: shortBg(cs.backgroundImage),
      poster: video.getAttribute('poster') || null,
      opacity: posterImg ? getComputedStyle(posterImg).opacity : cs.opacity,
      zIndex: posterImg ? getComputedStyle(posterImg).zIndex : cs.zIndex,
      inset: cs.inset,
      objectFit: cs.objectFit,
      position: cs.position,
    },
    video: {
      w: round(rect.width),
      h: round(rect.height),
      intrinsicW: video.videoWidth || 0,
      intrinsicH: video.videoHeight || 0,
      readyState: video.readyState,
      paused: video.paused,
      currentTime: round(video.currentTime),
      opacity: cs.opacity,
      zIndex: cs.zIndex,
      inset: cs.inset,
      objectFit: cs.objectFit,
    },
    wrapper: wrapRect
      ? { w: round(wrapRect.width), h: round(wrapRect.height) }
      : null,
    inner: innerRect
      ? {
          w: round(innerRect.width),
          h: round(innerRect.height),
          cssW: innerCs && innerCs.width,
          cssH: innerCs && innerCs.height,
          transform: innerCs && innerCs.transform,
        }
      : null,
    wrapperBg: wrapCs ? shortBg(wrapCs.backgroundImage) : null,
  }
}

function sizeKey(snapshot) {
  if (!snapshot || !snapshot.ready) return 'missing'
  return [
    snapshot.placeholder && snapshot.placeholder.w,
    snapshot.placeholder && snapshot.placeholder.h,
    snapshot.video && snapshot.video.w,
    snapshot.video && snapshot.video.h,
    snapshot.video && snapshot.video.intrinsicW,
    snapshot.video && snapshot.video.intrinsicH,
    snapshot.wrapper && snapshot.wrapper.w,
    snapshot.wrapper && snapshot.wrapper.h,
    snapshot.inner && snapshot.inner.w,
    snapshot.inner && snapshot.inner.h,
    snapshot.phase,
  ].join('x')
}

export function isHeroSizeDebugEnabled() {
  try {
    if (typeof window === 'undefined') return false
    if (window.__cominviHeroSizeDebugForce) return true
    const params = new URLSearchParams(window.location.search)
    if (params.get('heroDebug') === '1') return true
    return window.localStorage?.getItem('cominvi:heroDebug') === '1'
  } catch (e) {
    return false
  }
}

export function logHeroSizeSnapshot(root = document, tag = 'sample') {
  const snapshot = readHeroSizeSnapshot(root, tag)
  if (!isHeroSizeDebugEnabled()) return snapshot
  if (!window.__cominviHeroSizeDebug) {
    startHeroSizeDebug(root)
  }
  window.__cominviHeroSizeDebug.pushManual(snapshot)
  return snapshot
}

export function startHeroSizeDebug(root = document) {
  if (!isHeroSizeDebugEnabled()) return null
  if (window.__cominviHeroSizeDebug && window.__cominviHeroSizeDebug.active) {
    return window.__cominviHeroSizeDebug
  }

  const store = []
  let rafId = 0
  let lastSizeKey = 'missing'
  let sampleCount = 0

  const push = (snapshot) => {
    const key = sizeKey(snapshot)
    if (key === lastSizeKey) return

    lastSizeKey = key
    sampleCount += 1
    store.push(snapshot)
    if (store.length > MAX_STORED) store.shift()
  }

  const tick = () => {
    push(readHeroSizeSnapshot(root, 'raf'))
    rafId = requestAnimationFrame(tick)
  }

  const observer = new MutationObserver(() => {
    push(readHeroSizeSnapshot(root, 'dom-mutation'))
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'poster', 'src'],
  })

  document.addEventListener(
    'loader:done',
    () => {
      push(readHeroSizeSnapshot(root, 'loader:done'))
    },
    { once: true }
  )

  document.addEventListener(
    'hero:ready',
    () => {
      push(readHeroSizeSnapshot(root, 'hero:ready'))
    },
    { once: true }
  )

  push(readHeroSizeSnapshot(root, 'debug-start'))
  rafId = requestAnimationFrame(tick)

  window.__cominviHeroSizeDebug = {
    active: true,
    store,
    pushManual(snapshot) {
      push(snapshot)
    },
    stop() {
      if (rafId) cancelAnimationFrame(rafId)
      observer.disconnect()
      this.active = false
    },
    dump() {
      return store.slice()
    },
    sampleCount,
  }

  return window.__cominviHeroSizeDebug
}
