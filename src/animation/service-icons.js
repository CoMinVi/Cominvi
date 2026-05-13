// Lottie hover handling for service and team icons
import lottieWeb from 'lottie-web'

// Optional ID → URL mapping. If an element has data-lottie="1", it will
// use LOTTIE_URLS['1']. If data-lottie contains a full URL, that URL is used.
const LOTTIE_URLS = {
  1: 'https://cdn.prod.website-files.com/6899a2f3f7995d5e3e31b7c6/68db86c6333c80ebd3a6425e_CoMinVi%20-%20Icon%2006.json',
  2: 'https://cdn.prod.website-files.com/6899a2f3f7995d5e3e31b7c6/68db86c6913c3a60d5253cff_CoMinVi%20-%20Icon%2007.json',
  3: 'https://cdn.prod.website-files.com/6899a2f3f7995d5e3e31b7c6/68db86c64f785b294dba99cd_CoMinVi%20-%20Icon%2008.json',
  4: 'https://cdn.prod.website-files.com/6899a2f3f7995d5e3e31b7c6/68db86c6913c3a60d5253d16_CoMinVi%20-%20Icon%2009.json',
  5: 'https://cdn.prod.website-files.com/6899a2f3f7995d5e3e31b7c6/68db86c666caf1a2edf01a39_CoMinVi%20-%20Icon%2010.json',
  6: 'https://cdn.prod.website-files.com/6899a2f3f7995d5e3e31b7c6/68db86c69287fd009887d761_CoMinVi%20-%20Icon%2001.json',
  7: 'https://cdn.prod.website-files.com/6899a2f3f7995d5e3e31b7c6/68db86c68ae2ca249e6dc2a3_CoMinVi%20-%20Icon%2002.json',
  8: 'https://cdn.prod.website-files.com/6899a2f3f7995d5e3e31b7c6/68db86c67409f539e5703fd4_CoMinVi%20-%20Icon%2003.json',
  9: 'https://cdn.prod.website-files.com/6899a2f3f7995d5e3e31b7c6/68db86c6e5660af13ca675fd_CoMinVi%20-%20Icon%2004%202.json',
  10: 'https://cdn.prod.website-files.com/6899a2f3f7995d5e3e31b7c6/68db86c68f1decbc32255f9d_CoMinVi%20-%20Icon%2005.json',
}

export function initIcons(root = document) {
  try {
    const scope = root && root.querySelector ? root : document
    // Ensure a globally accessible Lottie library from Webflow on every page
    try {
      const wf = typeof window !== 'undefined' ? window.Webflow : null
      const mod =
        wf && typeof wf.require === 'function' ? wf.require('lottie') : null
      const lib = (mod && (mod.lottie || mod)) || null
      if (lib && !window.lottie) window.lottie = lib
    } catch (e) {
      /* ignore */
    }
    try {
      scope && scope.getAttribute
        ? scope.getAttribute('data-barba-namespace')
        : null
    } catch (e) {
      /* ignore */
    }
    // hover binding is now enabled on all devices; desktop check removed

    const icons = Array.from(
      scope.querySelectorAll(
        '.service-card .service-icon_icon, .team-card .service-icon_icon, .stats-card .service-icon_icon, .service-card [data-lottie], .team-card [data-lottie], .stats-card [data-lottie]'
      )
    )

    // If none found yet (e.g., DOM not fully attached by Barba), watch container and retry once
    if (!icons.length && scope && scope.nodeType === 1) {
      try {
        if (
          !scope.__svcIconWaitObs &&
          typeof MutationObserver !== 'undefined'
        ) {
          const waitObs = new MutationObserver(() => {
            try {
              const found = scope.querySelector(
                '.service-card .service-icon_icon, .team-card .service-icon_icon, .stats-card .service-icon_icon'
              )
              if (found) {
                waitObs.disconnect()
                scope.__svcIconWaitObs = null
                // Re-enter init to bind icons now present
                initIcons(scope)
              }
            } catch (e) {
              /* ignore */
            }
          })
          waitObs.observe(scope, { childList: true, subtree: true })
          scope.__svcIconWaitObs = waitObs
        }
      } catch (e) {
        /* ignore */
      }
      return
    }

    const getAnim = (icon) => {
      // Try Webflow registry first
      try {
        const wf = typeof window !== 'undefined' ? window.Webflow : null
        const mod =
          wf && typeof wf.require === 'function' ? wf.require('lottie') : null
        const lottie = mod && mod.lottie
        const regs =
          (lottie &&
            typeof lottie.getRegisteredAnimations === 'function' &&
            lottie.getRegisteredAnimations()) ||
          []
        for (let i = 0; i < regs.length; i++) {
          const a = regs[i]
          const container = a.wrapper || a.container || a.renderer?.svg
          if (!container) continue
          const closest =
            typeof container.closest === 'function'
              ? container.closest('.service-icon_icon')
              : null
          if (
            closest === icon ||
            container === icon ||
            icon.contains(container)
          )
            return a
        }
      } catch (e) {
        // ignore
      }
      // Fallback to injected SVG handles
      try {
        const svg = icon.querySelector('svg')
        const inst = svg && (svg.__lottie || svg._lottie)
        if (inst)
          return inst.animation || (inst.animations && inst.animations[0])
      } catch (e) {
        // ignore
      }
      return null
    }

    const getLottieLib = () => {
      try {
        if (lottieWeb) return lottieWeb
      } catch (e) {
        /* ignore */
      }
      try {
        const wf = typeof window !== 'undefined' ? window.Webflow : null
        const mod =
          wf && typeof wf.require === 'function' ? wf.require('lottie') : null
        const lib = (mod && (mod.lottie || mod)) || (window && window.lottie)
        return lib || null
      } catch (e) {
        try {
          return window && window.lottie
        } catch (err) {
          return null
        }
      }
    }

    const recreateAnimation = (icon) => {
      try {
        const lottie = getLottieLib()
        // Resolve path from data-lottie (URL or id) or legacy WF attributes
        let path = null
        try {
          const dl = icon?.getAttribute?.('data-lottie')
          if (dl) {
            if (/^(https?:)?\/\//i.test(dl) || (dl && dl.startsWith('/')))
              path = dl
            else if (
              LOTTIE_URLS &&
              Object.prototype.hasOwnProperty.call(LOTTIE_URLS, dl)
            )
              path = LOTTIE_URLS[dl]
          }
        } catch (e) {
          /* ignore */
        }
        if (!path) {
          path =
            (icon && icon.getAttribute && icon.getAttribute('data-src')) ||
            (icon &&
              icon.getAttribute &&
              icon.getAttribute('data-animation-path')) ||
            null
        }
        if (!lottie || !path) return null
        // Normalize to absolute URL to avoid relative-path issues after SPA transitions
        let resolvedPath = path
        try {
          const isAbsolute =
            /^(https?:)?\/\//i.test(path) || (path && path.startsWith('/'))
          if (!isAbsolute) {
            const origin =
              (window && window.location && window.location.origin) || ''
            resolvedPath = origin + '/' + path.replace(/^\/+/, '')
          }
        } catch (e) {
          /* ignore */
        }
        // NOTE: We'll remove Webflow attributes only after successful create below
        try {
          while (icon.firstChild) icon.removeChild(icon.firstChild)
        } catch (e) {
          /* ignore */
        }
        const a = lottie.loadAnimation({
          container: icon,
          renderer: 'svg',
          loop: false,
          autoplay: false,
          path: resolvedPath,
        })
        // Now that we control the instance, prevent any re-init by Webflow and ensure visibility
        try {
          icon.removeAttribute && icon.removeAttribute('data-animation-type')
          icon.removeAttribute && icon.removeAttribute('data-autoplay')
          icon.removeAttribute && icon.removeAttribute('data-loop')
          icon.removeAttribute && icon.removeAttribute('data-w-id')
          icon.setAttribute('data-wf-ignore', 'true')
          icon.style && (icon.style.visibility = 'visible')
          icon.style && (icon.style.opacity = '1')
          icon.style && (icon.style.display = icon.style.display || 'block')
        } catch (e) {
          /* ignore */
        }
        // If the icon is invisible initially (page transition), wait for next frame to set baseline
        try {
          requestAnimationFrame(() => {
            try {
              a.goToAndStop(0, true)
            } catch (e) {
              /* ignore */
            }
          })
        } catch (e) {
          /* ignore */
        }
        try {
          a.addEventListener &&
            a.addEventListener('DOMLoaded', () => {
              try {
                a.goToAndStop(0, true)
              } catch (e) {
                /* ignore */
              }
            })
        } catch (e) {
          /* ignore */
        }
        return a
      } catch (e) {
        return null
      }
    }

    const bindIcon = (icon) => {
      if (!icon || icon.__svcIconBound) return
      const card =
        icon.closest('.service-card, .team-card, .stats-card') || icon
      // const debugId =
      //   icon.getAttribute('data-w-id') || icon.getAttribute('data-src') || ''

      const onReadyWrap = (anim, pendingRef) => {
        try {
          anim.goToAndStop(0, true)
        } catch (e) {
          // ignore
        }
        // Compute segments and speeds once frames are known
        let total = 0
        try {
          total = Math.max(0, Math.floor(anim.totalFrames || 0))
        } catch (e) {
          total = 0
        }
        // Default midpoint is 50%; allow per-icon override via data-lottie-mid
        let mid = 0.5
        try {
          const midAttr = icon?.getAttribute?.('data-lottie-mid')
          if (midAttr != null && midAttr !== '') {
            let v = parseFloat(midAttr)
            if (Number.isFinite(v)) {
              if (v > 1) v = v / 100 // allow 0-100 values
              if (v > 0 && v < 1) mid = v
            }
          }
        } catch (e) {
          /* ignore */
        }
        const firstEndFrame = Math.max(
          1,
          Math.min(total - 1, Math.floor(total * mid))
        )
        const secondStartFrame = firstEndFrame
        const secondEndFrame = Math.max(secondStartFrame, total - 1)
        // Uniform speeds; allow per-icon override
        let speedIn = 1
        let speedOut = 1
        try {
          const sIn = icon?.getAttribute?.('data-lottie-speed-in')
          const sOut = icon?.getAttribute?.('data-lottie-speed-out')
          const s = icon?.getAttribute?.('data-lottie-speed')
          if (s && Number.isFinite(parseFloat(s)) && parseFloat(s) > 0) {
            speedIn = speedOut = parseFloat(s)
          }
          if (sIn && Number.isFinite(parseFloat(sIn)) && parseFloat(sIn) > 0)
            speedIn = parseFloat(sIn)
          if (sOut && Number.isFinite(parseFloat(sOut)) && parseFloat(sOut) > 0)
            speedOut = parseFloat(sOut)
        } catch (e) {
          /* ignore */
        }
        const playFirst = () => {
          try {
            if (anim.__svcTOFirst) clearTimeout(anim.__svcTOFirst)
            if (anim.__svcTOReset) clearTimeout(anim.__svcTOReset)
          } catch (e) {
            /* ignore */
          }
          try {
            anim.stop()
          } catch (e) {
            /* ignore */
          }
          try {
            anim.setDirection(1)
            anim.setSpeed && anim.setSpeed(speedIn)
            anim.playSegments([0, firstEndFrame], true)
          } catch (e) {
            /* ignore */
          }
        }

        const playSecond = () => {
          try {
            if (anim.__svcTOFirst) clearTimeout(anim.__svcTOFirst)
            if (anim.__svcTOReset) clearTimeout(anim.__svcTOReset)
          } catch (e) {
            /* ignore */
          }
          try {
            anim.stop()
          } catch (e) {
            /* ignore */
          }
          try {
            anim.setDirection(1)
            anim.setSpeed && anim.setSpeed(speedOut)
            anim.playSegments([secondStartFrame, secondEndFrame], true)
          } catch (e) {
            /* ignore */
          }
        }

        if (!card.__svcIconHoverBound) {
          card.__svcIconEnter = playFirst
          card.__svcIconLeave = playSecond
          card.addEventListener('pointerenter', card.__svcIconEnter)
          card.addEventListener('mouseenter', card.__svcIconEnter)
          card.addEventListener('pointerleave', card.__svcIconLeave)
          card.addEventListener('mouseleave', card.__svcIconLeave)
          card.__svcIconHoverBound = true
        }

        if (pendingRef && pendingRef.pending === 'first') playFirst()
        else if (pendingRef && pendingRef.pending === 'second') playSecond()
        if (pendingRef) pendingRef.pending = null

        // Save current instance and watch for swaps (Webflow re-init replacing SVG/Lottie)
        try {
          icon.__svcAnim = anim
          if (!icon.__svcSwapObs && typeof MutationObserver !== 'undefined') {
            const swapObs = new MutationObserver(() => {
              try {
                const a2 = getAnim(icon)
                if (a2 && a2 !== icon.__svcAnim) {
                  icon.__svcAnim = a2
                  // Rebind: remove old listeners then bind new closures targeting a2
                  try {
                    if (card.__svcIconHoverBound) {
                      if (card.__svcIconEnter)
                        card.removeEventListener(
                          'pointerenter',
                          card.__svcIconEnter
                        )
                      if (card.__svcIconEnter)
                        card.removeEventListener(
                          'mouseenter',
                          card.__svcIconEnter
                        )
                      if (card.__svcIconLeave)
                        card.removeEventListener(
                          'pointerleave',
                          card.__svcIconLeave
                        )
                      if (card.__svcIconLeave)
                        card.removeEventListener(
                          'mouseleave',
                          card.__svcIconLeave
                        )
                      card.__svcIconHoverBound = false
                      card.__svcIconEnter = null
                      card.__svcIconLeave = null
                    }
                  } catch (e) {
                    /* ignore */
                  }
                  // Rebind only once the new instance has frames
                  const tryBindSwap = () => {
                    try {
                      if (Math.floor(a2.totalFrames || 0) <= 0) return false
                    } catch (e) {
                      /* ignore */
                    }
                    const bound = bindIcon(icon)
                    if (bound && bound.bind) bound.bind(a2, pendingRef)
                    return true
                  }
                  if (!tryBindSwap()) {
                    a2.addEventListener &&
                      a2.addEventListener('data_ready', tryBindSwap)
                    let triesSwap = 200
                    const pollSwap = () => {
                      if (tryBindSwap()) return
                      if (triesSwap-- > 0) setTimeout(pollSwap, 50)
                    }
                    pollSwap()
                  }
                }
              } catch (e) {
                /* ignore */
              }
            })
            swapObs.observe(icon, { childList: true, subtree: true })
            icon.__svcSwapObs = swapObs
          }
        } catch (e) {
          /* ignore */
        }
      }

      return { bind: onReadyWrap }
    }

    const list = icons || []
    list.forEach((icon) => {
      if (!icon || icon.__svcIconBound) return
      let anim = null
      try {
        // Prefer our own controlled instance to avoid Webflow defers
        if (!icon.__svcOwned) {
          const existing = getAnim(icon)
          try {
            existing &&
              typeof existing.destroy === 'function' &&
              existing.destroy()
          } catch (e) {
            /* ignore */
          }
          anim = recreateAnimation(icon)
          if (anim) {
            icon.__svcOwned = true
            icon.__svcAnim = anim
          }
        } else {
          anim = icon.__svcAnim || getAnim(icon)
        }
      } catch (e) {
        anim = getAnim(icon)
      }
      const pending = { pending: null }
      if (!anim) {
        // Wait for Webflow to inject the SVG/Lottie instance, then bind
        try {
          if (
            !icon.__svcIconObserver &&
            typeof MutationObserver !== 'undefined'
          ) {
            const obs = new MutationObserver(() => {
              try {
                const a = getAnim(icon)
                if (a) {
                  obs.disconnect()
                  icon.__svcIconObserver = null
                  const doBind = () => {
                    try {
                      if (icon.__svcIconBound) return
                      const framesNow = Math.floor(a.totalFrames || 0)
                      if (framesNow <= 0) return false
                      const bound = bindIcon(icon)
                      if (bound && bound.bind) {
                        bound.bind(a, pending)
                        try {
                          icon.__svcIconBound = true
                        } catch (e) {
                          /* ignore */
                        }
                      }
                      return true
                    } catch (e) {
                      return false
                    }
                  }
                  try {
                    const frames = Math.floor(a.totalFrames || 0)
                    if (frames > 0) doBind()
                    else {
                      a.addEventListener &&
                        a.addEventListener('data_ready', () => doBind())
                      let tries = 200
                      const poll = () => {
                        if (doBind()) return
                        if (tries-- > 0) setTimeout(poll, 50)
                      }
                      poll()
                    }
                  } catch (e) {
                    if (!doBind()) setTimeout(() => doBind(), 50)
                  }
                }
              } catch (e) {
                /* ignore */
              }
            })
            obs.observe(icon, { childList: true, subtree: true })
            icon.__svcIconObserver = obs
          } else {
            setTimeout(() => {
              try {
                const a = getAnim(icon)
                if (a) {
                  const doBind = () => {
                    try {
                      if (icon.__svcIconBound) return
                      const framesNow = Math.floor(a.totalFrames || 0)
                      if (framesNow <= 0) return false
                      const bound = bindIcon(icon)
                      if (bound && bound.bind) {
                        bound.bind(a, pending)
                        try {
                          icon.__svcIconBound = true
                        } catch (e) {
                          /* ignore */
                        }
                      }
                      return true
                    } catch (e) {
                      return false
                    }
                  }
                  try {
                    const frames = Math.floor(a.totalFrames || 0)
                    if (frames > 0) doBind()
                    else {
                      a.addEventListener &&
                        a.addEventListener('data_ready', () => doBind())
                      let tries = 200
                      const poll = () => {
                        if (doBind()) return
                        if (tries-- > 0) setTimeout(poll, 50)
                      }
                      poll()
                    }
                  } catch (e) {
                    if (!doBind()) setTimeout(() => doBind(), 50)
                  }
                }
              } catch (e) {
                /* ignore */
              }
            }, 100)
          }
        } catch (e) {
          /* ignore */
        }
        // No instance after waiting path → create our own
        try {
          anim = recreateAnimation(icon)
        } catch (e) {
          /* ignore */
        }
        if (!anim) {
          // Fallback: poll for Lottie library, then create and bind when available
          try {
            if (!icon.__svcLibRetrying) {
              icon.__svcLibRetrying = true
              let triesLib = 200
              const pollLib = () => {
                try {
                  const lib = getLottieLib()
                  if (lib) {
                    const a = recreateAnimation(icon)
                    if (a) {
                      icon.__svcOwned = true
                      icon.__svcAnim = a
                      // Bind once frames are ready
                      const bound = bindIcon(icon)
                      if (bound && bound.bind) {
                        const doBind = () => {
                          try {
                            const framesNow = Math.floor(a.totalFrames || 0)
                            if (framesNow <= 0) return false
                            bound.bind(a, pending)
                            try {
                              icon.__svcIconBound = true
                            } catch (e) {
                              /* ignore */
                            }
                            return true
                          } catch (e) {
                            return false
                          }
                        }
                        try {
                          const frames = Math.floor(a.totalFrames || 0)
                          if (frames > 0) doBind()
                          else {
                            a.addEventListener &&
                              a.addEventListener('data_ready', () => doBind())
                            let triesFrames = 200
                            const pollFrames = () => {
                              if (doBind()) return
                              if (triesFrames-- > 0) setTimeout(pollFrames, 50)
                            }
                            pollFrames()
                          }
                        } catch (e) {
                          if (!doBind()) setTimeout(() => doBind(), 50)
                        }
                      }
                      icon.__svcLibRetrying = false
                      return
                    }
                  }
                } catch (e) {
                  /* ignore */
                }
                if (triesLib-- > 0) setTimeout(pollLib, 50)
                else icon.__svcLibRetrying = false
              }
              pollLib()
            }
          } catch (e) {
            /* ignore */
          }
          return
        }
      }

      let isReady = false
      try {
        const onReady = () => {
          if (isReady) return
          // Defer bind until frames are available
          const doBind = () => {
            try {
              if (isReady || icon.__svcIconBound) return
              const framesNow = Math.floor(anim.totalFrames || 0)
              if (framesNow <= 0) return false
              isReady = true
              const bound = bindIcon(icon)
              if (!bound || !bound.bind) return true
              bound.bind(anim, pending)
              try {
                icon.__svcIconBound = true
              } catch (e) {
                /* ignore */
              }
              return true
            } catch (e) {
              return false
            }
          }
          try {
            const frames = Math.floor(anim.totalFrames || 0)
            if (frames > 0) return void doBind()
            anim.addEventListener &&
              anim.addEventListener('data_ready', () => doBind())
            let tries = 200
            const poll = () => {
              if (doBind()) return
              if (tries-- > 0) setTimeout(poll, 50)
            }
            poll()
          } catch (e) {
            if (!doBind()) setTimeout(() => doBind(), 50)
          }
        }
        anim.addEventListener && anim.addEventListener('DOMLoaded', onReady)
        anim.addEventListener && anim.addEventListener('data_ready', onReady)
        if (anim.isLoaded || anim.isReady || anim.__isLoaded) onReady()
        if (!isReady) {
          let tries = 40
          const poll = () => {
            try {
              if (Math.floor(anim.totalFrames || 0) > 0) return onReady()
            } catch (e) {
              /* ignore */
            }
            if (tries-- > 0) setTimeout(poll, 50)
            else onReady()
          }
          poll()
        }
      } catch (e) {
        // ignore
      }

      icon.__svcLottieBound = true
    })
  } catch (e) {
    /* ignore */
  }
}

// Reset all Lottie icons inside service/team cards to frame 0 after transitions
export function resetServiceCardIcons(root = document) {
  try {
    const scope = root && root.querySelector ? root : document
    const icons = Array.from(
      scope.querySelectorAll(
        '.service-card .service-icon_icon, .team-card .service-icon_icon, .stats-card .service-icon_icon'
      )
    )
    if (!icons.length) return

    const getAnimForIcon = (icon) => {
      try {
        const wf = typeof window !== 'undefined' ? window.Webflow : null
        const mod =
          wf && typeof wf.require === 'function' ? wf.require('lottie') : null
        const lottie = mod && mod.lottie
        const regs =
          (lottie &&
            typeof lottie.getRegisteredAnimations === 'function' &&
            lottie.getRegisteredAnimations()) ||
          []
        for (let i = 0; i < regs.length; i++) {
          const a = regs[i]
          const container = a.wrapper || a.container || a.renderer?.svg
          if (!container) continue
          const closest =
            typeof container.closest === 'function'
              ? container.closest('.service-icon_icon')
              : null
          if (
            closest === icon ||
            container === icon ||
            icon.contains(container)
          )
            return a
        }
      } catch (e) {
        /* ignore */
      }
      try {
        const svg = icon.querySelector('svg')
        const inst = svg && (svg.__lottie || svg._lottie)
        if (inst)
          return inst.animation || (inst.animations && inst.animations[0])
      } catch (e) {
        /* ignore */
      }
      return null
    }

    icons.forEach((icon) => {
      try {
        const anim = getAnimForIcon(icon)
        if (!anim) return
        try {
          if (anim.__svcRaf) cancelAnimationFrame(anim.__svcRaf)
        } catch (e) {
          /* ignore */
        }
        try {
          anim.autoplay = false
          anim.loop = false
          icon.setAttribute('data-autoplay', '0')
          icon.setAttribute('data-loop', '0')
        } catch (e) {
          /* ignore */
        }
        try {
          anim.setSpeed && anim.setSpeed(1)
        } catch (e) {
          /* ignore */
        }
        try {
          anim.stop()
        } catch (e) {
          /* ignore */
        }
        try {
          anim.goToAndStop(0, true)
        } catch (e) {
          /* ignore */
        }
      } catch (e) {
        /* ignore */
      }
    })
  } catch (e) {
    /* ignore */
  }
}

// Remove hover listeners, observers, and destroy Lottie instances for icons in scope
export function destroyIcons(root = document) {
  try {
    const scope = root && root.querySelector ? root : document
    const cards = Array.from(
      scope.querySelectorAll('.service-card, .team-card')
    )
    cards.forEach((card) => {
      try {
        if (card.__svcIconHoverBound) {
          if (card.__svcIconEnter)
            card.removeEventListener('pointerenter', card.__svcIconEnter)
          if (card.__svcIconEnter)
            card.removeEventListener('mouseenter', card.__svcIconEnter)
          if (card.__svcIconLeave)
            card.removeEventListener('pointerleave', card.__svcIconLeave)
          if (card.__svcIconLeave)
            card.removeEventListener('mouseleave', card.__svcIconLeave)
          card.__svcIconHoverBound = false
          card.__svcIconEnter = null
          card.__svcIconLeave = null
        }
      } catch (e) {
        /* ignore */
      }
    })

    const icons = Array.from(
      scope.querySelectorAll(
        '.service-card .service-icon_icon, .team-card .service-icon_icon, .stats-card .service-icon_icon'
      )
    )
    const getAnimForIcon = (icon) => {
      try {
        const wf = typeof window !== 'undefined' ? window.Webflow : null
        const mod =
          wf && typeof wf.require === 'function' ? wf.require('lottie') : null
        const lottie = mod && mod.lottie
        const regs =
          (lottie &&
            typeof lottie.getRegisteredAnimations === 'function' &&
            lottie.getRegisteredAnimations()) ||
          []
        for (let i = 0; i < regs.length; i++) {
          const a = regs[i]
          const container = a.wrapper || a.container || a.renderer?.svg
          if (!container) continue
          const closest =
            typeof container.closest === 'function'
              ? container.closest('.service-icon_icon')
              : null
          if (
            closest === icon ||
            container === icon ||
            icon.contains(container)
          )
            return a
        }
      } catch (e) {
        /* ignore */
      }
      try {
        const svg = icon.querySelector('svg')
        const inst = svg && (svg.__lottie || svg._lottie)
        if (inst)
          return inst.animation || (inst.animations && inst.animations[0])
      } catch (e) {
        /* ignore */
      }
      return null
    }

    icons.forEach((icon) => {
      try {
        if (icon.__svcSwapObs && icon.__svcSwapObs.disconnect) {
          icon.__svcSwapObs.disconnect()
        }
        icon.__svcSwapObs = null
        if (icon.__svcIconObserver && icon.__svcIconObserver.disconnect) {
          icon.__svcIconObserver.disconnect()
        }
        icon.__svcIconObserver = null
        try {
          icon.removeAttribute && icon.removeAttribute('data-animation-type')
          icon.removeAttribute && icon.removeAttribute('data-autoplay')
          icon.removeAttribute && icon.removeAttribute('data-loop')
          icon.removeAttribute && icon.removeAttribute('data-w-id')
          icon.setAttribute && icon.setAttribute('data-wf-ignore', 'true')
        } catch (e) {
          /* ignore */
        }
        const anim = getAnimForIcon(icon)
        if (anim) {
          try {
            anim.stop && anim.stop()
          } catch (e) {
            /* ignore */
          }
          try {
            if (typeof anim.destroy === 'function') anim.destroy()
          } catch (e) {
            /* ignore */
          }
        }
        // Clear DOM children to avoid duplicates on re-init and ensure visibility
        try {
          while (icon.firstChild) icon.removeChild(icon.firstChild)
          icon.style && (icon.style.visibility = 'visible')
          icon.style && (icon.style.opacity = '1')
          icon.style && (icon.style.display = icon.style.display || 'block')
        } catch (e) {
          /* ignore */
        }
        icon.__svcIconBound = false
        icon.__svcLottieBound = false
        icon.__svcOwned = false
        icon.__svcAnim = null
      } catch (e) {
        /* ignore */
      }
    })
  } catch (e) {
    /* ignore */
  }
}
