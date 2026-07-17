import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, devices } from 'playwright'

const BASE_URL =
  process.env.BASE_URL || 'https://cominvi-staging.webflow.io/'

async function serveLocalBuild(page) {
  const serveJavaScript = async (route) => {
    const pathname = new URL(route.request().url()).pathname
    const body = await readFile(resolve('dist', pathname.slice(1)))
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body,
    })
  }

  await page.route('https://cominvi.netlify.app/main.js', serveJavaScript)
  await page.route(
    'https://cominvi.netlify.app/assets/**/*.js',
    serveJavaScript
  )
}

async function testHeroLeave(browser, name, contextOptions) {
  const page = await browser.newPage(contextOptions)
  await serveLocalBuild(page)
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => window.__loaderDone === true, {
    timeout: 30000,
  })
  await page.waitForTimeout(1500)

  if (name === 'mobile') {
    await page.evaluate(() => {
      window.lenis?.scrollTo?.(350, { immediate: true, force: true })
    })
    await page.waitForTimeout(500)
  }

  await page.evaluate(() => {
    const visibleMenuButton = [...document.querySelectorAll('.is-menu')].find(
      (element) => {
        const rect = element.getBoundingClientRect()
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight
        )
      }
    )
    visibleMenuButton?.click()
  })
  // Les liens deviennent cliquables avant la fin de l'ouverture (1,2 s).
  await page.waitForTimeout(700)

  const result = await page.evaluate(async () => {
    const pageWrap = document.querySelector('[data-barba="container"]')
    const canvas = document.querySelector(
      '.hero-background [data-loader-sequence-canvas="true"]'
    )
    const beforeTop = pageWrap.getBoundingClientRect().top
    const beforeCanvasRect = canvas?.getBoundingClientRect()

    const samples = []
    const start = performance.now()
    const sample = () => {
      const pageRect = pageWrap.getBoundingClientRect()
      const canvasRect = canvas?.getBoundingClientRect()
      const canvasStyle = canvas ? getComputedStyle(canvas) : null
      samples.push({
        pageTop: pageRect.top,
        position: getComputedStyle(pageWrap).position,
        canvasTop: canvasRect?.top,
        canvasVisible:
          !!canvas &&
          canvasStyle.display !== 'none' &&
          canvasStyle.visibility !== 'hidden' &&
          Number(canvasStyle.opacity) > 0 &&
          canvasRect.bottom > 0 &&
          canvasRect.top < window.innerHeight,
      })
      if (performance.now() - start < 180) {
        window.requestAnimationFrame(sample)
      }
    }

    window.requestAnimationFrame(sample)
    document.querySelector('.navlink[href*="technology"]')?.click()
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 220))

    return {
      pageJump: Math.max(
        0,
        ...samples
          .slice(1)
          .filter(
            (sampleEntry, index) =>
              sampleEntry.position !== samples[index].position
          )
          .map((sampleEntry) => {
            const sampleIndex = samples.indexOf(sampleEntry)
            return Math.abs(
              sampleEntry.pageTop - samples[sampleIndex - 1].pageTop
            )
          })
      ),
      canvasVisible: samples.every((sampleEntry) => sampleEntry.canvasVisible),
      canvasTopJump: beforeCanvasRect
        ? Math.max(
            0,
            ...samples.map((sampleEntry) =>
              Math.abs(sampleEntry.canvasTop - beforeCanvasRect.top)
            )
          )
        : null,
    }
  })

  await page.close()

  assert.ok(
    result.pageJump <= 2,
    `${name}: le hero saute de ${result.pageJump.toFixed(1)}px au leave`
  )
  assert.equal(
    result.canvasVisible,
    true,
    `${name}: la frame du canvas doit rester visible`
  )
}

const browser = await chromium.launch()
try {
  await testHeroLeave(browser, 'desktop', {
    viewport: { width: 1440, height: 900 },
  })
  await testHeroLeave(browser, 'mobile', devices['iPhone 13'])
} finally {
  await browser.close()
}

console.log('PASS hero nav leave')
