import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const stylePath = fileURLToPath(new URL('./style.css', import.meta.url))
const themePath = fileURLToPath(new URL('../utils/base.js', import.meta.url))
const navPath = fileURLToPath(new URL('../animation/nav.js', import.meta.url))

test('la navbar et son icône fermée utilisent les couleurs fixes', async () => {
  const [styles, themes, nav] = await Promise.all([
    readFile(stylePath, 'utf8'),
    readFile(themePath, 'utf8'),
    readFile(navPath, 'utf8'),
  ])

  assert.doesNotMatch(styles, /\.navbar\s*\{[^}]*mix-blend-mode:\s*difference/)
  assert.match(
    styles,
    /\.menu-icon\s*\{[^}]*background(?:-color)?:\s*var\(--white\)/s
  )
  assert.match(
    styles,
    /\.menu-icon_bar\s*\{[^}]*background-color:\s*#020202/s
  )

  for (const theme of ['white', 'lightgreen', 'black', 'hero']) {
    const definition = themes.match(
      new RegExp(`${theme}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`)
    )?.[1]

    assert.ok(definition, `le thème ${theme} est défini`)
    assert.match(definition, /menuIconBg:\s*'var\(--white\)'/)
    assert.match(definition, /menuIconBarsBg:\s*'#020202'/)
  }

  assert.doesNotMatch(nav, /background-color',\s*'var\(--primary\)'/)
  assert.doesNotMatch(nav, /backgroundColor:\s*'#fff'/)
})

test('le thème d’ouverture du menu conserve le fond orange', async () => {
  const themes = await readFile(themePath, 'utf8')
  const definition = themes.match(/menu:\s*\{([\s\S]*?)\n\s*\},/)?.[1]

  assert.ok(definition, 'le thème menu est défini')
  assert.match(definition, /menuIconBg:\s*'var\(--accent\)'/)
  assert.match(definition, /menuIconBarsBg:\s*'#020202'/)
})
