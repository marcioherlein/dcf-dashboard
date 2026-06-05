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
**Ticker / Context:** MSFT (0.52x), UBER (0.67x), NVDA (0.48x) — genuine stale Yahoo data; JPM (0.45x) = false positive (financial type uses NI×0.80, not fd.freeCashflow)
**Run count:** 3
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
**Ticker / Context:** NOW, MSFT, MU, ADBE, UBER, PLTR, ASML, NVDA, AMZN, COST, JPM, V — ALL NULL (12/12 audited tickers)
**Run count:** 12
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

### Finding 7: MU cyclical trough silent — EBIT=null + median NI positive but trough-distorted
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** MU (Micron Technology) — FY2023 loss (-37.5% NI%) distorts 3-year median to 3.1%; TTM=22.8%
**Run count:** 1
**Status:** new

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

### Finding 8: PLTR exit P/E of 107× dominated by speculative current multiple
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** PLTR — current P/E=155×, sector=32×, blended exitPE=107×
**Run count:** 1
**Status:** new

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

### Finding 9: JPM FCFF FV $952/sh vs P/B-anchored $223/sh — FCFF is directionally wrong for banks but weight-managed
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** JPM — FCFF model yields $952/sh (EV=$970B); P/B model yields ~$223/sh; Triangulated=$484/sh
**Run count:** 1
**Status:** new

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

### Finding 10: V classified as `financial` but operates as a pure payment network (no credit risk)
**Agent:** audit-valuation
**Date:** 2026-06-05
**Ticker / Context:** V — Credit Services, matched by 'credit' in financial regex, CAGR 12% < 20%
**Run count:** 1
**Status:** new

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
