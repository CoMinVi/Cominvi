import { chromium, firefox } from 'playwright'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5173/'
const MAX_LABEL_OFFSET_PX = 1.5

async function assertNavlinkAlignment(browserType, browserName, width) {
  const browser = await browserType.launch()
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.click('.is-menu')
  await page.waitForTimeout(1500)

  const rows = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.navlink')).map((link) => {
      const label = link.querySelector('.navlink_label')
      const icon = link.querySelector('.navlink_icon')
      const item = link.closest('.link-item')
      const labelRect = label?.getBoundingClientRect()
      const iconRect = icon?.getBoundingClientRect()
      const itemRect = item?.getBoundingClientRect()
      return {
        text: label?.textContent?.trim() || '',
        labelLeftOffset: (labelRect?.left ?? 0) - (itemRect?.left ?? 0),
        iconPeek: (iconRect?.right ?? 0) - (itemRect?.left ?? 0),
      }
    })
  })

  await browser.close()

  const failures = rows.filter(
    (row) =>
      Math.abs(row.labelLeftOffset) > MAX_LABEL_OFFSET_PX || row.iconPeek > 0.5
  )

  return { browserName, width, rows, failures }
}

const widths = [375, 768, 991, 992, 1440]
const browsers = [
  ['chromium', chromium],
  ['firefox', firefox],
]

let hasFailure = false
for (const width of widths) {
  for (const [name, type] of browsers) {
    const result = await assertNavlinkAlignment(type, name, width)
    if (result.failures.length) {
      hasFailure = true
      console.error(
        `FAIL ${name} @ ${width}px`,
        JSON.stringify(result.failures, null, 2)
      )
    } else {
      console.log(`PASS ${name} @ ${width}px (${result.rows.length} links)`)
    }
  }
}

if (hasFailure) process.exit(1)
