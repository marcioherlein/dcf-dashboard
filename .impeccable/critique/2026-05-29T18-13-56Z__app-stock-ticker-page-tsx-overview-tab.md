---
timestamp: 2026-05-29T18-13-56Z
slug: app-stock-ticker-page-tsx-overview-tab
---
---
score: 13
p0: 0
p1: 4
p2: 4
p3: 3
target: components/stock/summary/SummaryHeroCard.tsx + SummaryTab.tsx
---

## P1 — Must fix

### KPI cards are the hero-metric template (Anti-pattern)
4× icon + uppercase-tracked label + big number is the exact banned hero-metric template. Every card is structurally identical: same icon badge, same label style, same 20px number. The grid of four produces a wall of repeated pattern with no hierarchy.
Files: `SummaryHeroCard.tsx` lines 126–138, 212–253

### Driver badges contain verbatim model sentences (Copy)
"FCF negative due to growth CapEx — operating cash flow is positive; OCF × 0.6 used as proxy" is a 15-word model note rendered as a pill badge. Badges should be ≤3 words (key strength labels, not explanations).
Files: `SummaryHeroCard.tsx` lines 264–276

### KPI grid truncates at medium viewport (Layout)
`md:grid-cols-4` stays at 2 columns until 768px. At ~600-767px the 4 KPIs squeeze into 2 columns and the labels in those columns truncate: "PRICE/I", "MARGIN OF SAFET". Fix: `sm:grid-cols-4` or reduce to 3 KPIs.
Files: `SummaryHeroCard.tsx` line 212

### Uppercase tracked labels on every KPI cell (Anti-pattern)
`text-[11px] font-[650] uppercase tracking-wide` applied to all 4 KPI labels is the banned eyebrow pattern applied to data cells. Same pattern appears in `SummaryPriceChartCard` FooterMetric component.
Files: `SummaryHeroCard.tsx` line 131, `SummaryPriceChartCard.tsx` line 51

## P2 — Should fix

### Redundant "You're paying" box + Price/FV KPI (Content)
The green callout "You're paying $0.47 for every $1.00" and the "Price/FV 0.47×" KPI card convey exactly the same data. One is redundant. The sentence form is useful; the KPI card is not adding anything new.
Files: `SummaryHeroCard.tsx` lines 198–209, 233–242

### Confidence chip creates headline orphan (Layout)
The h1 uses `flex-wrap items-center` so the confidence chip flows inline with the verdict word. At medium widths the chip drops to a third line creating awkward wrapping. Headline structure needs a separate line for confidence.
Files: `SummaryHeroCard.tsx` lines 182–189

### Price chart period return contradicts verdict (UX)
"-33.39%" is the largest readable number in the chart panel, and it appears before the verdict has been internalized. For an "Attractive" stock this creates immediate doubt with no bridge explanation.
Files: `SummaryPriceChartCard.tsx`

### Scenario range is three bare numbers (UX)
"$4,307 — $5,349 — $6,709" with "Bear · Base · Bull" below has no visual encoding. A range bar, fill, or at minimum color-coded numbers would communicate the spread instantly.
Files: `SummaryHeroCard.tsx` lines 279–291

## P3 — Nice to have

### Hero gradient is effectively invisible
The dual radial+linear gradient layers barely register visually. The intent (tint the card by verdict color) is good; the execution is too subtle to carry signal.
Files: `SummaryHeroCard.tsx` lines 87–92

### Company card and hero card are visual peers
Both are white bordered cards at the same elevation. CompanyCard is identity context; SummaryHeroCard is the verdict. They should not look like siblings.

### Uniform visual weight across all rows
ReverseDCF, MarketInterpretation, OverviewMetricGrid, Bull/Bear/Next all render at the same elevation. No hierarchy signals which content is verdict vs which is evidence.
