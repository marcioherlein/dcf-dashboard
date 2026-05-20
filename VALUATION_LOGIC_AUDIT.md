# Valuation Logic Audit

> Generated: 2026-05-19  
> Validation stock: VIST (Vista Oil & Gas)  
> Auditors: financial modeling · data lineage · frontend QA · adversarial

---

## Audit Scope

All valuation logic across the following subsystems was audited:
- `lib/valuation/` — core engine, adapter, methods, assumptions, bridge
- `lib/dcf/` — WACC, beta, FCF, multiples, scores, cash flow projection
- `app/api/financials/route.ts` — main data orchestration
- `app/api/recalculate/route.ts` — live recalculation endpoint
- `components/modelling/` — workspace, forecast table, assumption panel
- `components/valuation/` — valuation lab, method cards, drawers
- `config/valuation.config.ts` — global configuration

---

## Finding Index

| ID | Severity | Category | Short Description |
|----|----------|----------|-------------------|
| F-01 | **HIGH** | Calculation | Three independent exit-multiple tables with conflicting values |
| F-02 | **HIGH** | Calculation | WACC weights hardcoded 70/30 in adapter.ts, correct elsewhere |
| F-03 | **HIGH** | Data integrity | net debt defaults to 0 when null in EV/EBITDA and Revenue Multiple |
| F-04 | **HIGH** | Calculation | CAGR is derived three separate ways in three separate modules |
| F-05 | **HIGH** | Calculation | calculateFairValue.ts converts null shares/price to 0 → silent wrong answers |
| F-06 | **MEDIUM** | Architecture | Exit P/E source always reported as "sector_fallback" even when actual company PE available |
| F-07 | **MEDIUM** | Calculation | Tax rate clamping inconsistent: [5%, 40%] vs [5%, 55%] across modules |
| F-08 | **MEDIUM** | Calculation | ERP hardcoded at 4.6% with no date stamp or refresh — stale after Damodaran annual update |
| F-09 | **MEDIUM** | Architecture | projectCashFlows.ts terminal value safety fallback: TV = FCF × 15 silently (should throw) |
| F-10 | **MEDIUM** | UX | Revenue CAGR displayed in at least 4 places; no comparison or reconciliation shown |
| F-11 | **MEDIUM** | Architecture | recalculate/route.ts uses mock WACC inputs (rfRate=4.5%, beta=1.0) instead of actual computed values |
| F-12 | **MEDIUM** | Data integrity | Market cap used as fallback for enterpriseValue in WACC weight computation |
| F-13 | **LOW** | Calculation | FCFE uses net income × 0.90 haircut without documentation or user transparency |
| F-14 | **LOW** | UX | Terminal value residual % warning shows icon but no explanation text |
| F-15 | **LOW** | Architecture | Sector CAGR fallback table in deriveAssumptions.ts vs weighted blending in projectCashFlows.ts |
| F-16 | **LOW** | UX | EditableCell silently discards invalid (NaN) input |
| F-17 | **LOW** | Calculation | Dilution rate derived from net margin, but applied to forward shares without showing impact |
| F-18 | **LOW** | Architecture | fedFundsTarget hardcoded at 4.33 in market-context route |

---

## Detailed Findings

---

### F-01 — Three independent exit-multiple tables with conflicting values

**Severity:** HIGH  
**Category:** Calculation error / data inconsistency

**Problem:**  
Exit multiples (EV/Revenue, EV/EBITDA, P/E) are defined in three separate files with different values for the same sector. A user gets different implied fair values depending on which code path runs.

**Files and conflicting values:**

**EV/Revenue — Technology sector:**
| File | Value | Context |
|------|-------|---------|
| `lib/valuation/assumptions/deriveAssumptions.ts:46` | **8.0×** | Used by ValuationLab Revenue Multiple method |
| `lib/dcf/calculateMultiples.ts` sector fallback | **6.0×** | Used by the main DCF multiples method |

**EV/Revenue — Energy sector:**
| File | Value | Context |
|------|-------|---------|
| `lib/valuation/assumptions/deriveAssumptions.ts:54` | **1.5×** | ValuationLab |
| `lib/dcf/calculateMultiples.ts` sector fallback | **1.3×** | DCF multiples |

**P/E — Technology sector:**
| File | Value | Context |
|------|-------|---------|
| `lib/valuation/assumptions/deriveAssumptions.ts:14` | **25×** | ValuationLab Forward P/E |
| `lib/dcf/calculateMultiples.ts` sector fallback | **28×** | DCF multiples |

**EV/EBITDA — Technology sector:**
| File | Value | Context |
|------|-------|---------|
| `lib/valuation/methods/evEbitda.ts:12` | **20×** | ValuationLab EV/EBITDA |
| `lib/dcf/calculateMultiples.ts` sector fallback | **20×** | Match — coincidence |

**Root cause:**  
The Valuation Lab (`deriveAssumptions.ts`) was written independently of the original DCF multiples engine (`calculateMultiples.ts`). Neither references the other. `calculateMultiples.ts` uses granular Damodaran Jan-2025 industry data (100+ sub-industries). `deriveAssumptions.ts` uses 11 broad sector buckets with hand-chosen values.

**Impact on VIST (Energy):**  
VIST is in the Energy sector. EV/Revenue multiple: 1.5× (ValuationLab) vs 1.3× (DCF multiples) — 15% difference in Revenue Multiple fair value. For a stock with large revenue, this difference is material.

**Required fix:**  
All exit multiple lookups must draw from a single source. The single source of truth should be `calculateMultiples.ts` (Damodaran-sourced, sub-industry granular). `deriveAssumptions.ts` and `evEbitda.ts` must call `calculateMultiples.ts` instead of maintaining local tables.

---

### F-02 — WACC weights hardcoded 70/30 in adapter.ts

**Severity:** HIGH  
**Category:** Calculation error

**Problem:**  
`lib/valuation/adapter.ts` line 55 computes WACC as:
```
WACC = costOfEquity * 0.7 + afterTaxCostOfDebt * 0.3
```
This assumes 70% equity / 30% debt for every company regardless of actual capital structure.

`lib/dcf/calculateWACC.ts` lines 26-29 correctly computes:
```
debtRatio = D/E / (1 + D/E)
equityRatio = 1 - debtRatio
WACC = equityRatio * Ke + debtRatio * Kd*(1-T)
```

**Impact:**  
For VIST specifically: VIST (Vista Oil & Gas) is a leveraged E&P company. Its actual D/E ratio is significantly higher than 30%. The hardcoded 30% debt weight understates the leverage impact on WACC, producing a lower discount rate and inflated fair value.

Generic example — a company with 60% debt weight:
- Correct WACC: 0.4 × 10% + 0.6 × 4% × (1-21%) = 4% + 1.9% = **5.9%**
- Hardcoded WACC: 0.7 × 10% + 0.3 × 4% × (1-21%) = 7% + 0.95% = **7.95%**
- Difference: +200bps — enormous for a DCF valuation

**Why it exists:**  
The adapter is used by the Valuation Lab methods (forwardPE, revenueMultiple), which discount future price back to present. These methods use `wacc` as a discount rate but don't fully recompute it — they pass through the pre-computed value from the API. The hardcoded 70/30 serves as a fallback when WACC wasn't computed from the API response, but it silently applies even when `calculateWACC.ts` result is available.

**Required fix:**  
Delete the hardcoded weights from `adapter.ts`. Always use the WACC value from `calculateWACC.ts` output (available as `waccRaw.wacc` from API). The adapter should never independently compute WACC — it should consume it.

---

### F-03 — net debt defaults to 0 when null in forward multiples

**Severity:** HIGH  
**Category:** Data integrity / silent assumption

**Problem:**  
Two valuation methods silently treat missing net debt as zero:

`lib/valuation/methods/evEbitda.ts` line 63:
```typescript
equityValue = enterpriseValue - (netDebt ?? 0)
```

`lib/valuation/methods/revenueMultiple.ts` line 72:
```typescript
effectiveNetDebt = netDebt ?? 0
```

Net debt zero means the model assumes the company has zero debt and zero cash — i.e., Enterprise Value = Equity Value. For any leveraged company (including VIST), this is wrong in both directions:
- If the company has significant debt with no cash: net debt is positive, equity value < EV → the model overstates equity value
- If the company has significant cash with little debt: net debt is negative, equity value > EV → the model understates equity value

**Impact on VIST:**  
VIST is a leveraged E&P company with meaningful debt. If `netDebt` is null (e.g., balance sheet unavailable), the EV/EBITDA and Revenue Multiple methods will overstate VIST's equity value by the full amount of its net debt.

**Contrast:**  
`lib/valuation/bridge.ts` line 39-41 correctly propagates null:
```typescript
equityValue = (enterpriseValue != null && cashM != null && debtM != null)
  ? enterpriseValue + cashM - debtM
  : null  // ← never silently defaults
```

**Required fix:**  
Both `evEbitda.ts` and `revenueMultiple.ts` must:
1. Return a `guardErrors` entry if `netDebt` is null: `"Net debt data unavailable — equity bridge cannot be computed"`
2. Set `equityValue = null` when net debt is null
3. Show an `NABadge reason="no-data"` in the UI for affected outputs
4. Optionally allow a manual override via the assumption drawer

---

### F-04 — CAGR derived three ways in three modules

**Severity:** HIGH  
**Category:** Architecture / consistency

**Problem:**  
Revenue CAGR is independently computed in three separate files:

1. **`lib/dcf/projectCashFlows.ts`** (`extractFCFInputs` → `blendedCagr`):
   - 4-source blend: analyst, historical, fundamental (ROE×retention), TTM earnings growth
   - Dynamic weights by analyst coverage (0 → 100 analyst quality)
   - Convergence discount: 25% haircut on excess above 20%
   - Size-based cap: revenue-dependent ($2B→55%, $50B→22%)
   - This is the most sophisticated derivation

2. **`lib/valuation/normalizeInputs.ts`** (line 107):
   - Uses `cagrAnalysis.blended` from the API response (derived from #1 above)
   - But falls back to `cagrAnalysis.blended ?? 0.05`
   - Applies additional statement-CAGR override for USD companies with ≥3 income rows (computed independently at lines 406-415)

3. **`lib/valuation/assumptions/deriveAssumptions.ts`** (`deriveCagr`):
   - Simpler: takes `cagrAnalysis.blended` or falls back to sector CAGR table
   - Source label: `numAnalysts >= 3 ? 'analyst_estimate' : 'historical_3y_median'` (line 77)
   - Does NOT apply convergence discount or size cap — uses the pre-discounted value

**Result:**  
- DCF model (FCFF/FCFE path) uses the sophisticated 4-source blend with convergence haircut
- Forward P/E and Revenue Multiple use `deriveAssumptions.ts` derivation (no haircut, no size cap)
- The two paths can produce materially different CAGRs for high-growth companies

**Example for a tech growth stock (100B revenue, raw blended 35%):**
- DCF path after convergence + size cap: ~22% (35% → 28.75% convergence → capped at 22%)
- Valuation Lab path: 35% (no haircut applied — takes raw blended directly)
- The ValuationLab Forward P/E would use a significantly more optimistic CAGR

**Required fix:**  
Expose the fully-processed CAGR from `projectCashFlows.ts` as a single field on the API response (`cagrAnalysis.blendedFinal` or similar). All methods — DCF, Forward P/E, Revenue Multiple — must use this same value. The convergence discount and size caps should apply to all methods equally or not at all.

---

### F-05 — calculateFairValue.ts converts null to 0 in division

**Severity:** HIGH  
**Category:** Calculation error / silent wrong answer

**Problem:**  
`lib/dcf/calculateFairValue.ts`:
- Line 25: `fairValuePerShare = equityValue / shares` — if shares == 0 (from null coercion), returns `Infinity` or `0`
- Line 26: `upside = (fairValue - price) / price` — if price == 0 (from null), returns `Infinity`
- Lines 29-31: `if (currentPrice <= 0 || fairValue <= 0): IRR = 0` — null masked as 0

This module is used in the older DCF path (`lib/dcf/`). If `sharesOutstanding` is null and coerced to 0 by any upstream caller, the division produces `Infinity` or `NaN` which may propagate to the UI or be silently stored as 0.

**Contrast:**  
`lib/valuation/bridge.ts` line 44-46 guards properly:
```typescript
fairValuePerShare = (equityValue != null && sharesM != null && sharesM !== 0)
  ? (equityValue / sharesM) * 1000
  : null
```

**Required fix:**  
`calculateFairValue.ts` must:
1. Guard `shares > 0` before dividing — return null if not met
2. Guard `currentPrice > 0` before computing upside — return null
3. Never coerce null to 0 for any denominator

---

### F-06 — Exit P/E always sourced as "sector_fallback"

**Severity:** MEDIUM  
**Category:** UX / provenance

**Problem:**  
`lib/valuation/assumptions/deriveAssumptions.ts` line 152:
```typescript
return { pe: target, evidence: '...', source: 'sector_fallback' }
```

The source is always `'sector_fallback'` even when the company's own current P/E is available in the response (`currentPE` parameter, line 146). The function receives the current P/E as context for the evidence text but never uses it to anchor or blend the exit P/E.

**What a better approach looks like:**
- If company's current TTM P/E is between 10x–60x: blend 50% company current PE + 50% sector median
- If company P/E is N/A or negative: use sector median, source `'sector_fallback'`
- If user overrides: source `'user_override'`

**Impact:**  
Users see "Sector Standard 25×" for all technology companies regardless of whether Apple (currently ~30×), or a micro-cap (currently 8×), or an unprofitable company (no P/E).

**Required fix:**  
Blend company P/E and sector P/E when company P/E is valid. Update source label to `'peer_median'` when both are used.

---

### F-07 — Tax rate clamping inconsistent

**Severity:** MEDIUM  
**Category:** Calculation inconsistency

**Files and bounds:**
| File | Tax Rate Bounds | Line |
|------|----------------|------|
| `lib/dcf/calculateWACC.ts` | [5%, 40%] | 96 |
| `lib/dcf/calculateScores.ts` | [5%, 40%] | 96 |
| `app/api/financials/route.ts` | [5%, **55%**] | 484 |
| `lib/valuation/normalizeInputs.ts` | median (no explicit clamp) | 223 |

The `financials/route.ts` allows up to 55% tax rate while WACC computation caps at 40%. For a company with a 45% effective tax rate (e.g., French firm), the tax shield on debt would be correctly computed as 45% in the income statement projection but capped at 40% in WACC's `afterTaxCostOfDebt = Kd * (1 - 40%)`. Minor but internally inconsistent.

**Required fix:**  
Standardize to `[5%, 40%]` across all modules. The 55% cap in `financials/route.ts` was likely meant to handle extreme one-time items — instead, filter those using TTM averaging.

---

### F-08 — ERP hardcoded with no date stamp

**Severity:** MEDIUM  
**Category:** Architecture / staleness

**Problem:**  
ERP is hardcoded in two places:
- `config/valuation.config.ts` line 36: `erp: 0.046` (Damodaran Jan 2025)
- `lib/dcf/calculateWACC.ts` line 102: `const erp = 0.046`

The value in `calculateWACC.ts` does not reference the config — it is a separate hardcode. The config value and WACC value could diverge if one is updated and the other is not. Additionally, Damodaran publishes an update every January. With no date stamp, the next developer won't know the value is stale.

**Required fix:**  
1. Delete the hardcode from `calculateWACC.ts` — it must import `VALUATION_CONFIG.erp`
2. Add `erpSource: string` field to config: `"Damodaran, January 2025"`
3. Add a console.warn if current date > 14 months after the ERP source date (annual update reminder)

---

### F-09 — Terminal value safety fallback is financially incoherent

**Severity:** MEDIUM  
**Category:** Calculation error / silent bad result

**Problem:**  
`lib/dcf/projectCashFlows.ts` line 69:
```typescript
TV = (wacc > terminalG)
  ? (lastCF * (1 + terminalG)) / (wacc - terminalG)
  : lastCF * 15  // ← silent fallback
```

If `wacc <= terminalG` (Gordon Growth violation), the code silently uses `FCF × 15` as terminal value. This is:
1. Financially wrong — 15× is an arbitrary pick that has no relationship to the actual discount rate situation
2. Opaque — the user sees a number with no indication it came from a fallback
3. Inconsistent with `lib/valuation/validator.ts` which correctly throws an error for `terminalG >= wacc` (V1)

The validator throws the error but only for the `lib/valuation` path. The `lib/dcf` path bypasses the validator.

**Required fix:**  
Remove the `lastCF * 15` fallback. If `wacc <= terminalG`, return `null` for terminal value and propagate the error as a `guardError`. The validator already handles this — the DCF path must run through the same validation.

---

### F-10 — Revenue CAGR displayed in 4+ places without reconciliation

**Severity:** MEDIUM  
**Category:** UX / consistency

**Locations where CAGR appears:**
1. `components/valuation/ValuationLab.tsx` line 837: "Revenue CAGR" assumption stat
2. `components/valuation/ValuationLab.tsx` lines 946-956: GrowthBar with blended breakdown
3. `components/modelling/ModellingWorkspace.tsx` line 374: toolbar CAGR control
4. `components/stock/CAGRAnalysis.tsx`: full derivation breakdown panel
5. Individual method cards (Forward P/E, Revenue Multiple): each has its own CAGR display

When the user opens the modelling workspace, the CAGR shown in the toolbar may differ from the CAGR shown in the ValuationLab (F-04 above). The user has no visibility into the discrepancy.

**Required fix:**  
Add a single canonical CAGR field to the API response. All UI components must read from the same field. When the user overrides CAGR in one place, all other displays must either update to match or explicitly label the override.

---

### F-11 — recalculate/route.ts uses mock WACC inputs

**Severity:** MEDIUM  
**Category:** Architecture / incorrect recalculation

**Problem:**  
`app/api/recalculate/route.ts` lines 56-67 constructs a mock WACC object:
```typescript
rfRate: 0.045
beta: 1.0
erp: 0.055
crp: 0
costOfDebt: 0.04
taxRate: 0.21
debtToEquity: 0.25
```

This endpoint is called when the user adjusts CAGR/WACC/terminalG in the ModellingWorkspace. When the user overrides WACC to, say, 9%, the scenario builder in `recalculate` reconstructs a mock WACC object with hardcoded component assumptions to build the WACC breakdown for display purposes.

The problem: these mock values are not the actual WACC inputs for the stock. VIST has a different beta, different D/E, different country risk premium (Mexico/Argentina operations). The WACC breakdown shown after override will be misleading — the right override response should just apply the override as a scalar and not attempt to reconstruct decomposition.

**Required fix:**  
The recalculate endpoint should accept the actual computed WACC components from the initial `/api/financials` response. Store them in frontend state and pass them to the recalculate endpoint. Do not reconstruct from defaults.

---

### F-12 — Market cap used as fallback for enterprise value in WACC

**Severity:** MEDIUM  
**Category:** EV/equity confusion

**Problem:**  
`lib/dcf/calculateWACC.ts` extracts market cap for D/E weight computation from:
```typescript
sd.marketCap ?? ks.enterpriseValue
```

Using `enterpriseValue` as a fallback for `marketCap` in the WACC equity weight calculation is wrong. Enterprise value = market cap + net debt. Using EV as the equity denominator overstates the equity weight and understates the debt weight, producing a WACC that is too close to cost of equity (ignores leverage).

For a leveraged company with $5B market cap and $3B net debt:
- Correct equity weight: 5/(5+3) = 62.5%
- With EV as "market cap": 8/(8+3) = 72.7% (overstates by 10pp)

**Required fix:**  
Never use `enterpriseValue` as a fallback for `marketCap`. If market cap is unavailable, compute it as `currentPrice × sharesOutstanding`. If price or shares are also unavailable, mark WACC as unreliable and return a warning.

---

### F-13 — FCFE uses net income × 0.90 without transparency

**Severity:** LOW  
**Category:** Calculation / documentation

**Problem:**  
`lib/dcf/calculateFCFE.ts` line 52:
```typescript
baseFCFE = netIncomeM * 0.90
```

The 10% haircut from net income to FCFE is a rough proxy for the capex/NWC/debt repayment deductions that would normally be computed explicitly. It's a reasonable heuristic but:
1. It's not documented in the UI — the user sees "FCFE" without knowing it's a net income proxy
2. It's not calibrated per company type — a capital-light software firm might have FCFE = 95% of net income; a capital-intensive manufacturer might have FCFE = 50%
3. The 15%/20% yield caps (lines 58-59) have no documentation

**Required fix:**  
Either compute FCFE properly from the income statement + capex + NWC + debt changes (as `lib/valuation/leveredDcf.ts` does), or document the proxy prominently in the UI with a "Proxy" badge and methodology note.

---

### F-14 — Terminal value residual % warning lacks explanation

**Severity:** LOW  
**Category:** UX

**Problem:**  
`components/modelling/TerminalValuePanel.tsx` line 66 shows a warning icon when `residualPct > 0.75` (75% of EV from terminal value) but provides no text explanation of why this is a concern or what the user should do.

**Required fix:**  
Add tooltip or inline text: "Terminal value represents over 75% of enterprise value, making the valuation sensitive to growth and discount rate assumptions. Consider stress-testing assumptions."

---

### F-15 — Sector CAGR fallback table vs sophisticated blending

**Severity:** LOW  
**Category:** Architecture / consistency

**Problem:**  
`lib/valuation/assumptions/deriveAssumptions.ts` SECTOR_CAGR table (lines 29-41) is used as the final fallback when no `cagrAnalysis` is present. Its values (Tech=12%, Healthcare=8%, Energy=3%) are plausible but:
1. Not sourced from any external reference (pure author judgment)
2. Inconsistent with the sophisticated blending in `projectCashFlows.ts` which handles analyst coverage, convergence haircut, and size caps
3. Used in the ValuationLab but not in the DCF path

When both paths run on the same stock without analyst data, they'll use different CAGR defaults.

**Required fix:**  
If `cagrAnalysis` is fully absent (no analysts, no historical), the CAGR should be labeled `'unavailable'` with a null value, and the method should show "Insufficient data" rather than silently applying a sector default.

---

### F-16 — EditableCell silently discards NaN input

**Severity:** LOW  
**Category:** UX

**Problem:**  
`components/modelling/ForecastTable.tsx` line 172:
```typescript
const v = parseFloat(raw)
```
If `raw` is not a valid number (e.g., user types "abc" or ""), `parseFloat` returns `NaN`. The current behavior silently discards the edit. User receives no feedback.

**Required fix:**  
Show inline validation error: "Please enter a valid number." Keep the cell in edit mode until input is valid or user cancels.

---

### F-17 — Dilution rate not shown in output bridge

**Severity:** LOW  
**Category:** UX / transparency

**Problem:**  
`lib/valuation/methods/forwardPE.ts` line 73:
```typescript
futureShares = sharesOutstanding * Math.pow(1 + dilutionRate, N)
```

Dilution is applied but not shown in the ValuationLab output. For a 3% annual dilution rate over 5 years, shares outstanding grows by ~16%, reducing the per-share value by the same amount. This is material, especially for growth-stage companies.

**Required fix:**  
Add a "Share count (5Y projected)" line to the Forward P/E method output display, showing current shares, annual dilution rate, and projected shares.

---

### F-18 — fedFundsTarget hardcoded

**Severity:** LOW  
**Category:** Staleness

**Problem:**  
`app/api/market-context/route.ts` line 219: `fedFundsTarget: 4.33`

This is a hardcoded value that will be silently wrong after any Fed meeting. As of May 2026 the actual target range may differ.

**Required fix:**  
Fetch `FEDFUNDS` from FRED alongside `dgs2`, or at minimum add a `fedFundsDate: '2024-Q4'` field so users know the staleness.

---

## VIST Validation — Expected Issues

VIST (Vista Oil & Gas, NYSE) is an Energy sector Latin American E&P company. It exercises several edge cases:

| Edge Case | Expected Impact |
|-----------|----------------|
| Non-USD reporter (ARS/USD) | FX rate conversion path exercised; historical CAGR zeroed out |
| Leveraged balance sheet (E&P company) | F-02 WACC weights and F-03 net debt default both material |
| Country risk premium (Argentina/Mexico) | CRP adds to WACC; must not be 0 |
| Low/negative FCF periods (capex-heavy) | Terminal value dominance warning (F-14) likely |
| Energy sector exit multiples | F-01 discrepancy: 1.5× vs 1.3× EV/Revenue |
| Small analyst coverage | CAGR blending weights toward historical (F-04 path difference) |

---

## Summary Priority

**Fix immediately (HIGH):**
1. F-01: Consolidate all exit multiple tables into `calculateMultiples.ts`
2. F-02: Remove hardcoded 70/30 from adapter.ts; use computed WACC
3. F-03: Require net debt; never default to 0 in equity bridge

**Fix in next pass (MEDIUM):**
4. F-04: Expose single canonical CAGR from API; all methods consume it
5. F-05: Guard null/zero in calculateFairValue.ts
6. F-07: Standardize tax rate clamp to [5%, 40%]
7. F-08: Consolidate ERP to config; add date stamp; delete duplicate
8. F-09: Remove FCF×15 fallback; propagate null + error
9. F-11: Pass actual WACC components to recalculate endpoint
10. F-12: Never use enterpriseValue as market cap proxy

**Fix later (LOW):**
11. F-06: Blend company PE into exit PE when valid
12. F-10: Single canonical CAGR in UI
13. F-13: Document FCFE proxy or replace with proper computation
14-18: Remaining low-priority UX fixes
