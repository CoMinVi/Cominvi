import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

import { initContact, initContactHero } from './contact.js'
import { heroAnimation } from './landing.js'

gsap.registerPlugin(CustomEase)

const easeCurve = 'M0,0 C0.6,0 0,1 1,1 '

function scrollToSectionNext(root) {
  try {
    const container = root && root.querySelector ? root : document
    const section =
      (container.querySelector && container.querySelector('.section_next')) ||
      document.querySelector('.section_next')
    const duration = 0.5
    if (!section) return gsap.to({}, { duration: 0 })

    const alignToViewportTop = () => {
      try {
        const wrapper =
          window.__lenisWrapper ||
          (container.querySelector && container.querySelector('.page-wrap')) ||
          document.scrollingElement ||
          window
        let attempts = 0
        const step = () => {
          try {
            const rect = section.getBoundingClientRect()
            const delta = Math.round(rect.top)
            if (delta === 0 || attempts > 5) return
            if (window.lenis && typeof window.lenis.scrollTo === 'function') {
              const base =
                typeof window.lenis.scroll === 'number'
                  ? window.lenis.scroll
                  : (wrapper && wrapper.scrollTop) || 0
              window.lenis.scrollTo(base + delta, { immediate: true })
            } else if (wrapper && wrapper !== window) {
              wrapper.scrollTop = (wrapper.scrollTop || 0) + delta
            } else {
              window.scrollTo(0, (window.pageYOffset || 0) + delta)
            }
            attempts += 1
            requestAnimationFrame(step)
          } catch (e) {
            // ignore
          }
        }
        requestAnimationFrame(step)
      } catch (e) {
        // ignore
      }
    }
    if (window.lenis && typeof window.lenis.scrollTo === 'function') {
      return gsap.to(
        {},
        {
          duration,
          ease: gsap.parseEase(`custom(${easeCurve})`),
          onStart: () => {
            try {
              window.lenis.scrollTo(section, { duration, force: true })
            } catch (e) {
              // ignore
            }
          },
          onComplete: () => {
            // One-shot alignment to remove any off-by-few-pixels on some pages
            alignToViewportTop()
          },
        }
      )
    }
    const scroller =
      (container.querySelector && container.querySelector('.page-wrap')) ||
      document.scrollingElement ||
      window
    if (scroller === window) {
      return gsap.to(
        {},
        {
          duration,
          ease: gsap.parseEase(`custom(${easeCurve})`),
          onStart: () => {
            try {
              section.scrollIntoView({ behavior: 'smooth', block: 'start' })
            } catch (e) {
              try {
                section.scrollIntoView({ block: 'start' })
              } catch (err) {
                // ignore
              }
            }
          },
          onComplete: () => {
            alignToViewportTop()
          },
        }
      )
    }
    if (typeof scroller.scrollTo === 'function') {
      const rect = section.getBoundingClientRect()
      const base =
        (container.querySelector && container.querySelector('.content-wrap')) ||
        scroller
      const baseRect = base.getBoundingClientRect()
      const top = rect.top - baseRect.top + (scroller.scrollTop || 0)
      return gsap.to(scroller, {
        scrollTop: top,
        duration,
        ease: gsap.parseEase(`custom(${easeCurve})`),
        onComplete: () => alignToViewportTop(),
      })
    }
    return gsap.to(
      {},
      {
        duration,
        ease: gsap.parseEase(`custom(${easeCurve})`),
        onStart: () => {
          try {
            section.scrollIntoView({ block: 'start' })
          } catch (e) {
            // ignore
          }
        },
        onComplete: () => alignToViewportTop(),
      }
    )
  } catch (err) {
    return gsap.to({}, { duration: 0 })
  }
}

export function nextLeave({ current, trigger, next }) {
  const tl = gsap.timeline({
    defaults: { ease: gsap.parseEase(`custom(${easeCurve})`) },
  })

  const anchor =
    trigger && trigger.closest ? trigger.closest('[pt-next]') : null
  if (anchor) {
    try {
      anchor.classList.add('is-hover-lock')
      anchor.style.pointerEvents = 'none'
    } catch (e) {
      // ignore
    }
  }

  if (current && current.container) {
    gsap.set(current.container, { position: 'absolute', inset: 0, zIndex: 1 })
  }

  tl.add(gsap.to({}, { duration: 0.001 }), 0)
  // Step 1: scroll (timeline waits for this tween)
  tl.add(scrollToSectionNext(current && current.container), '+=0')

  // Step 2: place next beneath, right after scroll completes
  tl.call(
    () => {
      if (next && next.container) {
        gsap.set(next.container, {
          opacity: 1,
          visibility: 'visible',
          position: 'absolute',
          inset: 0,
          zIndex: 0,
        })
        try {
          initContact(next && next.container)
        } catch (e) {
          // ignore
        }
        // Pre-scale destination hero background immediately
        try {
          const bgInner =
            (next.container.querySelector &&
              next.container.querySelector('.background-inner')) ||
            null
          if (bgInner) {
            gsap.set(bgInner, {
              transformOrigin: '50% 50%',
              scale: 1.2,
            })
          }
        } catch (e) {
          // ignore
        }
      }
    },
    [],
    '>'
  )

  // Steps 3,4,5 concurrently over 1.4s
  tl.addLabel('sync')
  if (anchor) {
    gsap.set(anchor, { overflow: 'hidden' })
    tl.to(
      anchor,
      {
        height: 0,
        paddingTop: 0,
        paddingBottom: 0,
        marginTop: '0.5rem',
        marginBottom: '0.5rem',
        duration: 1.4,
        ease: gsap.parseEase(`custom(${easeCurve})`),
      },
      'sync'
    )
  }
  if (current && current.container) {
    tl.to(
      current.container,
      {
        opacity: 0,
        duration: 1.4,
        ease: gsap.parseEase(`custom(${easeCurve})`),
      },
      'sync'
    )
    // Keep the element in flow; avoid breaking layout/height during re-init
    tl.set(
      current.container,
      { visibility: 'hidden', pointerEvents: 'none' },
      'sync+=1.4'
    )
  }
  if (next && next.container) {
    tl.call(
      () => {
        try {
          heroAnimation(next && next.container, {
            duration: 1.4,
            ease: gsap.parseEase(`custom(${easeCurve})`),
          })
          initContactHero(next && next.container, {
            animate: true,
            duration: 1.4,
            ease: gsap.parseEase(`custom(${easeCurve})`),
          })
        } catch (e) {
          // ignore
        }
      },
      [],
      'sync'
    )
    // After concurrent animations, restore next container to normal flow then refresh triggers
    tl.set(
      next.container,
      {
        clearProps:
          'position,top,left,right,bottom,inset,zIndex,visibility,opacity,pointerEvents',
      },
      'sync+=1.41'
    )
    tl.call(
      () => {
        try {
          if (
            window.ScrollTrigger &&
            typeof window.ScrollTrigger.refresh === 'function'
          ) {
            window.ScrollTrigger.refresh()
          }
        } catch (e) {
          // ignore
        }
      },
      [],
      'sync+=1.42'
    )
  }
  tl.call(() => {
    if (anchor) {
      try {
        anchor.classList.remove('is-hover-lock')
        anchor.style.pointerEvents = ''
      } catch (e) {
        // ignore
      }
    }
  })

  return tl
}

export function nextEnter({ next }) {
  const tl = gsap.timeline({
    defaults: { ease: gsap.parseEase(`custom(${easeCurve})`) },
  })
  if (next && next.container) {
    tl.to(next.container, {
      duration: 0.01,
      onComplete: () => {
        gsap.set(next.container, {
          clearProps:
            'position,top,left,right,bottom,inset,zIndex,visibility,opacity',
        })
      },
    })
  }
  return tl
}
