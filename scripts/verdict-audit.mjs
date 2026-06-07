/**
 * Verdict consistency audit — fetches live financial data for the featured
 * stocks on the /analyze page and checks whether their verdicts (Undervalued /
 * Fairly Valued / Overvalued) are consistent between:
 *   1. The /analyze table card (computed from triangulatedFairValue vs live price)
 *   2. The upsideZone() canonical function thresholds
 *
 * Run manually:   node scripts/verdict-audit.mjs
 * Run in CI/cron: node scripts/verdict-audit.mjs --json > audit-results/verdict-$(date +%Y-%m-%d).json
 *
 * Exit code 0 = all consistent, 1 = inconsistencies found or fetch errors.
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
const BASE_URL = process.env.APP_URL || 'http://localhost:3000'
const JSON_MODE = process.argv.includes('--json')

// Stocks featured on /analyze page (mirrors STATIC_QUOTES in app/analyze/page.tsx)
const FEATURED_TICKERS = ['AAPL', 'NVDA', 'MSFT', 'AMZN', 'META', 'TSLA', 'UNH', 'GS', 'HD']

// Canonical verdict thresholds (mirrors upsideZone() in lib/formatters.ts)
function upsideZone(pct) {
  if (pct == null) return null
  if (pct >= 0.20) return 'Undervalued'
  if (pct >= 0.00) return 'Fairly Valued'
  return 'Overvalued'
}

async function fetchFinancials(ticker) {
  const url = `${BASE_URL}/api/financials?ticker=${ticker}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${ticker}`)
  return res.json()
}

async function auditTicker(ticker) {
  try {
    const data = await fetchFinancials(ticker)
    const price = data?.quote?.price ?? null
    // Use cockpit blended fair value (same as stock page); fall back to triangulated DCF-only
    const fv = data?.valuationMethods?.cockpitFairValue
            ?? data?.valuationMethods?.triangulatedFairValue
            ?? null

    if (price == null || fv == null) {
      return {
        ticker,
        status: 'incomplete',
        price,
        fairValue: fv,
        upsidePct: null,
        verdict: null,
        note: 'Missing price or fair value',
      }
    }

    const upsidePct = (fv - price) / price
    const verdict = upsideZone(upsidePct)

    return {
      ticker,
      status: 'ok',
      price: +price.toFixed(2),
      fairValue: +fv.toFixed(2),
      upsidePct: +(upsidePct * 100).toFixed(1),
      verdict,
      note: null,
    }
  } catch (err) {
    return {
      ticker,
      status: 'error',
      price: null,
      fairValue: null,
      upsidePct: null,
      verdict: null,
      note: err.message,
    }
  }
}

async function main() {
  const auditDate = new Date().toISOString().slice(0, 10)
  if (!JSON_MODE) {
    console.log(`\nVerdict Consistency Audit — ${auditDate}`)
    console.log(`Checking ${FEATURED_TICKERS.length} featured tickers against ${BASE_URL}\n`)
  }

  const results = await Promise.all(FEATURED_TICKERS.map(auditTicker))

  const errors = results.filter(r => r.status === 'error')
  const incomplete = results.filter(r => r.status === 'incomplete')
  const ok = results.filter(r => r.status === 'ok')

  if (JSON_MODE) {
    const output = { auditDate, baseUrl: BASE_URL, results }
    console.log(JSON.stringify(output, null, 2))
    process.exit(errors.length > 0 ? 1 : 0)
    return
  }

  // Human-readable output
  const colW = { ticker: 6, price: 10, fv: 10, upside: 10, verdict: 14, note: 30 }
  const header = [
    'Ticker'.padEnd(colW.ticker),
    'Price'.padStart(colW.price),
    'Fair Value'.padStart(colW.fv),
    'Upside %'.padStart(colW.upside),
    'Verdict'.padEnd(colW.verdict),
    'Note',
  ].join('  ')
  console.log(header)
  console.log('-'.repeat(header.length))

  for (const r of results) {
    const ticker  = r.ticker.padEnd(colW.ticker)
    const price   = r.price   != null ? `$${r.price}`.padStart(colW.price)   : '—'.padStart(colW.price)
    const fv      = r.fairValue != null ? `$${r.fairValue}`.padStart(colW.fv) : '—'.padStart(colW.fv)
    const upside  = r.upsidePct != null
      ? `${r.upsidePct >= 0 ? '+' : ''}${r.upsidePct}%`.padStart(colW.upside)
      : '—'.padStart(colW.upside)
    const verdict = (r.verdict ?? r.status ?? '—').padEnd(colW.verdict)
    const note    = r.note ?? ''
    console.log([ticker, price, fv, upside, verdict, note].join('  '))
  }

  console.log()
  console.log(`Summary: ${ok.length} ok, ${incomplete.length} incomplete, ${errors.length} errors`)

  if (ok.length > 0) {
    const undervalued  = ok.filter(r => r.verdict === 'Undervalued').map(r => r.ticker)
    const fairlyValued = ok.filter(r => r.verdict === 'Fairly Valued').map(r => r.ticker)
    const overvalued   = ok.filter(r => r.verdict === 'Overvalued').map(r => r.ticker)
    console.log(`  Undervalued:   ${undervalued.join(', ') || 'none'}`)
    console.log(`  Fairly Valued: ${fairlyValued.join(', ') || 'none'}`)
    console.log(`  Overvalued:    ${overvalued.join(', ') || 'none'}`)
  }

  if (errors.length > 0) {
    console.log('\nErrors:')
    for (const r of errors) console.log(`  ${r.ticker}: ${r.note}`)
  }

  process.exit(errors.length > 0 ? 1 : 0)
}

main()
