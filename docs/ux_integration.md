# UX Integration Plan

**Version:** 1.0.0  
**Date:** 2026-05-19  
**Role:** UX Analyst (UXA)  
**Purpose:** Recommendations for a unified valuation summary interface with proper assumption disclosure, transparency, and navigability.

---

## 1. Current UX Gaps

### 1.1 Triangulation Black Box

The `ValuationSummary` component shows a single triangulated fair value and upside percentage. Users see the conclusion but not how it was derived.

**Gap:** The blending weights (e.g. "FCFF 65%, Multiples 35%") are computed and stored in `TriangulatedResult.weights` but are not rendered in the UI.

**User impact:** An investor sees "Fair Value: $150" but cannot verify whether that number was dominated by a DCF or by a peer multiple comparison. This reduces trust and prevents the user from understanding which assumption most affected their conclusion.

### 1.2 Assumption Transparency Gap

`buildAssumptionSet()` produces an `AssumptionSet` with source labels (`analyst`, `3y_median`, `model`, `fallback`). These are partially surfaced in the assumption panel but not prominently shown at the top of the valuation card.

**Gap:** Users do not see a clear data quality signal before reading the fair value.

### 1.3 Gordon Growth Violation Silent Failure

When `terminalG ≥ WACC`, the fair value returns null and the UI shows "—". There is no explanation of what went wrong or how to fix it.

### 1.4 FX / EM Company Missing Disclosure

For non-USD companies (VIST, YPF, PBR), there is no prominent disclosure that:
1. The model is using a CRP of X% (e.g. 15.41% for Argentina)  
2. Financial figures were converted at today's FX rate  
3. If FX data is unavailable, the valuation may be unreliable

### 1.5 Confidence Score Not Displayed

The CAGR confidence score (High/Medium/Low) from `CAGRAnalysis.confidenceLabel` is computed but whether it is displayed prominently at the top of the valuation is unclear.

---

## 2. Recommended UX Components

### 2.1 Unified Valuation Summary Header

```
┌─────────────────────────────────────────────────────────────────┐
│ NVDA — Fair Value $950.00   ▲ +28% Upside   Zone: Attractive   │
│                                                                  │
│ Confidence: HIGH ●●●  |  Company Type: High Growth              │
│ Primary Method: DCF (FCFF) 65% + Multiples 35%                  │
│                                                                  │
│ [DCF: $1,020] [Multiples: $835]                                  │
│ [Bull: $1,150] [Base: $950] [Bear: $780]                        │
└─────────────────────────────────────────────────────────────────┘
```

**Key elements:**
1. **Fair value + upside** — primary conclusion, prominent
2. **Confidence indicator** — 3-dot scale (Low/Medium/High) from `CAGRAnalysis.confidenceLabel`
3. **Company type** — from `detectCompanyType()` with tooltip explaining why
4. **Method breakdown** — shows weights visually (e.g. "DCF 65% + Multiples 35%")
5. **Individual method values** — expandable chips showing each method's output
6. **Scenario range** — bull/base/bear always shown

### 2.2 Assumption Disclosure Panel

Replace the current tab/drawer pattern with a collapsible "Key Assumptions" row beneath the summary:

```
┌─────────────────────────────────────────────────────────────────┐
│ Key Assumptions                            ▼ Show details        │
│                                                                  │
│ WACC: 9.4%  ●  CAGR: 18.2% [Analyst 55%]  ●  Terminal G: 2.5%  │
│ Beta: 1.72 (regression)  ●  ERP: 4.6%  ●  CRP: 0.0% (USD)      │
└─────────────────────────────────────────────────────────────────┘
```

Each assumption has:
- Value displayed inline
- Source badge in brackets: `[Analyst 55%]`, `[3Y median]`, `[Fallback]`
- Tooltip with full derivation on hover

### 2.3 Gordon Growth Violation Banner

When `terminalGrowthViolation = true`, replace the "—" fair value with an actionable error:

```
⚠️  Valuation Blocked: Terminal growth (3.0%) ≥ WACC (2.8%)
    Gordon Growth Model requires WACC > terminal growth rate.
    
    To fix: [↓ Lower terminal growth]  or  [↑ Raise WACC]
```

Where the fix buttons pre-populate the sliders with safe values:
- Lower terminal growth → set to `WACC - 0.5%`
- Raise WACC → open WACC breakdown

### 2.4 Emerging Market Disclosure Banner

For companies with CRP > 0 or non-USD reporting currency:

```
ℹ️  Emerging Market Note
    This company reports in ARS (Argentine Peso).
    Country Risk Premium: 15.41% (Damodaran Jan 2025)
    FX rate used: 1 USD = 890 ARS (live, May 19 2026)
    
    All balance sheet figures converted to USD at today's spot rate.
    Large moves in ARS/USD will significantly affect this valuation.
```

### 2.5 Method Applicability Disclosure

For each method that was marked `applicable: false`, show a short explanation:

```
Methods Used:
✅ FCFF / WACC DCF (65%)
✅ Relative Multiples (35%)
❌ FCFE — Not applicable: high-growth non-financial company
❌ DDM  — Not applicable: no dividend paid
```

---

## 3. Current Component Inventory

| Component | Location | Current State | Gap |
|---|---|---|---|
| `ValuationSummary` | `components/valuation/ValuationSummary.tsx` | Shows triangulated FV + upside | No weight breakdown, no confidence signal |
| `ValuationMethodCard` | `components/valuation/ValuationMethodCard.tsx` | Per-method FV card | Needs applicability reason when not applicable |
| `SensitivityTable` | `components/valuation/SensitivityTable.tsx` | WACC × CAGR grid | Good — no changes needed |
| `AssumptionSlider` | `components/stock/AssumptionSlider.tsx` | Editable sliders | Source badge may not be prominent enough |
| `WACCBreakdown` | `components/stock/WACCBreakdown.tsx` | WACC component table | Good — no changes needed |
| `FCFBuildUp` | `components/stock/FCFBuildUp.tsx` | FCF waterfall | Good — no changes needed |
| `CAGRAnalysis` | `components/stock/CAGRAnalysis.tsx` | CAGR source breakdown | Good if confidence displayed prominently |

---

## 4. Implementation Priority

### P0 — Gordon Growth violation (breaks core flow)
- Add violation banner with fix buttons to `ValuationSummary`
- File: `components/valuation/ValuationSummary.tsx`

### P1 — Weight transparency
- Add "Method X% + Method Y%" row to `ValuationSummary`  
- Show individual method fair values as chips
- File: `components/valuation/ValuationSummary.tsx`

### P1 — Confidence signal
- Add confidence badge (High/Medium/Low) from `CAGRAnalysis.confidenceLabel` near the fair value
- File: `components/valuation/ValuationSummary.tsx`

### P2 — EM disclosure
- Add country/FX disclosure banner for CRP > 0 companies
- File: new `components/valuation/EmDisclosure.tsx` used in `ValuationTab`

### P3 — Assumption source badges
- Make source labels more prominent in the assumption panel
- Add "All inputs using fallback" warning when `AssumptionSet` has multiple `fallback` sources

---

## 5. Disclosure Requirements

For SEC compliance and investment best-practice, the valuation output should include:

1. **Effective date:** "Computed using data as of [date]"
2. **Model limitations notice:** "This is a quantitative model, not investment advice. Consult a financial advisor before making investment decisions."
3. **Data sources:** "Financial data: Yahoo Finance. Risk parameters: Damodaran Jan 2025."
4. **Assumption editability notice:** "You can adjust WACC, CAGR, and terminal growth using the sliders. Changes affect the intrinsic value but not the saved valuation."
5. **Peer comparison caveat:** "Industry multiples reflect Damodaran Jan 2025 sector medians. Live peer quotes used when available."

These should appear in a collapsible `<details>` block below the valuation output, not inline — to avoid cluttering the primary view.
