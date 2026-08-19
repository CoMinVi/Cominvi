import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('./join-the-team.js', import.meta.url), 'utf8')
const styles = await readFile(new URL('../styles/style.css', import.meta.url), 'utf8')

test('les chiffres Equity font 4em sur mobile', () => {
  assert.match(
    styles,
    /\.equity_content \.body-xxl\s*\{[^}]*font-size:\s*4em;/s
  )
})

test('la fenêtre et le déplacement Equity suivent la nouvelle hauteur', () => {
  assert.match(
    styles,
    /\.equity_content \.equity-slider_slide:not\(\.is-2\)\s*\{[^}]*height:\s*3\.2em;/s
  )
  assert.match(source, /yPercent:\s*-50/)
})
