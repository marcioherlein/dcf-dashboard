# Valuation Consistency Matrix

> Generated: 2026-05-19  
> Each row tracks one business concept across all locations it appears.  
> "Expected to match" = YES means values should be identical; NO means intentional methodological difference is acceptable but must be labeled.

---

## 1. Revenue CAGR

| Location | File | How Derived | Source Label Shown | Expected to Match |
|----------|------|-------------|-------------------|-------------------|
| Main DCF (FCFF/FCFE) | `lib/dcf/projectCashFlows.ts` | 4-source blend: analyst + historical + fundamental + TTM; convergence haircut; size cap | `cagrAnalysis.confidenceLabel` (High/Medium/Low) | **Canonical** |
| ModellingWorkspace toolbar | `components/modelling/ModellingWorkspace.tsx:374` | Reads `cagr` from `baseInput` (which is `cagrAnalysis.blended`) | None — just a percentage | Must match canonical |
| CAGR Analysis panel | `components/stock/CAGRAnalysis.tsx` | Reads `cagrAnalysis` object from API; renders breakdown rows | Source per row (analyst, historical, fundamental) | Must match canonical |
| ValuationLab Forward P/E | `lib/valuation/assumptions/deriveAssumptions.ts:75` | Reads `cagrAnalysis.blended` directly — **no convergence haircut, no size cap** | `'analyst_estimate'` or `'historical_3y_median'` | **MISMATCH** vs canonical |
| ValuationLab Revenue Multiple | Same as above | Same derivation path | Same | **MISMATCH** |
| Scenario Bear | `config/valuation.config.ts:69` | Canonical - 2pp | Implied by "Bear scenario" label | Acceptable methodological difference |
| Scenario Bull | `config/valuation.config.ts:67` | Canonical + 2pp | Implied by "Bull scenario" label | Acceptable methodological difference |
| normalizeInputs.ts (forecast table seed) | `lib/valuation/normalizeInputs.ts:107` | `cagrAnalysis.blended ?? 0.05` plus optional statement-CAGR override for USD companies | Not shown to user | Must match canonical |

**Current mismatch:** ValuationLab methods use `cagrAnalysis.blended` (raw, no haircut). The main DCF uses `cagrAnalysis.blended` which was already haircut-applied inside `projectCashFlows.ts` before being returned. The ValuationLab then takes this same value and applies NO further haircut — so both should actually be consistent IF the API returns the post-haircut blended value. However, the SECTOR_CAGR fallback path in `deriveAssumptions.ts` bypasses the convergence logic entirely when `cagrAnalysis` is null.

**Required correction:**  
1. The API must always return `cagrAnalysis.blended` as the post-haircut, post-cap value
2. `deriveAssumptions.ts` fallback when `cagrAnalysis` is null must not apply sector table defaults silently — return null with a warning
3. `normalizeInputs.ts` statement-CAGR override must be applied equally or disabled

---

## 2. Exit P/E Multiple

| Location | File | Value (Technology example) | Source | Expected to Match |
|----------|------|---------------------------|--------|-------------------|
| ValuationLab Forward P/E | `lib/valuation/assumptions/deriveAssumptions.ts:14` | **25×** | `SECTOR_PE` table (11 buckets) | Canonical? |
| DCF Multiples engine | `lib/dcf/calculateMultiples.ts` sector fallback | **28×** | Damodaran Jan-2025, 11-sector aggregated fallback | **MISMATCH** |
| DCF Multiples engine (sub-industry) | `lib/dcf/calculateMultiples.ts` | 38× (Software—App), 22× (IT Services), etc. | Damodaran Jan-2025, 100+ sub-industry | More precise |

**Gap:** ValuationLab Forward P/E always uses the broad-sector table (11 rows). The DCF multiples engine can use a sub-industry P/E (100+ rows) when the Yahoo Finance `industry` field matches. This means the same stock can show P/E 25× in the ValuationLab and 38× in the DCF multiples panel.

**Acceptable differences:**
- DCF multiples method uses current/TTM PE as reference; Forward P/E uses an exit PE projected 5 years out. A forward exit PE can reasonably be lower than today's PE if mean-reversion is expected. This is a methodological difference that must be labeled.

**Required correction:**
- ValuationLab exit PE must use the same source as DCF multiples. Sub-industry preferred over sector bucket.
- Label in drawer: "Exit P/E: 25× — sector median (Technology, Damodaran 2025). Sub-industry not matched."
- When company's current PE is valid, show: "Blended with company current PE 30× → exit PE 27×"

---

## 3. Exit EV/Revenue Multiple

| Location | File | Value (Technology) | Value (Energy) | Source |
|----------|------|--------------------|----------------|--------|
| ValuationLab Revenue Multiple | `deriveAssumptions.ts:46` | **8.0×** | **1.5×** | Author-defined sector buckets |
| DCF Multiples engine | `calculateMultiples.ts` sector fallback | **6.0×** | **1.3×** | Damodaran Jan-2025 |
| DCF Multiples engine (sub-industry) | `calculateMultiples.ts` | 7.0× (Software—Infra), 3.0× (IT Services) | 1.2× (E&P), 2.8× (Midstream) | Damodaran Jan-2025 |

**Gap:** Technology 8× vs 6× is a 33% difference in implied enterprise value. Energy 1.5× vs 1.3× is a 15% difference — material for a high-revenue E&P like VIST.

**VIST specific:** At Energy sector, `deriveAssumptions.ts` returns 1.5× while `calculateMultiples.ts` returns 1.3× (sector fallback) or 1.2× (E&P sub-industry). If VIST's TTM revenue is $2B, the difference in implied EV:
- 1.5× → $3.0B EV
- 1.2× → $2.4B EV
- Difference: $600M in implied EV — not cosmetic

**Required correction:**
All three tables must be unified. Single source: `calculateMultiples.ts` (Damodaran-sourced). `deriveAssumptions.ts` must import from `calculateMultiples.ts`.

---

## 4. Exit EV/EBITDA Multiple

| Location | File | Value (Technology) | Value (Energy) | Source |
|----------|------|--------------------|----------------|--------|
| ValuationLab EV/EBITDA | `evEbitda.ts:12` | **20×** | **8×** | Local table (no citation) |
| DCF Multiples engine | `calculateMultiples.ts` sector fallback | **20×** | **8×** | Damodaran Jan-2025 |

This is the one metric that HAPPENS to match at the sector level. But sub-industry within Technology can range from 12× (Computer Hardware) to 28× (Software—Application), and neither module uses sub-industry. The match is coincidental.

**Required correction:**
`evEbitda.ts` should import `getMultiplesByIndustry()` from `calculateMultiples.ts` for sub-industry precision, rather than maintaining its own 11-row table.

---

## 5. Net Debt (for EV→Equity Bridge)

| Location | File | Null Behavior | Source |
|----------|------|---------------|--------|
| FCFF DCF (engine.ts) | `lib/valuation/engine.ts:155` | `equityValueM = evM + cashM - totalDebtM` — crashes if null | `apiData.cashM`, `apiData.totalDebtM` |
| FCFE DCF (bridge.ts) | `lib/valuation/bridge.ts:39-41` | Returns null — never defaults | Same |
| EV/EBITDA | `lib/valuation/methods/evEbitda.ts:63` | **Defaults to 0** | `inputs.netDebt` |
| Revenue Multiple | `lib/valuation/methods/revenueMultiple.ts:72` | **Defaults to 0** | `inputs.netDebt` |
| Forward P/E | `lib/valuation/methods/forwardPE.ts` | Not used — pure equity method | N/A |

**Inconsistency:**  
EV/EBITDA and Revenue Multiple are enterprise-value methods that require a net debt figure to reach equity value. Bridge.ts is correct (returns null). EV/EBITDA and Revenue Multiple are wrong (default to 0).

**Acceptable differences:**
- Forward P/E does not need net debt — it computes equity value directly (NI × PE = market cap). This is intentional and correct.

**Required correction:**
EV/EBITDA and Revenue Multiple must return null equity value when net debt is null. Show "Equity Value: Unavailable (net debt data missing)" in the UI.

---

## 6. Shares Outstanding (Diluted)

| Location | File | Value Used | Dilution Applied |
|----------|------|-----------|-----------------|
| FCFF/FCFE DCF bridge | `lib/valuation/bridge.ts:44-46` | `sharesM` from `normalizeInputs` — current diluted shares | No (point-in-time) |
| Forward P/E (5Y) | `lib/valuation/methods/forwardPE.ts:73` | `sharesOutstanding` × `(1+dilutionRate)^5` | **Yes** — 5-year dilution |
| Revenue Multiple (5Y) | `lib/valuation/methods/revenueMultiple.ts:74` | Same dilution formula | **Yes** |
| EV/EBITDA (TTM) | `lib/valuation/methods/evEbitda.ts:64` | `inputs.shares` — current undiluted | No |
| ValuationLab consensus weight | `lib/valuation/engine.ts:355+` | Current shares from API response | No |

**Inconsistency:**  
Forward P/E and Revenue Multiple are 5-year methods and correctly account for dilution. EV/EBITDA is a TTM-based method and correctly uses current shares. The FCFF DCF also projects 5 years but uses current shares (no dilution) — this understates the dilution effect in the DCF model.

**Acceptable differences:**
- EV/EBITDA is a spot valuation (not a forward model) — current shares is correct
- Forward P/E over 5 years should apply dilution — correct

**Required correction:**
FCFF/FCFE DCF should also apply projected dilution for the forecast period when computing fair value per share. Currently it divides a 5-year-forward equity value by today's share count. The share count should be `currentShares × (1+dilutionRate)^N` consistent with how Forward P/E does it.

---

## 7. WACC

| Location | File | Computation | Debt Weight |
|----------|------|-------------|------------|
| Main DCF path | `lib/dcf/calculateWACC.ts:26-29` | `E/(E+D) × Ke + D/(E+D) × Kd*(1-T)` | **Actual D/E derived** |
| Adapter fallback | `lib/valuation/adapter.ts:55` | `0.7 × Ke + 0.3 × Kd*(1-T)` | **Hardcoded 30% debt** |
| Recalculate endpoint | `app/api/recalculate/route.ts:67` | Mock D/E = 0.25 | **Hardcoded 25% debt** |
| Terminal growth clamp | `lib/valuation/terminalValue.ts` | Uses `wacc` from passed-in parameter | Inherited from caller |

**Three different WACC formulations** for what should be the same WACC:
- Main DCF: uses actual D/E
- Adapter: hardcodes 70/30
- Recalculate: hardcodes mock inputs

For VIST (a leveraged E&P), D/E is likely 40-60%. Hardcoding 30% debt weight materially misstates WACC.

---

## 8. Tax Rate

| Location | File | Range Enforced | Default |
|----------|------|---------------|---------|
| WACC computation | `calculateWACC.ts:96` | [5%, 40%] | 21% |
| Altman/Piotroski scores | `calculateScores.ts:96` | [5%, 40%] | None |
| Income statement projection | `financials/route.ts:484` | [5%, **55%**] | clamp of actual |
| NOPAT in ForecastTable | `unleveredDcf.ts:57` | Row-level or global taxRate | Inherited |

**Discrepancy:** Income statement projects NOPAT using up to 55% tax rate; WACC uses up to 40%. If a company has a 45% blended tax rate:
- After-tax cost of debt in WACC: `Kd × (1 - 40%) = 60%` of pre-tax cost
- NOPAT in cash flows: `EBIT × (1 - 45%) = 55%` of EBIT
- These two rates should be the same for internal consistency

**Required correction:** Standardize to [5%, 40%] everywhere, or raise the WACC cap to 55% to match the projection cap. The former is preferred (40% is already conservative for most jurisdictions).

---

## 9. Equity Risk Premium

| Location | File | Value | Source |
|----------|------|-------|--------|
| Config | `config/valuation.config.ts:36` | 4.6% | Damodaran Jan 2025 |
| WACC computation | `calculateWACC.ts:102` | **4.6%** (separate hardcode) | No reference to config |
| Recalculate endpoint | `app/api/recalculate/route.ts:63` | **5.5%** | No source — different value |
| WACC evidence text | `deriveAssumptions.ts:181` | `erp: 0.055` (5.5%) | No source — different value |

**Three different ERP values:** 4.6% (config), 4.6% (WACC), 5.5% (recalculate), 5.5% (evidence text).

The recalculate endpoint and deriveAssumptions.ts evidence text use **5.5%** ERP while the actual WACC computation uses **4.6%** ERP. This means the displayed WACC evidence text will show a different computation than the actual WACC used in the model — a direct contradiction shown to the user.

**Required correction:**
1. All ERP references must import from `VALUATION_CONFIG.erp` (4.6%)
2. Delete standalone hardcodes in `calculateWACC.ts` and `recalculate/route.ts`
3. Update `deriveAssumptions.ts` evidence text to use 4.6%

---

## 10. Terminal Growth Rate

| Location | File | Value/Range | Source |
|----------|------|-------------|--------|
| API assignment | `financials/route.ts:79-83` | 2.5% (CAGR>15%), 2.0% (5-15%), 1.5% (<5%) | 3-tier rule based on CAGR |
| Config bounds | `valuation.config.ts:44-46` | High=2.5%, Standard=2.0%, Mature=1.5% | Config |
| Terminal G clamp | `validator.ts:123` | `min(terminalG, wacc - 0.5%)` | Safety guard |
| ModdellingWorkspace | `ModellingWorkspace.tsx` | User editable, 0–15% allowed | User override |
| Forecast table display | `ForecastTable.tsx:969` | Shows value but not source | No label |
| Perpetuity formula | `terminalValue.ts:65` | `FCF×(1+g)/(WACC-g)` | Gordon Growth |
| projectCashFlows.ts | `projectCashFlows.ts:69` | Falls back to FCF×15 if WACC≤g | **Wrong fallback** |

**Inconsistency:** Two safety mechanisms for `g ≥ WACC`:
- `lib/valuation/validator.ts`: throws a hard error (correct)
- `lib/dcf/projectCashFlows.ts`: silently uses FCF×15 (wrong)

Both paths can be exercised on the same stock depending on which code runs first. The user might get an error in the modelling workspace but no error in the simpler DCF path.

**Required correction:** Remove the `FCF×15` fallback. Unify error handling: all paths must use the same validator.

---

## 11. Base FCF (starting point for DCF)

| Location | File | Derivation | Null Handling |
|----------|------|-----------|---------------|
| Main orchestration | `financials/route.ts:70-76` | TTM FCF from statements; yield-capped at 15% of market cap | FCF yield cap applied |
| projectCashFlows.ts (financial) | Line 145 | `netIncomeM × 0.85` | If NI ≤ 0: fallback to `rev × 0.02` |
| projectCashFlows.ts (non-financial) | Line 154-159 | TTM FCF; if ≤ 0: OCF × 0.6; if ≤ 0: `rev × 0.02` | 3-level cascade |
| normalizeInputs.ts | Lines 124-130 | `ttmFCF / 1e6 * fxRate` | Inherits from API |
| adapter.ts | Line 59 | `apiData.baseFCF ?? 5%` fallback | 5% hardcoded |
| calculateFCFE.ts | Line 52 | `netIncomeM × 0.90` | Net income proxy |

**Inconsistency:**
- Financial sector: `NI × 0.85` (projectCashFlows) vs `NI × 0.90` (calculateFCFE) — different haircuts for the same concept on the same company
- Non-financial fallback: `rev × 0.02` (2% revenue margin) in projectCashFlows but `0.05` (5% CAGR fallback) in adapter.ts — different approaches
- FCF yield cap: applied in `financials/route.ts` before all models, so all models receive the same capped value — correct

**Required correction:**
- Standardize financial sector FCFE haircut to one value. Either 85% or 90%, but not both.
- Document the haircut in the UI: "Base FCFE estimated as 85% of normalized net income (financial sector proxy)"

---

## 12. Market Cap vs Enterprise Value Distinction

| Metric | Correct Formula | Where Used Correctly | Where Misused |
|--------|----------------|---------------------|--------------|
| Enterprise Value (EV) | Market cap + Net Debt | `bridge.ts`, `engine.ts`, `projectCashFlows.ts` | `calculateWACC.ts` line (marketCap ?? enterpriseValue) |
| Equity Value | EV − Net Debt | `bridge.ts:39-41` | `evEbitda.ts:63` (netDebt ?? 0) |
| Per Share | Equity Value / Diluted Shares | `bridge.ts:44-46` | `calculateFairValue.ts` (null→0) |
| WACC Equity Weight | Market Cap / (Market Cap + Total Debt) | `calculateWACC.ts:27` | `adapter.ts:55` (hardcoded 0.7) |

**Summary:** The EV/equity distinction is mostly correct in the newer `lib/valuation/` path. Issues are concentrated in: (1) the older `lib/dcf/calculateFairValue.ts`, (2) the WACC fallback in `adapter.ts`, and (3) the market cap / EV confusion in `calculateWACC.ts` field extraction.

---

## 13. WACC Evidence Text vs Actual WACC Computation

| Component | ERP Used | RF Used |
|-----------|---------|---------|
| Actual WACC calculation (`calculateWACC.ts`) | 4.6% (config) | FRED 10Y |
| Evidence text shown to user (`deriveAssumptions.ts:181`) | **5.5%** | 4.5% (hardcoded) |
| Recalculate endpoint mock (`recalculate/route.ts:63`) | **5.5%** | 4.5% (hardcoded) |

**User sees WACC decomposition with ERP=5.5%, but actual WACC uses ERP=4.6%.** The displayed breakdown is inconsistent with the model. For a stock with beta=1.2: 
- Displayed cost of equity: 4.5% + 1.2×5.5% = 11.1%
- Actual cost of equity: ~4.3% (FRED) + 1.2×4.6% = 9.8%
- The breakdown shown is 1.3pp higher than what the model actually uses

---

## Correction Priority

| Finding | Files Affected | Effort | Priority |
|---------|---------------|--------|----------|
| Consolidate exit multiple tables | deriveAssumptions.ts, evEbitda.ts → calculateMultiples.ts | Medium | P1 |
| Fix net debt default-to-0 | evEbitda.ts, revenueMultiple.ts | Small | P1 |
| Fix ERP consistency | calculateWACC.ts, recalculate/route.ts, deriveAssumptions.ts | Small | P1 |
| Fix WACC weights in adapter.ts | adapter.ts | Small | P1 |
| Remove FCF×15 fallback | projectCashFlows.ts | Small | P1 |
| Standardize tax rate clamp | calculateWACC.ts, financials/route.ts | Small | P2 |
| Unify FCFE haircut (85% vs 90%) | projectCashFlows.ts, calculateFCFE.ts | Small | P2 |
| Apply dilution in FCFF DCF share count | engine.ts, bridge.ts | Medium | P2 |
| Fix market cap/EV confusion in WACC | calculateWACC.ts | Small | P2 |
| Add net debt null warning to UI | evEbitda display, revenueMultiple display | Medium | P2 |
| Expose single canonical CAGR from API | financials/route.ts, normalizeInputs.ts | Medium | P3 |
| Sub-industry P/E for ValuationLab | deriveAssumptions.ts | Medium | P3 |
