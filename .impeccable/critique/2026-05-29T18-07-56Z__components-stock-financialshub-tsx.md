---
target: financials tabs — Statements, Growth, Profitability, Solvency, Analysts, Ownership
total_score: 24
p0_count: 0
p1_count: 2
p2_count: 2
timestamp: 2026-05-29T18-07-56Z
slug: components-stock-financialshub-tsx
---
## Design Health Score — Financials Tabs (Statements, Growth, Profitability, Solvency, Analysts, Ownership)

Total score: 24/40 (Acceptable — significant UX improvements needed for mixed audiences)

Heuristics: H1=2, H2=3, H3=2, H4=3, H5=4, H6=2, H7=2, H8=2, H9=3, H10=1

## Anti-Patterns Verdict

Not AI slop — high coding craftsmanship, thoughtful micro-interactions, defensive null handling. Reads as a financial terminal ported to the web without UX rethinking. Density appropriate for experts; wall of numbers for everyone else. All 4 detector findings are false positives (gray-on-color class strings inside conditional ternaries that never co-render).

Browser screenshot finding: auth modal re-fires on sub-tab navigation even after banner dismissed.

## Priority Issues

P1: Auth modal re-fires on sub-tab navigation — blocks content mid-research, highest abandonment risk
P1: Jargon wall with no progressive disclosure — DPO, CCC, NOPAT, Beneish unexplained; no per-tab context strip; positiveIsGood not surfaced
P2: No prioritization within tabs — 40+ metrics with no "top 3" signal
P2: Visual density — financial printout aesthetics, no hierarchy, every element same weight
P3: Analysts tab disconnected from DCF model — no reconciliation with intrinsic value

## Persona Red Flags

Alex: no export, no column sorting, no deep-link to rows, locked charting, no keyboard shortcuts
Jordan: auth modal re-fires and blocks content, no "what to read first" primer, Growth/Profitability distinction unclear
Sam: Margin Trends chart no table fallback, Piotroski dots color-only pass/fail, ownership bars no ARIA values

## Minor Observations

- FinancialScores.tsx "Financial Quality Scores" heading still uses 11px uppercase (inconsistent post-eyebrow cleanup)
- TTM amber highlighting has no legend
- Projected rows: opacity-90 in Statements vs opacity-30 in Charts — inconsistent encoding
- Row highlight flash 2s — users who scroll miss it
