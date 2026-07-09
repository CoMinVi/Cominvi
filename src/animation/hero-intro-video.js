const INTRO_VIDEO_ATTR = 'data-cominvi-hero-intro-video'

export function createHeroIntroVideo({ host, src, durationSec = 3.6 }) {
  if (!host || !src) {
    return {
      ready: Promise.resolve(),
      setProgress: () => {},
      startPlayback: () => {},
      stopPlayback: () => {},
      show: () => {},
      hide: () => {},
      destroy: () => {},
    }
  }

  let video = host.querySelector(`video[${INTRO_VIDEO_ATTR}="true"]`) || null

  if (!video) {
    video = document.createElement('video')
    video.setAttribute(INTRO_VIDEO_ATTR, 'true')
    video.setAttribute('muted', '')
    video.setAttribute('playsinline', '')
    video.setAttribute('preload', 'auto')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.autoplay = false
    video.loop = false
    video.controls = false
    Object.assign(video.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: '50% 50%',
      display: 'block',
      pointerEvents: 'none',
      zIndex: '3',
      opacity: '0',
      visibility: 'hidden',
    })
    host.appendChild(video)
  }

  let resolvedDuration = Math.max(0.1, Number(durationSec) || 3.6)
  let isPlayingIntro = false
  let readyResolve = () => {}
  const ready = new Promise((resolve) => {
    readyResolve = resolve
  })

  const markReady = () => {
    if (
      video.duration &&
      Number.isFinite(video.duration) &&
      video.duration > 0
    ) {
      resolvedDuration = video.duration
    }
    readyResolve()
  }

  const onError = () => {
    readyResolve()
  }

  video.addEventListener('loadeddata', markReady, { once: true })
  video.addEventListener('canplay', markReady, { once: true })
  video.addEventListener('error', onError, { once: true })

  if (video.src !== src) {
    video.src = src
    try {
      video.load()
    } catch (e) {
      // ignore
    }
  } else if (video.readyState >= 2) {
    markReady()
  }

  window.setTimeout(markReady, 1500)

  const applyVisibility = (visible) => {
    if (visible) {
      try {
        video.style.setProperty('display', 'block', 'important')
        video.style.setProperty('opacity', '1', 'important')
        video.style.setProperty('visibility', 'visible', 'important')
        video.style.setProperty('z-index', '3', 'important')
      } catch (e) {
        video.style.opacity = '1'
        video.style.visibility = 'visible'
      }
      return
    }

    try {
      video.style.setProperty('opacity', '0', 'important')
      video.style.setProperty('visibility', 'hidden', 'important')
    } catch (e) {
      video.style.opacity = '0'
      video.style.visibility = 'hidden'
    }
  }

  const seekToProgress = (progress) => {
    const p = Math.max(0, Math.min(Number(progress) || 0, 1))
    const targetTime = p * resolvedDuration

    try {
      video.pause()
    } catch (e) {
      // ignore
    }

    try {
      if (Math.abs(video.currentTime - targetTime) > 0.001) {
        video.currentTime = targetTime
      }
    } catch (e) {
      // ignore seek failures before metadata
    }
  }

  return {
    ready,
    get duration() {
      return resolvedDuration
    },
    setProgress(progress) {
      if (isPlayingIntro) return
      seekToProgress(progress)
    },
    startPlayback({ playbackRate = 1, fromTime = 0 } = {}) {
      isPlayingIntro = true
      applyVisibility(true)

      try {
        video.pause()
        video.playbackRate = Math.max(
          0.25,
          Math.min(Number(playbackRate) || 1, 16)
        )
        if (Number.isFinite(fromTime) && fromTime >= 0) {
          video.currentTime = fromTime
        }
        const playPromise = video.play()
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            isPlayingIntro = false
          })
        }
      } catch (e) {
        isPlayingIntro = false
      }
    },
    stopPlayback() {
      isPlayingIntro = false
      try {
        video.pause()
      } catch (e) {
        // ignore
      }
    },
    show: () => applyVisibility(true),
    hide() {
      this.stopPlayback()
      applyVisibility(false)
    },
    destroy() {
      this.stopPlayback()
      try {
        video.removeAttribute('src')
        video.remove()
      } catch (e) {
        // ignore
      }
    },
  }
}
