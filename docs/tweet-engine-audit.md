# X/Twitter Automation System — 360 Audit
**Date:** 2026-06-19  
**Scope:** Complete reference document for the insic.app tweet automation engine

---

## INFRASTRUCTURE CHAIN

```
Vercel Cron (vercel.json, 28 jobs)
    ↓  HTTP GET with CRON_SECRET header
/api/cron/x-post?mode={mode} (route.ts)
    ↓  GitHub workflow_dispatch API call with GH_DISPATCH_TOKEN
GitHub Actions Workflow #289941116 (x-post.yml)
    ↓  node scripts/x-post.mjs
Data Fetching → Text Assembly → validatePost() → Buffer GraphQL API → X (@insicapp)
```

**Component responsibilities:**
- `vercel.json` — primary scheduler, fires HTTP to cron route
- `route.ts` — validates CRON_SECRET, validates mode vs VALID_MODES list, dispatches to GitHub
- `x-post.yml` — GitHub Actions, only `workflow_dispatch` (no schedule), runs Node script
- `x-post.mjs` — 4000+ line core engine: 27 modes, data fetching, post assembly, validation, posting

**Required env vars (14):**
`MODE`, `TICKER`, `APP_URL`, `DRY_RUN`, `BUFFER_API_KEY`, `BUFFER_CHANNEL_ID`, `ALPHA_VANTAGE_KEY`, `FINNHUB_KEY`, `AUTOMATION_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `GH_DISPATCH_TOKEN`, `GH_REPO`

---

## 27 MODES — COMPLETE INVENTORY

| Mode | Description | Data Source | Cache | Dedup |
|------|-------------|-------------|-------|-------|
| morning_brief | 8AM macro+markets+earnings this week | Yahoo v8, SP500 scan | No | No |
| earnings | Tomorrow's large-cap earnings preview | Yahoo v8 earningsTimestamp | No | No |
| feature | Daily educational post (static rotation) | None | No | No |
| market_open | NYSE bell tone + indices | Yahoo v8 | No | No |
| dcf | Noon DCF valuation snapshot | /api/financials | ✅ 1h | No |
| sector_spotlight | Best/worst sector mid-morning | Yahoo v8 | No | No |
| midday_pulse | Full mid-session snapshot | Yahoo v8 | No | No |
| macro | CPI/NFP/FOMC preview or recap | Alpha Vantage + MACRO_CALENDAR | No | ✅ |
| dcf2 | Afternoon DCF, different stock pool | /api/financials | ✅ 1h | No |
| etf_pulse | Broad market or sector rotation | Yahoo v8 | No | No |
| economic_results | Macro event results with market reaction | Alpha Vantage | No | ✅ |
| dcf_bear | Evening DCF analysis, reverse pool | /api/financials | ✅ 1h | No |
| pre_close | 30min before close setup | Yahoo v8 | No | No |
| market_close | EOD recap: indices, sectors, narrative | Yahoo v8 | No | No |
| after_hours | Post-close final + AH earnings | Yahoo v8, SP500 scan | No | No |
| earnings_results | Actual EPS + surprise + AH move | Finnhub (fallback: Yahoo) | No | ✅ |
| theory_overnight | Deep academic theory post (rotating) | None (static) | No | No |
| insider_buy | SEC Form 4 CEO/CFO purchases | SEC EDGAR Atom RSS | No | No |
| low_52w | 52W low stocks with positive FCF | Yahoo v8 + /api/financials | ✅ 1h | No |
| market_vs_model | DCF fair value vs analyst target divergence | /api/financials | ✅ 1h | No |
| ratio_explained | Valuation ratio deep-dive (P/E, EV/EBITDA, etc) | /api/financials | ✅ 1h | No |
| weekly_wrap | Top 3 DCF verdicts of the week | /api/financials | ✅ 1h | No |
| question | Engagement question (static weekly rotation) | None | No | No |
| sentiment | Weekend wrap + week ahead (live data) | Yahoo v8 + SP500 scan + MACRO_CALENDAR | No | No |
| sector_scan | Weekend league table by sector (Fwd P/E) | /api/financials | ✅ 1h | No |
| holiday_deep_dive | Academic content on US market holidays | None (static) | No | No |
| top_undervalued | Sunday: top attractively priced stocks | /api/financials | ✅ 1h | No |

---

## WEEKDAY SCHEDULE (Mon–Fri, ART = UTC-3)

| ART | UTC | Mode | Days |
|-----|-----|------|------|
| 10PM prev | 01:00 | theory_overnight | 1-5 |
| 8:00 AM | 11:00 | morning_brief | 1-5 |
| 9:00 AM | 12:00 | earnings | 1-5 |
| 10:00 AM | 13:00 | feature | 1-5 |
| 10:30 AM | 13:30 | market_open | 1-5 |
| 11:00 AM | 14:00 | dcf | 1-5 |
| 11:30 AM | 14:30 | sector_spotlight | 1-5 |
| 12:00 PM | 15:00 | midday_pulse | 1-5 |
| 12:00 PM | 15:00 | market_vs_model | Tue/Thu |
| 12:30 PM | 15:30 | ratio_explained | Tue/Thu |
| 1:00 PM | 16:00 | macro | 1-5 |
| 1:30 PM | 16:30 | dcf2 | 1-5 |
| 2:00 PM | 17:00 | etf_pulse | 1-5 |
| 2:30 PM | 17:30 | economic_results | 1-5 (event days) |
| 3:00 PM | 18:00 | dcf_bear | 1-5 |
| 3:30 PM | 18:30 | pre_close | 1-5 |
| 4:00 PM | 19:00 | insider_buy | Mon/Wed/Fri |
| 4:30 PM | 19:30 | low_52w | Tue/Thu |
| 5:00 PM | 20:00 | market_close | 1-5 |
| 6:00 PM | 21:00 | after_hours | 1-5 |
| 8:00 PM | 23:00 | earnings_results | 1-5 |

**~17-21 posts/weekday depending on day**

## WEEKEND SCHEDULE

| ART | UTC | Mode | Day |
|-----|-----|------|-----|
| 10:00 AM | 13:00 | etf_pulse | Sat |
| 11:00 AM | 14:00 | feature | Sat |
| 12:00 PM | 15:00 | weekly_wrap | Sat |
| 1:00 PM | 16:00 | sector_scan | Sat |
| 2:00 PM | 17:00 | dcf | Sat |
| 2:00 PM | 17:00 | ratio_explained | Sat ⚠️ COLLISION with dcf |
| 3:00 PM | 18:00 | sentiment | Sat |
| 11:00 PM | 02:00+1 | theory_overnight | Sat |
| 10:00 AM | 13:00 | sentiment | Sun |
| 11:00 AM | 14:00 | top_undervalued | Sun |
| 11:30 AM | 14:30 | question | Sun |
| 12:00 PM | 15:00 | sector_scan | Sun |
| 1:00 PM | 16:00 | etf_pulse | Sun |
| 11:00 PM | 02:00+1 | theory_overnight | Sun |

**6-8 posts/weekend day**

---

## KEY CODE PATTERNS

### verdictLabel(upside) — 6 tiers
```
>25%    🟢 Attractively priced vs model
10-25%  🟡 Moderately below fair value
0-10%   🟡 Near fair value (slight upside)
-10-0%  🟡 Fully valued by our model
-25--10% 🔴 Trading at a premium to model
<-25%   🔴 Significant premium to fair value
```

### appFairValue(data) — resolution order
`cockpitFairValue` → `triangulatedFairValue` → null

### fetchValuation() — 1h cache
Module-level `_valuationCache` Map, TTL=3,600,000ms. All DCF modes share the cache.

### validatePost(text) — pre-post guard
Blocks: NaN, undefined, [object Object], length <80, price=$0, price>$100k, pct>±200%

### fetchWithRetry(fn, params) — AV retry
3 attempts, 60s wait between. Used by macro/economic_results for CPI/NFP/FOMC.

### isMarketHoliday(dateStr) — US NYSE holidays 2026-2027
INTRADAY_MODES: market_open, sector_spotlight, midday_pulse, etf_pulse, pre_close, market_close, after_hours, economic_results → redirect to holiday_deep_dive

### Dedup system (posted_tweet_events)
- earnings_results: key = `earnings_results:{ticker}:{date}`
- economic_results: key = `economic_results:{type}:{date}`
- macro: marks `macro:{type}:{date}` to prevent economic_results double-posting

---

## DATA SOURCES

| Source | What | Rate Limit |
|--------|------|-----------|
| Yahoo Finance v8 chart | Price, change%, market snapshot | ~8s timeout, batch with 300-500ms delay |
| Alpha Vantage | CPI, NFP, Fed Funds Rate, VIX (GLOBAL_QUOTE) | 25 req/day free, handled by fetchWithRetry |
| Finnhub | Earnings calendar: EPS actual+estimate, revenue, hour flag | Free tier |
| insic.app /api/financials | Full DCF valuation, fair value, ROIC, scores | 1h cache in script |
| SEC EDGAR Atom | Form 4 insider trades | Public, no rate limit stated |
| Supabase | posted_tweet_events dedup table | Per Supabase plan |

---

## KNOWN BUGS TO FIX

1. **DUPLICATE CRON** — `ratio_explained` fires twice on Saturday 17:00 UTC (two identical entries in vercel.json line 32 and 37)
2. **COLLISION** — Saturday 17:00 UTC has both `dcf` AND `ratio_explained` (different content, same time)
3. **Morning brief ternary** — dangling/unreachable ternary in openTone logic in runMorningBrief()
4. **No error alerting** — failed posts exit(1) silently; no Slack/webhook notification
5. **No AV backoff** — fetchAlphaVantage throws immediately on rate limit, no exponential backoff

---

## MACRO_CALENDAR — Requires Annual Update
Hardcoded in x-post.mjs. Current entries cover 2026-2027.  
Source: https://www.nyse.com/markets/hours-calendars + https://www.bls.gov/schedule/

---

## NOTES FOR FUTURE IMPLEMENTATION
- All 27 modes are implemented and scheduled
- Buffer `mode: shareNow` posts immediately (no queue)
- GitHub Actions workflow ID: 289941116
- Buffer Channel ID: set in BUFFER_CHANNEL_ID secret
- VALID_MODES in route.ts must be kept in sync with MODES map in x-post.mjs
- SP500_SAMPLE (~100 tickers) used for earnings scanning — update as needed
- ROTATION and BEAR_ROTATION pools use day-of-year offset to avoid same-day repeats
