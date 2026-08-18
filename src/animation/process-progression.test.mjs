import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL('./process-progression.js', import.meta.url),
  'utf8'
)

test('l’alignement final synchronise le wrapper et le dernier process', () => {
  assert.match(source, /syncLastProcessEndAlignment\(section,\s*sticky\)/)
  assert.match(source, /wrap\.style\.bottom\s*=/)
  assert.match(source, /lastProcess\.style\.height\s*=/)
})

test('le layout mobile laisse l’index dans process-title', () => {
  assert.doesNotMatch(source, /inner\.prepend\(processIndex\)/)
  assert.match(source, /processIndex\.parentElement !== title/)
})
