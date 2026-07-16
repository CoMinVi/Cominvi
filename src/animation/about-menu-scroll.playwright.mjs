import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, devices } from 'playwright'

const BASE_URL =
  process.env.BASE_URL || 'https://cominvi-staging.webflow.io/about-us'

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
  await page.waitForFunction(() => window.lenis)
  await page.waitForTimeout(1500)

  const before = await page.evaluate(() => ({
    scroll: window.lenis.scroll,
    workshopsTop: document
      .querySelector('.section_workshops')
      .getBoundingClientRect().top,
  }))

  await page.click('.is-menu')
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-menu-open') === 'true'
  )
  await page.waitForTimeout(1200)
  await page.click('.is-menu')
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-menu-open') === 'false'
  )
  await page.waitForTimeout(1400)

  const after = await page.evaluate(() => ({
    scroll: window.lenis.scroll,
    workshopsTop: document
      .querySelector('.section_workshops')
      .getBoundingClientRect().top,
  }))

  assert.ok(
    Math.abs(after.scroll - before.scroll) <= 2,
    `Le menu ne doit pas déplacer Lenis (${before.scroll} → ${after.scroll})`
  )
  assert.ok(
    Math.abs(after.workshopsTop - before.workshopsTop) <= 2,
    `Workshops doit retrouver sa position (${before.workshopsTop} → ${after.workshopsTop})`
  )
} finally {
  await browser.close()
}

console.log('PASS about menu scroll preservation')
