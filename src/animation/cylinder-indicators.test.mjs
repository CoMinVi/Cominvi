import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getCylinderIndicatorHeight,
  getFlatTickCount,
  getFlatTickIndex,
  getFlatTickTop,
} from './cylinder-indicators.js'

test('limite les indicators à la portion visible du cylindre', () => {
  assert.equal(getCylinderIndicatorHeight(1440, 900), 360)
  assert.equal(getCylinderIndicatorHeight(500, 844), 400)
})

test('reproduit en 2D la densité visible de l’ancien cylindre', () => {
  assert.equal(getFlatTickCount(14, 8), 56)
  assert.equal(getFlatTickCount(14, 1), 14)
})

test('répartit précisément les ticks sur toute la hauteur', () => {
  assert.equal(getFlatTickTop(0, 112), 0)
  assert.equal(getFlatTickTop(111, 112), 100)
  assert.equal(getFlatTickTop(55.5, 112), 50)
})

test('centre un indicator composé d’un seul tick', () => {
  assert.equal(getFlatTickTop(0, 1), 50)
})

test('synchronise l’index actif avec la progression', () => {
  assert.equal(getFlatTickIndex(0, 112), 0)
  assert.equal(getFlatTickIndex(0.5, 112), 56)
  assert.equal(getFlatTickIndex(1, 112), 111)
})

test('borne la progression hors de l’intervalle', () => {
  assert.equal(getFlatTickIndex(-1, 112), 0)
  assert.equal(getFlatTickIndex(2, 112), 111)
  assert.equal(getFlatTickIndex(Number.NaN, 112), 0)
})
