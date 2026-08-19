import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL('./process-progression.js', import.meta.url),
  'utf8'
)
const styles = await readFile(new URL('../styles/style.css', import.meta.url), 'utf8')

test('l’alignement final ne décale pas l’indicator', () => {
  assert.match(source, /syncLastProcessEndAlignment\(section,\s*sticky\)/)
  assert.doesNotMatch(source, /wrap\.style\.bottom\s*=/)
  assert.match(source, /wrap\.style\.removeProperty\(['"]bottom['"]\)/)
  assert.match(source, /lastProcess\.style\.height\s*=/)
})

test('le layout mobile laisse l’index dans process-title', () => {
  assert.doesNotMatch(source, /inner\.prepend\(processIndex\)/)
  assert.match(source, /processIndex\.parentElement !== title/)
})

test('la vidéo et l’indicator partagent la même limite sticky', () => {
  assert.match(
    styles,
    /\.section_process \.video\s*\{[^}]*margin-bottom:\s*0;/s
  )
})
