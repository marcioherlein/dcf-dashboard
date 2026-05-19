# Implementation Plan

## Priority Order (highest impact first)

### 1. NewsPanel — Full visual redesign
**File:** components/stock/NewsPanel.tsx
- Card-style list items replacing plain `<li>` 
- Source badge pill (publisher name)
- Relative timestamps ("2h ago", "3d ago")
- Bold title, lighter meta, clear hover state
- External link icon on hover
- Loading skeleton cards

### 2. FinancialScores — Grouped Piotroski + ROIC bar
**File:** components/stock/FinancialScores.tsx
- Group 9 Piotroski criteria into 3 labeled sections: Profitability (F1-F3), Leverage/Cash (F4-F6), Efficiency (F7-F9)
- Always show criteria rows (remove "Show signals" toggle)
- ROIC vs WACC: add mini horizontal bar comparison
- Altman zone bar: improve labels at threshold markers
- Keep all expandable detail sections for Altman and Beneish

### 3. ValuationSummary — Enriched method rows
**File:** components/valuation/ValuationSummary.tsx
- Add one-line description column per method (abbreviated)
- Replace alternating row stripes with cleaner rows + left-border color accent
- Add "model estimate" disclaimer near consensus number
- Show weight as mini progress bar instead of plain text

### 4. InvestmentVerdictCard — Basis and confidence
**File:** components/stock/InvestmentVerdictCard.tsx
- Add "Based on X valuation methods" subtitle under verdict
- Add "Model estimate, not a prediction" microcopy (very small, slate-400)
- Make CTA buttons slightly more prominent

### 5. AtAGlance — Label refinement
**File:** components/stock/AtAGlance.tsx
- "Consensus Fair Value" → "Weighted Fair Value Estimate"
- Summary text: increase from text-micro to text-xs
- Add "TTM" label explicitly near multiples

### 6. Home page — Feature capability section
**File:** app/page.tsx
- Add feature cards below the animated journey
- 4 cards: DCF Valuation, Health Scores, Scenario Analysis, Reverse DCF
- Each: icon, short title, one-line benefit

## Files to Modify
- components/stock/NewsPanel.tsx
- components/stock/FinancialScores.tsx
- components/valuation/ValuationSummary.tsx
- components/stock/InvestmentVerdictCard.tsx
- components/stock/AtAGlance.tsx
- app/page.tsx (feature section)

## Files to NOT Touch
- lib/dcf/* (all financial calculations)
- app/api/* (all API routes)
- lib/data/* (all data fetching)
- Any TypeScript types in lib/

## Risks
- FinancialScores: The Piotroski criteria array order must be preserved when grouping
- ValuationSummary: The ConsensusRangeBar is exported and used in InvestmentVerdictCard — don't break the export
- NewsPanel: Keep the same props interface (ticker: string)

## Verification
- npm run typecheck (zero errors)
- npm run build (zero errors)
- Open /stock/AAPL, /stock/TSLA, /stock/YPF visually
- Verify NewsPanel shows relative timestamps
- Verify FinancialScores shows 3 Piotroski groups
- Verify ValuationSummary method rows are enriched
