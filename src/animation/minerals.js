import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger, CustomEase)
const mineralsEase = CustomEase.create('mineralsEase', 'M0,0 C0.6,0 0,1 1,1 ')

export function initMinerals(root = document) {
  const section = root.querySelector('.section_minerals')
  if (!section) return null

  if (typeof section.__mineralsCleanup === 'function') {
    section.__mineralsCleanup()
  }

  // Locate content and circles
  const content = section.querySelector('.minerals_content') || section
  const darkSvg = content.querySelector('.circle.is-2')
  if (!darkSvg) return null
  const cleanupCallbacks = []

  // No pin target needed in sticky mode

  // Use a CSS conic-gradient mask on the dark SVG (more robust and smooth)
  const maskCSS =
    'conic-gradient(from 0deg at 50% 50%, #fff 0deg, #fff var(--angle, 0deg), transparent var(--angle, 0deg))'
  darkSvg.style.webkitMaskImage = maskCSS
  darkSvg.style.maskImage = maskCSS
  darkSvg.style.maskMode = 'luminance'
  darkSvg.style.webkitMaskRepeat = 'no-repeat'
  darkSvg.style.maskRepeat = 'no-repeat'
  darkSvg.style.webkitMaskPosition = 'center'
  darkSvg.style.maskPosition = 'center'
  darkSvg.style.setProperty('--angle', '0deg')
  // Ensure the element is promoted for smoother masking
  darkSvg.style.willChange = 'transform, -webkit-mask-image, mask-image'

  // Stabilize stacking so it doesn't overlay previous section
  section.style.position = 'relative'
  section.style.zIndex = '0'

  // No DOM change here: layout and sticky are handled in Webflow

  // Create a non-pinning ScrollTrigger that drives the angle via progress
  const createProgressTrigger = () => {
    try {
      if (section.__mineralsST) section.__mineralsST.kill(true)
    } catch (err) {
      // no-op
    }
    const stage = section.querySelector('.minerals-stage') || section
    const getScrollDistance = () => {
      try {
        const h =
          stage.offsetHeight || stage.getBoundingClientRect().height || 0
        return `+=${Math.max(0, Math.round(h - window.innerHeight))}`
      } catch (err) {
        return '+=0'
      }
    }

    // Cache lists to drive active state at 20/40/60/80%
    const nameItems = Array.from(
      section.querySelectorAll('.minerals-names .body-xl')
    )
    const NAME_TRANSITION_DURATION = 0.25
    const NAME_MOBILE_CENTER_DURATION = 0.3
    const EYEBROW_TRANSITION_DURATION = 0.25
    const isMobileViewport = () => {
      const mm =
        window.matchMedia && window.matchMedia('(max-width: 767px)').matches
      return mm || window.innerWidth <= 767
    }

    const ensureNamesScrollStyles = (container, items) => {
      try {
        if (!container) return
        container.style.overflowX = 'auto'
        container.style.overflowY = 'hidden'
        container.style.flexWrap = 'nowrap'
        container.style.webkitOverflowScrolling = 'touch'
        items.forEach((el) => {
          el.style.flex = '0 0 auto'
        })
      } catch (err) {
        // ignore
      }
    }

    const centerActiveNameMobile = (activeIndex) => {
      try {
        if (!isMobileViewport()) return
        const container = section.querySelector('.minerals-names')
        const item = nameItems[activeIndex]
        if (!container || !item) return

        // Ensure the list can scroll horizontally on mobile
        ensureNamesScrollStyles(container, nameItems)

        // Skip if no horizontal overflow
        if (container.scrollWidth <= container.clientWidth) return

        const containerRect = container.getBoundingClientRect()
        const itemRect = item.getBoundingClientRect()
        const current = container.scrollLeft || 0
        const delta =
          itemRect.left -
          containerRect.left +
          itemRect.width / 2 -
          container.clientWidth / 2
        const targetScrollLeft = Math.round(current + delta)
        const maxScrollLeft = Math.max(
          0,
          container.scrollWidth - container.clientWidth
        )
        const clamped = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft))

        gsap.to(container, {
          scrollLeft: clamped,
          duration: NAME_MOBILE_CENTER_DURATION,
          ease: mineralsEase,
          overwrite: 'auto',
        })
      } catch (err) {
        // ignore
      }
    }
    const eyebrowSliders = Array.from(
      section.querySelectorAll('.eyebrow-slider')
    )
    const sliderTrack = section.querySelector('.minerals-slider_inner')
    const sliderImages = Array.from(
      section.querySelectorAll('.minerals-slider_img')
    )

    const setActiveNameIndex = (activeIndex) => {
      nameItems.forEach((el, idx) => {
        const isActive = idx === activeIndex
        el.classList.toggle('is-active', isActive)
        el.classList.toggle('is-o-15', !isActive)
        gsap.to(el, {
          opacity: isActive ? 1 : 0.15,
          duration: NAME_TRANSITION_DURATION,
          ease: mineralsEase,
          overwrite: 'auto',
        })
      })
      // Center the active name horizontally on mobile
      centerActiveNameMobile(activeIndex)
    }

    const setActiveSlideIndex = (activeIndex) => {
      if (!sliderTrack) return
      const D = 1.2
      const next = Math.max(0, Math.min(activeIndex, sliderImages.length - 1))
      const prev =
        typeof sliderTrack.__mineralsSlideIndex === 'number'
          ? sliderTrack.__mineralsSlideIndex
          : next

      // Move horizontal track 20% per slide
      const xPercent = -20 * next
      gsap.to(sliderTrack, {
        xPercent,
        duration: D,
        ease: mineralsEase,
        overwrite: 'auto',
        onUpdate: () => {
          try {
            const currentX =
              parseFloat(gsap.getProperty(sliderTrack, 'xPercent')) || 0
            const center = -currentX / 20
            sliderImages.forEach((img, idx) => {
              const d = idx - center
              const sign = d === 0 ? 0 : d > 0 ? 1 : -1
              const amount = Math.min(1, Math.abs(d))
              const rot = 30 * sign * amount
              gsap.set(img, {
                rotate: rot,
                transformOrigin: '50% 50%',
              })
            })
          } catch (e) {
            // ignore
          }
        },
      })

      // Initialize rotations once
      if (
        sliderTrack.__mineralsSlideIndex === undefined &&
        sliderImages.length
      ) {
        sliderImages.forEach((img) => {
          img.style.willChange = 'transform'
          gsap.set(img, { transformOrigin: '50% 50%' })
        })
        // Ensure initial rotation state matches current position
        try {
          const initialX = -20 * next
          gsap.set(sliderTrack, { xPercent: initialX })
          const center = -initialX / 20
          sliderImages.forEach((img, idx) => {
            const d = idx - center
            const sign = d === 0 ? 0 : d > 0 ? 1 : -1
            const amount = Math.min(1, Math.abs(d))
            const rot = 30 * sign * amount
            gsap.set(img, { rotate: rot })
          })
        } catch (e) {
          // ignore
        }
      }

      const incoming = sliderImages[next]
      const outgoing = sliderImages[prev]
      if (prev === next) {
        // Initial state: ensure first visible image is at 0 without anim
        if (incoming) {
          incoming.classList.add('is-active')
          gsap.set(incoming, { transformOrigin: '50% 50%' })
        }
      } else {
        // Determine scroll direction via index change
        if (incoming) incoming.classList.add('is-active')
        if (outgoing) outgoing.classList.remove('is-active')
      }

      sliderTrack.__mineralsSlideIndex = next
    }

    // Removed dynamic step calc; we use yPercent slides instead

    const setActiveEyebrowIndex = (activeIndex) => {
      eyebrowSliders.forEach((slider) => {
        const items = Array.from(slider.querySelectorAll('span'))
        if (!items.length) return

        // Ensure vertical stack layout on the track
        slider.style.display = 'flex'
        slider.style.flexDirection = 'column'
        slider.style.willChange = 'transform'

        const maxIndex = items.length - 1
        const next = Math.min(Math.max(activeIndex, 0), maxIndex)

        // Toggle active state (purely visual)
        items.forEach((el, idx) => {
          if (idx === next) el.classList.add('is-active')
          else el.classList.remove('is-active')
        })

        // Move the track so that item `next` is visible (each item height = 100%)
        gsap.to(slider, {
          yPercent: -100 * next,
          duration: EYEBROW_TRANSITION_DURATION,
          ease: mineralsEase,
          overwrite: 'auto',
        })

        slider.__mineralsCurrentIndex = next
      })
    }

    // Align right eyebrow wrapper top to left eyebrow wrapper top
    const alignRightEyebrow = () => {
      try {
        const left = section.querySelector('.minerals-list .eyebrow-wrapper')
        // Webflow class uses underscore, not dash
        const right =
          section.querySelector('.minerals_right .eyebrow-wrapper.is-a') ||
          section.querySelector('.minerals_right .is-a')
        if (!left || !right) return

        // Disable absolute positioning on mobile viewports
        const isMobile =
          (window.matchMedia &&
            window.matchMedia('(max-width: 767px)').matches) ||
          window.innerWidth <= 767

        if (isMobile) {
          // Reset any previously applied absolute positioning
          right.style.position = ''
          right.style.top = ''
          return
        }

        const parent = right.offsetParent || right.parentElement
        if (!parent) return
        // Ensure parent is positioning context (desktop/tablet only)
        const cps = getComputedStyle(parent)
        if (cps.position === 'static') {
          parent.style.position = 'relative'
        }
        const parentTop = parent.getBoundingClientRect().top + window.scrollY
        const lTop = left.getBoundingClientRect().top + window.scrollY
        const offset = Math.round(lTop - parentTop)
        right.style.position = 'absolute'
        right.style.top = offset + 'px'
      } catch (err) {
        // ignore
      }
    }
    // Expose for external consumers (e.g., menu close reflow)
    section.__mineralsAlignRightEyebrow = alignRightEyebrow
    alignRightEyebrow()
    const handleAlignResize = () => requestAnimationFrame(alignRightEyebrow)
    window.addEventListener('resize', handleAlignResize)
    cleanupCallbacks.push(() =>
      window.removeEventListener('resize', handleAlignResize)
    )

    // Recenter active name on viewport changes
    const handleResize = () => {
      requestAnimationFrame(() => {
        let idx = 0
        const current = section.__mineralsActiveIndex
        if (typeof current === 'number' && current >= 0) {
          idx = current
        }
        centerActiveNameMobile(idx)
      })
    }
    window.addEventListener('resize', handleResize)
    cleanupCallbacks.push(() =>
      window.removeEventListener('resize', handleResize)
    )
    // Expose helpers for external reflow
    section.__mineralsCenterActiveNameMobile = centerActiveNameMobile
    section.__mineralsSetActiveEyebrowIndex = setActiveEyebrowIndex

    section.__mineralsActiveIndex = -1

    const st = ScrollTrigger.create({
      trigger: stage,
      start: 'top top',
      end: getScrollDistance,
      scrub: 1,
      onUpdate: (self) => {
        const angle = Math.max(0, Math.min(360, self.progress * 360))
        darkSvg.style.setProperty('--angle', angle + 'deg')

        // Keep right eyebrow aligned during scroll/sticky
        alignRightEyebrow()

        if (nameItems.length > 0) {
          const clamped = Math.max(0, Math.min(0.999999, self.progress))
          const activeIndex = Math.min(
            nameItems.length - 1,
            Math.floor(clamped * nameItems.length)
          )
          if (activeIndex !== section.__mineralsActiveIndex) {
            section.__mineralsActiveIndex = activeIndex
            setActiveNameIndex(activeIndex)
            setActiveEyebrowIndex(activeIndex)
            // direction: 1 forward (down), -1 backward (up)
            const prev = section.__mineralsActiveIndex
            const dir = activeIndex > prev ? 1 : -1
            setActiveSlideIndex(activeIndex, dir)
          }
        }
      },
      onLeave: () => {
        darkSvg.style.setProperty('--angle', '360deg')
        if (section.__mineralsActiveIndex !== -1) {
          const last =
            (section.querySelectorAll('.minerals-names .body-xl') || [])
              .length - 1
          if (last >= 0) {
            setActiveNameIndex(last)
            setActiveEyebrowIndex(last)
          }
        }
      },
      onLeaveBack: () => {
        darkSvg.style.setProperty('--angle', '0deg')
        if (section.__mineralsActiveIndex !== -1) {
          setActiveNameIndex(0)
          setActiveEyebrowIndex(0)
        }
      },
      invalidateOnRefresh: true,
      markers: false,
    })
    section.__mineralsST = st
    cleanupCallbacks.push(() => {
      try {
        st.kill(true)
      } catch (e) {
        // ignore
      }
    })
    return st
  }

  // Init progress trigger (sticky, no pin)
  const progressTrigger = createProgressTrigger()

  // --- Event-driven integration with the menu ---
  const snapshotAngle = () => {
    try {
      const v = getComputedStyle(darkSvg).getPropertyValue('--angle') || '0deg'
      const n = parseFloat(String(v)) || 0
      section.__mineralsAngle = n
    } catch (err) {
      section.__mineralsAngle = 0
    }
  }

  const restoreAngle = () => {
    if (typeof section.__mineralsAngle === 'number') {
      darkSvg.style.setProperty('--angle', section.__mineralsAngle + 'deg')
    }
  }

  const onMenuOpenStart = () => {
    snapshotAngle()
  }
  const onMenuCloseEnd = () => {
    restoreAngle()
    try {
      // Ensure the dark circle mask is intact after menu scaling
      darkSvg.style.webkitMaskImage = maskCSS
      darkSvg.style.maskImage = maskCSS
    } catch (e) {
      // ignore
    }
    // Realign eyebrows and recenter active name after layout shifts
    try {
      if (typeof section.__mineralsAlignRightEyebrow === 'function') {
        section.__mineralsAlignRightEyebrow()
      }
      const idx =
        typeof section.__mineralsActiveIndex === 'number' &&
        section.__mineralsActiveIndex >= 0
          ? section.__mineralsActiveIndex
          : 0
      if (typeof section.__mineralsCenterActiveNameMobile === 'function') {
        section.__mineralsCenterActiveNameMobile(idx)
      }
      if (typeof section.__mineralsSetActiveEyebrowIndex === 'function') {
        section.__mineralsSetActiveEyebrowIndex(idx)
      }
    } catch (e) {
      // ignore
    }
    // Refresh ScrollTrigger twice (immediate + next frame), helps iOS
    try {
      ScrollTrigger.refresh()
      requestAnimationFrame(() => {
        try {
          ScrollTrigger.refresh()
        } catch (e) {
          // ignore
        }
      })
    } catch (err) {
      // no-op
    }
  }
  document.addEventListener('menu:open-start', onMenuOpenStart)
  document.addEventListener('menu:close-end', onMenuCloseEnd)
  cleanupCallbacks.push(() => {
    document.removeEventListener('menu:open-start', onMenuOpenStart)
    document.removeEventListener('menu:close-end', onMenuCloseEnd)
  })

  // Ensure measurements are correct once assets are loaded
  const refresh = () => {
    try {
      ScrollTrigger.refresh()
    } catch (err) {
      // no-op
    }
  }
  window.addEventListener('load', refresh)
  cleanupCallbacks.push(() => window.removeEventListener('load', refresh))
  const refreshTimeoutId = setTimeout(refresh, 100)
  cleanupCallbacks.push(() => clearTimeout(refreshTimeoutId))

  section.__mineralsCleanup = () => {
    cleanupCallbacks.splice(0).forEach((cleanup) => {
      try {
        cleanup()
      } catch (e) {
        // ignore
      }
    })
    try {
      if (section.__mineralsST) section.__mineralsST.kill(true)
    } catch (e) {
      // ignore
    }
    section.__mineralsST = null
    section.__mineralsCleanup = null
  }

  return progressTrigger || section.__mineralsTL || null
}
