---
target: "https://intrinsico.vercel.app/analyze"
total_score: 23
p0_count: 1
p1_count: 2
timestamp: 2026-06-01T18-25-24Z
slug: intrinsico-vercel-app-analyze
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Search spinner and skeleton loaders are good; silent fallback to stale static data when quotes API fails is a gap |
| 2 | Match System / Real World | 3 | "Implied 5Y revenue CAGR" is jargon-heavy for retail persona; ConceptBanner explains it once, then vanishes permanently |
| 3 | User Control and Freedom | 3 | Tiny 20×20px remove target on RecentlyViewed; ConceptBanner dismissal is permanent with no re-surface path; "/" shortcut is undiscovered |
| 4 | Consistency and Standards | 2 | Four distinct badge rounding systems on one page; navigation links use `<button onClick router.push>` instead of `<a>` — breaks middle-click, right-click |
| 5 | Error Prevention | 2 | No ticker validation on Enter — routes directly to `/stock/INVALIDTICKER`; two distinct error states ("No model yet" vs. "Unavailable") with different visual weight, no guidance |
| 6 | Recognition Rather Than Recall | 2 | "/" shortcut entirely invisible; "View all" and "View full" are visually identical links to the same `/markets` destination; "Recently viewed" is ambiguous — analyses? pages? searches? |
| 7 | Flexibility and Efficiency | 3 | Keyboard nav in autocomplete is fully implemented; "/" shortcut exists but is undiscoverable; no watchlist-based personalization; leaderboard can't be sorted or filtered |
| 8 | Aesthetic and Minimalist Design | 2 | Six competing sections stack without breathing logic; QuickActions (secondary nav) precedes primary product content; leaderboard duplicates card data at same granularity |
| 9 | Error Recovery | 1 | "Unavailable" fair value has no retry affordance; fallback static data renders as live with no staleness signal; no non-blocking error path when API is down |
| 10 | Help and Documentation | 2 | One on-demand "How is this calculated?" tooltip in leaderboard footer; `title=` attribute Info icons are invisible on touch; "Expectation" column (Conservative/Moderate/Aggressive) has zero threshold definition anywhere |
| **Total** | | **23/40** | **Acceptable — significant improvements needed** |

---

## Anti-Patterns Verdict

**Does this look AI-generated?** Partial fail.

**LLM assessment**: The page avoids the worst AI tells — no gradient text, no hero-metric template, no numbered section scaffolding, no uniformly tracked uppercase eyebrows. The micro-copy is specific. However, three patterns flag:

1. **Identical card grid**: The 3-card `PopularAnalyses` grid uses uniform column count and identical data rows for AAPL, NVDA, MSFT — the three most searched US equities on any finance product. No editorial differentiation. This is the "safe defaults" reflex.
2. **"More tools" section = iOS settings cell template**: icon + title + chevron, repeated twice. Visually generic for a brand positioning as "sharp and confident."
3. **ConceptBanner has a horizontal accent stripe** — a `bg-blue-500 h-px w-full` top-edge rule. The absolute ban on side-stripe accents applies to horizontal versions too; it is the same decorative divider motif.

Additionally: the `glass-card-light` glass treatment is applied to *all* interactive surfaces on the page — SearchHero, stock cards, leaderboard, QuickActions. Per the design system's "Purposeful Glass Rule," glass is structural elevation material, not a default card treatment. Applying it uniformly is glassmorphism by another name.

**Deterministic scan**: 15 `gray-on-color` warnings across `components/stock`, `components/valuation`, `components/layout`, and `components/ui`. The `analyze/page.tsx` itself is clean. The majority of the 15 flags are false positives from ternary-colocated class strings — both sides of a conditional match, but only one renders at a time. The two credible real findings to verify:
- `components/stock/PriceChart.tsx:475` — `text-slate-500 on bg-blue-600` (verify the ternary path; if they can co-render, this is a real contrast failure)
- `components/stock/InvestorGradeCard.tsx` (×2) — `text-slate-400 on bg-blue-50`: blue-50 is nearly white so actual contrast is likely fine, but `slate-400` (#94A3B8) on white fails WCAG AA at 2.6:1 — validate these render paths

**Browser visualization**: Not available — URL target without browser automation.

---

## Overall Impression

The engineering quality here is high — the search component is properly implemented, skeleton loaders are in place, and reduced-motion support is genuinely thorough. But the page is fighting itself architecturally. It presents as a discovery hub while its H1 assumes a user with a specific ticker in mind. It shows its most interesting content (implied CAGR leaderboard) buried below three sections of content that repeat the same data. The ConceptBanner front-loads the product's entire premise once, permanently, and leaves every subsequent visit with an unexplained core metric. The single biggest opportunity: reorganize the page around "here's what's interesting in the market today" rather than "go find a stock you already know about."

---

## What's Working

**1. The MarketPricingLeaderboard is genuinely differentiated.** The horizontal bar encoding of implied vs. historical CAGR, the animated bar-fill on scroll, and the interpretation column ("AWS + ads make expectations look achievable") converts abstract financial data into an immediate visual and narrative conclusion. No generic stock screener does this. This section alone justifies the product.

**2. The search autocomplete is properly engineered.** Full keyboard navigation (Arrow/Enter/Escape), ARIA combobox semantics, 300ms debounce, inline spinner, "/" shortcut. Placeholder copy "Search ticker or company name, e.g. NVDA, MercadoLibre…" is specific and non-generic. The investment in this component is visible and correct.

**3. Reduced-motion implementation is thorough.** `useReducedMotion()` applied consistently, `prefers-reduced-motion` respected in CSS for every animation keyframe, `prefers-reduced-transparency` downgrades glass-card backdrop filters to solid white. This level of accessibility attention is rare in financial tools.

---

## Priority Issues

### [P0] The page has no visual focus anchor

**What**: The search input — the page's single most important CTA — competes with a 240px ConceptBanner (first visit), 9 popular chips, and two QuickActions buttons above the fold. The H1 at `text-[22px]` is smaller than the medium card price figures (`text-[19px]`) and smaller than the search placeholder text at focus. The search input is not visually dominant.

**Why it matters**: This page has one job: get the user to a stock analysis. Every element that isn't the search input is noise until the user commits to a ticker. On a 390px mobile viewport, the user has 12+ tappable targets before reaching the first card — an immediate cognitive overload violation.

**Fix**: Make `SearchHero` the entire above-the-fold experience. Increase H1 to 28–32px, add 24px breathing room above the input. Move `QuickActions` below `PopularAnalyses` — it is a secondary destination, not an entry point. Move `ConceptBanner` between the search hero and the cards so it contextualizes the cards rather than preceding the search.

**Suggested command**: `/impeccable layout`

---

### [P1] The leaderboard duplicates the card data at the same granularity

**What**: Nine tickers appear in both `StockAnalysisCard` and `MarketPricingLeaderboard`. Both surfaces show implied CAGR and expectation classification. This is not two views at different detail levels — it is the same data in two different visual containers.

**Why it matters**: The user who reads both sections gains nothing from the second. The duplication also makes the page significantly longer than its content density warrants, diluting the page's strongest section (the leaderboard concept) by appearing to be a repeat.

**Fix**: Option A — move the leaderboard to `/markets` exclusively and replace it here with a stronger "→ See full market pricing" link. Option B — show non-overlapping tickers in each surface (3 featured cards, then the leaderboard for the next 9 by expectation divergence). Option C — merge the compact secondary list in `PopularAnalyses` with the leaderboard bar format, collapsing two sections into one richer surface.

**Suggested command**: `/impeccable shape`

---

### [P1] ConceptBanner dismissal is permanent with no retrieval path

**What**: `localStorage.setItem('intrinsico_concept_seen', '1')` on dismiss. Never re-surfaces. No "?" link, no help icon, no footer tooltip on cards. The concept it explains — implied vs. historical CAGR — is shown in every card and every leaderboard row but explained nowhere after first visit.

**Why it matters**: A user who dismissed the banner two weeks ago now sees "Market implies +6.2% 5Y revenue CAGR" and has to reconstruct the concept from memory. No inline help, no re-entry. This is the trust gap: the product's core claim is unexplained at the point of consumption.

**Fix**: Add a persistent "How to read this →" link or `?` icon to the `SearchHero` subtitle area. It opens a drawer or tooltip with the ConceptBanner content. The banner can still dismiss on first visit, but the concept needs a permanent retrieval affordance.

**Suggested command**: `/impeccable clarify`

---

### [P2] Static fallback data renders as live with no staleness signal

**What**: `STATIC_QUOTES` contains hardcoded sparkline arrays and null prices. When the live quotes API fails, the page renders static 8-point charts that look current. Prices show "—" but sparklines display synthetic data with no badge, no timestamp, no "Data may be delayed" notice.

**Why it matters**: A user making an investment decision based on a visual that implies recency but shows outdated or synthetic data is being misled by the UI. This is a financial product trust issue, not a cosmetic one.

**Fix**: When `q.price === null`, render the existing `SparklineSkeleton` instead of the static array. Add a `data-stale` state that shows "Live data unavailable" in the card footer when prices haven't resolved after a timeout.

**Suggested command**: `/impeccable harden`

---

### [P3] QuickActions is placed before the product has demonstrated value

**What**: "Compare stocks" and "My Valuations" appear as the second section on the page, directly after `SearchHero` — before `PopularAnalyses` and the leaderboard. Both are navigation to other pages.

**Why it matters**: A first-time user sees two navigation links to destinations they have no context to evaluate. This asks the user to navigate before they've seen what the product does. It is IA-driven sequencing rather than user-journey-driven.

**Fix**: Move `QuickActions` to the bottom of the page, after `PopularAnalyses`, before `RecentlyViewed`. Reframe from "More tools" to "Go further" or similar — language that implies next-step depth, not parallel navigation.

**Suggested command**: `/impeccable layout`

---

## What's Not Relevant (user question)

- **Index membership badges** (S&P 500, Nasdaq 100, Dow 30) on cards: communicates which index a ticker belongs to, not action-relevant on a valuation landing page, consumes prime card real estate in row 1
- **QuickActions section above the fold**: "Compare stocks" and "My Valuations" are secondary destinations; placing them before primary product content inverts user journey priority
- **Duplicate implied CAGR data** across both cards and leaderboard at identical granularity: one surface adds no marginal information value after the other
- **Partially overlapping popular chips and featured cards** (NVDA, MSFT, AAPL appear in both): the two surfaces tell no distinct story — chips should be fast-path for repeat users, cards should be editorial picks

## What's Missing (user question)

- **Persistent "How to read this" retrieval path** after ConceptBanner is dismissed — the core metric is unexplained at the point of consumption
- **Threshold definitions for Conservative/Moderate/Aggressive** expectation labels — what CAGR range maps to each category is never stated
- **Staleness indicator** when fallback static data is rendering — financial trust requires recency transparency
- **Personalization**: no mechanism for a user to see their own watchlist here instead of hardcoded mega-caps; `/analyze` doesn't adapt to returning users
- **Trust signal at point of consumption** — no "model estimate, not a recommendation" caveat at the card level where the upside % is shown
- **"Pick up where you left off" state** in RecentlyViewed — shows visited tickers but not where you were in the analysis flow for each
- **Dynamic leaderboard sort** by expectation divergence magnitude — the hardcoded 9 tickers miss the more interesting implied-vs-historical outliers in the market today

---

## Persona Red Flags

**Alex (power user / active analyst)**
- 9 popular tickers are all mega-caps Alex already knows. No watchlist personalization. Leaderboard cannot be sorted or filtered. "/" shortcut exists but has zero discoverability. No batch/bulk actions anywhere. Alex bypasses this page entirely after week 1 — the hub fails its power-user retention goal.

**Sam (accessibility-dependent user)**
- `title` attribute tooltips on `Info` icons are inaccessible on mobile and to keyboard-only users who don't hover. The 20×20px `X` remove target in RecentlyViewed cards is below the 44px WCAG minimum touch target. The `glass-card-light` border (`rgba(255,255,255,0.72)`) becomes invisible against white in no-`backdrop-filter` fallback — needs a solid border for the degraded state.

**Riley (stress tester)**
- Typing a 25-character nonsense ticker and pressing Enter routes to `/stock/[garbage]` — no validation, no error state, no recovery path. A malformed JSON string in `intrinsico_recent` localStorage silently sets `recent = []` — the catch swallows the error with no signal. "View all" links to `/markets` — if that 404s, no back path.

**Marcus (self-directed retail investor — financially literate, non-professional)**
- Sees "Intrinsic value $X" with a green "+23% upside" signal on a card that links directly through with no friction and no risk framing. The ConceptBanner explaining implied CAGR was dismissed in 3 seconds two weeks ago — the definition is gone, the number is still on every card. "Aggressive" expectation label has no threshold definition; Marcus cannot calibrate. This page is priming the buy action before Marcus understands what he's reading.

---

## Minor Observations

- The section heading "What the market is pricing in" inside `MarketPricingLeaderboard` is more compelling than the page H1. If this is the product's core insight, it should be higher in the page hierarchy.
- On mobile, RecentlyViewed is a vertical list while PopularAnalyses is a horizontal scroll — inconsistent orientation for two semantically parallel surfaces (stocks the user cares about).
- `POPULAR_CHIPS` is hardcoded (`['NVDA', 'MELI', 'MSFT', 'AAPL', 'AMZN', 'GOOGL', 'TSLA', 'AMD', 'PLTR']`). MELI is an interesting inclusion that shows editorial judgment; the others are fully predictable. The chip list and featured card list partially overlap without a reason why some are chips and some are cards.
- Detector caught 15 `gray-on-color` pattern warnings across stock and valuation components — most are ternary false positives. Verify: `PriceChart.tsx:475` (slate-500 on blue-600) and `InvestorGradeCard.tsx` (slate-400 on blue-50, which fails AA at 2.6:1 if they co-render).

---

## Questions to Consider

1. **This page is called `/analyze` but does not let you analyze anything.** It is a discovery lobby. Should it be renamed `/home` and designed explicitly as a hub? Or redesigned to let you start an analysis inline?
2. **The product's core concept (implied vs. historical CAGR) is explained once, permanently dismissed, and then used in every card with no re-entry.** Is the product confident enough in its concept that it doesn't need persistent scaffolding — or is it hiding the explanation because it's unsure every user will understand it?
3. **Nine hardcoded stocks across two surfaces.** If Intrinsico's insight is the market's implied growth bet, why is the selection curated by index membership rather than by which stocks currently have the most interesting divergence? A dynamic "biggest mispricing today" sort would be genuinely differentiated.
4. **The empty state for RecentlyViewed is better than the populated state.** It has warmth and direction; the populated state is just a list. Should the populated state show where you left off in the analysis, or flag conviction changes?
5. **"What do you want to analyze today?" assumes the user has a specific ticker.** But Marcus often arrives without knowing what to analyze — he is browsing for ideas. Should the IA organize around "here's what's interesting right now" instead?
