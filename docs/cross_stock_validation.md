# Cross-Stock Validation

**Version:** 1.0.0  
**Date:** 2026-05-19  
**Purpose:** Per-stock audit results documenting assumption derivation, known issues, and model appropriateness for representative tickers across sectors.

---

## Methodology

For each stock, we validate:
1. Company type detection — is the correct model applied?
2. CAGR sourcing — are the weights appropriate?
3. WACC components — are beta, CRP, D/E correct?
4. Special handling — financial sector, foreign currency, negative FCF?
5. Multiples benchmark — does the industry string match the table?
6. Known risks — what can go wrong for this specific ticker?

---

## NVDA — Nvidia Corporation

**Sector:** Technology | **Industry:** Semiconductors  
**Exchange:** NASDAQ (USD-quoted, USD-reporting)  
**Market Cap:** ~$2.5T (mega-cap)

### Company Type

| Criterion | Value | Outcome |
|---|---|---|
| Financial sector regex | No match | — |
| Dividend yield | ~0.03% (negligible) | dividend: NO |
| Negative FCF | No (strongly positive) | startup: NO |
| CAGR > 20% | FY+1 estimate: ~100%+, historical ~70% | growth: YES |

Expected company type: `growth`  
Expected growth model: `three-stage`  
Expected primary model: "DCF (FCFF) + EV Multiples"

### WACC

| Input | Expected Value | Source |
|---|---|---|
| rfRate | Live 10Y Treasury (~4.3%) | FRED/Yahoo ^TNX |
| Beta | ~1.7 (regression) | 5Y weekly vs SPY |
| ERP | 4.6% | Damodaran Jan 2025 |
| CRP | 0% (USD) | CRP_TABLE['USD'] |
| D/E | Very low (~0.02 – few billion debt vs $2.5T mktcap) | Yahoo |
| Ke | ~4.3% + 1.7×4.6% = ~12.1% | Computed |
| WACC | ~11.5–12% | Computed |

### CAGR

| Source | Expected Value | Weight (with ≥10 analysts) |
|---|---|---|
| Analyst FY+1 | 50–100%+ (AI supercycle) | 55% |
| Fundamental (ROE×retention) | ROE ~100% — excluded (>80%) | 0% |
| Historical 3Y | ~70% revenue CAGR | 15% |
| TTM earnings growth | ~100%+ | 5% |
| Size cap applied | 22% (mega-cap >$50B revenue) | — |
| Convergence discount | Applied (raw blend >> 20%) | — |

**Risk:** Size cap (22%) drastically compresses what is genuinely an exceptional growth company. NVDA's forward CAGR consensus is ~50% for FY2025. The size cap reduces this to 22% — a reasonable Damodaran-style conservative estimate, but users should understand this compression is by design.

### Multiples

| Multiple | Industry Median | Applied |
|---|---|---|
| P/E | 26× (Semiconductors) | ✅ |
| EV/EBITDA | 18× | ✅ |
| P/Sales | 6.0× | ✅ |
| EV/Revenue | 7.5× | ✅ |

With NVDA trading at P/E ~30-40× (well above 26×), the multiples cross-check will suggest the stock is expensive vs semiconductor peers — which is directionally correct (NVDA commands a premium).

### Known Risks

1. **Size cap may be too aggressive for AI infrastructure supercycle.** Consider raising mega-cap cap to 30% for FY+1 analyst estimates only.
2. **P/E comparison vs semiconductor peers is misleading** — NVDA is an AI accelerator company; its true peer set should be hyperscalers, not traditional chip makers.
3. **ROE = ~100% excludes fundamental growth model.** This is by design but reduces CAGR confidence.

---

## VIST — Vista Energy (formerly Vista Oil & Gas)

**Sector:** Energy | **Industry:** Oil & Gas E&P  
**Exchange:** NYSE (USD-quoted), also BMV in MXN  
**Reporting Currency:** USD (consolidated financials per SEC 20-F)

### Company Type

| Criterion | Value | Outcome |
|---|---|---|
| Financial sector | No | — |
| Dividend yield | Minimal | dividend: NO |
| Negative FCF | No (positive and growing) | startup: NO |
| CAGR > 20% | Historical 3Y: ~30%+, analyst: ~20% | growth: YES |

Expected company type: `growth`

### WACC — EM Considerations

| Input | Expected Value | Risk |
|---|---|---|
| rfRate | Live 10Y Treasury | Low |
| Beta | ~1.2–1.5 (E&P companies are commodity-exposed) | Medium |
| ERP | 4.6% | Low |
| CRP | **CRITICAL:** What currency triggers CRP lookup? | HIGH |
| D/E | ~0.3–0.5 | Low |

**CRP Risk:** VIST reports in USD and is listed on NYSE. If the system uses `reportingCurrency = 'USD'` to look up CRP, it gets CRP = 0%. But VIST's operations are entirely in Argentina — the country risk is the most important risk factor.

**Expected behavior:** CRP should be based on Argentina (0.1541), not the reporting currency.

**Current behavior:** `getCRP(reportingCurrency)` is called with `'USD'` → CRP = 0% → WACC understated → fair value overstated.

**Fix:** Use `summaryProfile.country` (Argentina) to determine CRP, not `summaryDetail.currency`. Add `'Argentina'` → `CRP_TABLE['ARS']` mapping by country name.

### CAGR — Vaca Muerta Production Ramp

| Source | Expected Value |
|---|---|
| Analyst FY+1 | ~20–25% production-linked revenue growth |
| Historical 3Y | ~30%+ (Vaca Muerta ramp-up years) |
| foreignCurrency | `false` (USD reporting) — historical CAGR valid |

**Note:** VIST is a special case — it's USD-reporting but Argentine-domiciled. The historical CAGR is valid (no ARS inflation distortion), but the CRP must be Argentine.

### Multiples

| Multiple | Industry Median | Applied |
|---|---|---|
| P/E | 10× (Oil & Gas E&P) | ✅ |
| EV/EBITDA | 6× | ✅ |
| EV/Revenue | 2.8× | ✅ |

**Risk:** E&P multiples are highly sensitive to oil price assumptions embedded in the median. The Damodaran Jan 2025 medians reflect a $70–80/bbl oil environment. If WTI diverges significantly, the multiples cross-check is misleading.

---

## JPM — JPMorgan Chase & Co.

**Sector:** Financial Services | **Industry:** Banks—Diversified  
**Exchange:** NYSE (USD)  
**Reporting Currency:** USD

### Company Type

Expected: `financial` — immediately detected by sector regex.

### WACC — Financial Sector Handling

| Input | Expected Value | Notes |
|---|---|---|
| rfRate | Live 10Y Treasury | Low |
| Beta | ~0.8–1.0 (large US bank) | Regression likely reliable |
| ERP | 4.6% | Low |
| CRP | 0% (USD) | Correct |
| Debt treatment | LongTermDebt only (~$300B bonds) | Deposit liabilities excluded |
| D/E cap | ≤ 1.5 | Applied if longTermDebt/mktcap > 1.5 |

**JPM total assets ≈ $3.7T. Long-term debt ≈ $300B. Market cap ≈ $600B. D/E via longTermDebt = 0.5 — well within cap. Correct.**

### CAGR

Financial sector → uses net income CAGR (not revenue CAGR).

| Source | Expected Value |
|---|---|
| Analyst FY+1 | EPS growth estimate (~5–10%) |
| Historical NI CAGR | ~8% (3Y median) |
| CAGR cap | 12% (financial sector) |

### Model Used

- Primary: FCFE (equity DCF) — 65%
- Primary FCF: normalizedNetIncome × 0.85 (2-year average)
- DDM applicable if dividendYield > 1% (JPM pays ~2.3% dividend)
  - If DDM applicable: weights shift to FCFE 50%, DDM 25%, multiples 20%

### Multiples

| Multiple | Industry Median | Applied |
|---|---|---|
| P/E | 12× (Banks—Diversified) | ✅ |
| P/Book | 1.3× | ✅ (primary for banks) |
| P/Sales | 3.2× | ✅ |
| EV/EBITDA | 10× | ❌ (excluded for financial) |

---

## AMZN — Amazon.com, Inc.

**Sector:** Consumer Cyclical | **Industry:** Internet Retail  
**Exchange:** NASDAQ (USD)  
**Special:** Conglomerate (AWS + retail + advertising + logistics)

### Company Type

| Criterion | Value | Outcome |
|---|---|---|
| Financial | No | — |
| Dividend | None | dividend: NO |
| Negative FCF | Positive (large) | startup: NO |
| CAGR > 20% | Historically yes; current ~10-15% | standard or growth |

Expected: depends on current analyst estimates. If analystEstimate1y > 20% → growth; else standard.

### WACC

| Input | Expected Value |
|---|---|
| rfRate | Live (~4.3%) |
| Beta | ~1.1–1.3 (diversified conglomerate, lower than pure tech) |
| Ke | ~4.3% + 1.2×4.6% = ~9.8% |
| D/E | ~0.3–0.4 (AWS capital-intensive but low relative to equity) |
| WACC | ~8.5–9.5% |

### Multiples

| Multiple | Industry Median | Applied | Issue |
|---|---|---|---|
| P/E | 35× (Internet Retail) | ✅ | Internet Retail PE driven by pure-play e-tailers, not AWS-cloud companies |
| EV/EBITDA | 22× | ✅ | — |
| EV/Revenue | 3.8× | ✅ | Low vs pure-software (correct for blended model) |

**Conglomerate issue:** Amazon's true blended multiple should weight AWS (28–35× EV/EBITDA) and retail (~8–10× EV/EBITDA) by revenue contribution. The single Internet Retail median (22×) blends these poorly.

---

## MSFT — Microsoft Corporation

**Sector:** Technology | **Industry:** Software—Application  
**Exchange:** NASDAQ (USD)  
**Revenue:** ~$240B (mega-cap)

### Summary

| Assumption | Expected | Risk |
|---|---|---|
| companyType | standard or growth (analyst ~12–15%) | Low |
| CAGR | ~13–16% blended (Azure + Office growth) | Low — strong analyst coverage (30+ analysts) |
| WACC | ~8–9% (low beta ~0.9, low D/E) | Low |
| CRP | 0% (USD) | Correct |
| Size cap | 22% (mega-cap) | May bite if Azure accelerates > 22% |
| Multiples | Software—Application: PE 38× | Could overstate if AI re-rating is priced in |

---

## TSLA — Tesla, Inc.

**Sector:** Consumer Cyclical | **Industry:** Auto Manufacturers  
**Exchange:** NASDAQ (USD)  
**Special:** High-beta, high-growth, disrupted auto incumbent multiple

### Known Issues

1. **Industry mismatch:** TSLA is classified under `Auto Manufacturers` (PE 10×) — but is priced as a tech/growth company (PE 50–100×). Multiples cross-check will dramatically understate TSLA vs tech peers.

2. **Beta instability:** TSLA's 5Y weekly beta can range from 1.8 to 2.5 depending on the measurement period. High variance in beta → high variance in WACC.

3. **CAGR sensitivity:** TSLA's forward CAGR depends on FSD penetration, Cybertruck, energy business — none of which are captured well by historical 3Y auto revenue CAGR.

**Recommendation:** For TSLA, manually override company type to `growth` and use the growth company weights. The Auto Manufacturers multiples benchmark should not be applied — consider adding a "Technology (Electric Vehicles)" industry entry.

---

## Cross-Stock Consistency Checks

### WACC Range by Company Type

Expected WACC ranges for healthy models:

| Company Type | Expected WACC Range |
|---|---|
| US Large-Cap Standard | 7–10% |
| US High-Growth Tech | 9–13% |
| US Financial Sector | 8–11% |
| EM Energy (Argentina) | 18–25% (with CRP) |
| US Small-Cap Growth | 11–15% |

If any valuation returns WACC outside these ranges, investigate before trusting the fair value.

### Fair Value Sanity Checks

| Check | How to Verify |
|---|---|
| Fair value within 3× current price | If |upside| > 200%, check for data issues |
| Terminal value < 85% of EV | Warning threshold in validator |
| Beta within 0.3–3.5 range | Validator warning |
| CAGR ≤ size cap | Size cap applied in extractFCFInputs |
| terminalG < WACC | Hard guard in projectCashFlows |

---

## Recommendations by Priority

### Immediate

1. **VIST (and all EM E&P):** Fix CRP to use company's operating country, not reporting currency
2. **All foreign-domiciled companies:** Verify `foreignCurrency` flag is set correctly in API route

### Short-Term

3. **TSLA / EV companies:** Add `Auto Manufacturers (EV)` industry to INDUSTRY_MEDIANS with tech-like multiples
4. **AMZN / conglomerates:** Document that single-segment multiples are a known limitation for diversified companies

### Long-Term

5. **Segment-weighted multiples:** For conglomerates, compute weighted average of segment multiples by revenue contribution
6. **Live peers for all sectors:** Verify that `livePeers` are actually fetched and passed to `calculateMultiples()` — this gives a more current benchmark than static Jan 2025 medians
