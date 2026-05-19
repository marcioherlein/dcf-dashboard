# Design Audit: Clairo Stock Valuation Dashboard

## Overall Diagnosis

The app has a strong technical foundation with a consistent design language (navy/emerald/amber, Tailwind-based component system, IBM Plex Mono for numbers). The visual quality is roughly 7/10 — professional but with several specific areas where data density, progressive disclosure, and visual hierarchy need improvement. The biggest gaps are behavioural: the UI doesn't sufficiently guide users away from false precision, overconfidence, or ignoring risk signals.

---

## Top 10 Visual/UX Problems

1. **Piotroski dots are unreadable at a glance** — 9 equal-weight circles with no grouping make it impossible to understand which category (Profitability / Leverage / Efficiency) is weak.

2. **Financial quality detail is hidden by default** — "Show signals ↓" toggles require clicks to see the most diagnostic information. This buries key insights.

3. **NewsPanel is a plain text list** — No visual distinction between news items, no relative timestamps ("2h ago"), no source prominence. Looks like a debug output.

4. **ValuationSummary method table is plain** — The table shows method, fair value, upside, weight as raw numbers with no confidence, no description, no "when is this method reliable?" context.

5. **AtAGlance "Consensus Fair Value" label is misleading** — "Consensus" implies analyst consensus, but it's a model-weighted average. The basis text ("based on 4 methods") is missing.

6. **InvestmentVerdictCard has no confidence indicator** — Users see "Trading 18% below our fair value estimate" but don't know if this is based on one method or five, high or low certainty.

7. **ROIC vs WACC has no visual comparison** — Just two numbers in a list. The spread (+Xpp) should be a mini bar chart showing ROIC bar vs WACC line.

8. **Altman zone bar pointer has poor mapping** — The pointer uses linear 0–7.5 scale but thresholds are at 1.8 and 3.0. At z=1.5 the pointer is only at 20%, making "Distress" look like it's barely present.

9. **NewsPanel missing relative time** — "May 18" vs "2 hours ago" makes a huge difference in assessing news relevance. All timestamps are absolute dates.

10. **Overview tab is 8+ cards stacked vertically** — Information overload. No visual breathing room between sections. Key verdict card competes with PriceChart, AtAGlance, HealthSection, BusinessModel, CTAs all at the same visual weight.

---

## Top 10 Highest-Impact Improvements

1. **FinancialScores: Group Piotroski into 3 sections** — Profitability (F1-F3), Leverage/Cash (F4-F6), Efficiency (F7-F9). Always show criteria, drop the toggle. This makes the score immediately interpretable.

2. **ValuationSummary: Enrich method rows** — Add one-line description per method, confidence badge (High/Medium/Low), and visual weight bar. Remove plain striped alternating rows.

3. **NewsPanel: Complete visual redesign** — Card-style items with source badge, relative timestamp, bold title, hover state. Needs to look like a product, not a list element.

4. **InvestmentVerdictCard: Add basis and confidence** — "Based on 4 valuation methods" + confidence chip helps users calibrate how much to trust the verdict.

5. **AtAGlance: Relabel and add basis** — "Weighted Fair Value Estimate" + "(4 methods)" instead of "Consensus Fair Value". The summary text should be more visible.

6. **ROIC: Mini comparison bar** — Show ROIC vs WACC as a small bar chart with colored spread visualization.

7. **Beneish: Show N/A state clearly with explanation** — When suppressed for non-USD companies, show "Not available for ARS-reporting companies" rather than just disappearing.

8. **Home page: Feature benefit cards** — Add a section showing what the app can do (DCF, scenario, health, reverse DCF) with concrete benefit descriptions.

9. **TabNav: Active indicator refinement** — The current blue border-bottom is small. A slightly taller tab with more contrast would reduce mis-taps on mobile.

10. **Behavioural: Add "model estimate, not prediction" microcopy** — Near fair value numbers throughout, add a 10px disclaimer that reframes expectations.

---

## Per-Page Issues

### Home Page
- Animated journey (macOS chrome) is effective and premium
- ROTATING_PHRASES are good
- Markets covered badges feel small and unnoticed
- Feature capability section is missing — users don't know what the app can do beyond "value stocks"

### /stock/[ticker] — Overview Tab
- InvestmentVerdictCard is the right hero but needs more context
- PriceChart is feature-rich but complex — consider a simpler default state
- AtAGlance labeling needs refinement
- HealthSection right column (quality signals) is hard to scan
- 8+ components create density without visual breathing room

### /stock/[ticker] — Valuation Tab
- ValuationSummary consensus hero is strong
- Range chart is good
- Method table needs confidence/description enrichment

### /stock/[ticker] — Risks & Signals Tab
- HealthSection repeated from Overview (intentional per plan) — fine
- FinancialScores is the main component — needs Piotroski grouping

### /stock/[ticker] — News Tab
- Needs full visual redesign

---

## Behavioural Finance Issues

- **False precision**: Fair values shown as "$183.42" imply 2-decimal accuracy. Should use ranges.
- **Anchoring on single number**: The "Our fair value estimate" hero number is prominent; users anchor on it. Adding bear/base/bull range helps but needs stronger framing.
- **Green/red emotional triggers**: Upside shown in bright emerald/red before any context. Risk should be more prominent.
- **Overconfidence**: No visible uncertainty labels near DCF outputs. "Sensitive to terminal growth assumption" type notices are missing.

---

_Generated: 2026-05-19 | Based on code audit of commit fa2b22c_
