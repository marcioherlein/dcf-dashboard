# Valuation Logic Audit

**Version:** 1.0.0  
**Date:** 2026-05-19  
**Auditor roles:** Financial Model Analyst (FMA), Code Consistency Model Analyst (CCMA), Data Layer Analyst (DLA), Adversarial Reviewer (AR)  
**Scope:** All valuation computation paths, data ingestion, formulas, model selection, and output formatting

---

## Executive Summary

The platform implements a sound multi-method DCF framework with Damodaran-aligned methodology. The core formulas are correct. The primary risks are in the **data layer** (silent fallbacks that produce wrong-looking-right output) and in **cross-session consistency** (no persistence of computed assumptions means the same ticker may get a different WACC or CAGR on each page load). Eight actionable fixes are prioritized below.

**Overall Risk Profile:**
| Category | Risk Level | Status |
|---|---|---|
| Core formulas (WACC, DCF, DDM) | Low | Correct |
| CAGR blending logic | Medium | Correct but complex; needs tests |
| Terminal value / Gordon Growth | Low | Correct with null propagation |
| FX conversion | Critical | Silent parity fallback |
| Beta regression | Medium | No Vasicek adjustment |
| Tax rate | Low | Fixed; was 55% ceiling, now 40% |
| Scores (Piotroski, Altman, Beneish) | Low | Correct null propagation |
| EV bridge (cash/debt) | Medium | Silent zero on missing balance sheet |
| Triangulation weights | Medium | Not transparent to user |
| Cross-session consistency | Medium | No persistence of computed values |

---

## 1. Data Ingestion Layer

### 1.1 Yahoo Finance Client

**File:** `lib/data/yahooClient.ts`

**Modules fetched per ticker:**
```
incomeStatementHistory, balanceSheetHistory, cashflowStatementHistory,
financialData, defaultKeyStatistics, summaryDetail,
earningsTrend, recommendationTrend, insiderTransactions,
summaryProfile, majorHoldersBreakdown
```

**Historical price data:** `yf.historical()` — daily for periods ≤1Y, weekly for 2Y+

| Field | Used For | Risk |
|---|---|---|
| `financialData.freeCashflow` | Base FCF | Medium — may be negative |
| `financialData.totalDebt` | WACC D/E, EV bridge | Medium — includes all debt |
| `financialData.operatingCashflow` | FCF fallback | Low |
| `financialData.totalRevenue` | CAGR base | Low |
| `financialData.netIncomeToCommon` | Financial sector FCF | Low |
| `financialData.returnOnEquity` | Fundamental growth | Low — ROE > 80% excluded |
| `financialData.earningsGrowth` | TTM CAGR signal | Low |
| `defaultKeyStatistics.beta` | WACC beta fallback | Medium |
| `defaultKeyStatistics.sharesOutstanding` | EV bridge, per-share calc | Low |
| `summaryDetail.marketCap` | D/E ratio | Low |
| `summaryDetail.dividendRate` | DDM | Low |
| `summaryDetail.payoutRatio` | Fundamental growth | Low |
| `earningsTrend.trend['+1y'].revenueEstimate.growth` | CAGR analyst source | High — primary input |
| `earningsTrend.trend['+2y'].revenueEstimate.growth` | CAGR analyst source | High |
| `incomeStatementHistory.[0].interestExpense` | Cost of debt | Low |
| `incomeStatementHistory.[0].incomeTaxExpense` | Tax rate | Low |
| `incomeStatementHistory.[0].incomeBeforeTax` | Tax rate | Low |
| `balanceSheetHistory.[0].cash` | EV bridge cash | Low — silent zero |
| `balanceSheetHistory.[0].longTermDebt` | Financial sector D/E cap | Low |

**Known bugs:**
1. `close: p.close ?? p.adjClose ?? 0` in `app/api/historical/route.ts` — silent zero substitution for missing prices corrupts beta regression
2. `getFXRate()` returns 1.0 on API failure — **critical** for non-USD companies (see §1.3)

### 1.2 FRED Client

**File:** `lib/data/fredClient.ts`

Fetches:
- `TNX` (10Y Treasury yield) — used as rfRate
- `DGS2` (2Y Treasury yield) — used in market context model alerts
- `BAMLH0A0HYM2` (HY OAS spread) — market context

**Known issue (fixed):** Original code returned `4.29` (percent) when the API call failed — `fredClient.test.ts` documents this was fixed to return `0.0429` (decimal).

**Fallback chain for rfRate:** FRED → Yahoo ^TNX → hardcoded `0.0429`
- The hardcoded fallback is stale and silent. No timestamp or warning is surfaced.

### 1.3 FX Rate (Critical Risk)

**File:** `lib/data/yahooClient.ts` — `getFXRate(fromCurrency, toCurrency)`

```
Attempt 1: yf.quote(`${from}${to}=X`)       → direct pair
Attempt 2: yf.quote(`${to}${from}=X`)       → inverted pair  
Attempt 3: yf.quote(`${from}USD=X`)         → legacy format
All fail  → return 1.0                       ← SILENT PARITY FALLBACK
```

**Impact:** ARS/USD ≈ 900:1. If fallback triggers for a YPF or VIST valuation, all local-currency income statement values are divided by 1 instead of 900, producing equity values ~900× too large. This produces a result that looks numerically plausible but is completely wrong.

**Recommended fix:**
```typescript
// getFXRate should throw or return null:
export async function getFXRate(from: string, to: string): Promise<number | null> {
  // ... attempts ...
  return null  // never silently return 1.0
}
// Caller must handle null:
if (fxRate == null) {
  return NextResponse.json({ error: `FX rate ${from}/${to} unavailable` }, { status: 503 })
}
```

---

## 2. WACC Computation

**File:** `lib/dcf/calculateWACC.ts`

### 2.1 Formula

```
Ke = rfRate + β × (ERP + CRP)
Kd_net = costOfDebt × (1 - taxRate)
E/V = 1 / (1 + D/E)
D/V = D/E / (1 + D/E)
WACC = (E/V) × Ke + (D/V) × Kd_net
```

**Status:** Correct. Matches Damodaran WACC formula. ERP = 4.6% (Jan 2025). CRP from country risk table.

### 2.2 Beta Sourcing

Priority: regression (5Y weekly vs SPY) → Yahoo beta → 1.0 fallback.

The regression correctly uses `Cov(R_stock, R_SPY) / Var(R_SPY)` via OLS. No Vasicek/Blume adjustment is applied.

**Vasicek shrinkage (missing):**
```
β_adj = w × β_OLS + (1 - w) × 1.0
where w = Var(β) / (Var(β) + estimation_error)
```
For illiquid or small-cap stocks, raw OLS beta is noisy. Typical industry practice (Bloomberg, FactSet) applies shrinkage toward 1.0.

### 2.3 Financial Sector Special Handling

For banks/insurers (detected by sector/industry regex):
- `totalDebt` uses `longTermDebt` only (deposit liabilities excluded)
- Hard cap: D/E ≤ 1.5 (`totalDebt = min(totalDebt, marketCap × 1.5)`)
- Rationale: Deposit liabilities are a product, not financial leverage. Without this cap, bank D/E would be 3–10×, collapsing WACC to ~4% and exploding DCF value.

**Status:** Correct approach, correctly implemented.

### 2.4 FX in WACC

Debt figures are in reporting currency; marketCap is in USD. FX applied to debt:
```typescript
totalDebt = fd.totalDebt * fxRate  // converts reporting currency to USD
```
If fxRate is 1.0 due to fallback (see §1.3), D/E is inflated ~900× for ARS companies → weight shifts almost entirely to debt → WACC collapses to ≈Kd × (1 - T) ≈ 3%.

---

## 3. CAGR Blending

**File:** `lib/dcf/projectCashFlows.ts` — `extractFCFInputs()`

### 3.1 Four-Source Blend

| Source | Description | Max Weight |
|---|---|---|
| Analyst FY+1/FY+2 | Yahoo earningsTrend revenue estimates | 55% |
| Fundamental growth | ROE × retention (Damodaran) | 30% |
| Historical 3Y CAGR | Revenue CAGR from income statements | 60% |
| TTM earnings growth | fd.earningsGrowth | 5% |

Weights are dynamic by analyst coverage tier:

| Coverage | Analyst | Fundamental | Historical | TTM |
|---|---|---|---|---|
| ≥10 analysts | 55% | 25% | 15% | 5% |
| 5–9 analysts | 45% | 25% | 25% | 5% |
| 1–4 analysts | 30% | 30% | 35% | 5% |
| 0 analysts | 0% | 35% | 60% | 5% |

Weights normalize to sum to 1.0. Missing sources (ROE outside valid range, TTM outlier) have their weight redistributed.

### 3.2 Convergence Discount

Applied when rawBlended > 20%:
```
blended = 0.20 + (rawBlended - 0.20) × 0.75  // 25% discount on excess
```
Rationale: Damodaran mean-reversion — sustained growth above 20% is exceptional.

### 3.3 Size-Based CAGR Caps

| Category | Cap |
|---|---|
| Financial sector | 12% |
| Foreign currency | 18% |
| Mega-cap (>$50B revenue) | 22% |
| Large-cap ($10B–$50B) | 28% |
| Mid-cap ($2B–$10B) | 38% |
| Small-cap (<$2B) | 55% |

### 3.4 Special Cases

**Foreign currency companies:**
- Historical CAGR zeroed (local-currency revenue inflated by CPI)
- Weight shifts to analyst estimates + fundamental growth
- Detection: `extractFCFInputs(financials, foreignCurrency=true)` — caller must pass correct flag

**Financial sector:**
- Historical CAGR computed from net income (not revenue)
- Analyst source uses EPS growth (not revenue growth)
- CAGR cap: 12%

### 3.5 Confidence Scoring

```
confidence = analystCoverageScore × 0.50
           + consistencyScore × 0.30      (exp(-|hist - analyst| × 3))
           + sourceBreadth × 0.20         (fraction of non-null sources)
```

Labels: High (>0.65), Medium (0.35–0.65), Low (<0.35)

**Status:** Formula is correct and well-documented. Main risk is absence of persistence — the same ticker will recompute CAGR on each page load and may get different values if analyst estimates are updated between sessions.

---

## 4. DCF Projection

**File:** `lib/dcf/projectCashFlows.ts` — `projectCashFlows()`

### 4.1 Two-Stage Model (default)

```
For t = 1 to 10:
  CF_t = CF_{t-1} × (1 + CAGR)
  PV_t = CF_t / (1 + WACC)^t

sumPV = Σ PV_t

Terminal Value (Gordon Growth):
  TV = CF_10 × (1 + terminalG) / (WACC - terminalG)
  PV_TV = TV / (1 + WACC)^10

EV = sumPV + PV_TV
```

### 4.2 Three-Stage Model (high-growth)

Stage 2 (years 6–10): linear CAGR fade from initial CAGR toward terminalG.

```
g_t = CAGR - (CAGR - terminalG) × (t - 5) / 5   for t = 6..10
```

### 4.3 Gordon Growth Violation Guard

When `WACC ≤ terminalG`:
- Returns `terminalValue: null`, `ev: null`, `terminalGrowthViolation: true`
- Propagated through `calculateFairValue()` as `fairValuePerShare: null`
- **Status:** Correctly handled. Null propagated, no garbage output.

**UI gap:** The `terminalGrowthViolation` flag is propagated to `FairValueResult` but may not surface a clear explanation to the user in all UI paths. Verify `ValuationTab.tsx` renders this as an explicit warning.

---

## 5. EV → Equity Bridge

**File:** `lib/dcf/calculateFairValue.ts`

```
equityValue_M = EV_M + cash_M - totalDebt_M
fairValuePerShare = equityValue_M / sharesOutstanding_M
upsidePct = (fairValuePerShare - currentPrice) / currentPrice
IRR = (fairValuePerShare / currentPrice)^(1/5) - 1   (5-year horizon)
```

**Status:** Formula correct. Key risks:
1. `cash_M` silently defaults to 0 if balance sheet missing → underestimates equity value
2. `totalDebt_M` depends on FX rate (see §1.3)
3. IRR uses hardcoded 5-year horizon regardless of projection length — should be parameterized

---

## 6. FCFE (Equity DCF)

**File:** `lib/dcf/calculateFCFE.ts`

Primary model for financial sector companies. Uses normalized net income as equity cash flow proxy.

```
FCFE_M = normalizedNetIncome × 0.85  (15% retention haircut)
```

Discounted at cost of equity (Ke), not WACC:
```
equityValue = Σ FCFE_t / (1 + Ke)^t + TV / (1 + Ke)^n
```

**Status:** Correct approach for financial companies. Main risk: 2-year average for normalizedNetIncome may be insufficient for cyclical banks (should use 5-year or through-cycle average).

---

## 7. DDM (Dividend Discount Model)

**File:** `lib/dcf/calculateDDM.ts`

```
DDM applicable when: dividendPerShare > 0 AND ddmApplicable = true

P = D1 / (Ke - g)
where D1 = dividendPerShare × (1 + terminalG)
```

**Status:** Correct Gordon Growth DDM. Minor risk: single-stage DDM may not capture near-term dividend growth before steady state. Two-stage DDM would be more accurate for growing dividend payers.

---

## 8. Multiples Cross-Check

**File:** `lib/dcf/calculateMultiples.ts`

Computes implied fair value from:
- P/E multiple (sectorForwardPE from Damodaran × EPS)
- EV/EBITDA multiple (sector median × EBITDA → equity bridge)
- EV/Revenue multiple (for pre-profit companies)
- P/B multiple (for financial companies)

Sector multiples sourced from Damodaran Jan 2025 industry data (embedded in `calculateMultiples.ts`).

**Blended multiples fair value:** weighted average of applicable multiple-implied values.

**Status:** Correct. Risk: multiples are hardcoded constants, not live peers — will drift as sector re-rates. Annual update required.

---

## 9. Model Triangulation

**File:** `lib/valuation/engine.ts` — `computeTriangulation()`

### 9.1 Weights by Company Type

| Company Type | FCFF | FCFE | DDM | Multiples |
|---|---|---|---|---|
| standard | 65% | — | — | 35% |
| financial | — | 65% | — | 35% |
| dividend | 50% | — | 15% | 35% |
| growth | 65% | — | — | 35% |
| startup | 60% | — | — | 40% |

### 9.2 Company Type Detection

**File:** `lib/dcf/detectCompanyType.ts`

| Type | Detection Criteria |
|---|---|
| financial | sector/industry contains bank/insurance/fintech etc. |
| dividend | dividendYield ≥ 2% AND payoutRatio ∈ (0.1, 0.9) |
| startup | revenue < $50M OR negative FCF AND revenue < $200M |
| growth | revenueGrowth > 15% AND not financial |
| standard | all others |

**Status:** Correct logic. Risk: regex-based sector detection may misclassify edge cases (e.g. fintech companies classified as financial when they should be growth).

### 9.3 Adapter vs Engine Consistency

The triangulated fair value is computed in two places:
1. `app/api/financials/route.ts` (adapter) — pre-computes and passes `triangulatedFairValue` in input
2. `lib/valuation/engine.ts` `computeTriangulation()` — fallback if adapter value is null/0

The engine fallback uses hardcoded weights (65/35) regardless of company type, while the adapter uses the proper type-specific weights. If the adapter is unavailable, the fallback may use wrong weights for financial or dividend companies.

**Recommended fix:** Remove the fallback inline computation in the engine; always require the adapter to populate `triangulatedFairValue`.

---

## 10. Validation Layer

**File:** `lib/valuation/validator.ts`

### 10.1 Hard Errors (block computation)

| Error | Condition |
|---|---|
| SHARES_ZERO | sharesOutstanding ≤ 0 |
| PRICE_ZERO | currentPrice ≤ 0 |
| WACC_TOO_LOW | wacc < 0.04 |
| WACC_TOO_HIGH | wacc > 0.35 |
| TERMINAL_GROWTH_VIOLATION | terminalG ≥ wacc |
| BASE_FCF_INVALID | baseFCF is NaN or not finite |

### 10.2 Warnings (allow computation, surface to user)

| Warning | Condition |
|---|---|
| HIGH_TERMINAL_GROWTH | terminalG > 0.05 |
| HIGH_TV_SHARE | terminal value > 85% of EV |
| HIGH_BETA | beta > 3.5 |
| LOW_BETA | beta < 0.3 |
| HIGH_DEBT | D/E > 3.0 |
| HIGH_UPSIDE_MAGNITUDE | |upside| > 200% |

**Status:** Solid coverage of the main pathological inputs. Missing: no warning when FX rate is the parity fallback (1.0 used for non-USD company).

---

## 11. Financial Quality Scores

**File:** `lib/dcf/calculateScores.ts`

### 11.1 Piotroski F-Score (0–9)

9 binary signals across three groups:
- Profitability: ROA > 0, CFO > 0, ΔROA > 0, Accruals < 0
- Leverage/Liquidity: ΔLeverage < 0, ΔCurrentRatio > 0, no new shares
- Operating Efficiency: ΔGrossMargin > 0, ΔAssetTurnover > 0

**Null handling:** Each test returns null when required data is unavailable. Score is null if any required component is null. No silent 0 substitution.

### 11.2 Altman Z-Score

```
Z = 1.2×X1 + 1.4×X2 + 3.3×X3 + 0.6×X4 + 1.0×X5
X1 = WorkingCapital / TotalAssets
X2 = RetainedEarnings / TotalAssets
X3 = EBIT / TotalAssets
X4 = MarketEquity / TotalLiabilities
X5 = Revenue / TotalAssets
```

Zones: Z > 2.99 Safe, 1.81–2.99 Gray, < 1.81 Distress

**Caveat (documented in code):** Model calibrated on 1968 manufacturing firms. Less predictive for asset-light tech/SaaS companies.

### 11.3 Beneish M-Score

8-variable manipulation detection. Requires 2 years of income statement history. Returns null for single-year data.

```
M > -1.78 → potential earnings manipulation flag
```

---

## 12. Assumption Transparency Layer

**File:** `lib/valuation/assumptions.ts`

Each assumption is tagged with `AssumptionSource` enum:
- `analyst` — from consensus estimates
- `3y_median` — from historical data
- `model` — computed by the model
- `fallback` — hardcoded constant

**Usage in UI:** `AssumptionPanel` component (components/stock/) renders these tags to show users where each number came from.

**Gap:** The `AssumptionSet` builds year-by-year arrays for revenue growth, EBIT margin, CapEx%, D&A%, and NWC%. The `buildAssumptionSet` function is called during the detailed FCF build-up path. However, the primary `extractFCFInputs()` path does not call `buildAssumptionSet()` — it computes CAGR independently. There is a risk of divergence between the CAGR shown in `AssumptionPanel` and the CAGR used in the actual DCF.

**Recommended fix:** Ensure `extractFCFInputs()` result feeds `buildAssumptionSet()` inputs, not vice versa.

---

## 13. Scenarios

**File:** `lib/dcf/calculateFairValue.ts` — `buildScenarios()`

```
Bull: WACC - 1%, CAGR + 2%, terminalG + 0.5%
Base: no change
Bear: WACC + 1%, CAGR - 2%, terminalG - 0.5%
```

Bear scenario enforces `terminalG ≥ 0` and `terminalG ≤ WACC - 0.005` to avoid Gordon Growth violation.

**Gap:** Scenario deltas are flat — they do not scale with uncertainty. A company with CAGR confidence "Low" should have wider scenario spread than one with confidence "High".

---

## 14. Risk Register and Priority Fixes

### P0 — Critical (data integrity risk)

| # | Issue | File | Fix |
|---|---|---|---|
| C1 | `getFXRate()` silently returns 1.0 on failure | `lib/data/yahooClient.ts` | Return `null`; surface error in API route |
| C2 | `close ?? adjClose ?? 0` silent zero for missing price | `app/api/historical/route.ts` | Filter out 0-price rows before regression |

### P1 — High (affects valuation accuracy)

| # | Issue | File | Fix |
|---|---|---|---|
| H1 | rfRate stale hardcoded fallback unsurfaced | `lib/data/fredClient.ts` | Cache last-known-good in Supabase; show staleness warning |
| H2 | No beta Vasicek adjustment | `lib/dcf/calculateBeta.ts` | Apply `β_adj = 0.67×β_OLS + 0.33×1.0` for small/mid-cap |
| H3 | Triangulation fallback weights ignore company type | `lib/valuation/engine.ts` | Remove fallback; require adapter to provide weights |
| H4 | CAGR not persisted — recomputed on every load | `app/api/financials/route.ts` | Cache computed CAGR in Supabase valuations row |

### P2 — Medium (transparency and UX)

| # | Issue | File | Fix |
|---|---|---|---|
| M1 | Gordon Growth violation renders '—' with no explanation | UI components | Surface explicit error: "Terminal growth ≥ WACC — reduce terminal growth or raise WACC" |
| M2 | Triangulation weights not shown in ValuationSummary | `components/valuation/ValuationSummary.tsx` | Expose `effectiveWeights` breakdown |
| M3 | Exit multiple defaults not anchored to Damodaran | `lib/valuation/assumptions.ts` | Compute from Damodaran industry EV/FCF medians |
| M4 | Tax rate uses single year — noisy for cyclical firms | `lib/dcf/calculateWACC.ts` | Use 3-year average |

### P3 — Low (quality improvements)

| # | Issue | File | Fix |
|---|---|---|---|
| L1 | IRR hardcoded 5-year horizon | `lib/dcf/calculateFairValue.ts` | Parameterize to match projection years |
| L2 | DDM single-stage only | `lib/dcf/calculateDDM.ts` | Two-stage DDM for growing dividend payers |
| L3 | EBIT margin expansion (+0.2%/yr) applied to all sectors | `lib/valuation/assumptions.ts` | Cap expansion for capital-intensive/mature sectors |
| L4 | Multiples are hardcoded Jan 2025 values | `lib/dcf/calculateMultiples.ts` | Add update script and last-updated timestamp |

---

## 15. Formula Reference Table

| Assumption | Formula | Source File | Confidence |
|---|---|---|---|
| WACC | `(E/V)×Ke + (D/V)×Kd×(1-T)` | `calculateWACC.ts` | High |
| Cost of Equity | `rf + β×(ERP + CRP)` | `calculateWACC.ts` | High |
| Beta | OLS regression vs SPY 5Y weekly | `calculateBeta.ts` | Medium |
| Historical CAGR | `(Rev_0/Rev_n)^(1/n) - 1` | `projectCashFlows.ts` | Medium |
| CAGR blend | `Σ w_i × source_i` normalized | `projectCashFlows.ts` | Medium |
| Terminal Value | `FCF_n×(1+g)/(WACC-g)` | `projectCashFlows.ts` | High |
| EV | `sumPV + PV_TV` | `projectCashFlows.ts` | High |
| Equity Value | `EV + cash - debt` | `calculateFairValue.ts` | High |
| Fair Value/Share | `equityValue / sharesOut` | `calculateFairValue.ts` | High |
| Fundamental growth | `ROE × (1 - payoutRatio)` | `projectCashFlows.ts` | Medium |
| Piotroski | 9-signal binary scoring | `calculateScores.ts` | High |
| Altman Z | `1.2X1+1.4X2+3.3X3+0.6X4+1.0X5` | `calculateScores.ts` | Medium |
| DDM | `D1 / (Ke - g)` | `calculateDDM.ts` | High |

---

## Appendix: Key Constants

| Constant | Value | Source | Update Frequency |
|---|---|---|---|
| ERP | 4.6% | Damodaran Jan 2025 | Annual |
| VTS Theory | Fernandez 2007 | config | When capital structure assumptions change |
| Projection years | 10 | Hardcoded | — |
| Convergence threshold | 20% | Damodaran | Annual |
| Convergence discount | 25% reduction on excess | Damodaran | Annual |
| Gordon Growth WACC buffer | 0.5% | config | — |
| Scenario WACC delta | ±1% | config | — |
| Scenario CAGR delta | ±2% | config | — |
| Financial D/E cap | 1.5× | config | — |
| Cost of debt cap | 15% | hardcoded | — |
| Tax rate floor | 5% | hardcoded | — |
| Tax rate ceiling | 40% | hardcoded | Changed from 55% |
