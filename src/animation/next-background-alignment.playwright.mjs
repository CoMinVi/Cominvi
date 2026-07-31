import assert from 'node:assert/strict'
import { chromium, devices } from 'playwright'

const BASE_URL =
  process.env.BASE_URL || 'https://cominvi-staging.webflow.io/about-us'
const isDesktop = process.env.VIEWPORT === 'desktop'

async function main() {
  const browser = await chromium.launch({
    args: [
      '--disable-web-security',
      '--disable-features=BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessRespectPreflightResults',
    ],
  })
  const page = await browser.newPage(
    isDesktop
      ? { viewport: { width: 1440, height: 900 } }
      : devices['iPhone 13']
  )

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForFunction(
      () => window.lenis && document.querySelector('[data-barba="container"]')
    )
    await page.waitForTimeout(2000)

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
        const backgroundRect = background.getBoundingClientRect()
        const sectionRect = section.getBoundingClientRect()
        const destinationContainer = Array.from(
          document.querySelectorAll('[data-barba="container"]')
        ).find((candidate) => candidate !== container)
        const destinationHeroRect = destinationContainer
          ?.querySelector('.hero-background .background-inner')
          ?.getBoundingClientRect()
        samples.push({
          time: performance.now() - start,
          sectionTop: sectionRect.top,
          sectionWidth: sectionRect.width,
          sectionHeight: sectionRect.height,
          backgroundY: parseFloat(background._gsap?.y || '0') || 0,
          backgroundRect: {
            top: backgroundRect.top,
            left: backgroundRect.left,
            width: backgroundRect.width,
            height: backgroundRect.height,
          },
          destinationHeroRect: destinationHeroRect
            ? {
                top: destinationHeroRect.top,
                left: destinationHeroRect.left,
                width: destinationHeroRect.width,
                height: destinationHeroRect.height,
              }
            : null,
          containerPosition: getComputedStyle(container).position,
        })
        if (performance.now() - start < 2500) requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
      anchor.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 2600))

      const firstAbsoluteIndex = samples.findIndex(
        (entry) => entry.containerPosition === 'absolute'
      )
      const scrollSamples = samples.slice(
        0,
        firstAbsoluteIndex >= 0 ? firstAbsoluteIndex + 1 : samples.length
      )
      const yJumps = scrollSamples
        .slice(1)
        .map((entry, index) =>
          Math.abs(entry.backgroundY - scrollSamples[index].backgroundY)
        )
      const destinationHeroRect = scrollSamples.at(-1)?.destinationHeroRect

      return {
        final: scrollSamples.at(-1),
        maxYJump: Math.max(0, ...yJumps),
        distinctYPositions: new Set(
          scrollSamples.map((entry) => entry.backgroundY.toFixed(3))
        ).size,
        destinationHeroRect: destinationHeroRect
          ? {
              top: destinationHeroRect.top,
              left: destinationHeroRect.left,
              width: destinationHeroRect.width,
              height: destinationHeroRect.height,
            }
          : null,
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
    assert.ok(
      Math.abs(
        result.final.backgroundRect.width - result.final.sectionWidth * 1.2
      ) <= 1,
      `Le fond Next doit avoir la largeur d'un Hero standard (${result.final.backgroundRect.width}px)`
    )
    assert.ok(
      Math.abs(
        result.final.backgroundRect.height - result.final.sectionHeight * 1.2
      ) <= 1,
      `Le fond Next doit avoir la hauteur d'un Hero standard (${result.final.backgroundRect.height}px)`
    )
    assert.ok(
      result.destinationHeroRect,
      'Le Hero de destination doit être disponible pendant la transition'
    )
    assert.ok(
      Math.abs(
        result.final.backgroundRect.width - result.destinationHeroRect.width
      ) <= 1 &&
        Math.abs(
          result.final.backgroundRect.height - result.destinationHeroRect.height
        ) <= 1 &&
        Math.abs(
          result.final.backgroundRect.left - result.destinationHeroRect.left
        ) <= 1 &&
        Math.abs(
          result.final.backgroundRect.top - result.destinationHeroRect.top
        ) <= 1,
      'Le fond Next doit se superposer exactement au Hero de destination'
    )

    await page.goto(new URL('/technology', BASE_URL).href, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await page.waitForFunction(
      () => window.lenis && document.querySelector('.hero-background')
    )
    await page.waitForTimeout(5000)
    const technologyHero = await page.evaluate(() => {
      const wrapper = document.querySelector('.hero-background')
      const background = wrapper?.querySelector('.background-inner')
      if (!wrapper || !background) return null
      const wrapperRect = wrapper.getBoundingClientRect()
      const backgroundRect = background.getBoundingClientRect()
      return {
        wrapperRect,
        backgroundRect,
        centerDeltaX:
          backgroundRect.left +
          backgroundRect.width / 2 -
          (wrapperRect.left + wrapperRect.width / 2),
        centerDeltaY:
          backgroundRect.top +
          backgroundRect.height / 2 -
          (wrapperRect.top + wrapperRect.height / 2),
      }
    })
    assert.ok(technologyHero, 'Le Hero Technology doit être disponible')
    assert.ok(
      Math.abs(
        technologyHero.backgroundRect.width -
          technologyHero.wrapperRect.width * 1.2
      ) <= 1 &&
        Math.abs(
          technologyHero.backgroundRect.height -
            technologyHero.wrapperRect.height * 1.2
        ) <= 1 &&
        Math.abs(technologyHero.centerDeltaX) <= 1 &&
        Math.abs(technologyHero.centerDeltaY) <= 1,
      `Le Hero Technology doit reprendre la géométrie des Hero standards (${JSON.stringify(
        technologyHero
      )})`
    )
  } finally {
    await browser.close()
  }

  console.log('PASS next background alignment')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
