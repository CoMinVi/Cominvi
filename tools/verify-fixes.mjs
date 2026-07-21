import { chromium } from 'playwright'
import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { extname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = join(__dirname, '..')
const dist = join(root, 'dist')
const port = 4174

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const urlPath = req.url?.split('?')[0] || '/'
      let filePath
      if (urlPath === '/main.js') {
        filePath = join(dist, 'main.js')
      } else if (urlPath.startsWith('/assets/')) {
        filePath = join(dist, urlPath.replace(/^\//, ''))
      } else if (urlPath === '/') {
        filePath = join(root, 'index.html')
      } else {
        filePath = join(root, urlPath.replace(/^\//, ''))
      }
      if (!existsSync(filePath)) {
        res.writeHead(404)
        res.end(`Not found: ${urlPath}`)
        return
      }
      let body = readFileSync(filePath)
      if (extname(filePath) === '.html') {
        body = Buffer.from(
          body
            .toString('utf8')
            .replace('https://cominvi.netlify.app/main.js', '/main.js')
        )
      }
      const ext = extname(filePath)
      res.writeHead(200, {
        'Content-Type': mime[ext] || 'application/octet-stream',
      })
      res.end(body)
    })
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function waitForHomeReady(page) {
  await page.waitForFunction(
    () => window.__loaderDone === true || !document.querySelector('.loader'),
    { timeout: 120000 }
  )
  await page.waitForFunction(
    () =>
      window.__lenisWrapper &&
      document.querySelector('.service-card')?.__cardsRevealBound,
    { timeout: 120000 }
  )
  await page.waitForTimeout(500)
}

async function scrollSectionIntoView(page, selector) {
  await page.evaluate((sel) => {
    const section = document.querySelector(sel)
    if (!section || !window.lenis) return
    const cardsTarget =
      section.querySelector(
        '.is-grid-3, .content, .service-card, .team-card'
      ) || section
    window.lenis.scrollTo(cardsTarget, {
      offset: -window.innerHeight * 0.12,
      duration: 2.5,
      immediate: false,
    })
  }, selector)
}

async function waitForLenisIdle(page, timeout = 15000) {
  await page.waitForFunction(
    () => {
      const lenis = window.lenis
      if (!lenis) return true
      const vel =
        typeof lenis.velocity === 'number' ? Math.abs(lenis.velocity) : 0
      return lenis.isScrolling !== true && vel < 0.05
    },
    { timeout }
  )
  await page.waitForTimeout(150)
}

async function testCardsRevealOnHome(page, baseUrl) {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' })
  await waitForHomeReady(page)

  const before = await page.evaluate(() => {
    const serviceCards = Array.from(
      document.querySelectorAll('.section_services .service-card')
    )
    const teamCards = Array.from(
      document.querySelectorAll('.section_teams .team-card')
    )
    return {
      serviceOpacities: serviceCards.map((c) => getComputedStyle(c).opacity),
      teamOpacities: teamCards.map((c) => getComputedStyle(c).opacity),
      servicePending: serviceCards.some((c) =>
        c.classList.contains('is-card-reveal-pending')
      ),
      teamPending: teamCards.some((c) =>
        c.classList.contains('is-card-reveal-pending')
      ),
      servicePlayed: serviceCards.map((c) => !!c.__cardsRevealPlayed),
      teamPlayed: teamCards.map((c) => !!c.__cardsRevealPlayed),
      triggerOnCard: [...serviceCards, ...teamCards].map((c) => {
        const st = c.__cardsRevealScrollTrigger
        return !!(st && (st.trigger === c || st.vars?.trigger === c))
      }),
    }
  })
  console.log('HOME CARDS BEFORE SCROLL:', JSON.stringify(before, null, 2))

  before.serviceOpacities.forEach((op, i) =>
    assert(
      parseFloat(op) < 0.1,
      `Service card ${i} devrait être invisible avant scroll (opacity=${op})`
    )
  )
  before.teamOpacities.forEach((op, i) =>
    assert(
      parseFloat(op) < 0.1,
      `Team card ${i} devrait être invisible avant scroll (opacity=${op})`
    )
  )
  assert(before.servicePending, 'Service cards sans classe pending')
  assert(before.teamPending, 'Team cards sans classe pending')
  assert(
    before.servicePlayed.every((p) => !p) && before.teamPlayed.every((p) => !p),
    'Cards déjà révélées avant scroll'
  )
  assert(
    before.triggerOnCard.length > 0 && before.triggerOnCard.every(Boolean),
    'ScrollTrigger doit être sur chaque card individuellement'
  )

  await page.evaluate(() => {
    const section = document.querySelector('.section_services')
    if (!section || !window.lenis) return
    window.lenis.scrollTo(section, {
      offset: -window.innerHeight * 0.55,
      duration: 1.2,
      immediate: false,
    })
  })
  await page.waitForTimeout(1400)
  const partialSection = await page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll('.section_services .service-card')
    )
    return {
      opacities: cards.map((c) => parseFloat(getComputedStyle(c).opacity)),
      played: cards.map((c) => !!c.__cardsRevealPlayed),
    }
  })
  console.log('HOME CARDS PARTIAL SECTION:', JSON.stringify(partialSection, null, 2))
  assert(
    partialSection.opacities.some((o) => o < 0.1),
    'Toutes les cards sont visibles alors que seule la section est entrée en vue'
  )

  const titlesBeforeHover = await page.evaluate(() => {
    const card = document.querySelector('.section_services .service-card')
    const bodyL = card?.querySelector('.body-l')
    const transform =
      bodyL?.style.transform || getComputedStyle(bodyL || document.body).transform
    return {
      transform,
      contentHeight:
        card?.querySelector('.desc')?.__svcContentHeightPx ?? null,
    }
  })
  console.log('SERVICE TITLE CLOSED:', JSON.stringify(titlesBeforeHover, null, 2))

  await scrollSectionIntoView(page, '.section_services')

  let sawStagger = false
  let sawMotion = false
  for (let i = 0; i < 45; i += 1) {
    await page.waitForTimeout(150)
    const sample = await page.evaluate(() => {
      const cards = Array.from(
        document.querySelectorAll('.section_services .service-card')
      )
      const opacities = cards.map((c) => parseFloat(getComputedStyle(c).opacity))
      const ys = cards.map((c) => {
        const t = c.style.transform || getComputedStyle(c).transform
        const m3d = t.match(/translate3d\([^,]+,\s*([^,]+)/)
        if (m3d) return parseFloat(m3d[1])
        const m = t.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*([^)]+)\)/)
        return m ? parseFloat(m[1]) : 0
      })
      return { opacities, ys }
    })
    const visibleCount = sample.opacities.filter((o) => o > 0.5).length
    if (visibleCount > 0 && visibleCount < 5) sawStagger = true
    if (sample.ys.some((y) => Math.abs(y) > 2)) sawMotion = true
    if (sample.opacities.every((o) => o >= 0.99) && sample.ys.every((y) => Math.abs(y) < 1)) {
      break
    }
  }

  const after = await page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll('.section_services .service-card')
    )
    return {
      opacities: cards.map((c) => getComputedStyle(c).opacity),
      transforms: cards.map((c) => c.style.transform || ''),
      played: cards.map((c) => !!c.__cardsRevealPlayed),
    }
  })
  console.log('HOME CARDS AFTER SCROLL:', JSON.stringify(after, null, 2))
  console.log('HOME CARDS STAGGER:', { sawStagger, sawMotion })

  after.opacities.forEach((op, i) =>
    assert(
      parseFloat(op) >= 0.99,
      `Card ${i} devrait être visible après reveal (opacity=${op})`
    )
  )
  assert(after.played.every((p) => p), 'Reveal non marqué sur chaque service card')
  assert(sawStagger || sawMotion, 'Aucun stagger ni mouvement détecté pendant le reveal')

  await page.waitForTimeout(500)
  const titlesAfterReveal = await page.evaluate(() => {
    const card = document.querySelector('.section_services .service-card')
    const bodyL = card?.querySelector('.body-l')
    const cardRect = card?.getBoundingClientRect()
    const bodyLRect = bodyL?.getBoundingClientRect()
    const padBottom = card ? parseFloat(getComputedStyle(card).paddingBottom) || 0 : 0
    const titleBottomGap =
      cardRect && bodyLRect
        ? Math.round(cardRect.bottom - padBottom - bodyLRect.bottom)
        : null
    const transform =
      bodyL?.style.transform || getComputedStyle(bodyL || document.body).transform
    return {
      transform,
      contentHeight:
        card?.querySelector('.desc')?.__svcContentHeightPx ?? null,
      titleBottomGap,
    }
  })
  console.log('SERVICE TITLE AFTER REVEAL:', JSON.stringify(titlesAfterReveal, null, 2))
  assert(
    titlesAfterReveal.titleBottomGap !== null &&
      titlesAfterReveal.titleBottomGap <= 4,
    `Titre pas ancré en bas après reveal (gap=${titlesAfterReveal.titleBottomGap}px)`
  )
  assert(
    (titlesAfterReveal.contentHeight ?? 0) > 8,
    `Hauteur desc non mesurée après reveal (${titlesAfterReveal.contentHeight})`
  )

  await scrollSectionIntoView(page, '.section_teams')
  let teamReady = false
  for (let i = 0; i < 40; i += 1) {
    await page.waitForTimeout(150)
    const sample = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.section_teams .team-card'))
      const opacities = cards.map((c) => parseFloat(getComputedStyle(c).opacity))
      return {
        opacities,
        played: cards.map((c) => !!c.__cardsRevealPlayed),
        allVisible: opacities.length > 0 && opacities.every((o) => o >= 0.99),
      }
    })
    if (sample.allVisible) {
      teamReady = true
      console.log('HOME TEAM CARDS AFTER SCROLL:', JSON.stringify(sample, null, 2))
      break
    }
  }
  assert(teamReady, 'Team cards non révélées après scroll vers section_teams')
}

async function testServiceTitlesOnResize(page, baseUrl) {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' })
  await waitForHomeReady(page)
  await scrollSectionIntoView(page, '.section_services')
  await page.waitForTimeout(2500)

  const readTitleBottomGaps = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('.section_services .service-card')).map(
        (card) => {
          const bodyL = card.querySelector('.body-l')
          const cardRect = card.getBoundingClientRect()
          const bodyLRect = bodyL?.getBoundingClientRect()
          const padBottom = parseFloat(getComputedStyle(card).paddingBottom) || 0
          return bodyLRect
            ? Math.round(cardRect.bottom - padBottom - bodyLRect.bottom)
            : 999
        }
      )
    )

  const readDescHeights = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('.section_services .service-card')).map(
        (card) => {
          const desc = card.querySelector('.desc')
          const rect = desc?.getBoundingClientRect()
          const opacity = desc ? parseFloat(getComputedStyle(desc).opacity) : 1
          return {
            height: rect ? Math.round(rect.height) : 0,
            opacity,
          }
        }
      )
    )

  const beforeResize = await readTitleBottomGaps()
  const descBeforeResize = await readDescHeights()
  console.log('SERVICE TITLES BEFORE RESIZE:', beforeResize)
  console.log('SERVICE DESC BEFORE RESIZE:', descBeforeResize)
  assert(
    beforeResize.length > 0 && beforeResize.every((gap) => gap <= 4),
    `Titres pas ancrés en bas avant resize (${beforeResize.join(',')})`
  )
  assert(
    descBeforeResize.every((d) => d.height <= 2 && d.opacity < 0.1),
    `desc visible avant resize: ${JSON.stringify(descBeforeResize)}`
  )

  for (const size of [
    { width: 1200, height: 800 },
    { width: 1600, height: 1000 },
    { width: 1024, height: 900 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(size)
    await page.waitForTimeout(400)
  }

  const afterResize = await readTitleBottomGaps()
  const descAfterResize = await readDescHeights()
  console.log('SERVICE TITLES AFTER RESIZE:', afterResize)
  console.log('SERVICE DESC AFTER RESIZE:', descAfterResize)
  assert(
    afterResize.every((gap) => gap <= 4),
    `Titres pas ancrés en bas après resize (${afterResize.join(',')})`
  )
  assert(
    descAfterResize.every((d) => d.height <= 2 && d.opacity < 0.1),
    `desc visible après resize sans hover: ${JSON.stringify(descAfterResize)}`
  )
}

async function testServiceTitlesAfterHoverClose(page, baseUrl) {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' })
  await waitForHomeReady(page)
  await scrollSectionIntoView(page, '.section_services')
  await page.waitForTimeout(2500)

  const readHoverAlignment = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('.section_services .service-card')).map(
        (card) => {
          const bodyL = card.querySelector('.body-l')
          const desc = card.querySelector('.desc')
          const cardRect = card.getBoundingClientRect()
          const bodyLRect = bodyL?.getBoundingClientRect()
          const descRect = desc?.getBoundingClientRect()
          const padBottom = parseFloat(getComputedStyle(card).paddingBottom) || 0
          const limitBottom = cardRect.bottom - padBottom
          return {
            titleGap: bodyLRect
              ? Math.round(limitBottom - bodyLRect.bottom)
              : null,
            descGap: descRect
              ? Math.round(limitBottom - descRect.bottom)
              : null,
            descHeight: descRect ? Math.round(descRect.height) : 0,
          }
        }
      )
    )

  const readTitleOverflow = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('.section_services .service-card')).map(
        (card) => {
          const bodyL = card.querySelector('.body-l')
          const cardRect = card.getBoundingClientRect()
          const bodyLRect = bodyL?.getBoundingClientRect()
          const padBottom = parseFloat(getComputedStyle(card).paddingBottom) || 0
          const limitBottom = cardRect.bottom - padBottom
          const overflow = bodyLRect
            ? Math.round(bodyLRect.bottom - limitBottom)
            : 0
          const transform = bodyL?.style.transform || ''
          return { overflow, transform }
        }
      )
    )

  const cards = page.locator('.section_services .service-card')
  const count = await cards.count()

  for (let i = 0; i < count; i += 1) {
    const card = cards.nth(i)
    await card.hover()
    await page.waitForTimeout(900)
    const duringHover = (await readHoverAlignment())[i]
    console.log(`SERVICE HOVER ALIGN ${i}:`, JSON.stringify(duringHover))
    assert(
      duringHover.descHeight > 8,
      `desc card ${i} non ouverte au hover (height=${duringHover.descHeight})`
    )
    assert(
      duringHover.descGap !== null && duringHover.descGap <= 4,
      `desc card ${i} pas ancrée en bas au hover (gap=${duringHover.descGap}px)`
    )
    assert(
      duringHover.titleGap !== null &&
        duringHover.titleGap > duringHover.descGap,
      `titre card ${i} pas au-dessus du texte au hover`
    )
    await page.mouse.move(0, 0)
    await page.waitForTimeout(900)
  }

  const afterHover = await readTitleOverflow()
  console.log('SERVICE TITLES AFTER HOVER CLOSE:', JSON.stringify(afterHover, null, 2))
  afterHover.forEach((sample, i) => {
    assert(
      sample.overflow <= 2,
      `Titre card ${i} dépasse le bas après fermeture (overflow=${sample.overflow}px, transform=${sample.transform})`
    )
  })
}

async function testServiceParagraphsReflowOnResize(page, baseUrl) {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' })
  await waitForHomeReady(page)
  await page.setViewportSize({ width: 1600, height: 900 })
  await scrollSectionIntoView(page, '.section_services')
  await page.waitForTimeout(500)

  const card = page.locator('.section_services .service-card').first()
  await card.hover()
  await page.waitForTimeout(900)
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.waitForTimeout(500)

  const reflow = await card.evaluate((element) => {
    const paragraph = element.querySelector('.desc .body-s')
    const lines = paragraph?.__lines || []
    const lineHeight = parseFloat(getComputedStyle(paragraph).lineHeight)
    return {
      isOpen: element.classList.contains('is-svc-hover'),
      lines: lines.length,
      maxLineHeight: Math.max(
        0,
        ...lines.map((line) => line.getBoundingClientRect().height)
      ),
      lineHeight,
    }
  })
  console.log('SERVICE PARAGRAPH REFLOW:', reflow)
  assert(reflow.lines > 0, 'Le paragraphe service n’est pas découpé en lignes')
  assert(
    reflow.maxLineHeight <= reflow.lineHeight * 1.5,
    `Les lignes du paragraphe ne sont pas recalculées (${reflow.maxLineHeight}px pour une ligne de ${reflow.lineHeight}px)`
  )
}

async function testServiceSectionStableOnHover(page, baseUrl) {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' })
  await waitForHomeReady(page)
  await scrollSectionIntoView(page, '.section_services')
  await waitForLenisIdle(page)

  await page.evaluate(() => {
    const card = document.querySelector('.section_services .service-card')
    if (!card || !window.lenis) return
    const rect = card.getBoundingClientRect()
    const centerY = rect.top + rect.height / 2
    const delta = centerY - window.innerHeight * 0.45
    window.lenis.scrollTo(window.lenis.scroll + delta, {
      immediate: true,
      force: true,
    })
  })
  await waitForLenisIdle(page)

  const readLayout = () =>
    page.evaluate(() => {
      const section = document.querySelector('.section_services')
      const grid = document.querySelector('.section_services .is-grid-3')
      const content = document.querySelector('.section_services .content')
      const viewer = document.querySelector('.section_services .services-viewer')
      const scroll = Math.round(
        window.lenis?.scroll ?? window.__lenisWrapper?.scrollTop ?? 0
      )
      const sectionRect = section?.getBoundingClientRect()
      const gridRect = grid?.getBoundingClientRect()
      const contentRect = content?.getBoundingClientRect()
      const viewerRect = viewer?.getBoundingClientRect()
      const docY = (rect) =>
        rect ? Math.round(rect.top + scroll) : null
      return {
        sectionDocY: docY(sectionRect),
        contentDocY: docY(contentRect),
        gridHeight: gridRect ? Math.round(gridRect.height) : null,
        contentHeight: contentRect ? Math.round(contentRect.height) : null,
        viewerHeight: viewerRect ? Math.round(viewerRect.height) : null,
        scroll,
      }
    })

  const before = await readLayout()
  await page
    .locator('.section_services .service-card')
    .first()
    .hover({ force: true })
  await page.waitForTimeout(800)
  await waitForLenisIdle(page)
  const during = await readLayout()
  console.log('SERVICE SECTION HOVER LAYOUT:', { before, during })

  assert(
    before.sectionDocY !== null &&
      Math.abs(during.sectionDocY - before.sectionDocY) <= 1,
    `Section décalée dans le document au hover (${before.sectionDocY} -> ${during.sectionDocY})`
  )
  assert(
    before.gridHeight !== null &&
      Math.abs(during.gridHeight - before.gridHeight) <= 1,
    `Grille agrandie au hover (${before.gridHeight} -> ${during.gridHeight})`
  )
  assert(
    before.contentHeight !== null &&
      Math.abs(during.contentHeight - before.contentHeight) <= 1,
    `Contenu agrandi au hover (${before.contentHeight} -> ${during.contentHeight})`
  )
  assert(
    Math.abs(during.scroll - before.scroll) <= 1,
    `Scroll modifié au hover (${before.scroll} -> ${during.scroll})`
  )
}

async function testBlogLayout(page, baseUrl) {
  await page.goto(`${baseUrl}/blog.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => document.querySelector('.blog-inner_item .blogline-line'),
    { timeout: 30000 }
  )
  await page.waitForTimeout(1500)

  const layout = await page.evaluate(() => {
    const title = document.querySelector('.blog-inner_item .blog-name > .body-l')
    const lines = Array.from(title?.querySelectorAll('.blogline-line') || [])
    const line = lines[0]
    const after = line ? getComputedStyle(line, '::after') : null
    return {
      lineCount: lines.length,
      lines: lines.map((l) => ({
        words: l.querySelectorAll('.blogline-word').length,
        width: Math.round(l.getBoundingClientRect().width),
        titleWidth: Math.round(title.getBoundingClientRect().width),
      })),
      afterContent: after?.content,
      afterTransition: after?.transitionDuration,
      afterTransform: after?.transform,
    }
  })
  console.log('BLOG LAYOUT:', JSON.stringify(layout, null, 2))

  assert(layout.lineCount >= 2, 'Pas assez de lignes de titre')
  assert(layout.afterContent && layout.afterContent !== 'none', '::after sans content')
  assert(
    layout.afterTransition && parseFloat(layout.afterTransition) > 0,
    'Pas de transition CSS sur underline'
  )
  layout.lines.forEach((line, i) => {
    const isLastLine = i === layout.lines.length - 1
    assert(
      line.words >= 2 || isLastLine,
      `Ligne ${i} n'a qu'un mot`
    )
    assert(
      line.width <= line.titleWidth + 4,
      `Ligne ${i} trop large (${line.width}px vs titre ${line.titleWidth}px)`
    )
  })

  const noHover = await page.evaluate(() => {
    const line = document.querySelector('.blog-inner_item .blogline-line')
    const after = getComputedStyle(line, '::after')
    return { transform: after.transform }
  })
  assert(
    noHover.transform.includes('matrix(0,'),
    `Underline visible sans hover: ${noHover.transform}`
  )

  const link = page.locator('a.blog-inner_item').first()
  await link.hover()
  await page.waitForTimeout(700)
  const onHover = await page.evaluate(() => {
    const line =
      document.querySelector('a.blog-inner_item:hover .blogline-line') ||
      document.querySelector('a.blog-inner_item .blogline-line')
    const after = getComputedStyle(line, '::after')
    return { transform: after.transform }
  })
  console.log('BLOG HOVER:', JSON.stringify(onHover, null, 2))
  assert(
    onHover.transform && !onHover.transform.includes('matrix(0,'),
    `Underline absente au hover: ${onHover.transform}`
  )
}

async function testBlogHoverViaBarba(page, baseUrl) {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => window.__loaderDone === true || !document.querySelector('.loader'),
    { timeout: 120000 }
  )
  await page.goto(`${baseUrl}/blog.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => document.querySelector('.blog-inner_item .blogline-line'),
    { timeout: 30000 }
  )
  const barbaStyles = await page.evaluate(() => {
    const line = document.querySelector('.blog-inner_item .blogline-line')
    const after = getComputedStyle(line, '::after')
    return {
      content: after.content,
      transition: after.transitionDuration,
      transform: after.transform,
    }
  })
  console.log('BLOG BARBA LOAD:', JSON.stringify(barbaStyles, null, 2))
  assert(barbaStyles.content && barbaStyles.content !== 'none', 'Barba: ::after sans content')
  await page.locator('a.blog-inner_item').first().hover()
  await page.waitForTimeout(700)
  const hover = await page.evaluate(() => {
    const after = getComputedStyle(
      document.querySelector('.blog-inner_item .blogline-line'),
      '::after'
    )
    return after.transform
  })
  assert(!hover.includes('matrix(0,'), `Barba: pas d underline au hover (${hover})`)
}

async function testMachinesGrid(page, baseUrl) {
  await page.goto(`${baseUrl}/technology.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => document.querySelector('.machines-grid_item') && window.__lenisWrapper,
    { timeout: 120000 }
  )
  await page.waitForTimeout(1500)

  await page.evaluate(() => {
    const grid = document.querySelector('.machines-grid-wrapper')
    if (grid && window.lenis) {
      window.lenis.scrollTo(grid, {
        offset: -window.innerHeight * 0.2,
        immediate: true,
      })
    }
  })
  await page.waitForTimeout(300)

  const scrollBeforeOpen = await page.evaluate(() => ({
    lenis: window.lenis?.scroll ?? null,
    wrapper: window.__lenisWrapper?.scrollTop ?? null,
  }))
  console.log('MACHINES GRID SCROLL BEFORE OPEN:', scrollBeforeOpen)

  await page.locator('.machines-grid_item').first().click()
  await page.waitForTimeout(200)

  const scrollAfterOpen = await page.evaluate(() => ({
    lenis: window.lenis?.scroll ?? null,
    wrapper: window.__lenisWrapper?.scrollTop ?? null,
  }))
  console.log('MACHINES GRID SCROLL AFTER OPEN:', scrollAfterOpen)
  assert(
    scrollBeforeOpen.lenis !== null &&
      scrollAfterOpen.lenis !== null &&
      Math.abs(scrollAfterOpen.lenis - scrollBeforeOpen.lenis) <= 2,
    `Saut de scroll à l'ouverture (${scrollBeforeOpen.lenis} -> ${scrollAfterOpen.lenis})`
  )

  const samples = []
  let elapsed = 0
  for (const wait of [900, 200, 200, 200]) {
    await page.waitForTimeout(wait)
    elapsed += wait
    const sample = await page.evaluate(() => {
      const img = document.querySelector('.machines-grid_item-clone .machines-grid_img')
      const clone = document.querySelector('.machines-grid_item-clone')
      const imgRect = img?.getBoundingClientRect()
      const cloneRect = clone?.getBoundingClientRect()
      const style = img ? getComputedStyle(img) : null
      const emPx = parseFloat(getComputedStyle(document.documentElement).fontSize)
      return {
        imgBottomGap:
          imgRect && cloneRect
            ? Math.round(cloneRect.bottom - imgRect.bottom)
            : null,
        expectedGap: Math.round(emPx * 2),
        bottom: style?.bottom,
        top: style?.top,
      }
    })
    samples.push({ t: elapsed, ...sample })
  }
  console.log('MACHINES GRID SAMPLES:', JSON.stringify(samples, null, 2))

  const final = samples[samples.length - 1]
  const reference = await page.evaluate(() => {
    const img = document.querySelector('.machines-grid_item-clone .machines-grid_img')
    const rect = img?.getBoundingClientRect()
    const em = parseFloat(getComputedStyle(document.documentElement).fontSize)
    const vh = window.innerHeight
    const refTop = vh * 0.7
    return {
      imgTop: rect ? Math.round(rect.top) : null,
      refTop: Math.round(refTop),
      em,
      topStyle: img ? getComputedStyle(img).top : null,
    }
  })
  console.log('MACHINES GRID FINAL:', JSON.stringify(reference, null, 2))

  assert(
    reference.imgTop !== null && reference.imgTop < reference.refTop - reference.em,
    `Image pas 2em au-dessus de l'ancienne position 70% (top=${reference.imgTop}, ref=${reference.refTop})`
  )

  const gaps = samples.map((s) => s.imgBottomGap).filter((g) => g !== null)
  const maxJump = Math.max(...gaps.map((g, i) => (i ? Math.abs(g - gaps[i - 1]) : 0)))
  assert(
    maxJump <= 40,
    `Saut de position détecté en fin d'animation (maxJump=${maxJump}px)`
  )
}

async function testMachinesGridClose(page, baseUrl) {
  await page.goto(`${baseUrl}/technology.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => document.querySelector('.machines-grid_item') && window.__lenisWrapper,
    { timeout: 120000 }
  )
  await page.waitForTimeout(1000)
  await page.locator('.machines-grid_item').first().click()
  await page.waitForTimeout(1600)
  await page.locator('.machines-grid_close-button').first().click({ force: true })

  let closeOverflow = null
  const samples = []
  let elapsed = 0
  for (const wait of [300, 200, 200, 200, 200]) {
    await page.waitForTimeout(wait)
    elapsed += wait
    const sample = await page.evaluate(() => {
      const img = document.querySelector('.machines-grid_item-clone .machines-grid_img')
      const rect = img?.getBoundingClientRect()
      const overlay = document.querySelector('.grid-desc-overlay')
      const nameInner = overlay?.querySelector('.machines-grid_name-inner')
      const wordSpans = Array.from(
        nameInner?.querySelectorAll('.body-xl > span') || []
      )
      return {
        width: rect ? Math.round(rect.width) : null,
        top: rect ? Math.round(rect.top) : null,
        left: img ? getComputedStyle(img).left : null,
        overlayPresent: !!overlay,
        nameInnerOverflow: nameInner
          ? getComputedStyle(nameInner).overflow
          : null,
        wordSpanOverflows: wordSpans.map((s) => getComputedStyle(s).overflow),
      }
    })
    samples.push({ t: elapsed, ...sample })
    if (
      !closeOverflow &&
      sample.overlayPresent &&
      sample.nameInnerOverflow === 'hidden' &&
      sample.wordSpanOverflows.length > 0 &&
      sample.wordSpanOverflows.every((v) => v === 'hidden')
    ) {
      closeOverflow = sample
    }
  }
  console.log('MACHINES GRID CLOSE:', JSON.stringify(samples, null, 2))

  const first = samples[0]
  const last = samples[samples.length - 1]
  assert(first.width && last.width, 'Image absente pendant la fermeture')
  assert(
    last.width < first.width,
    `Largeur image ne diminue pas à la fermeture (${first.width} -> ${last.width})`
  )

  console.log('MACHINES CLOSE OVERFLOW:', JSON.stringify(closeOverflow, null, 2))
  assert(
    closeOverflow,
    'Overflow hidden du titre non détecté pendant la fermeture'
  )
}

async function main() {
  const baseUrl = `http://127.0.0.1:${port}`
  const server = await startServer()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  await page.route('https://cominvi.netlify.app/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let filePath
    if (path === '/main.js') filePath = join(dist, 'main.js')
    else if (path.startsWith('/assets/')) filePath = join(dist, path.slice(1))
    else return route.continue()
    if (!existsSync(filePath)) return route.abort()
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: readFileSync(filePath),
    })
  })

  try {
    await testCardsRevealOnHome(page, baseUrl)
    await testServiceTitlesOnResize(page, baseUrl)
    await testServiceTitlesAfterHoverClose(page, baseUrl)
    await testServiceParagraphsReflowOnResize(page, baseUrl)
    await testServiceSectionStableOnHover(page, baseUrl)
    await testBlogLayout(page, baseUrl)
    await testBlogHoverViaBarba(page, baseUrl)
    await testMachinesGrid(page, baseUrl)
    await testMachinesGridClose(page, baseUrl)
    console.log('\n✅ Tous les tests Playwright ont réussi.')
  } finally {
    await browser.close()
    server.close()
  }
}

main().catch((err) => {
  console.error('\n❌', err.message)
  process.exit(1)
})
