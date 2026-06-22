#!/usr/bin/env node
/**
 * scripts/take-screenshots.js
 *
 * Takes full-page screenshots of the 5 landing feature tabs.
 * Run against the production URL (default) or a local dev server.
 *
 * Usage:
 *   node scripts/take-screenshots.js                         # uses https://insic.app
 *   BASE_URL=http://localhost:3000 node scripts/take-screenshots.js
 *
 * Output: public/screenshots/*.png — committed to the repo.
 */

const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const BASE_URL = process.env.BASE_URL || 'https://insic.app'
const OUT_DIR  = path.join(__dirname, '..', 'public', 'screenshots')

// Pages to capture
const SHOTS = [
  {
    name: 'overview',
    url: `${BASE_URL}/stock/NVDA`,
    // Overview tab is the default — no extra click needed
    waitFor: '[data-testid="summary-tab"], .conviction-score, h2, main',
    file: 'tab-overview.png',
  },
  {
    name: 'valuation',
    url: `${BASE_URL}/stock/NVDA`,
    // Click the Valuation tab
    clickSelector: '[data-tab="valuation"], button:has-text("Valuation")',
    waitFor: '[data-testid="verdict-hero"], .verdict-hero, main',
    file: 'tab-valuation.png',
  },
  {
    name: 'financials',
    url: `${BASE_URL}/stock/NVDA`,
    clickSelector: '[data-tab="financials"], button:has-text("Financials")',
    waitFor: 'main',
    file: 'tab-financials.png',
  },
  {
    name: 'markets',
    url: `${BASE_URL}/markets`,
    waitFor: 'main',
    file: 'tab-markets.png',
  },
  {
    name: 'screener',
    url: `${BASE_URL}/screener`,
    waitFor: 'main',
    file: 'tab-screener.png',
  },
]

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    // Simulate a signed-in user via cookie if available
    // (unauthenticated pages still show enough to be useful)
  })

  for (const shot of SHOTS) {
    console.log(`📸  ${shot.name} → ${shot.file}`)
    const page = await context.newPage()

    try {
      await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 30_000 })

      // Click tab if needed
      if (shot.clickSelector) {
        try {
          await page.click(shot.clickSelector, { timeout: 5_000 })
          await page.waitForTimeout(800)
        } catch {
          console.warn(`  ⚠  Tab selector not found for ${shot.name}, using page as-is`)
        }
      }

      // Wait for content to settle
      try {
        await page.waitForSelector(shot.waitFor, { timeout: 8_000 })
      } catch {
        // If selector not found, just wait a bit
        await page.waitForTimeout(2_000)
      }

      // Brief pause for animations to finish
      await page.waitForTimeout(500)

      const outPath = path.join(OUT_DIR, shot.file)
      await page.screenshot({ path: outPath, fullPage: false })
      console.log(`  ✓  saved ${outPath}`)
    } catch (err) {
      console.error(`  ✗  failed ${shot.name}:`, err.message)
    } finally {
      await page.close()
    }
  }

  await browser.close()
  console.log('\nDone.')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
