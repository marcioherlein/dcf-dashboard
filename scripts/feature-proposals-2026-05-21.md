# Rationale — Feature Proposals
_Generated 2026-05-21T11:22:32.306Z_

# Rationale — Feature Proposal Report

**Generated:** 2026-05-21
**Scope:** 8–12 high-leverage features that map to the existing tech stack and Pro paywall scaffolding.

---

## Context summary

The codebase has a **fully-built pricing page** that already advertises 8 Pro features — but most aren't actually gated yet. The `PaywallModal`, `LoginGateProvider`, and `featureGates` infrastructure already exists. There's a `valuations` Supabase table, a Claude SDK installed and wired up for HTML generation, and rich Yahoo + FMP + FRED data already being fetched per analysis.

**This means most "new" features are actually just gating or surfacing what's already in the codebase.** That's where the highest-leverage wins live.

---

## Feature Proposals

### 1. **Sensitivity Table Paywall + Save-State Hook**
- **One-line:** Gate the existing `SensitivityTable` component behind Pro, but show a blurred preview with the paywall CTA overlaid.
- **Why it monetizes:** Already advertised on pricing page as the #1 Pro feature. The component exists (`components/valuation/SensitivityTable`) and is rendered in `ModellingWorkspace`. Just needs wrapping.
- **Effort:** S
- **Implementation notes:**
  - Wrap the existing `<SensitivityTable />` render in `ModellingWorkspace.tsx` with a check against `useSession()` + a Pro flag in the user record.
  - Reuse `PaywallModal` from `components/monetization/PaywallModal.tsx` — already accepts a `gate` prop.
  - Add `'sensitivity_table'` to `lib/monetization/featureGates.ts`.
  - Render an SVG-blurred screenshot (1 PNG asset) underneath with a "Pro" badge; CTA opens the modal.
  - **Gotcha:** Don't compute the data client-side and hide it — actually skip the computation so the source isn't inspectable.
- **Priority:** **10/10**

---

### 2. **PDF Investment Brief Export**
- **One-line:** One-click PDF export of the full stock analysis using `jspdf` + `html2canvas` (already in deps) and Claude for the executive summary.
- **Why it monetizes:** Listed on pricing page as Pro feature. `jspdf`, `html2canvas`, and `puppeteer` are all in `package.json` but unused on the user-facing flow. There's an `export-pdf` script — proves intent exists.
- **Effort:** M
- **Implementation notes:**
  - New route: `app/api/valuations/[ticker]/brief/route.ts` — fetch valuation data + run Claude with a prompt template (mirror `app/api/portfolio/analyze/route.ts` pattern with embedded CSS).
  - Render Claude's HTML output through Puppeteer → PDF. Cache by `(ticker, valuation_id, day)` in Supabase like `portfolio_analyses` table already does.
  - Add "Export PDF" button next to "Save analysis" on `/stock/[ticker]`. Gate via `requireAuth({ intent: 'export_report' })` (intent already exists in `LoginGateProvider`!).
  - **Gotcha:** Vercel serverless has a 60s limit; cache aggressively, and use `claude-haiku` for speed if Sonnet is too slow.
- **Priority:** **9/10**

---

### 3. **Price vs Fair Value Email Alerts**
- **One-line:** When price crosses a saved fair-value threshold, send email via Resend / Postmark.
- **Why it monetizes:** Top-3 advertised Pro feature. The `valuations` table already stores fair values. The `create_alert` intent already exists in `LoginGateProvider`.
- **Effort:** L
- **Implementation notes:**
  - New table: `alerts (user_id, ticker, type, threshold, last_triggered_at)`.
  - New API route: `app/api/alerts/check/route.ts` — daily Vercel cron pulls all alerts, batches Yahoo quote fetches (reuse `getQuote` from `lib/data/yahooClient.ts`), sends email when crossed.
  - Add "Set price alert" button on the analysis page next to fair value display. Pre-fill threshold from existing fair value bands.
  - Use Resend (free tier covers MVP). Email template can be plain HTML.
  - **Gotcha:** Free tier should be capped at 1 alert; track in `alerts.count` per user.
- **Priority:** **9/10**

---

### 4. **Watchlist Cap Enforcement (Free = 3)**
- **One-line:** Enforce the "Save up to 3 analyses" free-tier limit that the pricing page already promises.
- **Why it monetizes:** Most direct conversion lever — every 4th save is a paywall hit. Currently advertised but not enforced.
- **Effort:** S
- **Implementation notes:**
  - In `app/api/watchlist/route.ts` POST handler, count rows for `user_id` before insert. If `count >= 3` and user is not Pro, return `402` with `{ gate: 'watchlist_limit' }`.
  - In `loadWatchlist` consumer (`/valuations`, `/simplifier`), catch `402` and trigger `PaywallModal` with new gate type.
  - Add `watchlist_limit` to `featureGates.ts`.
  - **Gotcha:** Show the limit clearly in UI ("2 of 3 saved · upgrade for unlimited") to create urgency, not surprise.
- **Priority:** **10/10**

---

### 5. **AI Thesis Builder (Claude-powered)**
- **One-line:** A 6-question structured form that generates a publishable investment thesis using Claude, scored against the model's fair value.
- **Why it monetizes:** "Thesis Builder" is on the Pro list with the `save_thesis` intent already wired. `WatchlistEntry` type already has `overallScore` for thesis scoring.
- **Effort:** M
- **Implementation notes:**
  - New page: `app/stock/[ticker]/thesis/page.tsx` with 6 questions (moat, growth driver, key risk, catalyst, time horizon, position size).
  - New API route: `app/api/thesis/generate/route.ts` — Claude prompt that takes the answers + the existing fundamentals payload from `/api/financials` and returns: (a) a 400-word narrative, (b) a 0–100 thesis score, (c) red flags (cross-checked against fair value model).
  - Persist to a new `theses` table. Show score on `/valuations` cards (the `ScoreBar` component is already there waiting for `overallScore`).
  - Gate behind Pro using existing `useLoginGate`.
  - **Gotcha:** Prompt-engineer Claude to disagree with the user when fundamentals contradict the thesis — that's the differentiator vs ChatGPT.
- **Priority:** **9/10**

---

### 6. **Bull / Base / Bear Scenario Comparison View**
- **One-line:** A side-by-side card showing fair value under all three scenarios (the math is already in `buildScenarios()`).
- **Why it monetizes:** Listed on pricing page; data is already computed in `app/api/financials/route.ts`. Pure UI work.
- **Effort:** S
- **Implementation notes:**
  - The `scenarios` payload is already returned from `/api/financials`. Just build a 3-column comparison card component and stick it on `/stock/[ticker]`.
  - Free tier sees only "Base"; Bull/Bear shown blurred with paywall CTA.
  - Reuse styling from existing `ValuationSummary` component.
- **Priority:** **9/10**

---

### 7. **Historical Fair Value Tracker**
- **One-line:** Chart how a stock's fair value estimate has evolved over time using the `valuations` table snapshots.
- **Why it monetizes:** Pricing page bullet. Every analysis the user (or anyone) has saved is already a historical data point in Supabase — feature is essentially free data.
- **Effort:** M
- **Implementation notes:**
  - New API route: `app/api/valuations/history/[ticker]/route.ts` — query all rows from `valuations` for that ticker, ordered by `saved_at`.
  - Render with existing Recharts `LineChart` setup (see `components/markets/NormalizedPerfChart.tsx` for patterns).
  - Two lines: "Fair Value (consensus)" + "Actual Price" — overlay reveals tracking error visually.
  - Pro-gated via blur overlay.
  - **Gotcha:** Cold-start problem — backfill by running the model historically once for the top 100 tickers. Or seed only when ≥3 historical points exist.
- **Priority:** **8/10**

---

### 8. **Watchlist Weekly Digest Email**
- **One-line:** Sunday 8 AM digest emailing each Pro user a summary of their watchlist tickers — price changes, fair value drift, news.
- **Why it monetizes:** Listed on pricing page. Drives weekly re-engagement → reduces churn.
- **Effort:** M
- **Implementation notes:**
  - Vercel cron at `app/api/cron/digest/route.ts` running Sundays.
  - For each Pro user with watchlist > 0: fetch quotes, fair values from cache, top 3 news (Yahoo already provides), pipe into Claude with a templated prompt that returns formatted HTML email body (mirror `portfolio/analyze` route).
  - Resend API for delivery.
  - **Gotcha:** Cap watchlist size in prompt to avoid token blowup. Cache the rendered email; users in the same regime can share content with name swap.
- **Priority:** **8/10**

---

### 9. **"Macro Brief" Pro Lock**
- **One-line:** The Claude-generated macro brief on `/markets` is a clear premium feature — gate it.
- **Why it monetizes:** `MacroBrief` is rendered freely today but is computationally expensive (Claude call). It's effectively a freebie that should be Pro.
- **Effort:** S
- **Implementation notes:**
  - In `components/markets/MacroBrief.tsx`, check Pro status. Show first paragraph + blurred remainder + paywall CTA.
  - Caching in `macro_briefs` table is already keyed by regime, so this won't increase API costs.
- **Priority:** **8/10**

---

### 10. **Free-Tier Analysis Counter (Soft Cap)**
- **One-line:** Track unique tickers analyzed by anonymous + free users; soft-paywall after 5 distinct tickers per week.
- **Why it monetizes:** Currently fully unlimited — no friction means no conversion event. Soft cap creates the "I want one more" moment.
- **Effort:** M
- **Implementation notes:**
  - New table `analysis_events (user_id_or_ip, ticker, created_at)`.
  - Middleware on `/api/financials` checks count in last 7d; if user is not Pro and `count >= 5`, return 429 with `gate: 'analysis_limit'`.
  - On the search/analyze page, show "3 of 5 free analyses this week" in a small chip.
  - **Gotcha:** Don't be too aggressive — pricing page promises "Unlimited stock analysis." Either reduce to "5 deep analyses + unlimited shallow" or update copy. Recommend the latter.
- **Priority:** **7/10**

---

### 11. **AI "Why is this stock cheap/expensive?" Explainer**
- **One-line:** One-paragraph Claude-generated plain-English explanation of why the model thinks the stock is mis-priced, on every analysis.
- **Why it monetizes:** Differentiator vs ChatGPT (uses the actual model output). Free users see 1 sentence, Pro sees full explanation. Drives perceived value of every analysis.
- **Effort:** S
- **Implementation notes:**
  - New API route: `app/api/explain/[ticker]/route.ts`. Input: fair value, current price, key ratios, scenarios. Output: 200-word explanation.
  - Cache by `(ticker, valuation_id, day)` in Supabase.
  - Use `claude-haiku` — fast and cheap (~$0.001/call).
  - Inject as a card under the grade card on `/stock/[ticker]`.
  - **Gotcha:** Bake into the prompt: "Use only the data provided. Do not speculate about news. Do not give buy/sell recommendations."
- **Priority:** **9/10**

---

### 12. **Portfolio Fair Value Tracker (un-WIP-ify it)**
- **One-line:** Ship the Portfolio tab that's currently labeled "In Progress" — analyze each holding's fair value, weight, and aggregate upside.
- **Why it monetizes:** Listed on pricing page; the upload flow + Claude analysis route already work. The barrier is just the "Not Ready" banner and missing aggregation.
- **Effort:** L
- **Implementation notes:**
  - `Portfolio.tsx` and `app/api/portfolio/analyze/route.ts` are 70% there. Add: per-holding fair value lookup (call existing `/api/financials`), weighted upside calc, deviation alerts.
  - Remove the WIP banner in `app/monitor/page.tsx` once shipped.
  - Pro-gate the Excel upload (free can manually enter 3 tickers; Pro can upload).
  - **Gotcha:** Excel parsing edge cases (decimal commas, ticker formats). Test with 5+ broker exports.
- **Priority:** **7/10**

---

## Quick Wins (Ship today / tomorrow)

1. **Watchlist cap enforcement** (#4) — 30 lines of code, immediate revenue lever.
2. **Sensitivity Table paywall** (#1) — wrap an existing component, add 1 gate enum.
3. **Bull/Base/Bear comparison** (#6) — data is already in the API response.
4. **Macro Brief lock** (#9) — single conditional render check.
5. **AI mis-pricing explainer** (#11) — 1 new API route, 1 prompt, 1 card. <1 day.

Bundle these five into a single "Pro launch" PR. That's the entire advertised Pro tier going from "vapor" to "real" in ~2 days of work.

---

## Avoid for now

- **Real-time price streaming.** Yahoo Finance terms + WebSocket infra cost don't justify it. Pro users want depth, not millisecond ticks.
- **Mobile native app.** PWA is enough. The bottom nav is already mobile-optimized.
- **Crypto / forex coverage.** Pricing page explicitly scopes to NYSE/NASDAQ. Stay focused.
- **Backtest / strategy P&L tracker.** The `/strategy` and `/trading` pages are already complex and fragile (strategy uses `factor-ranking` API which itself fetches 380 days of history for hundreds of tickers — slow). Don't pile more on them yet.
- **Stripe self-serve billing.** For the first 50 Pro customers, use a Stripe Payment Link + manual flag in the `users` table. Don't build the full subscription lifecycle until you've validated price.
- **More Anthropic-powered pages.** You already have `MacroBrief`, `portfolio/analyze`, `brief/generate`. Three Claude routes is the right number until conversion data tells you which to invest in.
- **`/ai-stack`, `/factor-ranking`, `/trading` page polish.** These look like personal/research tools, not part of the consumer Pro funnel. Don't divert energy here.

---

## TL;DR Priority-ordered roadmap

| # | Feature | Effort | Score |
|---|---|---|---|
| 4 | Watchlist cap (free=3) | S | 10 |
| 1 | Sensitivity Table paywall | S | 10 |
| 11 | AI mis-pricing explainer | S | 9 |
| 6 | Bull/Base/Bear comparison | S | 9 |
| 9 | Macro Brief Pro lock | S | 8 |
| 2 | PDF brief export | M | 9 |
| 3 | Price alerts | L | 9 |
| 5 | AI Thesis Builder | M | 9 |
| 7 | Historical fair value | M | 8 |
| 8 | Weekly digest email | M | 8 |
| 10 | Free-tier soft cap | M | 7 |
| 12 | Portfolio tracker GA | L | 7 |

**Recommended sprint plan:**
- **Week 1:** Ship #4, #1, #6, #9, #11 → Pro tier becomes real.
- **Week 2:** Ship #2 (PDF) → biggest "wow" feature on pricing page.
- **Week 3:** Ship #3 (alerts) → drives daily re-engagement.
- **Week 4:** Ship #5 (Thesis Builder) → defensible AI differentiation.