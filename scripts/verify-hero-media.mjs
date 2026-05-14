import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const mp4Path = new URL('../dist/home-background.mp4', import.meta.url)
const publicMp4Path = new URL('../public/home-background.mp4', import.meta.url)
const heroMediaPath = new URL('../src/app/hero-media.js', import.meta.url)

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function assertFastStartMp4(fileUrl) {
  const data = await readFile(fileUrl)
  const moovIndex = data.indexOf(Buffer.from('moov'))
  const mdatIndex = data.indexOf(Buffer.from('mdat'))

  assert(moovIndex > -1, 'home-background.mp4 is missing a moov atom')
  assert(mdatIndex > -1, 'home-background.mp4 is missing an mdat atom')
  assert(
    moovIndex < mdatIndex,
    `home-background.mp4 is not faststart: moov=${moovIndex}, mdat=${mdatIndex}`
  )
}

async function assertHeroMediaHelpers() {
  const source = await readFile(heroMediaPath, 'utf8')
  const testableSource = `${source.replace(
    /export function /g,
    'function '
  )}
;({ normalizeHeroPosterUrl, buildHeroImagePreloadAttrs, deferHeroVideoSources, restoreHeroVideoSources })`
  const {
    normalizeHeroPosterUrl,
    buildHeroImagePreloadAttrs,
    deferHeroVideoSources,
    restoreHeroVideoSources,
  } = vm.runInNewContext(testableSource, {}, {
    filename: heroMediaPath.pathname,
  })

  assert(
    typeof normalizeHeroPosterUrl === 'function',
    'normalizeHeroPosterUrl must be exported'
  )
  assert(
    typeof buildHeroImagePreloadAttrs === 'function',
    'buildHeroImagePreloadAttrs must be exported'
  )
  assert(
    typeof deferHeroVideoSources === 'function',
    'deferHeroVideoSources must be exported'
  )
  assert(
    typeof restoreHeroVideoSources === 'function',
    'restoreHeroVideoSources must be exported'
  )

  const dirtyUrl =
    "https://cdn.prod.website-files.com/site/hero.avif;')"
  const cleanUrl = normalizeHeroPosterUrl(dirtyUrl)
  assert(
    cleanUrl === 'https://cdn.prod.website-files.com/site/hero.avif',
    `poster URL was not normalized: ${cleanUrl}`
  )

  const attrs = buildHeroImagePreloadAttrs(cleanUrl)
  assert(attrs.rel === 'preload', 'hero preload rel must be preload')
  assert(attrs.as === 'image', 'hero preload must use as=image')
  assert(attrs.fetchPriority === 'high', 'hero preload must be high priority')
  assert(attrs.href === cleanUrl, 'hero preload href must use normalized poster')

  function createFakeSource(attrs = {}) {
    return {
      attrs: { ...attrs },
      getAttribute(name) {
        return this.attrs[name] || null
      },
      setAttribute(name, value) {
        this.attrs[name] = String(value)
      },
      removeAttribute(name) {
        delete this.attrs[name]
      },
    }
  }

  const mp4Source = createFakeSource({ src: '/home-background.mp4' })
  const webmSource = createFakeSource({ 'data-src': '/hero-transcode.webm' })
  const fakeVideo = {
    preload: 'auto',
    sources: [mp4Source, webmSource],
    querySelectorAll(selector) {
      return selector === 'source' ? this.sources : []
    },
    setAttribute(name, value) {
      this[name] = String(value)
    },
  }

  const didDefer = deferHeroVideoSources(fakeVideo)
  assert(didDefer === true, 'hero video sources should be deferred')
  assert(
    mp4Source.getAttribute('src') === null,
    'existing source src should be removed during defer'
  )
  assert(
    mp4Source.getAttribute('data-src') === '/home-background.mp4',
    'existing source src should be preserved as data-src'
  )
  assert(
    fakeVideo.preload === 'none',
    'deferred hero video preload should be none'
  )

  const didRestore = restoreHeroVideoSources(fakeVideo)
  assert(didRestore === true, 'hero video sources should be restored before play')
  assert(
    mp4Source.getAttribute('src') === '/home-background.mp4',
    'mp4 source src should be restored from data-src'
  )
  assert(
    webmSource.getAttribute('src') === '/hero-transcode.webm',
    'existing data-src sources should be restored'
  )
}

await assertFastStartMp4(publicMp4Path)
await assertFastStartMp4(mp4Path)
await assertHeroMediaHelpers()

console.log('Hero media verification passed')
