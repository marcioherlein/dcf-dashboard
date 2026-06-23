# Valuation Audit Agent — Master Prompt

## Usage

```
/audit-valuation [TICKER]
```

If no ticker is provided, the agent must ask:

> "Which stock should I audit? Provide a ticker and I'll run the full valuation model audit against the real computed values for that company."

Once a ticker is given, run all phases below in order. Every finding must reference actual numbers — not hypotheticals — derived from what the code computes for this specific company.

---

## Step 0 — Self-Improvement Bootstrap (run before every audit)

This agent improves itself. Before running any audit phase:

**0A. Load confirmed prior findings**

Read `testing/findings/audit-log.md`. Extract every finding where:
- `Status: confirmed` (≥ 2 runs) or `Status: integrated`
- `Agent: audit-valuation`

Treat these as additional checks to run during the audit, even if they are not yet written into the phases below.

**0B. Increment run count for any finding you reproduce**

If you observe the same issue described in a prior finding, update that finding's `Run count:` and `Status:` in `testing/findings/audit-log.md` before producing the final summary.

**0C. Record new findings at the end of the run**

After completing all phases, write every novel issue found to `testing/findings/audit-log.md`:

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

**0D. Integrate confirmed findings (run count ≥ 2, status: confirmed)**

1. Insert check into the right section of `testing/valuation-audit-agent.md`
2. Update finding status to `integrated`
3. Overwrite `.claude/commands/audit-valuation.md` with identical content

**0E. Sync to command** after any template write.

---

## Setup: Data Acquisition

Fetch real data via the dev server:

```bash
AKEY="9ce10b1f696553abb34e44954424a911e324c1e11a516f54"
curl -s -H "x-audit-dev-key: $AKEY" "http://localhost:3000/api/financials?ticker={TICKER}" > /tmp/{ticker}_fin.json
```

Extract key sections: `quote`, `cagrAnalysis`, `wacc`, `fairValue`, `scenarios`, `valuationMethods`, `assumptionAudit`, `financialStatements`, `historicalFCF`, `businessProfile`, `dcf`.

If the API is down, fall back to reading source files and tracing logic manually.

---

## Phase 0 — Data Quality Pre-Flight

Run these checks before any valuation analysis. Bad input data contaminates everything downstream.

### 0A. grossProfit / revenue ratio
- Compute `grossProfit / revenue` for each historical IS row.
- **[Finding 1 — integrated]** If all rows > 97%: FMP is returning totalRevenue as grossProfit. The `bpGrossMargin < 0.97` fix in `route.ts` should have caught it — verify the fix fired by checking `businessProfile.grossMargin`. If `businessProfile.grossMargin > 0.97` (genuinely near-100% GP business like ARM at 97.54%), the fix correctly stays silent; flag the IS rows as approximate but not corrupt.
- **[Finding 14 — integrated]** If all rows show *identical* GP% to 2 decimal places across 3+ years (e.g. WDAY: 75.76%, LYFT: 35.62%, CVX: 42.42%): FMP is returning a static blended gross margin. Impacts `isHighGrowthSaaS` boundary — if actual GM fluctuates near the 60% threshold, the stale value can flip the margin convergence path.

### 0B. EBIT / operatingIncome availability
- Are `operatingIncome` values populated in the IS rows? If all null: EBIT-based UFCF model will use the NI fallback — confirm it fires by checking `assumptionAudit.netMargin` vs `businessProfile.netMargin`.
- **[Finding 3 — integrated]** If EBIT=null AND projected NOPAT rows are all null: the EBIT fallback `ebit = revenue × medianNetMargin / (1−taxRate)` is not firing. This silently collapses the UFCF Full DCF Table.

### 0C. taxRate field population
- **[Finding 6 — integrated — systemic — 33/33 tickers confirmed]** Check whether all historical `taxRate` values are null. The model always falls back to `waccInputs.taxRate = 0.21`. Report the company's known effective tax rate (check actual financial filings) and the NOPAT impact. For low-tax companies (MSFT ~18-19%, TSM ~15%), the 21% fallback over-taxes by 2-6pp. For high-tax companies (UK/European domiciles ~25-28%), it under-taxes.

### 0D. baseFCF vs historicalFCF ratio
- **[Finding 4 — integrated]** Compute `baseFCF / historicalFCF[-1]`. Flag if ratio < 0.70 or > 1.50 (non-financial types only — skip for `financial`/`fintech`/`bdc`/`mreeit`/`alt_asset`). Negative ratios (INTC, SO) mean actual FCF is negative while Yahoo returns stale positive. Ratio > 1.50 for utilities (NEE 2.30×, SO) means Yahoo OCF ignores full regulated capex. Ratio > 1.50 for content companies (NFLX 1.73×) means Yahoo adds back content amortization. Fast-ramping cyclicals (MU) can legitimately exceed 1.50× when TTM FCF genuinely exceeds prior annual — verify by checking FCF trend direction.

### 0E. netMargin audit vs businessProfile cross-check
- **[Finding 13 — integrated]** Compare `assumptionAudit.netMargin` vs `businessProfile.netMargin`. If ratio > 2.5×, the auditBundle IS rows are newest-first — `deriveNetMargin`'s `withBoth[-1]` picks the oldest year instead of the most recent. Root cause: `auditBundle.financialStatements.incomeStatement` is passed newest-first. Confirmed: SHOP (last=FY2021 63.2%→55% cap), WDAY (last=FY2024 19%→22%), DDOG (last=FY2024 6.8%→14.7% via SaaS path). Fix needed: sort `withBoth` by year ascending in `deriveAssumptions.ts`.

### 0F. companyType sanity
- If `companyType = alt_asset` AND `businessProfile.revenueM < 100`: likely a closed-end fund (TY=Tri-Continental, GAB=Gabelli). **[Finding 15 — integrated]** FCFF will be near-zero; check `quote.quoteType` for `'CEF'`. Triangulated FV from multiples is the only useful number.
- If `isNegativeFCF = True` but `baseFCF > 0`: Yahoo `fd.freeCashflow` is returning a stale positive value from before the company turned cash-flow-negative (INTC). Flag and note the correct baseFCF from `historicalFCF[-1]`.

---

## Phase 1 — Company Classification Audit

### 1A. companyType assignment

State:
- Yahoo `sector` and `industry`
- Which `detectCompanyType.ts` branch fires and why
- The resulting `companyType` and whether it is financially correct
- Edge cases (MELI = growth + fintech hybrid; V/MA = financial but pure payment network; TSLA = standard but has auto carve-out on P/E; PLTR/ARM = growth with speculative P/E)

- **[Finding 15 — integrated]** When `companyType = alt_asset` AND `revenueM < 100`, flag closed-end fund risk. Check `quote.quoteType` — CEFs return 'CEF', not 'EQUITY'. DCF is misapplied; only multiples-based triangulation is reliable.

- **[Finding 10 — integrated]** For `Financial Services / Credit Services` (V, MA): verify whether the company takes actual credit risk. If `businessProfile.fcfMargin > 25%`, this is likely a pure payment network misclassified as `financial` via the `credit` keyword. P/B and LFCF anchors work reasonably but note the classification gap.

- **[Finding 22 — new]** When `companyType = None` AND Yahoo `sector = 'Technology'` AND the company operates as a payment processor or digital bank: all fintech guards are disabled. Signals: CRP > 0 AND net interest income in revenue AND large receivables on BS AND D/E > 0.5. Confirmed: STNE (StoneCo) classified as Technology/Software-Infrastructure by Yahoo, but is a Brazilian payment acquirer/SME credit lender. Result: NWC not zeroed (FY2025 NWC +$1,448M from credit receivables), financial FCF guard off, EBIT uses NI fallback via the null-check rather than the financial branch. Add fintech-keyword check on `businessProfile.description` as override: if description contains "payment", "acquirer", "fintech", "neobank", or "digital bank", override sector-based type to `fintech`.

### 1B. COCKPIT_WEIGHTS

State the active weight table and evaluate each method's validity. Does `getEffectiveWeights` modify the base (EBITDA margin < 8% → reduce ev_ebitda weight, fintech auto-promote)? Does it fire correctly here?

### 1C. FOUR_MODEL_DCF_WEIGHTS

State `ufcfPGM / ufcfEM / lfcfPGM / lfcfEM` and assess the UFCF vs LFCF split for this company type.


- **[Finding 17 — new]** For `reit` companyType: verify `valuationMethods.effectiveWeights.multiples > 0`. If it equals 0, all Yahoo multiples (P/E, EV/EBITDA, P/Book) returned null for this REIT, collapsing triangulation to 100% FCFF. The industry-standard P/FFO IS computed in the Cockpit adaptive method but does NOT flow into `triangulatedFairValue`. Cross-reference the Cockpit P/FFO card value against the FCFF-only triangulated number and note the discrepancy. Confirmed across AMT, PLD, SPG, O, WELL.
---

## Phase 2 — Pre-set Assumption Audit

State the actual value for each assumption, then evaluate.

### 2A. CAGR

- What does `cagrAnalysis.blended` equal? Trace: `rawBlended` → convergence discount (excess × 0.75 above 20%) → size cap → final.
- Analyst weight = 55% (when ≥ 3 analysts); historical 3Y = 15%; fundamental (ROE × retention) = 25%.
- Energy/Basic Materials → 8% cap. Financial sector → 12% cap (mature banks). Alt-asset → 25% cap.
- `cagrAnalysis.analystBaseEffect`: if True, analyst 1Y > 150% — base effect distortion, clamped.
- foreignCurrency path: verify USD-converted CAGR for non-USD reporters (TSM=TWD÷rate, RMS=EUR÷rate). ARS exclusion must only fire for Argentina.
- Is `cagr` in top-level consistent with `cagrAnalysis.blended`? If not, a `cagrOverride` was applied — state the override value and why.
- **[Finding 26 — new]** For foreign-currency reporters: verify that `weights.historical × historicalCagr3y + weights.analyst × analystCAGR + weights.fundamental × fundamentalGrowth ≈ blended`. If `cagrAnalysis.drivers` says "historical discarded" but `weights.historical > 0`, the driver text is inconsistent with the blend — flag as instrumentation gap. Confirmed: STNE driver says "historical local-currency CAGR discarded" but manual calculation proves 35% historical weight still included (0.35×13.9% + 0.50×5.4% + 0.15×25.0% = 11.3% = API blended).

### 2B. Exit P/E (exitPE)

- What industry string is passed to `getIndustryMultiples`? What `sectorPE` comes back? (If industry not found: falls to sector fallback.)
- Current TTM P/E from Yahoo: valid (positive, < 500)? If null: blend uses sector-only path.
- Blend: `effectivePE × (55/90) + discountedSector × (35/90)`. Compute manually and verify API value.
- Thin-margin cap: `isThinMargin (nm < 10%) AND isPEElevated (pe > sectorPE × 2) AND !isAutoIndustry` → effectivePE = min(currentPE, sectorPE × 1.5).
- Fintech floor (22×). AI semi premium (38×, gated revenueM ≥ 100). Growth premium (CAGR > 25% fintech).
- **[Finding 8 — integrated]** `currentPE / sectorPE > 3× AND netMargin > 15%` → blended exitPE embeds speculative premium uncapped. Cap should be `sectorPE × 2.5`. Confirmed: PLTR (107×), AMD (106.5×), ARM (252×). DDOG (P/E=600×) correctly excluded — nm=3.7% < 15%.
- **[Finding 11 — integrated]** Auto Manufacturers (`isAutoIndustry`): check if `exitPE > sectorPE × 20`. The auto carve-out blocks the thin-margin cap entirely. TSLA: P/E=357×, sectorPE=10, exitPE=222× uncapped.
- **[Finding 25 — new]** Check `analystForwardPE`. If `< 1` and `wacc.financialCurrency ≠ 'USD'`: this is USD price ÷ BRL/local analyst EPS → currency contamination. The audit signal will say "Aggressive vs 1× forward P/E" when exit P/E may actually be reasonable. Real forward P/E = `price / (analyst_eps_local / fxRate)`. Confirmed: STNE analystForwardPE=0.8× (BRL EPS 10.62 / USD price 10.59), real forward P/E ≈ 5–6×. The exitPE blend itself may still be correct (uses Yahoo TTM P/E, which Yahoo normalizes to USD); the contamination only affects the audit signal.
- Is the final exitPE financially defensible for this company's stage and sector?

### 2C. Exit EV/EBITDA (exitMultiple)

- `sectorMedian` from `blendEVEBITDAMultiple`. Current actual EV/EBITDA from Yahoo (or computed from market cap + net debt ÷ EBITDA).
- Blend formula: same 55/35 structure as P/E.
- Low-multiple floor: if `currentMultiple < sectorMedian × 0.40`, floor = `currentMultiple × 0.90` (stays near actual for structurally low-multiple companies).
- EBITDA negative → method excluded (`ttmEbitdaDollars ≤ 0`). Verify in `assumptionAudit` that the method is not silently given zero weight.
- For financial/fintech: EV/EBITDA is typically excluded or unreliable. P/B replaces it as adaptive method.
- Is the exit multiple sensible for a 5-10 year terminal value horizon?
- **[Finding 21 — new]** Check `multiples.EV/EBITDA.actualValue`. If it is below 3× for a non-distressed, profitable company (net margin > 5%, positive revenue): Yahoo's `evToEbitda` is almost certainly contaminated by mixed-currency units. Common pattern for Chinese ADRs (BABA, JD, PDD): Yahoo computes EV_USD ÷ EBITDA_CNY_billions = e.g. $264B ÷ ¥186B = 1.4× instead of the correct ~9.6×. When the model applies sectorMedian (25×) to this distorted actual, the implied FV explodes by ~7×. Fix: `calculateMultiples.ts` now marks EV/EBITDA as not applicable when `actual < 3`. Check: verify `multiples.EV/EBITDA.applicable = false` and `note` contains "mixed-currency units" for such companies. Cross-check actual EV/EBITDA = `(marketCap + netDebt) / ttmEBITDA_from_IS_rows` — if this differs from Yahoo's `evToEbitda` by >3×, flag the mismatch.

### 2D. EV/Revenue (revenueMultiple)

- `sectorEVRev` from `getIndustryMultiples`. Current actual EV/Revenue from `businessProfile.evToRevenue`.
- Blend: same 55/35 weighted formula. Verify result matches API value.
- Zero-weighted for: `financial` (0%), `utility` (0%). If non-zero for these types, flag.
- For growth SaaS: revenue multiple often > 5×. Is the blended value sensible given current growth rate?

### 2E. Net Margin (netMargin)

- Trailing net margins by year (from IS rows): compute NI/revenue for each actual year.
- **[Finding 13 — integrated]** If `assumptionAudit.netMargin / businessProfile.netMargin > 2.5×`: auditBundle IS rows are newest-first — `withBoth[-1]` = oldest year. State which year is being used as 'last' and what the projected margin should be.
- **[Finding 14 — integrated]** If `grossProfit/revenue` is constant across all years: FMP blended-rate GP. Check whether it's above or below the 60% isHighGrowthSaaS threshold. If near 60%, state whether the actual annual GM (from businessProfile or filings) would change which path fires.
- Path trace: `last ≤ 0` → pre-profit (GM-based floor). `isHighGrowthSaaS` (CAGR>15%, GM>60%, 0<last<15%) → SaaS convergence: `last×0.30 + 18%×0.70`. `hasMoat+isHighGrowth` → +3pp. `hasMoat only` → +1.5pp. Stable → +0.5pp. Cap: min(0.55, projected).
- **[Finding 7 — integrated]** When EBIT=null: check `businessProfile.netMargin` vs medianNI%. If `bp.netMargin > 3× medianNI% AND medianNI% < 10%`: median is trough-distorted. Also check TTM NI% — if TTM > 2× median AND median < 10%: one-time gain or cyclical recovery is inflating TTM (LYFT: 45% TTM vs 0.4% median from deferred tax reversal). State what the model projects vs the true operating margin.
- For financial companies: verify `NI / (NII + fee revenue)` denominator is correct — total revenue not just NII.
- 55% cap: does it bind? Report if projected > 0.40 for any non-financial company.

### 2F. WACC and Terminal Growth Rate

- WACC inputs: beta, rfRate, ERP, CRP (country risk), costOfDebt, debtToEquity.
- Ke = rfRate + beta × ERP + CRP. Verify formula matches `wacc.costOfEquity`.
- CRP non-zero for: Brazil/LatAm (MELI ~1.25%), China (BABA/PDD ~3-4%), India (~2%), Turkey (~5%). Zero for US, Canada, most Western Europe.
- `terminalG`: matches long-run nominal GDP for primary market. US: 2-3%. EM: 3-5%. Developed non-US: 1.5-2.5%.
- WACC − terminalG spread ≥ 200bps enforced? State actual spread. If < 200bps: Gordon Growth denominator explodes.
- **[Finding 24 — new]** Check `assumptionAudit.terminalG`: if `value = None`, the audit result was not populated with the actual seeded value — flag as instrumentation gap. Also check for false-positive warns: if `severity = 'warn'` but actual `terminalG ≥ assumptionAudit.terminalG.suggestedValue`, the guard fired incorrectly. Confirmed: STNE terminalG=6.29%, suggestedValue=5.5% → warn fires even though 6.29% > 5.5%. Additionally, the reason text may contain a hardcoded "3.0%" instead of the actual value — cross-check `reason` text against actual `terminalG`.
- `dynamicTerminalFade` in Forward P/E method: CAGR>35%→8% fade, >25%→7%, >15%→5%, else terminalG. Verify max capped at min(ke−200bps, 10%).
- growthModel: `three-stage` if CAGR > 15% or isNegativeFCF. `two-stage` otherwise. Correct for this company?
- Ke vs WACC spread: Ke should be ≥ WACC for non-leveraged companies. If Ke ≈ WACC: debt is near-zero (asset-light tech) — correct. If Ke < WACC: data error.

### 2G. Dilution Rate

- Mega-cap buyback guard: isTech AND netMargin > 25% AND revenueM > $100B → 0% dilution. Does it fire?
- Tech tiers: margin > 20% → 1%/yr. > 10% → 2%/yr. < 10% → 3%/yr. Non-tech: > 15% → 0.5%/yr, else 1%/yr.
- Verify against actual share count trajectory: compare `sharesOutstanding` to prior year in BS rows. Is the seeded rate consistent with observed dilution?

### 2H. P/B Multiple (financial/fintech/alt_asset/mreeit companyTypes only)

- `bookValuePerShare` = last actual `totalEquity / sharesOutstanding` (both in millions).
- Sanity cap: if `currentPrice / bookValuePerShare < 0.25` → book value is likely asset-side data; replaced with `currentPrice / 1.5`.
- Justified P/B = `(ROE − g) / (Ke − g)` where g = `max(0.01, min(terminalG, wacc − 0.02))`. Compute manually.
- `sectorDefaultPB`: industry lookup first (Banks—Diversified=1.2×, Banks—Regional=1.1×), then sector fallback (Financial Services=1.8×, Banks=1.2×).
- Blended P/B = `justifiedPB × 0.60 + marketPB × 0.40` (or `0.35 / 0.65` if high-ROE fintech).
- Is the blended P/B defensible for this company's ROE vs cost of equity?

---

## Phase 3 — Full DCF Table Line-by-Line Audit

Using the actual `buildProjectedRows` output (`financialStatements.incomeStatement` projected rows + `normalizeInputs` logic), audit every line. State: historical TTM + first 3 projected years.

For each row: **(a)** formula correct? **(b)** missing when it should exist? **(c)** present but wrong? **(d)** type-specific guard correct?

### Revenue $M

- Base: `ttmRow?.revenue ?? lastAnnualRow?.revenue`. Is TTM available from `statementsData`? If only annual: revenue starts from last annual, slightly understating Year 1 for fast growers.
- Projection: `baseRevenue × (1 + cagr)^t`. Three-stage model (CAGR > 15%): constant in years 1-5, linearly fades to terminalG in years 6-10.
- Analyst-anchored years: are `isProjected=true` rows in IS used to anchor Years 1-3? State the analyst consensus revenue vs model projection.
- For foreignCurrency companies: revenue in USD throughout? fxRate applied once at source?
- `priorTtmRevenueM` used for TTM row's YoY growth (avoids short-period artifact where TTM extends only 1-3 months beyond last annual)?

### Revenue % Growth

- YoY sequential. For TTM row: `(ttmRevenue - priorTtmRevenue) / priorTtmRevenue`.
- If `priorTtmRevenueM` is null: growth displayed as N/A for TTM row — is this correct?

### EBIT $M / EBIT Margin

Four paths — state which fires and verify conditions:
1. **Financial branch** (`isFinancialSector=true`): `EBIT = revenue × netMargin / (1 − taxRate)`. D&A=0. ΔNWC=0. CapEx=0. Verify each of the three zeroing guards fires correctly.
2. **SBC-distorted** (`medianEbitMargin < −2% AND medianFcfMargin > 0 AND type ∈ {growth, startup}`): EBIT ramps from `medianEbitMargin` toward `min(35%, max(20%, fcfMargin×2))` over `nYears`.
3. **Cyclical-trough** (`medianEbitMargin < −2% AND ttmEbitMargin > 1%`): EBIT = `revenue × ttmEbitMargin × 0.90` (haircut for conservatism).
4. **Normal**: `medianEbitMargin` (3Y median blended 60% with 40% TTM). For null EBIT rows: NI-derived fallback fires.

State: `medianEbitMargin`, `ttmEbitMargin`, `medianFcfMargin`. Is the path correct?

**EBIT null check**: if `operatingIncome = null` for all historical rows: NI fallback `ebit = revenue × medianNetMargin / (1−taxRate)` fires. Verify it produces non-null projected EBIT. **[Finding 3]**

### Tax Rate

- **[Finding 6 — systemic]** All historical `taxRate` = null → fallback = `waccInputs.taxRate = 0.21`. State the company's actual effective rate (check IS row `incomeTaxExpense / incomeBeforeTax` from FMP). Quantify the NOPAT impact: `(0.21 − actualRate) × EBIT × revenue`.
- For NOL companies (INTC, early-stage lossmakers): effective rate near 0% historically, but statutory (21% US / 25% UK) applies once profitable. Is the model using the right rate?
- For foreign domicile: France ~25%, Taiwan ~15-20%, Netherlands ~25%, UK ~25%, Ireland ~12.5%. Verify rate against filings.

### NOPAT $M

- Formula: `EBIT × (1 − effectiveTaxRate)`.
- Effective vs statutory: model uses the blended historical median (or 21% fallback). For companies with large R&D credits or permanent differences, effective rate can diverge by 5-10pp.
- For financial branch: NOPAT = netIncome (via ebit/(1-t) × (1-t) = netIncome). Verify the math is consistent.
- State Year 1, 2, 3 NOPAT. Does the NOPAT margin seem plausible? Compare to TTM NOPAT implied by EBIT × (1−21%).

### D&A $M / D&A % Revenue

- Source priority: `depreciationAndAmortization` → `reconciledDepreciation` → `depreciationAmortizationDepletion` → `amortizationOfIntangibles` (from cashFlow statement).
- Projection: `medianDnaPct` (3Y median blended 60% with TTM 40%).
- Financial sector: D&A = 0 in projections. Does it correctly zero? Banks have real D&A on premises/software — is it material (typically < 2% of revenue)?
- Content companies (NFLX, DIS): D&A/revenue may be 30-40%+. Is content amortization captured in the `dna` field or reported separately as "amortization of streaming content assets"? NFLX FY2025: D&A=37% of revenue — is this all captured?
- Acquisition companies (COHR, MELI): `amortizationOfIntangibles` covers acquisition-related intangibles — is it included in the dna fallback chain?
- **[Finding 5 — integrated]** Is D&A% monotonically rising? If yes and D&A is driven by capex (MSFT, AMZN), the 3Y-median blend understates future D&A. Flag if TTM D&A% > blended D&A% by >2pp.
- **[Finding 27 — integrated]** For non-financial companies with sector=Consumer Cyclical or Technology (not financial/fintech companyType): if all projected D&A values = 0 AND historical D&A% > 1%, flag as critical bug — `isFinancialSector=true` was incorrectly set via the FINTECH_INDUSTRY_RE_NWC regex (e.g. `internet.*retail` matching MELI/AMZN/JD). Confirmed affected tickers: AMZN, JD, PDD, BABA, SE, W, ETSY, EBAY, MELI. Fixed in `normalizeInputs.ts` by separating `zeroNwcOnly` from full `isFinancialSector` treatment.

### CapEx $M / CapEx % Revenue

- Source: FMP `investmentsInPropertyPlantAndEquipment` (negative convention). Fallback: Yahoo `capitalExpenditures`.
- Projection: `medianCapexPct (3Y median) × 0.60 + TTM capexPct × 0.40`.
- **[Finding 5 — integrated]** If capex% monotonically rising: blended median anchors below TTM. Compute the gap. If > 3pp: flag understatement. For AI-infrastructure hyperscalers (MSFT Azure, AMZN AWS), forward guidance often exceeds the blended rate by 5-10pp.
- Financial/fintech: CapEx = 0 in projections. For tech-heavy neobanks (NU, SOFI): is the zeroing correct? Technology capex is real but typically 1-3% of revenue.
- Asset-light: is near-zero capex real (DDOG ~4%, CRWD ~8%) or is software development capitalized off-balance-sheet?

### ΔNWC $M / ΔNWC % Revenue Change

- NWC = `(totalCurrentAssets − cash) − totalCurrentLiabilities`.
- `avgNwcDeltaRevRatio`: average of `(NWC[t] − NWC[t−1]) / |revChange[t]|` over last 3 years.
- Financial/fintech/mreeit/bdc: ΔNWC = 0. Does `isFinancialSector` flag fire? For MELI: `FINTECH_INDUSTRY_RE_NWC` regex — does `internet.*retail` match the sector+industry string "consumer cyclical internet retail"?
- Negative ΔNWC/ΔRev (SaaS deferred revenue, marketplace floats): correctly boosts UFCF. Verify sign is economically sensible — is the company accumulating more deferred revenue or payables as revenue grows?
- Is the NWC proxy missing material components? (e.g. Finance receivables for hybrid companies, lease liabilities)

### UFCF $M

- Formula: `NOPAT + D&A − |CapEx| − ΔNWC` (capex stored negative, subtracted).
- FCF fallback: `freeCashFlow` override fires when `ufcf < 0 AND freeCashFlow > 0`. Is it firing? Should it?
- UFCF margin for Years 1, 2, 3: state actual values and assess plausibility. Compare to TTM FCF margin from `businessProfile.fcfMargin`.
- **[Finding 4 — integrated]** `baseFCF / historicalFCF[-1]` ratio check. Stale Yahoo data confirmed for: MSFT (0.52×), UBER (0.67×), NVDA (0.48×), XOM (0.49×), NFLX (1.73×). Skip for financial types.

### PV of UFCF

- Discount rate: WACC. End-of-year convention: year t discounted by `(1 + WACC)^t`.
- Verify Year 1: `CF[1] / (1+WACC)^1`. Spot-check Year 5.
- Mid-year convention not applied (would add ~`sqrt(1+WACC)/1` ≈ 4-6% uplift). State the convention and whether it matters for this company's terminal value weight.
- Terminal value %: `terminalValueDiscounted / (sumPV + terminalValueDiscounted)`. If > 75%: flag as sensitivity risk — small changes in terminalG or WACC dominate the valuation.

### LFCF / FCFE Model Rows

**Net Income $M**
- Projected via `medianNetMargin × revenue`.
- **[Finding 7 — integrated]** EBIT=null + trough distortion: check TTM NI% vs median. Also one-time gain direction: LYFT TTM=45% vs median=0.4% from deferred tax reversal. `businessProfile.netMargin` is the best reality check.
- For volatile NI companies (MU FY2023 loss, DIS COVID years): does the TTM-weighted 60/40 blend correctly anchor toward current reality?

**D&A, CapEx, ΔNWC** — must be identical to UFCF. Cross-check all three.

**Net Debt Repayment $M**
- `prevLongTermDebt − currentLongTermDebt`. Positive = net paydown (reduces FCFE). Negative = net new borrowing (adds to FCFE).
- Sign convention: FCFE = NI + D&A − CapEx − ΔNWC **+ net new borrowing** (net debt repayment subtracted). Verify the sign is consistent.
- For banks (JPM/BAC): LTD changes are liability management, not FCFE-relevant. Is the line zeroed for financial types?
- For growth issuers (UBER, MELI): adding back net new debt correctly lifts FCFE. Does the model handle this?

**LFCF $M and Discount Rate**
- Formula: `NI + D&A − |CapEx| − ΔNWC − NetDebtRepayment`.
- Discount rate: `costOfEquity (Ke)`, NOT WACC. Verify Ke is used in the LFCF DCF arm.
- State Year 1, 2, 3 LFCF margins. Compare to NI margin — difference = non-cash items and debt dynamics.

### Terminal Value — Both Arms

**Perpetuity Growth Model (PGM)**
- `lastProjectedFCF × (1 + g) / (rate − g)`. Rate = WACC (UFCF) or Ke (LFCF).
- g = `terminalG` (after dynamicTerminalFade applied). State actual g and rate values. WACC − g ≥ 200bps?
- TV% of total EV — flag if > 75%.

**Exit Multiple (EM)**
- UFCF: `lastProjectedEBITDA × exitMultiple`. Is `lastProjectedEBITDA` the terminal-year projected value (correct) or TTM (wrong)?
- LFCF: `lastProjectedEarnings × exitPE`. Same terminal-year check.
- Are the same `exitMultiple` and `exitPE` used in both the Cockpit Snapshot and the Full DCF Table? They should be. If they differ, state the discrepancy.

---

## Phase 4 — Historical Financial Statement Audit

Audit the raw financial statements for data quality issues. State the actual values.

### 4A. Income Statement Audit

For each historical year (all actuals):

| Year | Revenue $M | GP% | EBIT% | NI% | taxRate | EPS |
|------|------------|-----|-------|-----|---------|-----|
| (fill in) | | | | | | |

Check:
- **Revenue trend**: growing, shrinking, volatile? Does CAGR blended match the observable trajectory?
- **Gross margin stability**: constant (F14 signal) or naturally varying? For SaaS/IP companies: near-100% GP is correct.
- **EBIT margin trend**: is EBIT becoming more or less efficient? For companies with EBIT=null: note which years it's missing and why.
- **Net margin vs EBIT margin gap**: large gap = significant interest expense, taxes, or one-time items. For LYFT FY2025: NI%=45% >> EBIT% → one-time tax gain. Flag these.
- **EPS trend**: consistent with NI trend? Large divergence = share issuance/buybacks.
- **Projected rows**: do the projected IS rows (years 1-5) use correct analyst consensus revenue? Are projected NI rows simply `revenue × avgNetMarginRatio`? State the ratio used and whether it matches trailing margins.

### 4B. Cash Flow Statement Audit

For each historical year:

| Year | OCF $M | CapEx $M | FCF $M | D&A $M | FCF/OCF% | CapEx/Rev% | D&A/Rev% |
|------|--------|----------|--------|--------|----------|------------|----------|
| (fill in) | | | | | | | |

Check:
- **OCF vs NI divergence**: large positive gap (OCF >> NI) = healthy (D&A addbacks, working capital). Large negative gap (OCF << NI) = accrual earnings, possible earnings quality concern.
- **FCF trend**: is FCF ramping, stable, or declining? Does it match baseFCF / historicalFCF?
- **D&A/Rev%**: stable (SaaS ~2-5%, standard ~5-10%), rising with capex (MSFT 12%+), very high for content (NFLX 37%). Flag anomalies.
- **CapEx/Rev%**: matches phase of investment cycle? Capital-intensive companies (TSM 35%, NEE 34%) vs asset-light (DDOG 4%).
- **[Finding 20 — new]** For non-USD reporting companies (ARS, TRY, other EM currencies with large fxRates): verify D&A/Rev% and CapEx/Rev% are in a plausible range. If D&A% < 0.5% for a capital-intensive company (energy, industrials, telecom), OR CapEx% < 0.5% for an energy company, the CF rows likely have a units mismatch — the fxRate conversion may have applied an extra ÷1000 to CF rows but not IS rows. Cross-check: `baseFCF / revenueM` should give a plausible FCF margin (5-30% for energy). If baseFCF looks right but CF row D&A/capex are near 0, the CF rows are 1000× mis-scaled. Confirmed: YPF (ARS reporter) OCF=3.46 should be 3460M; D&A=1.93 should be 1930M. Impact: CapEx, D&A, and ΔNWC projections collapse to near-zero, producing inflated UFCF.
- **Negative FCF with positive OCF**: capex surge phase (AMZN FY2025: OCF 139B, capex 132B → FCF 7B). Note whether model correctly captures the capex intensity.
- **Projected CF rows**: do projected FCF = projected OCF − avgCapex? Are D&A projections in the CF projected rows consistent with IS D&A projections?

### 4C. Balance Sheet Audit

For each historical year:

| Year | Cash $M | TCA $M | TCA−Cash $M | LTD $M | TCL $M | NWC $M | Equity $M | LTD/Equity |
|------|---------|--------|-------------|--------|--------|--------|-----------|------------|
| (fill in) | | | | | | | | |

Check:
- **Cash trend**: growing (FCF generation), shrinking (buybacks/dividends/losses), or volatile?
- **NWC trend**: becoming more negative (SaaS deferred revenue growth) or positive (receivables buildup)? Delta NWC/Delta Revenue ratio — state for each year.
- **LTD/Equity leverage**: rising leverage (possible acquisition) vs declining (deleveraging). For financial companies: LTD changes are funding decisions — flag if using LTD changes in FCFE.
- **Equity trend**: growing from retained earnings (healthy) vs declining (buybacks exceeding earnings, impairments)?
- **Projected BS rows**: do projected cash balances = prior cash + projected FCF − dividends? Are LTD projections flat (most companies) or changing?

### 4D. Pre-set Ratio Cross-Check

From `assumptionAudit.results`, state every seeded assumption and verify it matches the observable financials:

| Assumption | API value | Manual calc from statements | Match? | If not: root cause |
|---|---|---|---|---|
| CAGR | `cagrAnalysis.blended` | Compute from IS revenue rows | | |
| Net Margin | `assumptionAudit.netMargin` | `is_[-1].netIncome / is_[-1].revenue` | | |
| WACC | `wacc.wacc` | `Ke × weightEquity + Kd × (1−t) × weightDebt` | | |
| Exit P/E | `assumptionAudit.exitPE` | `currentPE × (55/90) + sectorPE × (35/90)` | | |
| Exit EV/EBITDA | seeded | `currentEVEBITDA × (55/90) + sectorMedian × (35/90)` | | |
| EV/Revenue | seeded | `currentEVRev × (55/90) + sectorEVRev × (35/90)` | | |
| D&A % | used in projections | median(dna/rev for last 3 CF rows) | | |
| CapEx % | used in projections | median(capex/rev for last 3 CF rows) × 0.60 + TTM × 0.40 | | |
| NWC δ/ΔRev | used in projections | avg((NWC[t]−NWC[t−1]) / |rev[t]−rev[t−1]|) | | |


**[Finding 16 — new]** P/Book units error when Yahoo `priceToBook=None`: Compute ground-truth P/B = `price / (totalEquity_M / sharesOutstanding_M)`. If `multiples.P/Book.impliedFairValue > currentPrice × 50` for any company, flag a P/B units error in `calculateMultiples.ts`. Also flag when `multiples.blendedFairValue > currentPrice × 20` for any non-startup — this signals one method has an astronomical value contaminating the blend. Confirmed: BRK-B P/Book=None → implied=$758,339/sh → multiples blended=$253,046 → tri=$76,562 (156× overvalued).

---

## Phase 5 — Missing Lines Evaluation

| Candidate Line | Applicable? | Why / why not | Yahoo/FMP field | Impact | Recommendation |
|---|---|---|---|---|---|
| Interest income (NII) | | | | | |
| Interest expense | | | | | |
| Provision for credit losses | | | | | |
| SBC as explicit addback | | | | | |
| Change in deferred revenue | | | | | |
| Reinvestment in loan book | | | | | |
| Minority interest / NCI | | | | | |
| Maintenance vs Growth CapEx split | | | | | |
| R&D capitalization | | | | | |
| Short-term debt change (FCFE adj) | | | | | |
| Content spend (NFLX/DIS) | | | | | |
| Lease obligations (CAPEX vs ROU) | | | | | |

For each Applicable=Yes: state the exact FMP/Yahoo field name and whether it's already fetched in `route.ts`.

---

## Phase 6 — Guard Coverage Check

Verify each guard fires (or correctly does not) for this ticker:

| Guard | Location | Expected | Actual | Correct? |
|---|---|---|---|---|
| Financial FCF guard (NI×0.80) | cockpitBuilders.ts ~103 | type ∈ {financial,fintech} AND rawFCF > earningsBased×3 | | |
| Financial EBIT (NI-derived) | normalizeInputs.ts ~392 | isFinancialSector=true | | |
| NWC zeroed for financials | normalizeInputs.ts ~335 | isFinancialSector=true → [] | | |
| Fintech-hybrid NWC (MELI) | normalizeInputs.ts ~112 | FINTECH_INDUSTRY_RE_NWC fires | | |
| SBC-distorted EBIT ramp | normalizeInputs.ts ~415 | medianEbit<-2% AND medianFcf>0 AND growth/startup | | |
| Cyclical trough override | normalizeInputs.ts ~389 | medianEbit<-2% AND ttmEbit>1% | | |
| EBIT null → NI fallback | normalizeInputs.ts ~462 | ebit=null AND medianNetMargin>0 → NI-derived | | |
| AI semi premium 38× | deriveAssumptions.ts ~253 | Semiconductors AND CAGR>25% AND rev≥100M | | |
| Thin-margin P/E cap | deriveAssumptions.ts ~204 | nm<10% AND pe>sectorPE×2 AND !isAutoIndustry | | |
| Auto industry P/E carve-out | deriveAssumptions.ts ~203 | isAutoIndustry=true → cap disabled | | |
| Speculative P/E (F8) | deriveAssumptions.ts ~206 | pe/sector>3× AND nm>15% → no guard (known gap) | | |
| Net margin cap 55% | deriveAssumptions.ts ~117 | min(0.55, projected) | | |
| isHighGrowthSaaS convergence | deriveAssumptions.ts ~109 | CAGR>15% AND GM>60% AND 0<last<15% | | |
| P/B justified formula | cockpit.ts ~37 | g=max(0.01,min(terminalG,wacc-0.02)) | | |
| P/B sanity cap (<0.25) | cockpitBuilders.ts ~175 | price/1.5 corrective | | |
| Bank P/B industry lookup | cockpitBuilders.ts ~254 | Banks—Diversified→1.2× before fallback | | |
| Energy CAGR cap 8% | projectCashFlows.ts ~384 | sector∈{Energy,Basic Materials} | | |
| Financial CAGR cap 12% | projectCashFlows.ts | mature bank, CAGR>12% | | |
| Mega-cap buyback 0% dilution | deriveAssumptions.ts ~285 | isTech AND nm>25% AND rev>$100B | | |
| Convergence discount >20% CAGR | projectCashFlows.ts | (blended−0.20)×0.75 applied | | |
| Profitability inflection NI guard | normalizeInputs.ts ~330 | ttmNetMargin>0 AND medianNetMarginHist<0 → clamp 0 | | |
| Crypto/mining type detection | detectCompanyType.ts ~65 | bitcoin/crypto/blockchain in haystack | | |
| Luxury Goods multiples | calculateMultiples.ts | 'Luxury Goods' industry → pe:42× | | |
| FCF margin ceiling (tech 45%, other 35%) | route.ts ~294 | baseFCF/rev > ceiling → cap to ceiling | | |
| Market-cap yield cap (30%) | route.ts ~132 | baseFCF/marketCapM > 0.30 → cap to 15% | | |
| grossProfit sanitizer (F1 fix) | route.ts ~917 | all GP/rev>97% AND bpGM<0.97 → rewrite | | |

---

## Phase 7 — Pre-set Value Explainability Audit

This phase audits whether the model's automatically-seeded assumptions are **clearly explained to users** — not just computationally correct. A value that is right but unexplained is as dangerous as a wrong value: the user either blindly accepts it or blindly overrides it.

Run this phase for every ticker. It catches cases where the model is silently wrong (F13 netMargin bug: user sees "5%" with no warning, no explanation) or where a low-confidence sector-fallback is presented with the same authority as a high-confidence analyst consensus.

### 7A — Per-assumption UI clarity check

For each of the 7 seeded assumptions (`revenueCAGR`, `netMargin`, `exitPE`, `revenueMultiple`, `dilutionRate`, `discountRate`, `exitMultiple` where applicable), answer:

| Check | What to verify |
|---|---|
| **Source** | Is the `source` badge correct? (`analyst_estimate` requires numAnalysts ≥ 3; `historical_3y_median` = using IS rows; `sector_fallback` = no company data available; `model_default` = computed formula). State which source was used and whether it's the most credible available. |
| **Description** | Does `a.description` exist and explain the assumption in plain English — not jargon? A good description: "How fast you expect revenue to grow each year for the next 5 years." A bad one: "Revenue CAGR input." |
| **sourceExplanation** | Does `sourceExplanation` include actual numbers for this company? It should name the analyst count, the FY+1 estimate, the historical value, and the blend weight (e.g. "54 analysts: FY+1 16.6%, FY+2 14.6%; hist 3Y 12.4% → blended 18.4%"). A generic fallback message ("using sector default 12%") with no company-specific data should be flagged. |
| **Benchmarks** | Are `benchmarks` populated so the user can compare and snap to a reference? If `source = analyst_estimate` there must be an analyst benchmark. If `source = sector_fallback`, there must be a sector median benchmark. Missing benchmarks = no snap button = user has no reference point. |
| **Heat accuracy** | Is the heat level (conservative/elevated/aggressive) calibrated correctly relative to the primary benchmark? If `heat = 'neutral'` but `assumptionAudit.severity = 'warn'` for this key → the UI is under-reporting risk. This is a critical gap: user sees a neutral slider but the model has a warning. |
| **Audit signal** | Look up `assumptionAudit.results` for this key. If `severity = 'warn'` or `'error'`: is the `signal` text and `reason` now visible to the user? As of the AssumptionHealthBanner integration, it should appear both in the banner and as an inline row below the slider. Verify: is the signal text non-technical enough for a non-expert? |
| **Suggested fix** | If `suggestedValue` is present, state it and confirm the "→ Use X%" snap button appears inline on the slider. |
| **Confidence** | State `confidence` from the audit result (`high`/`medium`/`low`). Flag any `low` confidence assumptions — sector fallbacks and single-analyst coverage are essentially guesses and should be labelled accordingly. |

**Example output for this section:**

```
ASSUMPTION EXPLAINABILITY AUDIT — [TICKER]

revenueCAGR: 18.4%
  Source: analyst_estimate (54 analysts) — credible ✓
  Description: "How fast you expect revenue to grow each year..." ✓
  sourceExplanation: "54 analysts: FY+1 16.6%, FY+2 14.6%; hist 3Y 12.4% → blended 18.4%" ✓
  Benchmarks: [Analyst consensus: 18.5%, Fundamental: 16.1%] ✓
  Heat: neutral (1% above analyst — within threshold) ✓
  Audit: ok (confidence: high) ✓
  Snap button: n/a (no suggestedValue)

netMargin: 5.0%
  Source: historical_3y_median — but NOTE: this is using FY2021 data via F13 bug ⚠
  Description: "What fraction of revenue becomes profit by year 5..." ✓
  sourceExplanation: "3Y median X%, last Y%; stable (+0.5%)" — generic, no company numbers
  Benchmarks: none populated — user cannot compare to sector peer ⚠
  Heat: neutral — NO signal that 5% is drastically below actual 13% ⚠ CRITICAL
  Audit: severity=warn — "Aggressive expansion (+44.2pp vs trailing)" ✓ (should appear inline)
  Snap button: "→ Use 13.2%" should appear inline ✓
  Confidence: medium

exitPE: 38×
  Source: historical_3y_median — label misleading, actually sector-median path
  Description: "P/E multiple at exit year — most mature companies trade at 15–25×" ✓
  sourceExplanation: "No current P/E; sector median 38× (Software - Application)" ← no current P/E means peRatio=null in auditBundle (F2 if not fixed)
  Benchmarks: [Sector: 38×] — should also show current P/E if available
  Heat: neutral
  Audit: ok (consistent with +1Y forward P/E) ✓
```

### 7B — Overall assumption health summary

- State `assumptionAudit.grade` (A/B/C/D) and `score` (0–100).
- List every `warn` and `error` result with the full `signal` text and `reason`.
- State whether the **AssumptionHealthBanner** is showing in the UI for this stock. It should appear above every method's slider section when `assumptionAudit` is non-null.
- Verdict: would a non-expert investor understand which assumptions need review just from reading the UI — without reading this audit?

### 7C — Confidence transparency

For each assumption where `confidence = 'low'` (sector fallback, ≤ 2 analysts, no peer data):
- The user is seeing a model guess presented as a derived value.
- Is the `source` badge and `sourceExplanation` clear enough that the user understands this is a fallback?
- State what information would improve confidence (e.g., "adding analyst estimates would upgrade this from sector-fallback to analyst_estimate").

### 7D — User-language check

For every `warn` or `error` audit result, read the `reason` text and check for jargon:
- Terms like "NOPAT", "CAGR cap", "geo-discount", "convergence discount", "CRP" are opaque to non-experts.
- Terms like "Gordon Growth", "WACC-g spread", "terminal value" need brief context the first time they appear.
- If the reason text would confuse a CFO (not a financial modelling specialist), flag it with a suggested plain-English rewrite.

---

### Summary header (always first)
```
TICKER: [TICKER]
companyType: [type]
CAGR seeded: X%  (raw blended: X%, cap applied: X%)
Exit P/E: X×  (currentPE: X×, sector: X×, path: [blend/cap/floor/premium])
Exit EV/EBITDA: X×
EV/Revenue: X×
Net margin (exit): X%  (trailing: X%, path: [stable/SaaS/pre-profit])
WACC: X% / Ke: X% / terminalG: X% / spread: Xbps
baseFCF: $XM / lastHistFCF: $XM / ratio: X.XXx [ok / F4-flag]
taxRate: [null/X%] / fallback: [21% / actual X%]
TV% of EV: X% [flag if >75%]
Blended FV (FCFF DCF): $X
Triangulated FV: $X
Current price: $X / Upside: X%

Data quality flags: [F1/F4/F6/F13/F14 etc. — list every fired]
Guards fired: [list]
Guards NOT fired but should: [list]
Critical issues: [numbered, priority order]
```

### Per-assumption table
| Assumption | API value | Manual check | Match? | Severity |

### Per-row table (Full DCF)
| Row | Historical TTM | Year 1E | Year 2E | Year 3E | Path | Correct? | Issue |

### Historical financial table (Phase 4A–4C)
Inline tables as specified in Phase 4.

### Missing lines table (Phase 5)
Inline table as specified.

### Guard coverage table (Phase 6)
Inline table as specified.

### Assumption explainability table (Phase 7)
| Assumption | Source | Description? | sourceExplanation specific? | Benchmarks? | Heat vs audit match? | Audit severity | User can act? |
|---|---|---|---|---|---|---|---|

### Prioritized fix list
Rank by severity:
- **File + function + line**
- **Trigger**: what input causes it
- **Wrong → Correct**: actual values
- **Fix**: one sentence

---

## Calibration Reference — Known Issues by Stock Type

**Financial / Fintech (NU, SOFI, JPM, BAC):**
- D&A = 0, NWC = 0 in projections. LFCF dominates (85-90%). P/B is adaptive method.
- Financial FCF guard (NI × 0.80) must fire when raw OCF includes deposit flows.
- FCFF FV is directionally wrong (NI misused as enterprise FCF) — weight-managed at 5%. **[F9]**
- P/B anchor: Banks—Diversified → 1.2×, Credit Services → 1.8×, Banks—Regional → 1.1×.
- CRP non-zero for LatAm/EM-domiciled fintechs (NU: CRP~1.25%).

**Cyclical semiconductors (MU):**
- Cyclical trough guard must fire when median EBIT < −2%.
- AI semi premium (38×) must fire for Semiconductors with CAGR > 25% and revenueM ≥ 100.
- EBIT null: NI-derived fallback fires. Watch for F7: trough-distorted median (MU median=3.1% vs TTM=22.8%).

**Foreign ADR non-USD (TSM=TWD, RMS=EUR, ASML=EUR):**
- foreignCurrency=true. fxRate applied to all financial figures. CRP=0 for Netherlands (AAA).
- CAGR: 35% historical / 50% analyst weights (not the old 0% historical).
- ARS exclusion must NOT fire (only Argentina inflation).

**Foreign ADR USD-reporting (BABA, PDD):**
- foreignCurrency may be false even for Chinese companies.
- CRP non-zero (~3-4% for China VIE structure). WACC has CRP added.

**High-P/E profitable tech (PLTR, AMD, ARM):**
- F8 guard gap: exitPE = currentPE×(55/90) + sectorPE×(35/90). For pe/sector > 3× with nm > 15%: exitPE embeds speculative premium. No automatic cap.
- Correct check: `exitPE ≤ sectorPE × 2.5` — flag if exceeded.

**SBC-heavy growth (ZETA, DUOL, SNAP early):**
- SBC-distorted EBIT ramp must fire (medianEbit<-2%, medianFcf>0, growth/startup).
- isHighGrowthSaaS: last < 15% (raised from 10%).
- F13 risk: if historical IS includes early-stage years with huge GAAP gains (warrant fair value), deriveNetMargin 'last' may be the oldest year.

**Pre-revenue startups (SATL, NBIS):**
- exitPE = sector median (no AI premium without revenueM ≥ 100).
- EBITDA negative → ev_ebitda excluded → weight redistributed to revenue_multiple.
- Near-zero DCF output is correct, not a bug.

**Capital-intensive non-financial (NEE, SO, TSM, XOM):**
- F4 upper-bound: Yahoo FCF ignores regulated capex (utilities 2.30×) or uses OCF-only (NFLX 1.73×).
- D&A/Rev can be 20-40% — is the medianDnaPct blend tracking the trend?
- CapEx/Rev > 20%: verify monotonic-capex check (F5).

**Content companies (NFLX, DIS):**
- D&A includes content amortization (~37% of NFLX revenue). Verify `dna` field captures it.
- FCF ≠ OCF − capex for NFLX: Yahoo FCF adds back partial content amortization.
- baseFCF/histFCF ratio check mandatory (NFLX 1.73× confirmed).

**Auto OEMs (TSLA, GM, F, TM):**
- isAutoIndustry carve-out blocks thin-margin P/E cap entirely. **[F11]**
- Check if `exitPE > sectorPE × 20` for speculative names (TSLA: 222×).

**Closed-end funds (TY, GAB):**
- alt_asset type misapplied. **[F15]** FCFF near-zero. Check `quote.quoteType = 'CEF'`.
- Triangulation via multiples only reliable number.

---

## Notes for the Agent

- Every number stated must come from the actual API response or source code trace — no hypotheticals.
- taxRate is null for every FMP-sourced ticker (33/33 confirmed). Always check and report the fallback impact.
- Terminal value > 75% of EV is always a sensitivity flag, regardless of other correctness.
- F13 (deriveNetMargin newest-first ordering) affects any company with a peak-year NI% that's significantly above the most recent year. Check proactively for warrant gains, asset sales, deferred tax reversals.
- The six calibration stocks (SOFI, NU, TSM, BABA, SATL, MU) each exposed a specific class of bug. Use them as a mental checklist against similar companies.
