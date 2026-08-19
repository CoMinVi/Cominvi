import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const styles = await readFile(new URL('./style.css', import.meta.url), 'utf8')

test('les paragraphes Improvement ont la taille mobile demandée', () => {
  assert.match(
    styles,
    /\.section_improvement \.body-xl\s*\{[^}]*font-size:\s*1\.2em;/s
  )
})

test('les titres de listes alignées ont la taille mobile demandée', () => {
  assert.match(
    styles,
    /\.scroll-list\.is-l-aligned \.body-xxl\s*\{[^}]*font-size:\s*2em;/s
  )
})
