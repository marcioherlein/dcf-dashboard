# Data Flow Map: Stock Page Data Sources and Calculations

This document traces every data fetch, API call, calculation, and persistence operation on the stock detail page.

---

## Initial Data Load: /api/financials

### Overview
- **Endpoint**: `GET /api/financials?ticker={ticker}`
- **File**: `app/api/financials/route.ts:16-680`
- **Triggered**: On page mount (useEffect at line 144-159 in page.tsx)
- **Returns**: Single `FinancialsData` object
- **Error Handling**: Caught and displayed in red error banner (page.tsx:235-239)

### Data Fetching Inside /api/financials

The financials route makes six parallel data fetches at line 21-28:

#### 1. Financial Statements (Yahoo Finance)
- **Function**: `getFinancials(ticker)` from `@/lib/data/yahooClient`
- **Source**: Yahoo Finance API
- **Data**: Income statements, balance sheet, cash flow (last 4 years historical)
- **Currency**: Detected from `financials.financialData.financialCurrency`
- **Error Handling**: Continues if error (data is optional in cascade)

#### 2. Quote Data (Yahoo Finance)
- **Function**: `getQuote(ticker)` from `@/lib/data/yahooClient`
- **Source**: Yahoo Finance API
- **Data**: Current price, market cap, P/E, 52-week high/low, analyst target, currency
- **Error Handling**: Continues if error

#### 3. Historical Stock Prices (Yahoo Finance)
- **Function**: `getHistorical(ticker, '5y')` from `@/lib/data/yahooClient`
- **Source**: Yahoo Finance API
- **Time Period**: 5 years of daily closing prices
- **Use**: Input to `calculateBeta` (line 47-52)
- **Error Handling**: Continues if error

#### 4. SPY Index Prices (Yahoo Finance)
- **Function**: `getSPYHistorical()` from `@/lib/data/yahooClient`
- **Source**: Yahoo Finance API (SPY benchmark index)
- **Time Period**: Matches stock history
- **Use**: Input to `calculateBeta` for beta regression (line 47-52)
- **Error Handling**: Continues if error

#### 5. Risk-Free Rate (FRED)
- **Function**: `getRfRate()` from `@/lib/data/fredClient`
- **Source**: Federal Reserve Economic Data (FRED) API
- **Data**: Current 10-year Treasury yield or similar benchmark
- **Use**: Input to WACC calculation (line 55)
- **Error Handling**: Continues if error

#### 6. Detailed Financial Metrics (FMP)
- **Function**: `getFmpBundle(ticker)` from `@/lib/data/fmpClient`
- **Source**: Financial Modeling Prep (FMP) API
- **Data**: Multi-year income statements, balance sheets, cash flows, key metrics, ratios
- **Error Handling**: Graceful fallback to empty arrays at line 27 (`.catch(() => ({ incomeStatements: [], cashFlowStatements: [], balanceSheets: [], keyMetrics: [], ratios: [] }))`); continues with Yahoo-only data

---

## Calculations Inside /api/financials

### Flow Overview
The route performs calculations in this order:
1. Currency conversion (FX rate lookup if needed)
2. Beta calculation
3. WACC calculation
4. FCF extraction and CAGR analysis
5. DCF projection and fair value
6. Financial quality scores
7. Multi-model valuation (FCFF, FCFE, DDM, multiples)
8. Financial statements and projections

### Currency Handling
**Location**: Lines 37-44
- **Detection**: Compares `fin.financialData?.financialCurrency` to `quote.currency`
- **If Mismatch**: Calls `getFXRate(fromCurrency, toCurrency)` to get conversion multiplier
- **Application**: Applied to all financial figures (line 62-64, 98, etc.)
- **Stored**: `fxRate` variable (multiplier like 0.123 for CNY->USD)

### Beta Calculation
**Location**: Lines 47-52
- **Function**: `calculateBeta(stockHistory, spyHistory)` from `@/lib/dcf/calculateBeta`
- **Inputs**:
  - Array of stock prices (5 years daily closes)
  - Array of SPY index prices (same period)
- **Output**: Beta value (decimal, e.g. 1.05)
- **Use**: Input to WACC calculation

### WACC Calculation
**Location**: Lines 55-56
- **Step 1**: `extractWACCInputs(fin, rfRate, beta, fxRate)` — extracts rates, debt, equity, tax rate
  - **Inputs**:
    - Balance sheet debt figures
    - Market cap
    - Risk-free rate (from FRED)
    - Beta (calculated above)
    - Tax rate (from financials)
    - FX conversion factor
  - **Outputs**: Object with rfRate, beta, erp (equity risk premium), costOfDebt, taxRate, debtToEquity
- **Step 2**: `calculateWACC(waccInputs)` — computes WACC using standard formula
  - **Formula**: WACC = (E/V * costOfEquity) + (D/V * afterTaxCostOfDebt)
  - **Output**: `waccResult` object with wacc, costOfEquity, afterTaxCostOfDebt, weights

### FCF & CAGR Calculation
**Location**: Lines 61-70
- **Function**: `extractFCFInputs(fin, foreignCurrency)` from `@/lib/dcf/projectCashFlows`
- **Inputs**:
  - Income statement history (4 years from Yahoo)
  - Cash flow statement history
  - Foreign currency flag (if reporting currency ≠ quote currency)
- **Outputs**:
  - `baseFCF`: Most recent annual free cash flow (in financial currency)
  - `cagr`: 3-year CAGR or analyst estimate blended
  - `cagrAnalysis`: Object with historical CAGR, analyst estimates, confidence
  - `historicalRevenues`: Array of last 4 years revenues
  - `isNegativeFCF`: Boolean flag
- **Currency Conversion**: `baseFCF` and revenues multiplied by `fxRate` (lines 62-64)
- **FCF Sanity Check**: Line 66-70 caps FCF yield at 15% if result seems unrealistic

### Terminal Growth Rate
**Location**: Lines 73-80
- **Logic**:
  - If CAGR > 15%: terminalG = 2.5% (high-growth companies)
  - If CAGR > 5% and <= 15%: terminalG = 2.0% (standard)
  - If CAGR <= 5%: terminalG = 1.5% (mature)
- **Rationale**: Terminal growth should approximate long-run nominal GDP growth
- **Stored**: `terminalG` variable (decimal, e.g. 0.020)

### Growth Model Selection
**Location**: Lines 78-80
- **Logic**:
  - If CAGR > 15% OR isNegativeFCF: use three-stage model
  - Otherwise: use two-stage model
- **Stored**: `growthModel` variable ('two-stage' | 'three-stage')

### DCF Projection
**Location**: Lines 81
- **Function**: `projectCashFlows({ baseFCF, cagr, wacc, terminalG, growthModel })`
- **Inputs**: Base FCF, growth rate (CAGR), discount rate (WACC), terminal growth, model type
- **Outputs**: `dcfResult` object with:
  - `projections`: Array of 5-10 years with { year, cashFlow, discounted }
  - `terminalValue`: Value of all cash flows beyond projection period
  - `terminalValueDiscounted`: Terminal value discounted to today
  - `sumPV`: Sum of discounted projected FCFs
  - `ev`: Enterprise value (sumPV + terminalValueDiscounted)

### Balance Sheet Items
**Location**: Lines 84-130
- **Cash**: Extracted from balance sheet with fallback chain (lines 87-97)
  - Tries: cash, cashAndCashEquivalents, cashAndShortTermInvestments, etc.
  - Converted to millions: `cashM = cashRaw / 1e6 * fxRate`
- **Debt**: Special handling for financial sector (lines 100-127)
  - Banks/insurers: Use only long-term debt (lines 110-111)
  - Other companies: Total debt with fallback chain (lines 112-125)
  - Safety cap: Debt capped at 3x market cap (line 127)
  - Converted to millions: `debtM`
- **Shares Outstanding**: Converted to millions: `sharesM`

### Fair Value Calculation
**Location**: Line 132
- **Function**: `calculateFairValue(dcfResult, cashM, debtM, sharesM, currentPrice)`
- **Inputs**:
  - DCF results (EV, projections, terminal value)
  - Cash, debt (both in millions)
  - Shares outstanding (millions)
  - Current stock price
- **Formula**:
  - Equity Value = EV + Cash - Debt
  - Fair Value Per Share = Equity Value / Shares Outstanding
  - Upside % = (Fair Value - Current Price) / Current Price
- **Outputs**: `fairValue` object with fairValuePerShare, upsidePct, irr

### Scenario Analysis
**Location**: Line 135
- **Function**: `buildScenarios(waccResult, cagr, terminalG, baseFCF, cashM, debtM, sharesM, 0, growthModel)`
- **Creates**: Three scenarios (bull, base, bear)
  - **Bull**: Reduced WACC, increased CAGR
  - **Base**: Base case values
  - **Bear**: Increased WACC, decreased CAGR
- **Outputs**: `scenarios` object with { bull: { fairValue, wacc, cagr, terminalG }, base: {...}, bear: {...} }

### Ratings Calculation
**Location**: Lines 167-193
- **Function**: `calculateRatings({...})` from `@/lib/dcf/calculateRatings`
- **Inputs**: Margins, ratios, growth rates, beta, market cap, upside %
- **Scoring**: Grades company across profitability, growth, health, valuation
- **Outputs**: `ratings` object with overall grade (A-F) and component grades

---

## Financial Quality Scores

### Piotroski F-Score
**Location**: Line 211
- **Function**: `calculatePiotroski(rawBSStmts, rawISStmts, rawCFStmts, sharesNow, sharesPrior)`
- **File**: `lib/dcf/calculateScores.ts:17-117`
- **Inputs**:
  - Balance sheet history (this year, prior year)
  - Income statement history (this year, prior year)
  - Cash flow statement (this year)
  - Current share count
  - Prior share count (estimated from net buybacks/issuances)
- **Criteria** (9 binary checks, each worth 1 point):
  1. ROA positive
  2. Operating CF positive
  3. ROA improving YoY
  4. Accrual quality (OCF > Net Income)
  5. Leverage falling YoY
  6. Liquidity rising YoY (current ratio)
  7. No share dilution (< 0.5% growth)
  8. Gross margin rising YoY
  9. Asset turnover rising YoY
- **Score Ranges**: 0-9
  - 8-9: Strong
  - 4-7: Mixed
  - 0-3: Weak

### Altman Z-Score
**Location**: Line 212
- **Function**: `calculateAltman(bs0, inc0, marketCapLocal)` from `lib/dcf/calculateScores.ts:127-172`
- **Inputs**:
  - Current balance sheet
  - Current income statement
  - Market cap (in reporting currency, not converted)
- **Five Components** (X1-X5):
  1. X1 = (Current Assets - Current Liabilities) / Total Assets
  2. X2 = Retained Earnings / Total Assets
  3. X3 = EBIT / Total Assets
  4. X4 = Market Cap / Total Liabilities
  5. X5 = Revenue / Total Assets
- **Formula**: Z = 1.2*X1 + 1.4*X2 + 3.3*X3 + 0.6*X4 + 1.0*X5
- **Zones**:
  - >= 3.0: Safe
  - 1.8-3.0: Grey
  - < 1.8: Distress
- **Returns**: null if Z-Score > 50 or < -20 (invalid)

### Beneish M-Score
**Location**: Lines 213-215
- **Function**: `calculateBeneish(bs0, bs1, inc0, inc1, cf0)` from `lib/dcf/calculateScores.ts:185-288`
- **Inputs**: Requires 2 years of balance sheet and income statement data
- **Condition**: Only calculated if `rawBSStmts.length >= 2 && rawISStmts.length >= 2` (line 213)
- **Eight Indices**:
  1. DSRI: Days Sales in Receivables Index
  2. GMI: Gross Margin Index
  3. AQI: Asset Quality Index
  4. SGI: Sales Growth Index
  5. DEPI: Depreciation Index
  6. SGAI: SGA Expense Index
  7. TATA: Total Accruals to Total Assets
  8. LVGI: Leverage Index
- **Formula**: M = -4.84 + 0.920*DSRI + 0.528*GMI + ... (weighted sum)
- **Flags**:
  - <= -1.78: Clean
  - -1.78 to -1.50: Warning
  - > -1.50: Manipulator (red flag)
- **Returns**: null if M-Score > 50 or < -50 (invalid)

### ROIC Calculation
**Location**: Line 216
- **Function**: `calculateROIC(bs0, bs1, inc0, taxRate, wacc, fxRate)` from `lib/dcf/calculateScores.ts:300-352`
- **Inputs**:
  - Current and prior balance sheets
  - Income statement
  - Tax rate
  - WACC
  - FX conversion rate
- **NOPAT**: Net Operating Profit After Tax
  - `NOPAT = EBIT * (1 - Tax Rate)`
- **Invested Capital**: TA - AP - Excess Cash
  - Excess Cash = Cash above operating needs
- **Formula**: ROIC = NOPAT / Avg(IC0, IC1)
- **Spread**: ROIC - WACC (spread > 0 indicates value creation)

---

## FMP Data Enrichment & Overrides

**Location**: Lines 354-389 in /api/financials/route.ts

### FMP Bundle Loading
- **Condition**: `hasFmp = fmp.incomeStatements.length > 0` (line 356)
- **If FMP available**: Override Yahoo margins with FMP data (lines 368-369, 374-378, 381-388)
  - FMP Gross Margin
  - FMP Net Margin
  - FMP FCF Margin
  - FMP ROIC (more reliable than manual calculation)

---

## Financial Statements Construction

**Location**: Lines 390-632 in /api/financials/route.ts

The financials route constructs three arrays of historical + projected data:

### Income Statement
**Location**: Lines 425-488

**Historical Rows** (lines 426-469):
- Source: FMP if available (lines 426-437), otherwise Yahoo (lines 438-469)
- Fields: year, revenue, grossProfit, operatingIncome, ebitda, netIncome, eps, operatingMargin, isProjected: false

**Projected Rows** (lines 471-486):
- 5 years of projections based on:
  - Latest revenue + CAGR growth
  - Average net income margin
  - Average gross/EBITDA margins
- Marked: `isProjected: true`

### Cash Flow Statement
**Location**: Lines 490-577

**Historical Rows** (lines 515-557):
- Source: FMP if available (lines 515-527), otherwise Yahoo (lines 528-557)
- Fields: year, operatingCF, capex, freeCashFlow, investingCF, financingCF, dividendsPaid, buybacks, isProjected: false
- Includes averages: avgCapexM, avgDivPaidM, avgBuybackM (lines 491-513)

**Projected Rows** (lines 559-575):
- 5 years of projections:
  - FCF from DCF projections
  - Operating CF = FCF - average CapEx
  - Dividends/buybacks from historical averages
  - Marked: `isProjected: true`

### Balance Sheet
**Location**: Lines 579-630

**Historical Rows** (lines 580-604):
- Source: FMP if available (lines 580-590), otherwise Yahoo (lines 591-604)
- Fields: year, cash, totalCurrentAssets, totalAssets, longTermDebt, totalCurrentLiabilities, totalEquity, isProjected: false

**Projected Rows** (lines 606-628):
- Requires at least 2 historical rows (line 608)
- 5 years of projections:
  - Cash: Prior cash + Projected FCF - Dividends
  - Equity: Prior equity + Projected net income - Dividends
  - Assets: Prior assets + Projected FCF
  - Debt: Assumed constant (held at prior year level)
  - Marked: `isProjected: true`

---

## Multi-Model Valuation (Triangulation)

**Location**: Lines 231-352 in /api/financials/route.ts

### Input Data Extraction
- **Dividend Data** (lines 234-236): From summaryDetail
  - dividendPerShare, dividendYield, payoutRatio
- **Multiples** (lines 238-243): From various sources
  - P/E, P/B, P/S, EV/EBITDA, EV/Revenue
- **Net Income** (lines 245-251): Average of 2-year income statement (more reliable than TTM)

### Company Type Detection
**Location**: Line 254
- **Function**: `detectCompanyType({...})` from `@/lib/dcf/detectCompanyType`
- **Inputs**: Sector, industry, dividend yield, CAGR, FCF status, revenue
- **Output**: 'standard' | 'growth' | 'financial' | 'dividend' | 'startup'
- **Purpose**: Determines which valuation methods apply and their weights

### Model 1: FCFF (Always Applicable)
**Location**: Lines 304-305
- Already calculated in DCF section
- `fairValue.fairValuePerShare`

### Model 2: FCFE (Levered FCF to Equity)
**Location**: Lines 306-310
- **Function**: `calculateFCFE(netIncomeM, cagr, costOfEquity, terminalG, cashM, debtM, sharesM, currentPrice)`
- **Applicable**: When company has positive net income
- **Output**: `fcfeResult` with fairValuePerShare, upsidePct, applicable (boolean)

### Model 3: DDM (Dividend Discount Model)
**Location**: Lines 268-269, 309
- **Function**: `calculateDDM(dividendPerShare, costOfEquity, roe, payoutRatio, currentPrice)`
- **Applicable**: When company has dividend > 0
- **Output**: `ddmResult` with fairValuePerShare, upsidePct, applicable (boolean)

### Model 4: Multiples (Relative Valuation)
**Location**: Lines 275-297, 312-314
- **Step 1**: Fetch live peer quotes (lines 280-284)
  - Non-blocking: falls back to static medians if peer fetch fails
- **Step 2**: `calculateMultiples({...})` — blends P/E, P/B, P/S, EV/EBITDA, EV/Revenue
  - Uses industry medians or peer averages
  - Output: `multiplesResult` with blendedFairValue, upsidePct
- **Applied**: Only if `blendedFairValue !== null` (line 312)

### Triangulation
**Location**: Lines 316-331
- **Step 1**: Calculate total applicable weight
  - FCFF: always included (weight.fcff)
  - FCFE: if applicable (weight.fcfe)
  - DDM: if applicable (weight.ddm)
  - Multiples: if applicable (weight.multiples)
- **Step 2**: Normalize weights to 1.0 (line 317)
- **Step 3**: Compute weighted average:
  - `triangulatedFairValue = SUM(value * weight / totalWeight)`
- **Output**: `triangulatedFairValue`, `triangulatedUpsidePct`

---

## Valuations Persistence: /api/valuations

### Endpoint Definition
- **File**: `app/api/valuations/route.ts`
- **Route**: `POST /api/valuations`

### Database: Supabase
**Location**: `lib/data/supabaseClient.ts:29-34`

**Function**: `saveValuation(snapshot: ValuationSnapshot)`
- **Table**: `valuations` (Supabase PostgreSQL table)
- **Columns**:
  - `id` (UUID, auto-generated): Primary key
  - `ticker` (text): Stock ticker
  - `company` (text): Company name
  - `saved_at` (timestamp): When saved
  - `price_at_save` (numeric): Stock price at save time
  - `fair_value` (numeric): Fair value per share
  - `wacc` (numeric): WACC used
  - `beta` (numeric): Beta
  - `terminal_g` (numeric): Terminal growth rate
  - `cagr` (numeric): CAGR used
  - `upside_pct` (numeric): Upside percentage
  - `inputs` (jsonb): WACC calculation inputs (rfRate, beta, erp, costOfDebt, taxRate, debtToEquity)
  - `scenarios` (jsonb): Bull/base/bear scenarios
- **Operation**: INSERT query at line 32

### Save Trigger
**Location**: `app/stock/[ticker]/page.tsx:161-201` — `handleSave` function

**Called By**: ValuationHistory component (line 448)
- Payload includes:
  - ticker, company name
  - price_at_save (current quote.price)
  - fair_value (fairValuePerShare, potentially overridden)
  - wacc (waccOverride ?? data.wacc.wacc)
  - beta, terminal_g, cagr, upside_pct
  - inputs (WACC calculation details)
  - scenarios (bull/base/bear fair values)

**Error Handling**: 
- If POST fails (res.ok === false), falls back to local storage (lines 184-192)
- Uses `saveLocal` from ValuationHistory component
- Local backup includes: id, saved_at, price_at_save, fair_value, wacc, cagr, upside_pct

### Retrieval
**Location**: `lib/data/supabaseClient.ts:37-48`
- **Function**: `getValuations(ticker: string)`
- **Query**: SELECT * FROM valuations WHERE ticker = ticker.toUpperCase() ORDER BY saved_at DESC LIMIT 20
- **Returns**: Last 20 snapshots for the ticker
- **Error Handling**: Returns empty array if Supabase not configured (line 39)

---

## Recalculation Endpoint: /api/recalculate

### Endpoint Definition
- **File**: `app/api/recalculate/route.ts`
- **Route**: `GET /api/recalculate`
- **Purpose**: Stateless recalculation — client passes all inputs, server re-runs DCF math
- **No External Data Fetches**: Only uses inputs from query string

### Query Parameters
**Location**: Lines 12-20
- `baseFCF` (float): Base free cash flow (millions)
- `cagr` (float): Base CAGR (decimal: 0.05 = 5%)
- `wacc` (float): Base WACC (decimal: 0.10 = 10%)
- `terminalG` (float): Base terminal growth (decimal: 0.02 = 2%)
- `growthModel` (string): 'two-stage' | 'three-stage'
- `cashM` (float): Cash balance (millions)
- `debtM` (float): Debt balance (millions)
- `sharesM` (float): Shares outstanding (millions)
- `currentPrice` (float): Current stock price
- `cagrOverride` (optional float): Override CAGR (% format: 5.0)
- `waccOverride` (optional float): Override WACC (% format: 10.0)
- `terminalGOverride` (optional float): Override terminal G (% format: 2.0)

### Processing
**Location**: Lines 31-83

**Step 1**: Parse overrides (lines 31-33)
- Convert from percentage to decimal (divide by 100)
- Use NaN as "not provided" sentinel

**Step 2**: Clamp inputs to safe ranges (lines 35-38)
- CAGR: 0-60%
- WACC: 4-30%
- Terminal G: 0 to (WACC - 0.5%)

**Step 3**: Re-select growth model if CAGR crosses 15% threshold (lines 40-41)

**Step 4**: Re-project cash flows (lines 43-49)
- Call `projectCashFlows({...})` with clamped inputs
- Return: projections array, terminal value, discounted values

**Step 5**: Recalculate fair value (line 51)
- Call `calculateFairValue(dcf, cashM, debtM, sharesM, currentPrice)`

**Step 6**: Rebuild scenarios (line 69)
- Create synthetic WACC object (lines 54-68) with clamped values
- Call `buildScenarios(...)` for bull/base/bear

### Return Value
**Location**: Lines 71-83
```json
{
  "fairValue": <number>,
  "upsidePct": <number>,
  "irr": <number>,
  "appliedCagr": <number>,
  "appliedWacc": <number>,
  "appliedTerminalG": <number>,
  "scenarios": {
    "bull": { "fairValue": <number>, "cagr": <number>, "wacc": <number>, "terminalG": <number> },
    "base": { ... },
    "bear": { ... }
  }
}
```

---

## Data Access Hierarchy

```
StockPage (page.tsx)
├── Loads: /api/financials?ticker={ticker}
│   ├── Fetches: Yahoo Finance (financials, quote, history, SPY)
│   ├── Fetches: FRED (rfRate)
│   ├── Fetches: FMP (detailed statements, metrics, ratios)
│   ├── Calculates: Beta, WACC, DCF, fair value, scores
│   ├── Constructs: Financial statements (hist + projected)
│   └── Returns: FinancialsData (comprehensive object)
│
├── Component: ModellingWorkspace (when activeTab === 'modelling')
│   ├── Normalizes: /api/financials data via normalizeModellingInputs()
│   ├── Builds: Assumption set from historical data
│   ├── Computes: UFCF + LFCF rows
│   ├── Calculates: Terminal values (perpetuity + exit multiple)
│   └── Derives: Fair values (UFCF-based and LFCF-based)
│
└── Component: ValuationHistory (inside collapsible)
    ├── Retrieves: /api/valuations?ticker={ticker}
    ├── Saves: POST /api/valuations (on "Save" button)
    │   └── Persists to: Supabase table "valuations"
    └── Fallback: Local storage if Supabase POST fails
```

---

## Error Handling Strategy

### Silent Fallbacks (No UI Error)
1. **FMP Bundle Failure** (line 27): Falls back to empty arrays, continues with Yahoo data
2. **Peer Quote Fetch Failure** (line 283): Falls back to static industry medians
3. **FX Rate Fetch**: Proceeds with fxRate = 1.0 if currency mismatch detected but rate unavailable
4. **Supabase Unavailable**: saveValuation falls back to local storage

### Visible Errors (Shown to User)
1. **Missing Ticker**: 400 status from /api/financials
2. **All Yahoo Finance Calls Fail**: 500 status with message "Failed to fetch data"
3. **Supabase POST Fails**: Shown in toast/modal, with local storage fallback message

---

## Key Calculation Entry Points Summary

| Calculation | Function | File | Inputs | Outputs |
|---|---|---|---|---|
| Beta | calculateBeta() | lib/dcf/calculateBeta | Stock history, SPY history | Beta (decimal) |
| WACC | calculateWACC() | lib/dcf/calculateWACC | Rates, debt, equity, tax | WACC, cost of equity, cost of debt |
| FCF/CAGR | extractFCFInputs() | lib/dcf/projectCashFlows | Income stmt, cash flow stmt | Base FCF, CAGR, analysis |
| DCF | projectCashFlows() | lib/dcf/projectCashFlows | FCF, CAGR, WACC, term G | Projections, terminal value, EV |
| Fair Value | calculateFairValue() | lib/dcf/calculateFairValue | DCF result, cash, debt, shares | Fair value/share, upside % |
| Scenarios | buildScenarios() | lib/dcf/calculateFairValue | WACC, CAGR, term G, FCF | Bull/base/bear valuations |
| Ratings | calculateRatings() | lib/dcf/calculateRatings | Margins, ratios, growth, cap | Grade (A-F), component grades |
| Piotroski | calculatePiotroski() | lib/dcf/calculateScores | BS/IS/CF history, shares | Score (0-9), criteria, label |
| Altman | calculateAltman() | lib/dcf/calculateScores | BS, IS, market cap | Z-score, zone, components |
| Beneish | calculateBeneish() | lib/dcf/calculateScores | 2y BS/IS/CF | M-score, flag, indices |
| ROIC | calculateROIC() | lib/dcf/calculateScores | BS, IS, tax rate, WACC | ROIC, spread, nopat, IC |
| Multiples | calculateMultiples() | lib/dcf/calculateMultiples | Ratios, peer data, industry | Blended fair value |

