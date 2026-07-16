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

async function navigateWithBarba(
  page,
  linkSelector,
  expectedUrl,
  expectedNamespace
) {
  await page.evaluate((selector) => {
    window.__barbaContainerBeforeNavigation = document.querySelector(
      '[data-barba="container"]'
    )
    document.querySelector(selector).click()
  }, linkSelector)

  await page.waitForURL(expectedUrl)
  await page.waitForFunction((namespace) => {
    const currentContainer = document.querySelector('[data-barba="container"]')
    return (
      currentContainer !== window.__barbaContainerBeforeNavigation &&
      currentContainer?.getAttribute('data-barba-namespace') === namespace
    )
  }, expectedNamespace)
}

async function measureScrollRafCoalescing(page, consumer) {
  return page.evaluate((consumerName) => {
    const handlers = {
      navbar: () =>
        window.__navbarScrollTarget?.__navbarScrollListener ||
        window.__navbarScrollLenisTarget?.__navbarScrollListener ||
        null,
      next: () => window.__nextButtonStickyLenisHandler || null,
      theme: () => window.__themeScrollTarget?.__themeHandler || null,
    }
    const rafIds = {
      navbar: '__navbarScrollRafId',
      next: '__nextButtonStickyRafId',
      theme: '__themeScrollRafId',
    }
    const handler = handlers[consumerName]()
    assertHandler(handler)

    const originalRequestAnimationFrame = window.requestAnimationFrame
    const callbacks = []
    let nextRafId = 10000
    window.requestAnimationFrame = (callback) => {
      callbacks.push(callback)
      nextRafId += 1
      return nextRafId
    }

    try {
      for (let index = 0; index < 20; index += 1) {
        handler()
      }
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame
    }

    const scheduledRafCount = callbacks.length
    if (callbacks[0]) callbacks[0](performance.now())

    return {
      rafIdAfterUpdate: window[rafIds[consumerName]],
      scheduledRafCount,
    }

    function assertHandler(value) {
      if (typeof value !== 'function') {
        throw new Error(`handler ${consumerName} introuvable`)
      }
    }
  }, consumer)
}

async function measureRafCancellationOnReinit(page, consumer) {
  return page.evaluate(async (consumerName) => {
    const target =
      consumerName === 'navbar'
        ? window.__navbarScrollTarget || window.__navbarScrollLenisTarget
        : window.__themeScrollTarget || window.__themeScrollLenisTarget
    const handlerProperty =
      consumerName === 'navbar' ? '__navbarScrollListener' : '__themeHandler'
    const rafIdProperty =
      consumerName === 'navbar' ? '__navbarScrollRafId' : '__themeScrollRafId'
    const handler = target?.[handlerProperty]
    if (typeof handler !== 'function') {
      throw new Error(`handler ${consumerName} introuvable`)
    }

    const originalRequestAnimationFrame = window.requestAnimationFrame
    const originalCancelAnimationFrame = window.cancelAnimationFrame
    const pendingRafId = 424242
    const cancelledRafIds = []
    window.requestAnimationFrame = () => pendingRafId
    window.cancelAnimationFrame = (rafId) => cancelledRafIds.push(rafId)

    try {
      handler()
      if (consumerName === 'navbar') {
        const { initializeNavbarScroll } = await import('/src/animation/nav.js')
        initializeNavbarScroll(document)
      } else {
        window.__theme.bindScroll(document)
      }
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame
      window.cancelAnimationFrame = originalCancelAnimationFrame
    }

    return {
      cancelledPendingRaf: cancelledRafIds.includes(pendingRafId),
      rafIdAfterReinit: window[rafIdProperty],
    }
  }, consumer)
}

async function assertSectionReachable(page, selector) {
  const exists = await page.evaluate(
    (sectionSelector) => Boolean(document.querySelector(sectionSelector)),
    selector
  )
  assert.equal(exists, true, `${selector} doit exister`)

  await page.evaluate((sectionSelector) => {
    document.querySelector(sectionSelector).scrollIntoView({ block: 'start' })
  }, selector)
  await page.waitForFunction(
    ({ sectionSelector, viewportHeight }) => {
      const rect = document
        .querySelector(sectionSelector)
        .getBoundingClientRect()
      return (
        window.scrollY > viewportHeight &&
        rect.top < window.innerHeight &&
        rect.bottom > 0
      )
    },
    { sectionSelector: selector, viewportHeight: VIEWPORT_HEIGHT }
  )

  const position = await page.evaluate((sectionSelector) => {
    const rect = document.querySelector(sectionSelector).getBoundingClientRect()
    return {
      scrollY: window.scrollY,
      top: rect.top,
      bottom: rect.bottom,
      viewportHeight: window.innerHeight,
    }
  }, selector)

  assert.ok(
    position.scrollY > VIEWPORT_HEIGHT,
    `${selector} doit nécessiter un scroll vertical`
  )
  assert.ok(
    position.top < position.viewportHeight && position.bottom > 0,
    `${selector} doit être visible après scroll`
  )
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

    const initialNavbarLeft = await page.evaluate(
      () => getComputedStyle(document.querySelector('.navbar')).left
    )
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2))
    await page.waitForTimeout(700)
    const nativeEffects = await page.evaluate(() => ({
      scrollY: window.scrollY,
      navbarLeft: getComputedStyle(document.querySelector('.navbar')).left,
    }))

    assert.ok(
      nativeEffects.scrollY >= VIEWPORT_HEIGHT * 2,
      'le scroll natif doit progresser'
    )
    assert.notEqual(
      nativeEffects.navbarLeft,
      initialNavbarLeft,
      'la navbar doit recevoir un décalage après le scroll'
    )

    const initialNextTransform = await page.evaluate(
      () =>
        document.querySelector('.section_next .next-button-wrapper')?.style
          .transform || ''
    )
    await page.evaluate(() => {
      const section = document.querySelector('.section_next')
      const sectionTop = section.getBoundingClientRect().top + window.scrollY
      window.scrollTo(0, sectionTop + window.innerHeight / 2)
    })
    await page.waitForTimeout(100)
    const nextTransform = await page.evaluate(
      () =>
        document.querySelector('.section_next .next-button-wrapper')?.style
          .transform || ''
    )
    assert.notEqual(
      nextTransform,
      '',
      'le bouton Next doit être repositionné après le scroll'
    )
    assert.notEqual(
      nextTransform,
      initialNextTransform,
      'le bouton Next doit suivre le scroll natif'
    )

    await navigateWithBarba(
      page,
      '.nav-inner a[href="about-us.html"]',
      /about-us\.html/,
      'About us'
    )
    await navigateWithBarba(
      page,
      '.navbar > a[href="index.html"]',
      (url) => url.pathname === '/index.html',
      'home'
    )

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2))
    await page.waitForTimeout(700)
    const effectsAfterNavigation = await page.evaluate(() => ({
      scrollY: window.scrollY,
      navbarLeft: getComputedStyle(document.querySelector('.navbar')).left,
    }))
    assert.ok(
      effectsAfterNavigation.scrollY >= VIEWPORT_HEIGHT * 2,
      'le scroll natif doit rester actif après un cycle Barba'
    )
    assert.notEqual(
      effectsAfterNavigation.navbarLeft,
      initialNavbarLeft,
      'la navbar doit rester synchronisée après un cycle Barba'
    )

    await page.evaluate(() => {
      const wrapper = document.querySelector(
        '.section_next .next-button-wrapper'
      )
      wrapper.style.transform = 'translateX(123px)'
      window.dispatchEvent(new Event('scroll'))
    })
    await page.waitForTimeout(100)
    const updatedNextTransformAfterNavigation = await page.evaluate(
      () =>
        document.querySelector('.section_next .next-button-wrapper')?.style
          .transform || ''
    )
    assert.notEqual(
      updatedNextTransformAfterNavigation,
      'translateX(123px)',
      'le bouton Next doit rester synchronisé après un cycle Barba'
    )

    for (const consumer of ['navbar', 'next']) {
      const rafResult = await measureScrollRafCoalescing(page, consumer)
      assert.equal(
        rafResult.scheduledRafCount,
        1,
        `${consumer} doit coalescer une rafale de scroll dans un seul RAF`
      )
      assert.equal(
        rafResult.rafIdAfterUpdate,
        null,
        `${consumer} doit libérer son RAF après la mise à jour`
      )
    }

    if (width === NATIVE_WIDTHS[0]) {
      const cleanupResult = await measureRafCancellationOnReinit(page, 'navbar')
      assert.equal(
        cleanupResult.cancelledPendingRaf,
        true,
        'la navbar doit annuler son RAF pendant la réinitialisation'
      )
      assert.equal(
        cleanupResult.rafIdAfterReinit,
        null,
        'la navbar doit réinitialiser son ID RAF'
      )
    }

    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight)
    })
    await page.waitForFunction(
      (height) => window.scrollY > height,
      VIEWPORT_HEIGHT
    )

    await assertSectionReachable(page, '.section_technology')
    await assertSectionReachable(page, '.section_partners')
  } finally {
    await page.close()
  }
}

async function checkThemeScrollCoalescing(browser) {
  const page = await browser.newPage({
    viewport: { width: NATIVE_WIDTHS[0], height: VIEWPORT_HEIGHT },
  })

  try {
    await page.route(/\/src\/animation\/nav\.js(?:\?.*)?$/, async (route) => {
      const response = await route.fetch()
      const source = await response.text()
      const enabledSource = source.replace(
        'const ENABLE_NAV_THEME_SWITCHER = false',
        'const ENABLE_NAV_THEME_SWITCHER = true'
      )
      assert.notEqual(
        enabledSource,
        source,
        'le scénario doit activer le contrôleur de thème complet'
      )
      await route.fulfill({ response, body: enabledSource })
    })
    await useLocalApplicationSource(page)
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    await page.waitForFunction(
      () => typeof window.__themeScrollTarget?.__themeHandler === 'function'
    )

    const rafResult = await measureScrollRafCoalescing(page, 'theme')
    assert.equal(
      rafResult.scheduledRafCount,
      1,
      'le thème doit coalescer une rafale de scroll dans un seul RAF'
    )
    assert.equal(
      rafResult.rafIdAfterUpdate,
      null,
      'le thème doit libérer son RAF après la mise à jour'
    )
    const cleanupResult = await measureRafCancellationOnReinit(page, 'theme')
    assert.equal(
      cleanupResult.cancelledPendingRaf,
      true,
      'le thème doit annuler son RAF pendant la réinitialisation'
    )
    assert.equal(
      cleanupResult.rafIdAfterReinit,
      null,
      'le thème doit réinitialiser son ID RAF'
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
    const rafResult = await measureScrollRafCoalescing(page, 'navbar')
    assert.equal(
      rafResult.scheduledRafCount,
      1,
      'la navbar Lenis doit coalescer une rafale dans un seul RAF'
    )
    assert.equal(
      await page.evaluate(() => window.__navbarScrollTarget),
      null,
      'la cible native navbar doit rester nulle avec Lenis'
    )
  } finally {
    await page.close()
  }
}

async function checkLifecycleCleanup(browser) {
  const page = await browser.newPage({
    viewport: { width: DESKTOP_WIDTH, height: VIEWPORT_HEIGHT },
  })

  try {
    await useLocalApplicationSource(page)
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })

    const result = await page.evaluate(async () => {
      const scrollTriggerUrl = performance
        .getEntriesByType('resource')
        .map(({ name }) => name)
        .find((url) => url.includes('gsap_ScrollTrigger'))
      const [{ initLenis, destroyLenis }, { ScrollTrigger }] =
        await Promise.all([
          import('/src/animation/scroll.js'),
          import(scrollTriggerUrl),
        ])
      const originalScrollerProxy = ScrollTrigger.scrollerProxy
      const proxyCalls = []

      ScrollTrigger.scrollerProxy = function (...args) {
        proxyCalls.push(args)
        return originalScrollerProxy.apply(this, args)
      }

      try {
        const firstLenis = initLenis(document)
        const oldWrapper = window.__lenisWrapper
        const replacementWrapper = oldWrapper.cloneNode(true)
        const proxies = ScrollTrigger.core._proxies
        let staleScrollToCalls = 0
        const originalScrollTo = firstLenis.scrollTo.bind(firstLenis)

        firstLenis.scrollTo = (...args) => {
          staleScrollToCalls += 1
          return originalScrollTo(...args)
        }
        proxyCalls.length = 0
        oldWrapper.replaceWith(replacementWrapper)

        initLenis(document)
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        )

        const proxyRemovedDuringReinit = proxyCalls.some(
          (args) => args.length === 1 && args[0] === oldWrapper
        )
        const oldWrapperStillProxied = proxies.includes(oldWrapper)
        const replacementWrapperProxied = proxies.includes(replacementWrapper)
        destroyLenis()
        const replacementStillProxiedAfterDestroy =
          proxies.includes(replacementWrapper)

        return {
          oldWrapperStillProxied,
          proxiesIsArray: Array.isArray(proxies),
          proxyRemovedDuringReinit,
          replacementStillProxiedAfterDestroy,
          replacementWrapperProxied,
          staleScrollToCalls,
        }
      } finally {
        ScrollTrigger.scrollerProxy = originalScrollerProxy
        destroyLenis()
      }
    })

    assert.equal(
      result.staleScrollToCalls,
      0,
      "le RAF d'une ancienne instance ne doit pas appeler scrollTo"
    )
    assert.equal(
      result.proxyRemovedDuringReinit,
      true,
      "le proxy de l'ancien wrapper doit être retiré pendant la réinitialisation"
    )
    assert.equal(
      result.proxiesIsArray,
      true,
      'ScrollTrigger.core._proxies doit être un tableau inspectable'
    )
    assert.equal(
      result.oldWrapperStillProxied,
      false,
      "l'ancien wrapper ne doit plus être présent dans core._proxies"
    )
    assert.equal(
      result.replacementWrapperProxied,
      true,
      'le nouveau wrapper doit disposer de son propre proxy'
    )
    assert.equal(
      result.replacementStillProxiedAfterDestroy,
      false,
      'le nouveau wrapper doit quitter core._proxies après destruction'
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
      await checkThemeScrollCoalescing(browser)
      console.log('PASS theme RAF coalescing')
    } catch (error) {
      hasFailure = true
      console.error(`FAIL theme RAF coalescing: ${error.message}`)
    }

    try {
      await checkDesktopScroll(browser)
      console.log(`PASS Lenis @ ${DESKTOP_WIDTH}px`)
    } catch (error) {
      hasFailure = true
      console.error(`FAIL Lenis @ ${DESKTOP_WIDTH}px: ${error.message}`)
    }

    try {
      await checkLifecycleCleanup(browser)
      console.log('PASS lifecycle cleanup')
    } catch (error) {
      hasFailure = true
      console.error(`FAIL lifecycle cleanup: ${error.message}`)
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
