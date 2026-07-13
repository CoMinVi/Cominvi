import assert from 'node:assert/strict'
import test from 'node:test'

import { buildMineralsLocalUrls } from './minerals-frame-urls.js'

test('génère les 600 URLs Netlify avec le nommage réel des frames', () => {
  const urls = buildMineralsLocalUrls(600)

  assert.equal(urls.length, 600)
  assert.equal(
    urls[0],
    'https://cominvi.netlify.app/minerals/minerals-0001.avif'
  )
  assert.equal(
    urls[9],
    'https://cominvi.netlify.app/minerals/minerals-00010.avif'
  )
  assert.equal(
    urls[99],
    'https://cominvi.netlify.app/minerals/minerals-000100.avif'
  )
  assert.equal(
    urls[599],
    'https://cominvi.netlify.app/minerals/minerals-000600.avif'
  )
})
