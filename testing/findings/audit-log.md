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
**Ticker / Context:** MSFT — baseFCF=$37,011M vs actual FY2025 FCF=$71,611M (52% understatement)
**Run count:** 1
**Status:** new

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
**Ticker / Context:** MSFT — CapEx% 13.3%→18.1%→22.9% (Azure AI); D&A% 6.5%→9.1%→12.1%
**Run count:** 1
**Status:** new

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
**Ticker / Context:** MSFT — effective tax ~18-19%, model uses 21% fallback
**Run count:** 1
**Status:** new

**Observed:** All 5 MSFT historical IS rows have `taxRate: null`. `buildProjectedRows` falls back to
`waccInputs.taxRate = 0.21`. MSFT actual effective rate ~18-19%. Overestimates taxes ~2pp of EBIT,
understating NOPAT by ~$2-3B/yr.
**Expected:** `taxRawFmp` in route.ts FMP IS path should compute `incomeTaxExpense/incomeBeforeIncomeTaxExpense`.
**File / location:** `app/api/financials/route.ts` ~line 855; `lib/valuation/normalizeInputs.ts` ~line 338
**Suggested check to add:** In Phase 3 Tax Rate audit: if all historical `taxRate` values are null, the
21% fallback is firing. Report whether the company's known effective rate differs from 21%, and the
resulting NOPAT impact.

---
