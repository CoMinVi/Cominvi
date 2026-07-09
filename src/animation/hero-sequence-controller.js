import { afResizeLog } from '../app/af-resize-debug.js'
import { createHeroIntroVideo } from './hero-intro-video.js'
import {
  getIntroDurationSec,
  loadHeroManifest,
  pickHeroVariant,
  resolveHeroAssetUrl,
} from './hero-manifest.js'
import { createHeroScrollSequence } from './hero-scroll-sequence.js'

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
    setScrollProgress: () => {},
    setFrame: () => {},
    repaint: () => false,
    destroy: () => {},
  }
}

export function createHeroSequenceController(backgroundInner) {
  if (!backgroundInner) return createNoopSequenceController()

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
      mode = 'intro'
      scroll?.hide()
      intro.setProgress(progress)
      intro.show()
      if (progress > 0) hidePosterOnce()
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
