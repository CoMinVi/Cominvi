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
  await page.waitForTimeout(2000)
}

async function scrollToSelector(page, selector) {
  const beforeTop = await page.evaluate((sel) => {
    return document.querySelector(sel)?.getBoundingClientRect().top ?? null
  }, selector)

  if (beforeTop !== null && beforeTop > 400) {
    const wheelSteps = Math.min(50, Math.ceil(beforeTop / 400))
    for (let i = 0; i < wheelSteps; i += 1) {
      await page.mouse.wheel(0, 1200)
      await page.waitForTimeout(60)
    }
  }

  await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el || !window.lenis) return
    window.lenis.scrollTo(el, {
      offset: -window.innerHeight * 0.25,
      immediate: true,
    })
    window.ScrollTrigger?.refresh()
  }, selector)

  await page.waitForTimeout(1500)
}

async function testCardsRevealOnHome(page, baseUrl) {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' })
  await waitForHomeReady(page)

  const before = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.section_services .service-card'))
    const section = document.querySelector('.section_services')
    return {
      opacities: cards.map((c) => getComputedStyle(c).opacity),
      transforms: cards.map((c) => c.style.transform || getComputedStyle(c).transform),
      sectionTop: Math.round(section?.getBoundingClientRect().top ?? 0),
      played: !!section?.__cardsRevealPlayed,
    }
  })
  console.log('HOME CARDS BEFORE SCROLL:', JSON.stringify(before, null, 2))

  before.opacities.forEach((op, i) =>
    assert(parseFloat(op) < 0.1, `Card ${i} devrait être invisible avant scroll (opacity=${op})`)
  )

  await scrollToSelector(page, '.section_services')

  await page.waitForTimeout(1200)

  const after = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.section_services .service-card'))
    const section = document.querySelector('.section_services')
    return {
      opacities: cards.map((c) => getComputedStyle(c).opacity),
      transforms: cards.map((c) => c.style.transform || ''),
      played: !!section?.__cardsRevealPlayed,
      tweenProgress: section?.__cardsRevealTween?.progress?.() ?? null,
    }
  })
  console.log('HOME CARDS AFTER SCROLL:', JSON.stringify(after, null, 2))

  after.opacities.forEach((op, i) =>
    assert(parseFloat(op) >= 0.99, `Card ${i} devrait être visible après reveal (opacity=${op})`)
  )
  assert(after.played, 'Reveal non marqué comme joué sur la home')
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
    return {
      lineCount: lines.length,
      lines: lines.map((line) => ({
        words: line.querySelectorAll('.blogline-word').length,
        width: Math.round(line.getBoundingClientRect().width),
        titleWidth: Math.round(title.getBoundingClientRect().width),
        text: line.textContent?.trim().slice(0, 50),
      })),
      injectedBottom: getComputedStyle(
        document.querySelector('.blogline-line'),
        '::after'
      ).bottom,
    }
  })
  console.log('BLOG LAYOUT:', JSON.stringify(layout, null, 2))

  assert(layout.lineCount >= 2, 'Pas assez de lignes de titre')
  const oneWordLines = layout.lines.filter((l) => l.words === 1)
  assert(oneWordLines.length <= 1, `Layout cassé: ${oneWordLines.length} lignes à 1 mot`)
  layout.lines.forEach((line, i) => {
    const isLastLine = i === layout.lines.length - 1
    assert(
      line.words >= 2 || isLastLine,
      `Ligne ${i} n'a qu'un mot: "${line.text}"`
    )
    assert(
      line.width <= line.titleWidth + 4,
      `Ligne ${i} trop large (${line.width}px vs titre ${line.titleWidth}px)`
    )
  })

  const noHover = await page.evaluate(() => {
    const line = document.querySelector('.blog-inner_item .blogline-line')
    const after = getComputedStyle(line, '::after')
    return { transform: after.transform, scaleVisible: after.transform.includes('matrix(1') }
  })
  console.log('BLOG NO HOVER:', JSON.stringify(noHover, null, 2))
  assert(
    !noHover.scaleVisible,
    `Underline visible sans hover: ${noHover.transform}`
  )

  const link = page.locator('a.blog-inner_item').first()
  await link.hover()
  await page.waitForTimeout(700)
  const onHover = await page.evaluate(() => {
    const line = document.querySelector('a.blog-inner_item:hover .blogline-line') ||
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

async function testMachinesGrid(page, baseUrl) {
  await page.goto(`${baseUrl}/technology.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => document.querySelector('.machines-grid_item') && window.__lenisWrapper,
    { timeout: 120000 }
  )
  await page.waitForTimeout(1500)
  await page.locator('.machines-grid_item').first().click()
  await page.waitForTimeout(2000)

  const data = await page.evaluate(() => {
    const img = document.querySelector('.machines-grid_item-clone .machines-grid_img')
    const clone = document.querySelector('.machines-grid_item-clone')
    const imgRect = img?.getBoundingClientRect()
    const cloneRect = clone?.getBoundingClientRect()
    const vh = window.innerHeight
    const emPx = parseFloat(getComputedStyle(document.documentElement).fontSize)
    const style = img ? getComputedStyle(img) : null
    return {
      imgBottomGap: imgRect && cloneRect ? Math.round(cloneRect.bottom - imgRect.bottom) : null,
      expectedGap: Math.round(emPx * 2),
      imgTop: imgRect ? Math.round(imgRect.top) : null,
      vh,
      topRatio: imgRect ? imgRect.top / vh : null,
      bottom: style?.bottom,
      top: style?.top,
    }
  })
  console.log('MACHINES GRID:', JSON.stringify(data, null, 2))

  assert(
    Math.abs(data.imgBottomGap - data.expectedGap) <= 16,
    `Image pas à 2em du bas (gap=${data.imgBottomGap}, attendu≈${data.expectedGap})`
  )
  assert(
    data.bottom !== 'auto' && data.bottom !== '',
    `bottom non ancré: ${data.bottom}`
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
    await testBlogLayout(page, baseUrl)
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
