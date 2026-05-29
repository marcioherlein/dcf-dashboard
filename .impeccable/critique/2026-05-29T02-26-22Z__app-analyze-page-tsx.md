---
timestamp: 2026-05-29T02-26-22Z
slug: app-analyze-page-tsx
---
---
target: app/analyze/page.tsx
score: 27
p0: 0
p1: 1
p2: 2
p3: 2
heuristics: [3,3,3,3,3,3,2,3,2,2]
---

## Design Health Score

| # | Heuristic | Score | Notes |
|---|---|---|---|
| H1 | Visibility of system status | 3/4 | Fair value silently resolves null |
| H2 | Match between system and real world | 3/4 | Leaderboard values unlabeled by period |
| H3 | User control and freedom | 3/4 | History remove now always visible |
| H4 | Consistency and standards | 3/4 | Design system coherent; eyebrows cleared |
| H5 | Error prevention | 3/4 | Search submit disabled until input present |
| H6 | Recognition rather than recall | 3/4 | QuickActions exposed high in page |
| H7 | Flexibility and efficiency | 2/4 | `/` shortcut added; dropdown has no keyboard nav |
| H8 | Aesthetic and minimalist design | 3/4 | QuickActions still identical-card-grid |
| H9 | Help users recognize/recover from errors | 2/4 | Silent fv null; no stale-data signal on leaderboard |
| H10 | Help and documentation | 2/4 | Methodology not surfaced from analyze entry |

Total: 27/40 (was 24/40, +3)

## Priority Issues

P1 — Silent fair value null state in StockAnalysisCard (fvLoading false, fairValue null, no error message)
P2 — Search dropdown keyboard inaccessibility (no role=listbox, no arrow nav, no Escape-to-close)
P2 — QuickActions identical-card-grid (4 uniform icon+label cards)
P3 — StockAnalysisCard label typography not propagated (uppercase tracking-wide still present)
P3 — MarketPricingLeaderboard has no staleness signal (STATIC_QUOTES, no timestamp)

## Anti-Patterns

- Tracked-uppercase eyebrows: CLEARED
- Side-stripe borders: CLEARED
- Identical card grids: PARTIAL (QuickActions)
- animate-bounce: CLEARED
