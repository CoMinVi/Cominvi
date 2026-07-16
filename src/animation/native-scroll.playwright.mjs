import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000/'
const VIEWPORT_HEIGHT = 800
const NATIVE_WIDTHS = [390, 768, 991]
const DESKTOP_WIDTH = 992

async function useLocalApplicationSource(page) {
  await page.route('https://cominvi.netlify.app/main.js', (route) =>
    route.fulfill({
      status: 302,
      headers: { location: new URL('/src/main.js', BASE_URL).href },
    })
  )
}

async function readScrollState(page) {
  await page.waitForFunction(() => window.__lenisWrapper !== undefined)

  return page.evaluate(() => ({
    hasLenis: Boolean(window.lenis),
    nativeClass:
      document.documentElement.classList.contains('is-native-scroll'),
    sharedScrollerIsWindow: window.__lenisWrapper === window,
    pageOverflow: getComputedStyle(document.querySelector('.page-wrap'))
      .overflow,
    maxScroll: document.documentElement.scrollHeight - window.innerHeight,
  }))
}

async function checkNativeScroll(browser, width) {
  const page = await browser.newPage({
    viewport: { width, height: VIEWPORT_HEIGHT },
  })

  try {
    await useLocalApplicationSource(page)
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    const state = await readScrollState(page)

    assert.equal(state.hasLenis, false, 'Lenis doit être désactivé')
    assert.equal(state.nativeClass, true, 'la classe native doit être présente')
    assert.equal(
      state.sharedScrollerIsWindow,
      true,
      'le scroller partagé doit être window'
    )
    assert.notEqual(
      state.pageOverflow,
      'hidden',
      '.page-wrap ne doit pas masquer le débordement'
    )
    assert.ok(
      state.maxScroll > VIEWPORT_HEIGHT,
      'la page doit dépasser une hauteur de viewport'
    )

    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight)
    })
    await page.waitForFunction(
      (height) => window.scrollY > height,
      VIEWPORT_HEIGHT
    )
  } finally {
    await page.close()
  }
}

async function checkDesktopScroll(browser) {
  const page = await browser.newPage({
    viewport: { width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT },
  })

  try {
    await useLocalApplicationSource(page)
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    const state = await readScrollState(page)

    assert.equal(state.hasLenis, true, 'Lenis doit être initialisé')
    assert.equal(state.nativeClass, false, 'la classe native doit être absente')
    assert.equal(
      state.sharedScrollerIsWindow,
      false,
      'le scroller partagé doit être le wrapper Lenis'
    )
  } finally {
    await page.close()
  }
}

async function main() {
  const browser = await chromium.launch()
  let hasFailure = false

  try {
    for (const width of NATIVE_WIDTHS) {
      try {
        await checkNativeScroll(browser, width)
        console.log(`PASS native @ ${width}px`)
      } catch (error) {
        hasFailure = true
        console.error(`FAIL native @ ${width}px: ${error.message}`)
      }
    }

    try {
      await checkDesktopScroll(browser)
      console.log(`PASS Lenis @ ${DESKTOP_WIDTH}px`)
    } catch (error) {
      hasFailure = true
      console.error(`FAIL Lenis @ ${DESKTOP_WIDTH}px: ${error.message}`)
    }
  } finally {
    await browser.close()
  }

  if (hasFailure) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
