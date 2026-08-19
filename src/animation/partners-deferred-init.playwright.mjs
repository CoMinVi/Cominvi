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

const browser = await chromium.launch()
const page = await browser.newPage({ ...devices['iPhone 13'] })

try {
  await serveLocalBuild(page)
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(
    () => window.lenis && document.querySelector('.cylindar__wrapper')
  )
  await page.waitForTimeout(2300)

  const result = await page.evaluate(async () => {
    const partners = document.querySelector('.section_partners')
    const cylinder = partners.querySelector('.cylindar__wrapper')

    window.lenis.scrollTo(9000, { immediate: true })
    let offscreenMutations = 0
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === 'attributes') offscreenMutations += 1
      })
    })
    observer.observe(partners, { subtree: true, attributes: true })
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
    observer.disconnect()

    const initializedAtCards =
      cylinder.parentElement?.classList.contains('pin-spacer') || false
    const preparedAtCards = Boolean(cylinder.__cylinderCleanup)
    const partnersTop =
      partners.getBoundingClientRect().top + window.lenis.scroll

    window.lenis.scrollTo(partnersTop - window.innerHeight * 1.5, {
      immediate: true,
    })
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 800))

    const initializedNearPartners =
      cylinder.parentElement?.classList.contains('pin-spacer') || false
    const textWrapper = cylinder.querySelector('.cylindar__text__wrapper')
    const readState = () => ({
      activeLabel:
        cylinder
          .querySelector('.cylindar__text__item .is-active')
          ?.textContent?.trim() || '',
      transform: getComputedStyle(textWrapper).transform,
    })
    const cylinderTop =
      cylinder.getBoundingClientRect().top + window.lenis.scroll

    window.lenis.scrollTo(cylinderTop + 200, { immediate: true })
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150))
    const firstState = readState()

    window.lenis.scrollTo(cylinderTop + 1200, { immediate: true })
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150))
    const secondState = readState()

    return {
      offscreenMutations,
      initializedAtCards,
      preparedAtCards,
      initializedNearPartners,
      firstState,
      secondState,
    }
  })

  assert.equal(
    result.preparedAtCards,
    true,
    'Le cylindre Partners doit être préparé pendant le loader'
  )
  assert.equal(
    result.initializedAtCards,
    false,
    'Le pin Partners doit rester désactivé au niveau des cards'
  )
  assert.ok(
    result.offscreenMutations < 50,
    `Le pin Partners préparé doit rester inactif avant son approche (${result.offscreenMutations} mutations)`
  )
  assert.equal(
    result.initializedNearPartners,
    true,
    'Le pin Partners doit être prêt avant son entrée dans le viewport'
  )
  assert.notEqual(
    result.secondState.transform,
    result.firstState.transform,
    'Le cylindre doit toujours tourner'
  )
  assert.ok(result.firstState.activeLabel, 'Un partenaire doit être actif')
  assert.ok(result.secondState.activeLabel, 'Un partenaire doit rester actif')
  assert.notEqual(
    result.secondState.activeLabel,
    result.firstState.activeLabel,
    'Le partenaire actif doit évoluer avec le scroll'
  )
} finally {
  await browser.close()
}

console.log('PASS partners deferred initialization')
