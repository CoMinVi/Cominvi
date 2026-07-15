import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getCanvasPixelRatio,
  getIntersectionObserverRoot,
  isNearViewport,
  readMarkerRects,
} from './scroll-performance.js'

test('isNearViewport limite le travail à la marge autour du viewport', () => {
  assert.equal(isNearViewport({ top: -40, bottom: -10 }, 100, 0.5), true)
  assert.equal(isNearViewport({ top: -100, bottom: -51 }, 100, 0.5), false)
  assert.equal(isNearViewport({ top: 151, bottom: 200 }, 100, 0.5), false)
  assert.equal(isNearViewport({ top: 90, bottom: 120 }, 100, 0.5), true)
})

test('readMarkerRects mesure chaque marker une fois et applique le padding', () => {
  let reads = 0
  const buttonA = {}
  const buttonB = {}
  const entries = [
    {
      marker: {
        getBoundingClientRect() {
          reads += 1
          return { left: 10, top: 20, width: 30, height: 40 }
        },
      },
      button: buttonA,
    },
    {
      marker: {
        getBoundingClientRect() {
          reads += 1
          return { left: 50, top: 60, width: 20, height: 10 }
        },
      },
      button: buttonB,
    },
  ]

  assert.deepEqual(readMarkerRects(entries, 4), [
    { button: buttonA, left: 6, top: 16, width: 38, height: 48 },
    { button: buttonB, left: 46, top: 56, width: 28, height: 18 },
  ])
  assert.equal(reads, 2)
})

test('getCanvasPixelRatio plafonne uniquement les écrans mobiles', () => {
  assert.equal(getCanvasPixelRatio(3, true), 2)
  assert.equal(getCanvasPixelRatio(1.5, true), 1.5)
  assert.equal(getCanvasPixelRatio(3, false), 3)
  assert.equal(getCanvasPixelRatio(0, true), 1)
})

test('getIntersectionObserverRoot utilise le wrapper qui contient la section', () => {
  const target = {}
  const wrapper = {
    contains(node) {
      return node === target
    },
  }

  assert.equal(getIntersectionObserverRoot(wrapper, target), wrapper)
  assert.equal(getIntersectionObserverRoot(wrapper, {}), null)
  assert.equal(getIntersectionObserverRoot(null, target), null)
})
