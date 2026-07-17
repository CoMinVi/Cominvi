import assert from 'node:assert/strict'
import test from 'node:test'

import { getHomeScrollProgress } from './home-sequence-progress.js'

test('conserve la progression Lenis du hero avant le leave', () => {
  assert.equal(
    getHomeScrollProgress({
      lenisScroll: 240,
      scrollTriggerProgress: 0.1,
      viewportHeight: 600,
      rangeVh: 100,
    }),
    0.4
  )
})

test('utilise ScrollTrigger si Lenis ne fournit pas de position', () => {
  assert.equal(
    getHomeScrollProgress({
      scrollTriggerProgress: 0.75,
      viewportHeight: 600,
      rangeVh: 100,
    }),
    0.75
  )
})

test('borne la progression conservée entre zéro et un', () => {
  assert.equal(
    getHomeScrollProgress({
      lenisScroll: 900,
      viewportHeight: 600,
      rangeVh: 100,
    }),
    1
  )
})
