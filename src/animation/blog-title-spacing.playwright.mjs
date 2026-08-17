import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = join(fileURLToPath(new URL('../../', import.meta.url)))
const titleText =
  'Safety First: How CoMinVi Builds a Culture of Protection Underground'
const blogSource = readFileSync(join(root, 'src/animation/blog.js'), 'utf8')
const splitFunctionSource = blogSource
  .split('\n\nexport function initBlog')[0]
  .replace(
    'function splitBlogTitles(scope = document)',
    'window.splitBlogTitles = function (scope = document)'
  )

test('les titres du blog conservent un espace visible entre les mots', async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await page.setContent(`
      <style>
        .body-l { width: 700px; font: 48px/1.1 Arial, sans-serif; }
      </style>
      <div class="blog-name">
        <h2 class="body-l">${titleText}</h2>
      </div>
    `)
    await page.addScriptTag({ content: splitFunctionSource })
    await page.evaluate(() => window.splitBlogTitles(document))
    await page.waitForSelector('[data-lines-split="true"]')

    const splitText = await page
      .locator('.body-l')
      .evaluate((title) => title.textContent.replace(/\s+/g, ' ').trim())
    assert.equal(splitText, titleText)

    const gaps = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.blogline-line'))
        .flatMap((line) => {
          const words = Array.from(line.querySelectorAll('.blogline-word'))
          return words.slice(1).map((word, index) => {
            const previous = words[index].getBoundingClientRect()
            const current = word.getBoundingClientRect()
            return {
              title: line.closest('.body-l')?.textContent?.trim(),
              gap: current.left - previous.right,
            }
          })
        })
        .filter(({ gap }) => gap > -1)
    )

    assert.ok(gaps.length > 0, 'aucune paire de mots adjacents mesurable')
    assert.ok(
      gaps.every(({ gap }) => gap > 1),
      `espaces absents dans certains titres : ${JSON.stringify(gaps)}`
    )
  } finally {
    await browser.close()
  }
})
