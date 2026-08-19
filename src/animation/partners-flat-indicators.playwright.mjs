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

  await page.route('http://localhost:3000/@vite/client', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: '' })
  )
  await page.route('http://localhost:3000/src/main.js', async (route) => {
    const body = await readFile(resolve('dist', 'main.js'))
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body,
    })
  })
  await page.route('http://localhost:3000/src/assets/**/*.js', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    const body = await readFile(resolve('dist', pathname.replace('/src/', '')))
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body,
    })
  })
  await page.route('https://cominvi.netlify.app/main.js', serveJavaScript)
  await page.route(
    'https://cominvi.netlify.app/assets/**/*.js',
    serveJavaScript
  )
}

async function verifyViewport(browser, contextOptions, label) {
  const context = await browser.newContext(contextOptions)
  const page = await context.newPage()

  try {
    await serveLocalBuild(page)
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForFunction(
      () => window.lenis && document.querySelector('.cylindar__wrapper')
    )
    await page.waitForTimeout(2300)

    const result = await page.evaluate(async () => {
      const cylinder = document.querySelector(
        '.section_partners .cylindar__wrapper'
      )
      const indicators = Array.from(
        cylinder.querySelectorAll('.scroll-indicator_c')
      )
      const items = Array.from(
        cylinder.querySelectorAll('.cylindar__text__item')
      )
      const cylinderTop =
        cylinder.getBoundingClientRect().top + window.lenis.scroll
      const isMobile = Math.min(window.innerWidth, window.innerHeight) < 767
      const scrollRange = isMobile
        ? Math.max(1, 2500 - window.innerHeight)
        : window.innerHeight * 20

      const readState = () => {
        const cylinderRect = cylinder.getBoundingClientRect()
        const textWrapper = cylinder.querySelector(
          '.cylindar__text__wrapper'
        )
        const activeTextIndex = items.findIndex((item) =>
          item
            .querySelector('.body-xl, .body-xxl, .body-next')
            ?.classList.contains('is-active')
        )

        return {
          cylinderTop: cylinderRect.top,
          cylinderHeight: cylinderRect.height,
          indicatorHeight: Math.min(window.innerWidth, window.innerHeight) * 0.4,
          textTransform: getComputedStyle(textWrapper).transform,
          activeTextIndex,
          textCount: items.length,
          indicators: indicators.map((indicator) => {
            const ticks = Array.from(
              indicator.querySelectorAll('.scroll-tick')
            )
            return {
              height: indicator.getBoundingClientRect().height,
              top: indicator.getBoundingClientRect().top,
              transform: getComputedStyle(indicator).transform,
              firstTop: ticks[0]?.style.top,
              lastTop: ticks.at(-1)?.style.top,
              activeTickIndex: ticks.findIndex((tick) =>
                tick.classList.contains('is-xxl')
              ),
              tickCount: ticks.length,
            }
          }),
        }
      }

      const states = []
      for (const progress of [0.08, 0.5, 0.92]) {
        window.lenis.scrollTo(cylinderTop + scrollRange * progress, {
          immediate: true,
        })
        await new Promise((resolvePromise) =>
          setTimeout(resolvePromise, isMobile ? 300 : 180)
        )
        states.push(readState())
      }

      return states
    })

    result.forEach((state, sampleIndex) => {
      assert.equal(state.indicators.length, 2, `${label}: deux indicators`)
      state.indicators.forEach((indicator) => {
        assert.ok(
          Math.abs(indicator.height - state.indicatorHeight) < 1,
          `${label}: hauteur indicator/portion visible au point ${sampleIndex}`
        )
        assert.equal(
          indicator.transform,
          'none',
          `${label}: indicator sans transformation indépendante`
        )
        assert.ok(
          Math.abs(
            indicator.top -
              (state.cylinderTop +
                (state.cylinderHeight - indicator.height) / 2)
          ) < 1,
          `${label}: indicator sticky centré dans le viewport`
        )
        assert.equal(indicator.firstTop, '0%', `${label}: premier tick en haut`)
        assert.equal(
          indicator.lastTop,
          '100%',
          `${label}: dernier tick en bas`
        )
        assert.ok(indicator.activeTickIndex >= 0, `${label}: tick actif`)

        const textRatio =
          state.activeTextIndex / Math.max(1, state.textCount - 1)
        const tickRatio =
          indicator.activeTickIndex / Math.max(1, indicator.tickCount - 1)
        const roundingTolerance =
          0.5 / Math.max(1, state.textCount - 1) +
          0.5 / Math.max(1, indicator.tickCount - 1)
        assert.ok(
          Math.abs(textRatio - tickRatio) <= roundingTolerance,
          `${label}: tick actif synchronisé au partenaire (${textRatio} / ${tickRatio})`
        )
      })
    })

    assert.notEqual(
      result[0].textTransform,
      result.at(-1).textTransform,
      `${label}: les noms continuent à tourner en 3D`
    )
    assert.ok(
      result[0].indicators[0].activeTickIndex <
        result.at(-1).indicators[0].activeTickIndex,
      `${label}: la zone active descend`
    )
  } finally {
    await context.close()
  }
}

const browser = await chromium.launch()

try {
  await verifyViewport(browser, { viewport: { width: 1440, height: 900 } }, 'desktop')
  await verifyViewport(browser, devices['iPhone 13'], 'mobile')
} finally {
  await browser.close()
}

console.log('PASS partners flat indicators')
