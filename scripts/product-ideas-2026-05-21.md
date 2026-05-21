# Rationale — Product Improvement Report
_Generated 2026-05-21T11:28:11.387Z_

# Rationale — Product Improvement Report

*Audit date: 2026-05-21. Based on full codebase snapshot.*

After reading through the codebase, the strongest impression is this: **Rationale has world-class plumbing under the hood (FCFF DCF, CAPM with Damodaran CRP, Piotroski/Altman/Beneish, peer multiples) but the user-facing layer doesn't expose 60% of that work.** The pricing page sells features that aren't built (alerts, sensitivity, PDF export, thesis builder, portfolio tracker — the `Portfolio` page literally has an "In Progress — Not Ready" amber banner). And the data-quality risks compound silently because of fragile Yahoo field-name fallback chains.

What follows is a builder's punch list, not a strategy document.

---

## SECTION 1 — Core Product Gaps

### 1.1 Sensitivity table is sold but not built
**Why it matters:** The pricing page lists "Sensitivity table — fair value at every CAGR × WACC" as the *first* Pro feature. The component exists (`SensitivityTable` is imported in `ModellingWorkspace.tsx`) but there's no peer-comparison heat map, no two-axis matrix that is the actual standard (CAGR rows × WACC columns with terminal-g overlay). Investors test fair value across assumption ranges — without this, every fair value number feels arbitrary.
**Difficulty:** S
**Implementation:** Build a 5×5 grid in `components/valuation/SensitivityHeatMap.tsx`. Re-run `calculateFairValue` for each (CAGR, WACC) cell using the cached projections; cells colored by upside %. Add toggle to swap WACC for terminal-g on the X axis. Already gated via `PaywallModal`.

### 1.2 No analyst estimates vs. actuals tracking
**Why it matters:** `cagrAnalysis.analystEstimate1y/2y` is fetched and used for CAGR derivation but never *displayed*. A serious investor wants to see "Consensus estimate FY+1: $4.20 EPS" alongside "Last 4 quarters: beat 3, missed 1, avg surprise +5.2%." This is the single best quick-read of management credibility.
**Difficulty:** M
**Implementation:** FMP's `/earning_surprises/{ticker}` endpoint gives historical EPS estimate vs. actual. Add to `getFmpBundle` and surface in a new `EarningsCredibilityCard` on the stock page. Cost: free FMP tier supports this.

### 1.3 No insider ownership / insider transactions
**Why it matters:** Yahoo's `quoteSummary` returns `insiderHolders` and `insiderTransactions` modules — neither is requested in `getFinancials`. Insider buying is one of the highest-conviction qualitative signals retail investors look for.
**Difficulty:** S
**Implementation:** Add `'insiderHolders', 'insiderTransactions', 'majorHoldersBreakdown'` to the `quoteSummary` modules call. Surface in a small card: "Insiders own 8.3% · Net buy $2.4M last 90d."

### 1.4 No short interest, days-to-cover, float data
**Why it matters:** Available in Yahoo's `defaultKeyStatistics` (`shortPercentOfFloat`, `sharesShort`, `shortRatio`) but never displayed. Critical for understanding setup risk on small/mid caps.
**Difficulty:** S
**Implementation:** Already in payload — just wire through `app/api/financials/route.ts` response and add a one-row stat band on stock page.

### 1.5 No side-by-side stock comparison
**Why it matters:** `PEER_TICKERS` and `getPeerQuotes` already exist and `calculateMultiples` runs peer-relative valuation. But there's no `/compare?a=AAPL&b=MSFT` route. Investors *constantly* compare two names side by side (margins, growth, valuation, balance sheet).
**Difficulty:** M
**Implementation:** Build `app/compare/[a]/[b]/page.tsx` reusing `getFmpBundle` for both tickers in parallel. Three-column layout: A | difference | B with green/red on the delta column. Highest-leverage feature you can build in a day.

### 1.6 DCF assumption weaknesses

Reviewing `app/api/financials/route.ts` and `config/valuation.config.ts`:

- **Terminal growth tied to CAGR, not domicile.** The rule `cagr > 0.15 → 2.5%, > 0.05 → 2.0%, else 1.5%` is too crude. A 3% CAGR Japanese utility shouldn't get the same terminal-g as a 3% CAGR US REIT. Should be `country GDP growth × inflation expectations`, sourced from the same Damodaran sheet you already use for CRP.
- **WACC has no minimum.** `wacc = max(0.01, ...)` — a 1% WACC is unrealistic and produces fantasy fair values. Floor at risk-free + 3% (minimum equity risk).
- **FCF cap at 15% yield is a band-aid.** `fcfCapApplied` quietly overrides reality when FCF/MarketCap > 30%. This is correct *symptom* handling but masks an upstream data quality issue (often Yahoo returning consolidated subsidiary FCF). Log this as a data quality warning to the user, not a silent override.
- **Beta from 5y daily returns, not regularised.** No Blume adjustment (`0.67 × β + 0.33 × 1.0`) or Vasicek shrinkage. For low-volume names this produces wildly unstable betas.
- **Three-stage growth model trigger is binary.** `cagr > 0.15 || isNegativeFCF` — but a 14.99% CAGR business gets a two-stage model and a 15.01% CAGR identical business gets three-stage, producing a fair value cliff. Should fade smoothly.
- **No explicit treatment of share-based compensation.** SBC is a real cost. FCFF should subtract SBC explicitly for tech companies; right now it flows through OCF→capex implicitly, which understates dilution.

**Difficulty:** M
**Implementation:** Each is a one-function fix in `lib/dcf/`. Surface a "Model Assumptions" expandable card that shows every applied default with its source citation.

### 1.7 No earnings call / 10-K transcript ingestion
**Why it matters:** The most under-exploited Anthropic capability in the stack. You already use Claude for portfolio analysis; you could fetch the latest 10-K from SEC EDGAR, summarize risk factors, and surface "what changed since last filing" — features no Bloomberg-tier consumer tool offers retail at $11/mo.
**Difficulty:** L
**Implementation:** SEC EDGAR `/submissions/CIK{cik}.json` gives filing index. Fetch latest 10-K MD&A section, run through Claude with a structured extraction prompt. Cache by accession number so it's free after first user.

### 1.8 No cyclicality / recession-resilience indicator
**Why it matters:** A retail investor looking at CAT or GM needs to know "this company's earnings dropped 60% in 2008/2020." Right now the DCF treats them like steady compounders.
**Difficulty:** M
**Implementation:** Pull 10-year quarterly revenue from FMP, compute peak-to-trough drawdown and earnings volatility. Tag the company "Cyclical / Defensive / Growth" and adjust the bear-case scenario accordingly (currently `bearCAGR = baseCAGR - 2%` regardless of cyclicality).

### 1.9 No dividend safety / coverage analysis
**Why it matters:** `calculateDDM` is built but only triggered for dividend payers. Even non-dividend stocks need dividend yield, payout ratio, FCF coverage of dividend, dividend growth streak. This is table stakes for income investors.
**Difficulty:** S
**Implementation:** All in `summaryDetail` (dividendYield, payoutRatio) and FMP cash flow statements. One card.

### 1.10 No "what if I bought this date" return calculator
**Why it matters:** `getHistorical(ticker, '5y')` is already fetched. Showing "Total return if held 1y/3y/5y including dividends, vs. SPY in the same period" is the single best honesty check on an investment thesis.
**Difficulty:** S
**Implementation:** Trivial. Use the data you already have.

---

## SECTION 2 — UX & Interaction Improvements

### 2.1 Fair value vs. price isn't the visual hero
**Issue:** On `/stock/[ticker]`, there are 5 valuation methods (Forward PE, Revenue Multiple, EV/EBITDA, FCFF DCF, Reverse DCF) shown with similar visual weight in `ValuationLab`. The single most important number — *consensus fair value vs. current price* — should be a 60pt above-the-fold display with a clear "12% upside" badge.
**Difficulty:** S
**Implementation:** Add a hero band at top of stock page: ticker, price, weighted-consensus fair value, upside badge, single-sentence explanation ("Trading 12% below our blended estimate of $236, primarily driven by services growth in the FCFF model"). Demote the per-method panels to a tabbed section below.

### 2.2 No live feedback when assumptions change
**Issue:** In `ModellingWorkspace`, when a user overrides WACC or terminal-g, there's no visual indication of *what changed* in the fair value. A flash, a delta arrow, a "WACC ↑ 0.5% → Fair Value ↓ $14" tooltip would make the model feel alive.
**Difficulty:** S
**Implementation:** Track previous fair value in a ref; on assumption change, animate a delta badge next to the fair value for 1.5s.

### 2.3 New user has no onboarding
**Issue:** First load on `/` just shows search and a rotating phrase animation. A new user has no idea what to type or what they'll get. The animated journey at the bottom is great marketing but doesn't tell them *step 1 is type a ticker*.
**Difficulty:** S
**Implementation:** Add a "Try it: AAPL · NVDA · TSLA" row of clickable example tickers directly under the search input. Already have `EXAMPLE_TICKERS` constant — just wire it.

### 2.4 Empty/error states are inconsistent
**Issue:** `MarketsPage` shows a generic red banner on error; `Portfolio` shows skeletons forever if `analyze` fails; `ValuationsPage` has a polished empty state but `monitor/portfolio` shows an "In Progress — Not Ready" amber warning that screams "this product isn't done." A signed-out user clicking the Portfolio nav item gets sent to a broken-looking page.
**Difficulty:** S
**Implementation:** (1) Hide or route-redirect the Portfolio nav item until shipped. (2) Standardize on one `<EmptyState>` component with icon + headline + CTA. (3) Add error boundaries with `Try again` on every async section.

### 2.5 Mobile experience: search overflows, key data is cropped
**Issue:** `TopBar` search has `placeholder="Search Tickers…"` but on mobile the nav (`Analyze · Valuations · Portfolio · Markets · AI Stack`) is hidden, and `BottomNav` doesn't include "Markets Monitor" or "AI Stack" — so on mobile, those pages are unreachable except by deep link. The `ValuationLab` 5-column method panel will wrap badly on phones.
**Difficulty:** M
**Implementation:** Add hamburger overflow on `BottomNav` for less-used pages. In `ValuationLab`, switch to horizontal-scroll method tabs on mobile (like Stripe Dashboard).

### 2.6 Loading states show no progress signal
**Issue:** `/api/financials` does ~10 parallel network calls (Yahoo, FMP, FRED). On slow networks this can take 8-15 seconds. Users see only a generic skeleton.
**Difficulty:** S
**Implementation:** Stream the response: return quote + price first (fast), then financials, then peer multiples. Use Next.js streaming (`Suspense` boundaries) so users see something every 1-2s.

### 2.7 The "BETA" tag on Stock Simplifier and "In Progress" on Portfolio undermine trust
**Issue:** Two of the four primary nav destinations have caveat badges. New users read this as "this product isn't ready."
**Difficulty:** S
**Implementation:** Either ship the features or remove them from primary nav until they're real. The "In Progress" amber banner on `/monitor?tab=portfolio` is the worst — it's the linked destination from `BottomNav` "Portfolio."

### 2.8 No keyboard shortcuts for power users
**Issue:** A user analyzing 10 stocks shouldn't have to mouse-click. No `/` to focus search, no `g v` to go to valuations, no `[`/`]` to navigate between watchlist items.
**Difficulty:** S
**Implementation:** Add a global `KeyboardShortcuts` listener in `AppShell`. Standard Linear/GitHub bindings.

### 2.9 The CAGR / WACC sliders give no context for "is this a reasonable value"
**Issue:** When a user drags WACC from 9% to 11%, they have no idea if 11% is high or low for this company's risk profile. Show comparison: "Your input: 11.0% · Industry median: 9.2% · Damodaran sector avg: 8.8%."
**Difficulty:** M
**Implementation:** Pull Damodaran sector cost-of-capital tables (free CSV from NYU Stern) into a JSON file, lookup by company sector.

### 2.10 No "save as scenario" / scenario comparison
**Issue:** Pricing page promises "Bull/Base/Bear scenario builder" — but in `ValuationLab` there's no way to save your current set of overrides as a named scenario, much less compare three scenarios side-by-side.
**Difficulty:** M
**Implementation:** Save assumption sets to Supabase keyed by `user_id + ticker + scenario_name`. Add a comparison view at `/stock/[ticker]/scenarios`.

---

## SECTION 3 — High-Value New Features

### 3.1 Peer benchmarking dashboard
**Value:** Investors don't value a stock in isolation — they value it relative to peers. You already have `PEER_TICKERS` and `calculateMultiples` runs peer-relative analysis. Surface this as a peer table: AAPL vs MSFT/GOOGL/META on margins, growth, valuation, balance sheet. Each peer column links to its own analysis.
**Difficulty:** M
**Implementation:** New `PeerBenchmarkTable` component on stock page; reuse `getFmpBundle` calls (parallelize 5 tickers). Cache aggressively.
**Monetization:** Free, but the comparison-builder ("pick your own 5 peers") is Pro.

### 3.2 Thesis Builder — AI-augmented investment journal
**Value:** Promised on pricing page. The unique angle: don't just give a free-form text field. Use Claude to ask Socratic questions: "What's the moat? What would have to be true for this to fail? What's the bear case probability?" Then save responses, scoring them with an LLM rubric.
**Difficulty:** M
**Implementation:** Build a 6-question wizard at `/stock/[ticker]/thesis`. Send answers to Claude with a rubric prompt; return a structured JSON score. Store in `theses` Supabase table linked to ticker. Re-prompt monthly: "Has anything changed since you wrote this on Jan 15?"
**Monetization:** Pro feature. Highest-LTV hook in the product.

### 3.3 Price + fair value alerts
**Value:** Promised on pricing page. The unique twist on alerts: don't just notify on price — notify on *model output*. "AAPL's fair value just dropped 8% because the latest 10-Q cut FY revenue guidance." Run the DCF nightly on every saved valuation, diff vs. yesterday.
**Difficulty:** M
**Implementation:** Vercel Cron + a worker route `/api/cron/refresh-valuations`. Diff each user's saved valuation, send via Resend. Schema already has `valuations` table.
**Monetization:** Pro. Re-engagement driver.

### 3.4 Portfolio fair value tracker (actually built)
**Value:** Promised. Currently shows "In Progress" banner. The killer feature: weighted fair value of the entire portfolio. "Your portfolio is 8% undervalued on average; concentration risk: 47% in semis."
**Difficulty:** L
**Implementation:** Reuse `Portfolio` Excel upload flow, run each holding through `/api/financials`, weight by position size. Generate sector exposure, factor exposure, beta-weighted summary.
**Monetization:** Pro centerpiece.

### 3.5 "What's changed" filing diff
**Value:** Pull last two 10-Qs from EDGAR, ask Claude "what changed in risk factors / guidance / segment commentary." Quarterly insight that's currently locked in $30K/year Bloomberg terminals.
**Difficulty:** L
**Implementation:** Quarterly cron, Claude with diff prompt, cached per filing pair. Surface as a card on the stock page when a new filing drops.
**Monetization:** Pro. Strong differentiator.

### 3.6 Reverse-engineered consensus tracker
**Value:** You have analyst estimates. Build "Consensus Drift" — show how the consensus FY+1 EPS has evolved over the past 90/180 days. A stock where consensus is rising is fundamentally different from one where it's falling, even at the same multiple.
**Difficulty:** M
**Implementation:** FMP `/analyst-estimates/{ticker}` historical. Sparkline.
**Monetization:** Free. Lead magnet.

### 3.7 Backtest of fair value calls
**Value:** "When Rationale's model said $236 vs. price $211 last quarter, the stock did X over the next 90 days." This is the most credibility-building feature you could ship — *if* you have the data.
**Difficulty:** L
**Implementation:** Snapshot the daily fair value of the top 500 tickers nightly; after 12 months, publish "model accuracy" metrics. Start gathering data NOW even if you don't display for a year.
**Monetization:** Free. Marketing gold.

### 3.8 Export to Excel / Google Sheets
**Value:** Promised ("PDF investment brief export"). But serious investors live in Excel. One-click "Export DCF to Excel" with all assumptions as live cells.
**Difficulty:** S
**Implementation:** `xlsx` is already in `package.json`. Build a template that mirrors `ModellingWorkspace` row structure. Two-day project.
**Monetization:** Pro.

### 3.9 Twitter/X share card
**Value:** "I think AAPL is 12% undervalued — see my model" with a generated 1200×630 image showing fair value, key assumptions, and your handle. Free user acquisition.
**Difficulty:** S
**Implementation:** Vercel `@vercel/og` for image generation. Add `/api/og?ticker=AAPL` route.
**Monetization:** Free; viral acquisition.

### 3.10 AI "Devil's advocate" mode
**Value:** When user saves a thesis as Buy, Claude generates the strongest possible counter-thesis. Most retail mistakes come from never considering the bear case rigorously.
**Difficulty:** M
**Implementation:** Claude with a prompt: "Here's the user's bull thesis. Generate the 3 strongest reasons this could be wrong, citing specific data points from the financials I'm passing in." Surface in a panel after thesis save.
**Monetization:** Pro. Genuinely useful, defensible.

---

## SECTION 4 — Technical & Reliability Improvements

### 4.1 Yahoo Finance has no rate limit handling, no caching layer
**Risk:** `yahoo-finance2` is called from `/api/financials`, `/api/factor-ranking` (potentially fetches 100+ tickers), `/api/market-context`, `/api/markets/data`, `/api/portfolio/analyze`, `/api/trading/live-signal`. Yahoo's unofficial limit is ~2000 requests/hour/IP. `factor-ranking` alone with concurrency=8 will get banned within a week of any traffic.
**Difficulty:** M
**Fix:**
1. Add Redis (Upstash) caching with TTLs: quotes 60s, financials 24h, historical 1h, fundamentals 6h.
2. Wrap all `yf.*` calls in a single `lib/data/yahooClient.ts` rate-limiter (e.g., `bottleneck` lib, 10 req/s ceiling).
3. Add exponential backoff on 429.
4. Move `factor-ranking` to a nightly cron that writes to Supabase, instead of recomputing on every page load.

### 4.2 Field-name fallback chains in financials route are fragile
**Risk:** `app/api/financials/route.ts` has chains like:
```ts
bs.cash ?? bs.cashAndCashEquivalents ?? bs.cashAndShortTermInvestments
?? bs.cashCashEquivalentsAndShortTermInvestments ?? bs.cashAndCashEquivalentsAtCarryingValue
?? bs.cashEquivalents ?? bs.cashAndDueFromBanks ?? fin.financialData?.totalCash ?? 0
```
This is essentially "guess and pray." When Yahoo silently changes field names (they have, multiple times), the fair value model produces wrong numbers without ANY error. A `cash` value that silently falls back to `0` could swing fair value by 5-20%.
**Difficulty:** M
**Fix:**
1. Add a validator: if all fallback fields are null, throw a `DataQualityError` instead of using 0.
2. Cross-validate with FMP's balance sheet (already fetched in `getFmpBundle`) — if Yahoo cash and FMP cash diverge by >20%, log and prefer FMP.
3. Add a `dataQuality` field to the API response: `{ cashSource: 'yahoo:cashAndCashEquivalents', fcfSource: 'fmp_derived_ocf_minus_capex', warnings: [...] }`.

### 4.3 `fetch_live.py` reference suggests broken Python dependency
**Risk:** The error message in `app/trading/page.tsx` says `Run: python3 scripts/fetch_live.py`. Trading page works now via `/api/trading/live-signal/route.ts` but the error path still references a Python script. If `live-signal` 502s, users see a Python instruction that won't work on Vercel.
**Difficulty:** S
**Fix:** Remove the Python instruction in the error UI. The TS implementation is the canonical path now.

### 4.4 Local-storage watchlist is not migrated on login
**Risk:** `loadWatchlist(null)` in `app/valuations/page.tsx` and `app/simplifier/page.tsx` reads from local storage when user is signed out. After Google login, this state is replaced — but I see no `onAuthStateChange` migration that pushes anonymous local-storage entries to Supabase. New users will lose all their pre-signup work.
**Difficulty:** S
**Fix:** In `LoginGateProvider` (or wherever sign-in callback fires), read local-storage entries, batch-upsert to `/api/watchlist`, then clear local-storage.

### 4.5 No transaction safety on Supabase writes
**Risk:** `app/api/portfolio/analyze/route.ts` does an `upsert` after Claude generates HTML. If Claude succeeds but the upsert fails, user pays for the API call and gets nothing cached. Worse: `/api/brief/generate/route.ts` writes to filesystem in dev (won't work on Vercel) but the comment "filesystem not writable (Vercel prod) — HTML is returned in response" means production users get one-shot HTML never cached anywhere.
**Difficulty:** S
**Fix:** Move filesystem write to Supabase storage bucket. Add error metric/log when caching fails so you can see the rate.

### 4.6 Anthropic API has no spend ceiling
**Risk:** `/api/portfolio/analyze` and `/api/brief/generate` both call `claude-sonnet-4-6` with `max_tokens: 8000-16000`, with web_search tools enabled. A bad actor could trigger these in a loop (no auth on `/api/brief/generate` at all — just `POST` returns HTML). At 16K output tokens × $15/M, each call is ~$0.30. 1000 calls = $300.
**Difficulty:** S
**Fix:**
1. Add session check on `/api/brief/generate` (it's currently unauthenticated).
2. Add a per-user daily call limit (Supabase counter).
3. Log token spend to a `claude_usage` table.

### 4.7 Hardcoded ERP, terminal-g defaults, war date
**Risk:** `config/valuation.config.ts` has `erp: 0.046` with comment "Update annually from Damodaran." There's no reminder mechanism — the next annual update will be missed and the model silently degrades. Also `app/api/portfolio/analyze/route.ts` references `warStart = new Date('2026-02-28T00:00:00-03:00')` and `warDay = ...` — this is hardcoded narrative context that will be wildly inappropriate when context shifts.
**Difficulty:** S
**Fix:**
1. Move ERP, RFR fallback, country GDP to a Supabase `macro_assumptions` table, refreshed by a quarterly cron from FRED + Damodaran.
2. Remove war-day context from the Claude system prompt; let the model fetch current macro state via web_search.

### 4.8 No data validation on user-supplied portfolio uploads
**Risk:** `/api/portfolio/upload` accepts `.xlsx/.xls/.csv`. No code visible for sanitization. A malicious user could upload a 1GB file or one with formula injection (`=cmd|...`).
**Difficulty:** S
**Fix:** File size cap (5MB), row count cap (1000), reject any cell starting with `=` `+` `-` `@`, ticker validation (regex `^[A-Z.\-]{1,8}$`).

### 4.9 Beta calculation can crash on illiquid stocks
**Risk:** `calculateBeta` consumes `stockHistory` and `spyHistory`. For a recently-IPO'd stock with <60 days of history, beta will be unstable or NaN. The downstream `calculateWACC` uses this beta directly. No guard.
**Difficulty:** S
**Fix:** If `stockHistory.length < 60`, fall back to industry median beta (Damodaran sector tables).

### 4.10 `factor-ranking` and `market-context` block on serial Yahoo fetches
**Risk:** `/api/factor-ranking` calls `batchFetch` with concurrency 5-10, fetching 380 days of data for each. With 100 instruments, that's 100+ history calls before any user sees the page. Cold-load latency will be 30-60 seconds.
**Difficulty:** M
**Fix:** Move factor-ranking entirely to a cron that writes to Supabase. Page reads from Supabase (50ms).

### 4.11 No type safety on Yahoo responses
**Risk:** Repeated `as any` casts across the codebase. When Yahoo changes a field, type checker doesn't catch it. The detection cascades through `extractWACCInputs`, `extractFCFInputs`, etc.
**Difficulty:** M
**Fix:** Add a Zod schema for `quoteSummary` modules. Validate on receive. Failed validation → log + fall back gracefully + flag to user.

### 4.12 Currency conversion is only forward-looking, not historical
**Risk:** For ADRs (BABA, TSM), `fxRate` is applied at fetch time to convert reporting currency to quote currency. But historical revenues across 5 years all get multiplied by *today's* FX rate — so a 5-year revenue CAGR for BABA mixes 2020 CNY revenue with 2026 USD value. This makes historical CAGR wrong.
**Difficulty:** M
**Fix:** Apply year-specific FX rates from FRED's `DEXCHUS`, `DEXBZUS`, etc. when computing historical CAGR for foreign reporters.

---

## Top 5 Things to Build Next

Ranked by (impact on user × implementation speed). Each is a 1-3 day project for a solo dev.

| # | Feature | Why | Impact | Speed | Refs |
|---|---------|