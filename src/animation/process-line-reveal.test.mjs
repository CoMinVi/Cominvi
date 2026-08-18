import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getProcessBorderRevealOpacity,
  getProcessLineRevealOpacity,
  shouldUseProcessLineReveal,
} from './process-line-reveal.js'

test('active le reveal par ligne uniquement au breakpoint mobile', () => {
  assert.equal(shouldUseProcessLineReveal(390), true)
  assert.equal(shouldUseProcessLineReveal(766), true)
  assert.equal(shouldUseProcessLineReveal(767), false)
  assert.equal(shouldUseProcessLineReveal(768), false)
  assert.equal(shouldUseProcessLineReveal(1200), false)
})

test('calcule une enveloppe fade-in, maintien et fade-out', () => {
  assert.equal(getProcessLineRevealOpacity(0), 0.2)
  assert.equal(getProcessLineRevealOpacity(0.125), 0.6)
  assert.equal(getProcessLineRevealOpacity(0.25), 1)
  assert.equal(getProcessLineRevealOpacity(0.5), 1)
  assert.equal(getProcessLineRevealOpacity(0.75), 1)
  assert.equal(getProcessLineRevealOpacity(0.875), 0.6)
  assert.equal(getProcessLineRevealOpacity(1), 0.2)
})

test('borne la progression avant de calculer l’opacité', () => {
  assert.equal(getProcessLineRevealOpacity(-1), 0.2)
  assert.equal(getProcessLineRevealOpacity(2), 0.2)
})

test('conserve l’opacité à 1 après apparition si holdAfterReveal', () => {
  assert.equal(getProcessLineRevealOpacity(0, 0, 1, true), 0.2)
  assert.equal(getProcessLineRevealOpacity(0.25, 0, 1, true), 1)
  assert.equal(getProcessLineRevealOpacity(0.875, 0, 1, true), 1)
  assert.equal(getProcessLineRevealOpacity(1, 0, 1, true), 1)
  assert.equal(getProcessLineRevealOpacity(2, 0, 1, true), 1)
})

test('maintient une bordure opaque après son apparition', () => {
  assert.equal(getProcessBorderRevealOpacity(0), 0.2)
  assert.equal(getProcessBorderRevealOpacity(0.125), 0.6)
  assert.equal(getProcessBorderRevealOpacity(0.25), 1)
  assert.equal(getProcessBorderRevealOpacity(0.75), 1)
  assert.equal(getProcessBorderRevealOpacity(1), 1)
})
