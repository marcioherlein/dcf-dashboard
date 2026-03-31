/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Piotroski F-Score ───────────────────────────────────────────────────────

export interface PiotroskiCriterion {
  name: string
  pass: boolean
  detail: string
}

export interface PiotroskiResult {
  score: number
  criteria: PiotroskiCriterion[]
  label: 'Strong' | 'Mixed' | 'Weak'
}

export function calculatePiotroski(
  bsStmts: any[],
  incStmts: any[],
  cfStmts: any[],
  sharesNow: number,
  sharesPrior: number,
): PiotroskiResult {
  const bs0 = bsStmts[0] ?? {}
  const bs1 = bsStmts[1] ?? {}
  const inc0 = incStmts[0] ?? {}
  const inc1 = incStmts[1] ?? {}
  const cf0 = cfStmts[0] ?? {}

  const ta0 = (bs0.totalAssets ?? 0) as number
  const ta1 = (bs1.totalAssets ?? 0) as number

  const ni0 = (inc0.netIncome ?? inc0.netIncomeApplicableToCommonShares ?? 0) as number
  const ni1 = (inc1.netIncome ?? inc1.netIncomeApplicableToCommonShares ?? 0) as number

  const ocf0 = (cf0.totalCashFromOperatingActivities ?? cf0.operatingCashflow ?? 0) as number

  const roa0 = ta0 > 0 ? ni0 / ta0 : 0
  const roa1 = ta1 > 0 ? ni1 / ta1 : 0

  const ltd0 = ((bs0.longTermDebt ?? bs0.longTermDebtTotal ?? 0) as number)
  const ltd1 = ((bs1.longTermDebt ?? bs1.longTermDebtTotal ?? 0) as number)
  const lev0 = ta0 > 0 ? ltd0 / ta0 : 0
  const lev1 = ta1 > 0 ? ltd1 / ta1 : 0

  const ca0 = (bs0.totalCurrentAssets ?? 0) as number
  const cl0 = (bs0.totalCurrentLiabilities ?? 0) as number
  const ca1 = (bs1.totalCurrentAssets ?? 0) as number
  const cl1 = (bs1.totalCurrentLiabilities ?? 0) as number
  const cr0 = cl0 > 0 ? ca0 / cl0 : 0
  const cr1 = cl1 > 0 ? ca1 / cl1 : 0

  const rev0 = (inc0.totalRevenue ?? 0) as number
  const rev1 = (inc1.totalRevenue ?? 0) as number
  const gp0 = (inc0.grossProfit ?? 0) as number
  const gp1 = (inc1.grossProfit ?? 0) as number
  const gm0 = rev0 > 0 ? gp0 / rev0 : 0
  const gm1 = rev1 > 0 ? gp1 / rev1 : 0
  const at0 = ta0 > 0 ? rev0 / ta0 : 0
  const at1 = ta1 > 0 ? rev1 / ta1 : 0

  const fmt = (n: number) => (n * 100).toFixed(1) + '%'
  const fmtN = (n: number) => n.toFixed(3)

  const criteria: PiotroskiCriterion[] = [
    {
      name: 'ROA positive',
      pass: roa0 > 0,
      detail: `ROA ${fmt(roa0)}`,
    },
    {
      name: 'Operating CF positive',
      pass: ocf0 > 0,
      detail: `OCF $${(ocf0 / 1e9).toFixed(1)}B`,
    },
    {
      name: 'ROA improving',
      pass: roa0 > roa1,
      detail: `${fmt(roa0)} vs ${fmt(roa1)} prior`,
    },
    {
      name: 'Accrual quality (OCF > Net Income)',
      pass: ocf0 > ni0,
      detail: `OCF $${(ocf0 / 1e9).toFixed(1)}B vs NI $${(ni0 / 1e9).toFixed(1)}B`,
    },
    {
      name: 'Leverage falling',
      pass: lev0 < lev1,
      detail: `LTD/Assets ${fmtN(lev0)} vs ${fmtN(lev1)} prior`,
    },
    {
      name: 'Liquidity rising',
      pass: cr0 > cr1,
      detail: `Current ratio ${fmtN(cr0)} vs ${fmtN(cr1)} prior`,
    },
    {
      name: 'No share dilution',
      pass: sharesNow <= sharesPrior * 1.005,  // 0.5% tolerance for rounding
      detail: `${(sharesNow / 1e9).toFixed(2)}B vs ${(sharesPrior / 1e9).toFixed(2)}B shares`,
    },
    {
      name: 'Gross margin rising',
      pass: gm0 > gm1,
      detail: `${fmt(gm0)} vs ${fmt(gm1)} prior`,
    },
    {
      name: 'Asset turnover rising',
      pass: at0 > at1,
      detail: `${fmtN(at0)} vs ${fmtN(at1)} prior`,
    },
  ]

  const score = criteria.filter((c) => c.pass).length
  const label: PiotroskiResult['label'] = score >= 8 ? 'Strong' : score >= 4 ? 'Mixed' : 'Weak'

  return { score, criteria, label }
}

// ─── Altman Z-Score ──────────────────────────────────────────────────────────

export interface AltmanResult {
  zScore: number
  zone: 'Safe' | 'Grey' | 'Distress'
  components: { x1: number; x2: number; x3: number; x4: number; x5: number }
}

export function calculateAltman(
  bs: any,
  inc: any,
  marketCapRaw: number,   // in same raw currency units as balance sheet (not millions)
): AltmanResult | null {
  const ta = (bs.totalAssets ?? 0) as number
  if (ta <= 0) return null

  const ca = (bs.totalCurrentAssets ?? 0) as number
  const cl = (bs.totalCurrentLiabilities ?? 0) as number
  // Yahoo Finance uses multiple field names for retained earnings across company types
  const re = (
    bs.retainedEarnings
    ?? bs.retainedEarningsAccumulatedDeficit
    ?? bs.accumulatedOtherComprehensiveIncomeLoss
    ?? 0
  ) as number
  const tl = (bs.totalLiab ?? bs.totalLiabilities ?? bs.totalLiabilitiesNetMinorityInterest ?? 0) as number
  const rev = (inc.totalRevenue ?? 0) as number

  // EBIT: use ebit field first, then operatingIncome — do NOT fall back to totalRevenue
  const ebit = (inc.ebit ?? inc.operatingIncome ?? 0) as number

  const x1 = (ca - cl) / ta
  const x2 = re / ta
  const x3 = ebit / ta
  const x4 = tl > 0 ? marketCapRaw / tl : 0
  const x5 = rev / ta

  const zScore = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5
  if (!isFinite(zScore) || zScore > 50 || zScore < -20) return null
  const rounded = Math.round(zScore * 100) / 100
  const zone: AltmanResult['zone'] = rounded >= 3.0 ? 'Safe' : rounded >= 1.8 ? 'Grey' : 'Distress'

  return {
    zScore: rounded,
    zone,
    components: {
      x1: Math.round(x1 * 1000) / 1000,
      x2: Math.round(x2 * 1000) / 1000,
      x3: Math.round(x3 * 1000) / 1000,
      x4: Math.round(x4 * 100) / 100,
      x5: Math.round(x5 * 1000) / 1000,
    },
  }
}

// ─── Beneish M-Score ─────────────────────────────────────────────────────────

export interface BeneishResult {
  mScore: number
  flag: 'Clean' | 'Warning' | 'Manipulator'
  components: {
    dsri: number; gmi: number; aqi: number; sgi: number
    depi: number; sgai: number; tata: number; lvgi: number
  }
}

export function calculateBeneish(
  bs0: any, bs1: any,
  inc0: any, inc1: any,
  cf0: any,
): BeneishResult | null {
  const rev0 = (inc0.totalRevenue ?? 0) as number
  const rev1 = (inc1.totalRevenue ?? 0) as number
  if (rev0 === 0 || rev1 === 0) return null

  const ta0 = (bs0.totalAssets ?? 0) as number
  const ta1 = (bs1.totalAssets ?? 0) as number
  if (ta0 <= 0 || ta1 <= 0) return null

  // Receivables
  const rec0 = (bs0.netReceivables ?? bs0.accountsReceivable ?? 0) as number
  const rec1 = (bs1.netReceivables ?? bs1.accountsReceivable ?? 0) as number

  // Gross profit
  const gp0 = (inc0.grossProfit ?? rev0 * 0.5) as number
  const gp1 = (inc1.grossProfit ?? rev1 * 0.5) as number
  const gm0 = gp0 / rev0
  const gm1 = gp1 / rev1

  // PPE (net)
  const ppe0 = (bs0.propertyPlantEquipment ?? bs0.netPPE ?? 0) as number
  const ppe1 = (bs1.propertyPlantEquipment ?? bs1.netPPE ?? 0) as number

  // Current assets and liabilities
  const ca0 = (bs0.totalCurrentAssets ?? 0) as number
  const cl0 = (bs0.totalCurrentLiabilities ?? 0) as number
  const ca1 = (bs1.totalCurrentAssets ?? 0) as number
  const cl1 = (bs1.totalCurrentLiabilities ?? 0) as number

  // Depreciation (from income stmt or cash flow)
  const dep0 = Math.abs((inc0.depreciationAmortization ?? cf0.depreciation ?? 0) as number)
  const dep1 = Math.abs((inc1.depreciationAmortization ?? 0) as number)

  // SGA
  const sga0 = (inc0.sellingGeneralAdministrative ?? inc0.totalOperatingExpenses ?? 0) as number
  const sga1 = (inc1.sellingGeneralAdministrative ?? inc1.totalOperatingExpenses ?? 0) as number

  // LTD
  const ltd0 = (bs0.longTermDebt ?? bs0.longTermDebtTotal ?? 0) as number
  const ltd1 = (bs1.longTermDebt ?? bs1.longTermDebtTotal ?? 0) as number

  // Net income and OCF
  const ni0 = (inc0.netIncome ?? 0) as number
  const ocf0 = (cf0.totalCashFromOperatingActivities ?? cf0.operatingCashflow ?? 0) as number

  // ── Eight indices ──────────────────────────────────────────────────────────

  // DSRI: Days Sales in Receivables Index
  const dsri = (rec1 > 0 && rev1 > 0) ? (rec0 / rev0) / (rec1 / rev1) : 1

  // GMI: Gross Margin Index
  const gmi = gm1 > 0 ? gm1 / gm0 : 1

  // AQI: Asset Quality Index
  const nonCurNonPPE0 = ta0 > 0 ? 1 - (ca0 + ppe0) / ta0 : 0
  const nonCurNonPPE1 = ta1 > 0 ? 1 - (ca1 + ppe1) / ta1 : 0
  const aqi = nonCurNonPPE1 > 0 ? nonCurNonPPE0 / nonCurNonPPE1 : 1

  // SGI: Sales Growth Index
  const sgi = rev1 > 0 ? rev0 / rev1 : 1

  // DEPI: Depreciation Index
  const depRate0 = ppe0 + dep0 > 0 ? dep0 / (dep0 + ppe0) : 0
  const depRate1 = ppe1 + dep1 > 0 ? dep1 / (dep1 + ppe1) : 0
  const depi = depRate0 > 0 ? depRate1 / depRate0 : 1

  // SGAI: SGA Expense Index
  const sgai = (sga0 / rev0) > 0 ? (sga1 / rev1) / (sga0 / rev0) : 1

  // TATA: Total Accruals to Total Assets
  const tata = ta0 > 0 ? (ni0 - ocf0) / ta0 : 0

  // LVGI: Leverage Index
  const leverage0 = ta0 > 0 ? (ltd0 + cl0) / ta0 : 0
  const leverage1 = ta1 > 0 ? (ltd1 + cl1) / ta1 : 0
  const lvgi = leverage1 > 0 ? leverage0 / leverage1 : 1

  const round = (n: number) => Math.round(n * 10000) / 10000
  const components = {
    dsri: round(dsri), gmi: round(gmi), aqi: round(aqi), sgi: round(sgi),
    depi: round(depi), sgai: round(sgai), tata: round(tata), lvgi: round(lvgi),
  }

  const mScore = -4.84
    + 0.920 * dsri
    + 0.528 * gmi
    + 0.404 * aqi
    + 0.892 * sgi
    + 0.115 * depi
    - 0.172 * sgai
    + 4.679 * tata
    - 0.327 * lvgi

  if (!isFinite(mScore) || mScore > 50 || mScore < -50) return null
  const rounded = Math.round(mScore * 100) / 100
  const flag: BeneishResult['flag'] =
    rounded <= -1.78 ? 'Clean' : rounded <= -1.50 ? 'Warning' : 'Manipulator'

  return { mScore: rounded, flag, components }
}

// ─── ROIC ────────────────────────────────────────────────────────────────────

export interface ROICResult {
  roic: number           // decimal e.g. 0.394
  nopat: number          // millions
  investedCapital: number // millions
  spread: number         // roic − wacc
}

export function calculateROIC(
  bs0: any,
  bs1: any,
  inc: any,
  taxRate: number,
  wacc: number,
  fxRate: number,
): ROICResult {
  const toM = (n: number) => n / 1e6 * fxRate

  // Extended operating income fallback (covers banks, fintechs, non-US GAAP)
  const rawOpIncome = (
    inc.ebit
    ?? inc.operatingIncome
    ?? inc.operatingIncomeBeforeDepreciation
    ?? inc.incomeBeforeTax
    ?? inc.pretaxIncome
    ?? null
  ) as number | null
  const opIncomeHasData = rawOpIncome !== null
  const opIncome = rawOpIncome ?? 0
  const nopat = toM(opIncome) * (1 - Math.max(0, Math.min(0.40, taxRate)))

  function investedCapital(bs: any): number {
    if (!bs || Object.keys(bs).length === 0) return 0
    const ta = toM((bs.totalAssets ?? 0) as number)
    if (ta <= 0) return 0
    const ap = toM((bs.accountsPayable ?? 0) as number)
    const cash = toM((bs.cash ?? bs.cashAndCashEquivalents ?? bs.cashAndShortTermInvestments ?? 0) as number)
    const sti = toM((bs.shortTermInvestments ?? 0) as number)
    const ca = toM((bs.totalCurrentAssets ?? 0) as number)
    const cl = toM((bs.totalCurrentLiabilities ?? 0) as number)
    // Excess cash = cash above what's needed to cover current liabilities
    const excessCash = Math.max(0, cash + sti - Math.max(0, cl - ca + cash))
    return Math.max(0, ta - ap - excessCash)
  }

  const ic0 = investedCapital(bs0)
  const ic1 = investedCapital(bs1)
  // If bs1 is empty (only 1 year of data), use ic0 alone
  const avgIC = ic1 > 0 ? (ic0 + ic1) / 2 : ic0

  const roic = (avgIC > 1 && opIncomeHasData) ? nopat / avgIC : 0  // require data + at least $1M invested capital
  const spread = roic - wacc

  return {
    roic: Math.round(roic * 10000) / 10000,
    nopat: Math.round(nopat),
    investedCapital: Math.round(avgIC),
    spread: Math.round(spread * 10000) / 10000,
  }
}
