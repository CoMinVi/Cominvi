import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, devices } from 'playwright'

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

const browser = await chromium.launch()
const page = await browser.newPage({ ...devices['iPhone 13'] })

try {
  await serveLocalBuild(page)
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => window.lenis && document.querySelector('.cylindar__text__wrapper')
  )
  await page.waitForTimeout(2300)

  const result = await page.evaluate(async () => {
    const partners = document.querySelector('.section_partners')
    const cylinder = partners.querySelector('.cylindar__wrapper')
    const textWrapper = cylinder.querySelector('.cylindar__text__wrapper')

    window.lenis.scrollTo(9000, { immediate: true })
    let offscreenMutations = 0
    const offscreenObserver = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === 'attributes') offscreenMutations += 1
      })
    })
    offscreenObserver.observe(partners, {
      subtree: true,
      attributes: true,
    })
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
    offscreenObserver.disconnect()

    const partnersTop =
      cylinder.getBoundingClientRect().top + window.lenis.scroll
    window.lenis.scrollTo(partnersTop - 200, { immediate: true })
    await new Promise((resolvePromise) =>
      requestAnimationFrame(() => requestAnimationFrame(resolvePromise))
    )
    const transformBefore = getComputedStyle(textWrapper).transform

    window.lenis.scrollTo(partnersTop + 600, { immediate: true })
    await new Promise((resolvePromise) =>
      requestAnimationFrame(() => requestAnimationFrame(resolvePromise))
    )
    const transformAfter = getComputedStyle(textWrapper).transform

    let activeMutations = 0
    const activeObserver = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === 'attributes') activeMutations += 1
      })
    })
    activeObserver.observe(partners, {
      subtree: true,
      attributes: true,
    })
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200))
    activeObserver.disconnect()

    return {
      offscreenMutations,
      activeMutations,
      transformBefore,
      transformAfter,
      activeItems: partners.querySelectorAll('.is-active').length,
    }
  })

  assert.ok(
    result.offscreenMutations < 50,
    `Partners ne doit pas muter au niveau des cards (${result.offscreenMutations} mutations)`
  )
  assert.notEqual(
    result.transformAfter,
    result.transformBefore,
    'Le cylindre Partners doit toujours tourner avec le scroll'
  )
  assert.ok(
    result.activeMutations > 0,
    'Le ticker Partners doit rester actif à proximité de sa section'
  )
  assert.ok(
    result.activeItems > 0,
    'Partners doit toujours conserver un élément actif'
  )
} finally {
  await browser.close()
}

console.log('PASS partners ticker visibility')
