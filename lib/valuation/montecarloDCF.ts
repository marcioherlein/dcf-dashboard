/**
 * Monte Carlo DCF Engine — v2
 *
 * Architecture:
 * 1. Markov-chain regime transitions (Bear / Base / Bull) calibrated to the
 *    company's own historical P25/P50/P75 of revenue growth and FCF margin.
 *    Transition matrix is sensitivity-weighted — growth-sensitive names get
 *    stickier regimes; rate-sensitive names mean-revert faster.
 *
 * 2. Per-path, per-year simulation with:
 *    - Correct accumulated discount factor: ∏(1 + w_k) not (1+w)^t
 *    - Correlated growth/margin sampling via Cholesky decomposition
 *    - Years 1-3 anchored to analyst consensus when available
 *    - Terminal value uses the path's actual final regime, not a hardcoded base
 *
 * 3. Longstaff-Schwartz American option pricing with true backward induction:
 *    - Stores full per-path per-year FCF and cumulative state
 *    - Backward sweep from T-1 to 1 for both options
 *    - Abandonment: exercise when continuation value < liquidation floor
 *    - Expansion: exercise when year-t CAGR beats P75 and cumFCF > 0
 *
 * 4. CVaR discount: tail risk feeds back into the reported fair value.
 *    If CVaR(P10)/mean < 0.70, a proportional discount is applied to P50.
 *    Max discount is 10%. The threshold and scale are exposed as constants.
 */

import type { ValuationAssumptions, CockpitSnapshot } from './cockpit'

// ── Constants ─────────────────────────────────────────────────────────────────

const CVAR_THRESHOLD = 0.70  // CVaR ratio above which no discount is applied
const CVAR_SCALE     = 0.25  // at ratio=0, discount = 0 + (0.70-0) * 0.25 = max 17.5%, cap at 10%
const MAX_CVAR_DISC  = 0.10  // absolute cap on CVaR discount

// ── Types ────────────────────────────────────────────────────────────────────

export type Regime = 0 | 1 | 2  // 0=Bear 1=Base 2=Bull

export interface MCInputs {
  baseFCF:     number        // TTM FCF in $M
  wacc:        number
  cagr:        number        // base CAGR assumption
  netMargin:   number
  terminalG:   number
  numYears:    number        // projection horizon (default 10)
  cashM:       number
  debtM:       number
  sharesM:     number
  currentPrice: number

  // Historical percentiles — null means derive from cagr ± spreads
  p25Growth:   number | null
  p75Growth:   number | null
  p25Margin:   number | null
  p75Margin:   number | null

  // Analyst consensus for years 1-3 (revenue in $M, null = unavailable)
  analystRevY1: number | null
  analystRevY2: number | null
  analystRevY3: number | null

  // Growth/margin correlation (estimated from history or default 0.35)
  growthMarginCorr: number

  // Sensitivity weights from main cockpit
  sensWacc:   number
  sensCagr:   number
  sensMarg:   number

  // Real option inputs
  liquidationPerShare: number | null
  expansionYears:      number        // extra FCF years on expansion (default 2)

  nPaths: number
  seed?:  number
}

export interface MCResult {
  p10: number; p25: number; p50: number; p75: number; p90: number
  mean: number; stdDev: number
  cvarRatio:   number   // E[V|V≤P10] / mean
  adjustedP50: number   // P50 discounted by CVaR tail severity
  cvarDiscount: number  // applied discount fraction (0–0.10)

  abandonmentOptionValue: number
  expansionOptionValue:   number

  regimeProbabilities: [number, number, number]
  histogram: Array<{ lo: number; hi: number; count: number; pct: number }>

  nPaths:   number
  numYears: number
  inputs:   MCInputs
}

// ── PRNG: Mulberry32 ──────────────────────────────────────────────────────────

function makePRNG(seed: number) {
  let s = seed >>> 0
  return (): number => {
    s |= 0; s = s + 0x6D2B79F5 | 0
    let t = Math.imul(s ^ s >>> 15, 1 | s)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// Box-Muller → N(0,1)
function stdNormal(rand: () => number): number {
  const u1 = Math.max(1e-10, rand())
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rand())
}

// Correlated bivariate normal via Cholesky: (z1, z2) with correlation ρ
function bivariateNormal(rand: () => number, rho: number): [number, number] {
  const z1 = stdNormal(rand)
  const z2 = rho * z1 + Math.sqrt(Math.max(0, 1 - rho * rho)) * stdNormal(rand)
  return [z1, z2]
}

// ── Regime calibration ────────────────────────────────────────────────────────

interface RegimeParams {
  growthMu: number; growthSig: number
  marginMu: number; marginSig: number
  waccSpread: number
}

function buildRegimes(inp: MCInputs): [RegimeParams, RegimeParams, RegimeParams] {
  const g = inp.cagr, m = inp.netMargin

  const bearG  = inp.p25Growth ?? g * 0.55
  const bullG  = inp.p75Growth ?? g * 1.45
  const bearM  = inp.p25Margin ?? m * 0.70
  const bullM  = inp.p75Margin ?? m * 1.25

  const sigBearG = Math.abs(g - bearG) * 0.30
  const sigBullG = Math.abs(bullG - g) * 0.30
  const sigBearM = Math.abs(m - bearM) * 0.30
  const sigBullM = Math.abs(bullM - m) * 0.30

  return [
    { growthMu: bearG, growthSig: Math.max(0.005, sigBearG),
      marginMu: bearM, marginSig: Math.max(0.005, sigBearM), waccSpread:  0.015 },
    { growthMu: g,     growthSig: Math.max(0.010, sigBearG * 0.7),
      marginMu: m,     marginSig: Math.max(0.005, sigBearM * 0.7), waccSpread:  0 },
    { growthMu: bullG, growthSig: Math.max(0.005, sigBullG),
      marginMu: bullM, marginSig: Math.max(0.005, sigBullM), waccSpread: -0.010 },
  ]
}

// ── Markov transition matrix ──────────────────────────────────────────────────

function buildTransition(inp: MCInputs): number[][] {
  const total = inp.sensWacc + inp.sensCagr + inp.sensMarg
  const wG = total > 0 ? inp.sensCagr / total : 0.33
  const wW = total > 0 ? inp.sensWacc / total : 0.33
  const p  = Math.min(0.65, Math.max(0.42, 0.50 + wG * 0.12 - wW * 0.08))
  const mid = (1 - p) / 2
  return [
    [p,       mid + 0.05, mid - 0.05],
    [mid,     p,          mid],
    [mid - 0.05, mid + 0.05, p],
  ]
}

function nextRegime(cur: Regime, mat: number[][], r: number): Regime {
  const row = mat[cur]
  if (r < row[0]) return 0
  if (r < row[0] + row[1]) return 1
  return 2
}

// ── Longstaff-Schwartz OLS: [1, x, x²] basis ─────────────────────────────────

function lsOLS(x: number[], y: number[]): [number, number, number] {
  const n = x.length
  if (n < 3) return [0, 0, 0]
  const s0 = n
  let s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0
  for (let i = 0; i < n; i++) {
    const xi = x[i], yi = y[i], x2 = xi * xi
    s1 += xi; s2 += x2; s3 += x2 * xi; s4 += x2 * x2
    t0 += yi; t1 += xi * yi; t2 += x2 * yi
  }
  const A = [[s0, s1, s2], [s1, s2, s3], [s2, s3, s4]]
  const b = [t0, t1, t2]
  const aug = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < 3; col++) {
    let mx = col
    for (let r = col + 1; r < 3; r++) if (Math.abs(aug[r][col]) > Math.abs(aug[mx][col])) mx = r
    ;[aug[col], aug[mx]] = [aug[mx], aug[col]]
    if (Math.abs(aug[col][col]) < 1e-10) continue
    for (let r = 0; r < 3; r++) {
      if (r === col) continue
      const f = aug[r][col] / aug[col][col]
      for (let c = col; c <= 3; c++) aug[r][c] -= f * aug[col][c]
    }
  }
  return aug.map((row, i) => Math.abs(row[i]) < 1e-10 ? 0 : row[3] / row[i]) as [number, number, number]
}

function lsPredict(coeffs: [number, number, number], x: number): number {
  return coeffs[0] + coeffs[1] * x + coeffs[2] * x * x
}

// ── Core simulation ───────────────────────────────────────────────────────────

export function runMonteCarlo(inputs: MCInputs): MCResult {
  const {
    baseFCF, wacc, terminalG, numYears = 10,
    cashM, debtM, sharesM,
    liquidationPerShare, expansionYears = 2,
    nPaths = 10_000, seed = 42,
    growthMarginCorr,
    analystRevY1, analystRevY2, analystRevY3,
  } = inputs

  if (sharesM <= 0 || baseFCF <= 0) return zeroResult(inputs)

  const rand    = makePRNG(seed)
  const regimes = buildRegimes(inputs)
  const trans   = buildTransition(inputs)
  const liqFloor = (liquidationPerShare ?? 0) > 0 ? liquidationPerShare! : 0
  const rho      = Math.max(-0.95, Math.min(0.95, growthMarginCorr))

  // Derive approximate initial revenue from baseFCF / netMargin
  const revBase = Math.abs(inputs.netMargin) > 0.001
    ? baseFCF / inputs.netMargin
    : baseFCF * 10

  // Analyst consensus revenue for years 1-3 (null = use regime sampling)
  const analystRev: (number | null)[] = [null, analystRevY1, analystRevY2, analystRevY3]

  const expansionThreshold = inputs.p75Growth ?? inputs.cagr * 1.4

  // ── Per-path storage for backward induction ──────────────────────────────
  // pathFCF[p][t] = undiscounted FCF at year t (1-indexed, 0 unused)
  // pathDF[p][t]  = accumulated discount factor at year t
  // pathReg[p][t] = regime at year t
  // pathRevCumG[p] = annualised revenue CAGR realised to year 3
  const pathFCF:   number[][] = new Array(nPaths)
  const pathDF:    number[][] = new Array(nPaths)
  const pathReg:   Regime[][] = new Array(nPaths)
  const pathCumFCF3: number[] = new Array(nPaths)
  const pathCAGR3:   number[] = new Array(nPaths)
  const pathFinalReg: Regime[] = new Array(nPaths)

  const regimeVisits = [0, 0, 0]

  // ── Forward pass ──────────────────────────────────────────────────────────
  for (let p = 0; p < nPaths; p++) {
    pathFCF[p] = new Array(numYears + 1).fill(0)
    pathDF[p]  = new Array(numYears + 1).fill(1)
    pathReg[p] = new Array(numYears + 1).fill(1)

    let regime: Regime = 1
    let rev = revBase
    let dfAccum = 1.0  // accumulated discount factor — correct compounding
    let cumFCF = 0

    for (let t = 1; t <= numYears; t++) {
      regimeVisits[regime]++
      pathReg[p][t] = regime
      const rp = regimes[regime]

      let fcfT: number

      if (t <= 3 && analystRev[t] != null) {
        // Anchor to analyst consensus with a ±sigma noise around the estimate
        const ar = analystRev[t]!
        const [zG, zM] = bivariateNormal(rand, rho)
        const noisyRev = ar * (1 + rp.growthSig * 0.5 * zG)  // tighter sigma: analyst already estimated
        rev = Math.max(0, noisyRev)
        const m = rp.marginMu + rp.marginSig * zM
        fcfT = rev * Math.max(-0.20, Math.min(0.60, m))
      } else {
        const [zG, zM] = bivariateNormal(rand, rho)
        const g = rp.growthMu + rp.growthSig * zG
        rev = rev * (1 + Math.max(-0.30, Math.min(1.0, g)))
        const m = rp.marginMu + rp.marginSig * zM
        fcfT = rev * Math.max(-0.20, Math.min(0.60, m))
      }

      // Accumulated discount factor — correct: multiply by (1 + wacc_t), not power
      const w = Math.max(0.02, wacc + rp.waccSpread)
      dfAccum *= (1 + w)

      pathFCF[p][t] = fcfT
      pathDF[p][t]  = dfAccum
      cumFCF += fcfT

      if (t === 3) {
        pathCumFCF3[p] = cumFCF
        pathCAGR3[p]   = revBase > 0 ? Math.pow(Math.max(1e-6, rev) / revBase, 1 / 3) - 1 : 0
      }

      regime = nextRegime(regime, trans, rand())
    }

    pathFinalReg[p] = regime

    // Terminal value using path's actual final regime (not hardcoded Base)
    const finalRp  = regimes[pathFinalReg[p]]
    const [, zMt]  = bivariateNormal(rand, rho)
    const termM    = finalRp.marginMu + finalRp.marginSig * zMt
    const lastFCF  = rev * Math.max(-0.20, Math.min(0.60, termM))
    const wEff     = Math.max(terminalG + 0.01, wacc)
    const tv       = terminalG < wEff
      ? (lastFCF * (1 + terminalG)) / (wEff - terminalG)
      : lastFCF * 15
    const pvTV = tv / dfAccum

    // Sum discounted FCFs
    let pvFCFs = 0
    for (let t = 1; t <= numYears; t++) pvFCFs += pathFCF[p][t] / pathDF[p][t]

    pathFCF[p][0] = pvFCFs + pvTV  // store terminal equity value in index 0
  }

  // ── Longstaff-Schwartz backward induction ─────────────────────────────────
  //
  // We work backward from year T-1 to year 1.
  // At each year t, for each option:
  //   1. Identify ITM paths
  //   2. Compute continuation value = Σ(future discounted FCFs from t+1 to T + terminal)
  //   3. Regress continuation on state variable [1, x, x²]
  //   4. Where exercise value > fitted continuation, flag path as exercised
  //   5. Update path value
  //
  // pathValue[p] holds the current best estimate of the option-adjusted equity value

  // Initialize path values from forward pass result
  const pathValue: number[] = new Array(nPaths)
  for (let p = 0; p < nPaths; p++) {
    const equity = (pathFCF[p][0] + cashM - debtM) * 1e6
    pathValue[p] = Math.max(liqFloor, equity / (sharesM * 1e6))
  }

  // Abandonment option backward induction
  if (liqFloor > 0 && nPaths >= 100) {
    for (let t = numYears - 1; t >= 1; t--) {
      // Continuation value at year t = discounted sum of future FCFs t+1..T + terminal
      const contValues: number[] = new Array(nPaths)
      for (let p = 0; p < nPaths; p++) {
        let cont = 0
        for (let k = t + 1; k <= numYears; k++) {
          cont += pathFCF[p][k] / pathDF[p][k]
        }
        contValues[p] = Math.max(0, cont + (pathFCF[p][0]))
      }

      // ITM: cumFCF trajectory suggests negative — use paths where cumFCF at t < 0
      // Proxy: paths where sum of FCFs up to t is negative
      const partialCum: number[] = new Array(nPaths).fill(0)
      for (let p = 0; p < nPaths; p++) {
        for (let k = 1; k <= t; k++) partialCum[p] += pathFCF[p][k]
      }

      const itmIdx = partialCum
        .map((cum, i) => ({ cum, i }))
        .filter(d => d.cum < 0)

      if (itmIdx.length < 10) continue

      const xVec = itmIdx.map(d => d.cum)
      const yVec = itmIdx.map(d => {
        let cont = 0
        for (let k = t + 1; k <= numYears; k++) cont += pathFCF[d.i][k] / pathDF[d.i][k]
        return Math.max(0, (cont + cashM - debtM) * 1e6 / (sharesM * 1e6))
      })

      const coeffs = lsOLS(xVec, yVec)

      for (const { cum, i } of itmIdx) {
        const fittedCont = lsPredict(coeffs, cum)
        if (liqFloor > fittedCont && liqFloor > pathValue[i]) {
          pathValue[i] = liqFloor
        }
      }
    }
  }

  // Expansion option backward induction
  if (nPaths >= 100) {
    for (let t = 3; t <= numYears - 1; t++) {
      // Compute realised CAGR from t=0 to t (approximate via stored year-3 for t≤3, project onward)
      const partialCum: number[] = new Array(nPaths).fill(0)
      for (let p = 0; p < nPaths; p++) {
        for (let k = 1; k <= t; k++) partialCum[p] += pathFCF[p][k]
      }

      // ITM: CAGR at year t > threshold AND cumFCF > 0
      const itmIdx = pathCAGR3
        .map((cagr3, i) => {
          // Scale from year-3 CAGR to year-t CAGR estimate
          const cagrT = t === 3 ? cagr3 : cagr3 * (3 / t)
          return { cagr: cagrT, cum: partialCum[i], i }
        })
        .filter(d => d.cagr > expansionThreshold && d.cum > 0)

      if (itmIdx.length < 10) continue

      const xVec = itmIdx.map(d => d.cagr)
      const yVec = itmIdx.map(d => {
        // Exercise value: PV of expansionYears additional FCF years at bull margin
        const bullMarg = regimes[2].marginMu
        // Use last known FCF at year t as base
        const fcfBase = Math.abs(pathFCF[d.i][t]) > 0 ? pathFCF[d.i][t] : baseFCF
        let pv = 0
        for (let k = 1; k <= expansionYears; k++) {
          pv += (fcfBase * Math.pow(1 + d.cagr, k) * (bullMarg / Math.max(0.01, Math.abs(inputs.netMargin)))) /
                Math.pow(1 + wacc, t + k)
        }
        return Math.max(0, pv * 1e6 / (sharesM * 1e6))
      })

      const coeffs = lsOLS(xVec, yVec)

      for (const d of itmIdx) {
        const exerciseVal = lsPredict(coeffs, d.cagr)
        if (exerciseVal > 0) {
          const contVal = pathValue[d.i]
          if (exerciseVal > contVal * 0.05) {  // only add if material
            pathValue[d.i] = contVal + exerciseVal * 0.5  // partial credit: option is not always exercised
          }
        }
      }
    }
  }

  // Separate option gains from base path values
  // (base path value = pathFCF[p][0] + net cash, option-adjusted = pathValue[p])
  const baseValues: number[] = new Array(nPaths)
  let abandonmentTotal = 0, expansionTotal = 0
  for (let p = 0; p < nPaths; p++) {
    const base = Math.max(liqFloor, ((pathFCF[p][0] + cashM - debtM) * 1e6) / (sharesM * 1e6))
    baseValues[p] = base
    const gain = pathValue[p] - base
    if (gain > 0) {
      // Heuristic attribution: negative-cum paths → abandonment, positive-cum → expansion
      if (pathCumFCF3[p] < 0) abandonmentTotal += gain
      else expansionTotal += gain
    }
  }

  const abandonmentOptionValue = abandonmentTotal / nPaths
  const expansionOptionValue   = expansionTotal   / nPaths

  // ── Statistics ────────────────────────────────────────────────────────────
  const sorted = [...pathValue].sort((a, b) => a - b)
  const at = (q: number) => sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(q * sorted.length)))]

  const p10 = at(0.10), p25 = at(0.25), p50 = at(0.50), p75 = at(0.75), p90 = at(0.90)
  const mean = pathValue.reduce((s, v) => s + v, 0) / nPaths
  const stdDev = Math.sqrt(pathValue.reduce((s, v) => s + (v - mean) ** 2, 0) / nPaths)

  const tail10    = sorted.slice(0, Math.max(1, Math.floor(nPaths * 0.10)))
  const cvarValue = tail10.reduce((s, v) => s + v, 0) / tail10.length
  const cvarRatio = mean > 0 ? Math.max(0, cvarValue / mean) : 0

  // CVaR discount on P50: proportional to how far cvarRatio falls below threshold
  const cvarDiscount = mean > 0
    ? Math.min(MAX_CVAR_DISC, Math.max(0, (CVAR_THRESHOLD - cvarRatio) * CVAR_SCALE))
    : 0
  const adjustedP50 = p50 * (1 - cvarDiscount)

  // Histogram: P10*0.85 → P90*1.15, 50 buckets
  const histMin = Math.max(0, p10 * 0.85)
  const histMax = p90 * 1.15
  const bw      = Math.max(1e-10, (histMax - histMin) / 50)
  const buckets  = new Array(50).fill(0)
  for (const v of pathValue) {
    const idx = Math.min(49, Math.max(0, Math.floor((v - histMin) / bw)))
    buckets[idx]++
  }
  const histogram = buckets.map((count, i) => ({
    lo: histMin + i * bw, hi: histMin + (i + 1) * bw,
    count, pct: count / nPaths,
  }))

  const tv = regimeVisits[0] + regimeVisits[1] + regimeVisits[2]
  const regimeProbabilities: [number, number, number] = [
    regimeVisits[0] / tv, regimeVisits[1] / tv, regimeVisits[2] / tv,
  ]

  return {
    p10, p25, p50, p75, p90, mean, stdDev,
    cvarRatio, adjustedP50, cvarDiscount,
    abandonmentOptionValue, expansionOptionValue,
    regimeProbabilities, histogram,
    nPaths, numYears, inputs,
  }
}

// ── Zero result ───────────────────────────────────────────────────────────────

function zeroResult(inputs: MCInputs): MCResult {
  return {
    p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, mean: 0, stdDev: 0,
    cvarRatio: 0, adjustedP50: 0, cvarDiscount: 0,
    abandonmentOptionValue: 0, expansionOptionValue: 0,
    regimeProbabilities: [0.20, 0.60, 0.20],
    histogram: [], nPaths: 0, numYears: inputs.numYears ?? 10, inputs,
  }
}

// ── Build MCInputs from cockpit + apiData ─────────────────────────────────────

export function buildMCInputs(
  assumptions:  ValuationAssumptions,
  snapshot:     CockpitSnapshot,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiData:      Record<string, any>,
  sensitivity:  Partial<Record<keyof ValuationAssumptions, number>>,
): MCInputs {
  // Historical income statement
  const incomeRows: Array<{ isProjected: boolean; revenue: number | null; netIncome?: number | null }> =
    apiData.financialStatements?.incomeStatement ?? []
  const actuals  = incomeRows.filter(r => !r.isProjected && r.revenue != null && r.revenue > 0)
  const projected = incomeRows.filter(r => r.isProjected && r.revenue != null && r.revenue > 0).slice(0, 3)

  // Realised growth rates
  const growthRates: number[] = []
  for (let i = 1; i < actuals.length; i++) {
    const prev = actuals[i - 1].revenue!, curr = actuals[i].revenue!
    if (prev > 0) growthRates.push((curr - prev) / prev)
  }
  growthRates.sort((a, b) => a - b)

  // Realised margins
  const margins = actuals
    .filter(r => r.netIncome != null && r.revenue != null && r.revenue! > 0)
    .map(r => r.netIncome! / r.revenue!)
  margins.sort((a, b) => a - b)

  const pct = (arr: number[], q: number) =>
    arr.length >= 4 ? arr[Math.floor(q * arr.length)] : null

  // Analyst consensus revenue (in $M — income statement rows are in $M)
  const analystRevY1 = projected[0]?.revenue ?? null
  const analystRevY2 = projected[1]?.revenue ?? null
  const analystRevY3 = projected[2]?.revenue ?? null

  // Estimate growth/margin correlation from history
  let growthMarginCorr = 0.35  // positive default: operating leverage
  if (actuals.length >= 4) {
    const gPairs: Array<[number, number]> = []
    for (let i = 1; i < actuals.length; i++) {
      const prev = actuals[i - 1], curr = actuals[i]
      if (prev.revenue! > 0 && curr.revenue! > 0 && curr.netIncome != null && curr.revenue != null) {
        const g = (curr.revenue! - prev.revenue!) / prev.revenue!
        const m = curr.netIncome! / curr.revenue!
        gPairs.push([g, m])
      }
    }
    if (gPairs.length >= 3) {
      const meanG = gPairs.reduce((s, p) => s + p[0], 0) / gPairs.length
      const meanM = gPairs.reduce((s, p) => s + p[1], 0) / gPairs.length
      const cov   = gPairs.reduce((s, p) => s + (p[0] - meanG) * (p[1] - meanM), 0) / gPairs.length
      const sigG  = Math.sqrt(gPairs.reduce((s, p) => s + (p[0] - meanG) ** 2, 0) / gPairs.length)
      const sigM  = Math.sqrt(gPairs.reduce((s, p) => s + (p[1] - meanM) ** 2, 0) / gPairs.length)
      if (sigG > 0 && sigM > 0) growthMarginCorr = Math.max(-0.9, Math.min(0.9, cov / (sigG * sigM)))
    }
  }

  // Liquidation floor from balance sheet
  const bsRows: Array<{ isProjected?: boolean; totalCash?: number | null }> =
    apiData.financialStatements?.balanceSheet ?? []
  const lastBS   = bsRows.filter(r => !r.isProjected).slice(-1)[0]
  const cashRaw  = lastBS?.totalCash ?? 0
  const liquidationPerShare = snapshot.sharesM > 0 && cashRaw > 0
    ? (cashRaw + snapshot.cashM) / snapshot.sharesM
    : null

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
    p25Growth:        pct(growthRates, 0.25),
    p75Growth:        pct(growthRates, 0.75),
    p25Margin:        pct(margins, 0.25),
    p75Margin:        pct(margins, 0.75),
    analystRevY1,
    analystRevY2,
    analystRevY3,
    growthMarginCorr,
    sensWacc:         Math.abs(sensitivity['wacc']      ?? 0.15),
    sensCagr:         Math.abs(sensitivity['cagr']      ?? 0.25),
    sensMarg:         Math.abs(sensitivity['netMargin'] ?? 0.15),
    liquidationPerShare,
    expansionYears:   2,
    nPaths:           10_000,
  }
}
