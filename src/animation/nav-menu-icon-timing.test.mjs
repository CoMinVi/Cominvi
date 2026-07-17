import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const navPath = fileURLToPath(new URL('./nav.js', import.meta.url))

test('conserve l’animation d’ouverture historique des barres du menu', async () => {
  const nav = await readFile(navPath, 'utf8')

  assert.doesNotMatch(
    nav,
    /if \(isOpen\) \{\s*applyMenuThemeToIconInline\(\)[\s\S]*?lockPageWrapAsFixed\(\)/s
  )
  assert.match(
    nav,
    /if \(!wasOpen\) \{[\s\S]*?tl\.set\(\s*menuIconBar1,\s*\{ top: '49%', rotation: 0, transformOrigin: '50% 50%' \}/
  )
  assert.match(
    nav,
    /if \(!wasOpen && menuIconBars && menuIconBars\.length\) \{[\s\S]*?tl\.fromTo\(\s*menuIconBars/
  )
})
