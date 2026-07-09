import { chromium } from 'playwright'

const URL = 'https://cominvi-staging.webflow.io'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const logs = []
page.on('console', (msg) => {
  logs.push({ type: msg.type(), text: msg.text() })
})
page.on('pageerror', (err) => {
  logs.push({ type: 'pageerror', text: err.message })
})

const requests = []
page.on('request', (req) => {
  const url = req.url()
  if (
    /cave-scene|main\.js|hero-critical|manifest\.json|intro\.mp4|frame_/.test(url)
  ) {
    requests.push({ url, method: req.method() })
  }
})

const responses = []
page.on('response', async (res) => {
  const url = res.url()
  if (
    /cave-scene|main\.js|hero-critical|manifest\.json|intro\.mp4|frame_/.test(url)
  ) {
    responses.push({ url, status: res.status() })
  }
})

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(8000)

const state = await page.evaluate(() => {
  const introVideo = document.querySelector(
    'video[data-cominvi-hero-intro-video="true"]'
  )
  const webflowVideo = document.querySelector('#hero-bg-video')
  const canvas = document.querySelector('[data-loader-sequence-canvas="true"]')
  const poster = document.querySelector(
    'img[data-cominvi-hero-poster-img="true"]'
  )
  const loader = document.querySelector('.loader')

  const cs = (el) => {
    if (!el) return null
    const s = getComputedStyle(el)
    return {
      display: s.display,
      visibility: s.visibility,
      opacity: s.opacity,
      zIndex: s.zIndex,
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
    }
  }

  return {
    mainJs: [...document.querySelectorAll('script[src*="main.js"]')].map(
      (s) => s.src
    ),
    heroCritical: [...document.querySelectorAll('script[src*="hero-critical"]')].map(
      (s) => s.src
    ),
    loaderVisible: loader ? getComputedStyle(loader).opacity : null,
    loaderExists: !!loader,
    introVideo: introVideo
      ? {
          src: introVideo.currentSrc || introVideo.src,
          readyState: introVideo.readyState,
          currentTime: introVideo.currentTime,
          videoWidth: introVideo.videoWidth,
          videoHeight: introVideo.videoHeight,
          locked: introVideo.getAttribute('data-cominvi-hero-locked'),
          afOnly: introVideo.getAttribute('data-cominvi-home-af-only'),
          styles: cs(introVideo),
        }
      : null,
    webflowVideo: webflowVideo
      ? {
          src: webflowVideo.currentSrc || webflowVideo.src,
          styles: cs(webflowVideo),
          afOnly: webflowVideo.getAttribute('data-cominvi-home-af-only'),
        }
      : null,
    canvas: canvas
      ? {
          width: canvas.width,
          height: canvas.height,
          styles: cs(canvas),
        }
      : null,
    poster: poster
      ? {
          src: poster.src,
          styles: cs(poster),
        }
      : null,
    controller: window.__homeSequenceController
      ? {
          hasSetIntro: typeof window.__homeSequenceController.setIntroProgress ===
            'function',
          host: !!window.__homeSequenceController.__hostEl,
        }
      : null,
    scrollTrigger: !!window.__homeSequenceScrollTrigger,
    loaderDone: window.__loaderDone || false,
  }
})

console.log('=== DOM STATE ===')
console.log(JSON.stringify(state, null, 2))
console.log('\n=== NETWORK RESPONSES (hero assets) ===')
console.log(JSON.stringify(responses, null, 2))
console.log('\n=== CONSOLE (errors/warnings) ===')
for (const log of logs) {
  if (log.type === 'error' || log.type === 'pageerror' || log.type === 'warning') {
    console.log(`[${log.type}] ${log.text}`)
  }
}
console.log('\n=== ALL CONSOLE (last 30) ===')
for (const log of logs.slice(-30)) {
  console.log(`[${log.type}] ${log.text}`)
}

await browser.close()
