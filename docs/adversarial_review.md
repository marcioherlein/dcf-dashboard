# Adversarial Review

**Version:** 1.0.0  
**Date:** 2026-05-19  
**Role:** Adversarial Reviewer (AR)  
**Purpose:** Documents vulnerabilities, attack scenarios, edge cases, and remaining gaps from adversarial testing of the valuation platform.

---

## 1. Methodology

Adversarial testing approach: attempt to produce wrong-looking-right, plausible-but-incorrect, or silently degraded valuations by:
1. Providing boundary-condition inputs
2. Triggering API fallback paths
3. Combining multiple failure modes simultaneously
4. Testing assumptions about data quality guarantees

---

## 2. Critical Vulnerabilities (P0)

### V1: FX Parity Silent Corruption

**Scenario:** Yahoo Finance FX pair lookup fails for all three attempts (direct, inverse, legacy).

**What happens:** `getFXRate()` returns `1.0` silently.

**Effect:**
- For an Argentine company (ARS/USD ≈ 900):
  - Total debt in USD appears 900× larger → D/E ratio ~900× inflated
  - WACC collapses to ≈ Kd × (1 - T) ≈ 3.5% (all weight on debt)
  - DCF terminal value with WACC = 3.5% and g = 2%: TV = FCF / (0.035 - 0.02) = FCF / 0.015 → ~67× FCF instead of ~14× FCF
  - Final equity value ≈ 5–10× true value

**Detectability:** None. The output looks plausible — a high equity value with a low WACC could be dismissed as "this is an undervalued EM company."

**Test coverage:** `lib/dcf/__tests__/adversarial.test.ts` documents but cannot test in unit form (requires mocking Yahoo Finance).

**Fix:**
```typescript
// getFXRate must not return 1.0 on failure:
export async function getFXRate(from: string, to: string): Promise<number | null> {
  // ... attempts ...
  return null
}
// Caller in app/api/financials/route.ts:
const fxRate = await getFXRate(reportingCurrency, 'USD')
if (fxRate === null && reportingCurrency !== 'USD') {
  return NextResponse.json({ error: `FX data unavailable for ${reportingCurrency}/USD` }, { status: 503 })
}
```

---

### V2: Historical Price Zero Substitution in Beta Regression

**Scenario:** Yahoo historical API returns a week with no closing price (delisting, trading halt, or API gap). The code uses `p.close ?? p.adjClose ?? 0`.

**What happens:** A zero is substituted for the closing price. The weekly return computed as `(0 / prevPrice) - 1 = -100%` introduces a massive negative return into the beta regression.

**Effect:** Beta is significantly underestimated (single -100% return in 5Y weekly history ≈ 260 observations → massive outlier reduces covariance).

**Example:**
- Stock with true beta 1.5
- One zero-price substitution with previous price $100 → return of -100%
- Regression beta may compute to 0.8–1.0 instead of 1.5
- Lower beta → lower Ke → lower WACC → higher DCF value

**Fix:**
```typescript
// In app/api/historical/route.ts, filter before returning:
const cleaned = history.filter((p) => {
  const price = p.close ?? p.adjClose
  return price != null && price > 0
})
```

---

## 3. High Vulnerabilities (P1)

### V3: rfRate Stale Hardcoded Fallback

**Scenario:** Both FRED API and Yahoo Finance ^TNX fail (network partition, API rate limit).

**What happens:** rfRate defaults to hardcoded `0.0429` (4.29%) — the rate from a specific date, not the current rate.

**Effect in high-rate environment (rates at 6%):**
- rfRate understated by 1.71%
- Ke = 0.0429 + β × (0.046 + CRP) instead of 0.06 + ...
- For β = 1.2: Ke understated by 1.71% × 1.0 = 1.71%
- WACC understated by ~1.2–1.5%
- DCF terminal value: TV at WACC=7.5% vs TV at WACC=9% ≈ 20% overstatement

**No alert to user.** The valuation proceeds and presents a result.

**Fix:** Cache last-known-good rfRate in Supabase. On API failure, use cached rate but display a staleness banner:
```
⚠️  Risk-free rate is using cached data from [date]. Current live rate unavailable.
    Cached rate: 4.29%. Update your valuation after connectivity is restored.
```

---

### V4: Dual-Listed Company Misclassification

**Scenario:** A company is dual-listed on NYSE (USD) and a local exchange (local currency). Yahoo returns data for the NYSE ticker, but the balance sheet is reported in local currency.

**What happens:** `extractFCFInputs(financials, foreignCurrency=false)` is called because the user searched for the NYSE ticker — the caller did not flag it as foreign currency.

**Effect:** Historical revenue CAGR is computed in local currency (inflation-distorted). For Argentine companies, this can be +70% in ARS vs +3% in USD.

**Specific example:** YPF is listed on NYSE as YPF (USD-quoted) but reports financials in ARS. If `foreignCurrency=false`, historical CAGR reflects 70% nominal ARS revenue growth, not real USD growth.

**Current behavior:** The `foreignCurrency` flag is set based on `summaryDetail.currency !== 'USD'` (or similar logic in the API route). If the currency detection logic fails or the flag is not passed, the CAGR will be wrong.

**Fix:** Always check `summaryProfile.reportingCurrency` from Yahoo and pass to `extractFCFInputs` automatically. Do not rely on caller to set this flag.

---

### V5: Company Type Detection CAGR Threshold Instability

**Scenario:** A standard company's analyst estimate fluctuates around 20% between sessions.

**Effect:**
- Session A: analystEstimate1y = 19.8% → companyType = 'standard' → WACC in denominator for FCFF
- Session B: analystEstimate1y = 20.2% → companyType = 'growth' → same weights (65%/35%) but `growthModel = 'three-stage'`

For the growth type, the three-stage model's linear fade in years 6–10 reduces terminal FCF, which reduces terminal value and thus fair value.

**Fair value change from type flip:** ~5–8% reduction in fair value when flipping standard → growth (three-stage reduces TV).

**This is a legitimate model behavior, not a bug** — but it's invisible to users who don't know why their fair value changed.

**Fix:** Display `growthModel` ("Two-Stage" or "Three-Stage") in the assumption panel.

---

## 4. Medium Vulnerabilities (P2)

### V6: Normalization Smoothing for Cyclical Companies

**Scenario:** A cyclical company (mining, shipping, energy) at the peak of its cycle. `baseFCF` and `normalizedNetIncomeM` use the most recent 1–2 years, which are peak-cycle earnings.

**Effect:** Base FCF is set to peak earnings. The DCF projects this peak FCF growing at CAGR for 10 years → severely inflated fair value.

**Example:** An energy company in 2022 with $5B FCF (peak oil prices). `baseFCF = $5B`. 10-year DCF with 5% CAGR → terminal FCF ≈ $8B → TV ≈ $115B. But normalized through-cycle FCF might be $2B → TV ≈ $46B.

**Mitigation already in place:** `normalizedNetIncomeM` averages 2 years for financial sector. But for standard/energy companies, baseFCF uses only the most recent year.

**Fix:** Offer a "through-cycle normalization" toggle that uses median of 3-year FCF history.

---

### V7: Piotroski Score for Asset-Light Tech Companies

The original Piotroski model was calibrated on manufacturing companies. For pure-software SaaS companies:
- No inventory turnover improvement means the asset turnover signal can flag a false negative
- Working capital dynamics are different (upfront subscription revenue, deferred revenue)

**Effect:** A high-quality SaaS company with score 6/9 may appear "weaker" than a mediocre manufacturer with score 7/9.

**Current state:** The Piotroski score is computed and displayed. There is no adjustment for company type or sector.

**Fix (P3):** Add a `sector_adjusted_score` that excludes the inventory and asset-turnover signals for asset-light companies.

---

### V8: Altman Z-Score for Modern Asset-Light Tech

The 1968 Altman model was calibrated on manufacturing companies with high tangible assets. For companies where most value is in intellectual property or network effects:
- `X4 = marketEquity / totalLiabilities` can be extremely high → inflates Z-score
- These companies "score safe" on Altman even when they're burning cash

**Effect:** A pre-profitability SaaS with $50B market cap and $1B liabilities → `X4 = 50` → Z-score ≈ 30+, firmly "safe" — even if burning $1B/year.

**Current state:** Altman Z-score is computed and displayed. No caveats for asset-light companies.

**Fix:** Add a note in UI when companyType = 'startup' or 'growth': "Z-Score calibrated on 1968 manufacturing firms. Less predictive for asset-light tech companies."

---

## 5. Remaining Edge Cases (P3)

| Edge Case | Status | Notes |
|---|---|---|
| Company with no analyst coverage, negative FCF, foreign currency | Tested | Falls back to `max(revenue × 0.02, 1)` FCF seed — flagged in UI |
| terminalG exactly equals WACC | Tested | Returns null EV + violation flag |
| Shares outstanding = 0 | Tested | Returns null fairValuePerShare |
| currentPrice = 0 | Tested | Returns null upsidePct |
| All multiples actual values = null | Tested | blendedFairValue = null |
| P/E = -1 (negative earnings) | Tested | applicable = false, excluded from blend |
| D/E > 3.0 | Documented in validator warnings | Not blocked, but warning surfaced |
| Beta > 3.5 | Documented in validator warnings | Not blocked |
| Two API calls for same currency pair in parallel | Not tested | Race condition; add module-level cache |

---

## 6. Testing Gaps

The following scenarios are not covered by existing unit tests and require integration tests or manual verification:

1. **Full round-trip for VIST (ARS company):** Verify fxRate is applied, CRP = 15.41%, foreignCurrency = true
2. **Full round-trip for JPM (financial company):** Verify longTermDebt used, D/E ≤ 1.5, FCFE is primary
3. **FRED API timeout simulation:** Verify rfRate fallback triggers staleness alert
4. **Yahoo earningsTrend absent:** Verify wAnalyst = 0 and weights normalize to historical/fundamental
5. **Beta regression with <52 weeks of data (recent IPO):** Verify Yahoo beta fallback activates
6. **Three-stage model with very low WACC (< CAGR):** Verify model doesn't produce nonsensical results

---

## 7. Summary: Vulnerability Priority Matrix

| ID | Vulnerability | Probability of Trigger | Impact | Priority |
|---|---|---|---|---|
| V1 | FX parity fallback | Low (API usually works) | Critical (900× error) | P0 |
| V2 | Historical price zero | Medium (data gaps occur) | High (beta distortion) | P0 |
| V3 | Stale rfRate hardcoded | Low-Medium | High (20% value error) | P1 |
| V4 | Dual-listed currency misclassification | Medium (EM companies) | High (CAGR inflation) | P1 |
| V5 | CompanyType CAGR threshold flip | Medium (~20% CAGR companies) | Medium (5-8% FV change) | P2 |
| V6 | Cyclical company peak FCF | Medium (energy, mining) | High (2-3× FV inflation) | P2 |
| V7 | Piotroski for SaaS | High (many SaaS companies) | Low (cosmetic score) | P3 |
| V8 | Altman Z for asset-light | High | Low (cosmetic score) | P3 |
