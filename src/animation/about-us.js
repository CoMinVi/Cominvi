import SplitType from 'split-type'

import { initWorkshopsStickyImages } from './workshops.js'
export function initAbout(root = document) {
  // Scope to About Us page
  try {
    const container = root && root.nodeType === 1 ? root : document
    const isSelfAbout =
      container &&
      container.getAttribute &&
      container.getAttribute('data-barba-namespace') === 'About us'
    const page = isSelfAbout
      ? container
      : container.querySelector('[data-barba-namespace="About us"]')
    if (!page) return
    root = page
  } catch (err) {
    return
  }

  const withFadeHelpers = (el) => {
    if (!el) return
    try {
      const cs = window.getComputedStyle(el)
      // Ensure element is not display:none; we only animate opacity
      if (cs.display === 'none' || el.style.display === 'none') {
        el.style.display = 'block'
      }
      el.style.willChange = 'opacity'
      if (!el.style.transition || !el.style.transition.includes('opacity')) {
        el.style.transition = 'opacity 0.5s ease'
      }
      if (!el.style.opacity) el.style.opacity = '1'
    } catch (e) {
      // ignore
    }
  }

  const fadeOut = (el) => {
    if (!el) return
    try {
      el.style.opacity = '0'
    } catch (e) {
      // ignore
    }
  }

  const fadeIn = (el) => {
    if (!el) return
    try {
      // Only animate opacity; do not toggle display
      el.style.opacity = '1'
    } catch (e) {
      // ignore
    }
  }

  // Removed unused initEyebrowsStyle (dynamic handled in update)

  const initVideos = () => {
    const storyContent = root.querySelector('.story_content')
    const introInner = root.querySelector('.story_intro_inner')
    const v1 = root.querySelector('.story_videos.is-1')
    const v2 = root.querySelector('.story_videos.is-2')
    const v3 = root.querySelector('.story_videos.is-3')
    const v4 = root.querySelector('.story_videos.is-4')
    const vids = [v1, v2, v3, v4]
    const storyIntros = Array.from(root.querySelectorAll('.intro.is-story'))
    const dateNumbers = Array.from(root.querySelectorAll('.date-number'))
    const [dateNumber1, dateNumber2, dateNumber3, dateNumber4] = dateNumbers
    const trackedDateNumbers = [
      dateNumber1,
      dateNumber2,
      dateNumber3,
      dateNumber4,
    ].filter(Boolean)
    const DATE_STAGGER_OFFSET = 0.12
    const DATE_OVERLAY_ANIM_DURATION = 500
    const DATE_OVERLAY_DEFAULT_TARGET = trackedDateNumbers.map(() => 0)
    const DATE_OVERLAY_TARGETS = {
      '-1': [0, 0, 0, 0],
      0: [0, 0, 0, 0],
      1: [0, 0, -1, -1],
      2: [0, 0, -2, -2],
      3: [-1, -1, -3, -3],
    }
    const VIDEO_INACTIVE_SCALE = 1.2
    const VIDEO_ACTIVE_SCALE = 1
    const VIDEO_SCALE_EASE = 'cubic-bezier(0.25, 0.1, 0.25, 1)'
    const clamp = (value, min, max) => {
      if (value < min) return min
      if (value > max) return max
      return value
    }
    const clamp01 = (value) => clamp(value, 0, 1)
    const clampOverlay = (value) => clamp(value, -10, 10)
    const ensureTransformTransition = (el) => {
      try {
        const existingTransition = el.style.transition || ''
        const transformTransition = `transform 0.6s ${VIDEO_SCALE_EASE}`
        if (!existingTransition.includes('transform')) {
          el.style.transition = existingTransition
            ? `${existingTransition}, ${transformTransition}`
            : transformTransition
        }
      } catch (e) {
        // ignore
      }
    }
    const getVideoScaleTarget = (wrap) => {
      if (!wrap) return null
      try {
        const inner = wrap.querySelector
          ? wrap.querySelector('.story_video')
          : null
        return inner || wrap
      } catch (e) {
        return wrap
      }
    }
    const setVideoScale = (wrap, scale) => {
      const target = getVideoScaleTarget(wrap)
      if (!target) return
      try {
        ensureTransformTransition(target)
        target.style.transform = `scale(${scale})`
      } catch (e) {
        // ignore
      }
    }
    const dateNumberStates = trackedDateNumbers.map(() => ({
      baseProgress: 0,
      overlay: 0,
    }))
    const getVideoTargetScale = (idx, isActive, scalingEnabled) => {
      if (!scalingEnabled) return VIDEO_ACTIVE_SCALE
      if (idx === 0) return VIDEO_ACTIVE_SCALE
      return isActive ? VIDEO_ACTIVE_SCALE : VIDEO_INACTIVE_SCALE
    }
    const applyVideoScaling = (activeIdx, scalingEnabled) => {
      vids.forEach((wrap, i) => {
        if (!wrap) return
        const isActive = i === activeIdx
        const targetScale = getVideoTargetScale(i, isActive, scalingEnabled)
        setVideoScale(wrap, targetScale)
      })
    }
    let currentDateOverlayTargetKey = null
    let dateOverlayAnimationFrame = null
    let dateOverlayAnimationStart = 0
    let dateOverlayAnimationFrom = null
    let dateOverlayAnimationTargets = null
    let videoScalingEnabled = false
    const LINE_EASE = VIDEO_SCALE_EASE
    const LINE_DURATION_S = 0.6
    const LINE_STAGGER_S = 0.05
    const videoTextLines = new Map()
    const cubicBezier = (mX1, mY1, mX2, mY2) => {
      if (
        ![mX1, mX2, mY1, mY2].every(
          (n) => typeof n === 'number' && !Number.isNaN(n)
        )
      ) {
        return (x) => x
      }
      const NEWTON_ITERATIONS = 4
      const NEWTON_MIN_SLOPE = 0.001
      const SUBDIVISION_PRECISION = 1e-7
      const SUBDIVISION_MAX_ITERATIONS = 10
      const kSplineTableSize = 11
      const kSampleStepSize = 1 / (kSplineTableSize - 1)
      const sampleValues = new Array(kSplineTableSize)
      const A = (a1, a2) => 1 - 3 * a2 + 3 * a1
      const B = (a1, a2) => 3 * a2 - 6 * a1
      const C = (a1) => 3 * a1
      const calcBezier = (t, a1, a2) =>
        ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t
      const getSlope = (t, a1, a2) =>
        3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1)
      for (let i = 0; i < kSplineTableSize; i += 1) {
        sampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2)
      }
      const binarySubdivide = (aX, a, b) => {
        let currentA = a
        let currentB = b
        let currentT = 0
        for (let i = 0; i < SUBDIVISION_MAX_ITERATIONS; i += 1) {
          currentT = currentA + (currentB - currentA) / 2
          const currentX = calcBezier(currentT, mX1, mX2) - aX
          if (Math.abs(currentX) < SUBDIVISION_PRECISION) return currentT
          if (currentX > 0) currentB = currentT
          else currentA = currentT
        }
        return currentT
      }
      const newtonRaphsonIterate = (aX, guessT) => {
        let currentT = guessT
        for (let i = 0; i < NEWTON_ITERATIONS; i += 1) {
          const slope = getSlope(currentT, mX1, mX2)
          if (slope === 0) return currentT
          const currentX = calcBezier(currentT, mX1, mX2) - aX
          currentT -= currentX / slope
        }
        return currentT
      }
      const getTForX = (aX) => {
        let intervalStart = 0
        let currentSample = 1
        const lastSample = kSplineTableSize - 1
        for (
          ;
          currentSample !== lastSample && sampleValues[currentSample] <= aX;
          currentSample += 1
        ) {
          intervalStart += kSampleStepSize
        }
        currentSample -= 1
        const dist =
          (aX - sampleValues[currentSample]) /
          (sampleValues[currentSample + 1] - sampleValues[currentSample])
        const guessT = intervalStart + dist * kSampleStepSize
        const slope = getSlope(guessT, mX1, mX2)
        if (slope >= NEWTON_MIN_SLOPE) {
          return newtonRaphsonIterate(aX, guessT)
        }
        if (slope === 0) {
          return guessT
        }
        return binarySubdivide(
          aX,
          intervalStart,
          intervalStart + kSampleStepSize
        )
      }
      return (x) => {
        if (mX1 === mY1 && mX2 === mY2) return x
        if (x <= 0) return 0
        if (x >= 1) return 1
        const t = getTForX(x)
        return calcBezier(t, mY1, mY2)
      }
    }
    const overlayEase = cubicBezier(0.25, 0.1, 0.25, 1)
    const getDateShiftEm = () => {
      try {
        const sample = trackedDateNumbers.find((dn) =>
          dn?.querySelector?.('.body-xl')
        )
        if (!sample) return 3
        const span = sample.querySelector('.body-xl')
        if (!span) return 3
        const h = span.offsetHeight
        const base = parseFloat(getComputedStyle(sample).fontSize)
        if (Number.isFinite(h) && h > 0 && Number.isFinite(base) && base > 0) {
          return h / base
        }
      } catch (e) {
        // ignore
      }
      return 3
    }
    const prepareDateNumber = (el) => {
      if (!el) return
      try {
        el.style.willChange = 'transform'
        el.style.transform = `translateY(${getDateShiftEm()}em)`
      } catch (e) {
        // ignore
      }
    }
    const refreshDateNumberTransform = (el, index) => {
      if (!el) return
      try {
        const shift = getDateShiftEm()
        const state = dateNumberStates[index]
        const baseProgress = state ? clamp01(state.baseProgress) : 0
        const overlayMultiplier = state ? clampOverlay(state.overlay) : 0
        const baseTranslate = shift * (1 - baseProgress)
        const overlayTranslate = shift * overlayMultiplier
        el.style.transform = `translateY(${baseTranslate + overlayTranslate}em)`
      } catch (e) {
        // ignore
      }
    }
    const applyDateNumberTransforms = () => {
      trackedDateNumbers.forEach((el, idx) =>
        refreshDateNumberTransform(el, idx)
      )
    }
    const setDateNumberBaseProgress = (index, progress) => {
      const state = dateNumberStates[index]
      if (!state) return
      state.baseProgress = clamp01(progress)
      refreshDateNumberTransform(trackedDateNumbers[index], index)
    }
    const setDateNumberOverlayMultiplier = (
      index,
      overlay,
      shouldRefresh = true
    ) => {
      const state = dateNumberStates[index]
      if (!state) return
      state.overlay = clampOverlay(overlay)
      if (shouldRefresh) {
        refreshDateNumberTransform(trackedDateNumbers[index], index)
      }
    }
    const getStaggeredProgress = (progress = 0, index = 0) => {
      const totalItems = trackedDateNumbers.length || 1
      const totalOffset = DATE_STAGGER_OFFSET * Math.max(totalItems - 1, 0)
      const duration = Math.max(1 - totalOffset, 1e-6)
      const offset = DATE_STAGGER_OFFSET * index
      const normalized = (progress - offset) / duration
      return clamp01(normalized)
    }
    const applyDateNumberProgress = (progress = 0) => {
      if (!trackedDateNumbers.length) return
      const clampedProgress = clamp01(progress)
      trackedDateNumbers.forEach((_, idx) =>
        setDateNumberBaseProgress(
          idx,
          getStaggeredProgress(clampedProgress, idx)
        )
      )
    }
    const cancelDateOverlayAnimation = () => {
      if (dateOverlayAnimationFrame != null) {
        cancelAnimationFrame(dateOverlayAnimationFrame)
        dateOverlayAnimationFrame = null
      }
      dateOverlayAnimationFrom = null
      dateOverlayAnimationTargets = null
    }
    const animateDateNumberOverlays = (targets = []) => {
      if (!trackedDateNumbers.length) return
      cancelDateOverlayAnimation()
      dateOverlayAnimationFrom = dateNumberStates.map((state) =>
        state ? state.overlay : 0
      )
      dateOverlayAnimationTargets = dateNumberStates.map((state, idx) => {
        const target =
          typeof targets[idx] === 'number' ? targets[idx] : state?.overlay ?? 0
        return clampOverlay(target)
      })
      const shouldAnimate = dateOverlayAnimationTargets.some(
        (target, idx) => target !== dateOverlayAnimationFrom[idx]
      )
      if (!shouldAnimate) {
        dateOverlayAnimationFrom = null
        dateOverlayAnimationTargets = null
        return
      }
      const now =
        typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now()
      dateOverlayAnimationStart = now
      const duration = DATE_OVERLAY_ANIM_DURATION
      const step = (timestamp) => {
        const elapsed = timestamp - dateOverlayAnimationStart
        const progress = duration > 0 ? clamp01(elapsed / duration) : 1
        const easedProgress = overlayEase(progress)
        trackedDateNumbers.forEach((_, idx) => {
          const local = getStaggeredProgress(easedProgress, idx)
          const from = dateOverlayAnimationFrom[idx]
          const to = dateOverlayAnimationTargets[idx]
          const value = from + (to - from) * local
          setDateNumberOverlayMultiplier(idx, value, false)
        })
        applyDateNumberTransforms()
        if (progress < 1) {
          dateOverlayAnimationFrame = requestAnimationFrame(step)
        } else {
          cancelDateOverlayAnimation()
        }
      }
      dateOverlayAnimationFrame = requestAnimationFrame(step)
    }
    const getDateOverlayTargetForIndex = (indexKey) => {
      if (!trackedDateNumbers.length) return []
      const key = String(indexKey)
      let template = DATE_OVERLAY_TARGETS['0']
      if (Object.prototype.hasOwnProperty.call(DATE_OVERLAY_TARGETS, key)) {
        template = DATE_OVERLAY_TARGETS[key]
      } else if (key === '-1') {
        template = DATE_OVERLAY_TARGETS['-1']
      } else if (Number(key) >= vids.length - 1) {
        template = DATE_OVERLAY_TARGETS[String(vids.length - 1)]
      }
      return trackedDateNumbers.map((_, idx) => {
        const value =
          template && typeof template[idx] === 'number'
            ? template[idx]
            : DATE_OVERLAY_DEFAULT_TARGET[idx] || 0
        return value
      })
    }
    const splitParagraphIntoLines = (paragraph) => {
      if (!paragraph) return []
      try {
        if (!paragraph.__aboutSplit) {
          const split = new SplitType(paragraph, {
            types: 'lines',
            tagName: 'span',
          })
          paragraph.__aboutSplit = split
        }
        const lines =
          (paragraph.__aboutSplit && paragraph.__aboutSplit.lines) || []
        const inners = []
        lines.forEach((line) => {
          if (!line) return
          line.style.display = 'block'
          line.style.overflow = 'hidden'
          if (!line.__aboutInner) {
            const inner = document.createElement('span')
            inner.className = 'story_line-inner'
            inner.style.display = 'inline-block'
            while (line.firstChild) inner.appendChild(line.firstChild)
            line.appendChild(inner)
            line.__aboutInner = inner
          }
          inners.push(line.__aboutInner)
        })
        return inners
      } catch (e) {
        return []
      }
    }
    const initStoryVideoTextLines = () => {
      videoTextLines.clear()
      vids.forEach((wrap, idx) => {
        if (!wrap) return
        const paragraphs = wrap.querySelectorAll('.story_video-infos_desc p')
        const inners = []
        paragraphs.forEach((p) => {
          const parsed = splitParagraphIntoLines(p)
          parsed.forEach((inner) => {
            inner.style.transform = 'translateY(100%)'
            inner.style.willChange = 'transform'
            inner.style.transition = `transform ${LINE_DURATION_S}s ${LINE_EASE}`
            inners.push(inner)
          })
        })
        videoTextLines.set(idx, inners)
      })
    }
    const hideVideoTextLines = (lines) => {
      lines.forEach((inner) => {
        inner.style.transitionDelay = '0s'
        inner.style.transform = 'translateY(100%)'
      })
    }
    const showVideoTextLines = (lines) => {
      lines.forEach((inner, i) => {
        inner.style.transitionDelay = `${i * LINE_STAGGER_S}s`
        inner.style.transform = 'translateY(0)'
      })
    }
    const animateVideoTextLines = (activeIdx) => {
      videoTextLines.forEach((lines, idx) => {
        if (!lines) return
        if (idx === activeIdx) showVideoTextLines(lines)
        else hideVideoTextLines(lines)
      })
    }
    const resetOverlayForRepeatAnimation = (targets = []) => {
      targets.forEach((target, idx) => {
        if (!target) return
        const state = dateNumberStates[idx]
        if (!state) return
        if (state.overlay === target) {
          state.overlay = 0
          refreshDateNumberTransform(trackedDateNumbers[idx], idx)
        }
      })
    }
    const applyDateOverlayTarget = (indexKey) => {
      if (!trackedDateNumbers.length) return
      const normalizedKey = String(indexKey)
      if (currentDateOverlayTargetKey === normalizedKey) return
      const targets = getDateOverlayTargetForIndex(normalizedKey)
      resetOverlayForRepeatAnimation(targets)
      currentDateOverlayTargetKey = normalizedKey
      animateDateNumberOverlays(targets)
    }
    trackedDateNumbers.forEach(prepareDateNumber)
    applyDateOverlayTarget(-1)
    initStoryVideoTextLines()
    animateVideoTextLines(-1)
    vids.forEach(withFadeHelpers)
    vids.forEach((wrap) => {
      if (!wrap) return
      setVideoScale(wrap, VIDEO_ACTIVE_SCALE)
    })
    // Ensure scroll-items on About page use opacity-only animations and never display:none
    try {
      const scrollItems = Array.from(root.querySelectorAll('.scroll-item'))
      scrollItems.forEach(withFadeHelpers)
    } catch (e) {
      // ignore
    }
    const getVideoEl = (wrap) => {
      try {
        if (!wrap) return null
        const bg = wrap.querySelector('.story_video') || wrap
        return bg ? bg.querySelector('video') : null
      } catch (e) {
        return null
      }
    }
    const handlePlayRejection = () => void 0
    const videoEls = vids.map((w) => getVideoEl(w))
    const hasPlayed = new Array(vids.length).fill(false)
    const indexByWrap = new Map()
    vids.forEach((wrap, i) => wrap && indexByWrap.set(wrap, i))

    const prepareForAutoplay = (video) => {
      if (!video) return
      try {
        video.muted = true
        video.playsInline = true
      } catch (e) {
        // ignore
      }
    }

    const pauseAllExcept = (exceptIndex) => {
      for (let i = 0; i < videoEls.length; i += 1) {
        const el = videoEls[i]
        if (!el || i === exceptIndex) continue
        try {
          el.pause()
        } catch (e) {
          // ignore
        }
      }
    }

    const playAtIndex = (idx) => {
      try {
        const el = videoEls[idx]
        if (!el) return
        prepareForAutoplay(el)
        // Only reset to start on first play to avoid jumpy behavior on re-entry
        if (!hasPlayed[idx] && typeof el.currentTime === 'number') {
          el.currentTime = 0
        }
        const p = el.play()
        if (p && typeof p.then === 'function') {
          p.then(undefined, handlePlayRejection)
        }
        hasPlayed[idx] = true
        pauseAllExcept(idx)
      } catch (e) {
        // ignore
      }
    }
    if (!storyContent) return null

    let currentActive = -1
    const setActive = (idx) => {
      if (typeof idx !== 'number' || idx < 0 || idx >= vids.length) return
      if (currentActive === idx) return
      currentActive = idx
      vids.forEach((wrap, i) => {
        if (!wrap) return
        const isActive = i === idx
        if (isActive) fadeIn(wrap)
        else fadeOut(wrap)
      })
      applyVideoScaling(idx, videoScalingEnabled)
      playAtIndex(idx)
      applyDateOverlayTarget(idx)
      animateVideoTextLines(idx)
    }

    const getAfterIntroProgressPx = () => {
      // Start counting when the bottom of story_intro reaches the top (0)
      try {
        if (!introInner) return 0
        const r = introInner.getBoundingClientRect()
        const bottom = r.top + r.height
        return bottom <= 0 ? -bottom : 0
      } catch (e) {
        return 0
      }
    }
    const getIntroBottomProgress = () => {
      try {
        if (!introInner) return 0
        const rect = introInner.getBoundingClientRect()
        const viewportH =
          (typeof window !== 'undefined' && window.innerHeight) ||
          (document.documentElement && document.documentElement.clientHeight) ||
          0
        if (viewportH <= 0) return 0
        const distanceFromBottom = viewportH - rect.bottom
        if (distanceFromBottom <= 0) return 0
        const clampedDistance = Math.min(distanceFromBottom, viewportH)
        return clampedDistance / viewportH
      } catch (e) {
        return 0
      }
    }
    applyDateNumberProgress(getIntroBottomProgress())
    const eyebrowsGroups = Array.from(
      root.querySelectorAll(
        '.intro.is-story > .eyebrows, .intro.is-story .eyebrows'
      )
    )
    // ensure transitions on eyebrows for smooth 0.5s both ways
    eyebrowsGroups.forEach((ey) => {
      try {
        ey.style.transition =
          'color 0.5s ease, background-color 0.5s ease, border-color 0.5s ease'
      } catch (e) {
        // ignore
      }
      try {
        const items = ey.querySelectorAll('.is-eyebrow')
        items.forEach((it) => {
          try {
            it.style.transition =
              'color 0.5s ease, background-color 0.5s ease, border-color 0.5s ease'
          } catch (e2) {
            // ignore
          }
        })
      } catch (e1) {
        // ignore
      }
    })
    let prevEyebrowsStarted = null

    const update = () => {
      const s = getAfterIntroProgressPx()
      const introBottomProgress = getIntroBottomProgress()
      applyDateNumberProgress(introBottomProgress)
      if (s <= 0) {
        if (currentActive !== -1) {
          currentActive = -1
        }
        applyDateOverlayTarget(-1)
        animateVideoTextLines(-1)
      }
      const scalingShouldBeEnabled = s > 0
      if (videoScalingEnabled !== scalingShouldBeEnabled) {
        videoScalingEnabled = scalingShouldBeEnabled
        applyVideoScaling(currentActive, videoScalingEnabled)
      }
      // Toggle 100svh on .intro.is-story when .story_intro_inner has exited the top of the viewport
      try {
        storyIntros.forEach((intro) => {
          if (!intro || !intro.style) return
          if (s > 0) intro.style.height = '100svh'
          else intro.style.height = ''
        })
      } catch (e) {
        // ignore
      }
      const eyebrowsStarted = s > 0
      if (prevEyebrowsStarted !== eyebrowsStarted) {
        // toggle eyebrows classes with smooth transitions
        eyebrowsGroups.forEach((ey) => {
          try {
            if (eyebrowsStarted) ey.classList.add('is-white')
            else ey.classList.remove('is-white')
          } catch (e) {
            // ignore
          }
          try {
            const items = ey.querySelectorAll('.is-eyebrow')
            const last = items && items.length ? items[items.length - 1] : null
            if (last) {
              if (eyebrowsStarted) last.classList.remove('is-black')
              else last.classList.add('is-black')
            }
          } catch (e2) {
            // ignore
          }
        })
        prevEyebrowsStarted = eyebrowsStarted
      }
      // Determine active video based on scroll progress through the 400vh story section
      try {
        const rect = storyContent.getBoundingClientRect()
        const viewportH =
          (typeof window !== 'undefined' && window.innerHeight) ||
          (document.documentElement && document.documentElement.clientHeight) ||
          0
        // Work only after intro has started
        if (viewportH > 0 && s > 0) {
          const rectHeight = rect && rect.height ? rect.height : 0
          const totalRange = Math.max(1, rectHeight - viewportH)
          const clampedTop = Math.max(-rect.top, 0)
          const scrolled = Math.min(clampedTop, totalRange)
          const segment = totalRange / vids.length
          const idx = Math.min(vids.length - 1, Math.floor(scrolled / segment))
          setActive(idx)
        }
      } catch (e) {
        // ignore
      }
    }

    update()
    const onScroll = () => update()
    const onResize = () => update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    // Also listen on Lenis wrapper if present
    const scroller =
      (typeof window !== 'undefined' && window.__lenisWrapper) || null
    if (scroller && scroller.addEventListener) {
      scroller.addEventListener('scroll', onScroll, { passive: true })
    }
    // rAF loop to catch transform-driven scroll changes
    let rafId = null
    const tick = () => {
      update()
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (scroller && scroller.removeEventListener) {
        scroller.removeEventListener('scroll', onScroll)
      }
      if (rafId != null) cancelAnimationFrame(rafId)
      cancelDateOverlayAnimation()
    }
  }

  try {
    initVideos()
    // Initialize workshops sticky images/texts like workshops.js
    try {
      initWorkshopsStickyImages(root)
    } catch (e2) {
      // ignore
    }
  } catch (e) {
    // ignore
  }
}
