/**
 * Monte Carlo DCF Engine
 *
 * Architecture:
 * 1. Markov-chain regime transitions (Bear / Base / Bull) calibrated to the
 *    company's own historical distribution of revenue growth and FCF margin.
 *    Transition probabilities are sensitivity-weighted: drivers that move fair
 *    value most (per the main cockpit sensitivity map) pull regime transitions
 *    harder.
 * 2. Per-path, per-year simulation of revenue → FCF → discounted PV.
 *    Each year samples from the regime-specific distribution; the regime itself
 *    evolves via the Markov matrix. This avoids the "static scenario" failure
 *    mode where every bear-case path is uniformly bad for all 10 years.
 * 3. Longstaff-Schwartz American option pricing on two real options:
 *    - Abandonment: floor at liquidation value (cash + net receivables / shares).
 *      The firm can always be dissolved; this bounds the left tail honestly.
 *    - Expansion: if cumulative FCF at year 3 beats the P75 threshold AND CAGR
 *      has been above regime-base, the firm can deploy additional capex for
 *      `expansionYears` extra years of excess-return FCF. Models the optionality
 *      of high-conviction compounder quality.
 * 4. Tail-risk adjustment: CVaR(P10) / E[V] — compares expected value to the
 *    conditional expected value in the worst 10% of outcomes. This is the
 *    risk/reward quality score: 1.0 = no tail risk relative to mean; < 0.5 =
 *    severe left tail (think early-stage biotech pre-revenue).
 *
 * Output: a full distribution + P10/P25/P50/P75/P90 + real option values +
 * tail-risk score. The P50 is reported as the "fair value" to the cockpit;
 * the distribution width is the UI's primary insight.
 *
 * Financial design rationale:
 * - Regimes are defined relative to the company's own history (P25/P50/P75),
 *   not absolute sector thresholds, because what "bad" looks like for a utility
 *   is structurally different from what "bad" looks like for a hyper-growth SaaS.
 * - Sensitivity weighting of transition probabilities: the cockpit already ranks
 *   which assumptions move fair value most. A high-sensitivity-to-WACC name
 *   should have its regime transitions respond more strongly to rate-regime
 *   signals than a low-sensitivity-to-WACC name.
 * - LS scope is expansion + abandonment only (not deferral/contraction) because
 *   those require options-on-options nesting that adds noise without materially
 *   improving output for listed equities with observable prices.
 */

import type { ValuationAssumptions, CockpitSnapshot } from './cockpit'

// ── Types ────────────────────────────────────────────────────────────────────

export type Regime = 0 | 1 | 2 // 0 = Bear, 1 = Base, 2 = Bull

export interface MCInputs {
  // Core
  baseFCF: number            // TTM FCF in $M
  wacc: number               // base discount rate
  cagr: number               // base revenue CAGR assumption
  netMargin: number          // base net margin
  terminalG: number          // terminal growth rate
  numYears: number           // projection horizon (default 10)
  cashM: number
  debtM: number
  sharesM: number
  currentPrice: number

  // Regime calibration — percentiles of historical realised growth/margin
  // If null, we derive from cagr ± default spreads
  p25Growth: number | null   // P25 of historical annual revenue growth
  p75Growth: number | null   // P75 of historical annual revenue growth
  p25Margin: number | null   // P25 of historical net margin
  p75Margin: number | null   // P75 of historical net margin

  // Sensitivity weights (from cockpit sensitivity map) — proportional, not %
  sensWacc: number
  sensCagr: number
  sensMarg: number

  // Real option inputs
  liquidationPerShare: number | null  // abandonment floor; null = skip
  expansionYears: number              // extra FCF years if expansion exercised (default 2)

  // Simulation
  nPaths: number   // default 10 000
  seed?: number    // deterministic testing only
}

export interface MCResult {
  p10: number
  p25: number
  p50: number    // reported as "fair value" to cockpit
  p75: number
  p90: number
  mean: number
  stdDev: number

  // Tail risk: E[V | V ≤ P10] / mean — lower = worse left tail
  cvarRatio: number

  // Real option values per share
  abandonmentOptionValue: number
  expansionOptionValue: number

  // Regime steady-state probabilities (how often each regime is visited across all paths)
  regimeProbabilities: [number, number, number]  // [bear, base, bull]

  // Full distribution for histogram — 50 equal-width buckets
  histogram: Array<{ lo: number; hi: number; count: number; pct: number }>

  // Metadata
  nPaths: number
  numYears: number
  inputs: MCInputs
}

// ── PRNG (Mulberry32 — fast, deterministic, good distribution) ───────────────

function makePRNG(seed: number) {
  let s = seed >>> 0
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0
    let t = Math.imul(s ^ s >>> 15, 1 | s)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// Box-Muller transform — N(0,1)
function normalSample(rand: () => number): number {
  const u1 = Math.max(1e-10, rand())
  const u2 = rand()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

// ── Regime calibration ───────────────────────────────────────────────────────

interface RegimeParams {
  growthMu: number; growthSigma: number
  marginMu: number; marginSigma: number
  waccSpread: number  // additional spread on WACC in this regime
}

function buildRegimeParams(inputs: MCInputs): [RegimeParams, RegimeParams, RegimeParams] {
  const base = inputs.cagr
  const mBase = inputs.netMargin

  // Derive bear/bull anchor from historical percentiles when available,
  // otherwise use ±40% of base CAGR as a reasonable spread for uncertainty.
  const bearGrowth = inputs.p25Growth ?? base * 0.55
  const bullGrowth = inputs.p75Growth ?? base * 1.45
  const bearMargin = inputs.p25Margin ?? mBase * 0.70
  const bullMargin = inputs.p75Margin ?? mBase * 1.25

  // Within-regime sigma: ~30% of the distance between regime midpoint and edge
  const bGSig  = Math.abs(base - bearGrowth) * 0.30
  const bGSigB = Math.abs(bullGrowth - base) * 0.30

  return [
    // Bear
    { growthMu: bearGrowth, growthSigma: Math.max(0.005, bGSig),
      marginMu: bearMargin, marginSigma: Math.max(0.005, Math.abs(mBase - bearMargin) * 0.30),
      waccSpread: 0.015 },
    // Base
    { growthMu: base, growthSigma: Math.max(0.01, bGSig * 0.7),
      marginMu: mBase, marginSigma: Math.max(0.005, Math.abs(mBase - bearMargin) * 0.20),
      waccSpread: 0 },
    // Bull
    { growthMu: bullGrowth, growthSigma: Math.max(0.005, bGSigB),
      marginMu: bullMargin, marginSigma: Math.max(0.005, Math.abs(bullMargin - mBase) * 0.30),
      waccSpread: -0.01 },
  ]
}

// ── Markov transition matrix ─────────────────────────────────────────────────
//
// Base matrix: slightly mean-reverting (economic regimes don't persist forever)
//   P = [[0.55, 0.35, 0.10],   // from Bear
//        [0.20, 0.60, 0.20],   // from Base
//        [0.10, 0.35, 0.55]]   // from Bull
//
// Sensitivity weighting: if CAGR dominates sensitivity, it pulls bear→bear and
// bull→bull stickiness higher (regime persistence matters more for growth names).
// If WACC dominates, bear↔base transitions are more rate-driven (less sticky).

function buildTransitionMatrix(inputs: MCInputs): number[][] {
  const totalSens = inputs.sensWacc + inputs.sensCagr + inputs.sensMarg
  const wW = totalSens > 0 ? inputs.sensWacc / totalSens : 0.33
  const wG = totalSens > 0 ? inputs.sensCagr / totalSens : 0.33

  // Growth-sensitivity increases regime persistence (compounder or cyclical with
  // strong momentum). WACC-sensitivity (rate-sensitive names: utilities, REITs)
  // increases mean reversion — rates change, but the business reverts faster.
  const persistence = 0.50 + wG * 0.12 - wW * 0.08  // [~0.42, ~0.62]

  const p = Math.min(0.65, Math.max(0.42, persistence))
  const mid = (1 - p) / 2

  // Row = current regime; Col = next regime
  return [
    [p,       mid + 0.05, mid - 0.05],   // Bear: harder to escape bear
    [mid,     p,          mid],           // Base: symmetric mean reversion
    [mid - 0.05, mid + 0.05, p],          // Bull: harder to leave bull
  ]
}

function sampleNextRegime(current: Regime, matrix: number[][], rand: () => number): Regime {
  const row = matrix[current]
  const r = rand()
  if (r < row[0]) return 0
  if (r < row[0] + row[1]) return 1
  return 2
}

// ── Longstaff-Schwartz basis functions (polynomial regression) ───────────────
//
// We use [1, x, x²] as the basis — sufficient for 3-regime 10-year paths.
// The state variable x is the normalised cumulative discounted FCF at the
// exercise decision point.

function lsRegression(x: number[], y: number[]): [number, number, number] {
  const n = x.length
  if (n < 3) return [0, 0, 0]

  // Σ matrices for OLS: [1, x, x²] basis
  let s0 = n, s1 = 0, s2 = 0, s3 = 0, s4 = 0
  let t0 = 0, t1 = 0, t2 = 0
  for (let i = 0; i < n; i++) {
    const xi = x[i], yi = y[i]
    const x2 = xi * xi, x3 = x2 * xi, x4 = x2 * x2
    s1 += xi; s2 += x2; s3 += x3; s4 += x4
    t0 += yi; t1 += xi * yi; t2 += x2 * yi
  }

  // 3×3 matrix inversion (Cramer's rule)
  const A = [[s0, s1, s2], [s1, s2, s3], [s2, s3, s4]]
  const b = [t0, t1, t2]

  // Gaussian elimination with partial pivoting
  const aug: number[][] = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < 3; col++) {
    let maxRow = col
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[maxRow][col])) maxRow = r
    }
    ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
    if (Math.abs(aug[col][col]) < 1e-10) continue
    for (let r = 0; r < 3; r++) {
      if (r === col) continue
      const factor = aug[r][col] / aug[col][col]
      for (let c = col; c <= 3; c++) aug[r][c] -= factor * aug[col][c]
    }
  }

  const coeffs = aug.map((row, i) => Math.abs(row[i]) < 1e-10 ? 0 : row[3] / row[i])
  return [coeffs[0], coeffs[1], coeffs[2]]
}

// ── Core simulation ──────────────────────────────────────────────────────────

export function runMonteCarlo(inputs: MCInputs): MCResult {
  const {
    baseFCF, wacc, terminalG, numYears = 10,
    cashM, debtM, sharesM,
    liquidationPerShare, expansionYears = 2,
    nPaths = 10_000,
    seed = 42,
  } = inputs

  if (sharesM <= 0 || baseFCF <= 0) {
    return zeroResult(inputs)
  }

  const rand = makePRNG(seed)
  const regimes = buildRegimeParams(inputs)
  const transMatrix = buildTransitionMatrix(inputs)

  const liquidFloor = (liquidationPerShare ?? 0) > 0 ? liquidationPerShare! : 0
  const expansionThreshold = inputs.p75Growth ?? inputs.cagr * 1.4  // beat P75 for expansion

  // Paths: each entry is terminal equity value per share
  const pathValues: number[] = new Array(nPaths)
  // For LS: store per-path per-year state for backward induction
  // We keep cumFCF at year 3 (expansion decision) and year 1 (abandonment can trigger each year)
  const pathCumFCF3: number[] = new Array(nPaths)
  const pathCAGR3: number[] = new Array(nPaths)  // realised CAGR to year 3

  // Regime visit tracker
  const regimeVisits = [0, 0, 0]

  // ── Forward pass: simulate all paths ────────────────────────────────────────
  for (let p = 0; p < nPaths; p++) {
    let regime: Regime = 1  // start in Base
    let pvFCFs = 0
    let cumFCF = 0
    let revenue0 = baseFCF / Math.max(0.01, Math.abs(inputs.netMargin))  // approximate revenue base

    for (let t = 1; t <= numYears; t++) {
      regimeVisits[regime]++

      const rp = regimes[regime]
      const g = rp.growthMu + rp.growthSigma * normalSample(rand)
      const m = rp.marginMu + rp.marginSigma * normalSample(rand)
      const w = wacc + rp.waccSpread

      revenue0 *= (1 + Math.max(-0.30, Math.min(1.0, g)))
      const fcfT = revenue0 * Math.max(-0.20, Math.min(0.60, m))

      const df = Math.pow(1 + Math.max(0.02, w), t)
      pvFCFs += fcfT / df
      cumFCF += fcfT

      if (t === 3) {
        pathCumFCF3[p] = cumFCF
        // CAGR from t=0 to t=3: (revenue0_t3 / revenue0_t0)^(1/3) - 1
        const origRevenue = baseFCF / Math.max(0.01, Math.abs(inputs.netMargin))
        pathCAGR3[p] = origRevenue > 0 ? Math.pow(Math.max(0, revenue0) / origRevenue, 1 / 3) - 1 : 0
      }

      regime = sampleNextRegime(regime, transMatrix, rand)
    }

    // Terminal value (Gordon Growth)
    const lastFCF = revenue0 * Math.max(-0.20, Math.min(0.60, regimes[1].marginMu))
    const waccEff = Math.max(terminalG + 0.01, wacc)
    const tv = terminalG < waccEff ? (lastFCF * (1 + terminalG)) / (waccEff - terminalG) : lastFCF * 15
    const pvTV = tv / Math.pow(1 + waccEff, numYears)

    const equity = (pvFCFs + pvTV + cashM - debtM) * 1e6  // convert M → raw
    pathValues[p] = Math.max(liquidFloor, equity / sharesM / 1e6)  // per share in same unit as baseFCF
  }

  // ── Longstaff-Schwartz: Abandonment option (year 1 exercise each path) ──────
  // Simple annual check: if path value at year t (approximated by cumFCF trajectory)
  // is below liquidation floor, compare continuation value to liquidation.
  // For efficiency, we apply LS at the path-terminal level using year-3 cumFCF
  // as the state variable.
  let abandonmentOptionValue = 0
  let expansionOptionValue = 0

  if (liquidFloor > 0 && nPaths >= 100) {
    // In-the-money paths at year 3: where cumFCF < 0 (firm is burning cash)
    const itmAbandonment = pathValues
      .map((v, i) => ({ v, cum: pathCumFCF3[i] ?? 0, i }))
      .filter(d => d.cum < 0)

    if (itmAbandonment.length > 10) {
      const xVec = itmAbandonment.map(d => d.cum)
      const yVec = itmAbandonment.map(d => liquidFloor)  // exercise payoff
      const [a, b, c] = lsRegression(xVec, yVec)
      let optionGain = 0
      for (const d of itmAbandonment) {
        const contVal = a + b * d.cum + c * d.cum * d.cum
        if (liquidFloor > contVal) {
          optionGain += (liquidFloor - Math.min(d.v, contVal))
        }
      }
      abandonmentOptionValue = optionGain / nPaths
    }
  }

  // LS Expansion option: ITM = realised CAGR to year 3 > expansionThreshold
  if (nPaths >= 100) {
    const itmExpansion = pathValues
      .map((v, i) => ({ v, cagr3: pathCAGR3[i] ?? 0, i }))
      .filter(d => d.cagr3 > expansionThreshold && (pathCumFCF3[d.i] ?? 0) > 0)

    if (itmExpansion.length > 10) {
      const xVec = itmExpansion.map(d => d.cagr3)
      // Expansion payoff: PV of `expansionYears` extra FCFs at bull-regime margin
      const yVec = itmExpansion.map(d => {
        const extraYearFCF = baseFCF * Math.pow(1 + d.cagr3, numYears + 1) * regimes[2].marginMu
        let pv = 0
        for (let k = 1; k <= expansionYears; k++) {
          pv += extraYearFCF / Math.pow(1 + wacc, numYears + k)
        }
        return Math.max(0, (pv * 1e6) / (sharesM * 1e6))
      })
      const [a, b, c] = lsRegression(xVec, yVec)
      let optionGain = 0
      for (const d of itmExpansion) {
        const projectedPayoff = a + b * d.cagr3 + c * d.cagr3 * d.cagr3
        if (projectedPayoff > 0) optionGain += projectedPayoff
      }
      expansionOptionValue = optionGain / nPaths
    }
  }

  // ── Compute percentiles and distribution ─────────────────────────────────────
  const sorted = [...pathValues].sort((a, b) => a - b)
  const pct = (q: number) => sorted[Math.floor(q * sorted.length)] ?? sorted[sorted.length - 1]

  const p10 = pct(0.10)
  const p25 = pct(0.25)
  const p50 = pct(0.50)
  const p75 = pct(0.75)
  const p90 = pct(0.90)

  const mean = pathValues.reduce((s, v) => s + v, 0) / nPaths
  const variance = pathValues.reduce((s, v) => s + (v - mean) ** 2, 0) / nPaths
  const stdDev = Math.sqrt(variance)

  // CVaR: mean of bottom 10%
  const tail10 = sorted.slice(0, Math.floor(nPaths * 0.10))
  const cvarValue = tail10.reduce((s, v) => s + v, 0) / Math.max(1, tail10.length)
  const cvarRatio = mean > 0 ? cvarValue / mean : 0

  // Histogram — 50 buckets
  const histMin = p10 * 0.85
  const histMax = p90 * 1.15
  const bucketW = (histMax - histMin) / 50
  const buckets: number[] = new Array(50).fill(0)
  for (const v of pathValues) {
    const idx = Math.min(49, Math.max(0, Math.floor((v - histMin) / Math.max(1e-10, bucketW))))
    buckets[idx]++
  }
  const histogram = buckets.map((count, i) => ({
    lo: histMin + i * bucketW,
    hi: histMin + (i + 1) * bucketW,
    count,
    pct: count / nPaths,
  }))

  const totalVisits = regimeVisits[0] + regimeVisits[1] + regimeVisits[2]
  const regimeProbabilities: [number, number, number] = [
    regimeVisits[0] / totalVisits,
    regimeVisits[1] / totalVisits,
    regimeVisits[2] / totalVisits,
  ]

  return {
    p10, p25, p50, p75, p90, mean, stdDev, cvarRatio,
    abandonmentOptionValue, expansionOptionValue,
    regimeProbabilities, histogram,
    nPaths, numYears, inputs,
  }
}

// ── Helper for insufficient data ─────────────────────────────────────────────

function zeroResult(inputs: MCInputs): MCResult {
  return {
    p10: 0, p25: 0, p50: 0, p75: 0, p90: 0,
    mean: 0, stdDev: 0, cvarRatio: 0,
    abandonmentOptionValue: 0, expansionOptionValue: 0,
    regimeProbabilities: [0.2, 0.6, 0.2],
    histogram: [],
    nPaths: 0, numYears: inputs.numYears ?? 10, inputs,
  }
}

// ── Build MCInputs from cockpit data ─────────────────────────────────────────

export function buildMCInputs(
  assumptions: ValuationAssumptions,
  snapshot: CockpitSnapshot,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiData: Record<string, any>,
  sensitivity: Partial<Record<keyof ValuationAssumptions, number>>,
): MCInputs {
  // Historical percentiles from income statement
  const incomeRows: Array<{ isProjected: boolean; revenue: number | null; netIncome?: number | null }> =
    apiData.financialStatements?.incomeStatement ?? []
  const actuals = incomeRows.filter(r => !r.isProjected && r.revenue != null && r.revenue > 0)

  // Realised revenue growth rates
  const growthRates: number[] = []
  for (let i = 1; i < actuals.length; i++) {
    const prev = actuals[i - 1].revenue!, curr = actuals[i].revenue!
    if (prev > 0) growthRates.push((curr - prev) / prev)
  }
  growthRates.sort((a, b) => a - b)

  // Realised net margins
  const margins: number[] = actuals
    .filter(r => r.netIncome != null && r.revenue != null && r.revenue > 0)
    .map(r => r.netIncome! / r.revenue!)
  margins.sort((a, b) => a - b)

  const pctArr = (arr: number[], q: number) =>
    arr.length < 4 ? null : arr[Math.floor(q * arr.length)]

  // Liquidity-based abandonment floor
  const bsRows: Array<{ isProjected?: boolean; totalCash?: number | null; totalCurrentAssets?: number | null }> =
    apiData.financialStatements?.balanceSheet ?? []
  const lastBS = bsRows.filter(r => !r.isProjected).slice(-1)[0]
  const cashRaw = lastBS?.totalCash ?? 0
  const liquidationPerShare = snapshot.sharesM > 0 && cashRaw > 0
    ? (cashRaw + snapshot.cashM) / snapshot.sharesM  // M → per share
    : null

  // Sensitivity magnitudes for regime weighting
  const sensWacc = Math.abs(sensitivity['wacc'] ?? 0.15)
  const sensCagr = Math.abs(sensitivity['cagr'] ?? 0.25)
  const sensMarg = Math.abs(sensitivity['netMargin'] ?? 0.15)

  return {
    baseFCF:          snapshot.baseFCF,
    wacc:             assumptions.wacc,
    cagr:             assumptions.cagr,
    netMargin:        assumptions.netMargin,
    terminalG:        assumptions.terminalG,
    numYears:         10,
    cashM:            snapshot.cashM,
    debtM:            snapshot.debtM,
    sharesM:          snapshot.sharesM,
    currentPrice:     snapshot.currentPrice,
    p25Growth:        pctArr(growthRates, 0.25),
    p75Growth:        pctArr(growthRates, 0.75),
    p25Margin:        pctArr(margins, 0.25),
    p75Margin:        pctArr(margins, 0.75),
    sensWacc,
    sensCagr,
    sensMarg,
    liquidationPerShare,
    expansionYears:   2,
    nPaths:           10_000,
  }
}
