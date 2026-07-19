import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const moduleSource = await readFile(
  new URL('./hero-manifest.js', import.meta.url),
  'utf8'
)
const heroManifest = await import(
  `data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`
)

const ASSET_ORIGIN = 'https://cominvi.netlify.app'

assert.equal(
  heroManifest.getHeroAssetOrigin(),
  ASSET_ORIGIN,
  'Les assets hero doivent toujours provenir de Netlify'
)
assert.equal(
  heroManifest.resolveHeroAssetUrl('/cave-scene/scroll/manifest.json'),
  `${ASSET_ORIGIN}/cave-scene/scroll/manifest.json`,
  'Le manifest hero ne doit pas dépendre de l’origine Webflow'
)
assert.equal(
  heroManifest.resolveHeroAssetUrl('/cave-scene/scroll/desktop/batch-0/frame_00000.webp'),
  `${ASSET_ORIGIN}/cave-scene/scroll/desktop/batch-0/frame_00000.webp`,
  'Les frames hero ne doivent pas dépendre de l’origine Webflow'
)

console.log('PASS hero manifest asset origin')
