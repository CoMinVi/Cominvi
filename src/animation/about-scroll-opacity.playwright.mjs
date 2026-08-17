import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = join(fileURLToPath(new URL('../../', import.meta.url)))
const siteStyles = readFileSync(join(root, 'src/styles/style.css'), 'utf8')

test('les titres About utilisent la même transition d’opacité que Join the Team', async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.setContent(`
      <style>${siteStyles}</style>
      <div class="scroll-item">
        <span class="body-xxl">Join the Team</span>
      </div>
      <div class="scroll-item-h">
        <span class="body-xxl">About Us</span>
      </div>
    `)

    const transitions = await page.evaluate(() => {
      const team = getComputedStyle(
        document.querySelector('.scroll-item > .body-xxl')
      )
      const about = getComputedStyle(
        document.querySelector('.scroll-item-h > .body-xxl')
      )
      return {
        team: {
          property: team.transitionProperty,
          duration: team.transitionDuration,
          timing: team.transitionTimingFunction,
        },
        about: {
          property: about.transitionProperty,
          duration: about.transitionDuration,
          timing: about.transitionTimingFunction,
        },
      }
    })

    assert.deepEqual(transitions.about, transitions.team)
  } finally {
    await browser.close()
  }
})
