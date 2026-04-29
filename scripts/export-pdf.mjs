/**
 * Generates AI-Infrastructure-Stack.pdf on your Desktop.
 * Usage:  npm run export-pdf
 *
 * Requires the dev server to be running: npm run dev
 * Or pass a URL:  npm run export-pdf -- https://your-vercel-app.vercel.app
 */

import puppeteer from 'puppeteer'
import path from 'path'
import os from 'os'

const BASE_URL = process.argv[2] ?? 'http://localhost:3000'
const REPORT_URL = `${BASE_URL}/ai-stack/report`
const OUTPUT = path.join(os.homedir(), 'Desktop', 'AI-Infrastructure-Stack.pdf')

console.log(`\n📄 Generating PDF from: ${REPORT_URL}`)
console.log(`💾 Saving to: ${OUTPUT}\n`)

const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()

// A4 portrait viewport
await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 })

console.log('⟳ Loading page…')
await page.goto(REPORT_URL, { waitUntil: 'networkidle0', timeout: 30000 })

// Wait for the first slide to appear (data fetch + render)
console.log('⟳ Waiting for data to load (~15s)…')
await page.waitForSelector('.report-slide', { timeout: 90000 })

// Extra settle time for all 125 tickers to render
await new Promise(r => setTimeout(r, 3000))

const slideCount = await page.$$eval('.report-slide', els => els.length)
console.log(`✓ ${slideCount} slides ready`)

await page.pdf({
  path: OUTPUT,
  format: 'A4',
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
})

await browser.close()
console.log(`\n✅ Done! PDF saved to your Desktop.\n`)
