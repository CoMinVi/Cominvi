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
    const container = document.querySelector('[data-barba="container"]')
    const team = document.querySelector('.section_teams')
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
        containerPosition: getComputedStyle(container).position,
        teamHeight: team.getBoundingClientRect().height,
      })
      if (performance.now() - start < 650) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    anchor.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    )
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 700))

    const firstAbsolute = samples.find(
      (entry) => entry.containerPosition === 'absolute'
    )
    const positionsBeforeAbsolute = samples
      .filter(
        (entry) => !firstAbsolute || entry.time < firstAbsolute.time
      )
      .map((entry) => Math.round(entry.sectionTop))
    const jumpsBeforeAbsolute = positionsBeforeAbsolute
      .slice(1)
      .map((position, index) =>
        Math.abs(position - positionsBeforeAbsolute[index])
      )

    return {
      firstAbsolute,
      distinctScrollPositions: new Set(positionsBeforeAbsolute).size,
      initialTop: samples[0]?.sectionTop,
      initialTeamHeight: samples[0]?.teamHeight,
      maxTeamHeightDelta: Math.max(
        0,
        ...samples
          .filter(
            (entry) => !firstAbsolute || entry.time < firstAbsolute.time
          )
          .map((entry) => Math.abs(entry.teamHeight - samples[0].teamHeight))
      ),
      maxFrameJump: Math.max(0, ...jumpsBeforeAbsolute),
    }
  })

  assert.ok(result.initialTop > 100, 'La section doit commencer partiellement basse')
  assert.ok(result.firstAbsolute, 'Le container doit devenir absolu après le scroll')
  assert.ok(
    result.firstAbsolute.time >= 400,
    `Le container devient absolu trop tôt (${Math.round(
      result.firstAbsolute.time
    )} ms)`
  )
  assert.ok(
    result.distinctScrollPositions >= 5,
    'La section doit progresser sur plusieurs frames avant le placement absolu'
  )
  assert.ok(
    Math.abs(result.firstAbsolute.sectionTop) <= 1,
    `Next doit être alignée au viewport avant le placement absolu (${result.firstAbsolute.sectionTop}px)`
  )
  assert.ok(
    result.maxTeamHeightDelta <= 1,
    `Our Team ne doit pas changer de hauteur pendant le scroll (${result.maxTeamHeightDelta}px)`
  )
  assert.ok(
    result.maxFrameJump <= 50,
    `Le scroll ne doit pas sauter entre deux frames (${result.maxFrameJump}px)`
  )
} finally {
  await browser.close()
}

console.log('PASS next transition scroll')
