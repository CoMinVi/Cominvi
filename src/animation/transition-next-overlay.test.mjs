import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const transition = await readFile(
  new URL('./transition-next.js', import.meta.url),
  'utf8'
)
const styles = await readFile(
  new URL('../styles/style.css', import.meta.url),
  'utf8'
)

test('applique un overlay noir à 15 % à toutes les images next', () => {
  assert.match(
    styles,
    /\.section_next \.next_background::after\s*\{[^}]*background-color:\s*rgba\(0,\s*0,\s*0,\s*0\.15\);[^}]*opacity:\s*var\(--next-overlay-opacity,\s*1\);/s
  )
})

test('fait disparaître l’overlay après le positionnement de la section next', () => {
  const scrollStep = transition.indexOf(
    "tl.add(scrollToSectionNext(current && current.container), '+=0')"
  )
  const fadeStep = transition.indexOf("'--next-overlay-opacity': 0")

  assert.notEqual(scrollStep, -1)
  assert.ok(fadeStep > scrollStep)
  assert.match(
    transition,
    /'--next-overlay-opacity': 0,\s*duration: reduceMotion \? 0 : 0\.6/
  )
})
