import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000/index.html'

async function readTechnologyAnimationState(browser, width) {
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
  await page.waitForFunction(() => window.lenis)
  await page.waitForTimeout(500)

  const state = await page.evaluate(() => {
    const section = document.querySelector('.section_technology')
    const revealTargets = Array.from(section?.querySelectorAll('[tr="1"]') || [])
    const gradients = Array.from(
      section?.querySelectorAll(
        '.title-big .overlay-gradients .overlay-gradient'
      ) || []
    )

    return {
      characterCount: revealTargets.reduce(
        (count, target) => count + target.querySelectorAll('.char').length,
        0
      ),
      triggerCount: revealTargets.reduce(
        (count, target) =>
          count + (target.__textRevealLineTweens?.length || 0),
        0
      ),
      gradientWidths: gradients.map((gradient) => gradient.style.width),
    }
  })

  await page.close()
  return state
}

const browser = await chromium.launch()

try {
  for (const width of [390, 768, 991, 992]) {
    const state = await readTechnologyAnimationState(browser, width)
    assert.ok(
      state.characterCount > 0,
      `Le reveal par caractère doit être actif à ${width}px`
    )
    assert.ok(
      state.triggerCount > 0,
      `Les ScrollTrigger de texte doivent être actifs à ${width}px`
    )
    assert.deepEqual(
      state.gradientWidths,
      ['0%', '0%'],
      `Le reveal SVG Technology doit démarrer replié à ${width}px`
    )
  }
} finally {
  await browser.close()
}

console.log('PASS technology mobile scroll animations')
