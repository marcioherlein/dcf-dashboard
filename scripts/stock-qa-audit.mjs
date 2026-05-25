/**
 * Stock QA Audit — API + Financial Consistency + Valuation Method checks
 *
 * Usage:
 *   node scripts/stock-qa-audit.mjs PAGS
 *   node scripts/stock-qa-audit.mjs NVDA AAPL TSLA ...
 *
 * Requires dev server running on localhost:3000.
 * Writes results to scripts/stock-audit-results.json
 */

import { writeFileSync, readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

const BASE       = 'http://localhost:3000'
const DELAY_MS   = 800
const TIMEOUT_MS = 30000
const OUT_PATH   = join(__dirname, 'stock-audit-results.json')

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchWithTimeout(url) {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return { __httpError: res.status, __url: url }
    return res.json()
  } catch (e) {
    clearTimeout(timer)
    return { __fetchError: e.message, __url: url }
  }
}

/** Safely traverse a dot-path like "quote.sector" on an object. */
function getPath(obj, path) {
  return path.split('.').reduce((cur, key) => (cur != null ? cur[key] : undefined), obj)
}

function isFiniteNum(v) {
  return v != null && typeof v === 'number' && isFinite(v) && !isNaN(v)
}

function safeDiv(a, b) {
  if (!isFiniteNum(a) || !isFiniteNum(b) || b === 0) return null
  return a / b
}

function calcCAGR(start, end, years) {
  if (!isFiniteNum(start) || !isFiniteNum(end) || start <= 0 || end <= 0 || years <= 0) return null
  return Math.pow(end / start, 1 / years) - 1
}

/** Pick first non-null value from an object by trying multiple field names. */
function pick(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k]
    if (v != null) return v
  }
  return null
}

function issue(sev, code, msg, detail = null) {
  return { sev, code, msg, ...(detail ? { detail } : {}) }
}

// ── Part 1 — Required Field Presence ─────────────────────────────────────────

const REQUIRED_FINANCIALS = [
  'quote.price', 'quote.change', 'quote.changePct', 'quote.marketCap',
  'quote.currency', 'quote.sector', 'quote.fiftyTwoWeekHigh', 'quote.fiftyTwoWeekLow',
  'companyName', 'businessProfile',
  'wacc', 'wacc.wacc', 'wacc.inputs.beta', 'wacc.inputs.rfRate', 'wacc.inputs.taxRate',
  'fairValue', 'fairValue.fairValuePerShare', 'fairValue.sharesOutstanding',
  'valuationMethods', 'valuationMethods.triangulatedFairValue', 'valuationMethods.triangulatedUpsidePct',
  'scenarios', 'cagr', 'cagrAnalysis',
  'ratings',
  'financialStatements.incomeStatement', 'financialStatements.balanceSheet', 'financialStatements.cashFlow',
]

const SOFT_FINANCIALS = [
  'quote.peRatio',
  'quote.analystTargetMean',
  'cagrAnalysis.numAnalysts',
  'cagrAnalysis.blended',
  'cagrAnalysis.analystEstimate1y',
  'cagrAnalysis.historicalCagr3y',
  'terminalG',
]

const REQUIRED_STATEMENTS = [
  'annual.incomeStatement', 'annual.balanceSheet', 'annual.cashFlow',
  'quarterly.incomeStatement', 'quarterly.balanceSheet', 'quarterly.cashFlow',
  'ttm.incomeStatement', 'ttm.balanceSheet', 'ttm.cashFlow',
  'financialCurrency', 'tradingCurrency',
]

function auditRequiredFields(fin, stmts) {
  const issues = []

  for (const path of REQUIRED_FINANCIALS) {
    const v = getPath(fin, path)
    if (v == null) {
      issues.push(issue('CRITICAL', 'FIELD_MISSING', `Required field missing: ${path}`))
    } else if (typeof v === 'number' && !isFinite(v)) {
      issues.push(issue('CRITICAL', 'FIELD_NONFINITE', `Non-finite value at ${path}: ${v}`))
    } else if (Array.isArray(v) && v.length === 0) {
      issues.push(issue('WARN', 'ARRAY_EMPTY', `Array empty: ${path}`))
    }
  }

  for (const path of SOFT_FINANCIALS) {
    const v = getPath(fin, path)
    if (v == null) {
      issues.push(issue('INFO', 'FIELD_SOFT_MISSING', `Optional field missing: ${path} — ensure UI shows fallback`))
    }
  }

  if (stmts) {
    for (const path of REQUIRED_STATEMENTS) {
      const v = getPath(stmts, path)
      if (v == null) {
        issues.push(issue('CRITICAL', 'STMTS_FIELD_MISSING', `Statements field missing: ${path}`))
      } else if (Array.isArray(v) && v.length === 0) {
        issues.push(issue('WARN', 'STMTS_ARRAY_EMPTY', `Statements array empty: ${path}`))
      }
    }
  }

  return issues
}

// ── Part 2 — Financial Consistency ───────────────────────────────────────────

function auditFinancialConsistency(fin, stmts) {
  const issues = []

  const sector     = fin.quote?.sector ?? ''
  const isFintech  = /financial|bank|insurance|fintech|payment|broker|credit/i.test(sector)
  const isForeign  = (fin.providerStatus?.fx?.rate ?? 1) !== 1
  const fxRate     = fin.providerStatus?.fx?.rate ?? 1

  // --- Revenue trend & CAGR ---
  const histIS = (fin.financialStatements?.incomeStatement ?? []).filter(r => !r.isProjected)
  const revenues = histIS.map(r => r.revenue).filter(isFiniteNum)

  if (revenues.length < 3) {
    issues.push(issue('WARN', 'REVENUE_HISTORY_SHORT', `Only ${revenues.length} historical revenue rows — need ≥ 3 for CAGR`))
  }

  if (revenues.length >= 3) {
    // Use last 4 rows only → 3Y CAGR, to match cagrAnalysis.historicalCagr3y lookback
    const rev3y = revenues.slice(-4)
    const calc3yCAGR = calcCAGR(rev3y[0], rev3y[rev3y.length - 1], rev3y.length - 1)
    const apiCAGR = fin.cagr ?? null
    const blendedCAGR = fin.cagrAnalysis?.blended ?? null

    // Compare computed 3Y CAGR vs cagrAnalysis.historicalCagr3y — same lookback, apples-to-apples
    const historicalCagr3y = fin.cagrAnalysis?.historicalCagr3y ?? null
    if (calc3yCAGR != null && historicalCagr3y != null) {
      const diffBps = Math.abs(calc3yCAGR - historicalCagr3y) * 10000
      if (diffBps > 500 && !isForeign) {
        issues.push(issue('WARN', 'CAGR_MISMATCH',
          `Computed 3Y historical CAGR ${(calc3yCAGR * 100).toFixed(1)}% vs cagrAnalysis.historicalCagr3y ${(historicalCagr3y * 100).toFixed(1)}% — ${diffBps.toFixed(0)}bps gap`,
          { calc3yCAGR, historicalCagr3y, diffBps }
        ))
      } else if (diffBps > 200 && isForeign) {
        issues.push(issue('INFO', 'CAGR_FX_LIKELY',
          `CAGR gap ${diffBps.toFixed(0)}bps — probable FX effect (stmts in ${stmts?.financialCurrency}, quote in ${fin.quote?.currency})`,
          { calc3yCAGR, historicalCagr3y }
        ))
      }
    }

    // CAGR consistency between api.cagr and cagrAnalysis.blended
    if (apiCAGR != null && blendedCAGR != null) {
      const spreadBps = Math.abs(apiCAGR - blendedCAGR) * 10000
      if (spreadBps > 300) {
        issues.push(issue('WARN', 'CAGR_INTERNAL_MISMATCH',
          `api.cagr ${(apiCAGR * 100).toFixed(1)}% vs cagrAnalysis.blended ${(blendedCAGR * 100).toFixed(1)}% — ${spreadBps.toFixed(0)}bps spread`,
          { apiCAGR, blendedCAGR }
        ))
      }
    }
  }

  // --- Margins ---
  const latestHist = histIS.at(-1) ?? {}
  const rev = latestHist.revenue
  if (!isFiniteNum(rev) || rev <= 0) {
    issues.push(issue('WARN', 'REVENUE_LATEST_MISSING', 'Latest historical revenue null/zero — margins cannot be validated'))
  } else {
    const netMargin = safeDiv(latestHist.netIncome, rev)
    const opMargin  = safeDiv(latestHist.operatingIncome, rev)
    const ebitdaMgn = safeDiv(latestHist.ebitda, rev)

    for (const [label, val] of [['netMargin', netMargin], ['opMargin', opMargin], ['ebitdaMargin', ebitdaMgn]]) {
      if (val != null && (val > 2.0 || val < -5.0)) {
        issues.push(issue('CRITICAL', 'MARGIN_IMPOSSIBLE', `${label} = ${(val * 100).toFixed(1)}% is outside possible range`, { label, val }))
      } else if (val != null && (val > 1.0 || val < -1.5)) {
        issues.push(issue('WARN', 'MARGIN_EXTREME', `${label} = ${(val * 100).toFixed(1)}% is unusually extreme (expected for pre-profit companies)`, { label, val }))
      }
    }
  }

  // FCF margin from cashflow rows
  const histCF = (fin.financialStatements?.cashFlow ?? []).filter(r => !r.isProjected)
  const latestCF = histCF.at(-1) ?? {}
  if (latestCF.freeCashFlow != null && isFiniteNum(rev) && rev > 0) {
    const fcfMargin = safeDiv(latestCF.freeCashFlow, rev)
    if (fcfMargin != null && (fcfMargin > 2.0 || fcfMargin < -5.0)) {
      issues.push(issue('CRITICAL', 'FCF_MARGIN_IMPOSSIBLE', `FCF margin ${(fcfMargin * 100).toFixed(1)}% is suspicious`))
    } else if (fcfMargin != null && (fcfMargin > 1.0 || fcfMargin < -2.0)) {
      issues.push(issue('WARN', 'FCF_MARGIN_EXTREME', `FCF margin ${(fcfMargin * 100).toFixed(1)}% is unusually large (expected for pre-profit/capex-heavy companies)`))
    }
  }

  // FCF proxy risk (same logic as data-audit.mjs, extended)
  const histISPairs = histIS.filter(r => !r.isProjected)
  const histCFPairs = histCF.filter(r => !r.isProjected)
  let fcfProxyRisk = false
  if (histISPairs.length >= 2 && histCFPairs.length >= 2) {
    let matchCount = 0
    let total = 0
    for (const cf of histCFPairs) {
      const is = histISPairs.find(r => r.year === cf.year)
      if (!is || cf.freeCashFlow == null || is.netIncome == null) continue
      total++
      const pct = Math.abs(cf.freeCashFlow - is.netIncome) / (Math.abs(is.netIncome) || 1)
      if (pct < 0.05) matchCount++
    }
    fcfProxyRisk = total >= 2 && matchCount >= total * 0.6
  }
  if (fcfProxyRisk) {
    issues.push(issue('WARN', 'FCF_EQUALS_NI', 'FCF ≈ Net Income in ≥60% of rows — verify CapEx is deducted (may be expected for fintech/financial companies)'))
  }

  // --- Balance sheet ---
  const bsRows = (fin.financialStatements?.balanceSheet ?? []).filter(r => !r.isProjected)
  // Use last row that actually has data (some tickers have a null placeholder for the current incomplete FY)
  const latestBS = [...bsRows].reverse().find(r => r.totalAssets != null) ?? {}
  if (latestBS.totalAssets == null) {
    issues.push(issue('CRITICAL', 'TOTAL_ASSETS_MISSING', 'totalAssets null in latest balance sheet row'))
  }

  // net debt sanity
  const marketCap = fin.quote?.marketCap ?? null
  const fvNetDebt = (fin.fairValue?.equityValue != null && fin.fairValue?.ev != null)
    ? fin.fairValue.ev - fin.fairValue.equityValue
    : null
  if (isFiniteNum(fvNetDebt) && isFiniteNum(marketCap) && marketCap > 0) {
    if (fvNetDebt < -1.5 * marketCap) {
      issues.push(issue('WARN', 'NET_CASH_EXTREME', `Net debt = ${(fvNetDebt / 1e9).toFixed(2)}B is extremely negative vs mktcap ${(marketCap / 1e9).toFixed(2)}B`))
    }
    if (fvNetDebt > 3 * marketCap) {
      issues.push(issue('CRITICAL', 'DEBT_EXCEEDS_MKTCAP_3X', `Net debt ${(fvNetDebt / 1e9).toFixed(2)}B > 3× market cap ${(marketCap / 1e9).toFixed(2)}B`))
    }
  }

  // --- WACC > terminal growth ---
  const wacc      = fin.wacc?.wacc ?? null
  const terminalG = fin.terminalG ?? 0.025
  if (isFiniteNum(wacc) && wacc <= terminalG) {
    issues.push(issue('CRITICAL', 'WACC_LE_TERMINAL_G',
      `WACC ${(wacc * 100).toFixed(2)}% ≤ terminal growth ${(terminalG * 100).toFixed(2)}% — DCF terminal value invalid`))
  }

  // --- Beta sanity ---
  const beta = fin.wacc?.inputs?.beta ?? null
  if (beta == null) {
    issues.push(issue('WARN', 'BETA_MISSING', 'Beta not available — cost of equity may be inaccurate'))
  } else if (beta < 0.1) {
    issues.push(issue('WARN', 'BETA_TOO_LOW', `Beta = ${beta.toFixed(3)} — unusually low, likely data issue`))
  } else if (beta > 5.0) {
    issues.push(issue('WARN', 'BETA_TOO_HIGH', `Beta = ${beta.toFixed(3)} — unusually high`))
  }

  // --- Analyst data ---
  const numAnalysts = fin.cagrAnalysis?.numAnalysts ?? 0
  if (numAnalysts === 0) {
    issues.push(issue('INFO', 'NO_ANALYST_COVERAGE', 'No analyst coverage — UI must show fallback, not fake analyst estimate'))
  }
  if (!fin.quote?.analystTargetMean || fin.quote.analystTargetMean <= 0) {
    issues.push(issue('INFO', 'NO_ANALYST_TARGET', 'Analyst price target missing — UI must show NABadge'))
  }

  // --- Sector-specific ---
  if (isFintech) {
    issues.push(issue('INFO', 'FINTECH_SECTOR',
      `Sector "${sector}" is financial/fintech — EV/EBITDA and debt metrics may be misleading; ensure sector warning displays`))
  }

  // --- CRP check for foreign stocks ---
  const crp = fin.wacc?.crp ?? fin.wacc?.inputs?.crp ?? 0
  if (isForeign && (!crp || crp === 0)) {
    issues.push(issue('HIGH', 'CRP_MISSING_FOREIGN',
      `FX rate ${fxRate} (foreign stock) but country risk premium = 0 — WACC likely understated`))
  }

  // --- Shares/market cap consistency ---
  const shares = fin.fairValue?.sharesOutstanding ?? null
  const price  = fin.quote?.price ?? null
  if (isFiniteNum(shares) && isFiniteNum(price) && isFiniteNum(marketCap) && marketCap > 0) {
    const impliedMktCap = shares * 1e6 * price  // shares in millions
    const ratio = impliedMktCap / marketCap
    if (ratio < 0.3 || ratio > 3) {
      issues.push(issue('WARN', 'SHARES_MKTCAP_MISMATCH',
        `Implied market cap from shares×price (${(impliedMktCap / 1e9).toFixed(1)}B) differs from quote.marketCap (${(marketCap / 1e9).toFixed(1)}B) by ${((ratio - 1) * 100).toFixed(0)}%`,
        { ratio, impliedMktCap, marketCap }
      ))
    }
  }

  // --- Statements currency vs quote currency ---
  if (stmts?.financialCurrency && fin.quote?.currency) {
    const stmtCcy = stmts.financialCurrency
    const quoteCcy = fin.quote.currency
    if (stmtCcy !== quoteCcy && fxRate === 1) {
      issues.push(issue('HIGH', 'CURRENCY_FX_MISSING',
        `Statements in ${stmtCcy} but quote in ${quoteCcy} and FX rate = 1 — amounts not converted`))
    }
  }

  return issues
}

// ── Part 3 — Valuation Method Checks ─────────────────────────────────────────

function auditValuationMethods(fin, stmts) {
  const issues = []

  const sector    = fin.quote?.sector ?? ''
  const isFintech = /financial|bank|insurance|fintech|payment|broker|credit/i.test(sector)

  // --- triangulated outputs ---
  const triFV = fin.valuationMethods?.triangulatedFairValue
  const triUp = fin.valuationMethods?.triangulatedUpsidePct
  if (triFV == null) {
    issues.push(issue('CRITICAL', 'TRIANGULATED_FV_NULL', 'valuationMethods.triangulatedFairValue is null — no blended fair value'))
  } else if (!isFiniteNum(triFV)) {
    issues.push(issue('CRITICAL', 'TRIANGULATED_FV_NONFINITE', `triangulatedFairValue = ${triFV} is non-finite`))
  }
  if (triUp != null && !isFiniteNum(triUp)) {
    issues.push(issue('WARN', 'TRIANGULATED_UPSIDE_NONFINITE', `triangulatedUpsidePct = ${triUp} is non-finite`))
  }

  // --- DCF / FCFF model ---
  const fcffFV = fin.valuationMethods?.models?.fcff?.fairValue
  if (fcffFV != null && !isFiniteNum(fcffFV)) {
    issues.push(issue('CRITICAL', 'FCFF_FV_NONFINITE', `FCFF fairValue = ${fcffFV}`))
  }

  // --- Multiples estimates ---
  const estimates = fin.valuationMethods?.models?.multiples?.estimates ?? []
  for (const est of estimates) {
    if (!est.applicable) {
      // N/A is expected — just verify there's a reason field or label
      issues.push(issue('INFO', 'METHOD_NOT_APPLICABLE', `${est.multiple} marked not applicable — ensure UI shows clear N/A reason`))
      continue
    }
    if (!isFiniteNum(est.impliedFairValue)) {
      issues.push(issue('CRITICAL', 'METHOD_FV_NONFINITE', `${est.multiple} impliedFairValue = ${est.impliedFairValue}`))
    }
    if (est.impliedFairValue != null && est.impliedFairValue <= 0) {
      issues.push(issue('WARN', 'METHOD_FV_NEGATIVE', `${est.multiple} impliedFairValue ≤ 0 (${est.impliedFairValue?.toFixed(2)}) — likely negative equity value`))
    }
    if (!isFiniteNum(est.upsidePct)) {
      issues.push(issue('WARN', 'METHOD_UPSIDE_NONFINITE', `${est.multiple} upsidePct = ${est.upsidePct}`))
    }
  }

  // Fintech EV/EBITDA flag
  if (isFintech) {
    const evEst = estimates.find(e => e.multiple === 'EV/EBITDA' || e.multiple?.toLowerCase().includes('ebitda'))
    if (evEst?.applicable) {
      issues.push(issue('WARN', 'FINTECH_EV_EBITDA_NO_WARNING',
        `EV/EBITDA is shown as applicable for fintech sector "${sector}" — sidebar must display "less reliable for financial companies" warning`))
    }
  }

  // --- Key inputs presence ---
  const shares = fin.fairValue?.sharesOutstanding ?? null
  const price  = fin.quote?.price ?? null
  const wacc   = fin.wacc?.wacc ?? null
  const cagr   = fin.cagr ?? fin.cagrAnalysis?.blended ?? null

  if (!isFiniteNum(shares) || shares <= 0) {
    issues.push(issue('CRITICAL', 'SHARES_MISSING', 'sharesOutstanding null/zero — all per-share valuation invalid'))
  }
  if (!isFiniteNum(price) || price <= 0) {
    issues.push(issue('CRITICAL', 'PRICE_MISSING', 'quote.price null/zero — upside % and Reverse DCF invalid'))
  }
  if (!isFiniteNum(wacc)) {
    issues.push(issue('CRITICAL', 'WACC_MISSING', 'wacc.wacc null — discount rate missing, all DCF methods invalid'))
  }
  if (!isFiniteNum(cagr)) {
    issues.push(issue('HIGH', 'CAGR_MISSING', 'Both cagr and cagrAnalysis.blended null — growth assumption missing'))
  }

  // Revenue base for Forward P/E and Revenue Multiple
  const revenues = (fin.financialStatements?.incomeStatement ?? []).filter(r => !r.isProjected).map(r => r.revenue).filter(isFiniteNum)
  if (revenues.length === 0) {
    issues.push(issue('HIGH', 'LTV_REVENUE_MISSING', 'No historical revenue in financialStatements — Forward P/E and Revenue Multiple inputs missing'))
  }

  // Net margin for Forward P/E
  const netMarginBP = fin.businessProfile?.netMargin ?? null
  if (netMarginBP == null) {
    issues.push(issue('WARN', 'NET_MARGIN_MISSING', 'businessProfile.netMargin null — Forward P/E margin input missing'))
  }

  // EBITDA for EV/EBITDA — check from statements TTM
  const ttmIS  = stmts?.ttm?.incomeStatement ?? {}
  const ttmEBITDA = pick(ttmIS, 'EBITDA', 'ebitda', 'operatingIncome')
  if (ttmEBITDA == null && !isFintech) {
    issues.push(issue('WARN', 'TTM_EBITDA_MISSING', 'TTM EBITDA not found in statements — EV/EBITDA method may fall back to approximation'))
  }

  // FCF margin for Reverse DCF
  const ttmCF  = stmts?.ttm?.cashFlow ?? {}
  const ttmRev = pick(stmts?.ttm?.incomeStatement ?? {}, 'TotalRevenue', 'totalRevenue', 'Total Revenue')
  const ttmFCF = pick(ttmCF, 'FreeCashFlow', 'freeCashFlow', 'Free Cash Flow')
  if (ttmFCF == null || ttmRev == null) {
    issues.push(issue('INFO', 'TTM_FCF_MARGIN_UNAVAIL', 'TTM FCF or Revenue not in statements — Reverse DCF may use financial statements row'))
  }

  // CAGR identity check: api.cagr and cagrAnalysis.blended should be the same value
  const apiCagrVal = fin.cagr ?? null
  const blendedCagrVal = fin.cagrAnalysis?.blended ?? null
  if (apiCagrVal != null && blendedCagrVal != null) {
    const spreadBps = Math.abs(apiCagrVal - blendedCagrVal) * 10000
    if (spreadBps > 100) {
      issues.push(issue('WARN', 'CAGR_SOURCES_SPREAD',
        `api.cagr ${(apiCagrVal * 100).toFixed(1)}% vs cagrAnalysis.blended ${(blendedCagrVal * 100).toFixed(1)}% — ${spreadBps.toFixed(0)}bps spread (should be identical)`,
        { 'api.cagr': apiCagrVal, 'cagrAnalysis.blended': blendedCagrVal }
      ))
    }
  }

  // terminalG sanity
  const terminalG = fin.terminalG ?? null
  if (terminalG == null) {
    issues.push(issue('INFO', 'TERMINAL_G_NOT_RETURNED', 'terminalG not in API response — UI will use hardcoded 0.025 default'))
  } else if (terminalG > 0.05) {
    issues.push(issue('WARN', 'TERMINAL_G_HIGH', `terminalG = ${(terminalG * 100).toFixed(2)}% — above long-run GDP growth, may inflate terminal value`))
  }

  return issues
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function score(issues) {
  let s = 100
  for (const iss of issues) {
    if (iss.sev === 'CRITICAL') s -= 15
    else if (iss.sev === 'HIGH')     s -= 10
    else if (iss.sev === 'WARN')     s -= 5
    else if (iss.sev === 'INFO')     s -= 1
  }
  return Math.max(0, s)
}

// ── Per-ticker audit ──────────────────────────────────────────────────────────

async function auditTicker(ticker) {
  const [fin, stmts] = await Promise.all([
    fetchWithTimeout(`${BASE}/api/financials?ticker=${ticker}`),
    fetchWithTimeout(`${BASE}/api/statements?ticker=${ticker}`),
  ])

  const fieldIssues   = []
  const consistIssues = []
  const methodIssues  = []

  // HTTP / fetch errors
  if (fin?.__httpError) {
    const code = fin.__httpError
    fieldIssues.push(issue('CRITICAL', 'FINANCIALS_HTTP_ERROR',
      code === 403 ? 'Not NYSE/NASDAQ — exchange restricted' : `HTTP ${code} from /api/financials`))
    return buildReport(ticker, fin, stmts, fieldIssues, [], [])
  }
  if (fin?.__fetchError) {
    fieldIssues.push(issue('CRITICAL', 'FINANCIALS_FETCH_FAIL', `Fetch failed: ${fin.__fetchError}`))
    return buildReport(ticker, fin, stmts, fieldIssues, [], [])
  }
  if (stmts?.__httpError || stmts?.__fetchError) {
    fieldIssues.push(issue('HIGH', 'STATEMENTS_FETCH_FAIL', `Could not fetch /api/statements: ${stmts?.__httpError ?? stmts?.__fetchError}`))
  }

  // Run all checks
  fieldIssues.push(...auditRequiredFields(fin, stmts?.__fetchError ? null : stmts))
  consistIssues.push(...auditFinancialConsistency(fin, stmts))
  methodIssues.push(...auditValuationMethods(fin, stmts))

  return buildReport(ticker, fin, stmts, fieldIssues, consistIssues, methodIssues)
}

function buildReport(ticker, fin, stmts, fieldIssues, consistIssues, methodIssues) {
  const allIssues = [...fieldIssues, ...consistIssues, ...methodIssues]

  const apiScore         = score(fieldIssues)
  const financialScore   = score(consistIssues)
  const valuationScore   = score(methodIssues)
  const overallScore     = Math.round((apiScore + financialScore + valuationScore) / 3)

  const criticalIssues   = allIssues.filter(i => i.sev === 'CRITICAL' || i.sev === 'HIGH')
  const warnings         = allIssues.filter(i => i.sev === 'WARN')
  const infoFlags        = allIssues.filter(i => i.sev === 'INFO')
  const missingFields    = allIssues.filter(i => i.code.includes('MISSING') || i.code.includes('EMPTY')).map(i => i.msg)

  // Collect CAGR snapshot
  const cagrConsistency = {
    apiCagr:           fin?.cagr ?? null,
    blended:           fin?.cagrAnalysis?.blended ?? null,
    analystEstimate1y: fin?.cagrAnalysis?.analystEstimate1y ?? null,
    historicalCagr3y:  fin?.cagrAnalysis?.historicalCagr3y ?? null,
  }

  const sector    = fin?.quote?.sector ?? ''
  const isFintech = /financial|bank|insurance|fintech|payment|broker|credit/i.test(sector)
  const sectorFlags = isFintech ? ['fintech-debt-warning', 'fintech-evebitda-warning'] : []

  const recommendedFixes = criticalIssues.slice(0, 5).map(i => `[${i.sev}] ${i.code}: ${i.msg}`)

  return {
    ticker,
    timestamp:        new Date().toISOString(),
    companyName:      fin?.companyName ?? null,
    sector,
    currency:         fin?.quote?.currency ?? null,
    financialCurrency: stmts?.financialCurrency ?? null,
    overallScore,
    apiScore,
    financialScore,
    valuationScore,
    uiScore:          null,
    criticalIssues,
    warnings,
    infoFlags,
    missingFields,
    cagrConsistency,
    sectorFlags,
    keyMetrics: {
      price:          fin?.quote?.price ?? null,
      fairValue:      fin?.valuationMethods?.triangulatedFairValue ?? null,
      upside:         fin?.valuationMethods?.triangulatedUpsidePct != null
                        ? (fin.valuationMethods.triangulatedUpsidePct * 100).toFixed(1) + '%'
                        : null,
      wacc:           fin?.wacc?.wacc != null ? (fin.wacc.wacc * 100).toFixed(2) + '%' : null,
      beta:           fin?.wacc?.inputs?.beta ?? null,
      cagr:           fin?.cagr != null ? (fin.cagr * 100).toFixed(1) + '%' : null,
      terminalG:      fin?.terminalG != null ? (fin.terminalG * 100).toFixed(2) + '%' : null,
      numAnalysts:    fin?.cagrAnalysis?.numAnalysts ?? null,
    },
    recommendedFixes,
    fixed: false,
  }
}

// ── Summary printing ──────────────────────────────────────────────────────────

function printSummary(results) {
  console.log('\n' + '═'.repeat(80))
  console.log('SUMMARY')
  console.log('═'.repeat(80))

  const sorted = [...results].sort((a, b) => a.overallScore - b.overallScore)

  const freq = {}
  for (const r of results) {
    for (const iss of [...r.criticalIssues, ...r.warnings]) {
      freq[iss.code] = (freq[iss.code] ?? 0) + 1
    }
  }
  console.log('\nIssue frequency (top 15):')
  Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([code, count]) => {
      const pct = (count / results.length * 100).toFixed(0)
      console.log(`  ${code.padEnd(30)} ${count.toString().padStart(3)} / ${results.length}  (${pct.padStart(3)}%)`)
    })

  const buckets = { '80-100': 0, '50-79': 0, '0-49': 0 }
  for (const r of results) {
    if (r.overallScore >= 80) buckets['80-100']++
    else if (r.overallScore >= 50) buckets['50-79']++
    else buckets['0-49']++
  }
  console.log(`\nScore distribution (${results.length} tickers):`)
  console.log(`  ✅ 80-100: ${buckets['80-100']}`)
  console.log(`  ⚠️  50-79: ${buckets['50-79']}`)
  console.log(`  🔴  0-49:  ${buckets['0-49']}`)

  console.log('\nWorst 5 tickers:')
  sorted.slice(0, 5).forEach(r => {
    const top = r.criticalIssues[0]
    console.log(`  ${r.ticker.padEnd(8)} overall=${r.overallScore}  ${top ? `[${top.sev}] ${top.code}` : 'no critical issues'}`)
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args    = process.argv.slice(2)
  const tickers = args.filter(a => !a.startsWith('--'))

  if (tickers.length === 0) {
    console.error('Usage: node scripts/stock-qa-audit.mjs TICKER [TICKER2 ...]')
    process.exit(1)
  }

  console.log(`Stock QA Audit — ${tickers.length} ticker(s)`)
  console.log(`Dev server: ${BASE}`)
  console.log('─'.repeat(80))

  // Load existing results to merge
  let existing = {}
  if (existsSync(OUT_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(OUT_PATH, 'utf-8'))
      for (const r of (raw.results ?? [])) existing[r.ticker] = r
    } catch { /* start fresh */ }
  }

  const newResults = []
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i]
    process.stdout.write(`[${String(i + 1).padStart(3)}/${tickers.length}] ${ticker.padEnd(8)} `)
    try {
      const result = await auditTicker(ticker)
      newResults.push(result)
      existing[ticker] = result  // overwrite existing entry

      const badge    = result.overallScore >= 80 ? '✅' : result.overallScore >= 50 ? '⚠️ ' : '🔴'
      const topIssue = result.criticalIssues[0]
      console.log(
        `${badge} overall=${result.overallScore}  api=${result.apiScore}  fin=${result.financialScore}  val=${result.valuationScore}` +
        (topIssue ? `  → [${topIssue.sev}] ${topIssue.code}` : '  → clean')
      )
    } catch (err) {
      console.log(`❌ exception: ${err.message}`)
      const r = { ticker, overallScore: 0, criticalIssues: [issue('CRITICAL', 'EXCEPTION', err.message)], warnings: [], infoFlags: [], fixed: false }
      newResults.push(r)
      existing[ticker] = r
    }
    if (i < tickers.length - 1) await sleep(DELAY_MS)
  }

  if (newResults.length >= 2) printSummary(newResults)

  // Write merged results
  const allResults = Object.values(existing).sort((a, b) => a.ticker.localeCompare(b.ticker))
  writeFileSync(OUT_PATH, JSON.stringify({ runAt: new Date().toISOString(), count: allResults.length, results: allResults }, null, 2))
  console.log(`\nResults written to scripts/stock-audit-results.json`)
}

main().catch(e => { console.error(e); process.exit(1) })
