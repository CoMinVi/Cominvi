import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

import { initContactHero } from './contact.js'
import { heroAnimation } from './landing.js'
import { initHeroBackgroundParallax } from './parallax.js'

/**
 * Loader animation sequence
 * Steps provided by user:
 * Nouveau flow (structure HTML mise à jour)
 * 1) .logo-icon (dans .is-logo-icon) entre de y:100% → 0
 * 2) .loader-logo_wrap s'élargit pendant que les paths de .is-logo-text > .logo-text entrent de y:100% → 0 (stagger)
 * 3) Création d'un masque SVG dans .is-logo-text, puis:
 *    - suppression de .is-logo-icon et de .loader-logo_wrap
 *    - .is-logo-text passe en position:absolute, conserve sa position initiale, puis s'anime vers 100vw/100vh
 *    - l'SVG masque s'étire également, le trou s'anime pour couvrir 100% (révèle la page)
 *    - le background de .is-logo-text passe de var(--accent) à transparent
 */
export function initLoader() {
  try {
    gsap.registerPlugin(CustomEase)
    const easeCurve = 'M0,0 C0.6,0 0,1 1,1 '
    const loaderEase = CustomEase.create('loaderEase', easeCurve)
    const loader = document.querySelector('.loader')
    const loaderInner = document.querySelector('.loader_inner')
    const logoWrap = document.querySelector('.loader-logo_wrap')
    const logoInner = document.querySelector('.logo-inner')
    const iconBox = document.querySelector('.is-logo-icon')
    const logoIcon = document.querySelector('.logo-icon')
    const logoSquare = document.querySelector('.logo-square')
    const textBox = document.querySelector('.is-logo-text')
    const logoText = document.querySelector('.is-logo-text .logo-text')
    const bgVideos = document.querySelectorAll('.background_video')
    let outlineEl = null
    let syncOutlineSize = null
    let handleResize = null

    if (
      !loader ||
      !loaderInner ||
      !logoWrap ||
      !logoInner ||
      !iconBox ||
      !logoIcon ||
      !textBox ||
      !logoText
    ) {
      return null
    }

    const otherPaths = Array.from(logoText.querySelectorAll('path'))

    // Create an overlay outline that mirrors .loader-logo_wrap size/position
    try {
      outlineEl = document.createElement('div')
      outlineEl.className = 'loader-logo_outline'
      // Append to body to avoid being masked by loader's SVG/CSS mask
      document.body.appendChild(outlineEl)
      // Fixed overlay synced to the wrapper's bounding rect
      gsap.set(outlineEl, {
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: 2147483647,
        autoAlpha: 0,
        mixBlendMode: 'normal',
      })
      syncOutlineSize = () => {
        const rect = logoWrap.getBoundingClientRect()
        gsap.set(outlineEl, {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        })
      }
      syncOutlineSize()
      gsap.ticker.add(syncOutlineSize)
      handleResize = () => syncOutlineSize()
      window.addEventListener('resize', handleResize)
    } catch (e) {
      // ignore
    }

    const computePxFromEm = (el, emValue) => {
      const fontSizePx = parseFloat(getComputedStyle(el).fontSize) || 16
      return emValue * fontSizePx
    }

    const logoTargetWidthPx = logoInner.getBoundingClientRect().width || 0
    const widthAfterEm = 7.46
    const widthAfterPx = computePxFromEm(logoWrap, widthAfterEm)

    // ----------------- Build the timeline
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })

    // Init background video size to avoid layout jumps
    if (bgVideos && bgVideos.length) {
      gsap.set(bgVideos, { width: '100%', height: '100%' })
    }
    try {
      const bgInner = document.querySelector('.background-inner')
      if (bgInner) {
        gsap.set(bgInner, { transformOrigin: '50% 50%', scale: 1 })
      }
    } catch (e) {
      // ignore
    }
    // Text box starts hidden; will fade in right after logo-square completes
    gsap.set(textBox, { opacity: 0 })

    // 1. .logo-icon entre (dans .is-logo-icon) et .logo-square s'étend de 0% à 100% (800ms, custom ease)
    if (logoSquare) {
      gsap.set(logoSquare, { width: '0%', height: '0%' })
      tl.to(
        logoSquare,
        {
          width: '100%',
          height: '100%',
          duration: 0.8,
          ease: loaderEase,
        },
        0
      )
    }
    tl.from(
      logoIcon,
      {
        yPercent: 100,
        rotation: 70,
        transformOrigin: '50% 50%',
        duration: 0.8,
        ease: loaderEase,
      },
      0
    )

    // 2. à la fin de logo-square: bg du wrapper devient var(--primary) immédiatement,
    // puis le texte devient visible (fade), et le wrapper s'élargit
    tl.set(logoWrap, { backgroundColor: 'var(--primary)' }, '>')
    // Reveal outline only after logo-square has completed to 100%
    if (outlineEl) {
      tl.set(outlineEl, { autoAlpha: 1 }, '>')
    }
    tl.to(textBox, { opacity: 1, duration: 0.3, ease: loaderEase }, '<')
    tl.to(
      logoWrap,
      { width: logoTargetWidthPx, duration: 0.8, ease: loaderEase },
      '<'
    )
    tl.from(
      otherPaths,
      {
        yPercent: (index) => 100 + index * 40,
        stagger: 0.02,
        duration: 0.8,
      },
      '<'
    )

    // 3. wrapper vers fin puis réduit
    tl.set(logoWrap, { justifyContent: 'flex-end' })
    tl.to(logoWrap, { width: widthAfterPx, duration: 0.3, ease: loaderEase })

    // Fallback on tablet/mobile and Safari macOS: replace mask reveal with a simple loader fade-out
    const isTabletOrMobile =
      (window.matchMedia && window.matchMedia('(max-width: 991px)').matches) ||
      window.innerWidth <= 991

    // Detect Safari on macOS using feature detection first (requested method),
    // with a UA/vendor fallback for cases where the property isn't reported on macOS
    const hasCssSupports = !!(window.CSS && CSS.supports)
    const supportsTouchCallout =
      hasCssSupports && CSS.supports('-webkit-touch-callout', 'none')
    const isMacPlatform =
      typeof navigator !== 'undefined' &&
      typeof navigator.platform === 'string' &&
      navigator.platform.startsWith('Mac')

    // Fallback heuristics (still require macOS platform)
    const hasNavigator = typeof navigator !== 'undefined'
    const ua =
      hasNavigator && typeof navigator.userAgent === 'string'
        ? navigator.userAgent
        : ''
    const vendor =
      hasNavigator && typeof navigator.vendor === 'string'
        ? navigator.vendor
        : ''
    const isSafariUA =
      /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Brave/i.test(ua)
    const isSafariVendor = /Apple/i.test(vendor)

    const isSafariMac =
      (!!supportsTouchCallout && !!isMacPlatform) ||
      (isMacPlatform && (isSafariUA || isSafariVendor))

    if (isSafariMac) {
      try {
        console.log('safari detected')
      } catch (e) {
        // ignore
      }
    }

    if (isTabletOrMobile || isSafariMac) {
      // Cleanup any overlay resources
      tl.add(() => {
        try {
          if (syncOutlineSize) gsap.ticker.remove(syncOutlineSize)
          if (handleResize) window.removeEventListener('resize', handleResize)
          if (outlineEl) outlineEl.remove()
        } catch (e) {
          // ignore
        }
      })

      // Run hero-related animations in parallel with the fade-out
      tl.add(() => {
        try {
          heroAnimation()
        } catch (e) {
          // ignore
        }
      }, '>')
      tl.add(() => {
        try {
          initContactHero(document, {
            animate: true,
            duration: 1.2,
            ease: loaderEase,
          })
        } catch (e) {
          // ignore
        }
      }, '<')
      tl.add(() => {
        try {
          initHeroBackgroundParallax(document)
        } catch (e) {
          // ignore
        }
      }, '<')
      tl.to(
        '.background-inner',
        {
          scale: 1.2,
          transformOrigin: '50% 50%',
          duration: 1.2,
          ease: loaderEase,
        },
        '<'
      )

      // Fade out loader quickly
      tl.to(loader, { opacity: 0, duration: 0.5, ease: loaderEase }, '<')

      // Remove loader at the end
      tl.add(() => {
        try {
          loader.remove()
        } catch (e) {
          // ignore
        }
      })

      return tl
    }

    // 4. Préparation et animation du masque à l'intérieur de .is-logo-text
    let holeRectRef = null
    tl.add(() => {
      // Reparent .is-logo-text au niveau de .loader_inner, supprimer les autres blocs
      const textRect = textBox.getBoundingClientRect()
      const logoRect = logoText.getBoundingClientRect()
      const csText = getComputedStyle(textBox)
      const marginLeftPx = parseFloat(csText.marginLeft || '0') || 0

      // Déplacer textBox pour survivre à la suppression du wrapper
      document.body.appendChild(textBox)
      iconBox.remove()
      logoWrap.remove()
      try {
        if (syncOutlineSize) gsap.ticker.remove(syncOutlineSize)
        if (handleResize) window.removeEventListener('resize', handleResize)
        if (outlineEl) outlineEl.remove()
      } catch (e) {
        // ignore
      }

      // Positionner textBox en absolu à sa position initiale
      Object.assign(textBox.style, {
        position: 'fixed',
        left: `${textRect.left - marginLeftPx}px`,
        top: `${textRect.top}px`,
        width: `${textRect.width}px`,
        height: `${textRect.height}px`,
        overflow: 'visible',
        zIndex: '1001',
      })

      // Figer .logo-text pour éviter tout jitter
      Object.assign(logoText.style, {
        position: 'fixed',
        left: `${logoRect.left}px`,
        top: `${logoRect.top}px`,
        width: `${logoRect.width}px`,
        height: `${logoRect.height}px`,
        pointerEvents: 'none',
        zIndex: '1002',
        willChange: 'opacity',
        backfaceVisibility: 'hidden',
        transform: 'translateZ(0)',
      })

      // Construire un SVG de définitions qui fournit un <mask> appliqué au loader (le trou perce le loader)
      const NS = 'http://www.w3.org/2000/svg'
      const svg = document.createElementNS(NS, 'svg')
      const defs = document.createElementNS(NS, 'defs')
      const svgMask = document.createElementNS(NS, 'mask')
      const whiteRect = document.createElementNS(NS, 'rect')
      const holeRect = document.createElementNS(NS, 'rect')

      const vw = window.innerWidth
      const vh = window.innerHeight

      // SVG caché (0x0) pour héberger le <mask> référencé par CSS
      svg.setAttribute('width', '0')
      svg.setAttribute('height', '0')
      svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`)
      svg.setAttribute('preserveAspectRatio', 'none')
      Object.assign(svg.style, {
        position: 'absolute',
        width: '0',
        height: '0',
      })

      svgMask.setAttribute('id', 'pageRevealMask')
      svgMask.setAttribute('maskUnits', 'userSpaceOnUse')
      svgMask.setAttribute('maskContentUnits', 'userSpaceOnUse')
      svgMask.setAttribute('style', 'mask-type:luminance;')

      whiteRect.setAttribute('x', '0')
      whiteRect.setAttribute('y', '0')
      whiteRect.setAttribute('width', String(vw))
      whiteRect.setAttribute('height', String(vh))
      whiteRect.setAttribute('fill', 'white')

      // Trou initial = bounds de .is-logo-text en coordonnées viewport + bords arrondis
      const rootFs =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const radiusPx =
        parseFloat(csText.borderTopLeftRadius || '0') || rootFs * 0.5
      holeRect.setAttribute('x', String(textRect.left))
      holeRect.setAttribute('y', String(textRect.top))
      holeRect.setAttribute('width', String(textRect.width))
      holeRect.setAttribute('height', String(textRect.height))
      holeRect.setAttribute('fill', 'black')
      holeRect.setAttribute('rx', String(radiusPx))
      holeRect.setAttribute('ry', String(radiusPx))

      svgMask.appendChild(whiteRect)
      svgMask.appendChild(holeRect)
      defs.appendChild(svgMask)

      svg.appendChild(defs)
      textBox.appendChild(svg)

      // Appliquer le masque au loader: blanc = visible (loader), noir = percé (page)
      loader.style.mask = 'url(#pageRevealMask)'
      loader.style.webkitMask = 'url(#pageRevealMask)'

      // Laisser visible, on fera un fondu pendant l'anim

      // Stocker sur l'élément pour l'étape suivante
      holeRectRef = holeRect
    })

    // Animer .is-logo-text → plein écran (overshoot) et animer le trou avec les mêmes valeurs pour éviter les tremblements
    tl.to(textBox, {
      left: () => `-24px`,
      top: () => `-24px`,
      width: () => `${window.innerWidth + 48}px`,
      height: () => `${window.innerHeight + 48}px`,
      marginLeft: 0,
      duration: 1.1,
      ease: loaderEase,
    })
    tl.to(
      textBox,
      { backgroundColor: 'transparent', duration: 0.55, ease: loaderEase },
      '<'
    )
    tl.add(() => {
      if (!holeRectRef) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      gsap.to(holeRectRef, {
        attr: { x: -24, y: -24, width: vw + 48, height: vh + 48 },
        duration: 1.1,
        ease: loaderEase,
      })
    }, '<')
    // Lancer l'animation hero en même temps que le masque
    tl.add(() => {
      try {
        heroAnimation()
      } catch (err) {
        // ignore
      }
    }, '<')
    // Synchroniser l'animation de la largeur de la carte Contact avec la disparition du loader
    tl.add(() => {
      try {
        initContactHero(document, {
          animate: true,
          duration: 1.2,
          ease: loaderEase,
        })
      } catch (e) {
        // ignore
      }
    }, '<')
    // Une fois le reveal lancé, initialiser le parallax du background hero
    tl.add(() => {
      try {
        initHeroBackgroundParallax(document)
      } catch (e) {
        // ignore
      }
    }, '<')
    tl.to(
      '.background-inner',
      {
        scale: 1.2,
        transformOrigin: '50% 50%',
        duration: 1.2,
        ease: loaderEase,
      },
      '<'
    )
    tl.to(logoText, { opacity: 0, duration: 1.1, ease: loaderEase }, '<')

    // Fin: retirer le loader et la box texte quand le reveal est terminé
    tl.add(() => {
      try {
        loader.remove()
      } catch (e) {
        // ignore
      }
      try {
        textBox.remove()
      } catch (e) {
        // ignore
      }
    })

    return tl
  } catch (err) {
    return null
  }
}
