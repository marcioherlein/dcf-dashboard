# Audit Agent Findings Log

This file is the shared memory for all audit agents in `testing/`.

Every audit run appends its novel findings here. When a finding appears in **2 or
more separate runs**, the agent that discovered it integrates it permanently into
the relevant `testing/*.md` source file and re-syncs to `.claude/commands/`.

---

## Format

```
### Finding [N]: [Short title]
**Agent:** audit-valuation | audit-og
**Date:** YYYY-MM-DD
**Ticker / Context:** [what triggered it]
**Run count:** 1  ← incremented by later runs that confirm it
**Status:** new | confirmed (≥2 runs) | integrated (written into template)

**Observed:** [what the code actually does]
**Expected / correct behaviour:** [what it should do]
**File / location:** [file:line if applicable]
**Suggested check to add:** [exact phrasing to insert into the template]
```

---

## Findings

### Finding 1: grossProfit = revenue for SaaS tickers (FMP field mapping)
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** NOW (ServiceNow)
**Run count:** 1
**Status:** integrated — fix shipped in commit 7247ea4

**Observed:** FMP returns `grossProfit = totalRevenue` for certain SaaS tickers,
producing 100% gross margin across all historical rows.
**Expected:** Real gross margin (~76.6% for NOW). `businessProfile.grossMargin`
(Yahoo `financialData.grossMargins`) is correct and available.
**File / location:** `app/api/financials/route.ts` ~line 917 (post-`isHistoricalRows`)
**Suggested check to add:** Guard: if all `grossProfit/revenue > 0.97` rows exist,
re-derive gross profit from `businessProfile.grossMargin`.

---

### Finding 2: _auditBundle quote missing peRatio
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** NOW (ServiceNow)
**Run count:** 1
**Status:** integrated — fix shipped in commit 7247ea4

**Observed:** `_auditBundle.quote` lacked `peRatio`, causing `deriveExitPE` to fall
through to sector-median-only (38×) instead of the 55/35 blend (~58× for NOW).
**Expected:** `q.trailingPE` passed through; blend correctly anchors to current P/E.
**File / location:** `app/api/financials/route.ts` ~line 1427 `_auditBundle`
**Suggested check to add:** Verify `assumptionAudit.exitPE` is not equal to the raw
sector median — if it is, the `peRatio` field is missing from the audit bundle.

---

### Finding 3: EBIT = null collapses NOPAT for SaaS tickers
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** NOW (ServiceNow); likely also CRM, WDAY, VEEV
**Run count:** 1
**Status:** integrated — fix shipped in commit 7247ea4

**Observed:** Yahoo provides no `operatingIncome`/`ebit` for certain SaaS companies.
All EBIT branches in `buildProjectedRows` leave `ebit = null` → NOPAT = null →
UFCF line collapses silently in Full DCF Table.
**Expected:** Fallback: `ebit = revenue × medianNetMargin / (1 − taxRate)`.
**File / location:** `lib/valuation/normalizeInputs.ts` ~line 462
**Suggested check to add:** After auditing EBIT rows, confirm projected UFCF rows are
non-null. If all UFCF = null but netIncome is positive, the EBIT fallback is not firing.

---
### Finding 4: baseFCF sourced from Yahoo fd.freeCashflow (stale/unreliable for large-caps)
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** MSFT (0.52x), UBER (0.67x), NVDA (0.48x), NEE (2.30x), XOM (0.49x), SO (-2.00x), INTC (-1.21x) — Yahoo fd.freeCashflow stale for non-financial companies; negative ratio = actual FCF is negative while Yahoo returns stale positive value
**Run count:** 7
**Status:** integrated — check added to Phase 3 UFCF section; NOTE: exclude financial/fintech companyTypes from ratio check (NI-based baseFCF is intentionally different from reported FCF/OCF)

**Observed:** `extractFCFInputs` sets `baseFCF = fd.freeCashflow / 1e6` (Yahoo financialData TTM field).
For MSFT this returns $37,011M — exactly 52% of the actual reported FY2025 FCF of $71,611M.
The market-cap yield cap (30% threshold) does not fire (MSFT yield=1.2%). The FCF margin ceiling
(45% for tech) does not fire either (37,011/318,273=11.6%). The stale Yahoo value flows through
unmodified and seeds the entire FCFF DCF chain → FCFF fair value $176/sh vs correct ~$341-391/sh.
Scenario base: $283/sh instead of ~$380-410/sh.
**Expected:** baseFCF should prefer the most recent FMP annual FCF (already available in
`cfHistoricalRows`) or the TTM FCF from `statementsData`, falling back to `fd.freeCashflow`
only when neither is available.
**File / location:** `lib/dcf/projectCashFlows.ts` `extractFCFInputs` ~line 160 (non-financial branch)
**Suggested check to add:** In Phase 3 UFCF audit: compute `baseFCF / mostRecentAnnualFCF`. If ratio
< 0.70 or > 1.50, flag as stale-FCF suspect — Yahoo fd.freeCashflow likely diverges from actual
reported FCF. Check `historicalFCF` array (last entry) as the ground truth.

---

### Finding 5: Monotonically rising CapEx/D&A not captured by 3Y-median blend
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** MSFT — CapEx% 13.3%→18.1%→22.9% (Azure AI); AMZN — CapEx% 13.0%→18.4% (AWS AI buildout)
**Run count:** 2
**Status:** integrated — check added to Phase 3 CapEx section; F4 check also updated to exclude financial types

**Observed:** `buildProjectedRows` blends `medianCapexPct = median(3Y) × 0.60 + TTM × 0.40`.
When capex is monotonically rising (MSFT: 13.3%→18.1%→22.9%), the 3Y median (18.1%) anchors
below TTM (22.9%) and far below forward guidance (25-30%). Blended = 20.0%, understating future
capex by ~3-8pp. Same pattern in D&A (blended ~10.3% vs trajectory toward 14%+).
**Expected:** When capex% trend is monotonically increasing (each year strictly higher), the
weighting should flip to TTM-dominant (60% TTM, 40% median) to track the acceleration.
**File / location:** `lib/valuation/normalizeInputs.ts` `buildProjectedRows` ~line 311 and ~line 287
**Suggested check to add:** In Phase 3 CapEx audit: check whether capex% is monotonically rising
over 3 historical years. If yes, verify blended rate is closer to TTM than median — if
blended << TTM by >3pp, flag as capex-understatement for this company.

---

### Finding 6: taxRate = null in all historical IS rows — FMP field not populating
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** ALL 33 AUDITED TICKERS — 100% reproduction rate
**Run count:** 33
**Status:** integrated — 100% reproduction rate; taxRate field is never populated in FMP income statement rows

**Observed:** All 5 MSFT historical IS rows have `taxRate: null`. `buildProjectedRows` falls back to
`waccInputs.taxRate = 0.21`. MSFT actual effective rate ~18-19%. Overestimates taxes ~2pp of EBIT,
understating NOPAT by ~$2-3B/yr.
**Expected:** `taxRawFmp` in route.ts FMP IS path should compute `incomeTaxExpense/incomeBeforeIncomeTaxExpense`.
**File / location:** `app/api/financials/route.ts` ~line 855; `lib/valuation/normalizeInputs.ts` ~line 338
**Suggested check to add:** In Phase 3 Tax Rate audit: if all historical `taxRate` values are null, the
21% fallback is firing. Report whether the company's known effective rate differs from 21%, and the
resulting NOPAT impact.

---

### Finding 7: Cyclical/recovery trough silent — EBIT=null + median NI positive but trough-distorted
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** MU (median 3.1% vs TTM 22.8%); LYFT (median 0.4% vs TTM 45.0% deferred tax gain)
**Run count:** 2
**Status:** integrated — check added to Phase 3 LFCF Net Income section (F7 + LYFT one-time gain variant)

**Observed:** With EBIT=null rows, `isCyclicalTrough` cannot evaluate (condition requires `medianEbitMargin < -0.02`).
The EBIT null fallback fires and uses `medianNetMargin`. For MU, the 3-year NI% values are [-37.5%, 3.1%, 22.8%],
giving a median of 3.1% — the trough-recovery year. The TTM value of 22.8% is never used.
The NI-level cyclical trough override (line ~496 normalizeInputs.ts) only fires when `medianNetMargin < 0`,
which does not apply here (3.1% > 0). Result: model projects NI at 3.1% instead of 20.5% (TTM×0.90),
understating NOPAT by ~7× in projected years.
**Expected:** A median-vs-TTM check should fire at the NI level too: when TTM NI% is more than 2× the
median NI% and median NI% < 10%, apply the TTM-based projection (same logic as cyclical trough EBIT guard).
**File / location:** `lib/valuation/normalizeInputs.ts` `buildProjectedRows` ~line 328 (medianNetMargin blend)
and ~line 496 (NI cyclical override — condition `medianNetMargin < 0` too narrow)
**Suggested check to add:** In Phase 3 Net Income audit: when EBIT=null, check whether the median NI% is
more than 2pp below TTM NI%. If so, the trough is distorting the median and the cyclical NI override
is not firing. State the median NI%, TTM NI%, and what the model is projecting vs. the TTM anchor.

---

### Finding 8: Exit P/E inflated by speculative multiples — no guard for profitable high-P/E stocks
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** PLTR (P/E=155×, exitPE=107×); AMD (P/E=156×, exitPE=106.5×); ARM (P/E=394×, exitPE=252×)
**Run count:** 3
**Status:** integrated — check updated in Phase 2B with all three examples; DDOG correctly excluded (nm<15%)

**Observed:** For companies trading at P/E > 3× sector median, the 55% weight on current P/E dominates
the blend and produces an exit multiple that assumes the speculative premium persists at exit.
PLTR: 155×(55/90) + 32×(35/90) = 107×. A 107× exit P/E in Year 5 for a maturing AI platform
is implausible — mature software platforms typically exit at 40–80×.
The existing thin-margin cap (`isThinMargin && isPEElevated`) does NOT apply here because PLTR
has a 36% net margin — thick margins. No second guard catches ultra-elevated P/Es for profitable,
high-multiple companies.
**Expected:** A "speculative premium fade" guard: when `currentPE > sectorPE × 3` AND the company
is profitable (net margin > 15%), cap the exit P/E at `min(blended, sectorPE × 2.5)`. This
prevents the exit multiple from embedding today's AI speculation premium into the terminal value.
**File / location:** `lib/valuation/assumptions/deriveAssumptions.ts` `deriveExitPE` ~line 206
**Suggested check to add:** In Phase 2B Exit P/E audit: compute `currentPE / sectorPE`. If ratio > 3×
and company is profitable, flag that blended exitPE embeds speculative premium. Check whether
`exitPE > sectorPE × 2.5` — if so, the speculative-fade guard should fire but doesn't.

---

### Finding 9: JPM/GS FCFF FV massively inflated for banks/alt-asset managers — wrong model, weight-managed
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** JPM FCFF=$952/sh (triWt=5%); GS FCFF=$4735/sh (triWt=10%); both use NI as enterprise FCF
**Run count:** 2
**Status:** integrated — check added to Phase 3 LFCF Net Income section

**Observed:** For `financial` companyType, FCFF uses `baseFCF = NI × (1−reinvestRate)` as if it
were an enterprise-level unlevered cash flow. For JPM with NI=$57B and WACC=9.07%, the Gordon
Growth terminal value inflates EV to ~$970B — much higher than the $840B market cap.
The correct model for a bank is P/B + FCFE (equity-level), not FCFF (enterprise-level).
At FCFF weight of 5% in the triangulation, the $952 adds only ~$48 to the blended result —
acceptable but the FCFF panel creates confusion by showing a wildly wrong directional number.
**Expected:** FCFF should return null (or be explicitly excluded from the method panel) when
`companyType = financial`. Using NI as a substitute for unlevered enterprise FCF is conceptually
incorrect even though the 5% weight limits the damage.
**File / location:** `lib/dcf/projectCashFlows.ts` `extractFCFInputs` financial branch (~line 161);
`lib/valuation/valuationMethods.ts` or the route FCFF computation for financial types
**Suggested check to add:** In Phase 3 for financial companies, verify that the FCFF FV shown in
`valuationMethods.models.fcff` is NOT used as a primary anchor. If FCFF FV is > 2× current price
for a financial company, flag it as directionally wrong (NI-based FCFF inflating enterprise value).
The triangulation weight of 5% limits impact, but the panel value is misleading.

---

### Finding 10: V/MA classified as `financial` but operate as pure payment networks (no credit risk)
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** V — Credit Services (CAGR 12%); MA — Credit Services (CAGR 12%) — both identical pattern
**Run count:** 2
**Status:** integrated — check added to Phase 2B Exit P/E section with F10 + F11

**Observed:** Visa is classified as `financial` because `industry='Credit Services'` matches the
regex `credit` in `detectCompanyType.ts`. However, Visa takes no credit risk, has no loan book, and
earns pure transaction fees — it is economically a high-margin tech platform, not a bank.
The `fintech` threshold (historicalCagr3y > 0.20 OR analyst1y > 0.20) requires 20%+ CAGR, which
Visa at 12% CAGR doesn't meet. As a result:
- P/B method is the adaptive anchor (BVPS=$19.93, justified P/B=8.28×, FV/sh=$306 vs $322 price — reasonable)
- EV/EBITDA excluded (financial type zeroes this out)
- Revenue multiple zero-weighted
- LFCF dominates DCF blend (90%)
Visa's economic model is far closer to `standard` or `growth` than `financial`.
At current classification, the P/B and LFCF anchors actually work well for Visa, and overall FV
($285-306) is in the right ballpark vs price ($322), so this is a low-severity classification edge case.
**Expected:** Add a carve-out: when `industry` contains 'Credit Services' AND `fcfMargin > 25%`
(pure network economics, no credit provision drag), classify as `standard` or `growth` not `financial`.
**File / location:** `lib/dcf/detectCompanyType.ts` financial regex ~line 32
**Suggested check to add:** For Financial Services / Credit Services companyType, check
`businessProfile.fcfMargin`. If > 25%, note that this may be a payment network (V, MA)
classified as financial — verify P/B is appropriate and LFCF dominance is justified.

---

### Finding 11: TSLA exitPE=222× — isAutoIndustry carve-out bypasses speculative P/E guard
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** TSLA — P/E=357×, sectorPE=10, exitPE=222×
**Run count:** 1
**Status:** new

**Observed:** TSLA P/E=357× with Auto Manufacturers sectorPE=10. The thin-margin cap
(`isThinMargin && isPEElevated && !isAutoIndustry`) would normally cap effectivePE to
`sectorPE×1.5 = 15` (since trailing NI%=4%<10% = isThinMargin, and 357>10×2=20 = isPEElevated).
However `!isAutoIndustry = false` because `'Auto Manufacturers'` matches the `isAutoIndustry` regex —
designed to exempt TSLA/GM/F from the thin-margin cap since auto OEMs have structurally thin margins.
Result: effectivePE = 357, blend = 357×(55/90) + 10×(35/90) = 222×. An exit P/E of 222× for a
car manufacturer is absurd regardless of growth story.
The auto carve-out was correct for capital-structure reasons (OEMs have intentionally thin GAAP margins)
but it inadvertently grants total immunity to speculative P/E inflation for all Auto industry stocks.
**Expected:** The `isAutoIndustry` carve-out should only exempt the thin-margin P/E cap, not override
an absolute ceiling for speculative premiums. A separate hard cap (e.g. `sectorPE × 20` = 200×)
should be enforced independently of the auto carve-out.
**File / location:** `lib/valuation/assumptions/deriveAssumptions.ts` `deriveExitPE` ~line 203
**Suggested check to add:** For Auto Manufacturers, verify exitPE ≤ sectorPE × 25 (e.g. ≤250× for
sector=10). If exitPE > sectorPE × 20 AND industry matches Auto Manufacturers, flag that the
isAutoIndustry carve-out is allowing a speculative P/E to flow through uncapped.

---

### Finding 12: NEE/SO (utility) baseFCF inflated — Yahoo fd.freeCashflow ignores full capex for regulated utilities
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** NEE (2.30×), SO (ratio=-2.00× actual FCF is negative) — Yahoo fd.freeCashflow ignores capital-intensive capex
**Run count:** 2
**Status:** integrated — F4 check updated to cover negative-ratio and >1.50 utility variants

**Observed:** For capital-intensive utilities like NEE (capex ~34% of revenue), Yahoo's
`fd.freeCashflow` returns a value significantly higher than OCF − capex. NEE FY2025 OCF ≈ $9,000M,
capex ≈ $9,300M → actual FCF = $3,211M (near zero to negative). But `fd.freeCashflow = $7,398M`
suggests Yahoo is either using a partial period, or is computing FCF without netting all capex.
This inflates `baseFCF` by 2.30×, affecting the FCFF DCF seed. The FCF margin ceiling
(`businessProfile.fcfMargin = 0.35` for non-tech) is set to the ceiling value, suggesting
the cap was involved in limiting it further — yet the final baseFCF is still 2.30× actual.
For NEE, the DDM anchor (FV $97) is appropriate and less affected, but the FCFF FV ($80) is wrong.
**Expected:** Same fix as F4: prefer most recent FMP annual FCF or TTM from statementsData.
The ratio > 1.50 upper-bound trigger should flag this.
**File / location:** Same as Finding 4: `lib/dcf/projectCashFlows.ts` `extractFCFInputs` ~line 160
**Suggested check to add:** F4 check already covers this (ratio=2.30× > 1.50 threshold triggers flag).
Ensure F4 check note clarifies that ratio > 1.50 for capital-intensive non-financial companies
(high-capex utilities, oil/gas, mining) is also a Yahoo FCF inflation symptom, not just a ramp.

---

### Finding 13: deriveNetMargin 'last' picks oldest year — auditBundle IS rows are newest-first
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** SHOP (FY2021 warrant 63.2%->55%cap); WDAY (FY2024 19.0%->22%); DDOG (FY2024 6.8%->isHighGrowthSaaS->14.7%)
**Run count:** 3
**Status:** integrated — confirmed systemic: 3 independent tickers across 3 different margin paths

**Observed:** SHOP's FY2021 net margin was 63.2% due to warrant fair value adjustments (a one-time non-cash
gain), not operating earnings. This row is included in the 5-year `withBoth` set used by `deriveNetMargin`.
The `assumptionAudit.netMargin` result shows 0.55 (55% cap hit), indicating that `last` in `deriveNetMargin`
is being resolved to the FY2021 value (63.2%) rather than FY2025 (10.7%). The exact mechanism is unclear
from API data alone (rows appear oldest-first in the response), but the output is unambiguously wrong:
55% exit margin is projected instead of ~12.2%, inflating the SHOP forward P/E fair value.
**Expected:** deriveNetMargin should filter out years where NI% is an obvious outlier (e.g. >50% in a
non-financial company with GM < 80%) or use a TTM/trailing anchor from `businessProfile.netMargin` as a
sanity check ceiling. A one-time gain year should not determine the projected exit margin.
**File / location:** `lib/valuation/assumptions/deriveAssumptions.ts` `deriveNetMargin` ~line 80
and `lib/valuation/cockpitBuilders.ts` `seedAssumptions` — the ordering of incomeRows passed to deriveNetMargin
**Suggested check to add:** In Phase 2E, verify `netMarginAudit` ≤ `businessProfile.netMargin × 3`. If
`netMarginAudit` is > 40% for a non-financial company with trailing NI < 20%, flag that a one-time gain year
(warrant fair value, asset sale, deferred tax reversal) may be inflating the projected exit margin. Compare
`assumptionAudit.netMargin` vs `businessProfile.netMargin` directly — a ratio > 3× signals this issue.

---

### Finding 14: MELI grossProfit exactly 49.47% for 4 consecutive years — FMP rounding/stale data
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** MELI — gp%=49.47% for all 4 historical years (constant to 2 decimal places)
**Run count:** 1
**Status:** new

**Observed:** MELI's grossProfit/revenue = 49.47% for FY2022, FY2023, FY2024, and FY2025 (identical to
two decimal places). Real gross margins fluctuate annually, especially for a high-growth fintech-hybrid
operating across multiple LatAm markets with volatile currency mixes. This pattern suggests FMP is
returning the same gross profit value for all years, or the grossProfit field is computed from a
single blended rate rather than annual statements. Unlike the F1 finding (grossProfit = revenue for
SaaS tickers), this affects the isHighGrowthSaaS check — MELI's lastGM=49.47% is < 60%, so the
SaaS convergence path correctly doesn't fire. But the constant value signals data quality issues.
**Expected:** Annual gross margins should vary year-to-year. For MELI: FY2022 actual ~48%, FY2023 ~50%,
FY2024 ~52%, FY2025 ~53% based on actual filings.
**File / location:** `app/api/financials/route.ts` income statement construction — check if FMP's
`grossProfit` field for MELI is static or derived from a single gross margin ratio.
**Suggested check to add:** In Phase 1 Data Quality, flag when all historical grossProfit/revenue values
are identical to 2+ decimal places (excluding the F1 case of >97%). This indicates stale or blended-rate
gross profit data from FMP that may affect margin convergence paths.

---

### Finding 15: MIG callout whitespace collapse — spaces stripped around inline spans
**Agent:** audit-og
**Date:** 2026-06-05
**Ticker / Context:** MSFT — reproduced on both landscape and square cards
**Run count:** 1
**Status:** integrated — fixed via flex-row approach in both routes
**Status:** integrated

**Observed:** MIG callout renders as "Market prices in8.2% revenue CAGR— model assumes 14.0%".
The space before the percentage span ("in ") and the space before the em-dash (" —") are both collapsed.
Code is `Market prices in <span ...>{value}% revenue CAGR</span> — model assumes <span ...>`.
**Expected:** "Market prices in 8.2% revenue CAGR — model assumes 14.0%" with spaces preserved.
**File / location:** `app/api/og/route.tsx:159–161`, `app/api/og/square/route.tsx:185–187`
**Suggested check to add:** In Phase 2C visual inspection, read MIG callout text and verify spaces are preserved around inline spans — look for "in%" (no space) or "CAGR—" (no space before dash) as the failure signal.

### Finding 16: Landscape Blended row lacks olive tint — inconsistency with square card
**Agent:** audit-og
**Date:** 2026-06-05
**Ticker / Context:** MSFT — landscape vs square visual comparison
**Run count:** 1
**Status:** integrated — olive-tinted tile added to landscape Blended card

**Observed:** The landscape Model Consensus panel renders the Blended result as a plain text row
(`borderTop` divider, label + value only — no background, no olive tint).
The square card renders Blended as a full card tile with `background: ${BRAND.olive700}12` olive tint,
matching the audit checklist expectation.
**Expected:** Blended entry should have olive tint in both formats to visually distinguish it from
the individual method cards.
**File / location:** `app/api/og/route.tsx:191–196` (landscape Blended — no olive bg)
vs `app/api/og/square/route.tsx:168–177` (square Blended — has olive bg)
**Suggested check to add:** In Phase 2C visual inspection, verify the Blended entry in the Model
Consensus panel has a visually distinct olive-tinted background in BOTH landscape and square cards.

### Finding 15: Closed-end funds classified as alt_asset — DCF near-zero, model misapplied
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** TY (Tri-Continental Corp, FV=$0.45 vs $34.65); GAB (Gabelli Equity Trust, FV=$0.90 vs $5.53)
**Run count:** 2
**Status:** integrated — check added to Phase 1A companyType section

**Observed:** TY is Tri-Continental Corporation, a closed-end investment fund (ticker NYSE:TY).
It is classified as `alt_asset` because sector=Financial Services, industry=Asset Management, and the
alt_asset carve-out fires. FCFF uses baseFCF≈$1M (near-zero operating income of a fund paying expenses)
producing FV=$0.45/share vs current price $34.65 (-99% upside). The model is misapplied — TY holds a
portfolio of equities and its "fair value" is the NAV of holdings, not a DCF of fund operating cash flows.
The `etf` companyType (which returns NAV-not-applicable) or a P/NAV approach would be appropriate.
**Expected:** Closed-end funds should return `etf` type or be excluded. The `alt_asset` regex
(`capital market|alternative asset|private equity|asset management`) catches legitimate alt-asset managers
(BX, KKR, Apollo) but also catches closed-end funds and ETF-like vehicles with the same industry label.
**File / location:** `lib/dcf/detectCompanyType.ts` ~line 43 (alt_asset carve-out)
**Suggested check to add:** When companyType=alt_asset and `revenueM < 100` (tiny "revenue" = fees on tiny AUM),
flag that this may be a closed-end fund or micro alt-asset vehicle. DCF output will be near-zero and triangulated
FV will be unreliable. Check `quote.quoteType` — closed-end funds often return 'CEF' not 'EQUITY'.

---
