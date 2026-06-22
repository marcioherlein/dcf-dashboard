import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'
import { getFmpBundle, getFmpSecFilings, getFmpTopInstitutionalOwners, type FmpIncomeStatement, type FmpBalanceSheet, type FmpCashFlowStatement } from '@/lib/data/fmpClient'
import { getFinancials, getQuote, getHistorical, getSPYHistorical, getFXRate, getPeerQuotes, getAnnualBalanceSheet, getAnnualCashFlow, getAnnualIncomeStatement } from '@/lib/data/yahooClient'
import { calculateBeta } from '@/lib/dcf/calculateBeta'
import { calculateWACC, extractWACCInputs } from '@/lib/dcf/calculateWACC'
import { projectCashFlows, extractFCFInputs } from '@/lib/dcf/projectCashFlows'
import { calculateFairValue } from '@/lib/dcf/calculateFairValue'
import { calculateRatings } from '@/lib/dcf/calculateRatings'
import { getRfRate } from '@/lib/data/fredClient'
import { detectCompanyType, primaryModelLabel, companyTypeLabel, companyTypeIntrinsico, getModelWeights, FOUR_MODEL_DCF_WEIGHTS, getDCFModelRationale } from '@/lib/dcf/detectCompanyType'
import { calculateDDM } from '@/lib/dcf/calculateDDM'
import { calculateFCFE } from '@/lib/dcf/calculateFCFE'
import { calculateMultiples, PEER_TICKERS } from '@/lib/dcf/calculateMultiples'
import { calculatePiotroski, calculateAltman, calculateBeneish, calculateROIC } from '@/lib/dcf/calculateScores'
import { getCRPByCountry } from '@/lib/dcf/countryRiskPremium'
import { runAssumptionAudit } from '@/lib/valuation/assumptionAuditor'
import { seedAssumptions, buildSnapshot } from '@/lib/valuation/cockpitBuilders'
import { computeCockpitOutput } from '@/lib/valuation/cockpit'
import { FREE_STOCK_ANALYSES_PER_MONTH } from '@/lib/constants'

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 30, 60_000, 'financials')
  if (limited) return limited

  const session = await getServerSession(authOptions)

  // Allow unauthenticated requests — the client-side view gate shows the login wall
  // for users who aren't signed in. The server-side view gate below enforces
  // monthly limits only for authenticated free-tier users.
  // Automation key bypasses all checks for GitHub Actions posting.
  const incomingKey = req.headers.get('x-automation-key')
  const automationKey = process.env.AUTOMATION_API_KEY
  const isAutomation = !!(automationKey && incomingKey === automationKey)

  // Dev-only: allow local audit scripts via x-audit-dev-key
  if (!session && !isAutomation) {
    const devKey = req.headers.get('x-audit-dev-key')
    const allowedKey = process.env.AUDIT_DEV_KEY
    if (process.env.NODE_ENV !== 'production' && allowedKey && devKey !== allowedKey) {
      // Dev mode but wrong key — still allow through (public access is intentional)
    }
    // Production: unauthenticated requests are allowed — no 401
  }

  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  // ── Server-side view gate ──────────────────────────────────────────────────
  // The client-side gate can be bypassed by blocking the /api/stock-views fetch.
  // This enforces the limit at the data layer — the authoritative check.
  if (session?.user?.email) {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (sbUrl && sbKey) {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(sbUrl, sbKey)
      const { data: userRow } = await sb
        .from('users')
        .select('id, plan')
        .eq('email', session.user.email)
        .single()

      if (userRow) {
        const plan = (userRow as { plan?: string }).plan
        if (plan !== 'pro') {
          const FREE_LIMIT = FREE_STOCK_ANALYSES_PER_MONTH
          const monthStart = new Date()
          monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

          // Check if this ticker is already unlocked this month
          const { data: existingView } = await sb
            .from('stock_views')
            .select('id')
            .eq('user_id', (userRow as { id: string }).id)
            .eq('ticker', ticker)
            .gte('first_viewed_at', monthStart.toISOString())
            .maybeSingle()

          if (!existingView) {
            // Not yet unlocked — check monthly count
            const { data: monthRows } = await sb
              .from('stock_views')
              .select('ticker')
              .eq('user_id', (userRow as { id: string }).id)
              .gte('first_viewed_at', monthStart.toISOString())
            const monthCount = new Set(monthRows?.map((r: { ticker: string }) => r.ticker) ?? []).size
            if (monthCount >= FREE_LIMIT) {
              return NextResponse.json(
                { error: 'Monthly limit reached. Upgrade to Pro for unlimited access.', code: 'VIEW_LIMIT_REACHED', limit: FREE_LIMIT },
                { status: 402 }
              )
            }
          }
        }
      }
    }
  }
  // ── End view gate ──────────────────────────────────────────────────────────

  try {
    const [financials, quote, stockHistory, spyHistory, rfRate, fmp, annualBSRows] = await Promise.all([
      getFinancials(ticker),
      getQuote(ticker),
      getHistorical(ticker, '5y').catch(() => []),
      getSPYHistorical().catch(() => []),
      getRfRate(),
      getFmpBundle(ticker).catch(() => ({ incomeStatements: [], cashFlowStatements: [], balanceSheets: [], keyMetrics: [], ratios: [], keyMetricsQuarterly: [], incomeStatementQuarterly: [], ratiosQuarterly: [] })),
      getAnnualBalanceSheet(ticker).catch(() => []),
    ])
    // Sequential after main batch — avoids Yahoo rate-limiting from too many simultaneous calls
    const annualCFRows = await getAnnualCashFlow(ticker).catch(() => [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const annualISRows: any[] = await getAnnualIncomeStatement(ticker).catch(() => [])
    // Non-blocking enrichment data (SEC filings + institutional holders)
    const [secFilingsRaw, institutionalHoldersRaw] = await Promise.all([
      getFmpSecFilings(ticker, 8),
      getFmpTopInstitutionalOwners(ticker),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fin = financials as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = quote as any
    const currentPrice = (q.regularMarketPrice ?? 0) as number
    const quoteCurrency: string = q.currency ?? 'USD'

    // --- Exchange restriction: NYSE and NASDAQ only ---
    const NYSE_NASDAQ_CODES = new Set(['NMS', 'NGM', 'NCM', 'NYQ', 'NYS', 'ASE', 'PCX', 'BTS'])
    const exchangeCode = (q.exchange ?? '').toUpperCase()
    const exchangeName = (q.fullExchangeName ?? q.exchangeName ?? '').toUpperCase()
    const isAllowed = NYSE_NASDAQ_CODES.has(exchangeCode)
      || exchangeName.includes('NASDAQ')
      || exchangeName.includes('NYSE')
    if (!isAllowed) {
      const displayExchange = q.fullExchangeName ?? q.exchange ?? 'unknown exchange'
      return NextResponse.json(
        { error: `${ticker} trades on ${displayExchange}. Analysis is currently available for NYSE and NASDAQ-listed stocks only.` },
        { status: 403 }
      )
    }

    // --- Currency mismatch detection (e.g. BABA reports in CNY but trades in USD) ---
    const financialCurrency: string = fin.financialData?.financialCurrency ?? quoteCurrency
    let fxRate = 1 // multiplier to convert financial figures → quote currency
    let financialCurrencyNote = ''
    if (financialCurrency !== quoteCurrency) {
      fxRate = await getFXRate(financialCurrency, quoteCurrency)
      financialCurrencyNote = `${financialCurrency}→${quoteCurrency} @ ${fxRate.toFixed(4)}`
    }

    // Guard: if a company reports in USD but fxRate resolved to something other than 1,
    // Yahoo may have returned inconsistent currency metadata. Log a warning so this is
    // visible in server logs without crashing the response.
    if (quoteCurrency === 'USD' && financialCurrency === 'USD' && fxRate !== 1) {
      console.warn(`[financials/${ticker}] FX anomaly: USD→USD but fxRate=${fxRate} — check Yahoo currency metadata`)
    }

    // Country Risk Premium (Damodaran): use country name first (handles USD-reporters from EM)
    const domicileCountry: string | null = (fin.summaryProfile?.country as string | undefined) ?? null
    const crp = getCRPByCountry(domicileCountry, financialCurrency)

    // Beta via regression
    const beta = calculateBeta(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (stockHistory as any[]).map((p) => ({ date: new Date(p.date), close: p.close ?? p.adjclose ?? 0 })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (spyHistory as any[]).map((p) => ({ date: new Date(p.date), close: p.close ?? p.adjclose ?? 0 })),
    )

    // Holding-period returns — use already-fetched 5y price history
    const periodReturn = (prices: { date: string; close: number }[], yearsBack: number): number | null => {
      if (!prices.length) return null
      const sorted = [...prices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const cutoff = new Date()
      cutoff.setFullYear(cutoff.getFullYear() - yearsBack)
      const entry = sorted.find(p => new Date(p.date) >= cutoff)
      const exit = sorted[sorted.length - 1]
      if (!entry || !exit || entry.close <= 0) return null
      return (exit.close - entry.close) / entry.close
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sH = (stockHistory as any[]).map(p => ({ date: String(p.date), close: p.close ?? p.adjclose ?? 0 }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spH = (spyHistory as any[]).map(p => ({ date: String(p.date), close: p.close ?? p.adjclose ?? 0 }))
    const holdingReturns = {
      stock1y: periodReturn(sH, 1),
      stock3y: periodReturn(sH, 3),
      stock5y: periodReturn(sH, 5),
      spy1y: periodReturn(spH, 1),
      spy3y: periodReturn(spH, 3),
      spy5y: periodReturn(spH, 5),
    }

    // WACC (uses percentages/ratios — not currency-sensitive)
    const waccInputs = extractWACCInputs(fin, rfRate, beta, fxRate, crp)
    const waccResult = calculateWACC(waccInputs)

    // FCF + CAGR — values are in financial currency; convert to quote currency
    // Pass foreignCurrency=true when reporting currency ≠ quote currency so that
    // the CAGR model discards inflation-distorted local revenue history.
    const { baseFCF: baseFCFLocal, cagr, cagrAnalysis, historicalRevenues: historicalRevenuesLocal, isNegativeFCF, normalizedNetIncomeM: normalizedNetIncomeMLocal } = extractFCFInputs(fin, fxRate !== 1)
    let baseFCF = baseFCFLocal * fxRate
    const historicalRevenues = historicalRevenuesLocal.map((r) => r * fxRate)
    const normalizedNetIncomeM = normalizedNetIncomeMLocal * fxRate

    // Sanity check: FCF yield > 30% vs market cap is unrealistic — cap to 15%
    const marketCapM = (q.marketCap ?? 0) / 1e6
    let fcfCapApplied = false
    if (marketCapM > 0 && baseFCF / marketCapM > 0.30) {
      baseFCF = marketCapM * 0.15
      fcfCapApplied = true
    }

    // Stale-Yahoo guard (F4): when Yahoo fd.freeCashflow is > 10× the most recent
    // reported FCF, it's returning a pre-capex-surge or stale value (ORCL: -35×,
    // YPF: 18×, NVDA: 0.48× — these are the extreme cases).
    // When histFCF is available and the ratio > 10×, prefer histFCF as it reflects
    // the most recent reported OCF−capex. Skip for financial/fintech types where
    // NI-based baseFCF is intentionally different from reported OCF.
    // Also skip if histFCF is zero or negative (those are their own issue categories).

    // DCF (FCFF)
    // Terminal growth aligned with Damodaran: should approximate long-run nominal GDP growth.
    // High-growth companies (>15% CAGR) → 2.5% developed, but for EM companies (CRP > 2%)
    // use max(rule, rfRate + 2%) as proxy for nominal EM GDP growth.
    // Standard companies (5–15% CAGR) → 2.0% (developed market nominal GDP)
    // Mature / low-growth (<5%) → 1.5% (conservative / real GDP)
    const _terminalGBase = cagr > 0.15 ? 0.025 : cagr > 0.05 ? 0.020 : 0.015
    // Emerging market uplift: when CRP > 2% the company operates in a higher nominal GDP
    // environment — anchoring terminal growth at developed-market 2.5% structurally undervalues it.
    // Proxy: rfRate (risk-free rate, typically US 10Y) + 2% reflects ~4.5–5% nominal EM GDP.
    // Cap raised from 5.5% to 7%: Argentina CRP=15.4% → floor=rfRate+2%=6.3% which exceeded
    // the old 5.5% cap. The new cap (7%) allows the floor to be respected for high-CRP markets
    // while still preventing runaway terminal growth for speculative EM assumptions.
    const terminalG = crp > 0.02
      ? Math.min(Math.max(_terminalGBase, rfRate + 0.02), 0.07)  // floor at EM-calibrated rate, cap at 7%
      : _terminalGBase
    // Growth model selection (Damodaran): three-stage when growth >> stable (CAGR > 15% or pre-profit).
    // companyType is detected later; cagr + isNegativeFCF covers all practical cases before that.
    const growthModel = (cagr > 0.15 || isNegativeFCF) ? 'three-stage' as const : 'two-stage' as const
    const dcfResult = projectCashFlows({ baseFCF, cagr, wacc: waccResult.wacc, terminalG, growthModel })

    // Balance sheet items — convert to quote currency
    const bs = fin.balanceSheetHistory?.balanceSheetStatements?.[0] ?? {}
    // Yahoo Finance uses wildly inconsistent field names across company types and API versions.
    // The extended fallback chain below covers all known variants.
    const cashRaw = (
      bs.cash
      ?? bs.cashAndCashEquivalents
      ?? bs.cashAndShortTermInvestments
      ?? bs.cashCashEquivalentsAndShortTermInvestments
      ?? bs.cashAndCashEquivalentsAtCarryingValue
      ?? bs.cashEquivalents
      ?? bs.cashAndDueFromBanks  // banks
      ?? fin.financialData?.totalCash  // financialData TTM fallback
      ?? 0
    ) as number
    const cashM = cashRaw / 1e6 * fxRate

    // Detect financial sector here for balance sheet treatment
    const isBankOrInsurer = /bank|insurance|financ|fintech|payment|credit|lending|capital market|asset management|brokerage/i.test(
      ((fin.summaryProfile?.sector ?? '') as string) + ' ' + ((fin.summaryProfile?.industry ?? '') as string)
    )
    // Auto OEMs (GM, Ford, Toyota, Honda, Stellantis) have captive finance subsidiaries
    // (e.g. GM Financial) whose entire loan book flows into Yahoo's totalDebt, inflating it
    // 3–5× beyond operational leverage and collapsing the equity bridge to a large negative.
    const isAutoOEM = /Auto Manufacturers|Motor Vehicle/i.test(
      (fin.summaryProfile?.industry ?? '') as string
    )
    // Heuristic: non-financial company where Yahoo totalDebt > 2× market cap almost always
    // signals a captive finance arm (auto, machinery leasing, industrial conglomerates).
    const rawTotalDebtForHeuristic = ((bs.totalDebt ?? 0) as number) / 1e6 * fxRate
    const captiveFinanceHeuristic = !isBankOrInsurer && marketCapM > 0
      && rawTotalDebtForHeuristic / marketCapM > 2.0
    // For any of these cases, use only long-term issued bonds/notes to reflect
    // operational leverage only — this matches how sell-side analysts treat these companies.
    const useOnlyLongTermDebt = isBankOrInsurer || isAutoOEM || captiveFinanceHeuristic
    // For financial companies: use only long-term issued debt (bonds/notes).
    // fd.totalDebt and bs.totalDebt for banks can include deposit liabilities or
    // interbank borrowings that inflate D/V, collapse WACC, and produce a gigantic
    // EV that is then wiped out by subtracting that same "debt" → negative equity.
    // Yahoo Finance uses inconsistent field names across company types and regions.
    // Extend fallback chains to catch all known variants.
    const rawDebtM = useOnlyLongTermDebt
      ? ((bs.longTermDebt ?? bs.longTermDebtNoncurrent ?? bs.longTermDebtAndCapitalLeaseObligation ?? bs.longTermDebtAndFinanceLeaseLiability ?? bs.totalDebt ?? 0) as number) / 1e6 * fxRate
      : ((
          bs.totalDebt
          ?? bs.shortLongTermDebtTotal
          ?? bs.longTermDebt
          ?? bs.longTermDebtAndCapitalLeaseObligation
          ?? bs.longTermDebtAndFinanceLeaseLiability
          ?? bs.totalLongTermDebt
          ?? bs.longTermDebtTotal
          ?? bs.currentDebt
          ?? bs.longTermDebtNoncurrent
          // financialData TTM fallbacks
          ?? fin.financialData?.totalDebt
          ?? 0
        ) as number) / 1e6 * fxRate
    // Safety cap: debt should not exceed 3× market cap (prevents extreme leverage edge cases)
    const debtM = marketCapM > 0 ? Math.min(rawDebtM, marketCapM * 3) : rawDebtM

    // Derive share count from market cap / price so ADR companies (TSM, etc.) get
    // ADR-equivalent units rather than the underlying ordinary share count that Yahoo
    // returns in defaultKeyStatistics.sharesOutstanding (5× too many for TSM).
    const sharesM = (q.marketCap as number) > 0 && currentPrice > 0
      ? (q.marketCap as number) / currentPrice / 1e6
      : ((fin.defaultKeyStatistics?.sharesOutstanding ?? 0) as number) / 1e6

    // Fair value (FCFF — perpetuity growth terminal value)
    const fvResult = calculateFairValue(dcfResult, cashM, debtM, sharesM, currentPrice)

    // Business profile
    const fd = fin.financialData ?? {}
    const profile = fin.summaryProfile ?? {}
    const sd = fin.summaryDetail ?? {}
    const ks = fin.defaultKeyStatistics ?? {}
    const rawFCFLocal = ((fd.freeCashflow ?? 0) as number) / 1e6
    const rawRevMLocal = ((fd.totalRevenue ?? 0) as number) / 1e6

    // Compute FCF from most recent annual cash flow statement (more reliable than Yahoo's TTM freeCashflow,
    // which is distorted for fintechs/payments companies where loan originations flow through operating activities)
    const rawCFHistoryEarly: any[] = fin.cashflowStatementHistory?.cashflowStatements ?? []
    const recentCF = rawCFHistoryEarly[0] ?? {}
    const recentOpCF = ((recentCF.operatingCashflow ?? recentCF.totalCashFromOperatingActivities ?? fd.operatingCashflow ?? 0) as number)
    const recentCapex = ((recentCF.capitalExpenditures ?? recentCF.capitalExpenditure ?? 0) as number)
    // annualFCFLocal = OCF + CapEx (CapEx is stored negative in Yahoo data, so this is OCF - |CapEx|)
    const mostRecentFCF = recentOpCF !== 0 ? (recentOpCF + recentCapex) / 1e6 : rawFCFLocal

    // Normalize FCF for heavy capex investment cycles (e.g. Amazon AI infrastructure, Tesla Gigafactory).
    // Yahoo's cashflowStatementHistory[0] may reflect a TTM period where capex spike compresses FCF to near-zero
    // even though the business generates strong operating cash. Detect this pattern (healthy OCF margin but
    // FCF margin < 2%) and substitute a median of positive FCF years as a more representative base.
    let annualFCFLocal = mostRecentFCF
    if (rawRevMLocal > 0) {
      const mostRecentFCFMargin = mostRecentFCF / rawRevMLocal
      const recentOpCFMargin = recentOpCF > 0 ? (recentOpCF / 1e6) / rawRevMLocal : 0
      if (mostRecentFCFMargin < 0.02 && recentOpCFMargin > 0.10 && rawCFHistoryEarly.length >= 2) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const positiveFCFs = rawCFHistoryEarly.slice(0, 4).flatMap((cf: any) => {
          const opCF = ((cf.operatingCashflow ?? cf.totalCashFromOperatingActivities ?? 0) as number)
          const capex = ((cf.capitalExpenditures ?? cf.capitalExpenditure ?? 0) as number)
          const fcfM = opCF !== 0 ? (opCF + capex) / 1e6 : null
          return fcfM !== null && fcfM > 0 ? [fcfM] : []
        })
        if (positiveFCFs.length >= 2) {
          const sorted = [...positiveFCFs].sort((a, b) => a - b)
          const medianFCF = sorted[Math.floor(sorted.length / 2)]
          if (medianFCF / rawRevMLocal > 0.03) {
            annualFCFLocal = medianFCF
          }
        }
      }
    }

    // Financial sector: Yahoo's OCF is distorted by loan disbursements (client fund flows,
    // loan book growth). Use normalized net income × haircut as distributable earnings proxy —
    // consistent with projectCashFlows.ts behavior for the DCF model.
    // Prefer normalizedNetIncomeM (2-year smoothed from historical statements) over Yahoo's
    // single-point TTM netIncomeToCommon, which is volatile for early-stage fintechs like NU
    // and can flip negative on one bad quarter, making fcfMargin null → reverse DCF → "N/A".
    if (isBankOrInsurer) {
      const stableNI = normalizedNetIncomeM > 0
        ? normalizedNetIncomeM
        : ((fd.netIncomeToCommon ?? fd.netIncome ?? 0) as number) / 1e6
      if (stableNI > 0) {
        annualFCFLocal = stableNI * 0.85
      } else if (annualFCFLocal < 0) {
        annualFCFLocal = 0
      }
    }

    // Revenue-based FCF margin cap by sector (second layer after the market-cap yield cap).
    // A single-year FCF spike — tax refund, working capital release, deferred capex — can push
    // FCF margin to 60-80%, exploding the DCF base far beyond what peers ever sustain.
    // Calibrated to empirical industry ceilings (Damodaran sector data, Jan 2025):
    //   Tech/SaaS: 45% — Veeva ~38%, Adobe ~45% are genuine; 35% would clip them unfairly
    //   Standard:  35% — most non-tech businesses top out around 25-30% FCF margin
    // Only fires if the market-cap yield cap did not already constrain baseFCF.
    const _sL = ((profile.sector ?? q.sector ?? '') + ' ' + (profile.industry ?? '')).toLowerCase()
    const isTechSaaS = /software|technology|internet content|internet retail|semiconductor|data processing|information tech/i.test(_sL)
    const fcfMarginCeiling = isTechSaaS ? 0.45 : 0.35
    if (!fcfCapApplied && rawRevMLocal > 0) {
      const _fcfMarginActual = baseFCF / (rawRevMLocal * fxRate)
      if (_fcfMarginActual > fcfMarginCeiling) {
        baseFCF = rawRevMLocal * fxRate * fcfMarginCeiling
        fcfCapApplied = true
      }
    }

    const businessProfile = {
      description: (profile.longBusinessSummary ?? '') as string,
      industry: (profile.industry ?? '') as string,
      country: (profile.country ?? '') as string,
      employees: (profile.fullTimeEmployees ?? null) as number | null,
      // Treat 0 as null — Yahoo returns 0 for banks/fintechs that don't have COGS
      grossMargin: (fd.grossMargins != null && fd.grossMargins !== 0) ? (fd.grossMargins as number) : null,
      netMargin: (fd.profitMargins ?? null) as number | null,
      fcfMargin: rawRevMLocal > 0 && annualFCFLocal !== 0
        ? Math.min(annualFCFLocal / rawRevMLocal, fcfMarginCeiling)
        : null,
      revenueM: rawRevMLocal * fxRate,
    }

    // Ratings
    // Resolve ROE: Yahoo financialData is the primary source but frequently returns null
    // for companies with distorted book equity (buybacks, stock-based comp, negative equity).
    // Fallback chain: FMP keyMetrics → computed from FMP net income / shareholders equity.
    const roeYahoo = (fd.returnOnEquity ?? null) as number | null
    const roeFmpKm = (fmp.keyMetrics[0]?.returnOnEquity ?? null) as number | null
    // Computed ROE from FMP balance sheet + income statement (most recent annual)
    const roeFmpComputed: number | null = (() => {
      const bs = fmp.balanceSheets?.[0]
      const is = fmp.incomeStatements?.[0]
      if (!bs || !is) return null
      const equity = bs.totalStockholdersEquity ?? null
      const ni = is.netIncome ?? null
      if (equity == null || ni == null || equity <= 0) return null
      return ni / equity
    })()
    const resolvedRoe: number | null = roeYahoo ?? roeFmpKm ?? roeFmpComputed

    const ratings = calculateRatings({
      grossMargin: (fd.grossMargins ?? null) as number | null,
      netMargin: (fd.profitMargins ?? null) as number | null,
      fcfMargin: rawRevMLocal > 0 ? annualFCFLocal / rawRevMLocal : null,
      operatingMargin: (fd.operatingMargins ?? null) as number | null,
      roe: resolvedRoe,
      roa: (fd.returnOnAssets ?? null) as number | null,
      currentRatio: (fd.currentRatio ?? null) as number | null,
      quickRatio: (fd.quickRatio ?? null) as number | null,
      cashM,
      debtM,
      historicalCagr3y: cagrAnalysis.historicalCagr3y,
      analystGrowth1y: cagrAnalysis.analystEstimate1y,
      // Suppress TTM earnings growth from the rating SCORE when the company has strong
      // historical revenue CAGR (>15%) but negative TTM EPS — common for high-growth
      // companies hit by FX headwinds, fintech loan-loss provisions, or one-time charges.
      // earningsGrowthDisplay preserves the raw value so the UI still shows the actual number.
      earningsGrowth: (() => {
        const eg = (fd.earningsGrowth ?? null) as number | null
        if (eg !== null && eg < 0 && (cagrAnalysis.historicalCagr3y ?? 0) > 0.15) return null
        return eg
      })(),
      earningsGrowthDisplay: (fd.earningsGrowth ?? null) as number | null,
      beta: waccResult.inputs.beta,
      marketCapB: (q.marketCap ?? 0) / 1e9,
      upsidePct: fvResult.upsidePct ?? 0,
    })

    // ─── Financial Quality Scores ─────────────────────────────────────────────

    // yahoo-finance2 strips all balance sheet and cashflow fields via "additionalProperties: false"
    // in its quoteSummary schema — only maxAge/endDate survive on BalanceSheetStatement, and only
    // maxAge/endDate/netIncome on CashflowStatement. Use FMP statements instead (already fetched).
    const fmpBS = fmp.balanceSheets as FmpBalanceSheet[]
    const fmpIS = fmp.incomeStatements as FmpIncomeStatement[]
    const fmpCF = fmp.cashFlowStatements as FmpCashFlowStatement[]

    // Map FMP statements to the field names calculatePiotroski/Altman/Beneish/ROIC expect.
    // FMP values are raw (not millions) in the company's reporting currency — fine for ratio-based scores.
    const pBSStmts: any[] = fmpBS.slice(0, 4).map((bs) => ({
      totalAssets: bs.totalAssets,
      totalCurrentAssets: bs.totalCurrentAssets,
      totalCurrentLiabilities: bs.totalCurrentLiabilities,
      longTermDebt: bs.longTermDebt,
      cash: bs.cashAndCashEquivalents,
      cashAndShortTermInvestments: bs.cashAndShortTermInvestments,
      totalLiab: bs.totalAssets - (bs.totalEquity ?? bs.totalStockholdersEquity ?? 0),
      retainedEarnings: null,  // not in FMP free tier; Altman x2 will gracefully fallback to 0
    }))
    const pISStmts: any[] = fmpIS.slice(0, 4).map((is) => ({
      totalRevenue: is.revenue,
      grossProfit: is.grossProfit,
      ebit: is.ebit,
      netIncome: is.netIncome,
      // diluted shares derived from EPS for year-over-year dilution check
      dilutedAverageShares: Math.abs(is.epsDiluted ?? 0) > 0.001
        ? Math.abs(is.netIncome / (is.epsDiluted as number))
        : null,
    }))
    const pCFStmts: any[] = fmpCF.slice(0, 4).map((cf) => ({
      totalCashFromOperatingActivities: cf.netCashProvidedByOperatingActivities,
      operatingCashflow: cf.netCashProvidedByOperatingActivities,
      depreciationAndAmortization: cf.depreciationAndAmortization,
    }))

    // Market cap in financial (reporting) currency for Altman Z-Score comparability
    const marketCapLocal = (q.marketCap ?? 0) / fxRate

    // Shares for dilution check: prefer FMP-derived diluted average shares
    const impliedSharesFmp = (is: typeof pISStmts[0]): number | null =>
      is?.dilutedAverageShares as number | null ?? null
    const sharesNow   = impliedSharesFmp(pISStmts[0]) ?? (ks.sharesOutstanding ?? 0) as number
    const sharesPrior = impliedSharesFmp(pISStmts[1]) ?? sharesNow

    const piotroski = calculatePiotroski(pBSStmts, pISStmts, pCFStmts, sharesNow, sharesPrior)
    const isEmergingMarket = crp > 0
    const altman = calculateAltman(pBSStmts[0] ?? {}, pISStmts[0] ?? {}, marketCapLocal, isEmergingMarket)
    // Beneish M-Score is based on YoY ratio changes — unreliable for high-inflation currencies
    // (e.g. ARS 117-211% annual inflation makes every ratio change look like manipulation).
    const beneish = (fxRate === 1 && pBSStmts.length >= 2 && pISStmts.length >= 2)
      ? calculateBeneish(pBSStmts[0], pBSStmts[1], pISStmts[0], pISStmts[1], pCFStmts[0] ?? {})
      : null
    const roicResult = calculateROIC(pBSStmts[0] ?? {}, pBSStmts[1] ?? {}, pISStmts[0] ?? {}, waccResult.inputs.taxRate, waccResult.wacc, fxRate)

    // When FMP has no BS data, fall back to fundamentalsTimeSeries annual BS + Yahoo financialData for ROIC
    let finalRoic = roicResult
    if (!roicResult.dataAvailable && annualBSRows.length > 0) {
      const mapYBS = (r: any) => r ? ({
        totalAssets: r.totalAssets,
        totalCurrentAssets: r.currentAssets ?? r.totalCurrentAssets,
        totalCurrentLiabilities: r.currentLiabilities ?? r.totalCurrentLiabilities,
        cash: r.cashCashEquivalentsAndShortTermInvestments ?? r.cashAndCashEquivalents ?? r.cash,
        cashAndShortTermInvestments: r.cashCashEquivalentsAndShortTermInvestments,
        accountsPayable: r.payables ?? r.accountsPayable,
      }) : {}
      const yBS0 = mapYBS(annualBSRows[annualBSRows.length - 1])
      const yBS1 = mapYBS(annualBSRows.length >= 2 ? annualBSRows[annualBSRows.length - 2] : null)
      const yIS = { ebit: (fin.financialData?.ebit ?? fin.financialData?.ebitda ?? null) as number | null }
      const fallback = calculateROIC(yBS0, yBS1, yIS, waccResult.inputs.taxRate, waccResult.wacc, 1)
      if (fallback.dataAvailable) finalRoic = fallback
    }

    const scores = { piotroski, altman, beneish, roic: finalRoic }

    // ─── Ownership & Short Interest ───────────────────────────────────────────

    const holders = fin.majorHoldersBreakdown ?? {}
    const ownership = {
      insiderPct: (holders.insidersPercentHeld ?? null) as number | null,
      institutionalPct: (holders.institutionsPercentHeld ?? null) as number | null,
      shortPct: (ks.shortPercentOfFloat ?? null) as number | null,
      shortRatio: (ks.shortRatio ?? null) as number | null,
      sharesShort: (ks.sharesShort ?? null) as number | null,
    }

    // ─── Multi-model valuation ─────────────────────────────────────────────────

    // Dividend data (from summaryDetail)
    const dividendPerShare = ((sd.dividendRate ?? sd.trailingAnnualDividendRate ?? 0) as number)
    const dividendYield = (sd.dividendYield ?? null) as number | null
    const payoutRatio = ((sd.payoutRatio ?? 0) as number)

    // Current multiples (from existing modules)
    const trailingPE = (q.trailingPE ?? null) as number | null
    const priceToBook = (ks.priceToBook ?? null) as number | null
    const priceToSales = (ks.priceToSalesTrailing12Months ?? null) as number | null
    // financialData module often misses these; quote module is a reliable second source
    let evToEbitda = (fd.enterpriseToEbitda ?? (q.enterpriseToEbitda ?? null)) as number | null
    let evToRevenue = (fd.enterpriseToRevenue ?? (q.enterpriseToRevenue ?? null)) as number | null

    // Compute EV/EBITDA from FMP statements when Yahoo doesn't provide it
    if (evToEbitda === null && fmp.incomeStatements[0] != null) {
      const stmt = fmp.incomeStatements[0]
      // Try explicit ebitda field first
      let fmpEbitda = stmt.ebitda != null && stmt.ebitda > 0 ? stmt.ebitda : null
      // Fallback: operatingIncome + D&A (standard EBITDA proxy)
      if (fmpEbitda == null && stmt.operatingIncome != null && stmt.operatingIncome > 0) {
        const da = stmt.depreciationAndAmortization ?? 0
        fmpEbitda = stmt.operatingIncome + Math.abs(da as number)
      }
      if (fmpEbitda != null && fmpEbitda > 0) {
        const evM = marketCapM + debtM - cashM
        const ebitdaM = fmpEbitda / 1e6
        if (ebitdaM > 0) evToEbitda = Math.round((evM / ebitdaM) * 100) / 100
      }
    }

    // Compute EV/Revenue when Yahoo doesn't provide it
    if (evToRevenue === null && rawRevMLocal > 0) {
      const evM = marketCapM + debtM - cashM
      const revM = rawRevMLocal * fxRate
      if (revM > 0) evToRevenue = Math.round((evM / revM) * 100) / 100
    }

    // Net income for FCFE — use normalizedNetIncomeM (2-year avg from income stmt).
    // fd.netIncomeToCommon from financialData is null for many banks (Yahoo doesn't always
    // populate it) and can be 0, causing FCFE to incorrectly report "net income is negative".
    // The income statement history is a more reliable source.
    const netIncomeM = normalizedNetIncomeM > 0
      ? normalizedNetIncomeM
      : Math.max(((fd.netIncomeToCommon ?? 0) as number) / 1e6 * fxRate, 0)

    // Company type detection
    const companyType = detectCompanyType({
      sector: profile.sector ?? q.sector ?? '',
      industry: profile.industry ?? '',
      dividendYield,
      payoutRatio,
      historicalCagr3y: cagrAnalysis.historicalCagr3y,
      analystEstimate1y: cagrAnalysis.analystEstimate1y,
      isNegativeFCF,
      revenueM: rawRevMLocal * fxRate,
      quoteType: (q.quoteType as string | undefined) ?? undefined,
    })

    const hasDividend = dividendPerShare > 0

    // Veto gate — detect inputs that cannot support a reliable DCF
    const yahooRevYears   = historicalRevenues.filter((r) => r > 0).length
    const fmpRevYears     = (fmp.incomeStatements as { revenue?: number }[])
      .filter(s => (s.revenue ?? 0) > 0).length
    // fundamentalsTimeSeries is the same source the Financials tab uses — includes S-1 data for recent IPOs
    const tsRevYears      = annualISRows
      .filter(r => (r.totalRevenue ?? r.operatingRevenue ?? 0) > 0).length
    const nonZeroRevYears = Math.max(yahooRevYears, fmpRevYears, tsRevYears)

    const vetoReasons: string[] = []
    if (companyType === 'etf') {
      vetoReasons.push('ETF/fund — DCF does not apply. Valuation is based on NAV and tracking error, not free cash flow.')
    } else {
      if (nonZeroRevYears < 2) {
        vetoReasons.push('Insufficient revenue history — need at least 2 years of data for a reliable DCF.')
      }
      if ((baseFCF === null || baseFCF === 0) && nonZeroRevYears === 0) {
        vetoReasons.push('No revenue or FCF data found — unable to project cash flows.')
      }
    }
    const canComputeDCF  = vetoReasons.length === 0
    const limitedHistory = canComputeDCF && nonZeroRevYears < 3
    const historyYears   = nonZeroRevYears

    // UFCF + Exit Multiple variant — complement to the Gordon Growth result from calculateFairValue.
    // Uses the same projected cash flows but swaps in an FCF exit multiple terminal value.
    // Exit multiples are calibrated per company type — fintech/growth fintechs trade at 25×
    // (not 12× traditional bank), REITs at 20× (P/FFO basis), utilities at 16× (regulated income).
    const _exitMultByType: Record<string, number> = {
      growth:    25,
      startup:   20,
      financial: 12,   // traditional banks / insurers
      fintech:   25,   // high-growth digital finance (NU, StoneCo, PAGS) — same as growth
      dividend:  15,
      reit:      20,   // P/FFO basis; REITs use FFO, not net income, for exit multiple
      utility:   16,   // regulated income stream; lower multiple than growth
      energy:     7,   // commodity-cycle; EV/EBITDA-like exit
      mining:     6,   // capital-intensive; conservative exit
      alt_asset: 20,   // Blackstone/KKR: fee-related earnings multiple
      mreeit:    10,   // mortgage REITs: book value / spread business
      bdc:       12,   // BDCs: net investment income multiple
    }
    const _exitMult = _exitMultByType[companyType] ?? 18
    const _lastCF = dcfResult.projections.length > 0 ? dcfResult.projections[dcfResult.projections.length - 1].cashFlow : null
    const _nYrs = dcfResult.projections.length
    const _exitTVDisc = _lastCF != null && _nYrs > 0
      ? (_lastCF * _exitMult) / Math.pow(1 + waccResult.wacc, _nYrs)
      : null
    const ufcfEM_FV = _exitTVDisc != null && sharesM > 0
      ? (dcfResult.sumPV + _exitTVDisc + cashM - debtM) / sharesM
      : null

    // DDM
    const roe = resolvedRoe
    const ddmResult = calculateDDM(dividendPerShare, waccResult.costOfEquity, roe, payoutRatio, currentPrice)

    // FCFE
    const fcfeResult = calculateFCFE(netIncomeM, cagr, waccResult.costOfEquity, terminalG, cashM, debtM, sharesM, currentPrice)

    // Relative multiples — with live peer comparison
    const industry = (profile.industry ?? '') as string
    const candidatePeers = (PEER_TICKERS[industry] ?? []).filter(
      (t) => t !== ticker
    ).slice(0, 6)

    let livePeers: Awaited<ReturnType<typeof getPeerQuotes>> = []
    if (candidatePeers.length >= 3) {
      // Non-blocking: peer fetch failure falls back to static medians
      livePeers = await getPeerQuotes(candidatePeers).catch(() => [])
    }

    const multiplesResult = calculateMultiples({
      sector: (profile.sector ?? q.sector ?? '') as string,
      industry,
      companyType,
      currentPrice,
      trailingPE,
      priceToBook,
      priceToSales,
      evToEbitda,
      evToRevenue,
      livePeers,
    })

    // Triangulation
    const weights = getModelWeights(companyType, hasDividend)
    const modelValues: { weight: number; value: number }[] = []

    // DCF component: blend UFCF+PGM and UFCF+EM (50/50) so the Core DCF Result uses both
    // terminal value methods rather than just the Gordon Growth result. This mirrors the
    // four-model Damodaran blend computed live in ModellingWorkspace.
    const ufcfBlendParts = [
      fvResult.fairValuePerShare != null ? fvResult.fairValuePerShare : null,
      ufcfEM_FV,
    ].filter((v): v is number => v != null)
    const ufcfBlendedFV = ufcfBlendParts.length > 0
      ? ufcfBlendParts.reduce((s, v) => s + v, 0) / ufcfBlendParts.length
      : null

    if (ufcfBlendedFV != null) {
      modelValues.push({ weight: weights.fcff, value: ufcfBlendedFV })
    }

    if (fcfeResult.applicable) {
      modelValues.push({ weight: weights.fcfe, value: fcfeResult.fairValuePerShare })
    }
    if (ddmResult.applicable) {
      modelValues.push({ weight: weights.ddm, value: ddmResult.fairValuePerShare })
    }
    if (multiplesResult.blendedFairValue !== null) {
      modelValues.push({ weight: weights.multiples, value: multiplesResult.blendedFairValue })
    }

    // Normalize weights to what's actually applicable
    const totalWeight = modelValues.reduce((s, m) => s + m.weight, 0)
    const triangulatedFairValue = totalWeight > 0
      ? Math.round(modelValues.reduce((s, m) => s + (m.value * m.weight) / totalWeight, 0) * 100) / 100
      : (ufcfBlendedFV ?? fvResult.fairValuePerShare ?? 0)
    const triangulatedUpsidePct = currentPrice > 0 && triangulatedFairValue > 0
      ? Math.round((triangulatedFairValue - currentPrice) / currentPrice * 1000) / 1000
      : 0

    // Scenarios anchored to the Damodaran 4-model DCF blend (mirrors the Full DCF Modelling Table).
    // BASE = weighted blend of UFCF+PGM, UFCF+EM, LFCF+PGM, LFCF+EM using company-type weights.
    // BULL/BEAR = same blend re-run with stressed WACC / CAGR / terminalG assumptions.

    // Compute LFCF-EM variant (levered DCF with exit multiple terminal value).
    // LFCF-PGM is already available via fcfeResult (net income × 0.90 discounted at Ke).
    const _cappedNetIncomeForLFCF = (() => {
      const baseNI = netIncomeM * 0.90
      if (baseNI <= 0) return null
      const impliedEq = currentPrice > 0 && sharesM > 0 ? currentPrice * sharesM : null
      if (impliedEq && baseNI / impliedEq > 0.20) return impliedEq * 0.15
      return baseNI
    })()
    const _lfcfDcfResult = _cappedNetIncomeForLFCF != null
      ? projectCashFlows({ baseFCF: _cappedNetIncomeForLFCF, cagr, wacc: waccResult.costOfEquity, terminalG, growthModel })
      : null
    const _lfcfEM_FV = (() => {
      if (_lfcfDcfResult == null || sharesM <= 0) return null
      const lastCF = _lfcfDcfResult.projections[_lfcfDcfResult.projections.length - 1]?.cashFlow ?? null
      if (lastCF == null) return null
      const exitTV = (lastCF * _exitMult) / Math.pow(1 + waccResult.costOfEquity, _lfcfDcfResult.projections.length)
      const rawFV = (_lfcfDcfResult.sumPV + exitTV) / sharesM
      return Math.min(rawFV, currentPrice > 0 ? currentPrice * 5 : rawFV)
    })()

    // Build 4-model blend using Damodaran weights for this company type
    const _dcmW = FOUR_MODEL_DCF_WEIGHTS[companyType] ?? FOUR_MODEL_DCF_WEIGHTS.standard
    const _lfcfPGM_FV = fcfeResult.applicable ? fcfeResult.fairValuePerShare : null
    const _fourModelParts: { w: number; v: number }[] = [
      fvResult.fairValuePerShare != null ? { w: _dcmW.ufcfPGM, v: fvResult.fairValuePerShare } : null,
      ufcfEM_FV != null                  ? { w: _dcmW.ufcfEM,  v: ufcfEM_FV }                  : null,
      _lfcfPGM_FV != null                ? { w: _dcmW.lfcfPGM, v: _lfcfPGM_FV }                : null,
      _lfcfEM_FV != null                 ? { w: _dcmW.lfcfEM,  v: _lfcfEM_FV }                  : null,
    ].filter((x): x is { w: number; v: number } => x != null)

    const _fourModelTotalW = _fourModelParts.reduce((s, p) => s + p.w, 0)
    const modellingTableFV = _fourModelTotalW > 0
      ? Math.round(_fourModelParts.reduce((s, p) => s + p.v * p.w / _fourModelTotalW, 0) * 100) / 100
      : (ufcfBlendedFV ?? fvResult.fairValuePerShare ?? triangulatedFairValue)

    // Stressed 4-model blend for bull/bear scenarios
    const _buildStressedFV4Model = (waccAdj: number, cagrAdj: number, tgAdj: number) => {
      const sw = Math.max(waccResult.wacc + waccAdj, 0.04)
      const sc = Math.max(cagr + cagrAdj, -0.05)
      const sg = Math.min(Math.max(terminalG + tgAdj, 0), sw - 0.005)
      const ske = Math.max(waccResult.costOfEquity + waccAdj, 0.04)

      // UFCF-PGM
      const sDcf = projectCashFlows({ baseFCF, cagr: sc, wacc: sw, terminalG: sg, growthModel })
      const sUfcfPGM = calculateFairValue(sDcf, cashM, debtM, sharesM, currentPrice)

      // UFCF-EM
      const sLastCF = sDcf.projections[sDcf.projections.length - 1]?.cashFlow ?? null
      const sExitTV = sLastCF != null ? (sLastCF * _exitMult) / Math.pow(1 + sw, sDcf.projections.length) : null
      const sUfcfEM = sExitTV != null && sharesM > 0 ? (sDcf.sumPV + sExitTV + cashM - debtM) / sharesM : null

      // LFCF-PGM (FCFE)
      const sLfcfDcf = fcfeResult.applicable
        ? calculateFCFE(netIncomeM, sc, ske, sg, cashM, debtM, sharesM, currentPrice)
        : fcfeResult
      const sLfcfPGM = sLfcfDcf.applicable ? sLfcfDcf.fairValuePerShare : null

      // LFCF-EM
      const sLfcfBaseDcf = _cappedNetIncomeForLFCF != null
        ? projectCashFlows({ baseFCF: _cappedNetIncomeForLFCF, cagr: sc, wacc: ske, terminalG: sg, growthModel })
        : null
      const sLfcfLastCF = sLfcfBaseDcf?.projections[sLfcfBaseDcf.projections.length - 1]?.cashFlow ?? null
      const sLfcfExitTV = sLfcfLastCF != null && sLfcfBaseDcf != null
        ? (sLfcfLastCF * _exitMult) / Math.pow(1 + ske, sLfcfBaseDcf.projections.length)
        : null
      const sLfcfEM = sLfcfExitTV != null && sLfcfBaseDcf != null && sharesM > 0
        ? Math.min((sLfcfBaseDcf.sumPV + sLfcfExitTV) / sharesM, currentPrice > 0 ? currentPrice * 5 : Infinity)
        : null

      const sParts: { w: number; v: number }[] = [
        sUfcfPGM.fairValuePerShare != null ? { w: _dcmW.ufcfPGM, v: sUfcfPGM.fairValuePerShare } : null,
        sUfcfEM != null                    ? { w: _dcmW.ufcfEM,  v: sUfcfEM }                    : null,
        sLfcfPGM != null                   ? { w: _dcmW.lfcfPGM, v: sLfcfPGM }                   : null,
        sLfcfEM != null                    ? { w: _dcmW.lfcfEM,  v: sLfcfEM }                    : null,
      ].filter((x): x is { w: number; v: number } => x != null)

      const sTotalW = sParts.reduce((s, p) => s + p.w, 0)
      const sFV = sTotalW > 0
        ? Math.round(sParts.reduce((s, p) => s + p.v * p.w / sTotalW, 0) * 100) / 100
        : null
      return { fairValue: sFV, wacc: sw, cagr: sc, terminalG: sg }
    }

    const scenarios = {
      base: { fairValue: modellingTableFV, wacc: waccResult.wacc, cagr, terminalG },
      bull: _buildStressedFV4Model(-0.01, +0.02, +0.005),
      bear: _buildStressedFV4Model(+0.01, -0.02, -0.005),
      modelMethodology: {
        companyType,
        companyTypeLabel: companyTypeLabel(companyType),
        rationale: getDCFModelRationale(companyType),
        weights: _dcmW,
      },
    }

    const effectiveWeights = {
      fcff: totalWeight > 0 ? Math.round(weights.fcff / totalWeight * 100) : 100,
      fcfe: fcfeResult.applicable && totalWeight > 0 ? Math.round(weights.fcfe / totalWeight * 100) : 0,
      ddm: ddmResult.applicable && totalWeight > 0 ? Math.round(weights.ddm / totalWeight * 100) : 0,
      multiples: multiplesResult.blendedFairValue !== null && totalWeight > 0
        ? Math.round(weights.multiples / totalWeight * 100) : 0,
    }

    const valuationMethods: Record<string, unknown> & {
      triangulatedFairValue: number
      triangulatedUpsidePct: number
      cockpitFairValue?: number | null
      cockpitUpsidePct?: number | null
    } = {
      companyType,
      companyTypeLabel: companyTypeLabel(companyType),
      primaryModelLabel: primaryModelLabel(companyType, hasDividend),
      intrinsico: companyTypeIntrinsico(companyType),
      triangulatedFairValue,
      triangulatedUpsidePct,
      effectiveWeights,
      models: {
        fcff: {
          fairValue: fvResult.fairValuePerShare,
          upsidePct: fvResult.upsidePct,
          applicable: true,
          reason: 'FCFF DCF: Free Cash Flow to Firm discounted at WACC',
        },
        fcfe: fcfeResult,
        ddm: ddmResult,
        multiples: multiplesResult,
      },
    }

    // ─── Financial Statements (FMP — higher quality than Yahoo) ──────────────────

    const hasFmp = fmp.incomeStatements.length > 0

    // ── Enrichments from FMP (override Yahoo where available) ────────────────
    // ROIC from FMP key metrics (more accurate than our manual calculation)
    const fmpRoic = fmp.keyMetrics[0]?.returnOnInvestedCapital ?? null
    const fmpRoicSpread = fmpRoic != null ? fmpRoic - waccResult.wacc : null

    // Gross margin from FMP ratios (cleaner than Yahoo's grossMargins field)
    const fmpGrossMargin = fmp.ratios[0]?.grossProfitMargin ?? null
    const fmpNetMargin   = fmp.ratios[0]?.netProfitMargin ?? null

    // Override businessProfile with FMP margins when available
    if (fmpGrossMargin != null) businessProfile.grossMargin = fmpGrossMargin
    if (fmpNetMargin   != null) businessProfile.netMargin   = fmpNetMargin

    // Enrich businessProfile with multiples so components can display them without
    // digging into the nested valuationMethods structure
    ;(businessProfile as Record<string, unknown>).evToEbitda   = evToEbitda
    ;(businessProfile as Record<string, unknown>).evToRevenue  = evToRevenue
    ;(businessProfile as Record<string, unknown>).priceToBook  = priceToBook
    ;(businessProfile as Record<string, unknown>).priceToSales = priceToSales
    ;(businessProfile as Record<string, unknown>).roe          = resolvedRoe

    // FCF margin from FMP cash flows — capped at same ceiling as baseFCF to prevent
    // loan-distorted OCF (e.g. MELI Mercado Crédito) from inflating the reverse DCF model.
    const fmpLatestCF = fmp.cashFlowStatements[0]
    const fmpLatestIS = fmp.incomeStatements[0]
    if (fmpLatestCF && fmpLatestIS && fmpLatestIS.revenue > 0) {
      const fmpFcfM = fmpLatestCF.freeCashFlow / 1e6
      const fmpRevM = fmpLatestIS.revenue / 1e6
      const rawFmpMargin = fmpFcfM / fmpRevM
      // Don't override a negative Yahoo TTM margin with a positive FMP historical margin.
      // Yahoo's negative TTM is a real signal (e.g. MELI Mercado Crédito loan-book growth),
      // and FMP's prior-year positive value would produce a spuriously negative implied CAGR.
      const yahooMarginNegative = businessProfile.fcfMargin !== null && businessProfile.fcfMargin < 0
      if (rawFmpMargin > 0 && !yahooMarginNegative) {
        businessProfile.fcfMargin = Math.min(rawFmpMargin, fcfMarginCeiling)
      }
    }

    // Override roicResult with FMP data when available
    if (fmpRoic != null) {
      scores.roic = {
        ...scores.roic,
        roic: fmpRoic,
        spread: fmpRoicSpread ?? scores.roic?.spread ?? 0,
        dataAvailable: true,
      }
    }

    // Compute projections based on FMP historical data or Yahoo fallback
    const useFmpForProjections = hasFmp && fmp.incomeStatements.length >= 2

    // Sort FMP data oldest-first for charting
    const fmpIsSorted = [...fmp.incomeStatements].sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear))
    const fmpCfSorted = [...fmp.cashFlowStatements].sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear))
    const fmpBsSorted = [...fmp.balanceSheets].sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear))

    // --- Compute projection averages from FMP or Yahoo fallback ---
    let avgGrossMarginRatio: number
    let avgOpMarginRatio: number
    let avgEbitdaMarginRatio: number
    let avgNetMarginRatio: number
    let latestRevM: number
    let baseYear: number

    if (useFmpForProjections) {
      // Recency-weighted margins: last 2 FMP annual years (20%/40%) + TTM from Yahoo financialData (40%).
      // This anchors projections to current operating reality rather than the full 4-5 year avg,
      // which can compress margins below TTM when earlier years had lower margins.
      const fdRevTtm  = typeof fd.totalRevenue === 'number' && fd.totalRevenue > 0 ? fd.totalRevenue : null
      const fdOpTtm   = typeof fd.ebit         === 'number' ? fd.ebit          : null
      const fdGpTtm   = typeof fd.grossProfits === 'number' ? fd.grossProfits  : null
      const fdNiTtm   = typeof fd.netIncomeToCommon === 'number' ? fd.netIncomeToCommon
                        : (typeof fd.netIncome === 'number' ? fd.netIncome : null)
      const fdEbTtm   = typeof fd.ebitda === 'number' ? fd.ebitda : null

      const blendMargin = (
        fmpFn: (r: typeof fmpIsSorted[0]) => number | null,
        ttmVal: number | null,
        fallbackFull = true,
      ): number => {
        const recent2 = fmpIsSorted.slice(-2)
        const m0 = recent2[0] && recent2[0].revenue > 0 ? fmpFn(recent2[0]) : null
        const m1 = recent2[1] && recent2[1].revenue > 0 ? fmpFn(recent2[1]) : null
        const ttmM = fdRevTtm != null && ttmVal != null ? ttmVal / fdRevTtm : null

        if (ttmM != null && m1 != null && m0 != null) return m0 * 0.20 + m1 * 0.40 + ttmM * 0.40
        if (ttmM != null && (m1 ?? m0) != null)       return (m1 ?? m0)! * 0.60 + ttmM * 0.40
        if (ttmM != null)                             return ttmM
        if (!fallbackFull) return 0
        // No TTM available: fall back to full historical average
        return fmpIsSorted.reduce((s, r) => s + (r.revenue > 0 ? (fmpFn(r) ?? 0) : 0), 0) / fmpIsSorted.length
      }

      avgGrossMarginRatio  = blendMargin(r => r.revenue > 0 ? r.grossProfit  / r.revenue : null, fdGpTtm)
      avgOpMarginRatio     = blendMargin(r => r.revenue > 0 ? r.operatingIncome / r.revenue : null, fdOpTtm)
      avgEbitdaMarginRatio = blendMargin(r => r.revenue > 0 ? r.ebitda        / r.revenue : null, fdEbTtm)
      avgNetMarginRatio    = blendMargin(r => r.revenue > 0 ? r.netIncome     / r.revenue : null, fdNiTtm)
      latestRevM = fmpIsSorted[fmpIsSorted.length - 1].revenue / 1e6 * fxRate
      baseYear   = parseInt(fmpIsSorted[fmpIsSorted.length - 1].fiscalYear)
    } else {
      // Yahoo fallback: prefer fundamentalsTimeSeries (annualISRows) over legacy incomeStatementHistory.
      // Legacy API returns ebit=0/operatingIncome=null for many tickers (e.g. NOW/ServiceNow).
      const rawISHistory: any[] = fin.incomeStatementHistory?.incomeStatementHistory ?? []
      // Use annualISRows (fundamentalsTimeSeries 'financials' module) when available — richer fields.
      const ftsRows = (annualISRows as any[]).filter((s: any) => s.totalRevenue ?? s.operatingRevenue)
      const isHistorical = ftsRows.length >= 2
        ? ftsRows.slice(-4)
        : rawISHistory.slice(-4).reverse()
      const isFts = ftsRows.length >= 2

      const _getField = (s: any, ftsKey: string, legacyKey: string) =>
        isFts ? (s[ftsKey] ?? null) : (s[legacyKey] ?? null)

      avgGrossMarginRatio = isHistorical.length > 0 ? isHistorical.reduce((acc: number, s: any) => {
        const rev = (isFts ? (s.totalRevenue ?? s.operatingRevenue ?? 0) : (s.totalRevenue ?? s.operatingRevenue ?? 0)) as number
        const gp = (isFts ? (s.grossProfit ?? 0) : (s.grossProfit ?? 0)) as number
        return acc + (rev > 0 ? gp / rev : 0)
      }, 0) / isHistorical.length : 0.4

      avgOpMarginRatio = isHistorical.length > 0 ? isHistorical.reduce((acc: number, s: any) => {
        const rev = (s.totalRevenue ?? s.operatingRevenue ?? 0) as number
        const op = (isFts ? (s.operatingIncome ?? s.EBIT ?? 0) : (s.ebit ?? s.operatingIncome ?? 0)) as number
        return acc + (rev > 0 ? op / rev : 0)
      }, 0) / isHistorical.length : 0.15

      avgEbitdaMarginRatio = isHistorical.length > 0 ? isHistorical.reduce((acc: number, s: any) => {
        const rev = (s.totalRevenue ?? s.operatingRevenue ?? 0) as number
        const eb = (isFts ? (s.EBITDA ?? s.normalizedEBITDA ?? 0) : (s.ebitda ?? 0)) as number
        return acc + (rev > 0 ? eb / rev : 0)
      }, 0) / isHistorical.length : 0.2

      avgNetMarginRatio = isHistorical.length > 0 ? isHistorical.reduce((acc: number, s: any) => {
        const rev = (s.totalRevenue ?? s.operatingRevenue ?? 0) as number
        const ni = (s.netIncome ?? 0) as number
        return acc + (rev > 0 ? ni / rev : 0)
      }, 0) / isHistorical.length : 0.1

      const lastRow = isHistorical[isHistorical.length - 1]
      const lastRevRaw = (lastRow?.totalRevenue ?? lastRow?.operatingRevenue ?? 0) as number
      latestRevM = lastRevRaw > 0 ? lastRevRaw / 1e6 * fxRate : (historicalRevenues[0] ?? 0)
      const lastDateField = isFts ? (lastRow?.date ?? null) : (lastRow?.endDate ?? null)
      baseYear = lastDateField
        ? new Date(lastDateField instanceof Date ? lastDateField : String(lastDateField)).getFullYear()
        : new Date().getFullYear()
    }

    // --- Income Statement ---
    const isHistoricalRows = hasFmp
      ? fmpIsSorted.map(s => {
          // Primary: direct FMP tax fields
          let taxRawFmp = (s.incomeTaxExpense != null && s.incomeBeforeIncomeTaxExpense != null && s.incomeBeforeIncomeTaxExpense > 0)
            ? Math.abs(s.incomeTaxExpense) / s.incomeBeforeIncomeTaxExpense
            : null
          // Fallback: derive effective tax rate from (EBIT - NI) / EBIT when direct fields absent.
          // This approximation captures the combined effect of taxes + minority interest + other below-EBIT items.
          // Less accurate but far better than the 21% hardcoded fallback for non-US companies.
          if (taxRawFmp == null && s.operatingIncome != null && s.operatingIncome > 0 && s.netIncome != null) {
            const impliedTax = (s.operatingIncome - s.netIncome) / s.operatingIncome
            if (impliedTax > 0.05 && impliedTax < 0.75) taxRawFmp = impliedTax
          }
          return {
            year: s.fiscalYear,
            revenue: s.revenue > 0 ? s.revenue / 1e6 * fxRate : null,
            grossProfit: s.grossProfit != null ? s.grossProfit / 1e6 * fxRate : null,
            operatingIncome: s.operatingIncome != null ? s.operatingIncome / 1e6 * fxRate : null,
            ebitda: s.ebitda != null ? s.ebitda / 1e6 * fxRate : null,
            netIncome: s.netIncome != null ? s.netIncome / 1e6 * fxRate : null,
            eps: s.epsDiluted ?? null,
            operatingMargin: s.revenue > 0 && s.operatingIncome != null ? s.operatingIncome / s.revenue : null,
            taxRate: taxRawFmp != null ? Math.max(0.05, Math.min(0.55, taxRawFmp)) : null,
            fiscalDate: s.date ?? s.fiscalYear,
            isProjected: false,
          }
        })
      : (() => {
          // Prefer fundamentalsTimeSeries IS rows (annualISRows, 'financials' module) over the
          // legacy incomeStatementHistory — the legacy API returns ebit=0/operatingIncome=null
          // for many tickers (e.g. NOW/ServiceNow) while fundamentalsTimeSeries has the full data.
          const nonzero = (v: number | null | undefined) => (v != null && v !== 0) ? v : null

          if ((annualISRows as any[]).length >= 2) {
            return (annualISRows as any[])
              .filter((s: any) => s.totalRevenue ?? s.operatingRevenue)
              .map((s: any) => {
                const d = s.date instanceof Date ? s.date : new Date(String(s.date))
                const yr = String(d.getFullYear())
                const revRaw = nonzero(s.totalRevenue ?? s.operatingRevenue)
                const ebitRaw = nonzero(s.operatingIncome ?? s.EBIT)
                const ebitdaRaw = nonzero(s.EBITDA ?? s.normalizedEBITDA)
                const taxRaw = typeof s.taxRateForCalcs === 'number' && isFinite(s.taxRateForCalcs) ? s.taxRateForCalcs : null
                const taxFromIS = (s.taxProvision != null && s.pretaxIncome != null && s.pretaxIncome !== 0)
                  ? Math.abs(s.taxProvision as number) / Math.abs(s.pretaxIncome as number) : null
                const eps = typeof s.dilutedEPS === 'number' ? s.dilutedEPS : null
                return {
                  year: yr,
                  revenue: revRaw != null ? revRaw / 1e6 * fxRate : null,
                  grossProfit: nonzero(s.grossProfit) != null ? (s.grossProfit as number) / 1e6 * fxRate : null,
                  operatingIncome: ebitRaw != null ? ebitRaw / 1e6 * fxRate : null,
                  ebitda: ebitdaRaw != null ? ebitdaRaw / 1e6 * fxRate : null,
                  netIncome: s.netIncome != null ? (s.netIncome as number) / 1e6 * fxRate : null,
                  eps,
                  operatingMargin: (revRaw && ebitRaw) ? ebitRaw / revRaw : null,
                  taxRate: (taxRaw ?? taxFromIS) != null ? Math.max(0.05, Math.min(0.55, (taxRaw ?? taxFromIS)!)) : null,
                  fiscalDate: isNaN(d.getTime()) ? yr : d.toISOString().split('T')[0],
                  isProjected: false,
                }
              })
          }

          // Legacy fallback: incomeStatementHistory (Yahoo old-style API)
          const rawISHistory: any[] = fin.incomeStatementHistory?.incomeStatementHistory ?? []
          const isHistorical = rawISHistory.slice(-4).reverse()
          const rawCFForEbitda: any[] = fin.cashflowStatementHistory?.cashflowStatements ?? []
          const depreciationByYear: Record<string, number> = {}
          for (const cf of rawCFForEbitda) {
            const yr = String(new Date(cf.endDate).getFullYear())
            const da = ((cf.depreciation ?? cf.depreciationAndAmortization ?? 0) as number) / 1e6 * fxRate
            if (da > 0) depreciationByYear[yr] = da
          }
          return isHistorical.map((s: any) => {
            const yr = String(new Date(s.endDate).getFullYear())
            const revRaw = nonzero(s.totalRevenue ?? s.operatingRevenue)
            const gpDirect = nonzero(s.grossProfit)
            const gpComputed = (revRaw != null && (s.costOfRevenue ?? s.costOfGoodsSold) != null) ? revRaw - (s.costOfRevenue ?? s.costOfGoodsSold ?? 0) : null
            const gpRaw = gpDirect ?? nonzero(gpComputed)
            const ebitRaw = nonzero(s.ebit ?? s.operatingIncome)
            const ebitdaRaw = nonzero(s.ebitda) ?? nonzero(s.normalizedEbitda) ?? (ebitRaw != null && depreciationByYear[yr] ? ebitRaw + depreciationByYear[yr] * 1e6 : null)
            const taxRawYahoo = (s.incomeTaxExpense != null && s.incomeBeforeTax != null && (s.incomeBeforeTax as number) !== 0)
              ? (s.incomeTaxExpense as number) / (s.incomeBeforeTax as number)
              : null
            return {
              year: yr,
              revenue: revRaw != null ? revRaw / 1e6 * fxRate : null,
              grossProfit: gpRaw != null ? gpRaw / 1e6 * fxRate : null,
              operatingIncome: ebitRaw != null ? ebitRaw / 1e6 * fxRate : null,
              ebitda: ebitdaRaw != null ? ebitdaRaw / 1e6 * fxRate : null,
              netIncome: s.netIncome != null ? (s.netIncome as number) / 1e6 * fxRate : null,
              // Yahoo incomeStatementHistory omits dilutedEps — derive from netIncome / shares when missing
              eps: (() => {
                if (s.dilutedEps != null) return (s.dilutedEps as number)
                const ni = s.netIncome as number | null
                const sh = (fin.defaultKeyStatistics?.sharesOutstanding as number | undefined) ?? 0
                if (ni != null && ni !== 0 && sh > 0) return ni / sh  // raw dollars: ni is in full $, sh is full shares
                return null
              })(),
              operatingMargin: null as number | null,
              taxRate: taxRawYahoo != null ? Math.max(0.05, Math.min(0.40, taxRawYahoo)) : null,
              fiscalDate: s.endDate ? new Date(s.endDate).toISOString().split('T')[0] : null,
              isProjected: false,
            }
          })
        })()

    // Sanitize grossProfit rows where the data source emitted grossProfit ≈ revenue (100% GM).
    // This occurs when FMP's grossProfit field maps to totalRevenue for certain SaaS tickers
    // (e.g. ServiceNow), or when Yahoo's grossProfit field is absent and falls back to revenue.
    // Guard: if every non-null grossProfit row is within 3% of revenue, the field is corrupt.
    // Fix: replace with businessProfile.grossMargin (sourced from Yahoo financialData.grossMargins
    // and FMP ratios — the most reliable single-number gross margin available).
    const grossProfitRows = isHistoricalRows.filter(r => r.grossProfit != null && r.revenue != null && r.revenue > 0)
    const allGPLooksLikeRevenue = grossProfitRows.length > 0 &&
      grossProfitRows.every(r => r.grossProfit! / r.revenue! > 0.97)
    const bpGrossMargin: number | null = (businessProfile.grossMargin != null && businessProfile.grossMargin > 0 && businessProfile.grossMargin < 0.97)
      ? (businessProfile.grossMargin as number)
      : null
    if (allGPLooksLikeRevenue && bpGrossMargin != null) {
      for (const r of isHistoricalRows) {
        if (r.revenue != null) r.grossProfit = Math.round(r.revenue * bpGrossMargin)
      }
      // Also fix avgGrossMarginRatio used for projected rows
      avgGrossMarginRatio = bpGrossMargin
    }

    // Last actual effective tax rate and fiscal month/day for projected IS rows
    const lastActualTaxRate = [...isHistoricalRows].reverse().find(r => r.taxRate != null)?.taxRate ?? waccInputs.taxRate
    const lastIsFiscalDate = isHistoricalRows[isHistoricalRows.length - 1]?.fiscalDate ?? null
    const isFiscalMonthDay = (lastIsFiscalDate && lastIsFiscalDate.length >= 10) ? lastIsFiscalDate.slice(5) : '12-31'

    const isProjectedRows = Array.from({ length: 5 }, (_, idx) => {
      const t = idx + 1
      const projRevM = latestRevM * Math.pow(1 + cagr, t)
      const projNetIncomeM = projRevM * avgNetMarginRatio
      return {
        year: `${baseYear + t}E`,
        revenue: Math.round(projRevM),
        grossProfit: avgGrossMarginRatio > 0 ? Math.round(projRevM * avgGrossMarginRatio) : null,
        operatingIncome: avgOpMarginRatio !== 0 ? Math.round(projRevM * avgOpMarginRatio) : null,
        ebitda: avgEbitdaMarginRatio > 0 ? Math.round(projRevM * avgEbitdaMarginRatio) : null,
        netIncome: Math.round(projNetIncomeM),
        eps: sharesM > 0 ? Math.round((projNetIncomeM / sharesM) * 100) / 100 : null,
        operatingMargin: avgOpMarginRatio !== 0 ? avgOpMarginRatio : null,
        taxRate: lastActualTaxRate,
        fiscalDate: `${baseYear + t}-${isFiscalMonthDay}`,
        isProjected: true,
      }
    })

    const incomeStatement = [...isHistoricalRows, ...isProjectedRows]

    // --- Cash Flow ---
    // ── CF units scale detection ──────────────────────────────────────────────
    // FMP and Yahoo fundamentalsTimeSeries store income statement values in full
    // local currency (e.g. 26T ARS for YPF) but may store cash flow values in
    // local-currency THOUSANDS for some non-USD reporters (confirmed: YPF/ARS).
    // After / 1e6 * fxRate, CF values end up 1000× too small.
    // Detection: if the latest CF capex magnitude is < 0.1% of the latest IS revenue
    // in their raw (pre-conversion) units, the CF rows are in thousands. Scale ×1000.
    let cfFmpScaleFactor = 1
    // Try FMP detection first
    if (hasFmp && fmpCfSorted.length > 0 && fmpIsSorted.length > 0) {
      const latestCFCapexRaw = Math.abs(fmpCfSorted[fmpCfSorted.length - 1].investmentsInPropertyPlantAndEquipment ?? 0)
      const latestISRevRaw   = fmpIsSorted[fmpIsSorted.length - 1].revenue ?? 0
      if (latestISRevRaw > 0 && latestCFCapexRaw > 0 && latestCFCapexRaw / latestISRevRaw < 0.001) {
        cfFmpScaleFactor = 1000
      }
    }
    // Fallback: detect via Yahoo annualCFRows vs Yahoo IS revenue (covers companies where FMP CF is absent)
    if (cfFmpScaleFactor === 1 && fxRate < 0.01 && (annualCFRows as any[]).length > 0) {
      // fxRate < 0.01 means very weak local currency vs USD (ARS, TRY, PKR, etc.)
      // These are the currencies where the thousands mismatch occurs
      const lastCFRow = (annualCFRows as any[]).slice(-1)[0]
      const rawCapexCF = Math.abs(lastCFRow?.capitalExpenditure ?? lastCFRow?.purchaseOfPPE ?? 0)
      const rawRevIS   = (fin.financialData?.totalRevenue ?? 0) as number
      if (rawRevIS > 0 && rawCapexCF > 0 && rawCapexCF / rawRevIS < 0.001) {
        cfFmpScaleFactor = 1000
      }
    }

    const avgCapexM: number = hasFmp && fmpCfSorted.length > 0
      ? (() => {
          const vals = fmpCfSorted.map(r => r.investmentsInPropertyPlantAndEquipment)
          const nonNull = vals.filter((v): v is number => v != null)
          return nonNull.length > 0 ? nonNull.reduce((s, v) => s + v * cfFmpScaleFactor / 1e6 * fxRate, 0) / nonNull.length : 0
        })()
      : (() => {
          // Prefer fundamentalsTimeSeries annualCFRows (most complete, post-Nov 2024)
          const cfFromFTS = (annualCFRows as any[]).slice(-4)
          if (cfFromFTS.length > 0) {
            const vals = cfFromFTS.map((s: any) => s.capitalExpenditure ?? s.purchaseOfPPE ?? null).filter((v: any) => v != null)
            if (vals.length > 0) return (vals as number[]).reduce((s, v) => s + v * cfFmpScaleFactor / 1e6 * fxRate, 0) / vals.length
          }
          // Fallback: deprecated Yahoo cashflowStatementHistory
          const rawCFHistory: any[] = fin.cashflowStatementHistory?.cashflowStatements ?? []
          const cfHistorical = rawCFHistory.slice(-4).reverse()
          return cfHistorical.length > 0 ? cfHistorical.reduce((s: number, s2: any) => s + ((s2.capitalExpenditures ?? s2.capitalExpenditure ?? s2.purchaseOfPlantPropertyEquipment ?? 0) as number) * cfFmpScaleFactor / 1e6 * fxRate, 0) / cfHistorical.length : 0
        })()

    const avgDivPaidM: number = hasFmp && fmpCfSorted.length > 0
      ? fmpCfSorted.reduce((s, r) => s + r.commonDividendsPaid * cfFmpScaleFactor / 1e6 * fxRate, 0) / fmpCfSorted.length  // stored negative in FMP
      : (() => {
          const rawCFHistory: any[] = fin.cashflowStatementHistory?.cashflowStatements ?? []
          const cfHistorical = rawCFHistory.slice(-4).reverse()
          return cfHistorical.length > 0 ? cfHistorical.reduce((s: number, s2: any) => s + ((s2.dividendsPaid ?? 0) as number) / 1e6 * fxRate, 0) / cfHistorical.length : 0
        })()

    const avgBuybackM: number = hasFmp && fmpCfSorted.length > 0
      ? fmpCfSorted.reduce((s, r) => s + Math.abs(r.commonStockRepurchased * cfFmpScaleFactor / 1e6 * fxRate), 0) / fmpCfSorted.length
      : (() => {
          const rawCFHistory: any[] = fin.cashflowStatementHistory?.cashflowStatements ?? []
          const cfHistorical = rawCFHistory.slice(-4).reverse()
          return cfHistorical.length > 0 ? cfHistorical.reduce((s: number, s2: any) => s + Math.abs((s2.repurchaseOfStock ?? s2.repurchaseOfCommonStock ?? 0) as number) / 1e6 * fxRate, 0) / cfHistorical.length : 0
        })()

    // Build Yahoo balance sheet lookup by year for totalAssets fallback when FMP lacks it
    const yahooBsByYear: Record<string, { totalAssets: number | null; cash: number | null }> = {}
    for (const s of (fin.balanceSheetHistory?.balanceSheetStatements ?? []) as any[]) {
      const yr = String(new Date(s.endDate).getFullYear())
      const rawAssets = s.totalAssets ?? null
      const rawCash   = s.cash ?? s.cashAndCashEquivalents ?? s.cashAndShortTermInvestments ?? null
      yahooBsByYear[yr] = {
        totalAssets: rawAssets != null ? (rawAssets as number) / 1e6 * fxRate : null,
        cash:        rawCash   != null ? (rawCash   as number) / 1e6 * fxRate : null,
      }
    }

    // Build Yahoo cashflow lookup by year for CapEx/D&A fallback when FMP lacks them
    // Priority 1: fundamentalsTimeSeries annual cash-flow (most complete)
    // Priority 2: quoteSummary cashflowStatementHistory (older, sometimes missing OCF)
    const yahooCfByYear: Record<string, { capex: number | null; dna: number | null; opCF: number | null; fcf: number | null; fcfDirect: number | null }> = {}

    // Load fundamentalsTimeSeries cash-flow (annualCFRows from API call above)
    for (const s of (annualCFRows as any[])) {
      const d = s.date instanceof Date ? s.date : new Date(String(s.date))
      if (isNaN(d.getTime())) continue
      const yr = String(d.getFullYear())
      const rawCapex = s.capitalExpenditure ?? s.purchaseOfPPE
      const rawDna   = s.depreciationAmortizationDepletion ?? s.reconciledDepreciation
      const rawOpCF  = s.operatingCashFlow ?? s.cashFlowFromContinuingOperatingActivities
      const rawFcf   = s.freeCashFlow
      const capexY = rawCapex != null ? (rawCapex as number) * cfFmpScaleFactor / 1e6 * fxRate : null
      const dnaY   = rawDna   != null ? (rawDna   as number) * cfFmpScaleFactor / 1e6 * fxRate : null
      const opCFY  = rawOpCF  != null ? (rawOpCF  as number) * cfFmpScaleFactor / 1e6 * fxRate : null
      const fcfY   = capexY != null && opCFY != null ? Math.round(opCFY + capexY) : null
      const fcfDirectY = rawFcf != null ? Math.round((rawFcf as number) * cfFmpScaleFactor / 1e6 * fxRate) : null
      yahooCfByYear[yr] = { capex: capexY, dna: dnaY, opCF: opCFY, fcf: fcfY, fcfDirect: fcfDirectY }
    }

    // Overlay quoteSummary cashflowStatementHistory only where fundamentalsTimeSeries is missing
    for (const s of (fin.cashflowStatementHistory?.cashflowStatements ?? []) as any[]) {
      const yr = String(new Date(s.endDate).getFullYear())
      if (yahooCfByYear[yr]?.opCF != null) continue  // already have reliable data
      const rawCapex = s.capitalExpenditures ?? s.capitalExpenditure ?? s.purchaseOfPlantPropertyEquipment
      const rawDna = s.depreciation ?? s.depreciationAndAmortization
      const rawOpCF = s.operatingCashflow ?? s.totalCashFromOperatingActivities
      const capexY = rawCapex != null ? (rawCapex as number) * cfFmpScaleFactor / 1e6 * fxRate : null
      const dnaY   = rawDna   != null ? (rawDna   as number) * cfFmpScaleFactor / 1e6 * fxRate : null
      const opCFY  = rawOpCF  != null ? (rawOpCF  as number) * cfFmpScaleFactor / 1e6 * fxRate : null
      const fcfY   = capexY != null && opCFY != null ? Math.round(opCFY + capexY) : null
      yahooCfByYear[yr] = { capex: capexY, dna: dnaY, opCF: opCFY, fcf: fcfY, fcfDirect: null }
    }

    const cfHistoricalRows = hasFmp && fmpCfSorted.length > 0
      ? fmpCfSorted.map(s => {
          const yr = s.fiscalYear
          const yhoo = yahooCfByYear[yr] ?? {}
          const fmpCapex = s.investmentsInPropertyPlantAndEquipment != null ? s.investmentsInPropertyPlantAndEquipment * cfFmpScaleFactor / 1e6 * fxRate : null
          const fmpDna   = s.depreciationAndAmortization != null ? s.depreciationAndAmortization * cfFmpScaleFactor / 1e6 * fxRate : null
          const fmpOpCF  = s.netCashProvidedByOperatingActivities != null ? s.netCashProvidedByOperatingActivities * cfFmpScaleFactor / 1e6 * fxRate : null
          const capex = fmpCapex ?? yhoo.capex ?? null
          const dna   = fmpDna   ?? yhoo.dna   ?? null
          const opCF  = fmpOpCF  ?? yhoo.opCF  ?? null
          // FCF fallback priority: computed (OCF+Capex) → Yahoo FTS direct FCF → FMP FCF
          // yhoo.fcfDirect = Yahoo's own freeCashFlow from fundamentalsTimeSeries (reliable)
          // fmpFcf may equal Net Income for companies where FMP lacks OCF data (data quality bug)
          const fmpFcf = s.freeCashFlow != null ? Math.round(s.freeCashFlow * cfFmpScaleFactor / 1e6 * fxRate) : null
          const freeCashFlow = opCF != null && capex != null
            ? Math.round(opCF + capex)
            : (yhoo.fcfDirect ?? yhoo.fcf ?? (fmpCapex != null ? fmpFcf : fmpFcf))
          return {
            year: yr,
            operatingCF: opCF,
            capex,
            freeCashFlow,
            investingCF: s.netCashUsedForInvestingActivites != null ? s.netCashUsedForInvestingActivites * cfFmpScaleFactor / 1e6 * fxRate : null,
            financingCF: s.netCashUsedProvidedByFinancingActivities != null ? s.netCashUsedProvidedByFinancingActivities * cfFmpScaleFactor / 1e6 * fxRate : null,
            // dividendsPaid in FMP is negative (outflow); store as negative to match Yahoo convention
            dividendsPaid: s.commonDividendsPaid != null ? s.commonDividendsPaid * cfFmpScaleFactor / 1e6 * fxRate : null,
            buybacks: s.commonStockRepurchased != null ? Math.abs(s.commonStockRepurchased * cfFmpScaleFactor / 1e6 * fxRate) : null,
            dna,
            fiscalDate: s.date ?? s.fiscalYear,
            isProjected: false,
          }
        })
      : (() => {
          // Primary: fundamentalsTimeSeries (annualCFRows) — reliable post-Nov 2024
          // cashflowStatementHistory is deprecated and returns no financial fields since Nov 2024
          if (Object.keys(yahooCfByYear).length > 0) {
            const rawISStmts: any[] = fin.incomeStatementHistory?.incomeStatementHistory ?? []
            return Object.entries(yahooCfByYear)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([yr, cf]) => {
                const matchingIS = rawISStmts.find((r: any) => String(new Date(r.endDate).getFullYear()) === yr)
                const fallbackNI = (matchingIS?.netIncome ?? null) as number | null
                const freeCashFlow = cf.fcf ?? cf.fcfDirect
                  ?? (cf.opCF == null && cf.capex == null && fallbackNI != null ? Math.round(fallbackNI / 1e6 * fxRate) : null)
                return {
                  year: yr,
                  operatingCF: cf.opCF,
                  capex: cf.capex,
                  freeCashFlow,
                  investingCF: null as number | null,
                  financingCF: null as number | null,
                  dividendsPaid: null as number | null,
                  buybacks: null as number | null,
                  dna: cf.dna,
                  fiscalDate: `${yr}-12-31`,
                  isProjected: false as const,
                }
              })
          }
          // Fallback: cashflowStatementHistory (deprecated, may lack financial fields)
          const rawCFHistoryEarly: any[] = fin.cashflowStatementHistory?.cashflowStatements ?? []
          const rawISStmts: any[] = fin.incomeStatementHistory?.incomeStatementHistory ?? []
          const cfHistorical = rawCFHistoryEarly.slice(-4).reverse()
          return cfHistorical.map((s: any) => {
            const rawOpCF = s.operatingCashflow ?? s.totalCashFromOperatingActivities ?? s.netCashProvidedByOperatingActivities ?? s.cashFromOperations ?? s.cashGeneratedFromOperations
            const rawCapex = s.capitalExpenditures ?? s.capitalExpenditure ?? s.purchaseOfPlantPropertyEquipment ?? s.paymentsToAcquirePropertyPlantAndEquipment
            const rawInvCF = s.totalCashflowsFromInvestingActivities ?? s.totalCashFromInvestingActivities ?? s.netCashUsedForInvestingActivities ?? s.cashUsedForInvestingActivities
            const rawFinCF = s.totalCashFromFinancingActivities ?? s.netCashUsedProvidedByFinancingActivities ?? s.cashUsedProvidedByFinancingActivities
            const rawDivPaid = s.dividendsPaid ?? s.paymentOfDividends ?? s.paymentsForDividends
            const rawBuyback = s.repurchaseOfStock ?? s.repurchaseOfCommonStock ?? s.paymentsForRepurchaseOfCommonStock ?? s.buybacksOfStock ?? null
            const dnaRaw = s.depreciation ?? s.depreciationAndAmortization
            const cfYear = String(new Date(s.endDate).getFullYear())
            const matchingIS = rawISStmts.find((r: any) => String(new Date(r.endDate).getFullYear()) === cfYear)
            const fallbackNetIncome = (matchingIS?.netIncome ?? s.netIncome ?? null) as number | null
            const opCF  = rawOpCF  != null ? (rawOpCF  as number) / 1e6 * fxRate : null
            const capex = rawCapex != null ? (rawCapex as number) / 1e6 * fxRate : null
            const freeCashFlowFallback = (opCF == null && capex == null && fallbackNetIncome != null) ? Math.round(fallbackNetIncome / 1e6 * fxRate) : null
            return {
              year: String(new Date(s.endDate).getFullYear()),
              operatingCF: opCF,
              capex,
              freeCashFlow: opCF != null && capex != null ? Math.round(opCF + capex) : opCF ?? freeCashFlowFallback,
              investingCF: rawInvCF != null ? (rawInvCF as number) / 1e6 * fxRate : null,
              financingCF: rawFinCF != null ? (rawFinCF as number) / 1e6 * fxRate : null,
              dividendsPaid: rawDivPaid != null ? (rawDivPaid as number) / 1e6 * fxRate : null,
              buybacks: rawBuyback != null ? Math.abs((rawBuyback as number) / 1e6 * fxRate) : null,
              dna: dnaRaw != null ? (dnaRaw as number) / 1e6 * fxRate : null,
              fiscalDate: s.endDate ? new Date(s.endDate).toISOString().split('T')[0] : null,
              isProjected: false,
            }
          })
        })()

    // Reconcile fcfMargin with the FCF table — same data source, same derivation.
    // Fires when Yahoo TTM and FMP latest both produce null/negative (e.g. fintechs
    // with loan-distorted cash flow statements, or companies with a single bad FCF year).
    if (businessProfile.fcfMargin == null || businessProfile.fcfMargin < 0) {
      const recentPosCF = cfHistoricalRows
        .filter(r => !r.isProjected && r.freeCashFlow != null && r.freeCashFlow > 0)
        .at(-1)
      if (recentPosCF != null) {
        const matchIS = isHistoricalRows.find(
          r => !r.isProjected && String(r.year) === String(recentPosCF.year) && r.revenue != null && r.revenue > 0
        )
        const revForYear = matchIS?.revenue ?? (rawRevMLocal * fxRate)
        if (revForYear > 0) {
          businessProfile.fcfMargin = Math.min(recentPosCF.freeCashFlow! / revForYear, fcfMarginCeiling)
        }
      }
    }

    // Average D&A as % of revenue — use most recent year's rate for projections
    const avgDnaRateFromCF: number = (() => {
      const rows = cfHistoricalRows.filter(r => r.dna != null && r.year != null)
      const ratesWithRev = rows.map(r => {
        const incRow = isHistoricalRows.find(i => i.year === r.year)
        const rev = incRow?.revenue
        return (r.dna != null && rev != null && rev > 0) ? r.dna / rev : null
      }).filter((v): v is number => v != null)
      return ratesWithRev.length > 0 ? ratesWithRev[ratesWithRev.length - 1] : 0.06
    })()

    // Infer fiscal year-end month/day from last historical CF row
    const lastCfFiscalDate = cfHistoricalRows[cfHistoricalRows.length - 1]?.fiscalDate ?? null
    const fiscalMonthDay = (lastCfFiscalDate && lastCfFiscalDate.length >= 10) ? lastCfFiscalDate.slice(5) : '12-31'

    const cfProjectedRows = Array.from({ length: 5 }, (_, idx) => {
      const t = idx + 1
      const projFCF = dcfResult.projections[t - 1]?.cashFlow ?? 0
      const hasCapex = avgCapexM !== 0
      const projOpCF = hasCapex ? projFCF - avgCapexM : projFCF
      return {
        year: `${baseYear + t}E`,
        operatingCF: Math.round(projOpCF),
        capex: hasCapex ? Math.round(avgCapexM) : null,
        freeCashFlow: Math.round(projFCF),
        investingCF: null,
        financingCF: null,
        dividendsPaid: avgDivPaidM !== 0 ? Math.round(avgDivPaidM) : null,
        buybacks: avgBuybackM > 0 ? Math.round(avgBuybackM) : null,
        dna: Math.round(latestRevM * Math.pow(1 + cagr, t) * avgDnaRateFromCF),
        fiscalDate: `${baseYear + t}-${fiscalMonthDay}`,
        isProjected: true,
      }
    })

    const cashFlow = [...cfHistoricalRows, ...cfProjectedRows]

    // --- Balance Sheet ---
    const bsHistoricalRows = hasFmp
      ? fmpBsSorted.map(s => {
          const yr = s.fiscalYear
          const yhooBS = yahooBsByYear[yr] ?? {}
          const fmpCash       = s.cashAndShortTermInvestments > 0 ? s.cashAndShortTermInvestments / 1e6 * fxRate : (s.cashAndCashEquivalents > 0 ? s.cashAndCashEquivalents / 1e6 * fxRate : null)
          const fmpTotalAssets = s.totalAssets > 0 ? s.totalAssets / 1e6 * fxRate : null
          return {
            year: yr,
            cash: fmpCash ?? yhooBS.cash ?? null,
            totalCurrentAssets: s.totalCurrentAssets > 0 ? s.totalCurrentAssets / 1e6 * fxRate : null,
            totalAssets: fmpTotalAssets ?? yhooBS.totalAssets ?? null,
            longTermDebt: s.longTermDebt > 0 ? s.longTermDebt / 1e6 * fxRate : null,
            totalCurrentLiabilities: s.totalCurrentLiabilities > 0 ? s.totalCurrentLiabilities / 1e6 * fxRate : null,
            totalEquity: (s.totalStockholdersEquity ?? s.totalEquity) > 0 ? (s.totalStockholdersEquity ?? s.totalEquity) / 1e6 * fxRate : null,
            fiscalDate: s.date ?? s.fiscalYear,
            isProjected: false,
          }
        })
      : (() => {
          // Build fundamentalsTimeSeries balance sheet lookup by year (has totalAssets when quoteSummary strips it)
          const ftsBsByYear: Record<string, any> = {}
          for (const r of annualBSRows) {
            const yr = String(new Date(r.date instanceof Date ? r.date : String(r.date)).getFullYear())
            ftsBsByYear[yr] = r
          }

          const rawBSHistory: any[] = fin.balanceSheetHistory?.balanceSheetStatements ?? []
          const bsHistorical = rawBSHistory.slice(-4).reverse()
          return bsHistorical.map((s: any) => {
            const yr = String(new Date(s.endDate).getFullYear())
            const fts = ftsBsByYear[yr] ?? {}
            const ftsAssets = fts.totalAssets != null ? (fts.totalAssets as number) / 1e6 * fxRate : null
            const ftsCA     = fts.currentAssets != null ? (fts.currentAssets as number) / 1e6 * fxRate : null
            const ftsCash   = (fts.cashCashEquivalentsAndShortTermInvestments ?? fts.cashAndCashEquivalents) != null
              ? ((fts.cashCashEquivalentsAndShortTermInvestments ?? fts.cashAndCashEquivalents) as number) / 1e6 * fxRate : null
            const ftsCL     = fts.currentLiabilities != null ? (fts.currentLiabilities as number) / 1e6 * fxRate : null
            const ftsEquity = fts.stockholdersEquity != null ? (fts.stockholdersEquity as number) / 1e6 * fxRate : null
            const ftsLTD    = (fts.longTermDebtAndCapitalLeaseObligation ?? fts.longTermDebt) != null
              ? ((fts.longTermDebtAndCapitalLeaseObligation ?? fts.longTermDebt) as number) / 1e6 * fxRate : null
            const rawCash = s.cash ?? s.cashAndCashEquivalents ?? s.cashAndShortTermInvestments ?? s.cashCashEquivalentsAndShortTermInvestments ?? s.cashAndCashEquivalentsAtCarryingValue
            return {
              year: yr,
              cash: (rawCash != null ? (rawCash as number) / 1e6 * fxRate : null) ?? ftsCash ?? null,
              totalCurrentAssets: (s.totalCurrentAssets != null ? (s.totalCurrentAssets as number) / 1e6 * fxRate : null) ?? ftsCA ?? null,
              totalAssets: (s.totalAssets != null ? (s.totalAssets as number) / 1e6 * fxRate : null) ?? ftsAssets ?? null,
              longTermDebt: (s.longTermDebt != null ? (s.longTermDebt as number) / 1e6 * fxRate : null) ?? ftsLTD ?? null,
              totalCurrentLiabilities: (s.totalCurrentLiabilities != null ? (s.totalCurrentLiabilities as number) / 1e6 * fxRate : null) ?? ftsCL ?? null,
              totalEquity: ((s.totalStockholderEquity ?? s.stockholdersEquity) != null ? ((s.totalStockholderEquity ?? s.stockholdersEquity) as number) / 1e6 * fxRate : null) ?? ftsEquity ?? null,
              fiscalDate: s.endDate ? new Date(s.endDate).toISOString().split('T')[0] : null,
              isProjected: false,
            }
          })
        })()

    // Projected balance sheet
    let bsProjectedRows: typeof bsHistoricalRows = []
    if (bsHistoricalRows.length >= 2) {
      const lastBS = bsHistoricalRows[bsHistoricalRows.length - 1]
      const avgDivForBS = Math.abs(avgDivPaidM)
      let prevCash   = lastBS.cash ?? 0
      let prevEquity = lastBS.totalEquity ?? 0
      let prevAssets = lastBS.totalAssets ?? 0
      const projDebt = lastBS.longTermDebt
      const lastBsFiscalDate = lastBS.fiscalDate ?? null
      const bsFiscalMonthDay = (lastBsFiscalDate && lastBsFiscalDate.length >= 10) ? lastBsFiscalDate.slice(5) : fiscalMonthDay

      bsProjectedRows = Array.from({ length: 5 }, (_, idx) => {
        const t = idx + 1
        const projFCF = dcfResult.projections[t - 1]?.cashFlow ?? 0
        const projRevM = latestRevM * Math.pow(1 + cagr, t)
        const projNetIncomeM = projRevM * avgNetMarginRatio
        const newCash   = prevCash   + projFCF - avgDivForBS
        const newEquity = prevEquity + projNetIncomeM - avgDivForBS
        const newAssets = prevAssets + projFCF
        const row = { year: `${baseYear + t}E`, cash: newCash, totalCurrentAssets: null as null, totalAssets: newAssets, longTermDebt: projDebt, totalCurrentLiabilities: null as null, totalEquity: newEquity, fiscalDate: `${baseYear + t}-${bsFiscalMonthDay}`, isProjected: true }
        prevCash = newCash; prevEquity = newEquity; prevAssets = newAssets
        return row
      })
    }

    const balanceSheet = [...bsHistoricalRows, ...bsProjectedRows]

    const financialStatements = { incomeStatement, balanceSheet, cashFlow }

    // Historical valuation multiples — computed from income statement + balance sheet + key-metrics market cap.
    // Computing from raw financials gives better coverage than relying on FMP key-metrics ratios alone:
    // those ratios omit loss years, cap high-multiple growth stocks, and are missing for many tickers.
    const clamp = (v: number | null | undefined, lo: number, hi: number): number | null => {
      if (v == null || !isFinite(v) || v <= 0) return null
      return v > hi || v < lo ? null : Math.round(v * 100) / 100
    }

    const kmByFY = new Map(fmp.keyMetrics.filter(km => km.fiscalYear).map(km => [km.fiscalYear, km]))
    const bsByFY = new Map(fmp.balanceSheets.filter(bs => bs.fiscalYear).map(bs => [bs.fiscalYear, bs]))

    const historicalMultiples = fmp.incomeStatements
      .filter(is => is.fiscalYear && isFinite(is.revenue) && is.revenue > 0)
      .sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear))
      .map(is => {
        const km     = kmByFY.get(is.fiscalYear)
        const bs     = bsByFY.get(is.fiscalYear)
        const mktCap = km?.marketCap ?? null
        const cash   = bs?.cashAndShortTermInvestments ?? 0
        const debt   = bs?.longTermDebt ?? 0
        // mktCap from FMP key-metrics is in full USD; cash/debt from balance sheet are in millions — align units
        const ev     = mktCap != null && mktCap > 0 ? mktCap + (debt - cash) * 1e6 : null

        // Income statement values (netIncome, ebitda, revenue) are in millions — multiply by 1e6 for ratio math
        const peComputed    = mktCap != null && mktCap > 0 && is.netIncome > 0 ? mktCap / (is.netIncome * 1e6) : null
        const evEbComputed  = ev != null && ev > 0 && is.ebitda > 0 ? ev / (is.ebitda * 1e6) : null
        const evRevComputed = ev != null && ev > 0 && is.revenue > 0 ? ev / (is.revenue * 1e6) : null

        // Wider clamp bounds: preserve valid high-multiple years (e.g. P/E 300 on a cyclical recovery)
        const pe        = clamp(peComputed    ?? km?.peRatio,                   1, 500)
        const evEbitda  = clamp(evEbComputed  ?? km?.enterpriseValueOverEBITDA, 1, 150)
        const evRevenue = clamp(evRevComputed ?? km?.evToSales,                 0.1, 100)
        const ps        = clamp(km?.priceToSalesRatio, 0.1, 50)

        return { fiscalYear: is.fiscalYear, date: is.date, pe, evEbitda, evRevenue, ps }
      })
      .filter(r => r.pe != null || r.evEbitda != null || r.evRevenue != null)

    // Yahoo-derived historical multiples — computed from price history + income statement rows.
    // This is the FMP-independent fallback: sH is always available (Yahoo), isHistoricalRows
    // has a Yahoo fallback (incomeStatementHistory). When FMP quota is exhausted historicalMultiples
    // will be empty, but this series will still have data.
    //
    // Method: find the closing price nearest to each fiscal year-end, then compute:
    //   P/E  = price / annual EPS   (diluted)
    //   P/S  = market cap / revenue = (price × shares) / revenue
    //   EV/Rev ≈ P/S (simplified — omits net debt; sufficient for trend chart)
    const priceOnDate = (dateStr: string): number | null => {
      if (!sH.length || !dateStr) return null
      const target = new Date(dateStr).getTime()
      let best: { date: string; close: number } | null = null
      let bestDiff = Infinity
      for (const p of sH) {
        const diff = Math.abs(new Date(p.date).getTime() - target)
        if (diff < bestDiff) { bestDiff = diff; best = p }
      }
      // Reject if nearest price is more than 30 trading days away (~45 calendar days)
      return best && bestDiff < 45 * 86400_000 ? best.close : null
    }

    // sharesOutstanding in millions (already computed above)
    const sharesForRatio = (fin.defaultKeyStatistics?.sharesOutstanding as number | null | undefined) != null
      ? (fin.defaultKeyStatistics.sharesOutstanding as number) / 1e6
      : null

    const historicalMultiplesYahoo = isHistoricalRows
      .filter(r => !r.isProjected && r.year && r.year.length === 4)
      .map(r => {
        const price  = priceOnDate(r.fiscalDate ?? `${r.year}-12-31`)
        const eps    = (r.eps    ?? null) as number | null
        const revM   = (r.revenue ?? null) as number | null
        const ebitdaM = (r.ebitda ?? null) as number | null

        const pe = (price != null && eps != null && eps > 0)
          ? clamp(price / eps, 1, 500)
          : null

        // EV/Revenue ≈ market cap / revenue (simplified, no net-debt adjustment)
        const evRevenue = (price != null && sharesForRatio != null && revM != null && revM > 0)
          ? clamp((price * sharesForRatio) / revM, 0.1, 100)
          : null

        // EV/EBITDA ≈ market cap / EBITDA (simplified)
        const evEbitda = (price != null && sharesForRatio != null && ebitdaM != null && ebitdaM > 0)
          ? clamp((price * sharesForRatio) / ebitdaM, 1, 150)
          : null

        return { fiscalYear: r.year, date: r.fiscalDate ?? `${r.year}-12-31`, pe, evEbitda, evRevenue, ps: null as number | null }
      })
      .filter(r => r.pe != null || r.evRevenue != null || r.evEbitda != null)

    // Merge: FMP rows take precedence (more accurate); fill gaps from Yahoo-derived rows
    const fmpFYSet = new Set(historicalMultiples.map(r => r.fiscalYear))
    const mergedHistoricalMultiples = [
      ...historicalMultiples,
      ...historicalMultiplesYahoo.filter(r => !fmpFYSet.has(r.fiscalYear)),
    ].sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear))

    // Historical FCF for DCF table context (last 3 years)
    const historicalFCF: { year: number; cashFlow: number }[] = cfHistoricalRows
      .filter((r) => r.freeCashFlow != null && !r.isProjected)
      .slice(-3)
      .map((r) => ({ year: parseInt(r.year), cashFlow: Math.round(r.freeCashFlow!) }))

    // Stale-Yahoo baseFCF correction: apply after historicalFCF is built.
    // Financial types use NI-based baseFCF intentionally — skip them.
    // Only correct when histFCF is a valid positive number and the ratio is extreme (>10×).
    const _financialTypes = new Set(['financial', 'fintech', 'bdc', 'mreeit'])
    const _companyTypeForFCFGuard = (fin.summaryProfile?.sector ?? '')
    const _isFinancialForGuard = _financialTypes.has(companyType ?? '') ||
      /bank|insurance|financ|fintech|payment|credit|lending/i.test(_companyTypeForFCFGuard)
    const _lastHistFCF = historicalFCF.length > 0 ? historicalFCF[historicalFCF.length - 1].cashFlow : 0
    if (!_isFinancialForGuard && !fcfCapApplied && _lastHistFCF > 0 && baseFCF > 0) {
      const _ratio = baseFCF / _lastHistFCF
      if (_ratio > 10) {
        // Yahoo fd.freeCashflow is likely pre-capex-surge stale — use most-recent reported FCF
        baseFCF = _lastHistFCF
        fcfCapApplied = true
      }
    }

    // Analyst forward estimates from earningsTrend (EPS + revenue by period)
    const etTrends: any[] = (fin.earningsTrend?.trend ?? []) as any[]
    const analystForwardEstimates = etTrends
      .filter((t: any) => ['0y', '+1y', '+2y'].includes(t.period))
      .map((t: any) => ({
        period: t.period as string,
        endDate: t.endDate ? new Date(t.endDate).toISOString().split('T')[0] : null,
        revenue: {
          avg:       (t.revenueEstimate?.avg ?? null) as number | null,
          low:       (t.revenueEstimate?.low ?? null) as number | null,
          high:      (t.revenueEstimate?.high ?? null) as number | null,
          growth:    (t.revenueEstimate?.growth ?? null) as number | null,
          analysts:  (t.revenueEstimate?.numberOfAnalysts ?? null) as number | null,
          yearAgo:   (t.revenueEstimate?.yearAgoRevenue ?? null) as number | null,
        },
        eps: {
          avg:       (t.earningsEstimate?.avg ?? null) as number | null,
          low:       (t.earningsEstimate?.low ?? null) as number | null,
          high:      (t.earningsEstimate?.high ?? null) as number | null,
          growth:    (t.earningsEstimate?.growth ?? null) as number | null,
          analysts:  (t.earningsEstimate?.numberOfAnalysts ?? null) as number | null,
          yearAgo:   (t.earningsEstimate?.yearAgoEps ?? null) as number | null,
        },
      }))

    // EPS surprise history from earningsHistory (last 4 quarters)
    const ehHistory: any[] = (fin.earningsHistory?.history ?? []) as any[]
    const earningsSurprises = ehHistory
      .filter((h: any) => h.epsActual != null && h.epsEstimate != null)
      .slice(-4)
      .map((h: any) => ({
        quarter:         h.period as string | null,
        date:            h.earningsDate ? new Date(h.earningsDate).toISOString().split('T')[0] : null,
        epsActual:       (h.epsActual   ?? null) as number | null,
        epsEstimate:     (h.epsEstimate ?? null) as number | null,
        epsDifference:   (h.epsDifference ?? null) as number | null,
        surprisePercent: (h.surprisePercent ?? null) as number | null,
      }))

    // Analyst recommendation trend (last 4 months for stacked bar chart)
    const recTrend: any[] = (fin.recommendationTrend?.trend ?? []) as any[]
    const analystRatingTrend = recTrend.slice(0, 4).map((r: any) => ({
      period:    (r.period ?? '') as string,
      strongBuy: (r.strongBuy ?? 0) as number,
      buy:       (r.buy ?? 0) as number,
      hold:      (r.hold ?? 0) as number,
      sell:      (r.sell ?? 0) as number,
      strongSell:(r.strongSell ?? 0) as number,
    }))

    // ── Assumption audit — cross-validates seeded assumptions against independent signals ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _auditBundle: Record<string, any> = {
      quote: {
        price: currentPrice,
        sector: profile.sector ?? q.sector ?? '',
        industry: profile.industry ?? '',
        country: fin.summaryProfile?.country ?? null,
        // peRatio is required by deriveExitPE to blend current P/E with sector median.
        // Without it the function falls through to sector-median-only (38× for software),
        // producing an exitPE that ignores the actual current multiple (e.g. 71× for NOW).
        peRatio: q.trailingPE ?? null,
      },
      wacc: { ...waccResult, crp, inputs: waccInputs },
      cagrAnalysis,
      businessProfile: {
        netMargin: (fd.profitMargins ?? null) as number | null,
        revenueM: rawRevMLocal * fxRate,
      },
      ratiosQuarterly: fmp.ratiosQuarterly,
      analystForwardEstimates,
      peerComps: livePeers,
      scores,
      fairValue: { debt: rawDebtM, cash: cashM, sharesOutstanding: sharesM },
      valuationMethods,
      // financialStatements gives deriveNetMargin access to grossProfit rows for the
      // isHighGrowthSaaS boundary check. Without this, the gross margin check uses null
      // and the SaaS convergence branch never fires for companies like NOW.
      financialStatements: { incomeStatement },
      // terminalG must be passed so the audit uses the actual computed value instead of
      // falling back to seedAssumptions' default of 0.03 (causes false-positive EM floor warn).
      terminalG,
    }
    const _seededAssumptions = seedAssumptions(_auditBundle)
    const assumptionAudit = runAssumptionAudit(_auditBundle, _seededAssumptions)

    // Analyst-implied forward P/E = currentPrice / next-year consensus EPS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _fwd1y = analystForwardEstimates.find((e: any) => e.period === '+1y')
    const _fwdEPS: number | null = _fwd1y?.eps?.avg ?? null
    // For non-USD reporters (e.g. STNE=BRL), Yahoo returns analyst EPS in local currency.
    // Dividing USD price by local-currency EPS produces a nonsense P/E (e.g. 0.8× for STNE).
    // Convert by dividing by fxRate to get USD EPS before computing forward P/E.
    const _fwdEPSUSD = _fwdEPS != null && fxRate > 0 ? _fwdEPS * fxRate : _fwdEPS
    const analystForwardPE: number | null =
      _fwdEPSUSD != null && _fwdEPSUSD > 0 && currentPrice > 0
        ? Math.round((currentPrice / _fwdEPSUSD) * 10) / 10
        : null

    // Compute the cockpit blended fair value server-side so the analyze page and
    // stock page always show the same verdict. The cockpit uses a multi-method
    // blend (Forward P/E, EV/EBITDA, Revenue Multiple, Core DCF) identical to
    // what ValuationCockpit renders client-side on the stock page.
    let cockpitFairValue: number | null = null
    let cockpitUpsidePct: number | null = null
    try {
      const _cockpitBundle = {
        ..._auditBundle,
        fairValue: { debt: rawDebtM, cash: cashM, sharesOutstanding: sharesM },
        scenarios,
        incomeStatementQuarterly: fmp.incomeStatementQuarterly,
        ratiosQuarterly: fmp.ratiosQuarterly,
      }
      const _snap = buildSnapshot(_cockpitBundle)
      // Seed fullDcfFairValue so Core DCF uses the 4-model Damodaran blend
      _snap.fullDcfFairValue = scenarios.base.fairValue ?? null
      const _cockpitAssumptions = seedAssumptions(_cockpitBundle)
      const _cockpitOutput = computeCockpitOutput(_cockpitAssumptions, _snap)
      cockpitFairValue  = _cockpitOutput.blendedFairValue
      cockpitUpsidePct  = _cockpitOutput.upsidePct
    } catch {
      // Silent — falls back to triangulatedFairValue in the analyze page
    }

    // Patch valuationMethods with the cockpit result so the analyze page
    // and stock page show the same verdict.
    if (cockpitFairValue != null) {
      valuationMethods.cockpitFairValue  = cockpitFairValue
      valuationMethods.cockpitUpsidePct  = cockpitUpsidePct
    }

    return NextResponse.json({
      ticker,
      quote: {
        price: currentPrice,
        change: q.regularMarketChange ?? 0,
        changePct: q.regularMarketChangePercent ?? 0,
        marketCap: q.marketCap ?? 0,
        peRatio: q.trailingPE ?? null,
        fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
        analystTargetMean: fin.financialData?.targetMeanPrice ?? null,
        currency: quoteCurrency,
        sector: profile.sector ?? q.sector ?? '',
        industry: profile.industry ?? '',
        exchange: q.fullExchangeName ?? q.exchange ?? '',
        analystTargetLow: fin.financialData?.targetLowPrice ?? null,
        analystTargetHigh: fin.financialData?.targetHighPrice ?? null,
        pegRatio: ks.pegRatio ?? fin.financialData?.pegRatio ?? null,
        nextEarningsDate: ks.earningsTimestamp
          ? new Date((ks.earningsTimestamp as number) * 1000).toISOString().split('T')[0]
          : null,
        sharesOutstanding: ks.sharesOutstanding ?? null,
        dividendYield: dividendYield,
        payoutRatio: payoutRatio > 0 ? payoutRatio : null,
        // Extended hours
        marketState: (q.marketState ?? 'REGULAR') as string,
        preMarketPrice: (q.preMarketPrice ?? null) as number | null,
        preMarketChangePct: (q.preMarketChangePercent ?? null) as number | null,
        postMarketPrice: (q.postMarketPrice ?? null) as number | null,
        postMarketChangePct: (q.postMarketChangePercent ?? null) as number | null,
      },
      wacc: { ...waccResult, crp, financialCurrency },
      dcf: dcfResult,
      fairValue: fvResult,
      scenarios,
      baseFCF,
      fcfCapApplied,
      cagr,
      cagrAnalysis,
      isNegativeFCF,
      terminalG,
      historicalFCF,
      historicalRevenues,
      businessProfile,
      analystRecommendation: fin.financialData?.recommendationKey ?? '',
      financialCurrencyNote,
      growthModel,
      ratings,
      scores,
      ownership,
      holdingReturns,
      valuationMethods,
      financialStatements,
      historicalMultiples: mergedHistoricalMultiples,
      keyMetricsQuarterly: fmp.keyMetricsQuarterly,
      incomeStatementQuarterly: fmp.incomeStatementQuarterly,
      ratiosQuarterly: fmp.ratiosQuarterly,
      keyMetricsAnnual: fmp.keyMetrics
        .filter(km => km.fiscalYear)
        .sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear))
        .map(km => ({
          fiscalYear: km.fiscalYear,
          roic: typeof km.returnOnInvestedCapital === 'number' ? km.returnOnInvestedCapital : null,
          roe:  typeof km.returnOnEquity           === 'number' ? km.returnOnEquity           : null,
        })),
      canComputeDCF,
      vetoReasons,
      limitedHistory,
      historyYears,
      analystForwardEstimates,
      analystForwardPE,
      assumptionAudit,
      peerComps: livePeers.map(p => ({
        ticker:       p.ticker,
        trailingPE:   p.trailingPE,
        priceToBook:  p.priceToBook,
        priceToSales: p.priceToSales,
        evToEbitda:   p.evToEbitda,
        evToRevenue:  p.evToRevenue,
      })),
      earningsSurprises,
      analystRatingTrend,
      secFilings: secFilingsRaw
        .filter(f => ['10-K', '10-Q', '8-K', 'DEF 14A'].includes(f.type))
        .slice(0, 8)
        .map(f => ({
          type: f.type,
          date: f.fillingDate,
          link: f.finalLink || f.link,
        })),
      institutionalHolders: institutionalHoldersRaw
        .slice(0, 10)
        .map(h => ({
          name: h.investorName,
          shares: h.sharesNumber,
          weight: h.weight,
          weightChange: h.changeInWeightPercentage,
          isNew: h.isNew,
          isSoldOut: h.isSoldOut,
        })),
      providerStatus: {
        fmp: {
          ok: hasFmp,
          ...(hasFmp ? {} : { error: 'No FMP income statement data' }),
        },
        fred: {
          ok: true,
          rfRate,
          source: rfRate === 0.0429 ? ('fallback' as const) : ('api' as const),
        },
        fx: {
          rate: fxRate,
          source: fxRate === 1 ? ('parity' as const) : ('api' as const),
        },
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    })
  } catch (err) {
    console.error(`Financials error for ${ticker}:`, err)
    return NextResponse.json({ error: 'Failed to fetch data', details: String(err) }, { status: 500 })
  }
}
