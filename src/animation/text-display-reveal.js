import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger, CustomEase)
const easeCurve = 'M0,0 C0.6,0 0,1 1,1 '

export function initTextDisplayReveal(root = document) {
  const sections = Array.from(root.querySelectorAll('.title-big'))
  if (!sections.length) return

  sections.forEach((section) => {
    const container = section.closest('.display-text') || section
    const gradients = Array.from(
      section.querySelectorAll('.overlay-gradients .overlay-gradient')
    )
    if (!gradients.length) return

    // Start collapsed
    gsap.set(gradients, { width: '0%' })

    // Eyebrow split and reveal per word
    const eyebrow =
      container && container.querySelector
        ? container.querySelector('.eyebrow-wrapper-a > .eyebrow-m')
        : null
    let words = []
    if (eyebrow && !eyebrow.dataset.splitted) {
      splitIntoWordSpans(eyebrow)
      eyebrow.dataset.splitted = 'true'
      words = Array.from(eyebrow.querySelectorAll('.eyebrow-word'))
    } else if (eyebrow) {
      words = Array.from(eyebrow.querySelectorAll('.eyebrow-word'))
    }

    if (words.length) {
      gsap.set(words, {
        display: 'inline-block',
        yPercent: 100,
        rotation: 70,
        transformOrigin: 'left bottom',
      })
    }

    const isNarrowMobile =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 478px)').matches
    const targetWidth = isNarrowMobile ? '130%' : '100%'

    const tl = gsap.timeline({
      paused: true,
      defaults: { duration: 2, ease: CustomEase.create('custom', easeCurve) },
    })
    tl.to(gradients, { width: targetWidth, stagger: 0.025 }, 0)
    if (words.length) {
      tl.to(
        words,
        {
          duration: 1.2,
          yPercent: 0,
          rotation: 0,
          stagger: 0.02,
        },
        0
      )
    }

    const triggerEl = section.querySelector('.display') || section
    const st = ScrollTrigger.create({
      trigger: triggerEl,
      start: 'top 80%',
      onEnter: () => tl.play(0),
      toggleActions: 'play none none none',
    })
    tl.eventCallback('onComplete', () => {
      try {
        if (st && typeof st.kill === 'function') st.kill()
      } catch (e) {
        // ignore
      }
    })
  })
}

export function splitIntoWordSpans(rootEl) {
  const text = rootEl.textContent || ''
  const parts = text.split(/(\s+)/)
  rootEl.textContent = ''
  parts.forEach((part) => {
    if (part.trim().length === 0) {
      rootEl.appendChild(document.createTextNode(part))
    } else {
      const span = document.createElement('span')
      span.className = 'eyebrow-word'
      span.textContent = part
      rootEl.appendChild(span)
    }
  })
}
