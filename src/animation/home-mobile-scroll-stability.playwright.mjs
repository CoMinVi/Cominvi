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

async function inspectMobileScrollWork(browser) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 900 },
    isMobile: true,
    hasTouch: true,
  })
  await serveLocalBuild(page)
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.lenis)
  await page.waitForTimeout(1500)

  const result = await page.evaluate(async () => {
    window.lenis.scrollTo(9000, { immediate: true })

    let partnerAttributeMutations = 0
    const partnerObserver = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === 'attributes') partnerAttributeMutations += 1
      })
    })
    partnerObserver.observe(document.querySelector('.section_partners'), {
      subtree: true,
      attributes: true,
    })
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
    partnerObserver.disconnect()

    let technologyChildMutations = 0
    const technologyObserver = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === 'childList') technologyChildMutations += 1
      })
    })
    technologyObserver.observe(document.querySelector('.section_technology'), {
      subtree: true,
      childList: true,
    })
    window.dispatchEvent(new Event('resize'))
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 350))
    technologyObserver.disconnect()

    return {
      partnerAttributeMutations,
      technologyChildMutations,
      hiddenMachineLines: document.querySelectorAll(
        '.section_technology .machine-card_inner .line'
      ).length,
    }
  })

  await page.close()
  return result
}

async function inspectDesktopMachineCards(browser) {
  const page = await browser.newPage({
    viewport: { width: 992, height: 900 },
  })
  await serveLocalBuild(page)
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.lenis)
  await page.waitForTimeout(1000)
  const lineCount = await page.locator(
    '.section_technology .machine-card_inner .line'
  ).count()
  await page.close()
  return lineCount
}

const browser = await chromium.launch()

try {
  const mobile = await inspectMobileScrollWork(browser)
  assert.ok(
    mobile.partnerAttributeMutations < 50,
    `Partners ne doit pas muter hors écran à chaque frame (${mobile.partnerAttributeMutations} mutations)`
  )
  assert.equal(
    mobile.technologyChildMutations,
    0,
    'Un resize sans changement de largeur ne doit pas reconstruire Technology'
  )
  assert.equal(
    mobile.hiddenMachineLines,
    0,
    'Les textes desktop masqués des machines ne doivent pas être découpés sur mobile'
  )

  const desktopMachineLines = await inspectDesktopMachineCards(browser)
  assert.ok(
    desktopMachineLines > 0,
    'Le découpage des textes des machines doit rester actif sur desktop'
  )
} finally {
  await browser.close()
}

console.log('PASS home mobile scroll stability')
