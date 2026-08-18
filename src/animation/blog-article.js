import { initParallax, initHeroBlogImageParallax } from './parallax.js'

export function blogArticleInit(root = document) {
  // Scope to Article page via Barba namespace
  try {
    const container = root && root.nodeType === 1 ? root : document
    const isSelfArticle =
      container &&
      container.getAttribute &&
      container.getAttribute('data-barba-namespace') === 'article'
    const page = isSelfArticle
      ? container
      : container.querySelector('[data-barba-namespace="article"]')
    if (!page) return
    root = page
  } catch (err) {
    return
  }

  // Format dates inside .section_blog-inner like on Blog list: trim and break line after comma
  const applyDateFormat = (scope) => {
    try {
      const section =
        (scope &&
          scope.querySelector &&
          scope.querySelector('.section_blog-inner')) ||
        scope ||
        document
      const dateEls = Array.from(
        (section || document).querySelectorAll('.blog-date .eyebrow-m')
      )
      dateEls.forEach((element) => {
        try {
          if (element.dataset.abbrevApplied === '1') return
          const raw = element.textContent || ''
          const cleaned = raw.replace(/\s+/g, ' ').trim()
          if (!cleaned) return
          const match = cleaned.match(/^(\s*)(\S+)([\s\S]*)$/)
          if (!match) return
          const prefix = match[1] || ''
          const firstWord = match[2] || ''
          const tail = match[3] || ''
          const abbreviated = firstWord.slice(0, 3)
          let result = prefix + abbreviated + tail
          result = result.replace(/,\s*/, ',<br> ')
          element.innerHTML = result
          element.dataset.abbrevApplied = '1'
        } catch (e) {
          // ignore
        }
      })
    } catch (e) {
      // ignore
    }
  }

  // Split related article titles into visual lines
  const splitTitles = (scope) => {
    try {
      const s = scope && scope.nodeType === 1 ? scope : document
      const container = s.querySelector('.section_blog-inner') || s
      const titles = Array.from(
        container.querySelectorAll('.blog-name > h2.body-l')
      )
      titles.forEach((title) => {
        try {
          if (title.dataset.linesSplit) return
          const originalText = title.textContent || ''
          const words = originalText.split(/\s+/)
          title.textContent = ''
          words.forEach((word, idx) => {
            const w = document.createElement('span')
            w.className = 'blogline-word'
            w.textContent = word
            title.appendChild(w)
            if (idx < words.length - 1)
              title.appendChild(document.createTextNode(' '))
          })

          requestAnimationFrame(() => {
            try {
              const wordEls = Array.from(
                title.querySelectorAll('.blogline-word')
              )
              if (!wordEls.length) return
              let currentTop = null
              let lineWrap = null
              wordEls.forEach((wEl) => {
                const top = wEl.offsetTop
                if (currentTop === null || Math.abs(top - currentTop) > 1) {
                  currentTop = top
                  lineWrap = document.createElement('span')
                  lineWrap.className = 'blogline-line'
                  title.insertBefore(lineWrap, wEl)
                }
                lineWrap.appendChild(wEl)
                const next = lineWrap.nextSibling
                if (
                  wEl.nextSibling &&
                  wEl.nextSibling.nodeType === Node.TEXT_NODE
                ) {
                  lineWrap.appendChild(wEl.nextSibling)
                } else if (next && next.nodeType === Node.TEXT_NODE) {
                  lineWrap.appendChild(next)
                }
              })
              title.dataset.linesSplit = 'true'
            } catch (err) {
              // ignore
            }
          })
        } catch (err) {
          // ignore
        }
      })
    } catch (err) {
      // ignore
    }
  }

  try {
    const relatedSection = root.querySelector('.section_blog-inner.is-related')
    if (relatedSection && !relatedSection.querySelector('.w-dyn-item')) {
      relatedSection.setAttribute('hidden', '')
    }

    // Apply once on init
    applyDateFormat(root)
    splitTitles(root)
    // Tag RTE images inside figures for parallax and ensure proper class
    try {
      const scope = root && root.nodeType === 1 ? root : document
      const imgs = scope.querySelectorAll(
        '.w-richtext figure > div > img, .w-richtext figure.w-richtext-align-fullwidth > div > img'
      )
      imgs.forEach((img) => {
        try {
          if (!img.classList.contains('image-p')) img.classList.add('image-p')
          const wrapper = img.parentElement
          if (
            wrapper &&
            wrapper.classList &&
            !wrapper.classList.contains('image-wrapper')
          ) {
            wrapper.classList.add('image-wrapper')
          }
        } catch (e) {
          // ignore per-image
        }
      })
      // Re-init global parallax now that images are tagged
      try {
        initParallax(root)
        initHeroBlogImageParallax(root)
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // ignore
    }

    // Hover cursor that follows mouse on related blog items (article page)
    try {
      const scope = root && root.nodeType === 1 ? root : document
      const container = scope.querySelector('.section_blog-inner') || scope
      let items = Array.from(container.querySelectorAll('.blog-main_item'))
      const cursor = document.querySelector('.cursor-pointer')

      if (cursor) {
        cursor.style.display = 'none'
        try {
          cursor.style.pointerEvents = 'none'
        } catch (e) {
          // ignore
        }
        try {
          const inner =
            cursor.querySelector('.cursor-pointer_inner') ||
            cursor.firstElementChild
          if (inner) {
            const current = getComputedStyle(inner).transition || ''
            if (!/transform/.test(current)) {
              inner.style.transition =
                (current ? current + ', ' : '') +
                'transform 300ms cubic-bezier(0.6, 0, 0, 1)'
            }
            inner.style.transform = 'translateY(100%)'

            const prevVis = cursor.style.visibility
            const prevDisp = cursor.style.display
            const wasHidden = getComputedStyle(cursor).display === 'none'
            if (wasHidden) {
              cursor.style.visibility = 'hidden'
              cursor.style.display = 'flex'
            }
            const rect = inner.getBoundingClientRect()
            cursor.dataset.__cursorInnerW = String(Math.ceil(rect.width))
            cursor.dataset.__cursorInnerH = String(Math.ceil(rect.height))
            if (wasHidden) {
              cursor.style.display = prevDisp || 'none'
              cursor.style.visibility = prevVis || ''
            }
          }
        } catch (e) {
          // ignore
        }
      }

      if (items.length && cursor) {
        let offsetPx = 8
        let endHandler = null

        const computeOffset = () => {
          try {
            const fs = parseFloat(getComputedStyle(cursor).fontSize) || 16
            offsetPx = 1 * fs
          } catch (e) {
            offsetPx = 8
          }
        }
        computeOffset()

        const onEnter = () => {
          const inner =
            cursor.querySelector('.cursor-pointer_inner') ||
            cursor.firstElementChild
          try {
            const w = cursor.dataset.__cursorInnerW
            const h = cursor.dataset.__cursorInnerH
            if (w) cursor.style.width = w + 'px'
            if (h) cursor.style.height = h + 'px'
          } catch (e) {
            // ignore
          }
          cursor.style.display = 'flex'
          if (inner) {
            if (endHandler) {
              try {
                inner.removeEventListener('transitionend', endHandler)
              } catch (e) {
                // ignore
              }
              endHandler = null
            }
            inner.style.transform = 'translateY(100%)'
            void inner.getBoundingClientRect()
            inner.style.transform = 'translateY(0)'
          }
        }

        const onLeave = () => {
          const inner =
            cursor.querySelector('.cursor-pointer_inner') ||
            cursor.firstElementChild
          if (inner) {
            endHandler = () => {
              cursor.style.display = 'none'
              try {
                inner.removeEventListener('transitionend', endHandler)
              } catch (e) {
                // ignore
              }
              endHandler = null
              inner.style.transform = 'translateY(100%)'
            }
            inner.addEventListener('transitionend', endHandler, { once: true })
            inner.style.transform = 'translateY(100%)'
          } else {
            cursor.style.display = 'none'
          }
        }

        const onMove = (e) => {
          cursor.style.left = e.pageX + offsetPx + 'px'
          cursor.style.top = e.pageY + offsetPx + 'px'
        }

        const bindItem = (el) => {
          if (!el || el.dataset.cursorBound === '1') return
          el.addEventListener('mouseenter', onEnter)
          el.addEventListener('mouseleave', onLeave)
          el.addEventListener('mousemove', onMove)
          el.dataset.cursorBound = '1'
        }

        items.forEach((el) => bindItem(el))

        try {
          const mo = new MutationObserver((mutations) => {
            mutations.forEach((m) => {
              m.addedNodes.forEach((n) => {
                if (!(n && n.nodeType === 1)) return
                if (n.classList && n.classList.contains('blog-main_item')) {
                  bindItem(n)
                }
                const found = n.querySelectorAll
                  ? n.querySelectorAll('.blog-main_item')
                  : []
                found.forEach((child) => bindItem(child))
              })
            })
          })
          mo.observe(container, { childList: true, subtree: true })
        } catch (e) {
          // ignore
        }

        window.addEventListener('resize', computeOffset)
      }
    } catch (e) {
      // ignore
    }
    // Apply once more on next frame to account for layout
    try {
      requestAnimationFrame(() => {
        try {
          applyDateFormat(root)
          splitTitles(root)
          // Refresh parallax once layout is stable
          try {
            initParallax(root)
            initHeroBlogImageParallax(root)
          } catch (e) {
            // ignore
          }
        } catch (err) {
          // ignore
        }
      })
    } catch (err) {
      // ignore
    }
  } catch (e) {
    // ignore
  }
}
