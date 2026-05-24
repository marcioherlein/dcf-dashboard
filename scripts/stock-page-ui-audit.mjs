/**
 * Stock Page UI Audit — Puppeteer browser checks
 *
 * Usage:
 *   node scripts/stock-page-ui-audit.mjs PAGS
 *   node scripts/stock-page-ui-audit.mjs NVDA AAPL TSLA ...
 *
 * Auto-starts the Next.js dev server if not already running.
 * Writes UI results into scripts/stock-audit-results.json (merges with API audit).
 * Screenshots saved to scripts/screenshots/{TICKER}-{tab}.png
 */

import puppeteer from 'puppeteer'
import { spawn }  from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename   = fileURLToPath(import.meta.url)
const __dirname    = dirname(__filename)

const BASE         = 'http://localhost:3000'
const OUT_PATH     = join(__dirname, 'stock-audit-results.json')
const SCREENSHOTS  = join(__dirname, 'screenshots')
const PAGE_TIMEOUT = 45000   // ms to wait for page load
const TAB_TIMEOUT  = 10000   // ms to wait for tab content
const SERVER_WAIT  = 90000   // ms max to wait for dev server start

// Text patterns that should never appear in visible UI
const BAD_PATTERNS = [
  { re: /\bNaN\b/,           label: 'NaN' },
  { re: /\bundefined\b/,     label: 'undefined' },
  { re: /\bInfinity\b/,      label: 'Infinity' },
  { re: /Invalid Date/,      label: 'Invalid Date' },
  { re: /\[object Object\]/, label: '[object Object]' },
  // "null" is tricky — many words contain it; match as isolated token after space/start
  { re: /(?:^|[\s(=:>])null(?:[\s,)<\n]|$)/m, label: 'null (isolated)' },
]

// ── Dev server management ─────────────────────────────────────────────────────

async function isServerReady() {
  try {
    const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(3000) })
    return res.status < 500
  } catch {
    return false
  }
}

async function waitForServer(maxMs = SERVER_WAIT) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    if (await isServerReady()) return true
    await delay(1000)
  }
  return false
}

async function startDevServer() {
  if (await isServerReady()) {
    console.log('✓ Dev server already running')
    return null
  }

  console.log('⏳ Starting Next.js dev server...')
  const proc = spawn('npm', ['run', 'dev'], {
    cwd: join(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
    detached: false,
  })

  proc.stdout.on('data', d => {
    const line = d.toString().trim()
    if (line) process.stdout.write(`   [dev] ${line}\n`)
  })
  proc.stderr.on('data', d => {
    const line = d.toString().trim()
    if (line && !line.includes('ExperimentalWarning')) process.stdout.write(`   [dev] ${line}\n`)
  })

  const ready = await waitForServer(SERVER_WAIT)
  if (!ready) throw new Error('Dev server did not become ready within timeout')
  console.log('✓ Dev server ready\n')
  return proc
}

// ── Screenshot ────────────────────────────────────────────────────────────────

function ensureScreenshotsDir() {
  if (!existsSync(SCREENSHOTS)) mkdirSync(SCREENSHOTS, { recursive: true })
}

async function screenshot(page, ticker, suffix) {
  ensureScreenshotsDir()
  const path = join(SCREENSHOTS, `${ticker}-${suffix}.png`)
  await page.screenshot({ path, fullPage: false })
  return path
}

// ── Per-tab content checks ────────────────────────────────────────────────────

async function checkBodyText(page) {
  const bodyText = await page.evaluate(() => document.body.innerText)
  const found = []
  for (const { re, label } of BAD_PATTERNS) {
    if (re.test(bodyText)) found.push(label)
  }
  return found
}

async function waitForTab(page, tabText, timeout = TAB_TIMEOUT) {
  try {
    // Click tab by text
    await page.evaluate((text) => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'))
      const tab = tabs.find(t => t.textContent?.trim().includes(text))
      if (tab) tab.click()
    }, tabText)
    await delay(1200)  // wait for content to render
    return true
  } catch {
    return false
  }
}

async function checkOverviewTab(page, ticker) {
  const results = { tab: 'overview', issues: [] }

  // Check sidebar cards exist
  const sidebarCards = await page.evaluate(() => {
    const sidebar = document.querySelector('aside')
    if (!sidebar) return 0
    // glass-card-light or rounded-xl cards
    return sidebar.querySelectorAll('[class*="rounded-xl"]').length
  })
  if (sidebarCards < 2) {
    results.issues.push(`Sidebar has only ${sidebarCards} cards (expected ≥ 2)`)
  }

  // Check that the blended fair value or some price appears
  const hasFairValue = await page.evaluate(() => {
    const text = document.body.innerText
    return /\$\d+(\.\d+)?/.test(text) || /\d+\.\d{2}/.test(text)
  })
  if (!hasFairValue) results.issues.push('No formatted price/value visible in overview')

  return results
}

async function checkValuationTab(page, ticker) {
  const results = { tab: 'valuation', issues: [], sliderTest: null }

  // Check lollipop chart SVG
  const hasSVG = await page.$('svg[aria-label="Fair value lollipop chart"]') != null
  if (!hasSVG) results.issues.push('Lollipop fair value chart SVG not found')

  // Check accordion headers (look for the method names)
  const METHOD_LABELS = ['Forward P/E', 'EV/EBITDA', 'Revenue Multiple', 'Reverse DCF', 'Full DCF']
  for (const label of METHOD_LABELS) {
    const found = await page.evaluate(text => {
      return document.body.innerText.includes(text)
    }, label)
    if (!found) results.issues.push(`Method header "${label}" not visible`)
  }

  // Click first visible accordion (Forward P/E) and check it expands
  try {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const btn = buttons.find(b => b.textContent?.includes('Forward P/E'))
      if (btn) btn.click()
    })
    await delay(600)

    // Check body has expanded — look for a slider or input that appeared
    const hasSlider = await page.$('input[type="range"]') != null
    if (!hasSlider) results.issues.push('No range input (slider) found after opening Forward P/E accordion')

    // Slider interaction test
    if (hasSlider) {
      const sliderHandle = await page.$('input[type="range"]')

      // Look for fair value display inside the expanded accordion section, not globally
      const getAccordionFV = () => page.evaluate(() => {
        // Try accordion body first (data-* or role-based), then fallback to any output near slider
        const slider = document.querySelector('input[type="range"]')
        if (!slider) return null
        // Walk up to find the containing section, then look for $XX text in it
        let el = slider.parentElement
        for (let i = 0; i < 8 && el; i++) {
          const text = el.innerText ?? ''
          const match = text.match(/Fair Value[^\$]*\$(\d[\d,\.]+)/)
          if (match) return match[0].trim()
          el = el.parentElement
        }
        // Fallback: any element with class containing 'result' or 'output' near slider
        const results = Array.from(document.querySelectorAll('[class*="result"],[class*="output"],[class*="fair"],[class*="computed"]'))
        const r = results.find(e => /\$\d+/.test(e.textContent ?? ''))
        return r?.textContent?.trim() ?? null
      })

      const beforeText = await getAccordionFV()

      // Change slider value
      await sliderHandle.evaluate(el => {
        const min = parseFloat(el.min || '0')
        const max = parseFloat(el.max || '100')
        const mid = min + (max - min) * 0.4
        el.value = mid
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      })
      await delay(1500)

      const afterText = await getAccordionFV()

      results.sliderTest = {
        before: beforeText,
        after: afterText,
        changed: beforeText !== afterText,
      }
      // Only flag if we found a value both times and it didn't change
      if (beforeText && afterText && beforeText === afterText) {
        results.issues.push('Slider change did not update accordion fair value — reactivity may be broken')
      }
    }
  } catch (e) {
    results.issues.push(`Accordion expansion check failed: ${e.message}`)
  }

  return results
}

async function checkFinancialsTab(page, ticker) {
  const results = { tab: 'financials', issues: [] }

  // Check income statement table has rows
  const tableRowCount = await page.evaluate(() => {
    const tables = document.querySelectorAll('table, [role="table"]')
    if (!tables.length) {
      // FinancialsHub might use divs — check for grid or row patterns
      return document.querySelectorAll('[class*="grid"][class*="divide"]').length
    }
    return Array.from(tables).reduce((s, t) => s + t.querySelectorAll('tr, [role="row"]').length, 0)
  })
  if (tableRowCount < 5) results.issues.push(`Financials table appears to have only ${tableRowCount} rows (expected ≥ 5)`)

  // Check Annual/Quarterly/TTM toggles exist
  const hasToggles = await page.evaluate(() => {
    const text = document.body.innerText
    return (text.includes('Annual') || text.includes('annual')) &&
           (text.includes('Quarterly') || text.includes('quarterly') || text.includes('TTM'))
  })
  if (!hasToggles) results.issues.push('Annual/Quarterly/TTM toggle not found in financials tab')

  return results
}

async function checkRisksTab(page, ticker) {
  const results = { tab: 'risks', issues: [] }
  const hasContent = await page.evaluate(() => {
    const main = document.querySelector('main, [role="main"]') ?? document.body
    return main.innerText.trim().length > 100
  })
  if (!hasContent) results.issues.push('Risks tab appears empty')
  return results
}

// ── Per-ticker UI audit ───────────────────────────────────────────────────────

async function auditTickerUI(browser, ticker) {
  const page = await browser.newPage()
  const consoleErrors = []
  const pageErrors    = []

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200))
  })
  page.on('pageerror', err => pageErrors.push(err.message.slice(0, 200)))

  const result = {
    ticker,
    uiScore:        100,
    consoleErrors:  [],
    pageErrors:     [],
    badTextFound:   [],
    tabResults:     {},
    screenshotPaths: {},
    failedSelectors: [],
    uiIssues:       [],
  }

  try {
    // Navigate and wait for tab nav (proxy for page loaded)
    await page.goto(`${BASE}/stock/${ticker}`, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT })

    // Try to wait for the tab nav
    try {
      await page.waitForSelector('[role="tablist"]', { timeout: PAGE_TIMEOUT })
    } catch {
      result.uiIssues.push('Tab navigation never appeared — page may have failed to load')
      result.uiScore = 0
      try { await page.close() } catch { /* ignore */ }
      return result
    }

    // Brief pause for data to populate
    await delay(4000)

    // Screenshots
    result.screenshotPaths.overview = await screenshot(page, ticker, 'overview')

    // Bad text scan
    result.badTextFound = await checkBodyText(page)
    if (result.badTextFound.length > 0) {
      result.uiIssues.push(`Bad text visible: ${result.badTextFound.join(', ')}`)
      result.uiScore -= result.badTextFound.length * 10
    }

    // Overview tab checks (already on it by default)
    const overviewResult = await checkOverviewTab(page, ticker)
    result.tabResults.overview = overviewResult
    result.uiIssues.push(...overviewResult.issues)

    // Valuation tab
    await waitForTab(page, 'Valuation')
    result.screenshotPaths.valuation = await screenshot(page, ticker, 'valuation')
    const valuationResult = await checkValuationTab(page, ticker)
    result.tabResults.valuation = valuationResult
    result.uiIssues.push(...valuationResult.issues)

    // Financials tab
    await waitForTab(page, 'Financials')
    await delay(1000)
    result.screenshotPaths.financials = await screenshot(page, ticker, 'financials')
    const financialsResult = await checkFinancialsTab(page, ticker)
    result.tabResults.financials = financialsResult
    result.uiIssues.push(...financialsResult.issues)

    // Risks tab
    await waitForTab(page, 'Risks')
    result.screenshotPaths.risks = await screenshot(page, ticker, 'risks')
    const risksResult = await checkRisksTab(page, ticker)
    result.tabResults.risks = risksResult
    result.uiIssues.push(...risksResult.issues)

  } catch (err) {
    result.uiIssues.push(`Unexpected error: ${err.message}`)
  } finally {
    try { await page.close() } catch { /* page may already be closed */ }
  }

  result.consoleErrors = consoleErrors
  result.pageErrors    = pageErrors

  // Penalize for console errors and page errors
  result.uiScore -= Math.min(40, consoleErrors.length * 5)
  result.uiScore -= Math.min(30, pageErrors.length * 10)
  result.uiScore -= Math.min(30, result.uiIssues.length * 5)
  result.uiScore  = Math.max(0, result.uiScore)

  return result
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args    = process.argv.slice(2)
  const tickers = args.filter(a => !a.startsWith('--'))

  if (tickers.length === 0) {
    console.error('Usage: node scripts/stock-page-ui-audit.mjs TICKER [TICKER2 ...]')
    process.exit(1)
  }

  console.log(`Stock Page UI Audit — ${tickers.length} ticker(s)`)
  console.log('─'.repeat(80))

  // Start dev server if needed
  const devServer = await startDevServer()

  // Load existing results to merge
  let existing = {}
  if (existsSync(OUT_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(OUT_PATH, 'utf-8'))
      for (const r of (raw.results ?? [])) existing[r.ticker] = r
    } catch { /* start fresh */ }
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1440, height: 900 },
  })

  try {
    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i]
      process.stdout.write(`[${String(i + 1).padStart(3)}/${tickers.length}] ${ticker.padEnd(8)} `)

      try {
        const uiResult = await auditTickerUI(browser, ticker)

        // Merge into existing report
        if (existing[ticker]) {
          existing[ticker].uiScore      = uiResult.uiScore
          existing[ticker].consoleErrors = uiResult.consoleErrors
          existing[ticker].pageErrors    = uiResult.pageErrors
          existing[ticker].badTextFound  = uiResult.badTextFound
          existing[ticker].tabResults    = uiResult.tabResults
          existing[ticker].screenshotPaths = uiResult.screenshotPaths
          existing[ticker].uiIssues      = uiResult.uiIssues
          existing[ticker].failedSelectors = uiResult.failedSelectors
          // Recalc overall
          const api = existing[ticker].apiScore ?? 100
          const fin = existing[ticker].financialScore ?? 100
          const val = existing[ticker].valuationScore ?? 100
          existing[ticker].overallScore = Math.round((api + fin + val + uiResult.uiScore) / 4)
        } else {
          existing[ticker] = uiResult
        }

        const badge = uiResult.uiScore >= 80 ? '✅' : uiResult.uiScore >= 50 ? '⚠️ ' : '🔴'
        const topIssue = uiResult.uiIssues[0] ?? uiResult.consoleErrors[0]
        console.log(
          `${badge} uiScore=${uiResult.uiScore}  errors=${uiResult.consoleErrors.length}  issues=${uiResult.uiIssues.length}` +
          (topIssue ? `  → ${topIssue.slice(0, 80)}` : '  → clean')
        )
      } catch (err) {
        console.log(`❌ exception: ${err.message}`)
        if (existing[ticker]) {
          existing[ticker].uiScore = 0
          existing[ticker].uiIssues = [err.message]
        }
      }

      if (i < tickers.length - 1) await delay(1500)
    }
  } finally {
    await browser.close()
    if (devServer) {
      devServer.kill()
      console.log('\nDev server stopped.')
    }
  }

  const allResults = Object.values(existing).sort((a, b) => a.ticker.localeCompare(b.ticker))
  writeFileSync(OUT_PATH, JSON.stringify({ runAt: new Date().toISOString(), count: allResults.length, results: allResults }, null, 2))
  console.log(`\nResults written to scripts/stock-audit-results.json`)
  console.log(`Screenshots in scripts/screenshots/`)
}

main().catch(e => { console.error(e); process.exit(1) })
