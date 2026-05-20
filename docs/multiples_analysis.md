# Multiples Analysis

**Version:** 1.0.0  
**Date:** 2026-05-19  
**Purpose:** Documents the relative valuation methodology — peer set selection, benchmark hierarchy, applicable multiples per company type, blending logic, and known gaps.

---

## 1. Architecture

Multiples are computed in `lib/dcf/calculateMultiples.ts` and serve as a cross-check against the primary intrinsic DCF value. They contribute 20–70% of the triangulated fair value depending on company type.

### Data Flow

```
Yahoo quoteSummary
  → industry/sector strings
  → live peer quotes (PeerQuote[])

calculateMultiples(input)
  1. Look up INDUSTRY_MEDIANS[industry] or SECTOR_MEDIANS[sector]
  2. For each multiple: prefer live peer median (≥3 peers) over static median
  3. Compute: impliedFairValue = currentPrice × benchmark / actualMultiple
  4. Blend applicable multiples (equal-weight average)
  → MultiplesResult { estimates[], blendedFairValue, peerTickers }
```

---

## 2. Benchmark Hierarchy

Each multiple uses a two-tier benchmark:

| Tier | Source | Condition | Label in UI |
|---|---|---|---|
| 1 (preferred) | Live peer median | ≥3 peers return valid, finite, positive value | "N peers median" |
| 2 (fallback) | INDUSTRY_MEDIANS static table | Industry string matches exactly | "industry median" |
| 3 (last resort) | SECTOR_MEDIANS static table | Sector string matches | "sector median" |

**Note:** Live peers are only fetched if the API call for the company returns `livePeers` in the input — this depends on whether `app/api/financials/route.ts` calls Yahoo for each peer ticker. Review `app/api/financials/route.ts` to confirm live peers are actually fetched and passed.

---

## 3. Peer Groups

Peer groups are curated by Yahoo industry string in `PEER_TICKERS` (≈60 industries covered).

### Key Peer Groups

| Industry | Peer Tickers |
|---|---|
| Semiconductors | NVDA, AMD, AVGO, QCOM, AMAT, INTC |
| Software—Application | MSFT, ADBE, CRM, NOW, INTU, ORCL |
| Internet Content & Information | GOOGL, META, SNAP, PINS, RDDT, IAC |
| Banks—Diversified | JPM, BAC, C, WFC, GS, MS |
| Capital Markets | GS, MS, SCHW, BX, APO, KKR |
| Drug Manufacturers—General | JNJ, PFE, MRK, ABBV, LLY, BMY |
| Biotechnology | AMGN, GILD, REGN, VRTX, MRNA, BIIB |
| Oil & Gas Integrated | XOM, CVX, BP, SHEL, TTE, COP |
| Credit Services | V, MA, AXP, DFS, SYF, COF |

**Minimum peers for live median:** 3. Below this threshold, falls back to static INDUSTRY_MEDIANS.

---

## 4. Applicable Multiples by Company Type

| Multiple | standard | dividend | financial | growth | startup |
|---|---|---|---|---|---|
| P/E (trailing) | ✅ | ✅ | ✅ | ✅ | ❌ |
| EV/EBITDA | ✅ | ✅ | ❌ | ✅ | ❌ |
| P/Book | ✅ | ❌ | ✅ | ❌ | ❌ |
| P/Sales | ❌ | ❌ | ✅ | ✅ | ✅ |
| EV/Revenue | ✅ | ✅ | ✅ | ✅ | ✅ |

**Rationale:**
- EV/EBITDA excluded for financial companies: EBITDA is not meaningful for banks (no depreciation of loan assets)
- P/Book primary for financial companies: book value (equity) is the key balance sheet metric for banks
- P/Sales and EV/Revenue used for startups/growth: pre-profit companies can't use earnings multiples
- P/E excluded for startups: EPS typically negative

---

## 5. Industry Multiples Reference Table (Damodaran Jan 2025)

### Technology

| Industry | P/E | EV/EBITDA | P/B | P/S | EV/Rev |
|---|---|---|---|---|---|
| Software—Application | 38× | 28× | 9.0× | 7.0× | 8.0× |
| Software—Infrastructure | 32× | 24× | 8.0× | 6.5× | 7.0× |
| Semiconductors | 26× | 18× | 6.5× | 6.0× | 7.5× |
| Semiconductor Equipment & Materials | 22× | 16× | 5.0× | 4.5× | 5.0× |
| Internet Content & Information | 24× | 16× | 6.0× | 5.5× | 6.0× |
| Internet Retail | 35× | 22× | 8.5× | 3.5× | 3.8× |
| Consumer Electronics | 28× | 18× | 7.0× | 3.5× | 3.5× |
| IT Services | 22× | 14× | 5.0× | 2.8× | 3.0× |
| Communication Equipment | 18× | 12× | 3.5× | 2.5× | 2.8× |
| Data Center REITs | 45× | 28× | 5.0× | 9.0× | 10.0× |

### Financial Services

| Industry | P/E | EV/EBITDA | P/B | P/S | EV/Rev |
|---|---|---|---|---|---|
| Banks—Diversified | 12× | 10× | 1.3× | 3.2× | 3.5× |
| Banks—Regional | 12× | 10× | 1.1× | 3.0× | 3.2× |
| Insurance—Property & Casualty | 14× | 11× | 1.8× | 1.4× | 1.5× |
| Capital Markets | 14× | 12× | 2.2× | 3.5× | 3.8× |
| Asset Management | 16× | 13× | 3.0× | 4.0× | 4.5× |
| Financial Data & Stock Exchanges | 30× | 22× | 7.0× | 8.0× | 9.0× |
| Credit Services | 18× | 14× | 4.0× | 5.0× | 5.5× |

### Healthcare

| Industry | P/E | EV/EBITDA | P/B | P/S | EV/Rev |
|---|---|---|---|---|---|
| Drug Manufacturers—General | 18× | 12× | 4.5× | 4.0× | 4.5× |
| Biotechnology | 35× | 25× | 5.0× | 6.0× | 7.0× |
| Medical Devices | 28× | 20× | 4.0× | 5.0× | 5.5× |
| Health Care Plans | 16× | 10× | 3.5× | 0.6× | 0.7× |

### Energy

| Industry | P/E | EV/EBITDA | P/B | P/S | EV/Rev |
|---|---|---|---|---|---|
| Oil & Gas Integrated | 11× | 7× | 1.5× | 1.1× | 1.2× |
| Oil & Gas E&P | 10× | 6× | 1.4× | 2.5× | 2.8× |
| Oil & Gas Midstream | 14× | 10× | 2.5× | 2.0× | 2.5× |

### Sector-Level Fallbacks

| Sector | P/E | EV/EBITDA | P/B | P/S | EV/Rev |
|---|---|---|---|---|---|
| Technology | 28× | 20× | 7.5× | 5.0× | 6.0× |
| Financial Services | 14× | 12× | 1.4× | 2.8× | 3.5× |
| Healthcare | 24× | 16× | 4.2× | 4.5× | 4.5× |
| Consumer Cyclical | 20× | 13× | 3.5× | 1.4× | 1.5× |
| Energy | 12× | 8× | 1.6× | 1.2× | 1.3× |
| Industrials | 21× | 14× | 3.8× | 1.8× | 2.0× |
| Real Estate | 35× | 20× | 2.2× | 6.0× | 7.0× |
| *default* | 20× | 14× | 3.0× | 2.5× | 3.0× |

---

## 6. Implied Fair Value Computation

For each applicable multiple:
```
impliedFairValue = currentPrice × (benchmarkMedian / companyActualMultiple)
```

Example (P/E):
- Company trailing P/E: 18×
- Industry median P/E: 26× (Semiconductors)
- currentPrice: $100
- impliedFairValue = $100 × (26 / 18) = $144.44
- upsidePct = (144.44 - 100) / 100 = +44.4%

**Blending:** Equal-weight average of all applicable, positive implied fair values.

```typescript
blendedFairValue = applicable.reduce((s, e) => s + e.impliedFairValue, 0) / applicable.length
```

---

## 7. Multiples Contribution to Triangulation

Multiples contribute to the triangulated fair value via fixed weights in `detectCompanyType.ts getModelWeights()`:

| Company Type | Multiples Weight |
|---|---|
| standard | 35% |
| growth | 35% |
| startup | 70% |
| financial | 30% (FCFE 65%) |
| dividend | 20% (DDM 50%) |

For startup companies, multiples are the primary valuation signal (70%) because DCF cash flows are speculative.

---

## 8. Known Gaps and Recommended Fixes

### Gap 1: Live Peers May Not Be Fetched

The `calculateMultiples()` function accepts `livePeers?: PeerQuote[]`. If this array is empty (default `[]`), all multiples fall back to static industry medians.

**Verification needed:** Confirm `app/api/financials/route.ts` actually fetches Yahoo quotes for each peer in `PEER_TICKERS[industry]` and passes them to `calculateMultiples()`. If not, live peer benchmark is always bypassed and the code path is dead.

### Gap 2: Equal-Weight Blending

The blended multiple fair value uses a simple arithmetic mean across all applicable estimates. This gives equal weight to P/E and EV/Revenue, even though for a high-margin SaaS company, EV/Revenue is less meaningful than EV/EBITDA.

**Recommended Fix:** Weight multiples by their explanatory power for the company type:
- Financial: P/B most relevant (40%), P/E (35%), P/S (25%)
- Growth: EV/EBITDA (50%), EV/Revenue (30%), P/E (20%)
- Standard: P/E (45%), EV/EBITDA (35%), EV/Revenue (20%)

### Gap 3: Static Multiples Not Date-Stamped in Output

The `MultipleEstimate` object does not carry a `dataAsOf` timestamp. If the user saves a valuation today and reviews it in 6 months, they cannot tell whether the benchmark was Jan 2025 or Jan 2026 data.

**Recommended Fix:** Add `benchmarkAsOf: '2025-01-01'` to `MultipleEstimate` and render it in the UI.

### Gap 4: Peer Multiples Include the Target Ticker

If the user is analyzing NVDA, and NVDA appears in the Semiconductors peer list, the live peer median would include NVDA's own multiple — slightly biasing the benchmark toward NVDA's valuation.

**Recommended Fix:** Filter `livePeers` to exclude the ticker being analyzed.

### Gap 5: No Industry Match Alerting

If Yahoo returns `industry = 'Semiconductor Equipment'` (without `& Materials`), the lookup falls through to `SECTOR_MEDIANS['Technology']` = 28× PE instead of 22×. There is no warning in the output about which benchmark source was actually used.

The `benchmarkSource` field distinguishes `industry-median` vs `sector-fallback`, so the UI can surface this — but currently the source label is shown only in tooltip/note text.

**Recommended Fix:** Add a top-level `benchmarkSource: 'industry-median' | 'sector-fallback'` to `MultiplesResult` for prominent display.

### Gap 6: EV Multiples Require Live EV (Not Computed)

For EV/EBITDA and EV/Revenue multiples, the `actualValue` is taken directly from Yahoo `evToEbitda` and `evToRevenue`. These are point-in-time Yahoo-computed EV multiples that use Yahoo's own EV estimate (market cap + net debt), not the DCF-derived EV.

**This means:** The multiple cross-check is using a different EV denominator than the DCF model. For companies with significant off-balance-sheet obligations or stock options, Yahoo's EV may differ from the model's EV.

**Acknowledged:** This is acceptable for a cross-check. Document in UI tooltips.

---

## 9. Sector Classification Examples

### NVDA (Nvidia)

- Yahoo industry: `Semiconductors`
- INDUSTRY_MEDIANS match: ✅ `Semiconductors` → PE 26×, EV/EBITDA 18×
- companyType: `growth` (CAGR > 20%)
- Applicable: P/E ✅, EV/EBITDA ✅, EV/Revenue ✅, P/B ❌, P/S ✅
- Triangulation weight: 35%

### VIST (Vista Oil & Gas)

- Yahoo industry: `Oil & Gas E&P`
- INDUSTRY_MEDIANS match: ✅ `Oil & Gas E&P` → PE 10×, EV/EBITDA 6×
- companyType: depends on CAGR; likely `growth` given high Vaca Muerta production ramp
- Special: foreignCurrency (ARS reporting) → CRP = 15.41%
- **FX risk:** If `getFXRate('ARS', 'USD')` fails, equity bridge is wrong
- Triangulation weight: 35%

### JPM (JPMorgan Chase)

- Yahoo industry: `Banks—Diversified`
- INDUSTRY_MEDIANS match: ✅ → PE 12×, P/B 1.3×
- companyType: `financial`
- Applicable: P/E ✅, P/B ✅, P/S ✅, EV/Revenue ✅, EV/EBITDA ❌
- D/E uses longTermDebt only (deposit liabilities excluded)
- Triangulation: FCFE 65%, multiples 30%

### AMZN (Amazon)

- Yahoo industry: `Internet Retail`
- INDUSTRY_MEDIANS match: ✅ `Internet Retail` → PE 35×, EV/EBITDA 22×
- companyType: `growth` or `standard` depending on current CAGR
- Mixed company: AWS is SaaS/infrastructure, retail is low-margin → sector median is a blunt instrument
- **Gap:** No sub-segment weighting in multiples; AMZN's blended multiple is determined by its Yahoo industry label (Internet Retail), not by its business mix

---

## 10. Update Process

The `INDUSTRY_MEDIANS` table must be updated annually after Damodaran releases January data:

1. Download from https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/pedata.html
2. Update `lib/dcf/calculateMultiples.ts` — INDUSTRY_MEDIANS and SECTOR_MEDIANS objects
3. Update `config/valuation.config.ts` `dataSourceVersions.damodaran_industry_multiples`
4. Update `assumptions_registry.json` `_meta.dataSourceVersions.damodaran_industry_multiples`
5. Run `npm test` — tests should assert specific values for known industries

**Last updated:** January 2025  
**Next update due:** January 2026
