/**
 * Phase 1 — Data Quality Diagnostic Scanner
 *
 * Usage:
 *   node scripts/data-audit.mjs                 # sample of 30 tickers
 *   node scripts/data-audit.mjs --all           # full universe (~320 tickers, slow)
 *   node scripts/data-audit.mjs NVDA VIST TSM   # specific tickers
 *
 * Requires the dev server running on localhost:3000.
 * Results written to scripts/data-audit-results.json
 */

import { writeFileSync } from 'fs'

const BASE = 'http://localhost:3000'
const DELAY_MS = 800   // between tickers to avoid rate-limit cascades
const TIMEOUT_MS = 25000

// ── Representative sample (covers US tech, capital-intensive, ADRs, REITs, pre-revenue) ──
const SAMPLE_TICKERS = [
  // Standard profitable US tech
  'NVDA', 'MSFT', 'ORCL', 'CSCO', 'TXN',
  // Capital-intensive (high capex)
  'VIST', 'TSM', 'ASML', 'MU', 'INTC',
  // Foreign / ADR
  'GGAL', 'PAM', 'YPF',
  // REIT (model-incompatible)
  'EQIX', 'DLR',
  // Pre-revenue / negative FCF growth
  'WOLF', 'AEHR', 'APLD',
  // Stable / low-capex
  'ANET', 'NET', 'SNOW',
  // Energy / commodity
  'FCX', 'CEG', 'EQT',
  // Financial
  'BMA', 'GGAL',
  // Large diversified
  'AMZN', 'GOOGL', 'META',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchWithTimeout(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    return res.json()
  } catch {
    clearTimeout(timer)
    return null
  }
}

// ── Per-ticker analysis ───────────────────────────────────────────────────────

function analyseFinancials(fin) {
  if (!fin) return { error: 'financials_fetch_failed' }

  const isRows  = fin.financialStatements?.incomeStatement ?? []
  const cfRows  = fin.financialStatements?.cashFlow        ?? []
  const histIS  = isRows.filter(r => !r.isProjected)
  const histCF  = cfRows.filter(r => !r.isProjected)

  // Data presence flags
  const ebitAvailable   = histIS.some(r => r.operatingIncome != null || r.ebit != null)
  const ebitdaAvailable = histIS.some(r => r.ebitda != null)
  const capexAvailable  = histCF.some(r => r.capex  != null)
  const dnaAvailable    = histCF.some(r => r.dna    != null)

  // FCF proxy risk: FCF ≈ netIncome (within 3%)
  const fcfProxyRisk = histCF.length > 0 && histIS.length > 0 && (() => {
    let matchCount = 0
    for (const cf of histCF) {
      const is = histIS.find(r => r.year === cf.year)
      if (!is || cf.freeCashFlow == null || is.netIncome == null) continue
      const pct = Math.abs(cf.freeCashFlow - is.netIncome) / (Math.abs(is.netIncome) || 1)
      if (pct < 0.05) matchCount++
    }
    return matchCount >= Math.max(2, histCF.length * 0.6)
  })()

  // WACC checks
  const wacc       = fin.wacc?.wacc ?? null
  const beta       = fin.wacc?.inputs?.beta ?? null
  const crp        = fin.wacc?.crp ?? fin.wacc?.inputs?.crp ?? 0
  const taxRateWacc = fin.wacc?.inputs?.taxRate ?? null
  const fxRate     = fin.providerStatus?.fx?.rate ?? 1
  const crpMissing = fxRate !== 1 && (crp == null || crp === 0)

  // Old fair value vs current price
  const oldFV      = fin.fairValue?.fairValuePerShare ?? null
  const price      = fin.quote?.price ?? null
  const oldFVRatio = (oldFV != null && price != null && price > 0) ? oldFV / price : null
  const oldFVSuspect = oldFVRatio != null && oldFVRatio > 2.5

  // Sector empty
  const sectorEmpty = !fin.quote?.sector

  // Revenue consistency (financials API vs statements would need cross-check — flagged below)
  const revenues = histIS.map(r => r.revenue).filter(v => v != null)
  const hasRevenue = revenues.length >= 3

  return {
    ebitAvailable,
    ebitdaAvailable,
    capexAvailable,
    dnaAvailable,
    fcfProxyRisk,
    wacc: wacc != null ? +(wacc * 100).toFixed(2) : null,
    beta,
    crp: +(crp * 100).toFixed(1),
    crpMissing,
    taxRateWacc: taxRateWacc != null ? +(taxRateWacc * 100).toFixed(1) : null,
    fxRate,
    sectorEmpty,
    oldFVRatio: oldFVRatio != null ? +oldFVRatio.toFixed(2) : null,
    oldFVSuspect,
    hasRevenue,
    histYears: histIS.length,
  }
}

function analyseStatements(stmts) {
  if (!stmts) return { error: 'statements_fetch_failed' }

  const annualCF = stmts.annual?.cashFlow ?? []
  const annualIS = stmts.annual?.incomeStatement ?? []
  const ttmCF    = stmts.ttm?.cashFlow ?? {}
  const ttmIS    = stmts.ttm?.incomeStatement ?? {}
  const ttmBS    = stmts.ttm?.balanceSheet ?? {}

  // FCF sign analysis (last 4 annual years)
  const recent4 = annualCF.slice(-4)
  const fcfValues = recent4.map(r => r.freeCashFlow).filter(v => v != null)
  const negativeFcfCount = fcfValues.filter(v => v < 0).length
  const fcfNegativeMajority = fcfValues.length >= 2 && negativeFcfCount >= fcfValues.length * 0.5

  // TTM FCF
  const ttmFcf = ttmCF.freeCashFlow ?? null
  const ttmFcfM = ttmFcf != null ? +(ttmFcf / 1e6).toFixed(1) : null

  // CapEx relative to D&A (growth-capex flag)
  const capexValues = annualCF.slice(-3).map(r => r.capitalExpenditure ?? r.purchaseOfPPE).filter(v => v != null)
  const dnaValues   = annualCF.slice(-3).map(r => r.depreciationAndAmortization ?? r.depreciationAmortizationDepletion).filter(v => v != null)
  let growthCapexFlag = false
  if (capexValues.length >= 2 && dnaValues.length >= 2) {
    const medCapex = Math.abs(capexValues.reduce((s, v) => s + v, 0) / capexValues.length)
    const medDna   = dnaValues.reduce((s, v) => s + v, 0) / dnaValues.length
    growthCapexFlag = medDna > 0 && medCapex > medDna * 1.8
  }

  // EBITDA gap: ebitda ≠ ebit + dna (>15% gap in latest year)
  const latestIS = annualIS.at(-1) ?? {}
  const latestCF = annualCF.at(-1) ?? {}
  const ebitdaGap = (() => {
    const ebitda = latestIS.EBITDA
    const ebit   = latestIS.operatingIncome ?? latestIS.EBIT
    const dna    = latestCF.depreciationAndAmortization ?? latestCF.depreciationAmortizationDepletion
    if (ebitda == null || ebit == null || dna == null || ebitda === 0) return null
    return +Math.abs((ebitda - ebit - dna) / ebitda * 100).toFixed(1)
  })()

  // Tax rate from statements
  const taxRates = annualIS.slice(-3).map(r => {
    const prov  = r.taxProvision
    const pre   = r.pretaxIncome
    if (prov == null || pre == null || pre === 0) return null
    return prov / pre
  }).filter(v => v != null && v > 0.01 && v < 0.65)
  const medianTaxRate = taxRates.length > 0
    ? +((taxRates.sort((a, b) => a - b)[Math.floor(taxRates.length / 2)]) * 100).toFixed(1)
    : null

  // Diluted shares (ordinary vs ADR mismatch risk)
  const dilutedShares = ttmIS.dilutedAverageShares ?? null
  const balShares     = ttmBS.ordinarySharesNumber ?? ttmBS.commonStockSharesOutstanding ?? null

  return {
    ttmFcfM,
    fcfNegativeMajority,
    negativeFcfCount,
    fcfYearsChecked: fcfValues.length,
    growthCapexFlag,
    ebitdaGapPct: ebitdaGap,
    ebitdaGapFlag: ebitdaGap != null && ebitdaGap > 15,
    medianTaxRatePct: medianTaxRate,
    dilutedShares,
    balShares,
    sharesMismatch: dilutedShares != null && balShares != null
      ? +(dilutedShares / balShares).toFixed(2)
      : null,
  }
}

function scoreIssues(fin, stmts) {
  const issues = []

  if (fin.error) {
    issues.push({ sev: 'CRITICAL', code: 'FETCH_FAIL_FINANCIALS', msg: 'Could not fetch /api/financials' })
    return { score: 0, issues }
  }
  if (stmts.error) {
    issues.push({ sev: 'HIGH', code: 'FETCH_FAIL_STATEMENTS', msg: 'Could not fetch /api/statements' })
  }

  let score = 100

  if (!fin.ebitAvailable) {
    issues.push({ sev: 'HIGH', code: 'EBIT_NULL', msg: 'EBIT missing from all historical rows in /api/financials' })
    score -= 20
  }
  if (!fin.ebitdaAvailable) {
    issues.push({ sev: 'HIGH', code: 'EBITDA_NULL', msg: 'EBITDA missing from all historical rows in /api/financials' })
    score -= 15
  }
  if (!fin.capexAvailable) {
    issues.push({ sev: 'HIGH', code: 'CAPEX_NULL', msg: 'CapEx missing from all historical CF rows — FCF proxy risk' })
    score -= 20
  }
  if (!fin.dnaAvailable) {
    issues.push({ sev: 'MEDIUM', code: 'DNA_NULL', msg: 'D&A missing from all historical CF rows' })
    score -= 10
  }
  if (fin.fcfProxyRisk) {
    issues.push({ sev: 'CRITICAL', code: 'FCF_EQUALS_NI', msg: 'FCF ≈ Net Income in ≥60% of rows — CapEx not deducted' })
    score -= 25
  }
  if (fin.sectorEmpty) {
    issues.push({ sev: 'MEDIUM', code: 'SECTOR_EMPTY', msg: 'Sector field empty — wrong multiples, no CRP lookup' })
    score -= 5
  }
  if (fin.crpMissing) {
    issues.push({ sev: 'HIGH', code: 'CRP_ZERO_FOREIGN', msg: `FX rate ${fin.fxRate} (foreign stock) but CRP = 0 — WACC understated` })
    score -= 15
  }
  if (fin.beta != null && fin.beta < 0.5) {
    issues.push({ sev: 'MEDIUM', code: 'BETA_LOW', msg: `Beta = ${fin.beta} — unusually low, may understate cost of equity` })
    score -= 5
  }
  if (fin.oldFVSuspect) {
    issues.push({ sev: 'HIGH', code: 'OLD_FV_SUSPECT', msg: `Old server fair value = ${fin.oldFVRatio}× current price — likely based on wrong FCF` })
    score -= 10
  }
  if (stmts.fcfNegativeMajority) {
    issues.push({ sev: 'MEDIUM', code: 'FCF_NEGATIVE', msg: `FCF negative in ${stmts.negativeFcfCount}/${stmts.fcfYearsChecked} recent years — UFCF DCF may not apply` })
    score -= 5
  }
  if (stmts.growthCapexFlag) {
    issues.push({ sev: 'MEDIUM', code: 'GROWTH_CAPEX', msg: 'CapEx > 1.8× D&A — capital-intensive; projected UFCF may be negative' })
    score -= 5
  }
  if (stmts.ebitdaGapFlag) {
    issues.push({ sev: 'MEDIUM', code: 'EBITDA_GAP', msg: `EBITDA ≠ EBIT + D&A by ${stmts.ebitdaGapPct}% — non-cash items missing from CF D&A` })
    score -= 5
  }
  if (stmts.medianTaxRatePct != null && fin.taxRateWacc != null) {
    const diff = Math.abs(stmts.medianTaxRatePct - fin.taxRateWacc)
    if (diff > 8) {
      issues.push({ sev: 'MEDIUM', code: 'TAX_RATE_MISMATCH', msg: `WACC tax ${fin.taxRateWacc}% vs actual median ${stmts.medianTaxRatePct}% — ${diff.toFixed(0)}pp gap` })
      score -= 5
    }
  }

  return { score: Math.max(0, score), issues }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function auditTicker(ticker) {
  const [fin, stmts] = await Promise.all([
    fetchWithTimeout(`${BASE}/api/financials?ticker=${ticker}`),
    fetchWithTimeout(`${BASE}/api/statements?ticker=${ticker}`),
  ])

  const finAnalysis   = analyseFinancials(fin)
  const stmtsAnalysis = analyseStatements(stmts)
  const { score, issues } = scoreIssues(finAnalysis, stmtsAnalysis)

  return {
    ticker,
    score,
    issues,
    details: { ...finAnalysis, ...stmtsAnalysis },
  }
}

function severityOrder(s) {
  return s === 'CRITICAL' ? 0 : s === 'HIGH' ? 1 : 2
}

async function main() {
  const args = process.argv.slice(2)
  const runAll = args.includes('--all')

  let tickers
  if (runAll) {
    // Dynamically extract tickers from the strategy universe file
    // (read the TS file as text and extract ticker values — avoids needing tsx)
    const { readFileSync } = await import('fs')
    const src = readFileSync(new URL('../lib/strategies/types.ts', import.meta.url), 'utf-8')
    const matches = src.match(/ticker:\s*'([^']+)'/g) ?? []
    const all = [...new Set(matches.map(m => m.replace(/ticker:\s*'/, '').replace("'", '')))]
    // Filter out .BA and =$F futures (those aren't stock page tickers)
    tickers = all.filter(t => !t.includes('.BA') && !t.includes('='))
    console.log(`Running full universe: ${tickers.length} tickers (estimated ${Math.ceil(tickers.length * DELAY_MS / 60000)} min)`)
  } else if (args.filter(a => !a.startsWith('--')).length > 0) {
    tickers = args.filter(a => !a.startsWith('--'))
  } else {
    tickers = [...new Set(SAMPLE_TICKERS)]
    console.log(`Running sample: ${tickers.length} tickers`)
  }

  console.log('Dev server:', BASE)
  console.log('─'.repeat(80))

  const results = []
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i]
    process.stdout.write(`[${String(i + 1).padStart(3)}/${tickers.length}] ${ticker.padEnd(8)} `)
    try {
      const result = await auditTicker(ticker)
      results.push(result)
      const badge = result.score >= 80 ? '✅' : result.score >= 50 ? '⚠️ ' : '🔴'
      const topIssue = result.issues.sort((a, b) => severityOrder(a.sev) - severityOrder(b.sev))[0]
      console.log(`${badge} score=${result.score.toString().padStart(3)}  ${topIssue ? `[${topIssue.sev}] ${topIssue.code}` : 'clean'}`)
    } catch (err) {
      console.log(`❌ error: ${err.message}`)
      results.push({ ticker, score: 0, issues: [{ sev: 'CRITICAL', code: 'EXCEPTION', msg: err.message }], details: {} })
    }
    if (i < tickers.length - 1) await sleep(DELAY_MS)
  }

  // ── Summary ──
  console.log('\n' + '═'.repeat(80))
  console.log('SUMMARY')
  console.log('═'.repeat(80))

  const sorted = [...results].sort((a, b) => a.score - b.score)

  // Issue frequency table
  const freq = {}
  for (const r of results) {
    for (const issue of r.issues) {
      freq[issue.code] = (freq[issue.code] ?? 0) + 1
    }
  }
  console.log('\nIssue frequency (sorted by prevalence):')
  Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .forEach(([code, count]) => {
      const pct = (count / results.length * 100).toFixed(0)
      console.log(`  ${code.padEnd(25)} ${count.toString().padStart(3)} / ${results.length}  (${pct.padStart(3)}%)`)
    })

  // Score distribution
  const buckets = { '80-100': 0, '50-79': 0, '0-49': 0 }
  for (const r of results) {
    if (r.score >= 80) buckets['80-100']++
    else if (r.score >= 50) buckets['50-79']++
    else buckets['0-49']++
  }
  console.log(`\nScore distribution (${results.length} tickers):`)
  console.log(`  ✅ 80-100 (good):     ${buckets['80-100']}`)
  console.log(`  ⚠️  50-79 (issues):    ${buckets['50-79']}`)
  console.log(`  🔴  0-49  (critical):  ${buckets['0-49']}`)

  // Worst 10
  console.log('\nWorst 10 tickers:')
  sorted.slice(0, 10).forEach(r => {
    const topIssues = r.issues.slice(0, 2).map(i => i.code).join(', ')
    console.log(`  ${r.ticker.padEnd(8)} score=${r.score.toString().padStart(3)}  ${topIssues}`)
  })

  // Write JSON
  const outPath = new URL('data-audit-results.json', import.meta.url)
  writeFileSync(outPath, JSON.stringify({ runAt: new Date().toISOString(), results }, null, 2))
  console.log(`\nFull results written to scripts/data-audit-results.json`)
}

main().catch(e => { console.error(e); process.exit(1) })
