# Consistency Matrix

**Version:** 1.0.0  
**Date:** 2026-05-19  
**Purpose:** Documents cross-stock, cross-method consistency requirements, known inconsistency risks, and the enforcement mechanisms (or absence thereof) for each valuation assumption.

---

## 1. Overview

A "consistency failure" occurs when:
- The same assumption for the same ticker produces different values on different page loads (session-to-session drift)
- Two different valuation methods use the same input field but read it from different sources
- The UI displays an assumption value that differs from the value actually used in computation

This matrix covers: CAGR, WACC, terminal growth, EV bridge (cash/debt/shares), multiples benchmarks, financial sector flags, and company type detection.

---

## 2. Cross-Session Consistency (Same Ticker, Different Load)

| Assumption | Persistent? | Drift Risk | Cause |
|---|---|---|---|
| CAGR | No | High | Analyst estimates update daily; blending weights depend on numAnalysts count which changes |
| WACC | No | Medium | rfRate fetched live from FRED; beta regression runs fresh each load |
| terminalG | No | Low | Deterministic from CAGR (rule-based) — same CAGR → same terminalG |
| companyType | No | Medium | Growth threshold: CAGR > 20% → if CAGR drifts from 19.8% → 20.2%, company type flips growth↔standard |
| baseFCF | No | Low | Yahoo fundamentals update quarterly; stable between earnings |
| beta | No | Low | 5Y weekly regression — stable week-to-week |
| multiples benchmarks | N/A | None | Hardcoded Damodaran Jan 2025 — same every load until next manual update |
| fxRate | No | Medium | Daily spot rate; can move 0.5–2% for EM currencies |

**Root Cause:** No valuation assumptions are persisted to Supabase at compute time. The `valuations` table stores the user's saved output (fair value, upside) but not the intermediate computed inputs (blended CAGR, WACC components, beta, terminalG).

**Impact:** A user who saves a valuation on Monday and returns Friday may see different inputs and a different fair value for the same ticker — without any indication that the inputs changed.

**Recommended Fix:**
```sql
-- Add to valuations table:
ALTER TABLE valuations ADD COLUMN computed_cagr        float;
ALTER TABLE valuations ADD COLUMN computed_wacc        float;
ALTER TABLE valuations ADD COLUMN computed_terminal_g  float;
ALTER TABLE valuations ADD COLUMN computed_beta        float;
ALTER TABLE valuations ADD COLUMN computed_at          timestamptz DEFAULT now();
ALTER TABLE valuations ADD COLUMN rf_rate_used         float;
ALTER TABLE valuations ADD COLUMN fx_rate_used         float;
```

---

## 3. Intra-Method Consistency (Same Ticker, Different Methods)

### 3.1 WACC vs Ke (used in FCFF vs FCFE/DDM)

Both FCFF and FCFE/DDM use rfRate, beta, ERP, and CRP from the same `extractWACCInputs()` call.
FCFF uses WACC; FCFE and DDM use cost of equity (Ke) only.

| Flow | Discount Rate | Risk |
|---|---|---|
| FCFF DCF | WACC | Low |
| FCFE proxy | Ke (= rfRate + β × (ERP + CRP)) | Low — same inputs |
| DDM | Ke | Low — same inputs |

**Status:** Consistent. All three methods derive rates from the same WACC computation object.

### 3.2 terminalG in FCFF vs DDM

FCFF uses `terminalG` from VALUATION_CONFIG based on CAGR tier.
DDM uses the same `terminalG` value.

**Risk:** If the user edits WACC/CAGR in the ValuationLab but not terminalG, the FCFF terminal value is recalculated but DDM still uses the original terminalG. This is mitigated by the `guardTerminalGrowth()` clamp (terminalG ≤ WACC - 0.005).

### 3.3 Shares Outstanding (EV Bridge vs Per-Share)

Shares used in `calculateFairValue()` come from `defaultKeyStatistics.sharesOutstanding` (basic).
Some multiples computations use diluted shares from Yahoo.

**Risk:** If basic shares ≠ diluted shares (significant for high-SBC companies), the DCF per-share value is overstated vs the multiples per-share value.

**Recommended Fix:** Use diluted shares consistently: `defaultKeyStatistics.impliedSharesOutstanding` or compute from diluted EPS ÷ net income.

---

## 4. Cross-Stock Consistency (Same Sector, Different Tickers)

### 4.1 Multiples Benchmarks

All tickers in the same industry string receive identical INDUSTRY_MEDIANS benchmarks. Peer group (PEER_TICKERS) is also the same for every ticker in the industry.

**Consistency gap:** A semiconductor stock and a semiconductor equipment stock both categorized under 'Semiconductors' get the same PE multiple (26×). They should differ (equipment is typically 22×).

**Actual state:** The INDUSTRY_MEDIANS table already has separate entries for `Semiconductors` and `Semiconductor Equipment & Materials`. Consistency requires that Yahoo returns the exact industry string used as the key. If Yahoo returns `Semiconductor Equipment` (without `& Materials`), the lookup falls through to `SECTOR_MEDIANS['Technology']` = 28× PE instead of 22×.

**Test coverage needed:** For each ticker with a known industry, assert `getIndustryMultiples(industry, sector).pe` returns the expected value. See Phase 4 test suite.

### 4.2 Company Type Detection

Company type is detected by two independent inputs:
1. `historicalCagr3y` and `analystEstimate1y` (from CAGR blend)  
2. `dividendYield` and `payoutRatio` (from Yahoo summaryDetail)

Because CAGR is computed live, a company near a threshold (e.g. CAGR ≈ 20%) may flip between `growth` and `standard` across sessions.

**Impact on fair value:** Triangulation weights differ:

| Type | FCFF | FCFE | DDM | Multiples |
|---|---|---|---|---|
| standard | 65% | 0% | 0% | 35% |
| growth | 65% | 0% | 0% | 35% |
| dividend | 30% | 0% | 50% | 20% |
| startup | 30% | 0% | 0% | 70% |
| financial | 5% | 65% | 0% | 30% |

For standard vs growth, the weights are identical — so CAGR threshold doesn't affect triangulation. The real risk is standard → dividend or standard → startup transitions.

**Current threshold table:**

| Condition | Detected Type | Priority |
|---|---|---|
| sector/industry matches financial regex | financial | 1 (highest) |
| dividendYield > 1% AND payoutRatio > 20% | dividend | 2 |
| isNegativeFCF AND revenueM < 500 | startup | 3 |
| historicalCagr3y > 20% OR analystEstimate1y > 20% | growth | 4 |
| else | standard | 5 |

### 4.3 FX Rate Cross-Stock

For two companies with the same reporting currency (e.g. ARS), each request calls `getFXRate('ARS', 'USD')` independently. In normal operation, both return the same spot rate. If the first call succeeds and the second call fails (timeout), the first ticker gets the real rate and the second gets 1.0.

**Recommended Fix:** Cache fxRate per currency pair in memory for 5 minutes within the same API route execution. The existing `app/api/financials/route.ts` could use a module-level `Map<string, {rate: number, fetchedAt: number}>`.

---

## 5. UI ↔ Computation Consistency

### 5.1 AssumptionPanel vs Actual CAGR Used

The `buildAssumptionSet()` function in `lib/valuation/assumptions.ts` receives `cagr` from `extractFCFInputs()` and builds per-year growth arrays. The assumption panel labels show "Analyst FY+1" or "Blended CAGR."

**Risk:** If the user edits CAGR in the UI (via AssumptionSlider), the slider value goes to `ValuationLab` state, which calls `runValuationEngine()` with the new value. However, `buildAssumptionSet()` is called with the original computed CAGR from the adapter, not the user-edited value. The per-year revenue growth array in the assumption panel may show the old value while the DCF uses the new value.

**Verification needed:** Check `ValuationModelDrawer.tsx` → `AssumptionSlider` → `ValuationLab` state → `runValuationEngine()` input chain to confirm user edits flow through correctly.

### 5.2 Displayed Upside vs Triangulated Upside

The UI renders `triangulated.upsidePct` for the main upside badge. In some card components (e.g. `ValuationMethodCard`), individual method upsides (FCFF, DDM, multiples) are shown separately.

If the weights are not shown to the user, they cannot understand why the triangulated upside differs from any individual method upside. This is a transparency gap, not a computation bug.

---

## 6. Consistency Enforcement Checklist

| Requirement | Status | Evidence |
|---|---|---|
| All methods use same Ke | ✅ Consistent | Both FCFE and DDM use `input.costOfEquity` from same WACC computation |
| All methods use same terminalG | ✅ Consistent | Passed through `ValuationInput.terminalG` |
| FCFF EV bridge uses same cash/debt as FCFE | ✅ Consistent | Both read from same `ValuationInput.cashM`, `totalDebtM` |
| FX rate applied to debt before D/E | ✅ Consistent | `extractWACCInputs` applies fxRate to totalDebt |
| Financial sector detection same in WACC and CAGR | ✅ Consistent | Same regex used in both `calculateWACC.ts` and `projectCashFlows.ts` |
| Company type detection feeds triangulation weights | ✅ Consistent | `detectCompanyType.ts getModelWeights()` feeds adapter |
| CAGR persisted across sessions | ❌ Missing | No Supabase write of computed inputs |
| FX rate cached within request | ❌ Missing | Independent calls per ticker |
| Diluted vs basic shares consistent | ⚠️ Warning | Basic shares used in DCF, may differ from diluted |
| Assumption panel shows values actually used in DCF | ⚠️ Warning | User edits to CAGR may not update per-year arrays |

---

## 7. Numeric Precision Consistency

All final values are rounded to 4 decimal places for rates and 2 decimal places for prices:
```typescript
wacc: Math.round(wacc * 10000) / 10000    // 4dp
fairValuePerShare: Math.round(fv * 100) / 100  // 2dp
upsidePct: Math.round(upsidePct * 1000) / 1000  // 3dp
```

This is consistent across all computation files. No rounding inconsistency detected.

---

## 8. Summary: Top 5 Consistency Gaps

| Rank | Gap | Risk | Fix |
|---|---|---|---|
| 1 | CAGR/WACC not persisted — drift between sessions | High | Persist computed inputs in Supabase |
| 2 | FX rate 1.0 parity fallback — silent corruption | Critical | Return null from getFXRate(); abort computation |
| 3 | Basic vs diluted shares — per-share value discrepancy | Medium | Use diluted shares consistently |
| 4 | companyType CAGR threshold instability | Medium | Persist companyType in Supabase alongside computed inputs |
| 5 | AssumptionPanel per-year arrays may not reflect user edits | Medium | Verify slider edit propagation to buildAssumptionSet() |
