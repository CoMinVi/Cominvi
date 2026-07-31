import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL || 'https://cominvi-staging.webflow.io'

async function main() {
  const browser = await chromium.launch({
    args: [
      '--disable-web-security',
      '--disable-features=BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessRespectPreflightResults',
    ],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const waitForApp = async () => {
    await page.waitForFunction(() => window.lenis)
    await page.waitForTimeout(1200)
  }

  try {
    await page.goto(`${BASE_URL}/about-us`, { waitUntil: 'networkidle' })
    await waitForApp()

    const introRevealAfterLeaveStarts = await page.evaluate(async () => {
      const container = document.querySelector('[data-barba="container"]')
      const body = container?.querySelector('.intro .body-xl[tr="1"]')
      const link = container?.querySelector('a[pt-inner]')
      if (!body || !link) return null
      window.lenis.scrollTo(300, { immediate: true, force: true })
      await new Promise((resolve) => setTimeout(resolve, 300))
      const chars = Array.from(body.querySelectorAll('.char'))
      const before = chars.map((char) => Number(getComputedStyle(char).opacity))
      link.click()
      await new Promise((resolve) => setTimeout(resolve, 150))
      const after = chars.map((char) => Number(getComputedStyle(char).opacity))
      return {
        charCount: body.querySelectorAll('.char').length,
        maxOpacityDelta: Math.max(
          ...before.map((value, index) => Math.abs(after[index] - value))
        ),
      }
    })
    assert.ok(
      introRevealAfterLeaveStarts?.charCount > 0,
      'pt-inner doit conserver les spans de lettres pendant le leave'
    )
    assert.ok(
      introRevealAfterLeaveStarts.maxOpacityDelta < 0.001,
      `pt-inner doit figer le dégradé des lettres, delta reçu ${introRevealAfterLeaveStarts.maxOpacityDelta}`
    )

    await page.goto(`${BASE_URL}/about-us`, { waitUntil: 'networkidle' })
    await waitForApp()
    await page.locator('.navbar > a[href]').first().click()
    await page.waitForURL((url) => url.pathname === '/')
    await page.waitForTimeout(4500)

    const homeHeroScale = await page.evaluate(() => {
      const home = document.querySelector(
        '[data-barba="container"][data-barba-namespace="home"]'
      )
      const background = home?.querySelector(
        '.hero-background .background-inner'
      )
      if (!background) return null
      return new DOMMatrix(getComputedStyle(background).transform).a
    })
    assert.ok(homeHeroScale !== null, 'le fond Hero Home doit être présent')
    assert.ok(
      Math.abs(homeHeroScale - 1) < 0.001,
      `le fond Hero Home doit rester à scale 1, reçu ${homeHeroScale}`
    )

    await page.waitForTimeout(4000)
    await page.evaluate(() => {
      const container = document.querySelector('[data-barba="container"]')
      const aboutLink = Array.from(
        container?.querySelectorAll('a[pt-inner]') || []
      ).find((link) => /about-us/.test(link.getAttribute('href') || ''))
      aboutLink?.click()
    })
    await page.waitForURL((url) => /about-us/.test(url.pathname))
    await page.waitForTimeout(3500)
    await page.evaluate(() => performance.clearResourceTimings())

    await page.locator('.navbar > a[href]').first().click()
    await page.waitForURL((url) => url.pathname === '/')
    await page.waitForTimeout(4500)

    const repeatedScrollFrameLoads = await page.evaluate(() => {
      const firstScrollFrames = performance
        .getEntriesByType('resource')
        .filter((entry) => /\/cave-scene\/scroll\//.test(entry.name))
        .filter((entry) => {
          const match = entry.name.match(/frame_(\d+)/)
          return match && Number(match[1]) < 60
        })
      return firstScrollFrames.length
    })
    assert.equal(
      repeatedScrollFrameLoads,
      0,
      'un retour sur Home doit réutiliser les images de scroll déjà décodées'
    )
  } finally {
    await browser.close()
  }
}

main()
  .then(() => {
    console.log('PASS page transition regressions')
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
