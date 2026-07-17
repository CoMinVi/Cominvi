import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

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

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

try {
  await serveLocalBuild(page)
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => window.lenis && window.__loaderDone === true)

  const result = await page.evaluate(async () => {
    const section = document.querySelector('.section_next')
    const wrapper = section.querySelector('.next-button-wrapper')
    const button = wrapper.querySelector('[pt-next]')
    const documentTop =
      section.getBoundingClientRect().top + window.lenis.scroll

    window.lenis.scrollTo(documentTop + 50, { immediate: true })
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300))

    const viewportCenterY = window.innerHeight / 2
    const samples = []
    const start = performance.now()
    const sample = () => {
      const buttonRect = button.getBoundingClientRect()
      const sectionTop = section.getBoundingClientRect().top
      const buttonCenterY = buttonRect.top + buttonRect.height / 2
      samples.push({
        time: performance.now() - start,
        buttonCenterY,
        sectionTop,
        offsetFromCenter: Math.abs(buttonCenterY - viewportCenterY),
        inlineTransform: wrapper.style.transform,
      })
      if (performance.now() - start < 1200) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)

    window.lenis.scrollTo(documentTop - 300, { duration: 1.1 })
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1300))

    const centeredSamples = samples.filter(
      (entry) => entry.sectionTop > 0 && entry.sectionTop < 200
    )
    const centerJumps = centeredSamples
      .slice(1)
      .map((entry, index) =>
        Math.abs(entry.buttonCenterY - centeredSamples[index].buttonCenterY)
      )

    return {
      sampleCount: samples.length,
      centeredSampleCount: centeredSamples.length,
      maxCenterJump: Math.max(0, ...centerJumps),
      avgCenterJump:
        centerJumps.length > 0
          ? centerJumps.reduce((sum, value) => sum + value, 0) /
            centerJumps.length
          : 0,
      usesInlineTransformWhileCentered: centeredSamples.some(
        (entry) => entry.inlineTransform.length > 0
      ),
    }
  })

  assert.ok(result.sampleCount >= 15, 'Le test doit collecter assez de frames')
  assert.ok(
    result.centeredSampleCount >= 6,
    `Le bouton doit rester dans la zone centrée (${result.centeredSampleCount} frames)`
  )
  assert.ok(
    result.maxCenterJump <= 1,
    `Le bouton ne doit pas trembler pendant le scroll centré (${result.maxCenterJump}px/frame)`
  )
  assert.ok(
    !result.usesInlineTransformWhileCentered,
    'Le transform inline ne doit pas écraser le sticky tant que la section est visible'
  )
} finally {
  await browser.close()
}

console.log('PASS next button sticky')
