import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { chromium } from 'playwright'

const root = join(fileURLToPath(new URL('../../', import.meta.url)))
const dist = join(root, 'dist')

async function openServices(page) {
  await page.goto('https://cominvi-staging.webflow.io/our-services', {
    waitUntil: 'domcontentloaded',
  })
  try {
    await page.waitForFunction(
      () =>
        document.querySelector('.project-card_read-more') &&
        document.querySelector('.process-progression-inner') &&
        typeof window.__mapMarkerSyncCleanup === 'function',
      null,
      { timeout: 15000 }
    )
  } catch (error) {
    console.error(
      'READY STATE:',
      await page.evaluate(() => ({
        button: !!document.querySelector('.project-card_read-more'),
        descriptions: document.querySelectorAll(
          '.project-card_infos-col.is-left .eyebrow-l-alt'
        ).length,
        mapModule: !!document.querySelector('.marker-hitbox'),
        cleanup: typeof window.__mapMarkerSyncCleanup,
        lenis: !!window.lenis,
        loaderDone: window.__loaderDone,
        main: [...document.scripts].map((script) => script.src),
      }))
    )
    throw error
  }
  await page.waitForTimeout(500)
}

async function scrollTo(page, selector, offset = 0) {
  await page.evaluate(
    ({ targetSelector, targetOffset }) => {
      const target = document.querySelector(targetSelector)
      if (!target) return
      const wrapper = window.__lenisWrapper
      const current = window.lenis?.scroll ?? wrapper?.scrollTop ?? 0
      const destination =
        current + target.getBoundingClientRect().top + targetOffset
      if (window.lenis) {
        window.lenis.scrollTo(destination, { force: true, immediate: true })
      } else if (wrapper) {
        wrapper.scrollTop = destination
      } else {
        window.scrollTo(0, destination)
      }
    },
    { targetSelector: selector, targetOffset: offset }
  )
  await page.waitForTimeout(100)
}

test('les états map et process restent stables pendant leurs transitions', async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await page.route('https://cominvi.netlify.app/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname
      const filePath = join(dist, pathname.slice(1))
      if (!existsSync(filePath)) {
        await route.abort()
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: readFileSync(filePath),
      })
    })
    await page.route('http://localhost:3000/@vite/client', (route) =>
      route.abort()
    )
    await page.route('http://localhost:3000/src/main.js', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: readFileSync(join(dist, 'main.js')),
      })
    )
    await page.route('http://localhost:3000/src/assets/**', (route) => {
      const pathname = new URL(route.request().url()).pathname
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: readFileSync(join(dist, 'assets', pathname.split('/').pop())),
      })
    })
    await openServices(page)

    await scrollTo(page, '.section_projects', -100)
    const firstCard = page.locator('.project-item').first()
    await firstCard.hover()
    await page.waitForTimeout(600)

    const button = firstCard.locator('.project-card_read-more')
    const markerSamplesPromise = page.evaluate(async () => {
      const read = () =>
        Array.from(document.querySelectorAll('.marker:not(.highlight)')).map(
          (marker) => Number.parseFloat(getComputedStyle(marker).opacity)
        )
      const samples = []
      const startedAt = performance.now()
      while (performance.now() - startedAt < 700) {
        samples.push(read())
        await new Promise((resolve) => requestAnimationFrame(resolve))
      }
      return samples
    })
    await button.click()
    const markerSamples = await markerSamplesPromise
    const markersStayedHidden = !markerSamples
      .flat()
      .some((opacity) => opacity > 0.05)

    const processState = await page.evaluate(async () => {
      const processes = document.querySelector('.processes')
      const processItems = Array.from(
        processes?.querySelectorAll('.process') || []
      )
      const lastProcess = processItems[processItems.length - 1]
      const lastVideo = processes?.querySelector(':scope > .video')
      const lastBorder = lastProcess?.querySelector('.process_inner')
      const indicator = processes?.querySelector('.process-progression-inner')
      const videoMedia = lastVideo?.querySelector('.video-inner, video, img')
      const wrapper = window.__lenisWrapper
      const current = window.lenis?.scroll ?? wrapper?.scrollTop ?? 0
      const targetScroll =
        current +
        (processes?.getBoundingClientRect().bottom || 0) -
        window.innerHeight -
        32

      window.lenis?.scrollTo(targetScroll - 100, {
        force: true,
        immediate: true,
      })
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
      const before = {
        indicatorTop: indicator?.getBoundingClientRect().top,
        videoTop: lastVideo?.getBoundingClientRect().top,
      }

      window.lenis?.scrollTo(targetScroll, { force: true, immediate: true })
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
      await new Promise((resolve) => setTimeout(resolve, 600))

      const borderAlpha = () => {
        const color = getComputedStyle(lastBorder).borderBottomColor
        const match = color.match(/rgba?\([^,]+,[^,]+,[^,]+(?:,\s*([^)]+))?\)/)
        return match?.[1] == null ? 1 : Number.parseFloat(match[1])
      }
      const first = {
        borderAlpha: borderAlpha(),
        borderBottom: lastBorder?.getBoundingClientRect().bottom,
        videoMediaBottom: videoMedia?.getBoundingClientRect().bottom,
        indicatorTop: indicator?.getBoundingClientRect().top,
        videoTop: lastVideo?.getBoundingClientRect().top,
        lastProcess: lastProcess?.getBoundingClientRect().toJSON(),
        processInfos: lastProcess
          ?.querySelector('.process-infos')
          ?.getBoundingClientRect()
          .toJSON(),
        processes: processes?.getBoundingClientRect().toJSON(),
      }

      window.lenis?.scrollTo(targetScroll + 48, {
        force: true,
        immediate: true,
      })
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
      await new Promise((resolve) => setTimeout(resolve, 100))
      const second = {
        borderAlpha: borderAlpha(),
        indicatorTop: indicator?.getBoundingClientRect().top,
        videoTop: lastVideo?.getBoundingClientRect().top,
      }
      return { before, first, second }
    })

    assert.ok(
      processState.first.borderAlpha > 0.2 &&
        processState.second.borderAlpha >=
          processState.first.borderAlpha - 0.01,
      `la dernière bordure baisse après son apparition (${processState.first.borderAlpha} → ${processState.second.borderAlpha})`
    )
    const borderLead =
      processState.first.borderBottom - processState.first.videoMediaBottom
    assert.ok(
      Math.abs(borderLead) <= 2,
      `la dernière bordure et le bas visible de la vidéo sont décalés de ${Math.round(
        borderLead
      )}px`
    )

    const indicatorDistances = [
      processState.before,
      processState.first,
      processState.second,
    ].map((sample) => sample.indicatorTop - sample.videoTop)
    assert.ok(
      Math.max(...indicatorDistances) - Math.min(...indicatorDistances) <= 2,
      `la distance indicateur/vidéo varie (${indicatorDistances
        .map((distance) => Math.round(distance))
        .join(', ')}px)`
    )
    assert.equal(
      markersStayedHidden,
      true,
      'les markers non actifs redeviennent visibles pendant Show more'
    )
  } finally {
    await browser.close()
  }
})
