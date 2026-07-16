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
const page = await browser.newPage({ ...devices['Pixel 5'] })

try {
  await serveLocalBuild(page)
  await page.addInitScript(() => {
    window.__heroHandoffEvents = []
    const timer = window.setInterval(() => {
      const controller = window.__homeSequenceController
      if (!controller || controller.__handoffTestPatched) return
      controller.__handoffTestPatched = true

      for (const method of [
        'setFrame',
        'startIntroPlayback',
        'finishIntroHandoff',
      ]) {
        const original = controller[method]?.bind(controller)
        if (!original) continue
        controller[method] = (...args) => {
          window.__heroHandoffEvents.push({
            method,
            args,
            time: performance.now(),
            loaderActive: Boolean(document.querySelector('.loader')),
          })
          return original(...args)
        }
      }
      window.clearInterval(timer)
    }, 1)
  })

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => window.__loaderDone === true, {
    timeout: 15000,
  })

  const result = await page.evaluate(() => {
    const events = window.__heroHandoffEvents || []
    return {
      events,
      earlyFrames: events.filter(
        (event) => event.method === 'setFrame' && event.loaderActive
      ),
      introStarted: events.some(
        (event) => event.method === 'startIntroPlayback'
      ),
      handoffCompleted: events.some(
        (event) => event.method === 'finishIntroHandoff'
      ),
    }
  })

  assert.equal(
    result.earlyFrames.length,
    0,
    'La séquence scroll ne doit pas peindre sa frame 0 pendant le loader'
  )
  assert.equal(result.introStarted, true, 'Le MP4 doit démarrer')
  assert.equal(result.handoffCompleted, true, 'Le handoff doit se terminer')
} finally {
  await browser.close()
}

console.log('PASS hero loader handoff')
