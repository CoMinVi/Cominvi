import gsap from 'gsap'

// Sets the width of `.contact_map` to 50.8em. When provided a timeline config,
// it will animate with the same duration/ease as descale transitions.
export function initContactHero(root = document, opts = {}) {
  try {
    const scope = root && root.querySelector ? root : document
    const containerIsContact = !!(
      root &&
      root.matches &&
      root.matches('[data-barba-namespace="Contact"]')
    )
    const isContact =
      containerIsContact ||
      !!scope.querySelector('[data-barba-namespace="Contact"]')
    if (!isContact) return

    const el =
      (root &&
        root.querySelector &&
        (root.querySelector('.contact_map') ||
          root.querySelector('.contact-map'))) ||
      scope.querySelector('.contact_map') ||
      scope.querySelector('.contact-map')
    if (!el) return

    const widthValue = '50.8em'

    const duration = typeof opts.duration === 'number' ? opts.duration : 1.2
    const ease =
      opts.ease ||
      (gsap &&
        typeof gsap.parseEase === 'function' &&
        gsap.parseEase('custom(M0,0 C0.6,0 0,1 1,1 )')) ||
      undefined
    const isValidDelay =
      typeof opts.delay === 'number' &&
      Number.isFinite(opts.delay) &&
      opts.delay >= 0
    const delay = isValidDelay ? opts.delay : 0.5

    const isMobile =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 767px)').matches

    const shouldAnimate = !!(opts && opts.animate) && !isMobile

    if (shouldAnimate) {
      try {
        const computed =
          (window.getComputedStyle && window.getComputedStyle(el)) || null
        const fontSizePx = computed ? parseFloat(computed.fontSize) : 16
        const targetPx = Math.max(
          0,
          50.8 * (Number.isFinite(fontSizePx) ? fontSizePx : 16)
        )
        const currentPx =
          (el &&
            el.getBoundingClientRect &&
            el.getBoundingClientRect().width) ||
          0
        gsap.fromTo(
          el,
          { width: `${Math.max(0, Math.round(currentPx))}px` },
          {
            width: `${Math.max(0, Math.round(targetPx))}px`,
            duration,
            ease,
            overwrite: 'auto',
            delay,
          }
        )
        return
      } catch (e) {
        // fallback to immediate
      }
    }
    // On mobile, do not apply the fixed width at all
    if (!isMobile) {
      setTimeout(() => {
        el.style.width = widthValue
      }, Math.max(0, Math.round(delay * 1000)))
    }
  } catch (e) {
    // ignore
  }
}
