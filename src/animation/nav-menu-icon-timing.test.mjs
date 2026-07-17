import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const navPath = fileURLToPath(new URL('./nav.js', import.meta.url))

test('applique le thème orange de l’icône seulement après l’ouverture du menu', async () => {
  const nav = await readFile(navPath, 'utf8')

  assert.doesNotMatch(nav, /applyMenuThemeToIconInline\(false\)/)
  const pointerDownHandler = nav.match(
    /const onMenuIconPointerDown = \(e\) => \{([\s\S]*?)\n  \}\n  const onMenuIconLeave/
  )
  assert.ok(pointerDownHandler, 'le gestionnaire pointerdown est défini')
  assert.doesNotMatch(pointerDownHandler[1], /applyMenuThemeToIconInline\(\)/)
  assert.doesNotMatch(
    nav,
    /menuOpen:\s*\(\)\s*=>\s*\{[\s\S]*?applyMenuIconTheme\('menu', true\)/
  )
  assert.match(
    nav,
    /if \(isOpen\) \{\s*applyMenuThemeToIconInline\(\)[\s\S]*?lockPageWrapAsFixed\(\)/s
  )
})

test('referme le menu en inversant la timeline d’ouverture terminée', async () => {
  const nav = await readFile(navPath, 'utf8')

  assert.match(
    nav,
    /currentMenuTl &&\s*wasOpen &&[\s\S]*?currentMenuTl\.progress\(\) === 1[\s\S]*?currentMenuTl\.reverse\(\)/
  )
})
