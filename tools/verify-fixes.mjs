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

async function waitForLoader(page) {
  await page.waitForFunction(
    () =>
      window.__loaderDone === true ||
      !document.querySelector('.loader') ||
      document.querySelector('.service-card'),
    { timeout: 120000 }
  )
  await page.waitForFunction(
    () => window.__lenisWrapper && document.querySelector('.service-card'),
    { timeout: 120000 }
  )
  await page.waitForTimeout(1500)
}

async function scrollToSelector(page, selector) {
  const beforeTop = await page.evaluate((sel) => {
    return document.querySelector(sel)?.getBoundingClientRect().top ?? null
  }, selector)

  if (beforeTop !== null && beforeTop > 400) {
    const wheelSteps = Math.min(40, Math.ceil(beforeTop / 500))
    for (let i = 0; i < wheelSteps; i += 1) {
      await page.mouse.wheel(0, 1200)
      await page.waitForTimeout(80)
    }
  }

  await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return
    if (window.lenis && typeof window.lenis.scrollTo === 'function') {
      window.lenis.scrollTo(el, {
        offset: -window.innerHeight * 0.2,
        immediate: true,
      })
    }
  }, selector)

  await page.waitForTimeout(1200)
  await page.evaluate(() => {
    try {
      window.ScrollTrigger?.refresh()
    } catch (e) {
      // ignore
    }
  })
  await page.waitForTimeout(800)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function testServiceCards(page) {
  const data = await page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll('.section_services .service-card') || []
    )
    return cards.map((card, i) => {
      const bodyL = card.querySelector('.body-l')
      const bloc = card.querySelector('.card-inner')
      const bodyLRect = bodyL?.getBoundingClientRect()
      const blocRect = bloc?.getBoundingClientRect()
      const gapToBottom =
        bodyLRect && blocRect
          ? Math.round(blocRect.bottom - bodyLRect.bottom)
          : null
      const cardInner = card.querySelector('.card-inner')
      return {
        i,
        title: bodyL?.textContent?.trim().slice(0, 40),
        offset: bodyL?.__svcBottomOffsetPx,
        gapToBottom,
        cardOpacity: getComputedStyle(card).opacity,
        cardTransform: card.style.transform || '',
      }
    })
  })

  console.log('SERVICE CARDS:', JSON.stringify(data, null, 2))

  const gaps = data.map((c) => c.gapToBottom).filter((g) => g !== null)
  if (gaps.length >= 2) {
    const spread = Math.max(...gaps) - Math.min(...gaps)
    assert(spread <= 4, `Titres mal alignés: écarts au bas ${gaps.join(', ')}`)
  }

  return data
}

async function testCardsReveal(page) {
  const data = await page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll('.section_services .service-card') || []
    )
    return {
      cardOpacities: cards.map((c) => getComputedStyle(c).opacity),
      cardTransforms: cards.map((c) => c.style.transform || ''),
      played: !!document.querySelector('.section_services')?.__cardsRevealPlayed,
    }
  })
  console.log('CARDS REVEAL:', JSON.stringify(data, null, 2))
  data.cardOpacities.forEach((op, i) =>
    assert(parseFloat(op) >= 0.99, `Card ${i} opacity=${op}`)
  )
  assert(data.played, 'Reveal animation non jouée')
  return data
}

async function testBlogUnderlineHover(page) {
  const link = page.locator('a.blog-inner_item').first()
  await link.scrollIntoViewIfNeeded()
  await link.hover()
  await page.waitForTimeout(700)

  const data = await page.evaluate(() => {
    const line = document.querySelector(
      '.blog-main_item .blog-name > .body-l > .blogline-line'
    )
    if (!line) return { error: 'no line' }
    const after = getComputedStyle(line, '::after')
    const lineStyle = getComputedStyle(line)
    return {
      lineDisplay: lineStyle.display,
      afterContent: after.content,
      afterTransform: after.transform,
      afterWidth: after.width,
      afterHeight: after.height,
    }
  })
  console.log('BLOG UNDERLINE HOVER:', JSON.stringify(data, null, 2))
  assert(!data.error, data.error || 'missing blog line')
  assert(data.lineDisplay === 'block', `blogline-line display=${data.lineDisplay}`)
  assert(data.afterContent && data.afterContent !== 'none', '::after absent')
  assert(
    data.afterTransform &&
      !data.afterTransform.includes('matrix(0,') &&
      !data.afterTransform.includes('matrix(0 '),
    `underline non visible: transform=${data.afterTransform}`
  )
  return data
}

async function testBlogLayout(page) {
  const data = await page.evaluate(() => {
    const title = document.querySelector('.blog-inner_item .blog-name > .body-l')
    if (!title) return { error: 'no title' }
    const lines = Array.from(title.querySelectorAll('.blogline-line'))
    return {
      lineCount: lines.length,
      lines: lines.slice(0, 6).map((line) => ({
        words: line.querySelectorAll('.blogline-word').length,
        width: Math.round(line.getBoundingClientRect().width),
        text: line.textContent?.trim().slice(0, 60),
      })),
      titleWidth: Math.round(title.getBoundingClientRect().width),
    }
  })
  console.log('BLOG LAYOUT:', JSON.stringify(data, null, 2))
  assert(!data.error, data.error || 'blog title missing')
  const singleWordLines = data.lines.filter((line) => line.words === 1)
  assert(
    singleWordLines.length <= 1,
    `Layout blog cassé: ${singleWordLines.length} lignes à un seul mot`
  )
  data.lines.forEach((line, i) => {
    assert(
      line.width >= 120,
      `Ligne ${i} trop étroite (width=${line.width})`
    )
  })
  return data
}

async function testMachinesGrid(page, baseUrl) {
  await page.goto(`${baseUrl}/technology.html`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForFunction(
    () =>
      document.querySelector('.machines-grid_item') &&
      (window.__loaderDone === true ||
        !document.querySelector('.loader') ||
        window.__lenisWrapper),
    { timeout: 120000 }
  )
  await page.waitForTimeout(2000)
  await page.locator('.machines-grid_item').first().click()
  await page.waitForTimeout(1800)

  const data = await page.evaluate(() => {
    const overlay = document.querySelector('.grid-desc-overlay')
    const infos = overlay?.querySelector('.machines-grid_infos')
    const img = document.querySelector(
      '.machines-grid_item-clone .machines-grid_img'
    )
    const vh = window.innerHeight
    const infosRect = infos?.getBoundingClientRect()
    const imgRect = img?.getBoundingClientRect()
    const clone = document.querySelector('.machines-grid_item-clone')
    const cloneRect = clone?.getBoundingClientRect()
    const emPx = parseFloat(getComputedStyle(document.documentElement).fontSize)
    return {
      hasOverlay: !!overlay,
      infosCenterY: infosRect
        ? Math.round(infosRect.top + infosRect.height / 2)
        : null,
      viewportCenterY: Math.round(vh / 2),
      centerDelta: infosRect
        ? Math.round(infosRect.top + infosRect.height / 2 - vh / 2)
        : null,
      imgBottomGap: imgRect && cloneRect
        ? Math.round(cloneRect.bottom - imgRect.bottom)
        : null,
      expectedBottomGap: Math.round(emPx * 2),
      imgTop: imgRect ? Math.round(imgRect.top) : null,
      cloneTop: cloneRect ? Math.round(cloneRect.top) : null,
      imgComputed: img
        ? {
            top: getComputedStyle(img).top,
            bottom: getComputedStyle(img).bottom,
          }
        : null,
    }
  })

  console.log('MACHINES GRID OPEN:', JSON.stringify(data, null, 2))
  assert(data.hasOverlay, 'Overlay machines grid absent')
  assert(
    Math.abs(data.centerDelta) <= 80,
    `Texte pas centré verticalement (delta=${data.centerDelta}px)`
  )
  assert(
    Math.abs(data.imgBottomGap - data.expectedBottomGap) <= 12,
    `Image pas à 2em du bas (gap=${data.imgBottomGap}, attendu≈${data.expectedBottomGap})`
  )
  assert(
    data.imgComputed?.bottom && data.imgComputed.bottom !== 'auto',
    `Image sans ancrage bottom (top=${data.imgComputed?.top})`
  )
  return data
}

async function main() {
  const baseUrl = `http://127.0.0.1:${port}`
  const server = await startServer()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const fulfillLocal = async (route) => {
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
  }

  await page.route('https://cominvi.netlify.app/**', fulfillLocal)

  try {
    await page.goto(`${baseUrl}/our-services.html`, {
      waitUntil: 'domcontentloaded',
    })
    await waitForLoader(page)

    const cardsBefore = await testServiceCards(page)
    const revealBefore = await page.evaluate(() => ({
      opacities: Array.from(
        document.querySelectorAll('.section_services .service-card')
      ).map((el) => getComputedStyle(el).opacity),
    }))
    console.log('REVEAL BEFORE SCROLL:', JSON.stringify(revealBefore, null, 2))

    await scrollToSelector(page, '.section_services')
    const scrollDebug = await page.evaluate(() => {
      const section = document.querySelector('.section_services')
      const rect = section?.getBoundingClientRect()
      return {
        rectTop: rect ? Math.round(rect.top) : null,
        vh: window.innerHeight,
        inView: rect ? rect.top < window.innerHeight * 0.85 : false,
        played: section?.__cardsRevealPlayed,
        hasObserver: !!section?.__cardsRevealObserver,
        lenis: !!window.lenis,
        scrollTop: window.__lenisWrapper?.scrollTop,
      }
    })
    console.log('SCROLL DEBUG:', JSON.stringify(scrollDebug, null, 2))
    await testCardsReveal(page)
    await testServiceCards(page)

    await page.goto(`${baseUrl}/blog.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('.blog-inner_item'),
      { timeout: 30000 }
    )
    await page.waitForTimeout(1500)
    await testBlogLayout(page)
    await testBlogUnderlineHover(page)

    await testMachinesGrid(page, baseUrl)

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
