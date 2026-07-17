import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const navPath = fileURLToPath(new URL('./nav.js', import.meta.url))

test('anime l’ouverture du menu comme l’inverse de sa fermeture', async () => {
  const nav = await readFile(navPath, 'utf8')

  assert.doesNotMatch(
    nav,
    /if \(isOpen\) \{\s*applyMenuThemeToIconInline\(\)[\s\S]*?lockPageWrapAsFixed\(\)/s
  )
  assert.match(
    nav,
    /if \(!wasOpen\) \{[\s\S]*?tl\.fromTo\(\s*menuIconBar1,\s*\{ top: '42%', rotation: 0 \},[\s\S]*?top: '49%'/
  )
  assert.match(
    nav,
    /if \(!wasOpen && menuIconBars && menuIconBars\.length\) \{[\s\S]*?tl\.fromTo\(\s*menuIconBars/
  )
})
