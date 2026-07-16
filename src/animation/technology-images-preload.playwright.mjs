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

const browser = await chromium.launch()
const page = await browser.newPage({ ...devices['iPhone 13'] })

try {
  await serveLocalBuild(page)
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(
    () => window.lenis && document.querySelector('.section_technology')
  )
  await page.waitForTimeout(1200)

  const technologyTop = await page.evaluate(() => {
    const section = document.querySelector('.section_technology')
    return section.getBoundingClientRect().top + window.lenis.scroll
  })
  await page.evaluate((top) => {
    window.lenis.scrollTo(top - 2200, { immediate: true })
  }, technologyTop)

  await page.waitForFunction(
    () => {
      const images = Array.from(
        document.querySelectorAll('.section_technology .machine-card img')
      )
      return (
        images.length > 0 &&
        images.every(
          (image) =>
            image.dataset.machinePreloadState === 'ready' &&
            image.complete &&
            image.naturalWidth > 0
        )
      )
    },
    { timeout: 15000 }
  )

  const state = await page.evaluate(() => {
    const images = Array.from(
      document.querySelectorAll('.section_technology .machine-card img')
    )
    const displayRect = document
      .querySelector('.section_technology .display-text')
      .getBoundingClientRect()
    return {
      imageCount: images.length,
      allEager: images.every((image) => image.loading === 'eager'),
      allAsync: images.every((image) => image.decoding === 'async'),
      allReady: images.every(
        (image) =>
          image.dataset.machinePreloadState === 'ready' &&
          image.complete &&
          image.naturalWidth > 0
      ),
      displayStillBelowViewport: displayRect.top > window.innerHeight,
    }
  })

  assert.equal(state.imageCount, 6, 'Les six images machines sont attendues')
  assert.equal(state.allEager, true, 'Les images doivent être préchargées')
  assert.equal(state.allAsync, true, 'Le décodage doit rester asynchrone')
  assert.equal(state.allReady, true, 'Les images doivent être décodées')
  assert.equal(
    state.displayStillBelowViewport,
    true,
    'Le décodage doit finir avant l’entrée des SVG Technology'
  )
} finally {
  await browser.close()
}

console.log('PASS technology images preload')
