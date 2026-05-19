# Valuation Tab Audit — Findings and Fix Plan

## Executive Summary

The valuation tab is **not fully trustworthy in its current state** for four high-severity reasons:

1. **EV/EBITDA carries the wrong method ID** (`reverse_dcf`) — the method card label and its internal ID are mismatched. If any code routes on `id === 'reverse_dcf'`, it will hit EV/EBITDA, not Reverse DCF.
2. **Two entirely different valuation models are conflated in the summary table** — the row labeled `'DCF (FCFF Blend)'` uses `id: 'scenario_blend'` but is populated with the API's FCFF/FCFE/DDM triangulated fair value, while the Scenario Blend method card computes a Forward P/E scenario blend. These are different numbers from different models shown under the same identifier.
3. **Reverse DCF is listed in the weighted consensus with `weight: 0.10`**, but its `fairValue` is always `null`. It is correctly excluded from the consensus computation, but its presence in the breakdown table creates a misleading appearance that it is contributing.
4. **Revenue in Reverse DCF is not converted to quote currency** (no FX rate applied for ADRs). For STNE, PAGS, VALE — the implied EV is in USD but the revenue input is in reporting currency (BRL), producing a nonsense implied CAGR.

Additional medium-severity issues: ADR share-count ordering (TSM will produce ~5× wrong per-share fair values), hardcoded `$` in chart tooltips and axes for all non-USD companies, "Actual Price" label instead of "Current Price".

---

## Cross-Stock Findings Matrix

| Ticker | Issue | Severity | Evidence | Root Cause | User Impact | Fix |
|--------|-------|----------|----------|------------|-------------|-----|
| ALL | EV/EBITDA `id: 'reverse_dcf'` | HIGH | ValuationLab.tsx:673 | `'ev_ebitda'` missing from `ValuationMethodId` type | Duplicate ID with actual Reverse DCF; routing bugs | Add `'ev_ebitda'` to type, change ID |
| ALL | summaryMethods[3] mixes two models under one slot | HIGH | ValuationLab.tsx:806 | `id: 'scenario_blend'` row uses API `triangulatedFairValue` (FCFF) instead of `scenarioResult.weightedFairValue` (Forward P/E) | User sees one number in summary, different in card | Use `scenarioResult.weightedFairValue` consistently |
| ALL | Reverse DCF at `weight: 0.10` but always `fairValue: null` | MEDIUM | ValuationLab.tsx:807 | Reverse DCF is diagnostic — doesn't produce fair value | Misleading table row showing 10% weight but "—" | Set weight to 0 or remove from table |
| STNE, PAGS, VALE | Reverse DCF revenue not FX-converted | HIGH | ValuationLab.tsx:703-708 | `lastActualRevenue = ttmRevenue` (no `stmtFxRate` applied) | Implied CAGR nonsense (BRL revenue vs USD EV) | Apply `stmtFxRate` to `ttmRevenue` |
| TSM | ADR share count ordering wrong | HIGH | ValuationLab.tsx:557 | `ttmShares` (25.9B ordinary) preferred over `fairValue.sharesOutstanding` (5.18B ADR) | Forward P/E, Rev Multiple, EV/EBITDA fair values ~5× too low | Flip priority: ADR-equivalent shares first |
| ALL non-USD | Hardcoded `$` in summary chart | MEDIUM | ValuationSummary.tsx:125-127,220,253 | `$${...}` literals in tickFormatter, tooltip, ReferenceLine | Chart shows wrong currency symbol for STNE, PAGS, VALE, TSM | Use `fmtPrice(v, currency)` |
| ALL | "Actual Price" label | LOW | ValuationLab.tsx:55,70,98 | Copy choice | Implies historical price | Rename to "Current Price" |
| STNE, PAGS | EV/EBITDA for fintech with no applicability warning | MEDIUM | ValuationLab.tsx:663 | No financial-sector guard in EV/EBITDA config | Fintech companies with credit/deposit balance sheets show misleading EV/EBITDA fair value | Add warning for financial-sector companies |
| ALL | fmtAssumptionDisplay hardcodes `$` for unit='$' | MEDIUM | ValuationLab.tsx:122-126 | Local formatter, not canonical | Wrong currency symbol for non-USD | Use `fmtLargeCurrency` or pass currency |

---

## Per-Ticker Audit

### TSLA
- **Quote currency**: USD, **Reporting currency**: USD — no FX issues
- **Share count**: ADR ≡ ordinary — no ADR mismatch
- **Key risk**: Negative FCF years; high SBC; Reverse DCF `not_meaningful` guard should fire correctly
- **Reverse DCF**: FX issue does not apply (USD = USD)
- **EV/EBITDA**: EBITDA should be positive; method applicable
- **Shares bug**: `ttmShares` ≡ ADR shares for TSLA — no impact

### STNE (StoneCo)
- **Quote currency**: USD (NASDAQ ADR), **Reporting currency**: BRL
- **FX rate**: `stmtFxRate` ≈ 0.18 (BRL/USD)
- **Critical**: `lastActualRevenue` not FX-converted → Reverse DCF implied CAGR is garbage
- **EV/EBITDA**: Fintech/payment company — EV/EBITDA less meaningful for financial-like B/S; no warning shown
- **`sharesAbsolute`**: `ttmShares` from Yahoo balance sheet in BRL context may be correct absolute shares — depends on whether Yahoo reports ordinary shares; risk that TSM-like mismatch could occur
- **ltvRevenue for Forward P/E**: correctly applies `stmtFxRate` via `ltvRevenueAbsolute`

### PAGS (PagSeguro)
- Same issues as STNE (Brazilian payment company, USD ADR, BRL reporting)
- Reverse DCF currency bug applies
- EV/EBITDA applicability warning should appear

### VALE
- **Quote currency**: USD (NYSE ADR), **Reporting currency**: BRL
- **FX rate**: `stmtFxRate` ≈ 0.18
- **Reverse DCF**: FX bug applies — `lastActualRevenue` in BRL, EV in USD
- **EV/EBITDA**: VALE is a commodity miner — cyclical EBITDA; sector multiple 10× is reasonable fallback but one-cycle EBITDA extrapolation is risky. No warning shown.
- **sharesAbsolute**: Same ordering risk as TSM if `ttmShares` is ordinary (Brazilian shares, not ADR-equivalent). VALE ADR ratio is 1:1 so impact is lower.

### TSM (TSMC)
- **Quote currency**: USD (NYSE ADR), **Reporting currency**: TWD
- **FX rate**: `stmtFxRate` ≈ 0.031 (TWD→USD)
- **CRITICAL ADR share bug**: `ttmShares` from Yahoo balance sheet = ~25.9B ordinary TWD shares. ADR = ~5.18B (1 ADR : 5 ordinary). Fair value per share is ~5× too low for Forward P/E, Revenue Multiple, EV/EBITDA.
- **Reverse DCF**: FX bug applies — `lastActualRevenue` in TWD, EV in USD
- **ltvRevenue**: correctly applies `stmtFxRate` — OK

---

## Model Reconciliation

The codebase has **two parallel valuation systems**:

**System A (API/Core DCF)**: FCFF, FCFE, DDM, Multiples → `triangulatedFairValue`
- Lives in `lib/dcf/` + `lib/valuation/engine.ts`
- Exposed via `/api/financials`
- Used in `InvestorGradeCard` (overview tab)

**System B (Interactive Lab)**: Forward P/E, EV/EBITDA, Revenue Multiple, Scenario Blend, Reverse DCF
- Lives in `lib/valuation/methods/`
- Rendered in `ValuationLab.tsx`
- Has its own weighted consensus

**Current confusion**: `summaryMethods[3]` pulls System A's `triangulatedFairValue` into System B's table under `id: 'scenario_blend'` and labels it `'DCF (FCFF Blend)'`. This is effectively a hidden reconciliation. The issue is it's opaque — users don't know that one row in the table is from a completely different calculation engine.

**Recommended architecture (Option B from spec)**: Make it explicit.
- Rename row to `'Core DCF (FCFF/FCFE/DDM)'` with `id: 'core_dcf'`
- Keep Scenario Blend card showing Forward P/E scenarios, but use `scenarioResult.weightedFairValue` in the summary row with `id: 'scenario_blend'` (consistent with the card)
- Add a footnote: "Core DCF row uses the server-computed FCFF/FCFE/DDM triangulation from the API."

This is actually already what the code does — just with misleading labels. The fix is labeling clarity.

---

## Unit and Currency Contract

| Field | Unit in API | Unit after normalizeInputs | Consumer | Risk |
|-------|-------------|---------------------------|----------|------|
| `ttmRevenue` | Reporting currency absolute | No conversion | `lastActualRevenue` for Reverse DCF | **BUG: no FX conversion** |
| `ttmRevenue` | Reporting currency absolute | `× stmtFxRate` = quote currency absolute | `ltvRevenueAbsolute` for Forward P/E | OK |
| `ttmEbitda` | Reporting currency absolute | `× stmtFxRate` = quote currency absolute | EV/EBITDA engine | OK |
| `ttmNetDebt` | Reporting currency absolute | `× stmtFxRate` = quote currency | EV/EBITDA engine | OK |
| `ttmShares` | Ordinary shares absolute | None | `sharesAbsolute` (first priority) | **BUG: ADR ordinary for TSM** |
| `fairValue.sharesOutstanding` | ADR-equivalent shares in millions | `× 1e6` = raw ADR shares | `sharesAbsolute` (fallback) | OK (should be first priority) |
| `fairValue.cash` | USD millions | `× 1e6` = USD absolute | Reverse DCF cashM | OK |
| `fairValue.debt` | USD millions | `× 1e6` = USD absolute | Reverse DCF debtM | OK |
| `financialStatements.revenue` | USD millions | `× 1e6` = USD absolute | Forward P/E (fallback) | OK |
| `stmtFxRate` | Reporting→Quote rate | — | All TTM multiplications | OK |

---

## Bugs Fixed (see implementation)

1. **ValuationModelDrawer.tsx**: Replace `'dcf'` with `'ev_ebitda'` in `ValuationMethodId` type
2. **ValuationLab.tsx line 673**: Change `id: 'reverse_dcf' as ValuationMethodId` to `id: 'ev_ebitda'`
3. **ValuationLab.tsx line 806**: Change `summaryMethods[3]` to use `scenarioResult.weightedFairValue` (consistent with the scenario card) and label `'Scenario Blend'`; add a new `id: 'core_dcf'` row for the API triangulated value
4. **ValuationLab.tsx line 807**: Remove Reverse DCF from `summaryMethods` (diagnostic only, never contributes fair value) — or set `weight: 0` with clear label
5. **ValuationLab.tsx line 703-708**: `lastActualRevenue` must apply `stmtFxRate` when using TTM revenue
6. **ValuationLab.tsx line 557**: Flip `sharesAbsolute` priority — ADR-equivalent (from `fairValue.sharesOutstanding * 1e6`) first, then `ttmShares`
7. **ValuationSummary.tsx lines 125, 127, 220, 253**: Replace hardcoded `$` with `fmtPrice(v, currency)` / `fmtAxisTick(v, currency)`
8. **ValuationLab.tsx lines 55, 70, 98**: Rename `'Actual Price'` → `'Current Price'`
9. **ValuationLab.tsx evEbitdaConfig**: Add financial-sector applicability warning (STNE, PAGS-class companies)

---

## Remaining Limitations

- **Analyst target data**: Yahoo Finance analyst targets may be stale (updated quarterly, not daily)
- **Sector fallback multiples**: EV/EBITDA and P/E sector defaults are Damodaran Jan 2025 medians — reasonable academic benchmarks but not live peer data
- **Financial sector EV/EBITDA**: For STNE and PAGS (payment/fintech), EV/EBITDA is a valid screen but the model flags low-confidence. A proper financial company valuation requires P/E or P/Book.
- **VALE cyclicality**: DCF on one cycle of EBITDA for a commodity company is intrinsically unreliable; no automated normalization
- **TTM balance sheet shares**: For foreign companies with complex share structures, Yahoo's `commonStockSharesOutstanding` may not correctly reflect ADR ratio — always verify via marketCap/price
