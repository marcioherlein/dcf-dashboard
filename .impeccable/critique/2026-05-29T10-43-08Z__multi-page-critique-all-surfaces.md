---
target: all 9 pages — summary, valuation, markets, my valuations, landing, analyze, financials, risks, news
total_score: 22
p0_count: 0
p1_count: 3
p2_count: 2
timestamp: 2026-05-29T10-43-08Z
slug: multi-page-critique-all-surfaces
---
Multi-page critique covering all 9 surfaces of Intrinsico. Design Health Score: 22/40.

**P1 Issues:**
1. Eyebrow pattern on every section in Markets page (SectionHeader component) — 6 identical uppercase-tracked labels violate the absolute ban
2. Gray-on-color contrast failures — slate-400 on bg-blue-500 (HeroSearch line 173), slate-500 on bg-blue-100 (Valuations line 140)
3. Beneish "Manipulator" badge — alarming raw label on a healthy stock (AAPL) without calibration context destroys user trust

**P2 Issues:**
4. ValuationCockpit 7-slider overload — exceeds working memory limit of 4 simultaneous parameters
5. Identical 9-card PopularAnalysesSection grid on Analyze page approaches the identical card grid ban

**P3 Issues:**
- Publisher chip uppercase-tracking on NewsPanel ("BY MARKETWATCH" adds no information)
- HealthSection section labels use uppercase eyebrows (Business Quality, Quality Signals, Price vs. Value)
- InfoTip hover-only — not keyboard accessible
- Empty state CTA mismatch on Valuations page ("Explore popular analyses" → /markets, should → /analyze)
- Missing InfoTip context for Altman Z-Score unreliability note
- Landing hero: "not a story" aphoristic rebuttal cadence
- Analyze page search hero "/" shortcut not surfaced in UI
- Markets auto-refresh makes no announcement for screen readers
- Background on Markets page deviates from design system (#F8FAFF vs #F1F5F9)
