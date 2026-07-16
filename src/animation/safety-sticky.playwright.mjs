import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000/index.html'

async function readSafetyStickyState(browser, width) {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    isMobile: width <= 991,
    hasTouch: width <= 991,
  })

  const serveLocalBuild = async (route) => {
    const pathname = new URL(route.request().url()).pathname
    const body = await readFile(resolve('dist', pathname.slice(1)))
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body,
    })
  }

  await page.route('https://cominvi.netlify.app/main.js', serveLocalBuild)
  await page.route(
    'https://cominvi.netlify.app/assets/**/*.js',
    serveLocalBuild
  )

  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => {
    const section = document.querySelector('.section_safety')
    return section && window.lenis
  })
  await page.waitForTimeout(500)

  const state = await page.evaluate(() => {
    const section = document.querySelector('.section_safety')
    return {
      hasPin: Boolean(section?.__safetyStickyST),
      hasClass: section?.classList.contains('is-lenis-sticky') ?? false,
    }
  })

  await page.close()
  return state
}

const browser = await chromium.launch()

try {
  for (const width of [390, 768, 991]) {
    const state = await readSafetyStickyState(browser, width)
    assert.deepEqual(
      state,
      { hasPin: false, hasClass: false },
      `Le sticky Safety doit être désactivé à ${width}px`
    )
  }

  const desktopState = await readSafetyStickyState(browser, 992)
  assert.deepEqual(
    desktopState,
    { hasPin: true, hasClass: true },
    'Le sticky Safety doit rester actif à partir de 992px'
  )
} finally {
  await browser.close()
}

console.log('PASS safety sticky responsive')
