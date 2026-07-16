import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000/index.html'

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

async function inspectMobileCards(browser) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 900 },
    isMobile: true,
    hasTouch: true,
  })
  await serveLocalBuild(page)
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.lenis)
  await page.waitForTimeout(1000)

  const state = await page.evaluate(async () => {
    const section = document.querySelector('.section_technology')
    let childMutations = 0
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === 'childList') childMutations += 1
      })
    })
    observer.observe(section, { subtree: true, childList: true })
    window.dispatchEvent(new Event('resize'))
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 350))
    observer.disconnect()

    return {
      childMutations,
      hiddenDesktopLines: section.querySelectorAll(
        '.machine-card_inner .line'
      ).length,
    }
  })

  const firstCard = page.locator('.section_technology .machine-card').first()
  const bottomWrap = firstCard.locator('.machine-bottom-wrap')
  const collapsedHeight = await bottomWrap.evaluate(
    (element) => element.getBoundingClientRect().height
  )
  await firstCard.click()
  await page.waitForTimeout(1300)
  state.opensOnTap = await firstCard.evaluate((card) =>
    card.classList.contains('is-open')
  )
  state.openHeight = await bottomWrap.evaluate(
    (element) => element.getBoundingClientRect().height
  )
  state.collapsedHeight = collapsedHeight

  await page.close()
  return state
}

async function inspectDesktopCards(browser) {
  const page = await browser.newPage({
    viewport: { width: 992, height: 900 },
  })
  await serveLocalBuild(page)
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.lenis)
  await page.waitForTimeout(1000)
  const lines = await page.locator(
    '.section_technology .machine-card_inner .line'
  ).count()
  await page.close()
  return lines
}

const browser = await chromium.launch()

try {
  const mobile = await inspectMobileCards(browser)
  assert.equal(
    mobile.childMutations,
    0,
    'Un resize sans changement de largeur ne doit pas reconstruire les cartes'
  )
  assert.equal(
    mobile.hiddenDesktopLines,
    0,
    'Les textes desktop masqués ne doivent pas être découpés sur mobile'
  )
  assert.equal(mobile.opensOnTap, true, 'Une carte doit toujours s’ouvrir au tap')
  assert.ok(
    mobile.openHeight > mobile.collapsedHeight,
    'La zone de description doit toujours se déployer'
  )

  const desktopLines = await inspectDesktopCards(browser)
  assert.ok(
    desktopLines > 0,
    'Le découpage nécessaire au hover doit rester actif sur desktop'
  )
} finally {
  await browser.close()
}

console.log('PASS technology cards resize isolation')
