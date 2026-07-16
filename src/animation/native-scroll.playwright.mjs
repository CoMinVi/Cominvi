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

async function countTrackedWindowScrollListeners(page) {
  const session = await page.context().newCDPSession(page)
  const scriptUrls = new Map()
  session.on('Debugger.scriptParsed', ({ scriptId, url }) => {
    scriptUrls.set(scriptId, url)
  })

  try {
    await session.send('Debugger.enable')
    const { result } = await session.send('Runtime.evaluate', {
      expression: 'window',
    })
    const { listeners } = await session.send('DOMDebugger.getEventListeners', {
      objectId: result.objectId,
    })
    return listeners.filter(({ scriptId, type }) => {
      const scriptUrl = scriptUrls.get(scriptId) || ''
      return (
        type === 'scroll' &&
        (scriptUrl.includes('/src/animation/nav.js') ||
          scriptUrl.includes('/src/animation/parallax.js'))
      )
    }).length
  } finally {
    await session.detach()
  }
}

async function measureScrollEventRafCoalescing(page, consumer) {
  return page.evaluate((consumerName) => {
    const consumers = {
      navbar: {
        handler:
          window.__navbarScrollTarget?.__navbarScrollListener ||
          window.__navbarScrollLenisTarget?.__navbarScrollListener ||
          null,
        target:
          window.__navbarScrollTarget ||
          window.__navbarScrollLenisTarget ||
          null,
      },
      next: {
        handler: window.__nextButtonStickyLenisHandler || null,
        target:
          window.__nextButtonStickyScrollTarget ||
          (window.lenis ? window.lenis : null),
      },
      theme: {
        handler: window.__themeScrollTarget?.__themeHandler || null,
        target:
          window.__themeScrollTarget || window.__themeScrollLenisTarget || null,
      },
    }
    const rafIds = {
      navbar: '__navbarScrollRafId',
      next: '__nextButtonStickyRafId',
      theme: '__themeScrollRafId',
    }
    const selectedConsumer = consumers[consumerName]
    assertConsumer(selectedConsumer)
    const mutedConsumers = Object.entries(consumers)
      .filter(
        ([name, entry]) =>
          name !== consumerName &&
          entry.handler &&
          entry.target === selectedConsumer.target
      )
      .map(([, entry]) => entry)

    const originalRequestAnimationFrame = window.requestAnimationFrame
    let nextRafId = 10000
    const setListenerEnabled = ({ handler, target }, enabled) => {
      if (target instanceof EventTarget) {
        if (enabled) {
          target.addEventListener('scroll', handler, { passive: true })
        } else {
          target.removeEventListener('scroll', handler)
        }
      } else if (enabled) {
        target.on('scroll', handler)
      } else {
        target.off('scroll', handler)
      }
    }
    const dispatchScrollBurst = () => {
      const callbacks = []
      window.requestAnimationFrame = (callback) => {
        callbacks.push(callback)
        nextRafId += 1
        return nextRafId
      }
      try {
        for (let index = 0; index < 20; index += 1) {
          if (selectedConsumer.target instanceof EventTarget) {
            selectedConsumer.target.dispatchEvent(new Event('scroll'))
          } else {
            selectedConsumer.target.emitter.emit(
              'scroll',
              selectedConsumer.target
            )
          }
        }
      } finally {
        window.requestAnimationFrame = originalRequestAnimationFrame
      }
      return callbacks
    }

    let selectedConsumerIsAttached = true
    let baselineCallbacks = []
    let measuredCallbacks = []
    try {
      mutedConsumers.forEach((entry) => setListenerEnabled(entry, false))
      setListenerEnabled(selectedConsumer, false)
      selectedConsumerIsAttached = false
      baselineCallbacks = dispatchScrollBurst()
      setListenerEnabled(selectedConsumer, true)
      selectedConsumerIsAttached = true
      baselineCallbacks.forEach((callback) => callback(performance.now()))
      measuredCallbacks = dispatchScrollBurst()
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame
      if (!selectedConsumerIsAttached) {
        setListenerEnabled(selectedConsumer, true)
      }
      mutedConsumers.forEach((entry) => setListenerEnabled(entry, true))
    }

    const scheduledRafCount =
      measuredCallbacks.length - baselineCallbacks.length
    measuredCallbacks.forEach((callback) => callback(performance.now()))

    return {
      rafIdAfterUpdate: window[rafIds[consumerName]],
      scheduledRafCount,
    }

    function assertConsumer(value) {
      if (
        !value ||
        typeof value.handler !== 'function' ||
        (!value.target?.dispatchEvent && !value.target?.emitter?.emit)
      ) {
        throw new Error(`handler ${consumerName} introuvable`)
      }
    }
  }, consumer)
}

async function reinitializeNativeScrollConsumers(page, times = 3) {
  await page.evaluate(async (repeatCount) => {
    const [{ initializeNavbarScroll }, { initNextButtonSticky }] =
      await Promise.all([
        import('/src/animation/nav.js'),
        import('/src/animation/parallax.js'),
      ])

    for (let index = 0; index < repeatCount; index += 1) {
      initializeNavbarScroll(document)
      initNextButtonSticky(document)
      window.__theme?.bindScroll(document)
    }
  }, times)
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

    const windowScrollListenersBeforeNavigation =
      width === NATIVE_WIDTHS[0]
        ? await countTrackedWindowScrollListeners(page)
        : null

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
      const rafResult = await measureScrollEventRafCoalescing(page, consumer)
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
      const windowScrollListenersAfterNavigation =
        await countTrackedWindowScrollListeners(page)
      assert.equal(
        windowScrollListenersAfterNavigation,
        windowScrollListenersBeforeNavigation,
        'le cycle Barba ne doit conserver aucun listener scroll obsolète'
      )
      await reinitializeNativeScrollConsumers(page)
      const windowScrollListenersAfterReinitializations =
        await countTrackedWindowScrollListeners(page)
      assert.equal(
        windowScrollListenersAfterReinitializations,
        windowScrollListenersAfterNavigation,
        'les réinitialisations ne doivent pas multiplier les listeners scroll'
      )

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

    const rafResult = await measureScrollEventRafCoalescing(page, 'theme')
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

    const initialLifecycle = await page.evaluate(async () => {
      const scrollTriggerUrl = performance
        .getEntriesByType('resource')
        .map(({ name }) => name)
        .find((url) => url.includes('gsap_ScrollTrigger'))
      const { ScrollTrigger } = await import(scrollTriggerUrl)
      const proxies = ScrollTrigger.core._proxies
      const oldLenis = window.lenis
      const oldWrapper = window.__lenisWrapper
      const oldProxyIndex = proxies.indexOf(oldWrapper)
      const oldProxy = oldProxyIndex >= 0 ? proxies[oldProxyIndex + 1] : null

      window.__desktopLenisLifecycleSnapshot = {
        oldLenis,
        oldProxy,
        oldWrapper,
      }

      return {
        oldProxyPresent: oldProxy != null && proxies.includes(oldProxy),
        oldWrapperConnected: oldWrapper.isConnected,
        oldWrapperProxied: proxies.includes(oldWrapper),
      }
    })
    assert.equal(
      initialLifecycle.oldWrapperConnected,
      true,
      'le wrapper Lenis initial doit être connecté'
    )
    assert.equal(
      initialLifecycle.oldWrapperProxied,
      true,
      'le wrapper Lenis initial doit avoir un proxy'
    )
    assert.equal(
      initialLifecycle.oldProxyPresent,
      true,
      'le proxy Lenis initial doit être inspectable'
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

    const lifecycleAfterNavigation = await page.evaluate(async () => {
      const scrollTriggerUrl = performance
        .getEntriesByType('resource')
        .map(({ name }) => name)
        .find((url) => url.includes('gsap_ScrollTrigger'))
      const { ScrollTrigger } = await import(scrollTriggerUrl)
      const proxies = ScrollTrigger.core._proxies
      const snapshot = window.__desktopLenisLifecycleSnapshot
      delete window.__desktopLenisLifecycleSnapshot

      const newLenis = window.lenis
      const newWrapper = window.__lenisWrapper
      const newProxyIndex = proxies.indexOf(newWrapper)
      const newProxy = newProxyIndex >= 0 ? proxies[newProxyIndex + 1] : null
      const staleGlobalReferences = Object.getOwnPropertyNames(window).filter(
        (propertyName) => {
          try {
            const value = window[propertyName]
            return value === snapshot.oldLenis || value === snapshot.oldWrapper
          } catch {
            return false
          }
        }
      )

      return {
        newLenisCreated: newLenis !== snapshot.oldLenis,
        newProxyCreated: newProxy != null && newProxy !== snapshot.oldProxy,
        newProxyPresent: newProxy != null && proxies.includes(newProxy),
        newWrapperCreated: newWrapper !== snapshot.oldWrapper,
        newWrapperProxied: proxies.includes(newWrapper),
        oldProxyStillPresent: proxies.includes(snapshot.oldProxy),
        oldWrapperConnected: snapshot.oldWrapper.isConnected,
        oldWrapperStillProxied: proxies.includes(snapshot.oldWrapper),
        staleGlobalReferences,
      }
    })
    assert.equal(
      lifecycleAfterNavigation.newLenisCreated,
      true,
      'Barba doit créer une nouvelle instance Lenis au retour'
    )
    assert.equal(
      lifecycleAfterNavigation.newWrapperCreated,
      true,
      'Barba doit partager le nouveau conteneur comme wrapper Lenis'
    )
    assert.equal(
      lifecycleAfterNavigation.newWrapperProxied,
      true,
      'le nouveau wrapper doit être enregistré dans les proxies'
    )
    assert.equal(
      lifecycleAfterNavigation.newProxyCreated,
      true,
      'le nouveau wrapper doit recevoir un nouveau proxy'
    )
    assert.equal(
      lifecycleAfterNavigation.newProxyPresent,
      true,
      'le nouveau proxy doit rester actif'
    )
    assert.equal(
      lifecycleAfterNavigation.oldWrapperConnected,
      false,
      "l'ancien wrapper doit être retiré du DOM"
    )
    assert.equal(
      lifecycleAfterNavigation.oldWrapperStillProxied,
      false,
      "l'ancien wrapper doit être retiré des proxies"
    )
    assert.equal(
      lifecycleAfterNavigation.oldProxyStillPresent,
      false,
      "l'ancien proxy ne doit plus être référencé"
    )
    assert.deepEqual(
      lifecycleAfterNavigation.staleGlobalReferences,
      [],
      "aucune globale ne doit référencer l'ancien moteur ou wrapper"
    )

    const rafResult = await measureScrollEventRafCoalescing(page, 'navbar')
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
