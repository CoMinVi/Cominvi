import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('./cylinder.js', import.meta.url), 'utf8')
const styles = await readFile(
  new URL('../styles/style.css', import.meta.url),
  'utf8'
)

test('les indicators utilisent le layout 2D précis', () => {
  assert.match(source, /getFlatTickCount\(items\.length,\s*tickMultiplier\)/)
  assert.match(source, /getFlatTickTop\(idx,\s*desiredCount\)/)
  assert.match(source, /getFlatTickIndex\(rotationProgress,\s*ticks\.length\)/)
})

test('la timeline 3D ne fait tourner que les noms', () => {
  assert.doesNotMatch(
    source,
    /tl\.fromTo\(indicatorNodes,\s*\{\s*rotateX:\s*0\s*\}/
  )
  assert.match(
    source,
    /tl\.fromTo\(textWrapper,\s*\{\s*rotateX:\s*0\s*\},\s*\{\s*rotateX:\s*150\s*\}/
  )
})

test('les indicators restent plats et limités à la portion visible', () => {
  assert.match(
    styles,
    /\.scroll-indicator_c\s*\{[^}]*height:\s*var\(--cylinder-indicator-height\);[^}]*transform-style:\s*flat;[^}]*top:\s*calc\(50% - var\(--cylinder-indicator-height\) \/ 2\);/s
  )
  assert.doesNotMatch(
    styles,
    /\.scroll-indicator_c\s*\{[^}]*transform:\s*translateY/
  )
  assert.match(
    styles,
    /\.cylindar__text__wrapper-2\s*\{[^}]*margin-top:\s*0;/s
  )
})
