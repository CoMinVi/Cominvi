// Maintient les éléments .video-clip-inner à 8em du haut du viewport via transform
// Sans utiliser position: sticky. Compatible avec Lenis (calcul via getBoundingClientRect).

function pxFromEm(em = 2) {
  try {
    // Aligné sur Webflow: 1em correspond à la font-size de body
    const body = document.body || document.documentElement
    const bodyFontSize = parseFloat(getComputedStyle(body).fontSize)
    if (!Number.isNaN(bodyFontSize) && bodyFontSize > 0)
      return em * bodyFontSize
    // Fallback: font-size du root
    const root = document.documentElement
    const rootFontSize = parseFloat(getComputedStyle(root).fontSize)
    if (!Number.isNaN(rootFontSize) && rootFontSize > 0)
      return em * rootFontSize
  } catch (e) {
    // ignore
  }
  return em * 16
}

function isMobileViewport() {
  try {
    if (window.matchMedia) {
      if (window.matchMedia('(max-width: 767px)').matches) return true
      if (window.matchMedia('(hover: none) and (pointer: coarse)').matches)
        return true
    }
  } catch (e) {
    // ignore
  }
  return false
}

function ensureState() {
  if (!window.__videoClipSticky) {
    window.__videoClipSticky = {
      rafId: null,
      items: new Set(),
      running: false,
      offsetPx: pxFromEm(2),
      resizeHandler: null,
      breakpointHandler: null,
      firstVideo: null,
      lastVideo: null,
      firstFixedApplied: false,
      lastFixedRemoved: false,
      prevFirstTop: null,
      prevLastTop: null,
      processVideoObserver: null,
      processVideos: [],
    }
  }
  return window.__videoClipSticky
}

function collectProcessVideos(root = document) {
  const scope = root && root.querySelector ? root : document
  const candidates = new Set()
  try {
    const directVideos = scope.querySelectorAll('.processes .video video')
    directVideos.forEach((video) => candidates.add(video))
    const allProcessVideos = scope.querySelectorAll('.processes video')
    allProcessVideos.forEach((video) => candidates.add(video))
  } catch (e) {
    // ignore
  }
  return Array.from(candidates).filter(
    (video) => video && typeof video.play === 'function'
  )
}

function pauseProcessVideo(video) {
  try {
    if (video && typeof video.pause === 'function') video.pause()
  } catch (e) {
    // ignore
  }
}

function playProcessVideo(video) {
  try {
    if (!video) return
    video.muted = true
    video.playsInline = true
    video.setAttribute('muted', '')
    video.setAttribute('playsinline', '')
    const playPromise = video.play && video.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {})
    }
  } catch (e) {
    // ignore
  }
}

function destroyProcessVideosVisibilityObserver() {
  const state = ensureState()
  try {
    if (
      state.processVideoObserver &&
      typeof state.processVideoObserver.disconnect === 'function'
    ) {
      state.processVideoObserver.disconnect()
    }
  } catch (e) {
    // ignore
  }
  try {
    ;(state.processVideos || []).forEach((video) => pauseProcessVideo(video))
  } catch (e) {
    // ignore
  }
  state.processVideoObserver = null
  state.processVideos = []
}

function initProcessVideosVisibilityObserver(root = document) {
  destroyProcessVideosVisibilityObserver()
  if (typeof IntersectionObserver === 'undefined') return
  const state = ensureState()
  const videos = collectProcessVideos(root)
  if (!videos.length) return

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target
        if (!video || !video.isConnected) return
        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
          playProcessVideo(video)
        } else {
          pauseProcessVideo(video)
        }
      })
    },
    {
      root: null,
      rootMargin: '0px 0px -8% 0px',
      threshold: [0, 0.2, 0.35, 0.6, 1],
    }
  )

  videos.forEach((video) => {
    pauseProcessVideo(video)
    observer.observe(video)
  })

  state.processVideoObserver = observer
  state.processVideos = videos
}

function getNodeScaleY(node) {
  try {
    const t = getComputedStyle(node).transform
    if (!t || t === 'none') return 1
    if (t.startsWith('matrix3d')) {
      const values = t
        .slice(9, -1)
        .split(',')
        .map((v) => parseFloat(v.trim()))
      if (values.length === 16) {
        const m5 = values[4]
        const m6 = values[5]
        const m7 = values[6]
        const scaleY = Math.sqrt(m5 * m5 + m6 * m6 + m7 * m7)
        return scaleY || 1
      }
      return 1
    }
    if (t.startsWith('matrix(')) {
      const values = t
        .slice(7, -1)
        .split(',')
        .map((v) => parseFloat(v.trim()))
      // matrix(a, b, c, d, e, f) → d ~ scaleY when no skew; otherwise use sqrt(b^2 + d^2)
      if (values.length >= 4) {
        const b = values[1]
        const d = values[3]
        const scaleY = Math.sqrt(b * b + d * d) || 1
        return scaleY
      }
      return 1
    }
    return 1
  } catch (e) {
    return 1
  }
}

function getEffectiveScaleY(el) {
  let scale = 1
  try {
    let node = el
    while (node && node !== document && node !== document.documentElement) {
      scale *= getNodeScaleY(node)
      node = node.parentElement || node.parentNode
    }
  } catch (e) {
    // ignore
  }
  return scale || 1
}

function registerVideoInners(state, videoEl) {
  try {
    if (!videoEl) return
    const inners = videoEl.querySelectorAll('.video-clip-inner')
    inners.forEach((inner) => {
      let exists = false
      state.items.forEach((it) => {
        if (it.el === inner) exists = true
      })
      if (!exists) {
        const scaleY = getEffectiveScaleY(inner)
        try {
          inner.style.willChange = 'transform'
        } catch (e) {
          // ignore
        }
        state.items.add({ el: inner, lastY: NaN, scaleY })
      }
    })
  } catch (e) {
    // ignore
  }
}

function unregisterVideoInners(state, videoEl) {
  try {
    if (!videoEl) return
    const toRemove = []
    state.items.forEach((it) => {
      try {
        if (videoEl.contains && videoEl.contains(it.el)) toRemove.push(it)
      } catch (e) {
        // ignore
      }
    })
    toRemove.forEach((it) => {
      try {
        if (it.el) {
          it.el.style.transform = ''
          it.el.style.willChange = ''
        }
      } catch (e) {
        // ignore
      }
      try {
        state.items.delete(it)
      } catch (e) {
        // ignore
      }
    })
  } catch (e) {
    // ignore
  }
}

function getContentTopOffsetPx() {
  try {
    const wrapper =
      window.__lenisWrapper || document.querySelector('.page-wrap') || null
    if (!wrapper) return 0
    const topStr = getComputedStyle(wrapper).top
    if (!topStr || topStr === 'auto') return 0
    const topPx = parseFloat(topStr)
    return Number.isFinite(topPx) ? topPx : 0
  } catch (e) {
    return 0
  }
}

// Calcule la translation CSS à appliquer (en px CSS) pour amener le top à offsetPx
function computeTranslateCssY(el, lastCssY, offsetPx, scaleY) {
  try {
    const rect = el.getBoundingClientRect()
    const prevAppliedViewportDelta = Number.isFinite(lastCssY)
      ? lastCssY * scaleY
      : 0
    const baseTop = rect.top - prevAppliedViewportDelta
    const deltaViewport = offsetPx - baseTop
    const cssY = deltaViewport / (scaleY || 1)
    const dpr = window.devicePixelRatio || 1
    return Math.round(cssY * dpr) / dpr
  } catch (e) {
    return 0
  }
}

function startLoop() {
  const state = ensureState()
  if (state.running) return
  state.running = true

  const tick = () => {
    try {
      // Recalcule l'offset au cas où le root font-size change (responsive)
      const base = pxFromEm(2)
      const contentTop = getContentTopOffsetPx()
      state.offsetPx = base + contentTop
      // Direction-aware toggles for first/last at threshold (2em + top .page-wrap)
      try {
        const threshold = state.offsetPx
        // Small hysteresis to avoid fixed/unfixed oscillation around the threshold.
        const eps = 1
        if (state.firstVideo && state.firstVideo.isConnected) {
          const curr = state.firstVideo.getBoundingClientRect().top
          const prev = state.prevFirstTop
          if (prev !== null) {
            const delta = curr - prev
            if (delta < 0 && prev > threshold + eps && curr <= threshold) {
              // Downward crossing → add
              try {
                state.firstVideo.classList.add('is-fixed')
              } catch (e) {
                state.firstVideo.className += ' is-fixed'
              }
              registerVideoInners(state, state.firstVideo)
              state.firstFixedApplied = true
            } else if (
              delta > 0 &&
              prev < threshold - eps &&
              curr >= threshold
            ) {
              // Upward crossing → remove
              try {
                state.firstVideo.classList.remove('is-fixed')
              } catch (e) {
                state.firstVideo.className = (state.firstVideo.className || '')
                  .replace(/\bis-fixed\b/, '')
                  .trim()
              }
              unregisterVideoInners(state, state.firstVideo)
              state.firstFixedApplied = false
            }
          }
          state.prevFirstTop = curr
        }
        if (state.lastVideo && state.lastVideo.isConnected) {
          const curr = state.lastVideo.getBoundingClientRect().top
          const prev = state.prevLastTop
          const isFixedLast =
            !!(
              state.lastVideo.classList &&
              state.lastVideo.classList.contains('is-fixed')
            ) || (state.lastVideo.className || '').indexOf('is-fixed') !== -1
          if (prev !== null) {
            const delta = curr - prev
            if (delta < 0 && prev > threshold + eps && curr <= threshold) {
              // Downward crossing → remove
              if (isFixedLast) {
                try {
                  state.lastVideo.classList.remove('is-fixed')
                } catch (e) {
                  state.lastVideo.className = (state.lastVideo.className || '')
                    .replace(/\bis-fixed\b/, '')
                    .trim()
                }
              }
              unregisterVideoInners(state, state.lastVideo)
              state.lastFixedRemoved = true
            } else if (
              delta > 0 &&
              prev < threshold - eps &&
              curr >= threshold
            ) {
              // Upward crossing → add
              try {
                state.lastVideo.classList.add('is-fixed')
              } catch (e) {
                state.lastVideo.className += ' is-fixed'
              }
              registerVideoInners(state, state.lastVideo)
              state.lastFixedRemoved = false
            }
          }
          state.prevLastTop = curr
        }
      } catch (e) {
        // ignore
      }
      state.items.forEach((entry) => {
        const { el, scaleY } = entry
        if (!el || !el.isConnected) return
        // Appliquer seulement si l'élément est dans .video.is-fixed
        let isFixed = false
        try {
          const video = el.closest ? el.closest('.video') : null
          isFixed = !!(
            video &&
            video.classList &&
            video.classList.contains('is-fixed')
          )
        } catch (e) {
          isFixed = false
        }
        if (!isFixed) {
          if (Number.isFinite(entry.lastY)) {
            el.style.transform = ''
            entry.lastY = NaN
          }
          return
        }
        const y = computeTranslateCssY(
          el,
          entry.lastY,
          state.offsetPx,
          scaleY || 1
        )
        // Force: on remplace le transform pour assurer la position exacte
        const minStep = 1 / (window.devicePixelRatio || 1)
        if (
          !Number.isFinite(entry.lastY) ||
          Math.abs(y - entry.lastY) >= minStep
        ) {
          el.style.transform = `translate3d(0, ${y}px, 0)`
          entry.lastY = y
        }
      })
    } catch (e) {
      // ignore frame errors
    }
    state.rafId = requestAnimationFrame(tick)
  }
  state.rafId = requestAnimationFrame(tick)
}

function stopLoopIfIdle() {
  const state = ensureState()
  if (state.items.size === 0 && state.running) {
    try {
      cancelAnimationFrame(state.rafId)
    } catch (e) {
      // ignore
    }
    state.rafId = null
    state.running = false
  }
}

export function initVideoClipStickyTransform(root = document) {
  const state = ensureState()
  const scope = root && root.querySelector ? root : document
  initProcessVideosVisibilityObserver(scope)
  // Gestion responsive: désactive sur mobile et réactive au changement de breakpoint
  try {
    if (state.breakpointHandler) {
      window.removeEventListener('resize', state.breakpointHandler)
      window.removeEventListener('orientationchange', state.breakpointHandler)
    }
  } catch (e) {
    // ignore
  }
  const startIsMobile = isMobileViewport()
  state.breakpointHandler = (() => {
    let wasMobile = startIsMobile
    return () => {
      const nowMobile = isMobileViewport()
      if (nowMobile === wasMobile) return
      wasMobile = nowMobile
      if (nowMobile) {
        try {
          destroyVideoClipStickyTransform()
        } catch (e) {
          // ignore
        }
      } else {
        try {
          initVideoClipStickyTransform(document)
        } catch (e) {
          // ignore
        }
      }
    }
  })()
  window.addEventListener('resize', state.breakpointHandler)
  window.addEventListener('orientationchange', state.breakpointHandler)

  if (startIsMobile) {
    // Désactivation complète sur mobile
    destroyVideoClipStickyTransform()
    return []
  }
  const els = scope.querySelectorAll('.video.is-fixed .video-clip-inner')
  // Références pour les toggles auto first/last
  try {
    state.firstVideo =
      scope.querySelector('.video[data-video="first"]') ||
      document.querySelector('.video[data-video="first"]') ||
      null
  } catch (e) {
    state.firstVideo = null
  }
  try {
    state.lastVideo =
      scope.querySelector('.video[data-video="last"]') ||
      document.querySelector('.video[data-video="last"]') ||
      null
  } catch (e) {
    state.lastVideo = null
  }
  state.prevFirstTop = state.firstVideo
    ? state.firstVideo.getBoundingClientRect().top
    : null
  state.prevLastTop = state.lastVideo
    ? state.lastVideo.getBoundingClientRect().top
    : null
  state.firstFixedApplied = !!(
    state.firstVideo &&
    state.firstVideo.classList &&
    state.firstVideo.classList.contains('is-fixed')
  )
  state.lastFixedRemoved = false

  // Applique immédiatement l'état sticky en fonction de la position courante
  try {
    const threshold = pxFromEm(2) + getContentTopOffsetPx()
    if (state.firstVideo && state.firstVideo.isConnected) {
      const top = state.firstVideo.getBoundingClientRect().top
      if (top <= threshold) {
        try {
          state.firstVideo.classList.add('is-fixed')
        } catch (e) {
          state.firstVideo.className += ' is-fixed'
        }
        registerVideoInners(state, state.firstVideo)
        state.firstFixedApplied = true
      } else {
        try {
          state.firstVideo.classList.remove('is-fixed')
        } catch (e) {
          state.firstVideo.className = (state.firstVideo.className || '')
            .replace(/\bis-fixed\b/, '')
            .trim()
        }
        unregisterVideoInners(state, state.firstVideo)
        state.firstFixedApplied = false
      }
    }
    if (state.lastVideo && state.lastVideo.isConnected) {
      const top = state.lastVideo.getBoundingClientRect().top
      // is-fixed pour la dernière: true lorsque au-dessus du seuil, sinon false
      if (top > threshold) {
        try {
          state.lastVideo.classList.add('is-fixed')
        } catch (e) {
          state.lastVideo.className += ' is-fixed'
        }
        registerVideoInners(state, state.lastVideo)
        state.lastFixedRemoved = false
      } else {
        try {
          state.lastVideo.classList.remove('is-fixed')
        } catch (e) {
          state.lastVideo.className = (state.lastVideo.className || '')
            .replace(/\bis-fixed\b/, '')
            .trim()
        }
        unregisterVideoInners(state, state.lastVideo)
        state.lastFixedRemoved = true
      }
    }
  } catch (e) {
    // ignore
  }
  if (!els || !els.length) {
    stopLoopIfIdle()
    return []
  }

  const added = []
  els.forEach((el) => {
    try {
      // Évite les doublons: on garde un Set d'éléments
      let alreadyTracked = false
      state.items.forEach((it) => {
        if (it.el === el) alreadyTracked = true
      })
      if (alreadyTracked) return

      // Cache l'échelle effective Y et active will-change une seule fois
      const scaleY = getEffectiveScaleY(el)
      try {
        el.style.willChange = 'transform'
      } catch (e) {
        // ignore
      }
      state.items.add({ el, lastY: NaN, scaleY })
      added.push(el)
    } catch (e) {
      // ignore this element
    }
  })

  if (state.items.size) startLoop()

  // Gère la mise à jour des échelles en cas de resize
  try {
    if (state.resizeHandler)
      window.removeEventListener('resize', state.resizeHandler)
  } catch (e) {
    // ignore
  }
  state.resizeHandler = (() => {
    let timer
    return () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        state.items.forEach((entry) => {
          try {
            entry.scaleY = getEffectiveScaleY(entry.el)
          } catch (e) {
            entry.scaleY = 1
          }
        })
      }, 100)
    }
  })()
  window.addEventListener('resize', state.resizeHandler)
  return added
}

export function destroyVideoClipStickyTransform() {
  const state = ensureState()
  destroyProcessVideosVisibilityObserver()
  try {
    state.items.forEach((it) => {
      if (it && it.el) {
        it.el.style.transform = ''
        it.el.style.willChange = ''
      }
    })
  } catch (e) {
    // ignore
  }
  state.items.clear()
  try {
    if (state.resizeHandler) {
      window.removeEventListener('resize', state.resizeHandler)
      state.resizeHandler = null
    }
  } catch (e) {
    // ignore
  }
  stopLoopIfIdle()
}
