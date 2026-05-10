# Verified UI Render Tree: app/stock/[ticker]/page.tsx

This document traces the complete render tree of the stock detail page, documenting every component, its file path, rendering conditions, and props received.

## Page Overview

- **Route**: `app/stock/[ticker]/page.tsx`
- **Type**: Client component (`'use client'`)
- **Entry Point**: `StockPage()` function
- **State Management**:
  - `data` (FinancialsData | null) — loaded from `/api/financials?ticker={ticker}`
  - `loading` (boolean)
  - `error` (string)
  - `saving` (boolean)
  - `detailsOpen` (boolean) — toggles "Show full analysis" section
  - `activeTab` (TabId) — one of: summary, financials, valuation, modelling, quality, ownership, news
  - `waccOverride` (number | null) — from WACCBreakdown inline editor
  - `terminalGOverride` (number | null) — from DCFModel inline editor

---

## Root Layout (Always Rendered)

### 1. Breadcrumb Navigation
**Location**: `app/stock/[ticker]/page.tsx:208-219`
- **Component**: Inline HTML (not a separate component)
- **Props**: None (uses `ticker` from `useParams`, `router` from `useRouter`)
- **Conditions**: Always visible
- **Functions**: 
  - "← Home" button: calls `router.push('/')`
  - Displays ticker badge and company name

### 2. TabNav Component
**Location**: `/components/stock/TabNav.tsx:82-110`
- **File Path**: `components/stock/TabNav.tsx`
- **Props**:
  - `activeTab` (TabId): current selected tab (summary, financials, valuation, modelling, quality, ownership, news)
  - `onChange` ((tab: TabId) => void): callback to set `activeTab` state
- **Conditions**: Rendered only when `data && !loading` (line 222-223)
- **Behavior**: Sticky tab navigation bar with 7 tabs; active tab shows blue underline

---

## Main Content Area Conditional Rendering

### Loading State
**Location**: `app/stock/[ticker]/page.tsx:228-233`
- **Condition**: `loading === true`
- **Renders**: 
  - Spinner animation (spinning border)
  - Text: "Calculating WACC · Beta · DCF…"

### Error State
**Location**: `app/stock/[ticker]/page.tsx:235-239`
- **Condition**: `error !== ''`
- **Renders**: Red error banner with message and fallback text about Yahoo Finance

### Data Loaded State
**Location**: `app/stock/[ticker]/page.tsx:241-458`
- **Condition**: `data && !loading`
- **Scope**: All subsequent components in this section

---

## Tab Content: Summary Tab (activeTab !== 'modelling')

All components in this section render only when `activeTab !== 'modelling'` (wrapped in conditional at line 267).

### 3. PriceHeader
**Location**: `/components/stock/PriceHeader.tsx:20-67`
- **File Path**: `components/stock/PriceHeader.tsx`
- **Condition**: Always rendered when data is loaded (line 245-259)
- **Props**:
  - `ticker` (string): `data.ticker`
  - `companyName` (string): `data.companyName`
  - `price` (number): `data.quote.price`
  - `change` (number): `data.quote.change`
  - `changePct` (number): `data.quote.changePct`
  - `marketCap` (number): `data.quote.marketCap`
  - `peRatio` (number): `data.quote.peRatio`
  - `high52` (number): `data.quote.fiftyTwoWeekHigh`
  - `low52` (number): `data.quote.fiftyTwoWeekLow`
  - `analystTarget` (number): `data.quote.analystTargetMean`
  - `currency` (string): `data.quote.currency ?? 'USD'`
  - `sector` (string): `data.quote.sector ?? ''`
  - `analystRec` (string): `data.analystRecommendation`
- **Displays**: 5-stat grid (Market Cap, P/E Ratio, 52-wk High/Low, Analyst Target)

### 4. AtAGlance
**Location**: `/components/stock/AtAGlance.tsx:40-118`
- **File Path**: `components/stock/AtAGlance.tsx`
- **Condition**: Always rendered when data is loaded (line 270-282)
- **Props**:
  - `companyName` (string): `data.companyName`
  - `price` (number): `data.quote.price`
  - `high52` (number | null): `data.quote.fiftyTwoWeekHigh`
  - `low52` (number | null): `data.quote.fiftyTwoWeekLow`
  - `sector` (string): `data.quote.sector ?? ''`
  - `country` (string): `data.businessProfile.country`
  - `currency` (string): calculated from `data.quote.currency`
  - `fairValue` (number | null): `data.valuationMethods?.triangulatedFairValue ?? data.fairValue.fairValuePerShare`
  - `upsidePct` (number | null): `data.valuationMethods?.triangulatedUpsidePct ?? data.fairValue.upsidePct`
  - `overallGrade` (string): `data.ratings?.overall?.grade ?? 'N/A'`
  - `overallLabel` (string): `data.ratings?.overall?.label ?? ''`
- **Displays**: 3-column card: current price + 52-week range, fair value + upside, health grade

### 5. BusinessModel (Conditional)
**Location**: `/components/stock/BusinessModel.tsx`
- **File Path**: `components/stock/BusinessModel.tsx`
- **Condition**: `data.businessProfile.description || data.historicalRevenues.length >= 2` (line 285)
- **Props**:
  - `businessProfile` (BusinessProfile): `data.businessProfile`
  - `historicalRevenues` (number[]): `data.historicalRevenues`
  - `ticker` (string): `ticker`
  - `isDark` (boolean): `false`
  - `incomeStatement` (array | undefined): `data.financialStatements?.incomeStatement`
  - `cashFlow` (array | undefined): `data.financialStatements?.cashFlow`

### 6. HealthSection (Conditional)
**Location**: `/components/stock/HealthSection.tsx`
- **File Path**: `components/stock/HealthSection.tsx`
- **Condition**: `data.ratings && data.scores` (line 297)
- **Props**:
  - `ratings` (StockRatings): `data.ratings`
  - `scores` (scores object): `data.scores`
  - `financialsData` (FinancialsData): `data`

### 7. ValuationSection (Conditional)
**Location**: `/components/stock/ValuationSection.tsx`
- **File Path**: `components/stock/ValuationSection.tsx`
- **Condition**: `data.valuationMethods` (line 306)
- **Props**:
  - `companyName` (string): `data.companyName`
  - `currency` (string): `currency`
  - `fairValuePerShare` (number): `data.valuationMethods.triangulatedFairValue ?? data.fairValue.fairValuePerShare`
  - `upsidePct` (number): `data.valuationMethods.triangulatedUpsidePct ?? data.fairValue.upsidePct`
  - `valuationMethods` (object): `data.valuationMethods`
  - `scenarios` (scenarios object): `data.scenarios`
  - `currentPrice` (number): `data.quote.price`
  - `financialsData` (FinancialsData): `data`

### 8. ModelSection
**Location**: `/components/stock/ModelSection.tsx`
- **File Path**: `components/stock/ModelSection.tsx`
- **Condition**: Always rendered when data is loaded (line 320)
- **Props**:
  - `baseCagr` (number): `data.cagr`
  - `baseWacc` (number): `data.wacc.wacc`
  - `baseTerminalG` (number): `data.terminalG`
  - `baseFairValue` (number): `data.valuationMethods?.triangulatedFairValue ?? data.fairValue.fairValuePerShare`
  - `currentPrice` (number): `data.quote.price`
  - `currency` (string): `currency`
  - `cagrAnalysis` (CAGRAnalysisData): `data.cagrAnalysis`
  - `baseFCF` (number): `data.baseFCF`
  - `cashM` (number): `data.fairValue.cash`
  - `debtM` (number): `data.fairValue.debt`
  - `sharesM` (number): `data.fairValue.sharesOutstanding`
  - `growthModel` ('two-stage' | 'three-stage'): `data.growthModel ?? 'two-stage'`

### 9. Detailed Analysis (Collapsible Section)
**Location**: `app/stock/[ticker]/page.tsx:335-453`
- **Component**: Inline collapsible card
- **Trigger**: Button "Show full analysis" (line 337-347)
- **State**: `detailsOpen` (boolean)
- **Condition**: Renders children only if `detailsOpen === true` (line 350)

#### 9.1 PriceChart (Inside Collapsible)
**Location**: `/components/stock/PriceChart.tsx`
- **File Path**: `components/stock/PriceChart.tsx`
- **Type**: Dynamic import with no SSR (line 25-28)
- **Condition**: Inside collapsible section (rendered when `detailsOpen === true`)
- **Props**:
  - `ticker` (string): `ticker`
  - `isDark` (boolean): `false`
  - `fcffFairValue` (number): `data.fairValue.fairValuePerShare`
  - `triangulatedFairValue` (number | undefined): `data.valuationMethods?.triangulatedFairValue`
  - `analystTarget` (number): `data.quote.analystTargetMean`

#### 9.2 FinancialStatements (Inside Collapsible, Conditional)
**Location**: `/components/stock/FinancialStatements.tsx`
- **File Path**: `components/stock/FinancialStatements.tsx`
- **Condition**: `data.financialStatements` (line 363)
- **Props**:
  - `incomeStatement` (array): `data.financialStatements.incomeStatement`
  - `balanceSheet` (array): `data.financialStatements.balanceSheet`
  - `cashFlow` (array): `data.financialStatements.cashFlow`
  - `currency` (string): `currency`
  - `cagr` (number): `data.cagr`

#### 9.3 FinancialCharts (Inside Collapsible, Conditional)
**Location**: `/components/stock/FinancialCharts.tsx`
- **File Path**: `components/stock/FinancialCharts.tsx`
- **Condition**: `data.financialStatements` (line 372)
- **Props**:
  - `incomeStatement` (array): `data.financialStatements.incomeStatement`
  - `cashFlow` (array): `data.financialStatements.cashFlow`
  - `currency` (string): `currency`
  - `isDark` (boolean): `false`

#### 9.4 DCFModel
**Location**: `/components/stock/DCFModel.tsx`
- **File Path**: `components/stock/DCFModel.tsx`
- **Condition**: Inside collapsible section (line 382-399)
- **Props**:
  - `projections` (array): `data.dcf.projections`
  - `terminalValue` (number): `data.dcf.terminalValue`
  - `terminalValueDiscounted` (number): `data.dcf.terminalValueDiscounted`
  - `sumPV` (number): `data.dcf.sumPV`
  - `ev` (number): `data.dcf.ev`
  - `fairValue` (fairValue object): `data.fairValue`
  - `wacc` (number): `waccOverride ?? data.wacc.wacc`
  - `cagr` (number): `data.cagr`
  - `terminalG` (number): `data.terminalG`
  - `scenarios` (scenarios object): `data.scenarios`
  - `baseFCF` (number): `data.baseFCF`
  - `terminalGOverride` (number | null): `terminalGOverride`
  - `onTerminalGChange` ((val: number) => void): `setTerminalGOverride`
  - `growthModel` ('two-stage' | 'three-stage' | undefined): `data.growthModel`
  - `yearlyGrowthRates` (number[] | undefined): `data.dcf.yearlyGrowthRates`
  - `historicalFCF` (array | undefined): `data.historicalFCF`

#### 9.5 FCFBuildUp (Inside Collapsible, Conditional)
**Location**: `/components/stock/FCFBuildUp.tsx`
- **File Path**: `components/stock/FCFBuildUp.tsx`
- **Condition**: `data.financialStatements` (line 402)
- **Props**:
  - `incomeStatement` (array): `data.financialStatements.incomeStatement`
  - `balanceSheet` (array): `data.financialStatements.balanceSheet`
  - `cashFlow` (array): `data.financialStatements.cashFlow`
  - `wacc` (number): `waccOverride ?? data.wacc.wacc`
  - `taxRate` (number): `data.wacc.inputs.taxRate`
  - `cash` (number): `data.fairValue.cash`
  - `debt` (number): `data.fairValue.debt`
  - `sharesOutstanding` (number): `data.fairValue.sharesOutstanding`
  - `currentPrice` (number): `data.fairValue.currentPrice`
  - `cagrAnalysis` (CAGRAnalysisData): `data.cagrAnalysis`
  - `currency` (string): `currency`
  - `financialCurrencyNote` (string | undefined): `data.financialCurrencyNote`

#### 9.6 WACCBreakdown (Inside Collapsible)
**Location**: `/components/stock/WACCBreakdown.tsx`
- **File Path**: `components/stock/WACCBreakdown.tsx`
- **Condition**: Inside collapsible section (line 420-423)
- **Props**:
  - `wacc` (wacc object): `data.wacc`
  - `onWACCChange` ((val: number) => void): `(w) => setWaccOverride(w)`
- **Purpose**: Displays WACC component breakdown; allows inline editing of WACC

#### 9.7 CAGRAnalysis (Inside Collapsible, Conditional)
**Location**: `/components/stock/CAGRAnalysis.tsx`
- **File Path**: `components/stock/CAGRAnalysis.tsx`
- **Condition**: `data.cagrAnalysis` (line 426)
- **Props**:
  - `cagrAnalysis` (CAGRAnalysisData): `data.cagrAnalysis`
  - `isNegativeFCF` (boolean): `data.isNegativeFCF ?? false`
  - `growthModel` ('two-stage' | 'three-stage' | undefined): `data.growthModel`
  - `terminalG` (number): `data.terminalG`

#### 9.8 FinancialScores (Inside Collapsible, Conditional)
**Location**: `/components/stock/FinancialScores.tsx`
- **File Path**: `components/stock/FinancialScores.tsx`
- **Condition**: `data.scores` (line 436)
- **Props**:
  - `scores` (scores object): `data.scores`
- **Displays**: Piotroski F-Score, Altman Z-Score, Beneish M-Score, ROIC

#### 9.9 OwnershipPanel (Inside Collapsible, Conditional)
**Location**: `/components/stock/OwnershipPanel.tsx`
- **File Path**: `components/stock/OwnershipPanel.tsx`
- **Condition**: `data.ownership` (line 439)
- **Props**:
  - `ownership` (ownership object): `data.ownership`
- **Displays**: Insider ownership %, institutional %, short %, short ratio, shares short

#### 9.10 InsiderTable
**Location**: `/components/stock/InsiderTable.tsx`
- **File Path**: `components/stock/InsiderTable.tsx`
- **Condition**: Inside collapsible section (line 440) — always rendered
- **Props**:
  - `ticker` (string): `ticker`
- **Purpose**: Fetches and displays insider trading data

#### 9.11 NewsPanel
**Location**: `/components/stock/NewsPanel.tsx`
- **File Path**: `components/stock/NewsPanel.tsx`
- **Condition**: Inside collapsible section (line 443) — always rendered
- **Props**:
  - `ticker` (string): `ticker`
- **Purpose**: Fetches and displays recent news

#### 9.12 ValuationHistory
**Location**: `/components/stock/ValuationHistory.tsx`
- **File Path**: `components/stock/ValuationHistory.tsx`
- **Condition**: Inside collapsible section (line 446-450)
- **Props**:
  - `ticker` (string): `ticker`
  - `onSave` (async function): `handleSave` — POSTs to `/api/valuations`
  - `saving` (boolean): `saving` state
- **Purpose**: Displays historical valuation snapshots; allows user to save current valuation

---

## Tab Content: Modelling Tab (activeTab === 'modelling')

### 10. ModellingWorkspace
**Location**: `/components/modelling/ModellingWorkspace.tsx:27-206`
- **File Path**: `components/modelling/ModellingWorkspace.tsx`
- **Condition**: `activeTab === 'modelling'` (line 262-264)
- **Props**:
  - `apiData` (any — FinancialsData): `data`
  - `ticker` (string): `ticker`
- **Internal State**:
  - `waccOverride` (number | null)
  - `cagrOverride` (number | null)
  - `terminalGOverride` (number | null)
  - `exitMultipleOverride` (number | null)
- **Renders Child Components**:
  - `DataQualityWarnings`: warnings about terminal g, financial currency, negative FCF, financial sector, Altman zone, Beneish flag
  - `AssumptionPanel`: allows editing of CAGR, WACC, terminal G, exit multiple
  - `ForecastTable`: displays UFCF and LFCF rows
  - `TerminalValuePanel`: shows perpetuity and exit multiple terminal values
  - `ValuationOutputTable`: displays final UFCF/LFCF fair values and upside

---

## Component File Paths Summary

| Component | File Path |
|-----------|-----------|
| PriceHeader | components/stock/PriceHeader.tsx |
| TabNav | components/stock/TabNav.tsx |
| AtAGlance | components/stock/AtAGlance.tsx |
| BusinessModel | components/stock/BusinessModel.tsx |
| HealthSection | components/stock/HealthSection.tsx |
| ValuationSection | components/stock/ValuationSection.tsx |
| ModelSection | components/stock/ModelSection.tsx |
| PriceChart | components/stock/PriceChart.tsx |
| FinancialStatements | components/stock/FinancialStatements.tsx |
| FinancialCharts | components/stock/FinancialCharts.tsx |
| DCFModel | components/stock/DCFModel.tsx |
| FCFBuildUp | components/stock/FCFBuildUp.tsx |
| WACCBreakdown | components/stock/WACCBreakdown.tsx |
| CAGRAnalysis | components/stock/CAGRAnalysis.tsx |
| FinancialScores | components/stock/FinancialScores.tsx |
| OwnershipPanel | components/stock/OwnershipPanel.tsx |
| InsiderTable | components/stock/InsiderTable.tsx |
| NewsPanel | components/stock/NewsPanel.tsx |
| ValuationHistory | components/stock/ValuationHistory.tsx |
| ModellingWorkspace | components/modelling/ModellingWorkspace.tsx |

---

## Key Data Flow Entry Point

All components receive data from a single source: the `/api/financials?ticker={ticker}` endpoint, which returns a `FinancialsData` object. This data is loaded once on mount and stored in the `data` state variable. Override states (`waccOverride`, `terminalGOverride`) allow users to modify specific assumptions without re-fetching data.

