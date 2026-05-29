---
target: Overview and Valuation tabs
total_score: 24
p0_count: 0
p1_count: 3
timestamp: 2026-05-29T15-32-43Z
slug: components-stock-summary
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Assumption changes silently update the Overview fair value with no indicator the model has been modified |
| 2 | Match System / Real World | 3 | "Upside" and "Margin of Safety" show the same value in the KPI grid |
| 3 | User Control and Freedom | 2 | No signal that Overview reflects custom assumptions from Valuation |
| 4 | Consistency and Standards | 2 | 12.5px font; CompanyCard uses different border tokens than the rest of the system |
| 5 | Error Prevention | 3 | WACC/terminalG clamping correct; smart defaults; no destructive actions |
| 6 | Recognition Rather Than Recall | 3 | Most content surfaced; some tooltips are title attrs not InfoTooltip |
| 7 | Flexibility and Efficiency | 2 | AssumptionsPanel buried 5+ sections below fold; no keyboard shortcuts |
| 8 | Aesthetic and Minimalist Design | 2 | Verdict stated 4x across 2 rows; duplicate KPIs; numbered circles ban |
| 9 | Error Recovery | 3 | Good fallbacks; undo works |
| 10 | Help and Documentation | 2 | GuidanceStrip collapsed by default; StockOrientationStrip is first-visit only |
| **Total** | | **24/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict
- Numbered section markers: GuidanceStrip 1-2-3-4 circles (absolute ban)
- Identical card trio: BullCaseCard/BearCaseCard/NextStepsCard same height/layout
- Eyebrow overuse: tracked uppercase in 4+ components
- Detector: clean (no HTML-level matches; issues are compositional)

## Priority Issues
- P1: Verdict stated 4x in Overview rows 1-2; PriceVsFairValueCard + MarketInterpretationCard restate SummaryHeroCard
- P1: "Upside" = "Margin of Safety" in KPI grid — same value, different label, trust damage
- P1: AssumptionsPanel below all outputs in Valuation — cause/effect inverted
- P2: CompanyCard positioned last, uses different design tokens
- P2: GuidanceStrip numbered circles (absolute ban) + collapsed = invisible

## Persona Red Flags
- Alex: AssumptionsPanel unreachable without 5+ scroll units; Full DCF details element jumps page
- Sam: Color-only verdict indicators; 10px muted text fails contrast; details/summary expand indicator not aria-labelled
- Morgan: Margin of Safety = Upside erodes data trust; assumption changes carry to Overview silently
