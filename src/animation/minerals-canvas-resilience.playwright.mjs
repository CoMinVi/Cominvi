import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { chromium, devices } from 'playwright'

const STAGING_URL = 'https://cominvi-staging.webflow.io/our-services'
const NETLIFY_ORIGIN = 'https://cominvi.netlify.app'
const DIST_DIR = path.resolve('dist')

async function createPage({ failAf = false, delayAf = 0 } = {}) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/local/bin/google-chrome',
    args: ['--no-sandbox'],
  })
  const context = await browser.newContext({ ...devices['iPhone 13'] })
  let afRequests = 0

  await context.route(`${NETLIFY_ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/minerals-sequence.af')) {
      afRequests += 1
      if (failAf) return route.abort('failed')
      if (delayAf > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayAf))
      }
      return route.continue()
    }

    const localPath = path.join(
      DIST_DIR,
      url.pathname === '/main.js' ? 'main.js' : url.pathname
    )
    if (
      (url.pathname === '/main.js' || url.pathname.startsWith('/assets/')) &&
      fs.existsSync(localPath)
    ) {
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: fs.readFileSync(localPath),
      })
    }
    return route.continue()
  })

  const page = await context.newPage()
  await page.goto(`${STAGING_URL}?minerals-test=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })
  await page.waitForFunction(() => window.lenis, null, { timeout: 30000 })

  return {
    browser,
    page,
    getAfRequests: () => afRequests,
  }
}

async function readCanvasAlpha(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.section_minerals canvas')
    const data = canvas
      .getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height).data
    let alpha = 0
    for (let index = 3; index < data.length; index += 4000) {
      alpha += data[index]
    }
    return alpha
  })
}

test('initialise et télécharge la séquence Minerals une seule fois', async () => {
  const session = await createPage()
  try {
    await session.page.waitForTimeout(2500)
    assert.equal(session.getAfRequests(), 1)
  } finally {
    await session.browser.close()
  }
})

test('affiche une frame statique si la séquence AF échoue', async () => {
  const session = await createPage({ failAf: true })
  try {
    await session.page.evaluate(() =>
      window.lenis.scrollTo(2800, { immediate: true })
    )
    await session.page.waitForTimeout(4000)
    assert.ok((await readCanvasAlpha(session.page)) > 0)
  } finally {
    await session.browser.close()
  }
})

test('conserve la frame AF après un resize tardif du fallback', async () => {
  const session = await createPage()
  try {
    await session.page.evaluate(() =>
      window.lenis.scrollTo(2800, { immediate: true })
    )
    await session.page.waitForFunction(
      () =>
        document.querySelector('.section_minerals canvas')
          .__mineralsLastSource === 'af',
      null,
      { timeout: 20000 }
    )
    const drawsBefore = await session.page.evaluate(
      () =>
        document.querySelector('.section_minerals canvas')
          .__mineralsAfDrawCount
    )

    await session.page.setViewportSize({ width: 400, height: 664 })
    await session.page.waitForFunction(
      (before) => {
        const canvas = document.querySelector('.section_minerals canvas')
        return (
          canvas.__mineralsLastSource === 'af' &&
          canvas.__mineralsAfDrawCount > before
        )
      },
      drawsBefore,
      { timeout: 10000 }
    )
  } finally {
    await session.browser.close()
  }
})

test('réutilise le chargement AF en cours après un cleanup', async () => {
  const session = await createPage({ delayAf: 1500 })
  try {
    await session.page.evaluate(async () => {
      const component = document.querySelector(
        '[fc-image-scrubbing="component"]'
      )
      component.__mineralsCanvasCleanup()
      const module = await import(
        'https://cominvi.netlify.app/assets/minerals-canvas-local-debug.js'
      )
      module.initMineralsCanvas(document)
      window.lenis.scrollTo(2800, { immediate: true })
    })
    await session.page.waitForFunction(
      () =>
        document.querySelector('.section_minerals canvas')
          .__mineralsLastSource === 'af',
      null,
      { timeout: 20000 }
    )
    assert.equal(session.getAfRequests(), 1)
  } finally {
    await session.browser.close()
  }
})

test('restaure le fallback si le décodeur échoue après une frame AF', async () => {
  const session = await createPage()
  try {
    await session.page.evaluate(() =>
      window.lenis.scrollTo(2800, { immediate: true })
    )
    await session.page.waitForFunction(
      () =>
        document.querySelector('.section_minerals canvas')
          .__mineralsLastSource === 'af',
      null,
      { timeout: 20000 }
    )

    await session.page.evaluate(() => {
      window.__originalVideoDecoderDecode = VideoDecoder.prototype.decode
      VideoDecoder.prototype.decode = () => {
        throw new Error('forced decode failure')
      }
    })
    await session.page.setViewportSize({ width: 400, height: 664 })
    await session.page.waitForFunction(
      () =>
        document.querySelector('.section_minerals canvas')
          .__mineralsLastSource === 'fallback',
      null,
      { timeout: 10000 }
    )
    assert.ok((await readCanvasAlpha(session.page)) > 0)
  } finally {
    await session.page.evaluate(() => {
      if (window.__originalVideoDecoderDecode) {
        VideoDecoder.prototype.decode = window.__originalVideoDecoderDecode
      }
    })
    await session.browser.close()
  }
})
