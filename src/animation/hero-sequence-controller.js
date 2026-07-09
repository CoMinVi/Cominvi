import { afResizeLog } from '../app/af-resize-debug.js'
import { createHeroIntroVideo } from './hero-intro-video.js'
import {
  getIntroDurationSec,
  loadHeroManifest,
  pickHeroVariant,
  resolveHeroAssetUrl,
} from './hero-manifest.js'
import { createHeroScrollSequence } from './hero-scroll-sequence.js'

export const HERO_OVERLAY_DISABLED_ATTR = 'data-cominvi-hero-overlay-disabled'

let heroOverlayGuardObserver = null

export function disableHeroBackgroundOverlay(scope = document) {
  const root = scope && scope.querySelector ? scope : document
  const overlay = root.querySelector('.hero-background > .background-overlay')
  if (!overlay?.style) return false

  overlay.setAttribute(HERO_OVERLAY_DISABLED_ATTR, 'true')

  try {
    overlay.style.setProperty('display', 'none', 'important')
    overlay.style.setProperty('opacity', '0', 'important')
    overlay.style.setProperty('visibility', 'hidden', 'important')
    overlay.style.setProperty('pointer-events', 'none', 'important')
    overlay.style.setProperty('background-image', 'none', 'important')
    overlay.style.setProperty('z-index', '-1', 'important')
  } catch (e) {
    overlay.style.display = 'none'
    overlay.style.opacity = '0'
    overlay.style.visibility = 'hidden'
    overlay.style.pointerEvents = 'none'
    overlay.style.backgroundImage = 'none'
    overlay.style.zIndex = '-1'
  }

  const inner = root.querySelector('.hero-background > .background-inner')
  if (inner?.style) {
    try {
      inner.style.setProperty('position', 'relative', 'important')
      inner.style.setProperty('z-index', '2', 'important')
    } catch (e) {
      inner.style.position = 'relative'
      inner.style.zIndex = '2'
    }
  }

  return true
}

export function bindHeroBackgroundOverlayGuard(scope = document) {
  const root = scope && scope.querySelector ? scope : document

  const apply = () => {
    disableHeroBackgroundOverlay(root)
  }

  apply()

  if (heroOverlayGuardObserver) return apply

  try {
    heroOverlayGuardObserver = new MutationObserver(() => {
      apply()
    })
    heroOverlayGuardObserver.observe(
      root.documentElement || document.documentElement,
      {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      }
    )
  } catch (e) {
    // ignore
  }

  return apply
}

function hideHeroPoster(backgroundInner) {
  if (!backgroundInner?.querySelector) return

  const wrapper = backgroundInner.querySelector('.background_video')
  if (!wrapper) return

  const posterImg = wrapper.querySelector(
    'img[data-cominvi-hero-poster-img="true"]'
  )
  if (posterImg?.style) {
    posterImg.style.opacity = '0'
    posterImg.style.visibility = 'hidden'
    posterImg.style.pointerEvents = 'none'
  }

  const video = wrapper.querySelector(
    'video:not([data-cominvi-hero-intro-video])'
  )
  if (video?.style) {
    try {
      video.style.setProperty('background-image', 'none', 'important')
    } catch (e) {
      video.style.backgroundImage = 'none'
    }
  }
}

function createNoopSequenceController() {
  return {
    ready: Promise.resolve(),
    setIntroProgress: () => {},
    startIntroPlayback: () => {},
    finishIntroHandoff: () => {},
    freezeForTransitionLeave: () => {},
    setScrollProgress: () => {},
    setFrame: () => {},
    repaint: () => false,
    destroy: () => {},
  }
}

export function createHeroSequenceController(backgroundInner) {
  if (!backgroundInner) return createNoopSequenceController()

  disableHeroBackgroundOverlay(
    backgroundInner.closest('.hero-background') || document
  )

  const mediaHost =
    backgroundInner.querySelector('.background_video') || backgroundInner

  let intro = null
  let scroll = null
  let mode = 'intro'
  let posterHidden = false
  let resizeObserver = null

  const hidePosterOnce = () => {
    if (posterHidden) return
    posterHidden = true
    hideHeroPoster(backgroundInner)
  }

  const ready = loadHeroManifest()
    .then((manifest) => {
      const variant = pickHeroVariant(manifest)
      if (!variant) {
        throw new Error('Hero manifest variant missing')
      }

      const introDuration = getIntroDurationSec(manifest)
      intro = createHeroIntroVideo({
        host: mediaHost,
        src: resolveHeroAssetUrl(variant.intro?.mp4),
        durationSec: introDuration,
      })
      scroll = createHeroScrollSequence({
        backgroundInner,
        variant,
        manifest,
        indexPad: manifest?.scroll?.indexPad || 5,
      })

      return Promise.all([intro.ready, scroll.ready])
    })
    .then(() => {
      afResizeLog('hero-sequence:ready', {
        introDuration: intro?.duration,
        scrollFrames: scroll?.frameCount,
      })

      try {
        resizeObserver = new ResizeObserver(() => {
          if (mode === 'scroll' && scroll) {
            scroll.repaint('resize-observer')
          }
        })
        resizeObserver.observe(mediaHost)
        resizeObserver.observe(backgroundInner)
      } catch (e) {
        // ignore
      }
    })
    .catch((error) => {
      afResizeLog('hero-sequence:error', { message: error?.message })
    })

  const syncScrollFromTrigger = () => {
    try {
      const st = window.__homeSequenceScrollTrigger
      if (!st || !scroll) return
      scroll.setProgress(Math.max(0, Math.min(Number(st.progress) || 0, 1)))
    } catch (e) {
      // ignore
    }
  }

  return {
    ready,
    setIntroProgress(progress) {
      if (!intro) return
      const p = Math.max(0, Math.min(Number(progress) || 0, 1))
      mode = 'intro'
      scroll?.hide()
      intro.setProgress(p)
      if (p > 0) {
        intro.show()
        hidePosterOnce()
      } else {
        intro.hide()
      }
    },
    startIntroPlayback(scaleDurationSec = 1.2) {
      if (!intro) return
      mode = 'intro'
      scroll?.hide()
      hidePosterOnce()

      const duration = intro.duration || 3.6
      const scaleDuration = Math.max(0.1, Number(scaleDurationSec) || 1.2)
      const playbackRate = duration / scaleDuration

      intro.startPlayback({ playbackRate, fromTime: 0 })
      afResizeLog('hero-intro:playback-start', {
        duration,
        scaleDuration,
        playbackRate,
      })
    },
    finishIntroHandoff() {
      intro?.stopPlayback?.()
      intro?.hide()
      mode = 'scroll'
      hidePosterOnce()
      scroll?.setProgress(0)
      scroll?.show()
      scroll?.repaint?.('intro-handoff')
      afResizeLog('hero-intro:handoff')
    },
    freezeForTransitionLeave() {
      intro?.stopPlayback?.()
      intro?.hide()
      hidePosterOnce()
      scroll?.show()
      scroll?.repaint?.('transition-leave-freeze')
      afResizeLog('hero-sequence:freeze-leave')
    },
    setScrollProgress(progress) {
      if (!scroll) return
      mode = 'scroll'
      intro?.hide()
      scroll.setProgress(progress)
      scroll.show()
      hidePosterOnce()
    },
    setFrame(frameIndex) {
      if (!scroll) return
      mode = 'scroll'
      intro?.hide()
      scroll.setFrame(frameIndex)
      scroll.show()
      hidePosterOnce()
    },
    repaint(reason = 'repaint') {
      if (mode === 'intro') {
        return false
      }

      syncScrollFromTrigger()
      return scroll?.repaint(reason) || false
    },
    destroy() {
      if (resizeObserver) {
        resizeObserver.disconnect()
        resizeObserver = null
      }
      try {
        intro?.destroy()
      } catch (e) {
        // ignore
      }
      try {
        scroll?.destroy()
      } catch (e) {
        // ignore
      }
      intro = null
      scroll = null
    },
  }
}
