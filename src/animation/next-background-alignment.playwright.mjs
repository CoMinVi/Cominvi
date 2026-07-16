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
  await page.waitForFunction(() => window.lenis && window.__loaderDone === true)

  const result = await page.evaluate(async () => {
    const section = document.querySelector('.section_next')
    const anchor = section.querySelector('[pt-next]')
    const background = section.querySelector('.next_background')
    const container = document.querySelector('[data-barba="container"]')
    const initialDocumentTop =
      section.getBoundingClientRect().top + window.lenis.scroll

    window.lenis.scrollTo(Math.max(0, initialDocumentTop - 1200), {
      immediate: true,
    })
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000))
    const target =
      window.lenis.scroll + section.getBoundingClientRect().top - 200
    window.lenis.scrollTo(target, { immediate: true })
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150))

    const samples = []
    const start = performance.now()
    const sample = () => {
      samples.push({
        time: performance.now() - start,
        sectionTop: section.getBoundingClientRect().top,
        backgroundY: parseFloat(background._gsap?.y || '0') || 0,
        containerPosition: getComputedStyle(container).position,
      })
      if (performance.now() - start < 650) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    anchor.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    )
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 700))

    const firstAbsoluteIndex = samples.findIndex(
      (entry) => entry.containerPosition === 'absolute'
    )
    const scrollSamples = samples.slice(0, firstAbsoluteIndex + 1)
    const yJumps = scrollSamples
      .slice(1)
      .map((entry, index) =>
        Math.abs(entry.backgroundY - scrollSamples[index].backgroundY)
      )

    return {
      final: scrollSamples.at(-1),
      maxYJump: Math.max(0, ...yJumps),
      distinctYPositions: new Set(
        scrollSamples.map((entry) => entry.backgroundY.toFixed(3))
      ).size,
    }
  })

  assert.ok(
    Math.abs(result.final.sectionTop) <= 1,
    `Next doit finir alignée au viewport (${result.final.sectionTop}px)`
  )
  assert.ok(
    Math.abs(result.final.backgroundY) <= 0.1,
    `Le fond Next doit converger vers y=0 (${result.final.backgroundY}px)`
  )
  assert.ok(
    result.maxYJump <= 2,
    `Le parallax doit rester continu (${result.maxYJump}px entre deux frames)`
  )
  assert.ok(
    result.distinctYPositions >= 5,
    'Le fond doit progresser sur plusieurs positions intermédiaires'
  )
} finally {
  await browser.close()
}

console.log('PASS next background alignment')
