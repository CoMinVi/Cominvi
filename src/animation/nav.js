import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { initializeNavbarTheme as themeBase } from '../utils/base.js'

gsap.registerPlugin(CustomEase, ScrollTrigger)

// Toggle rapide pour tests visuels: garder le système en place mais inactif.
const ENABLE_NAV_THEME_SWITCHER = false

let linkBaseMarginsConfig = null
let lastScrollPosition = 0
const defaultLinkBaseMargins = [
  '8em',
  '11em',
  '14em',
  '10em',
  '13em',
  '16em',
  '12em',
  '15em',
  '18em',
  '21em',
  '24em',
  '27em',
]
// Récupération de la position du scroll
function getCurrentScrollPosition(contentEl) {
  if (window.lenis && typeof window.lenis.scroll === 'number') {
    return window.lenis.scroll
  }
  if (!contentEl) return 0
  const transform = getComputedStyle(contentEl).transform
  if (transform && transform !== 'none') {
    const match = transform.match(/matrix(3d)?\(([^)]+)\)/)
    if (match) {
      const nums = match[2].split(',').map((v) => parseFloat(v))
      const ty = nums.length === 16 ? nums[13] : nums[5]
      return Math.abs(ty || 0)
    }
  }
  return contentEl.scrollTop || 0
}

export function getNavbarBaseOffset() {
  try {
    const isTabletOrBelow =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 991px)').matches
    return isTabletOrBelow ? '1em' : '2em'
  } catch (e) {
    return '2em'
  }
}

// Animation de l'ouverture du menu
export function initializeMenuClick(options = {}, root = document) {
  const menuElements = root.querySelectorAll('.is-menu')
  const pageWrapElement = root.querySelector('.page-wrap')
  const menuIconElement = root.querySelector('.menu-icon')
  const menuLabelInner = root.querySelector('.is-menu_label-inner')
  const contentWrapElement = root.querySelector('.content-wrap')
  const brandLink = root.querySelector('.navbar > a')
  const navInnerElement = root.querySelector('.nav-inner')
  const linkAnchors = root.querySelectorAll('.links .link-item a')
  linkBaseMarginsConfig = Array.isArray(options.linkBaseMargins)
    ? options.linkBaseMargins
    : linkBaseMarginsConfig
  const menuIconBar1 = root.querySelector(
    '.menu-icon_bar.is-1, .menu-icon_bar .is-1'
  )
  const menuIconBar2 = root.querySelector(
    '.menu-icon_bar.is-2, .menu-icon_bar .is-2'
  )
  const menuIconBars = root.querySelectorAll('.menu-icon_bar')

  if (menuElements.length === 0 || !pageWrapElement) {
    return
  }

  const getMenuTheme = () => {
    const menuTheme =
      (window.__theme &&
        typeof window.__theme.getThemeFor === 'function' &&
        window.__theme.getThemeFor('menu')) ||
      (themeBase && themeBase.themes && themeBase.themes.menu) ||
      {}

    return {
      menuIconBg: menuTheme.menuIconBg || 'var(--accent)',
      menuIconBorder: menuTheme.menuIconBorder || 'var(--primary)',
      menuIconBarsBg: menuTheme.menuIconBarsBg || 'var(--primary)',
    }
  }

  const applyMenuThemeToIconInline = (withTransitionLock = true) => {
    const menuTheme = getMenuTheme()

    if (menuIconElement && menuIconElement.style) {
      menuIconElement.style.setProperty(
        'background-color',
        menuTheme.menuIconBg,
        'important'
      )
      menuIconElement.style.setProperty(
        'border-color',
        menuTheme.menuIconBorder,
        'important'
      )
      if (withTransitionLock) {
        menuIconElement.style.setProperty('transition', 'none', 'important')
      }
    }

    if (menuIconBars && menuIconBars.length) {
      menuIconBars.forEach((el) => {
        try {
          if (el && el.style) {
            el.style.setProperty(
              'background-color',
              menuTheme.menuIconBarsBg,
              'important'
            )
            if (withTransitionLock) {
              el.style.setProperty('transition', 'none', 'important')
            }
          }
        } catch (e) {
          // ignore
        }
      })
    }

    return menuTheme
  }

  // Hover: form a "+" when menu is closed; on click it rotates into an "X"
  // Ensures no conflict when the menu is open or during page transitions
  const hoverEase = CustomEase.create('custom', 'M0,0 C0.68,0 0,1 1,1 ')
  const hoverDuration = 0.6
  const onMenuIconEnter = () => {
    if (!menuIconElement) return
    try {
      if (
        isOpen ||
        document.documentElement.getAttribute('data-menu-open') === 'true'
      )
        return
    } catch (e) {
      // ignore
    }
    try {
      menuIconElement.dataset.bgLocked = 'hover'
      // Force bg on hover and prevent flash by disabling transitions
      if (menuIconElement && menuIconElement.style) {
        menuIconElement.style.setProperty(
          'background-color',
          'var(--primary)',
          'important'
        )
        menuIconElement.style.setProperty(
          'border-color',
          'var(--primary)',
          'important'
        )
        menuIconElement.style.setProperty('transition', 'none', 'important')
      }
      if (menuIconBars && menuIconBars.length) {
        menuIconBars.forEach((el) => {
          try {
            if (el && el.style) {
              el.style.setProperty('background-color', '#fff', 'important')
              el.style.setProperty('transition', 'none', 'important')
            }
          } catch (e) {
            // ignore
          }
        })
      }
    } catch (e) {
      // ignore
    }
    const tl = gsap.timeline({
      defaults: { duration: hoverDuration, ease: hoverEase, overwrite: 'auto' },
    })
    tl.to(menuIconElement, { gap: '0px' }, 0)
    if (menuLabelInner) {
      try {
        menuLabelInner.style.setProperty('will-change', 'transform')
      } catch (e) {
        // ignore
      }
      tl.to(menuLabelInner, { yPercent: -50 }, 0)
    }
    if (menuIconBars && menuIconBars.length) {
      tl.to(menuIconBars, { backgroundColor: '#fff' }, 0)
    }
    if (menuIconBar1) {
      tl.to(
        menuIconBar1,
        {
          top: '49%',
          rotation: 0,
          transformOrigin: '50% 50%',
        },
        0
      )
    }
    if (menuIconBar2) {
      tl.to(
        menuIconBar2,
        {
          bottom: '49%',
          rotation: 90,
          transformOrigin: '50% 50%',
        },
        0
      )
    }
  }
  const onMenuIconPointerDown = (e) => {
    // Prevent default to avoid blur/hover-leave races on some browsers
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    if (!menuIconElement) return
    try {
      // Snap label instantly to rest on click start
      if (menuLabelInner) {
        gsap.set(menuLabelInner, { yPercent: 0, overwrite: 'auto' })
        try {
          menuLabelInner.style.removeProperty('will-change')
        } catch (err) {
          // ignore
        }
      }
      menuIconElement.dataset.bgLocked = 'open'
      applyMenuThemeToIconInline()
    } catch (e) {
      // ignore
    }
  }
  const onMenuIconLeave = () => {
    if (!menuIconElement) return
    try {
      if (
        isOpen ||
        document.documentElement.getAttribute('data-menu-open') === 'true'
      )
        return
      // If a click just began, colors are locked for open; skip cleanup
      if (menuIconElement?.dataset?.bgLocked === 'open') return
    } catch (e) {
      // ignore
    }
    gsap.to(menuIconElement, {
      duration: hoverDuration,
      ease: hoverEase,
      gap: '5px',
      overwrite: 'auto',
    })
    if (menuIconBar1) {
      gsap.to(menuIconBar1, {
        duration: hoverDuration,
        ease: hoverEase,
        top: '42%',
        rotation: 0,
        transformOrigin: '50% 50%',
        overwrite: 'auto',
      })
    }
    if (menuIconBar2) {
      gsap.to(menuIconBar2, {
        duration: hoverDuration,
        ease: hoverEase,
        bottom: '42%',
        rotation: 0,
        transformOrigin: '50% 50%',
        overwrite: 'auto',
      })
    }
    if (menuLabelInner) {
      gsap.to(menuLabelInner, {
        duration: hoverDuration,
        ease: hoverEase,
        yPercent: 0,
        overwrite: 'auto',
        onComplete: () => {
          try {
            menuLabelInner.style.removeProperty('will-change')
          } catch (e) {
            // ignore
          }
        },
      })
    }
    try {
      // Snap directly back to the current theme colors to avoid flashes
      const key = (window.__theme && window.__theme.currentKey) || 'white'
      const getFor = window.__theme && window.__theme.getThemeFor
      const t = getFor ? getFor(key) : {}
      if (menuIconElement) {
        gsap.set(menuIconElement, {
          backgroundColor: t.menuIconBg,
          borderColor: t.menuIconBorder,
          overwrite: 'auto',
        })
      }
      if (menuIconBars && menuIconBars.length) {
        gsap.set(menuIconBars, {
          backgroundColor: t.menuIconBarsBg,
          overwrite: 'auto',
        })
      }

      if (menuIconElement && menuIconElement.dataset)
        delete menuIconElement.dataset.bgLocked
      // Only remove transition to end the hover lock; keep computed colors
      if (menuIconElement && menuIconElement.style) {
        menuIconElement.style.removeProperty('transition')
      }
      if (menuIconBars && menuIconBars.length) {
        menuIconBars.forEach((el) => {
          try {
            if (el && el.style) {
              el.style.removeProperty('transition')
            }
          } catch (e) {
            // ignore
          }
        })
      }
    } catch (e) {
      // ignore
    }
  }

  const computedTop = getComputedStyle(pageWrapElement).top
  const originalTop = computedTop === 'auto' ? '0px' : computedTop
  const computedOverflow = getComputedStyle(pageWrapElement).overflow
  const originalOverflow = computedOverflow || 'visible'
  const computedBodyOverflow = getComputedStyle(document.body).overflow
  const originalBodyOverflow = computedBodyOverflow || 'visible'
  const originalInlinePosition = pageWrapElement.style.position
  const originalInlineLeft = pageWrapElement.style.left
  const originalInlineRight = pageWrapElement.style.right
  const originalInlineWidth = pageWrapElement.style.width
  let isOpen = false
  const easeCurve = CustomEase.create('custom', 'M0,0 C0.6,0 0,1 1,1 ')
  const animationDuration = 1.2
  let onResizeWhileOpen = null
  let currentMenuTl = null
  const lockPageWrapAsFixed = () => {
    try {
      if (!pageWrapElement || !pageWrapElement.style) return
      pageWrapElement.style.position = 'fixed'
      pageWrapElement.style.left = '0'
      pageWrapElement.style.right = '0'
      pageWrapElement.style.width = '100%'
    } catch (e) {
      // ignore
    }
  }
  const unlockPageWrapFixed = () => {
    try {
      if (!pageWrapElement || !pageWrapElement.style) return
      pageWrapElement.style.position = originalInlinePosition || ''
      pageWrapElement.style.left = originalInlineLeft || ''
      pageWrapElement.style.right = originalInlineRight || ''
      pageWrapElement.style.width = originalInlineWidth || ''
    } catch (e) {
      // ignore
    }
  }
  // Snap everything back to a clean "closed" baseline immediately
  const snapMenuToClosedBaseline = () => {
    try {
      // Remove any running tweens
      if (currentMenuTl) {
        try {
          currentMenuTl.kill()
        } catch (e) {
          // ignore
        }
        currentMenuTl = null
      }
      gsap.killTweensOf([
        pageWrapElement,
        menuIconElement,
        menuIconBar1,
        menuIconBar2,
        menuIconBars,
        menuLabelInner,
        linkAnchors,
        document.body,
      ])
    } catch (e) {
      // ignore
    }

    // Restore page wrapper
    try {
      unlockPageWrapFixed()
      if (pageWrapElement && pageWrapElement.style) {
        pageWrapElement.style.removeProperty('transform')
        pageWrapElement.style.removeProperty('scale')
        pageWrapElement.style.removeProperty('top')
        pageWrapElement.style.removeProperty('border-radius')
        pageWrapElement.style.removeProperty('transform-origin')
        gsap.set(pageWrapElement, { top: originalTop, overwrite: 'auto' })
      }
    } catch (e) {
      // ignore
    }

    // Restore links margins
    try {
      ensureLinkBaseMargins()
      if (linkAnchors && linkAnchors.length) {
        gsap.set(linkAnchors, {
          marginTop: (index, element) =>
            element.dataset.originalMarginTop || '0px',
          overwrite: 'auto',
        })
      }
    } catch (e) {
      // ignore
    }

    // Restore icon visuals
    try {
      const key = (window.__theme && window.__theme.storedKey) || 'white'
      const theme =
        window.__theme && window.__theme.getThemeFor
          ? window.__theme.getThemeFor(key)
          : {}
      if (menuIconElement) {
        if (menuIconElement.dataset) delete menuIconElement.dataset.bgLocked
        gsap.set(menuIconElement, {
          gap: '5px',
          rotation: 0,
          transformOrigin: '50% 50%',
          backgroundColor: theme.menuIconBg,
          borderColor: theme.menuIconBorder,
          overwrite: 'auto',
        })
        try {
          menuIconElement.style.removeProperty('transition')
        } catch (e) {
          // ignore
        }
      }
      if (menuIconBar1) {
        gsap.set(menuIconBar1, {
          top: '42%',
          rotation: 0,
          transformOrigin: '50% 50%',
          overwrite: 'auto',
        })
      }
      if (menuIconBar2) {
        gsap.set(menuIconBar2, {
          bottom: '42%',
          rotation: 0,
          transformOrigin: '50% 50%',
          overwrite: 'auto',
        })
      }
      if (menuIconBars && menuIconBars.length) {
        gsap.set(menuIconBars, {
          backgroundColor: theme.menuIconBarsBg,
          overwrite: 'auto',
        })
        menuIconBars.forEach((el) => {
          try {
            el.style.removeProperty('transition')
          } catch (e) {
            // ignore
          }
        })
      }
    } catch (e) {
      // ignore
    }

    // Restore theme/body and flags
    try {
      gsap.set(document.body, { backgroundColor: 'var(--primary)' })
      if (window.__theme) {
        try {
          window.__theme.setIconThemeSuppressed(false)
        } catch (e) {
          // ignore
        }
        try {
          window.__theme.menuCloseSamePage()
        } catch (e) {
          // ignore
        }
      }
      document.documentElement.setAttribute('data-menu-open', 'false')
    } catch (e) {
      // ignore
    }

    // Re-enable scrolling
    try {
      if (window.lenis && typeof window.lenis.start === 'function') {
        window.lenis.start()
      }
    } catch (e) {
      // ignore
    }

    // Cleanup resize handler if any
    try {
      if (onResizeWhileOpen) {
        window.removeEventListener('resize', onResizeWhileOpen)
        onResizeWhileOpen = null
      }
    } catch (e) {
      // ignore
    }

    // Notify and normalize layout
    try {
      document.dispatchEvent(new CustomEvent('menu:close-end'))
    } catch (e) {
      // ignore
    }
    try {
      if (
        typeof ScrollTrigger !== 'undefined' &&
        ScrollTrigger &&
        typeof ScrollTrigger.refresh === 'function'
      ) {
        ScrollTrigger.refresh()
        requestAnimationFrame(() => {
          try {
            ScrollTrigger.refresh()
          } catch (e) {
            // ignore
          }
        })
      }
    } catch (e) {
      // ignore
    }
    try {
      window.dispatchEvent(new Event('resize'))
    } catch (e) {
      // ignore
    }

    isOpen = false
    if (brandLink) brandLink.setAttribute('pt-inner', '')
  }

  const ensureLinkBaseMargins = () => {
    linkAnchors.forEach((anchor, index) => {
      let configured = null
      if (
        Array.isArray(linkBaseMarginsConfig) &&
        typeof linkBaseMarginsConfig[index] === 'string'
      ) {
        configured = linkBaseMarginsConfig[index]
      } else if (typeof defaultLinkBaseMargins[index] === 'string') {
        configured = defaultLinkBaseMargins[index]
      }

      if (configured) {
        // Always seed baseline so open animation has a reliable start state after transitions
        anchor.style.marginTop = configured
        anchor.dataset.originalMarginTop = configured
      } else {
        const mt = getComputedStyle(anchor).marginTop || '0px'
        anchor.dataset.originalMarginTop = mt
      }
    })
  }

  const animateMenuLinks = (tl, wasOpen) => {
    ensureLinkBaseMargins()
    if (!linkAnchors.length) return
    // Force initial margins for animation correctness
    if (wasOpen) {
      // Closing: ensure start state is marginTop: 0 before tweening back
      gsap.set(linkAnchors, { marginTop: 0 })
    } else {
      // Opening: ensure they start at original margins
      gsap.set(linkAnchors, {
        marginTop: (index, element) =>
          element.dataset.originalMarginTop || '0px',
      })
    }
    if (!wasOpen) {
      tl.to(linkAnchors, { marginTop: 0, overwrite: 'auto' }, 0)
    } else {
      tl.fromTo(
        linkAnchors,
        { marginTop: 0 },
        {
          marginTop: (index, element) =>
            element.dataset.originalMarginTop || '0px',
          overwrite: 'auto',
        },
        0
      )
    }
  }

  const getDesktopTopWhenOpen = () => {
    try {
      if (!navInnerElement) return '24em'
      const navInnerRect = navInnerElement.getBoundingClientRect()
      const pageWrapFontSize = parseFloat(
        getComputedStyle(pageWrapElement).fontSize
      )
      const rootFontSize = parseFloat(
        getComputedStyle(document.documentElement).fontSize
      )
      const emSize = pageWrapFontSize || rootFontSize || 16
      return `${navInnerRect.bottom + emSize * 9}px`
    } catch (e) {
      return '24em'
    }
  }

  const applyResponsiveLayoutIfOpen = () => {
    if (!isOpen || !pageWrapElement) return
    const vw = window.innerWidth
    const isTabletNow = vw >= 768 && vw <= 991
    const isMobileNow = vw < 768
    const topWhenOpen = isMobileNow
      ? '32em'
      : isTabletNow
      ? '15em'
      : getDesktopTopWhenOpen()
    const borderGapPxNow = isMobileNow ? 32 : 64
    const desiredWidthNow = Math.max(0, vw - borderGapPxNow)
    const scaleWhenOpen = vw > 0 ? desiredWidthNow / vw : 1
    gsap.set(pageWrapElement, {
      top: topWhenOpen,
      scale: scaleWhenOpen,
      overwrite: 'auto',
    })
  }

  // Removed cylinder CSS freeze; we rely on ScrollTrigger pinReparent/anticipatePin

  const handleMenuClick = () => {
    // Use DOM flag as source of truth (more reliable under rapid taps)
    let wasOpen = false
    try {
      wasOpen =
        document.documentElement.getAttribute('data-menu-open') === 'true'
    } catch (e) {
      wasOpen = !!isOpen
    }
    // Any trigger click should instantly reset label to rest
    try {
      if (menuLabelInner) {
        gsap.set(menuLabelInner, { yPercent: 0, overwrite: 'auto' })
        try {
          menuLabelInner.style.removeProperty('will-change')
        } catch (err) {
          // ignore
        }
      }
    } catch (err) {
      // ignore
    }
    // Kill any ongoing timeline/tweens to make animation re-entrant
    try {
      if (currentMenuTl) {
        currentMenuTl.kill()
        currentMenuTl = null
      }
      gsap.killTweensOf([
        pageWrapElement,
        menuIconElement,
        menuIconBar1,
        menuIconBar2,
        menuIconBars,
        menuLabelInner,
        linkAnchors,
      ])
    } catch (e) {
      // ignore
    }

    // Determine intended target state. Only set DOM flag early on opening.
    const intendedOpen = !wasOpen
    try {
      if (intendedOpen) {
        document.documentElement.setAttribute('data-menu-open', 'true')
      }
      // Do not set to 'false' early; keep 'true' during close animation to
      // suppress theme recompute mid-close and avoid flickers. It will be set
      // to 'false' on timeline completion.
    } catch (e) {
      // ignore
    }

    // Apply theme instantly based on intended state to avoid flickers
    try {
      if (intendedOpen) {
        if (window.__theme && typeof window.__theme.menuOpen === 'function') {
          window.__theme.menuOpen()
        }
      } else if (
        window.__theme &&
        typeof window.__theme.menuCloseSamePage === 'function'
      ) {
        window.__theme.menuCloseSamePage()
      }
    } catch (e) {
      // ignore
    }
    // If closing during an opening sequence, interrupt and snap to closed state
    if (!intendedOpen) {
      unlockPageWrapFixed()
      // If DOM says open but internal toggle not yet applied, we are mid-open
      if (wasOpen && !isOpen) {
        snapMenuToClosedBaseline()
        return
      }
      // If fully open, proceed with normal close timeline below
      try {
        if (menuIconElement && menuIconElement.dataset)
          delete menuIconElement.dataset.bgLocked
      } catch (e) {
        // ignore
      }
    }
    // Toggle pt-inner on the brand link depending on intended state
    if (!wasOpen) {
      // opening → disable inner transition on brand link
      if (brandLink) brandLink.removeAttribute('pt-inner')
      // Hide page-info immediately when opening the menu (before animation)
      try {
        const pageInfo = document.querySelector('.page-info')
        if (pageInfo) pageInfo.style.display = 'none'
      } catch (err) {
        // ignore
      }
      // Do not refresh ScrollTrigger before the menu animation to avoid jumps
    } else {
      // closing → re-enable inner transition on brand link
      if (brandLink) brandLink.setAttribute('pt-inner', '')
    }

    const targetOverflow = originalOverflow
    const targetBodyOverflow = originalBodyOverflow
    const targetBorderRadius = isOpen ? '0rem' : '1rem'
    const viewportWidth = window.innerWidth
    const isTablet = viewportWidth >= 768 && viewportWidth <= 991
    const isMobile = viewportWidth < 768
    let targetTop
    if (isOpen) {
      targetTop = originalTop
    } else if (isMobile) {
      targetTop = '32em'
    } else if (isTablet) {
      targetTop = '15em'
    } else {
      targetTop = getDesktopTopWhenOpen()
    }
    const borderGapPx = isMobile ? 32 : 64
    const desiredWidth = Math.max(0, viewportWidth - borderGapPx)
    const computedScaleOpen =
      viewportWidth > 0 ? desiredWidth / viewportWidth : 1
    const targetScale = isOpen ? 1 : computedScaleOpen
    const targetMenuIconGap = isOpen ? '5px' : '0px'
    const targetIconRotation = isOpen ? 0 : 45

    if (!wasOpen) {
      // Notify listeners (e.g., minerals) that menu is starting to open
      try {
        document.dispatchEvent(new CustomEvent('menu:open-start'))
      } catch (e) {
        // ignore
      }
      // Pre-lock and force colors to avoid flash when clicking from hover
      try {
        if (menuIconElement) {
          menuIconElement.dataset.bgLocked = 'open'
          applyMenuThemeToIconInline(false)
        }
      } catch (e) {
        // ignore
      }
      lastScrollPosition = getCurrentScrollPosition(contentWrapElement)
      if (window.lenis && typeof window.lenis.stop === 'function') {
        window.lenis.stop()
      }
    }

    if (contentWrapElement) {
      if (window.lenis && typeof window.lenis.scrollTo === 'function') {
        window.lenis.scrollTo(lastScrollPosition, {
          immediate: true,
          force: true,
        })
      } else {
        contentWrapElement.scrollTop = lastScrollPosition
      }
    }

    // Ensure scrolling isn't left disabled if we are closing quickly
    if (wasOpen && window.lenis && typeof window.lenis.start === 'function') {
      try {
        window.lenis.start()
      } catch (e) {
        // ignore
      }
    }

    const tl = gsap.timeline({
      defaults: { duration: animationDuration, ease: easeCurve },
      onComplete: () => {
        if (
          wasOpen &&
          window.lenis &&
          typeof window.lenis.start === 'function'
        ) {
          window.lenis.start()
        }
        isOpen = !isOpen
        // Ensure pt-inner reflects final menu state
        if (brandLink) {
          if (isOpen) brandLink.removeAttribute('pt-inner')
          else brandLink.setAttribute('pt-inner', '')
        }
        document.documentElement.setAttribute(
          'data-menu-open',
          isOpen ? 'true' : 'false'
        )
        // Bind/unbind responsive resize handler when state changes
        try {
          if (isOpen) {
            lockPageWrapAsFixed()
            if (onResizeWhileOpen)
              window.removeEventListener('resize', onResizeWhileOpen)
            onResizeWhileOpen = () => applyResponsiveLayoutIfOpen()
            window.addEventListener('resize', onResizeWhileOpen)
          } else if (onResizeWhileOpen) {
            unlockPageWrapFixed()
            window.removeEventListener('resize', onResizeWhileOpen)
            onResizeWhileOpen = null
          } else {
            unlockPageWrapFixed()
          }
        } catch (err) {
          // ignore
        }
        // When menu opens, hide page-info if visible
        try {
          if (isOpen) {
            const pageInfo = document.querySelector('.page-info')
            if (pageInfo) pageInfo.style.display = 'none'
          }
        } catch (err) {
          // ignore
        }
        // After closing, re-enable icon theme updates
        try {
          if (
            !isOpen &&
            window.__theme &&
            typeof window.__theme.setIconThemeSuppressed === 'function'
          ) {
            window.__theme.setIconThemeSuppressed(false)
          }
        } catch (err) {
          // ignore
        }
        // Recalc and resize only when closing (avoid jump at end of opening)
        if (!isOpen) {
          // Restore body background after close animation completes
          try {
            gsap.set(document.body, { backgroundColor: 'var(--primary)' })
          } catch (e) {
            // ignore
          }
          // Clean any residual transforms/inline states on the page wrapper to avoid breaking sticky/ScrollTrigger
          try {
            if (pageWrapElement && pageWrapElement.style) {
              pageWrapElement.style.removeProperty('transform')
              pageWrapElement.style.removeProperty('scale')
              pageWrapElement.style.removeProperty('top')
              pageWrapElement.style.removeProperty('border-radius')
              pageWrapElement.style.removeProperty('transform-origin')
            }
          } catch (e) {
            // ignore
          }
          // Inform listeners that menu fully closed
          try {
            document.dispatchEvent(new CustomEvent('menu:close-end'))
          } catch (e) {
            // ignore
          }
          try {
            if (
              typeof ScrollTrigger !== 'undefined' &&
              ScrollTrigger &&
              typeof ScrollTrigger.refresh === 'function'
            ) {
              ScrollTrigger.refresh()
              requestAnimationFrame(() => {
                try {
                  ScrollTrigger.refresh()
                } catch (e) {
                  // ignore
                }
              })
            }
          } catch (e) {
            // ignore
          }
          // Nudge layout systems that rely on resize and 3D promotion
          try {
            window.dispatchEvent(new Event('resize'))
          } catch (e) {
            // ignore
          }
          try {
            const nodes = document.querySelectorAll(
              '.cylindar__text__wrapper, .scroll-indicator_c'
            )
            if (nodes && nodes.length) {
              gsap.set(nodes, {
                force3D: true,
                z: 0.01,
                transformOrigin: '50% 50% 0',
                overwrite: 'auto',
              })
            }
          } catch (e) {
            // ignore
          }
        }
        currentMenuTl = null
      },
    })
    // Also handle interruption (e.g., rapid re-click) cleanly
    try {
      tl.eventCallback('onInterrupt', () => {
        currentMenuTl = null
      })
    } catch (e) {
      // ignore
    }
    currentMenuTl = tl

    // Cache margins and animate menu links
    animateMenuLinks(tl, wasOpen)

    if (menuIconElement) {
      tl.to(
        menuIconElement,
        {
          gap: targetMenuIconGap,
          rotation: targetIconRotation,
          transformOrigin: '50% 50%',
          overwrite: 'auto',
        },
        0
      )
      try {
        menuIconElement.dataset.bgLocked = 'open'
        applyMenuThemeToIconInline()
      } catch (e) {
        // ignore
      }
      // Ensure the bars land on the menu theme without intermediate colors
      if (menuIconBars && menuIconBars.length) {
        const menuTheme = getMenuTheme()
        tl.set(
          menuIconBars,
          { backgroundColor: menuTheme.menuIconBarsBg, overwrite: 'auto' },
          0
        )
        tl.to(
          menuIconBars,
          { backgroundColor: menuTheme.menuIconBarsBg, overwrite: 'auto' },
          0
        )
      }
    }
    if (!wasOpen) {
      // Ensure bars are in "+" configuration before rotating container into "X"
      if (menuIconBar1)
        tl.set(
          menuIconBar1,
          { top: '49%', rotation: 0, transformOrigin: '50% 50%' },
          0
        )
      if (menuIconBar2)
        tl.set(
          menuIconBar2,
          { bottom: '49%', rotation: 90, transformOrigin: '50% 50%' },
          0
        )
    } else {
      if (menuIconBar1) {
        tl.to(
          menuIconBar1,
          {
            top: '42%',
            rotation: 0,
            transformOrigin: '50% 50%',
            overwrite: 'auto',
          },
          0
        )
      }
      if (menuIconBar2) {
        tl.to(
          menuIconBar2,
          {
            bottom: '42%',
            rotation: 0,
            transformOrigin: '50% 50%',
            overwrite: 'auto',
          },
          0
        )
      }
      // Closing: tween icon colors directly to stored theme without intermediate changes
      try {
        const targetKey =
          (window.__theme && window.__theme.storedKey) || 'white'
        const theme =
          window.__theme && window.__theme.getThemeFor
            ? window.__theme.getThemeFor(targetKey)
            : {}
        if (menuIconElement) {
          tl.set(
            menuIconElement,
            {
              backgroundColor: theme.menuIconBg,
              borderColor: theme.menuIconBorder,
              overwrite: 'auto',
            },
            0
          )
        }
        if (menuIconBars && menuIconBars.length) {
          tl.to(
            menuIconBars,
            {
              backgroundColor: theme.menuIconBarsBg,
              overwrite: 'auto',
            },
            0
          )
        }
        // Unlock and clean transition flag but keep colors so they finish at target theme
        if (menuIconElement && menuIconElement.dataset)
          delete menuIconElement.dataset.bgLocked
        if (menuIconElement && menuIconElement.style) {
          menuIconElement.style.removeProperty('transition')
        }
        if (menuIconBars && menuIconBars.length) {
          menuIconBars.forEach((el) => {
            try {
              if (el && el.style) {
                el.style.removeProperty('transition')
              }
            } catch (e) {
              // ignore
            }
          })
        }
      } catch (e) {
        // ignore
      }
    }

    // Link animations already added above via animateMenuLinks
    tl.set(pageWrapElement, { overflow: targetOverflow }, 0)
    tl.set(document.body, { overflow: targetBodyOverflow }, 0)
    tl.set(pageWrapElement, { transformOrigin: '50% 0%' }, 0)
    tl.to(pageWrapElement, { top: targetTop, overwrite: 'auto' }, 0)
    tl.to(pageWrapElement, { scale: targetScale, overwrite: 'auto' }, 0)
    tl.to(
      pageWrapElement,
      { borderRadius: targetBorderRadius, overwrite: 'auto' },
      0
    )
  }

  menuElements.forEach((menuElement) => {
    if (menuElement.__menuHandler) {
      try {
        menuElement.removeEventListener('click', menuElement.__menuHandler)
      } catch (err) {
        // ignore
      }
    }
    menuElement.__menuHandler = handleMenuClick
    menuElement.addEventListener('click', menuElement.__menuHandler)
  })

  // Close menu when clicking on page content while menu is open
  try {
    if (pageWrapElement.__menuOutsideHandler) {
      pageWrapElement.removeEventListener(
        'click',
        pageWrapElement.__menuOutsideHandler
      )
    }
  } catch (err) {
    // ignore
  }
  pageWrapElement.__menuOutsideHandler = () => {
    try {
      if (document.documentElement.getAttribute('data-menu-open') === 'true') {
        handleMenuClick()
      }
    } catch (err) {
      // ignore
    }
  }
  pageWrapElement.addEventListener(
    'click',
    pageWrapElement.__menuOutsideHandler
  )

  document.documentElement.setAttribute('data-menu-open', 'false')
  // On init (menu closed), ensure the brand link triggers inner transition
  if (brandLink) brandLink.setAttribute('pt-inner', '')

  // Bind hover handlers on the menu icon (cleanup any previous bindings)
  try {
    if (menuIconElement) {
      if (menuIconElement.__hoverEnter) {
        menuIconElement.removeEventListener(
          'mouseenter',
          menuIconElement.__hoverEnter
        )
      }
      if (menuIconElement.__hoverLeave) {
        menuIconElement.removeEventListener(
          'mouseleave',
          menuIconElement.__hoverLeave
        )
      }
      menuIconElement.__hoverEnter = onMenuIconEnter
      menuIconElement.__hoverLeave = onMenuIconLeave
      menuIconElement.addEventListener(
        'mouseenter',
        menuIconElement.__hoverEnter
      )
      menuIconElement.addEventListener(
        'mouseleave',
        menuIconElement.__hoverLeave
      )
      // Lock early at pointerdown to prevent hover-leave repaint before click
      try {
        if (menuIconElement.__pointerDownLock) {
          menuIconElement.removeEventListener(
            'pointerdown',
            menuIconElement.__pointerDownLock
          )
        }
      } catch (e) {
        // ignore
      }
      menuIconElement.__pointerDownLock = onMenuIconPointerDown
      menuIconElement.addEventListener(
        'pointerdown',
        menuIconElement.__pointerDownLock
      )
      // Force initial visual baseline regardless of theme
      // Remove any previous lock at init; theme will apply normally until hover/open
      try {
        if (menuIconElement && menuIconElement.dataset)
          delete menuIconElement.dataset.bgLocked
      } catch (e) {
        // ignore
      }
    }
  } catch (err) {
    // ignore
  }
}

// Animation de scroll de la navbar
export function initializeNavbarScroll(root = document) {
  const wrapperElement = root.querySelector('.page-wrap')
  const contentElement = root.querySelector('.content-wrap')
  const navbarElement = root.querySelector('.navbar')

  if (!wrapperElement || !navbarElement) {
    return
  }

  // Cleanup previous listeners
  try {
    if (wrapperElement.__navbarScrollListener) {
      wrapperElement.removeEventListener(
        'scroll',
        wrapperElement.__navbarScrollListener
      )
    }
  } catch (err) {
    // ignore
  }
  try {
    if (
      window.lenis &&
      window.lenis.__navbarScrollListener &&
      typeof window.lenis.off === 'function'
    ) {
      window.lenis.off('scroll', window.lenis.__navbarScrollListener)
    }
  } catch (err) {
    // ignore
  }

  let previousScrollTop = getCurrentScrollPosition(
    contentElement || wrapperElement
  )

  const applyNavbarByDelta = (delta) => {
    if (delta > 2) {
      gsap.to(navbarElement, {
        duration: 0.5,
        left: '-9em',
        right: '-9em',
        pointerEvents: 'none',
        overwrite: 'auto',
      })
    } else if (delta < -2) {
      gsap.to(navbarElement, {
        duration: 0.5,
        left: getNavbarBaseOffset(),
        right: getNavbarBaseOffset(),
        overwrite: 'auto',
      })
    }
  }

  const nativeHandle = () => {
    const currentScrollTop = getCurrentScrollPosition(
      contentElement || wrapperElement
    )
    const delta = currentScrollTop - previousScrollTop
    applyNavbarByDelta(delta)
    previousScrollTop = currentScrollTop
  }

  if (window.lenis && typeof window.lenis.on === 'function') {
    const lenisHandler = (e) => {
      const current =
        e && typeof e.scroll === 'number' ? e.scroll : previousScrollTop
      const delta = current - previousScrollTop
      applyNavbarByDelta(delta)
      previousScrollTop = current
    }
    window.lenis.__navbarScrollListener = lenisHandler
    window.lenis.on('scroll', window.lenis.__navbarScrollListener)
  } else {
    const onScroll = () => requestAnimationFrame(nativeHandle)
    wrapperElement.__navbarScrollListener = onScroll
    wrapperElement.addEventListener('scroll', onScroll)
  }
}

// Direct navbar spread animation (duplicated behavior of scroll-down/up)
// isOpen: true → send navbar left/right to -8em (off edges)
// isOpen: false → bring navbar back to left/right 2em
export function animateNavbarSpreadForGrid(isOpen, root = document) {
  try {
    const navbarElement =
      root.querySelector('.navbar') || document.querySelector('.navbar')
    if (!navbarElement) return
    const base = getNavbarBaseOffset()
    gsap.to(navbarElement, {
      duration: 0.5,
      ease: CustomEase.create('custom', 'M0,0 C0.6,0 0,1 1,1 '),
      overwrite: 'auto',
      left: isOpen ? '-9em' : base,
      right: isOpen ? '-9em' : base,
      pointerEvents: isOpen ? 'none' : 'auto',
    })
  } catch (e) {
    // ignore
  }
}

// Hover animation for the main logo
function initializeLogoHover(root = document) {
  try {
    const scope = root && root.querySelector ? root : document
    const logoMain = scope.querySelector('.is-logo_main')
    if (!logoMain) return

    const t1 = logoMain.querySelector('.is-t-1')
    const t2 = logoMain.querySelector('.is-t-2')
    const t1Paths = t1 ? t1.querySelectorAll('.logo-path') : []
    const t2Paths = t2 ? t2.querySelectorAll('.logo-path') : []

    // Initial states
    if (t1) gsap.set(t1, { yPercent: 0, overwrite: 'auto' })
    if (t2) gsap.set(t2, { yPercent: 0, overwrite: 'auto' })
    if (t1Paths && t1Paths.length)
      gsap.set(t1Paths, { yPercent: 0, overwrite: 'auto' })
    if (t2Paths && t2Paths.length)
      gsap.set(t2Paths, { yPercent: 100, overwrite: 'auto' }) // .is-t-2 .logo-path -> 100%

    const duration = 0.5
    const ease = CustomEase.create('custom', 'M0,0 C0.51,0 0,1 1,1')
    let isAnimating = false

    const onEnter = () => {
      if (isAnimating) return
      isAnimating = true
      const tl = gsap.timeline({
        defaults: { duration, ease, overwrite: 'auto' },
        onComplete: () => {
          // Reset to initial positions
          if (t1) gsap.set(t1, { yPercent: 0, overwrite: 'auto' })
          if (t2) gsap.set(t2, { yPercent: 0, overwrite: 'auto' })
          if (t1Paths && t1Paths.length)
            gsap.set(t1Paths, { yPercent: 0, overwrite: 'auto' })
          if (t2Paths && t2Paths.length)
            gsap.set(t2Paths, { yPercent: 100, overwrite: 'auto' })
          isAnimating = false
        },
      })

      if (t1) tl.to(t1, { yPercent: -120 }, 0)
      if (t2) tl.to(t2, { yPercent: -100 }, 0)

      const allPaths = [...t1Paths, ...t2Paths]
      if (allPaths.length) {
        tl.to(allPaths, { yPercent: -42, stagger: { each: 0.03 } }, 0)
      }
    }

    try {
      if (logoMain.__logoHoverEnter) {
        logoMain.removeEventListener('mouseenter', logoMain.__logoHoverEnter)
      }
    } catch (e) {
      // ignore
    }
    logoMain.__logoHoverEnter = onEnter
    logoMain.addEventListener('mouseenter', onEnter)
  } catch (e) {
    // ignore
  }
}

export function initializeNav2(root = document) {
  syncNavInnerCurrentLink(root)
  initializeMenuClick({}, root)
  initializeNavbarScroll(root)
  initializeThemeController()
  initializeLogoHover(root)
  // Keep navbar base offsets in sync with breakpoint changes when menu is closed
  try {
    const onResizeRebase = () => {
      try {
        if (document.documentElement.getAttribute('data-menu-open') === 'true')
          return
        const scope = root && root.querySelector ? root : document
        const navbar =
          (scope.querySelector && scope.querySelector('.navbar')) ||
          document.querySelector('.navbar')
        if (!navbar) return
        const base = getNavbarBaseOffset()
        gsap.set(navbar, { left: base, right: base, overwrite: 'auto' })
      } catch (e) {
        // ignore
      }
    }
    window.addEventListener('resize', onResizeRebase)
  } catch (e) {
    // ignore
  }
  // If entering an article page, ensure navbar is reset to its default offsets
  try {
    const container = root && root.querySelector ? root : document
    const nsEl =
      (container.querySelector &&
        container.querySelector('[data-barba-namespace]')) ||
      document.querySelector('[data-barba-namespace]')
    let ns = null
    if (nsEl && nsEl.getAttribute) {
      ns = nsEl.getAttribute('data-barba-namespace')
    }
    if (ns === 'article') {
      const navbar =
        (container.querySelector && container.querySelector('.navbar')) ||
        document.querySelector('.navbar')
      if (navbar) {
        gsap.to(navbar, {
          duration: 1.2,
          ease: CustomEase.create('custom', 'M0,0 C0.6,0 0,1 1,1 '),
          left: getNavbarBaseOffset(),
          right: getNavbarBaseOffset(),
          overwrite: 'auto',
        })
      }
    }
  } catch (e) {
    // ignore
  }
  // Always normalize navbar offsets to base on init (responsive)
  try {
    const scope = root && root.querySelector ? root : document
    const navbar =
      (scope.querySelector && scope.querySelector('.navbar')) ||
      document.querySelector('.navbar')
    if (navbar) {
      gsap.set(navbar, {
        left: getNavbarBaseOffset(),
        right: getNavbarBaseOffset(),
        overwrite: 'auto',
      })
    }
  } catch (e) {
    // ignore
  }
}

function normalizePathname(pathname) {
  try {
    const value = String(pathname || '/').trim()
    if (!value) return '/'
    return value.endsWith('/') && value.length > 1 ? value.slice(0, -1) : value
  } catch (e) {
    return '/'
  }
}

function syncNavInnerCurrentLink(root = document) {
  try {
    const scope = root && root.querySelector ? root : document
    const links = scope.querySelectorAll('.nav-inner .navlink')
    if (!links || !links.length) return

    const currentPath = normalizePathname(
      (window.location && window.location.pathname) || '/'
    )

    let activeLink = null
    links.forEach((link) => {
      try {
        const href = link.getAttribute('href') || ''
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
          return
        }
        const url = new URL(href, window.location.origin)
        const linkPath = normalizePathname(url.pathname)
        if (linkPath === currentPath && !activeLink) {
          activeLink = link
        }
      } catch (e) {
        // ignore invalid href
      }
    })

    links.forEach((link) => {
      const isActive = !!activeLink && link === activeLink
      try {
        if (isActive) {
          link.classList.add('w--current')
          link.setAttribute('aria-current', 'page')
        } else {
          link.classList.remove('w--current')
          link.removeAttribute('aria-current')
        }
      } catch (e) {
        // ignore
      }
    })
  } catch (e) {
    // ignore
  }
}

// Réinitialise l'état inline des liens du menu (utile après transitions)
export function resetMenuLinksAnimationState(root = document) {
  try {
    const scope = root && root.querySelector ? root : document
    const links = scope.querySelectorAll('.links .link-item a')
    if (!links || !links.length) return
    links.forEach((a) => {
      try {
        a.style.transform = ''
        a.style.marginTop = ''
        a.style.willChange = ''
      } catch (e) {
        // ignore
      }
    })
  } catch (e) {
    // ignore
  }
}

// Ajoute l'animation de "fermeture" des liens du menu dans une timeline fournie (utile pendant la transition de page)
export function addMenuLinksCloseToTimeline(tl, label = 'lift') {
  if (!tl) return
  const linkAnchors = document.querySelectorAll('.links .link-item a')
  if (!linkAnchors || !linkAnchors.length) return
  // Assure les marges d'origine pour chaque lien
  linkAnchors.forEach((anchor) => {
    if (!anchor.dataset.originalMarginTop) {
      const mt = getComputedStyle(anchor).marginTop || '0px'
      anchor.dataset.originalMarginTop = mt
    }
  })
  const easeCurve = CustomEase.create('custom', 'M0,0 C0.6,0 0,1 1,1 ')
  // Les liens partent de marginTop: 0 (menu "ouvert") et reviennent à leur marge d'origine (menu "fermé")
  gsap.set(linkAnchors, { marginTop: 0 })
  tl.fromTo(
    linkAnchors,
    { marginTop: 0 },
    {
      marginTop: (index, element) => element.dataset.originalMarginTop || '0px',
      overwrite: 'auto',
      duration: 1.2,
      ease: easeCurve,
    },
    label
  )
}

// Gestion themes couleur
export function initializeThemeController() {
  if (!ENABLE_NAV_THEME_SWITCHER) {
    const fallbackThemes = (themeBase && themeBase.themes) || {}
    try {
      const scroller = document.querySelector('.page-wrap')
      if (
        scroller &&
        scroller.__themeHandler &&
        typeof scroller.removeEventListener === 'function'
      ) {
        scroller.removeEventListener('scroll', scroller.__themeHandler)
      }
    } catch (e) {
      // ignore
    }
    try {
      if (
        window.lenis &&
        window.lenis.__themeHandler &&
        typeof window.lenis.off === 'function'
      ) {
        window.lenis.off('scroll', window.lenis.__themeHandler)
      }
    } catch (e) {
      // ignore
    }

    window.__theme = {
      get currentKey() {
        return 'white'
      },
      get activeKey() {
        return 'white'
      },
      get destinationKey() {
        return 'white'
      },
      get storedKey() {
        return 'white'
      },
      getThemeFor: (key) => fallbackThemes[key] || fallbackThemes.white || {},
      setIconThemeSuppressed: () => {},
      setDestination: () => 'white',
      apply: () => {},
      applyDestination: () => {},
      compute: () => 'white',
      menuOpen: () => {},
      menuCloseSamePage: () => {},
      bindScroll: () => {},
    }
    return
  }

  const themes = (themeBase && themeBase.themes) || {}
  const tr = (themeBase && themeBase.transition) || { duration: 0.5 }

  let currentKey = 'white'
  let activeKey = 'white'
  let destinationKey = 'white'
  let snapshotKey = 'white'
  let storedKey = 'white'
  let suppressMenuIconTheme = false

  const navbarElement = document.querySelector('.navbar')
  const logoBgElement = document.querySelector('.logo-bg')
  const isoLogoBgElements = document.querySelectorAll('.is-logo-bg')
  const logoPathElements = document.querySelectorAll('.logo-path')
  const menuIconElement = document.querySelector('.menu-icon')
  const menuIconBars = document.querySelectorAll('.menu-icon_bar')

  const applyTheme = (key, instant = false) => {
    const t = themes[key] || themes.white || {}
    const to = { ...tr, overwrite: 'auto' }
    const isoSpecByKey = {
      white: { fill: 'var(--white)', opacity: 1 },
      black: { fill: 'var(--primary)', opacity: 1 },
      hero: { fill: 'transparent', opacity: 0 },
      menu: { fill: 'transparent', opacity: 0 },
    }
    const isoTarget = isoSpecByKey[key]
    const isLocked = !!menuIconElement?.dataset?.bgLocked
    const lockedState = menuIconElement?.dataset?.bgLocked
    const lockedMenuTheme =
      lockedState === 'open' && themes.menu ? themes.menu : null
    if (instant) {
      if (navbarElement) gsap.set(navbarElement, { color: t.navbarColor })
      if (logoBgElement) gsap.set(logoBgElement, { fill: t.logoBgFill })
      if (isoLogoBgElements.length && isoTarget)
        gsap.set(isoLogoBgElements, {
          fill: isoTarget.fill,
          opacity: isoTarget.opacity,
        })
      if (logoPathElements.length)
        gsap.set(logoPathElements, { fill: t.logoPathFill })
      if (!suppressMenuIconTheme) {
        if (menuIconElement)
          gsap.set(menuIconElement, {
            borderColor: lockedMenuTheme
              ? lockedMenuTheme.menuIconBorder
              : t.menuIconBorder,
            backgroundColor: lockedMenuTheme
              ? lockedMenuTheme.menuIconBg
              : t.menuIconBg,
          })
        if (menuIconBars.length) {
          const lockedHover =
            isLocked && menuIconElement?.dataset?.bgLocked === 'hover'
          gsap.set(menuIconBars, {
            backgroundColor: lockedHover
              ? '#fff'
              : lockedMenuTheme
              ? lockedMenuTheme.menuIconBarsBg
              : t.menuIconBarsBg,
          })
        }
      }
    } else {
      if (navbarElement) gsap.to(navbarElement, { color: t.navbarColor, ...to })
      if (logoBgElement) gsap.to(logoBgElement, { fill: t.logoBgFill, ...to })
      if (isoLogoBgElements.length && isoTarget)
        gsap.to(isoLogoBgElements, {
          fill: isoTarget.fill,
          opacity: isoTarget.opacity,
          ...to,
        })
      if (logoPathElements.length)
        gsap.to(logoPathElements, { fill: t.logoPathFill, ...to })
      if (!suppressMenuIconTheme) {
        if (menuIconElement)
          gsap.to(menuIconElement, {
            borderColor: lockedMenuTheme
              ? lockedMenuTheme.menuIconBorder
              : t.menuIconBorder,
            backgroundColor: lockedMenuTheme
              ? lockedMenuTheme.menuIconBg
              : t.menuIconBg,
            ...to,
          })
        if (menuIconBars.length) {
          const lockedHover =
            isLocked && menuIconElement?.dataset?.bgLocked === 'hover'
          gsap.to(menuIconBars, {
            backgroundColor: lockedHover
              ? '#fff'
              : lockedMenuTheme
              ? lockedMenuTheme.menuIconBarsBg
              : t.menuIconBarsBg,
            ...to,
          })
        }
      }
    }
    currentKey = key
  }

  const computeActiveTheme = () => {
    const sections = document.querySelectorAll('[bg]')
    if (!sections || sections.length === 0) return 'white'
    const nb = (
      document.querySelector('.navbar') || document.body
    ).getBoundingClientRect()
    for (const s of sections) {
      const r = s.getBoundingClientRect()
      if (r.top <= nb.bottom && r.bottom >= nb.top) {
        const v = (s.getAttribute('bg') || 'white').toLowerCase()
        if (themes[v]) return v
      }
    }
    return 'white'
  }

  const onScrollThemeUpdate = () => {
    if (document.documentElement.getAttribute('data-menu-open') === 'true')
      return
    const key = computeActiveTheme()
    if (key !== currentKey) {
      applyTheme(key)
    }
    activeKey = key
    storedKey = key
  }

  window.__theme = {
    get currentKey() {
      return currentKey
    },
    get activeKey() {
      return activeKey
    },
    get destinationKey() {
      return destinationKey
    },
    get storedKey() {
      return storedKey
    },
    getThemeFor: (key) => themes[key] || themes.white || {},
    setIconThemeSuppressed: (v) => {
      suppressMenuIconTheme = !!v
    },
    setDestination: (rootContainer = document) => {
      const rootEl =
        rootContainer && rootContainer.querySelector ? rootContainer : document
      const first = rootEl.querySelector('[bg]')
      let key = 'white'
      if (first) {
        const v = (first.getAttribute('bg') || 'white').toLowerCase()
        key = themes[v] ? v : 'white'
      }
      destinationKey = key
      return destinationKey
    },
    apply: (key, instant = false) => applyTheme(key, instant),
    applyDestination: (instant = false) => applyTheme(destinationKey, instant),
    compute: () => computeActiveTheme(),
    menuOpen: () => {
      snapshotKey = computeActiveTheme()
      suppressMenuIconTheme = true
      // Snap instantly to menu theme to avoid flashes
      applyTheme('menu', true)
    },
    menuCloseSamePage: () => {
      const latest = computeActiveTheme()
      const keyToApply = storedKey || snapshotKey || latest
      // Keep icon suppressed; external code will tween icon to stored theme
      suppressMenuIconTheme = true
      // Snap instantly on close to avoid flashes
      applyTheme(keyToApply, true)
      snapshotKey = latest
    },
    bindScroll: (root = document) => {
      const scroller =
        root.querySelector && root.querySelector('.page-wrap')
          ? root.querySelector('.page-wrap')
          : window
      const handler = () => requestAnimationFrame(onScrollThemeUpdate)
      try {
        if (scroller.removeEventListener && scroller.__themeHandler) {
          scroller.removeEventListener('scroll', scroller.__themeHandler)
        }
      } catch (err) {
        // ignore
      }
      scroller.__themeHandler = handler
      if (scroller.addEventListener) {
        scroller.addEventListener('scroll', handler, { passive: true })
      }
      if (window.lenis && typeof window.lenis.on === 'function') {
        try {
          window.lenis.off('scroll', window.lenis.__themeHandler)
        } catch (err) {
          // ignore
        }
        window.lenis.__themeHandler = handler
        window.lenis.on('scroll', window.lenis.__themeHandler)
      }
      onScrollThemeUpdate()
    },
  }
  // Initial bind
  window.__theme.bindScroll(document)
  // Initial apply
  applyTheme(computeActiveTheme(), true)
}
