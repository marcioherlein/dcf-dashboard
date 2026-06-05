# Valuation Audit Agent — Master Prompt

## Usage

```
/audit-valuation [TICKER]
```

If no ticker is provided, the agent must ask:

> "Which stock should I audit? Provide a ticker and I'll run the full valuation model audit against the real computed values for that company."

Once a ticker is given, run all three phases below in order. Every finding must reference actual numbers — not hypotheticals — derived from what the code computes for this specific company.

---

## Step 0 — Self-Improvement Bootstrap (run before every audit)

This agent improves itself. Before running any audit phase:

**0A. Load confirmed prior findings**

Read `testing/findings/audit-log.md`. Extract every finding where:
- `Status: confirmed` (≥ 2 runs) or `Status: integrated`
- `Agent: audit-valuation`

Treat these as additional checks to run during the audit, even if they are not yet
written into the phases below. Prior findings are the accumulated institutional memory
of every previous audit run.

**0B. Increment run count for any finding you reproduce**

If you observe the same issue described in a prior finding, update that finding's
`Run count:` and `Status:` in `testing/findings/audit-log.md` before producing the
final summary. Use the exact finding number so it stays grep-able.

**0C. Record new findings at the end of the run**

After completing all phases, write every novel issue found (not already in the log)
to `testing/findings/audit-log.md` using this format:

```
### Finding [N]: [Short title]
**Agent:** audit-valuation
**Date:** YYYY-MM-DD
**Ticker / Context:** [what triggered it]
**Run count:** 1
**Status:** new

**Observed:** [what the code actually does — include actual values]
**Expected / correct behaviour:** [what it should do]
**File / location:** [file:line if applicable]
**Suggested check to add:** [exact phrasing for the template]
```

To get the next finding number: grep the log for `### Finding` and increment the
highest number found.

**0D. Integrate confirmed findings into this template**

If any finding in the log has `Run count: 2` or higher and `Status: confirmed`:
1. Find the right section in this file (`testing/valuation-audit-agent.md`) based
   on the finding's phase/area
2. Insert the check (using the finding's `Suggested check to add:` text)
3. Update the finding's `Status:` from `confirmed` → `integrated`
4. Re-sync this file to `.claude/commands/audit-valuation.md` by overwriting it with
   the updated content of `testing/valuation-audit-agent.md`

**0E. Sync to command**

After any write to `testing/valuation-audit-agent.md`, always overwrite
`.claude/commands/audit-valuation.md` with the identical content so the slash
command stays current.

---

## Setup: Data Acquisition

Before auditing anything, fetch real data for the ticker:

1. Call `GET /api/financials?ticker={TICKER}` from the local dev server (port 3000). This returns the full `apiData` object the app uses — WACC inputs, cagrAnalysis, businessProfile, financialStatements, valuationMethods, quote, etc.
2. If the API is not running or times out, read the relevant source files to reconstruct what the data pipeline would produce for this company based on Yahoo Finance field names and the extraction logic in `app/api/financials/route.ts`.
3. Identify the `companyType` the app assigns to this stock by tracing `detectCompanyType` in `lib/dcf/detectCompanyType.ts` with the actual sector and industry Yahoo returns for this ticker.

Read these files in full before starting:
- `lib/dcf/detectCompanyType.ts`
- `lib/valuation/cockpit.ts`
- `lib/valuation/cockpitBuilders.ts`
- `lib/valuation/assumptions/deriveAssumptions.ts`
- `lib/dcf/projectCashFlows.ts`
- `lib/valuation/normalizeInputs.ts`
- `lib/valuation/unleveredDcf.ts`
- `lib/dcf/calculateMultiples.ts`
- `lib/dcf/calculateFCFE.ts`

Then invoke `/creating-financial-models` to load the financial modeling framework before evaluating the DCF line structure.

---

## Phase 1 — Company Classification Audit

### 1A. companyType assignment

State:
- What Yahoo returns for `sector` and `industry` for this ticker
- Which branch of `detectCompanyType.ts` fires and why
- The resulting `companyType`
- Whether this classification is financially correct for this company. If not, which type should it be and why?
- Any edge cases where this company straddles two types (e.g. MELI = growth + fintech hybrid, BABA = standard but China risk-discounted)

### 1B. COCKPIT_WEIGHTS for this companyType

State the active weight table:
```
forward_pe: X%, ev_ebitda: X%, revenue_multiple: X%, core_dcf: X%
```

For each weight:
- Is this method valid for this company? (e.g. Forward P/E with negative earnings → excluded, P/B for a standard tech company → zero-weighted)
- Is the weight too high or too low given the company's business model?
- Does `getEffectiveWeights` modify the base weights (EBITDA margin < 8% reduction, fintech auto-promotion)? Does the modification fire for this stock? Is it correct?
- Name one stock where this same weight table would produce a wrong answer, and explain why

### 1C. FOUR_MODEL_DCF_WEIGHTS for this companyType

State the active Full DCF blend:
```
ufcfPGM: X%, ufcfEM: X%, lfcfPGM: X%, lfcfEM: X%
```

- Is the UFCF vs LFCF split appropriate for this company?
- For financial/fintech companies: LFCF should dominate. Does it? Is 85-90% LFCF weighting correct?
- For standard/growth companies: UFCF dominates. Does the exit-multiple vs perpetuity-growth split reflect the company's terminal value uncertainty?
- What would the blended fair value look like if the weights were wrong (e.g. 50/50 UFCF/LFCF for a bank)?

---

## Phase 2 — Pre-set Assumption Audit

For each seeded assumption, state the actual computed value for this ticker, then evaluate it.

### 2A. CAGR

- What does `cagrAnalysis.blended` equal for this company?
- How was it derived? (analyst blend weights, historical blend, convergence discount, size cap — trace the exact path in `extractFCFInputs` in `projectCashFlows.ts`)
- Is a cyclical sector cap firing (Energy/Basic Materials → 8%)? Should it?
- Is a financial sector cap firing (mature bank → 12%)? Should it?
- Is the convergence discount (`excess × 0.75` above 20%) appropriate here, or is this a company where 30%+ CAGR is structurally defensible for 5+ years?
- Is the foreignCurrency path followed (TSM=TWD, BABA=CNY-underlying, RMS=EUR)? Does it produce a USD-correct CAGR?
- Is the seeded CAGR in the Cockpit consistent with the CAGR used in the Full DCF Table `normalizeInputs.ts`? If there is a discrepancy, state the values and explain why they differ.

### 2B. Exit P/E (exitPE)

- What industry does `getIndustryMultiples` receive, and what `sectorPE` does it return?
- What is the current TTM P/E from Yahoo, and is it valid (positive, <200×)?
- What does `blendExitMultiple` return? (55% current + 35% geo-discounted sector)
- Does the thin-margin cap fire (`isThinMargin && isPEElevated`)? Should it?
- Does the fintech floor fire (22×)? Should it?
- Does the AI semi premium fire (38×, gated at revenueM≥100)? Should it?
- Does the growth premium fire (CAGR>25% + fintech/high-growth-financial)? What value does it add?
- Is the final `exitPE` financially sensible for this company's maturity and growth stage?

### 2C. Exit EV/EBITDA (exitMultiple)

- What `sectorMedian` does `blendEVEBITDAMultiple` receive?
- What is the current actual EV/EBITDA from Yahoo?
- What does the blend produce?
- Does the low-multiple company floor (`currentMultiple × 0.90` when current < sector × 0.40) fire? Should it?
- If EBITDA is negative: is the method excluded? (`ttmEbitdaDollars <= 0` guard)
- Is the exit multiple sensible for a terminal value calculation 5-10 years out?

### 2D. EV/Revenue (revenueMultiple)

- What `sectorEVRev` is used?
- What is the current actual EV/Revenue?
- What does the blend produce?
- Is the revenue multiple zero-weighted for this companyType? (financial=0%, utility=0%) If it is non-zero, is that appropriate?

### 2E. Net Margin (netMargin)

- What is the actual last trailing net margin from `incomeStatement` rows?
- Which path in `deriveNetMargin` fires? (pre-profit, isHighGrowthSaaS, hasMoat+isHighGrowth, stable)
- What is the projected exit margin?
- Is the 70% cap relevant here?
- Is the isHighGrowthSaaS boundary (cagr>15%, GM>60%, 0<margin<15%) applicable? Does it produce a sensible convergence toward 18%?
- For financial companies: is the margin derived from NI/revenue correct when "revenue" = NII + fees?

### 2F. WACC and Terminal Growth Rate

- What is the WACC input? (beta, rfRate, ERP, CRP, costOfDebt, debtWeight)
- Is the CRP non-zero for country-risk stocks (TSM, BABA, PDD, NU, MELI)? What value?
- Is the terminal growth rate `terminalG` consistent with the long-run nominal growth expectation for this company's primary market?
- Does `dynamicTerminalFade` modify terminalG for the Full DCF Table terminal value? (cagr>35%→12%, >25%→8%, >15%→6%, else→user value)
- Is the 200bps minimum WACC-g spread enforced in both the Cockpit and Full DCF paths?

### 2F. Dilution Rate

- What rate is seeded? (0% for mega-cap buyback, 1%/2%/3% by tech margin tier)
- Is it correct for this company's actual share count trajectory?

### 2G. P/B (if applicable — financial/fintech companyType only)

- What `bookValuePerShare` is used? Does the sanity cap fire (impliedPB < 0.25)?
- What ROE and Ke feed the justified P/B formula? What is the result?
- What `sectorDefaultPB` is used from the INDUSTRY_PB / FINANCIAL_SECTORS_PB lookup?
- What is the blended P/B target? Is it financially defensible for this company's ROE vs cost of equity?

---

## Phase 3 — Full DCF Table Line-by-Line Audit

Using the actual `buildProjectedRows` output for this ticker, evaluate every row. State the actual values for historical years AND the first 3 projected years.

For each row, answer:
- **(a) Present and correct?** — state the actual formula and verify it against financial modeling theory
- **(b) Missing when it should exist?** — name the row, explain why it belongs in this model type, and state whether Yahoo/FMP data can populate it
- **(c) Present but wrong?** — state the actual value vs what it should be
- **(d) Universal or selective?** — does this row apply to all companies or only certain types? Is the type-guard in the code correct?

### UFCF Model Rows

**Revenue $M**
- Source: `baseRevenue × (1+cagr)^t`. Is the base revenue the TTM or last annual?
- Are years 1-3 anchored to analyst consensus projections (from `isProjected=true` rows in `financialStatements.incomeStatement`)? Should they be?
- For foreign-currency companies: is revenue in USD throughout?

**Revenue % Growth**
- Derived from sequential revenue rows. Is the displayed growth rate year-over-year or vs TTM?
- For the TTM row: is `priorTtmRevenueM` used for the YoY comparison (avoiding the short-period artifact)?

**EBIT $M / EBIT Margin**
- Which of the three paths fires for this company?
  - **Financial branch**: `EBIT = revenue × netMargin / (1 − taxRate)`. D&A=0. NWC=0.
  - **SBC-distorted branch**: `isSBCDistorted = medianEbit < -2% AND medianFcf > 0 AND type=growth/startup`. EBIT ramps from negative toward min(35%, max(20%, fcfMargin×2)).
  - **Cyclical-trough branch**: `isCyclicalTrough = medianEbit < -2% AND ttmEbit > 1%`. Uses `ttmEbitMargin × 0.90`.
  - **Normal branch**: `medianEbitMargin` (3Y historical median blended 60% with 40% TTM weight).
- Is the firing path correct for this company?
- State the actual medianEbitMargin, ttmEbitMargin, medianFcfMargin values and which condition triggers.
- Is EBIT the right earnings concept for UFCF? (Yes — UFCF is pre-financing, so EBIT × (1−t) = NOPAT is correct. But for financial companies the NI-derived EBIT sidesteps the provision distortion — is this the right workaround or should provisions be an explicit line?)

**Tax Rate**
- Source: median of last 3 annual effective tax rates from `incomeStatement.taxRate`.
- For companies with multi-year net operating loss carryforwards (SATL, NBIS, early-stage AAOI): the effective rate may be 0% historically but statutory rate applies once profitable. Is the model using the right rate in projected years?
- For foreign-domiciled companies (RMS in France: ~25%, TSM in Taiwan: ~15%, BABA in China: ~25%): is the tax rate pulled correctly from the financial statements?

**NOPAT $M**
- Formula: `EBIT × (1 − effectiveTaxRate)`.
- For the SBC-distorted and cyclical-trough paths: NOPAT is still derived from EBIT. Is that consistent with the financial company path where NOPAT = netIncome?
- Should NOPAT use the effective tax rate or the statutory rate? State which is used and whether it produces accurate results for this company.

**D&A $M / D&A % Revenue**
- Source: `dna` field from cashFlow statement (`depreciationAndAmortization ?? reconciledDepreciation ?? depreciationAmortizationDepletion ?? amortizationOfIntangibles`).
- For financial companies: D&A = 0 in projections. Is this correct? (Banks do have real D&A on premises/software — is it material for this company?)
- For content-heavy companies (DIS, NFLX): is content amortization captured in the `dna` field or is it separately reported?
- For high-acquisition companies (COHR, MELI): does `amortizationOfIntangibles` cover the acquisition-related amortization?
- Is D&A projected as `medianDnaPct × revenue`? Is this ratio stable for this company or volatile (e.g. TSM's D&A/revenue fluctuates with capex cycles)?

**CapEx $M / CapEx % Revenue**
- Source: `median(3Y capex/revenue) × 60% + TTM capex/revenue × 40%`.
- For capital-intensive companies (TSM spending 35% of revenue): does the blended median accurately capture current capex intensity?
- For asset-light companies (SOFI, NU, DUOL): is capex genuinely near-zero or is there meaningful capex that Yahoo reports differently (e.g. capitalized software)?
- For financial companies: CapEx = 0 in projections. Should NU/SOFI have technology infrastructure capex modeled?

**ΔNWC $M / ΔNWC % Revenue Change**
- Source: `avgNwcDeltaRevRatio × revenueChange`, where NWC = (currentAssets − cash) − currentLiabilities.
- For financial companies and fintech-hybrids: NWC delta is zeroed. Does the `FINTECH_INDUSTRY_RE_NWC` regex correctly identify this company as a fintech-hybrid?
- For MELI (Consumer Cyclical, fintech-hybrid): state whether the NWC guard fires and whether it's correct.
- For companies with large negative working capital (Amazon-like marketplace models with high payables): does a negative ΔNWC correctly boost UFCF?
- Is the NWC proxy (`totalCurrentAssets − cash − totalCurrentLiabilities`) missing any material components for this company?

**UFCF $M**
- Formula: `NOPAT + D&A + CapEx − ΔNWC` (capex is stored negative).
- Is the `freeCashFlow` fallback (`when ufcf < 0 AND fcfOverride > 0`) firing for this company? Should it?
- State the actual UFCF margin for each of the first 3 projected years and assess whether it's plausible.

**PV of UFCF**
- Discount rate: WACC. Confirm the year index is correct (year 1 is discounted at WACC^1, year 5 at WACC^5).
- Is a mid-year convention applied? (Academic UFCF models often use mid-year discounting: divide by WACC^(t−0.5) rather than WACC^t.) State which convention is used and whether it matters for this company.

### LFCF Model Rows

**Net Income $M / Net Margin**
- Source: `medianNetMargin × revenue` for projected rows.
- For financial companies: NI is the anchor concept (not EBIT). Is the medianNetMargin derived correctly from the actual income statement (NI / total banking revenue)?
- For companies with volatile NI (MU with FY2023 losses, DIS with COVID years): does the TTM-weighted median correctly override the trough?

**D&A, CapEx, ΔNWC** — same sources as UFCF. Cross-check that they are identical.

**Net Debt Repayment $M**
- Source: `prevLongTermDebt − currentLongTermDebt`. Positive = net paydown, negative = net new borrowing.
- Is this the right concept for FCFE? (Academically: FCFE = NI + D&A − CapEx − ΔNWC + net new borrowing, i.e. net debt issued, not repaid. The sign convention matters.)
- For companies issuing debt to fund growth (UBER early years, BABA buybacks funded by debt): does the model correctly add back net new borrowing or subtract repayment?
- For banks (JPM/BAC): long-term debt changes are liability management decisions, not capex-like. Does including longTermDebt changes in FCFE produce meaningful output for a bank?
- For financial companies (NU/SOFI): is net debt repayment zeroed out (since the NI-derived FCFE already embeds the financing structure)?

**LFCF $M**
- Formula: `NetIncome + D&A + CapEx − ΔNWC − NetDebtRepayment`.
- Is this the academically correct FCFE formula for this company?
- Discount rate: costOfEquity (Ke), not WACC. Confirm Ke is being used.
- State the actual LFCF for the first 3 projected years and whether the margin is plausible.

### Terminal Value

**Perpetuity Growth Model (PGM)**
- Formula: `lastProjectedFCF × (1 + g) / (rate − g)` where rate = WACC (UFCF) or Ke (LFCF).
- What value is `g` set to? Is it `terminalG` or the dynamically faded value?
- Is the 200bps minimum spread enforced? What are the actual values of g and rate?
- What % of total fair value does terminal value represent? If >70%, flag this as a structural sensitivity concern.

**Exit Multiple (EM)**
- For UFCF: `lastProjectedEBITDA × exitMultiple`. Is `lastProjectedEBITDA` the year-N projected value or TTM? It should be the projected terminal-year value.
- For LFCF: `lastProjectedEarnings × exitPE`. Same question.
- Is the same `exitMultiple` and `exitPE` used here as in the Cockpit methods? Should the terminal-year multiple be different from the 5-year-exit multiple?

---

## Phase 4 — Missing Lines Evaluation

For each potentially missing line below, evaluate for THIS specific ticker:

| Candidate Line | Applicable to this stock? | Why or why not | Yahoo/FMP field available? | Impact if added | Recommendation |
|---|---|---|---|---|---|
| Interest income (net interest income) | | | | | |
| Interest expense | | | | | |
| Provision for credit losses | | | | | |
| SBC as explicit addback (not embedded in D&A) | | | | | |
| Change in deferred revenue (SaaS companies) | | | | | |
| Reinvestment in loan book / credit portfolio | | | | | |
| Minority interest / non-controlling interest | | | | | |
| Maintenance CapEx vs Growth CapEx split | | | | | |
| R&D capitalization (for research-intensive startups) | | | | | |
| Change in short-term debt (FCFE adjustment) | | | | | |

For each row where "Applicable = Yes": state the exact Yahoo Finance or FMP field name that would populate it, and whether that field is already fetched in `app/api/financials/route.ts` or `app/api/statements/route.ts`.

---

## Phase 5 — Guard Coverage Check

For each guard/fix that has been implemented in the codebase, verify it fires (or correctly does not fire) for this specific stock:

| Guard | File / Line | Expected behavior for this stock | Actual behavior | Correct? |
|---|---|---|---|---|
| Financial FCF guard (baseFCF = NI × 0.80) | cockpitBuilders.ts ~line 103 | Fires if companyType ∈ {financial, fintech} AND rawFCF > earningsBased × 3 | | |
| Financial EBIT (NI-derived) in buildProjectedRows | normalizeInputs.ts ~line 392 | Fires if isFinancialSector = true | | |
| NWC zeroed for financials | normalizeInputs.ts ~line 335 | isFinancialSector = true → empty array | | |
| Fintech-hybrid NWC guard (MELI, etc.) | normalizeInputs.ts ~line 112 | FINTECH_INDUSTRY_RE_NWC fires on sector+industry | | |
| SBC-distorted EBIT ramp | normalizeInputs.ts ~line 415 | medianEbit < -2% AND medianFcf > 0 AND growth/startup | | |
| Cyclical trough override | normalizeInputs.ts ~line 389 | medianEbit < -2% AND ttmEbit > 1% | | |
| AI semi premium 38× (revenue ≥ 100M gate) | deriveAssumptions.ts ~line 253 | Semi industry AND max(hist,analyst) > 25% AND rev ≥ 100 | | |
| Net margin cap 70% | deriveAssumptions.ts ~line 113 | min(0.70, ...) | | |
| P/B justified formula uses terminalG | cockpit.ts ~line 37 | g = max(0.01, min(terminalG, wacc-0.01)) | | |
| P/B sanity cap (impliedPB < 0.25) | cockpitBuilders.ts ~line 175 | bookValue corrected to price/1.5 | | |
| Bank P/B industry lookup | cockpitBuilders.ts ~line 254 | Banks—Diversified → 1.2× before sector fallback | | |
| Energy CAGR cap 8% | projectCashFlows.ts ~line 384, normalizeInputs.ts ~line 637 | Fires if Energy or Basic Materials | | |
| Mega-cap buyback 0% dilution | deriveAssumptions.ts ~line 285 | tech, margin > 25%, rev > $100B | | |
| Crypto mining type detection | detectCompanyType.ts ~line 65 | Fires on bitcoin/crypto/blockchain in haystack | | |
| Luxury Goods multiples | calculateMultiples.ts | Fires on 'Luxury Goods' industry | | |

---

## Output Requirements

### Summary header (always first)
```
TICKER: [TICKER]
companyType: [type]  
CAGR seeded: X%
Exit P/E: X×  
Exit EV/EBITDA: X×
EV/Revenue: X×
Net margin (exit): X%
WACC: X% / Ke: X% / terminalG: X%
Blended FV: $X
Current price: $X
Upside: X%

Guards fired: [list]
Guards NOT fired but should: [list]
Critical issues: [list]
```

### Per-assumption table
| Assumption | Value for [TICKER] | Correct? | Issue if any | Severity |

### Per-row table (Full DCF)
| Row | Historical TTM | Year 1E | Year 2E | Year 3E | Formula path | Correct? | Issue |

### Missing lines table
(as specified in Phase 4)

### Guard coverage table
(as specified in Phase 5)

### Prioritized fix list
For each issue found, rank by severity and specify:
- File + function + line
- What input triggers it
- Wrong output vs correct output
- Recommended fix (one sentence)

---

## Calibration Reference — Known Issues by Stock Type

Use these known patterns to cross-check your findings:

**Financial / Fintech (NU, SOFI, JPM, BAC):**
- D&A should be 0 in projections (credit provisions are in EBIT, not addbacks)
- NWC must be zeroed (deposits and loan book are not operating working capital)
- LFCF should dominate the 4-model blend (85-90%)
- baseFCF guard must fire when raw OCF includes deposit inflows
- P/B anchor: Banks—Diversified → 1.2×, Credit Services → 1.8×

**Cyclical semiconductors (MU):**
- Cyclical trough guard must fire when FY2023 losses drag median EBIT negative
- AI semi premium must fire (revenueM ≥ 100 AND analyst CAGR > 25%)
- 3-year CAGR median includes the trough year — verify override fires

**Foreign ADR with USD reporting (BABA, PDD):**
- foreignCurrency flag may be false even for Chinese companies if Yahoo reports in USD
- CRP should be non-zero (~3-4% for China)
- CAGR blending should give appropriate weight to analyst estimates vs potentially-stale history

**Foreign ADR with non-USD reporting (TSM=TWD, RMS=EUR):**
- foreignCurrency=true, historicalCagr3y computed from USD-converted revenues
- ARS exclusion must not fire (only Argentina)
- CAGR blend weights: 35% historical / 50% analyst (not the old 0% historical)

**Pre-revenue / deep-loss startups (SATL, NBIS, POET):**
- Forward P/E: exitPE from sector median (no AI semi premium without revenueM ≥ 100)
- EBITDA may be negative → ev_ebitda method excluded, weight redistributed to revenue_multiple
- Revenue multiple dominates (45-52% of blend after redistribution)
- Full DCF: negative EBIT with negative FCF → no SBC/trough guard fires → normal median used → all projected rows negative → DCF near-zero (correct behavior, not a bug)

**SBC-heavy growth (ZETA, DUOL, UBER early years):**
- SBC-distorted branch must fire (medianEbit < -2%, medianFcf > 0, growth/startup type)
- UFCF FCF floor must fire in early ramp years (ufcf < 0 AND fcfOverride > 0)
- isHighGrowthSaaS boundary at last < 15% (not 10%) — DUOL at 12% margin should use SaaS convergence

**Bitcoin mining (IREN, MARA, RIOT):**
- Must detect as 'mining' type (not Technology)
- Uses Bitcoin Mining multiples (pe:12×, evEbitda:8×, evRevenue:3×)
- 8% CAGR cap applies (Energy/cyclical sector treatment)
- UFCF is highly volatile — the model will show extreme swings based on BTC price embedded in revenue. Flag this explicitly.

**Luxury goods (RMS/Hermès):**
- Luxury Goods industry entry must be found: pe:42×, evEbitda:28×, evRevenue:8×
- foreignCurrency=true (EUR), fxRate applied throughout
- Net margin ~40%+ — 70% cap does not bind, correct

---

## Notes for the Agent

- Never evaluate assumptions in the abstract. Every statement must be grounded in the actual value the code produces for the specific ticker.
- If a guard is supposed to fire but you cannot confirm from the API whether it does, trace the exact condition in the code and state what the API would need to return for it to fire. Then assess probability based on the company's known financials.
- When evaluating "is this line missing," consider whether the absence silently distorts another line (e.g. missing SBC addback may be compensated by inflated D&A from the EBIT-EBITDA gap) — trace whether the compensation is correct or coincidental.
- Flag the percentage of total fair value represented by terminal value. If it exceeds 75%, note this as a model sensitivity risk regardless of other correctness.
- The six stocks used to calibrate these guards (SOFI, NU, TSM, BABA, SATL, MU) were each used to discover a specific class of bug. If the ticker being audited shares characteristics with one of these (e.g. a new Asian fintech ADR), explicitly check whether the same class of bug applies.
