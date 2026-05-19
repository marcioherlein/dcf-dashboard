# Design System Reference

## Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| brand-navy | #0F2A5E | CTAs, active states, header bg |
| brand-emerald | #0B7A5E | Positive/buy signals, grade A |
| brand-red | #B91C1C | Negative/risk signals, grade F |
| brand-amber | #D97706 | Caution, uncertainty, grey zone |
| brand-surface | #F6F7F9 | Page background |

## Semantic Color Rules
- **Emerald** = attractive valuation, positive FCF, strong signals
- **Red** = expensive, risk, distress
- **Amber** = uncertainty, caution, neutral zone
- **Blue** = analytical context, links, info
- **Slate** = hierarchy, secondary labels, neutral data

Never use red/green for decorative purposes only.

## Typography Scale
| Name | Size | Weight | Tracking |
|------|------|--------|----------|
| display | 2rem | 900 | -0.03em |
| hero | 1.75rem | 800 | -0.02em |
| heading | 1.25rem | 700 | — |
| subhead | 1rem | 600 | — |
| label | 0.6875rem | 700 | 0.06em |
| micro | 0.6875rem | 400 | — |

## Spacing Scale
- Section padding: `p-5` (1.25rem) standard, `p-6` (1.5rem) for hero sections
- Card gap: `gap-4` or `gap-5`
- Section gap: `space-y-4` or `space-y-5`

## Card System
```
Base card:     rounded-xl border border-slate-200 shadow-card p-5 bg-white
Hero card:     rounded-2xl border border-slate-200 shadow-card-md p-6 bg-white
Colored card:  rounded-xl border px-6 py-5 [bg/border by zone color]
Compact card:  rounded-lg border border-slate-100 px-3 py-2
```

## Badge/Pill Styles
```
Zone badge (Attractive):  rounded-full border px-4 py-1.5 text-sm font-bold bg-emerald-50 text-emerald-700 border-emerald-200
Zone badge (Expensive):   ... bg-red-50 text-red-700 border-red-200
Zone badge (Fair Value):  ... bg-blue-50 text-blue-700 border-blue-200
Score badge:              rounded-full px-2.5 py-1 text-[11px] font-semibold [colored]
Label pill:               rounded-md bg-slate-100 text-slate-600 px-2 py-0.5 text-xs font-medium
```

## Confidence Levels (new token)
```
High confidence:   bg-emerald-50 text-emerald-700 border-emerald-200
Medium confidence: bg-amber-50 text-amber-700 border-amber-200  
Low confidence:    bg-red-50 text-red-600 border-red-200
```

## Chart Color Palette (centralized)
```js
export const CHART_COLORS = {
  primary:   '#6366f1',  // indigo — neutral method bars
  positive:  '#10b981',  // emerald — upside
  negative:  '#ef4444',  // red — downside
  neutral:   '#94a3b8',  // slate-400 — no data
  accent:    '#f59e0b',  // amber — caution
  compare1:  '#f97316',  // orange
  compare2:  '#a855f7',  // purple
  compare3:  '#06b6d4',  // cyan
}
```

## Mobile Rules
- Minimum tap target: 44×44px
- Font size minimum: 11px (labels), 13px (body)
- Table overflow: horizontal scroll with sticky first column
- Cards stack to 1-col on mobile
- Charts: minimum 200px height, responsive width

## Microcopy Standards
- Near fair value numbers: "Model estimate, not a prediction"
- Near DCF outputs: "Sensitive to growth and WACC assumptions"
- Near Altman for EM: "(EM — limited reliability)"
- Near Beneish when suppressed: "Not available for non-USD reporting companies"
