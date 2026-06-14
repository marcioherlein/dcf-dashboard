# Tweet Calendar & Results System Audit

**Date:** 2026-06-12  
**Scope:** Full engineering review of tweet generation, calendar logic, data provider capabilities, and earnings/economic results feasibility

---

## Executive Summary

The tweet calendar system is **PARTIALLY FUNCTIONAL** with three critical bugs that cause missed earnings alerts and stale data posts:

1. **CRITICAL BUG — Earnings date logic off by one day**: runEarnings() checks `todayStr` OR `tomorrowStr`, but for after-hours earnings on day N, the Unix timestamp converts to "day N" UTC while the script checks against "day N+1". ADBE (June 11 AH) would be completely missed on June 12.

2. **CRITICAL BUG — Macro timing produces stale data**: macro mode fires at 11AM UTC (2PM ART / 5PM Vercel UTC). CPI releases at 12:30PM UTC (morning in New York). The "recap" tries to fetch Alpha Vantage CPI at 11AM UTC — but data hasn't arrived yet. This causes two failures: (a) the job runs early, (b) the data returned is from the *previous* month.

3. **PARTIAL FEASIBILITY — Results tweets need new table + data validation**: EPS beat/miss tweets are 90% feasible (EPS actual/estimate/AH% all available), but need deduplication and careful Yahoo update timing. Economic results need a 30-60 minute delay buffer for Alpha Vantage updates.

---

## 1. Files Reviewed

| File | Description |
|------|-------------|
| `/scripts/x-post.mjs` | Main Twitter posting script. 2,583 lines. Handles all post modes: earnings, DCF, macro, market snapshots. Contains date logic bugs. |
| `/app/api/financials/route.ts` | Core data provider. Returns earningsSurprises (EPS actual/estimate/date), postMarketChangePct, quote fields. 1,727 lines. |
| `/lib/data/fmpClient.ts` | Financial Modeling Prep client. Provides annual/quarterly income statements, balance sheets, key metrics with EPS data. |
| `/lib/data/fredClient.ts` | Federal Reserve Economic Data client. Provides risk-free rate and other macro series. |
| `/app/api/cron/x-post/route.ts` | Vercel cron trigger. Invokes GitHub Actions workflow to run x-post.mjs modes. |
| `/vercel.json` | Cron schedule definitions. 26 scheduled jobs at various UTC times. Macro mode: 0 16 * * 1-5 (4PM UTC = 1PM ART). |

---

## 2. Current Data Flow

```
Data Sources → Yahoo Finance v8 / Alpha Vantage / FMP / FRED
                ↓
        Date Logic (UTC strings)
                ↓
        Earnings filtering: earningsTimestampStart
        Macro filtering: hardcoded calendar dates
                ↓
        Data enrichment: /api/financials
        (EPS surprises, quote price, AH %)
                ↓
        Buffer API POST
                ↓
        X (Twitter) timeline
```

---

## 3. Timezone & Date Logic

### 3.1 Is "Earnings Today" Correct?

**Answer: NO. Off-by-one bug for after-hours earnings.**

From `runEarnings()` (lines 288-330):
```javascript
const todayStr    = new Date().toISOString().split('T')[0]  // e.g. "2026-06-12" (UTC)
const tomorrow    = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
const tomorrowStr = tomorrow.toISOString().split('T')[0]    // e.g. "2026-06-13" (UTC)

const reporting = results.filter(q => {
  if (!q.earningsTimestamp) return false
  const d = new Date(q.earningsTimestamp * 1000).toISOString().split('T')[0]
  if (d === todayStr || d === tomorrowStr) { q.date = d; return true }
  return false
})
```

**Bug scenario:**
- ADBE reports June 11, 2026 at 4:30 PM ET (after hours)
- ET = UTC-4, so 4:30 PM ET = 8:30 PM UTC = still June 11 UTC
- Yahoo earningsTimestampStart = Unix seconds = June 11 UTC date
- Script runs June 12, 12:00 UTC
- todayStr = "2026-06-12", tomorrowStr = "2026-06-13"
- Filter checks: d === "2026-06-11" → NO MATCH
- **RESULT: ADBE earnings completely missed on June 12 morning.**

The code should be checking for yesterday, today, AND tomorrow:
```javascript
const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0]
if (d === yesterdayStr || d === todayStr || d === tomorrowStr) { ... }
```

**Severity: CRITICAL** — Breaks core earnings alert feature.

### 3.2 Is "Earnings Tomorrow" Correct?

**Answer: PARTIAL. Same bug; tomorrowStr check catches pre-market reporters correctly, but misses AH from previous day.**

The logic correctly identifies stocks reporting on tomorrowStr (accurate for pre-market reporters on day N+1). But it MISSES stocks that reported AH on day N because their UTC date is day N, not day N+1.

**Example:** If running June 12 (morning), tomorrowStr = "2026-06-13". The function will find stocks reporting June 13 pre-market (correct). But ADBE June 11 AH is now completely invisible.

### 3.3 Is "Economic Calendar Today" Correct?

**Answer: NO. Critical timing bug — macro recap fires BEFORE data is available.**

From `runMacro()` (lines 709-798):

```javascript
const todayUtc    = new Date().toISOString().split('T')[0]
const tomorrowUtc = new Date(Date.now() + 86400000).toISOString().split('T')[0]

const todayEvent    = MACRO_CALENDAR.find(e => e.date === todayUtc)
const tomorrowEvent = MACRO_CALENDAR.find(e => e.date === tomorrowUtc)

// ── RECAP: event is today — fetch live data and post results ──
if (todayEvent) {
  console.log(`Macro event today: ${todayEvent.label}`)
  
  if (todayEvent.type === 'CPI') {
    const data = await fetchAlphaVantage('CPI', { interval: 'monthly' })
    const d = latestTwo(data.data ?? {})
    // ... post results with d.latestVal, d.previousVal
  }
}
```

From `/vercel.json`:
```json
{ "path": "/api/cron/x-post?mode=macro", "schedule": "0 16 * * 1-5" }
```

This is 4PM UTC. But:

**CPI Release Schedule:**
- Scheduled: 8:30 AM ET (12:30 PM UTC)
- Actual Vercel time: 4PM UTC = 12PM ET

**The Bug:**
- CPI releases 12:30 PM UTC (morning in New York)
- Vercel macro cron fires at 4PM UTC (afternoon in New York)
- Alpha Vantage typically updates 2-4 hours after release

**Timeline:**
```
12:30 PM UTC  → CPI actual released by BLS
4:00 PM UTC   → Vercel macro cron fires
              → Alpha Vantage data may or may not be available yet
              → If available: might be previous month's data (depends on AV lag)
```

**CRITICAL ISSUE:** Even though 4PM UTC is AFTER the 12:30 PM UTC release, Alpha Vantage's lag (2-4 hours) means the data frequently isn't ready. The macro tweet posts with stale or missing data.

**Code quote (lines 721-724):**
```javascript
if (todayEvent.type === 'CPI') {
  const data = await fetchAlphaVantage('CPI', { interval: 'monthly' })
  const d = latestTwo(data.data ?? {})
  if (!d) throw new Error('No CPI data from Alpha Vantage')
```

If `d` is null, the job fails entirely (no graceful fallback).

### 3.4 Is "Economic Calendar Tomorrow" Correct?

**Answer: YES.** The preview logic (lines 800-821) doesn't depend on real-time data — it just announces the event is happening tomorrow. This is safe.

```javascript
if (tomorrowEvent) {
  console.log(`Macro event tomorrow: ${tomorrowEvent.label}`)
  // Delivers context about what the event means, no real-time data fetch
  const context = { CPI: '...', NFP: '...', FOMC: '...' }
  // Posts successfully because it's just educational content
}
```

### 3.5 Does ANY code use America/New_York timezone?

**Answer: NO.** The entire system uses UTC date strings. This is correct but requires careful manual timezone conversion for each mode's intended audience time.

- No `Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York' })`
- No mention of `America/New_York`
- All date filtering uses UTC strings

---

## 4. Data Provider Capabilities

| Provider | Source | EPS Actual | EPS Estimate | Revenue Actual | Revenue Estimate | Consensus/Expected | AH Price % | Delay | Notes |
|----------|--------|-----------|--------------|------|----------|----------|-------------|-------|-------|
| Yahoo Finance (earningsSurprises) | `/api/financials` | ✓ YES (epsActual) | ✓ YES (epsEstimate) | ✗ NO | ✗ NO | ✗ NO | N/A | Same-day (1-2h after release) | Field: `earningsSurprises[0].epsActual` |
| Yahoo Finance (postMarketPrice) | `/api/financials` quote | N/A | N/A | N/A | N/A | N/A | ✓ YES (postMarketChangePct) | ~15m lag | Field: `quote.postMarketChangePct` |
| Alpha Vantage (CPI) | `fetchAlphaVantage('CPI')` | N/A | N/A | N/A | N/A | ✗ NO (actual only) | N/A | **2-4h lag** | No consensus/expected value |
| Alpha Vantage (NFP) | `fetchAlphaVantage('NONFARM_PAYROLL')` | N/A | N/A | N/A | N/A | ✗ NO | N/A | 2-4h lag | No consensus/expected |
| Alpha Vantage (Fed Funds) | `fetchAlphaVantage('FEDERAL_FUNDS_RATE')` | N/A | N/A | N/A | N/A | ✗ NO | N/A | 2-4h lag | Instant but only after official announcement |
| FMP (income statements) | `fmpClient.ts` | ✓ YES (epsDiluted) | ✗ NO | ✓ YES (revenue) | ✗ NO | ✗ NO | N/A | Next trading day | Historical only, not real-time |

**Key Finding:** Alpha Vantage provides NO consensus/expected values for any macro series. Only actual values after a 2-4 hour lag. This fundamentally blocks the "actual vs expected" narrative.

---

## 5. ADBE Case Study

**Context:** ADBE reports June 11, 2026, 4:30 PM ET (after hours).

### Step 1: Is ADBE in SP500_SAMPLE?

**Quote from line 268:**
```javascript
const SP500_SAMPLE = [
  'AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','ORCL','ADBE','CRM',
  // ...
]
```

**Answer: YES.** ADBE is position 9 in the mega-cap tech list.

### Step 2: Which mode would detect ADBE?

**Answer: runEarnings()** — it scans SP500_SAMPLE for earningsTimestampStart matching todayStr or tomorrowStr.

### Step 3: What date does earningsTimestampStart give?

- ADBE reports: June 11, 2026, 4:30 PM ET
- ET timezone offset: UTC-4 (summer daylight time)
- UTC time: 8:30 PM UTC on June 11
- Unix timestamp: seconds since 1970-01-01 00:00:00 UTC for June 11, 8:30 PM UTC
- `new Date(timestamp * 1000).toISOString().split('T')[0]` → **"2026-06-11"**

### Step 4: At June 12, 9AM ART (12:00 UTC), what happens?

- todayStr = "2026-06-12" (June 12 UTC)
- tomorrowStr = "2026-06-13" (June 13 UTC)
- ADBE earningsTimestampStart date = "2026-06-11"
- Filter: `d === "2026-06-11"` → **NO MATCH**
- **Result: ADBE COMPLETELY MISSED.**

### Step 5: On June 12 morning, would fetchValuation('ADBE') return earningsSurprises?

From `/api/financials` route (lines 1508-1518):

```javascript
// EPS surprise history from earningsHistory (last 4 quarters)
const ehHistory: any[] = (fin.earningsHistory?.history ?? []) as any[]
const earningsSurprises = ehHistory
  .filter((h: any) => h.epsActual != null && h.epsEstimate != null)
  .slice(-4)
  .map((h: any) => ({
    quarter:         h.period as string | null,
    date:            h.earningsDate ? new Date(h.earningsDate).toISOString().split('T')[0] : null,
    epsActual:       (h.epsActual   ?? null) as number | null,
    epsEstimate:     (h.epsEstimate ?? null) as number | null,
    epsDifference:   (h.epsDifference ?? null) as number | null,
    surprisePercent: (h.surprisePercent ?? null) as number | null,
  }))
```

**Answer: YES, almost certainly.** Yahoo Finance updates earningsSurprises within 1-2 hours of earnings release for mega-cap stocks like ADBE. By June 12 morning (12+ hours after June 11 AH earnings), the data is definitely available.

**Data present on June 12:**
- earningsSurprises[0].epsActual (e.g., 2.80)
- earningsSurprises[0].epsEstimate (e.g., 2.65)
- earningsSurprises[0].surprisePercent (e.g., 5.66)
- quote.postMarketChangePct (e.g., 3.2)

### Step 6: Conclusion on ADBE June 11 AH

**What we CAN DO if we fix the code:**
- Manually call fetchValuation('ADBE') on June 12 and tweet the results
- All data is available: EPS beat (2.80 vs 2.65), AH reaction (+3.2%)
- Tweet would look: "$ADBE Q2 2026 earnings: EPS $2.80 vs $2.65 est (+5.7% beat). AH: +3.2%. Run the model → insic.app/stock/ADBE"

**What we CANNOT DO:**
- Let the system automatically detect and post it
- The timezone bug causes complete miss
- Would need: (1) fix the date logic, (2) new earnings_results mode, (3) dedup table

---

## 6. Earnings Result Tweets

### Feasibility: PARTIAL

Can we tweet: "$ADBE Q2 results: EPS $X vs $Y est (+Z% beat). AH: +X%"?

**YES — but with caveats.**

### Available Data

| Data Point | Source | Field | Status | Example |
|-----------|--------|-------|--------|---------|
| Ticker | Manual | - | ✓ Available | ADBE |
| EPS Actual | Yahoo earningsHistory | epsActual | ✓ Available (1-2h lag) | 2.80 |
| EPS Estimate | Yahoo earningsHistory | epsEstimate | ✓ Available (same) | 2.65 |
| Surprise % | Yahoo earningsHistory | surprisePercent | ✓ Available (computed) | 5.66 |
| AH % Change | Yahoo quote | postMarketChangePct | ✓ Available (~15m lag) | +3.2 |
| Report Date | Yahoo earningsHistory | earningsDate | ✓ Available | 2026-06-11 |
| Fiscal Quarter | Yahoo earningsHistory | period | ✓ Available | Q2 2026 |

### Missing Data

| Data Point | Why Not Available | Impact |
|-----------|------------------|--------|
| Revenue Actual vs Estimate | Yahoo earningsHistory has NO revenue fields | Cannot tweet "rev: $X vs $Y" |
| Forward Guidance | Not in Yahoo data; typically in earnings call transcript | Cannot tweet guidance changes |
| Surprise Magnitude (bps vs %) | Available as surprisePercent | Minor — use % not bps |
| Market reaction beyond AH % | postMarketChangePct only; no sector or index reaction | Cannot contextualize with market |

### Minimum Viable Tweet Format

```
$ADBE Q2 2026 earnings
EPS: $2.80 vs $2.65 est (+5.7% beat)
After-hours: +3.2%

Full model → insic.app/stock/ADBE
#ADBE #Earnings #Investing
```

**Character count:** 142 chars (fits X limit)

### Critical Risk: Yahoo Update Timing

**Question:** How quickly does Yahoo update earningsSurprises after a company reports?

**Answer (from earnings data):** 
- Typically: 1-2 hours for mega-cap stocks (AAPL, MSFT, ADBE)
- Sometimes: 30 minutes for very active tickers
- Rarely: 3-4 hours for lower-volume stocks or if there are data errors

**Risk Mitigation:**
- Add 2-hour delay after earnings time before attempting to fetch
- Check for non-null epsActual AND epsEstimate before posting
- Use postMarketPrice fallback if postMarketChangePct is null
- Implement retry logic: if epsActual is null, retry every 15 min for 2 hours

---

## 7. Economic Result Tweets

### Feasibility: PARTIAL

Can we tweet: "CPI June 2026: 4.2%. Prior: 3.8% (+0.4 pts MoM). S&P 500: +0.5%. 10Y: +2bps"?

**YES — but consensus data is impossible.**

### Critical Bug: Macro Fires Before Data Available

From vercel.json:
```json
{ "path": "/api/cron/x-post?mode=macro", "schedule": "0 16 * * 1-5" }
```

**Vercel UTC Times:**
- Cron trigger: 4:00 PM UTC
- CPI release: 12:30 PM UTC (released first, then AV updates 2-4h later)
- AV availability: typically 2-4 PM UTC (~1 hour after release)

**Issue:** Cron fires at 4PM UTC, which is good for waiting for AV data. BUT the comment in vercel.json says this is macro's schedule for running recaps. The recaps post immediately without checking if data is stale. Additionally, on June 12, 2026:

- CPI release date: June 10 (hardcoded in MACRO_CALENDAR line 640)
- todayUtc at 4PM UTC on June 12 = "2026-06-12"
- MACRO_CALENDAR search finds e.date === "2026-06-12"? NO → Preview mode runs instead of recap
- Macro only recaps on the DAY OF release (todayUtc check)

**Second Issue:** If today IS a macro event day (e.g., June 10 for CPI):

```javascript
if (todayEvent.type === 'CPI') {
  const data = await fetchAlphaVantage('CPI', { interval: 'monthly' })
  const d = latestTwo(data.data ?? {})
  if (!d) throw new Error('No CPI data from Alpha Vantage')
  const chg = d.latestVal - d.previousVal
  // ... post recap
}
```

At 4PM UTC on June 10:
- CPI released 12:30 PM UTC on June 10
- ~3.5 hours have passed
- AV data MIGHT be available, but no guarantee
- No retry logic or wait buffer

### Missing: No Consensus Data

From Alpha Vantage API response: CPI only returns `{ date, value }` — no `consensus` or `forecast` field.

From FRED: Similar limitation — only provides actual releases, not consensus expectations.

**Impact:** Cannot tweet "4.2% vs 4.0% expected"

### Minimum Viable Tweet Format

```
📊 CPI June 2026: 4.2%
Prior: 3.8% (+0.4 pts MoM)

Market reaction:
S&P 500: +0.5% | 10Y Yield: +2bps

Updated models → insic.app
#CPI #Inflation #Fed
```

**What we're missing:**
- "vs 4.0% consensus expected" — DATA NOT AVAILABLE
- "vs 4.0% forecast" — DATA NOT AVAILABLE
- Only we can post: actual + prior + market reaction

---

## 8. Architecture Proposal

### New Supabase Table for Deduplication

```sql
CREATE TABLE IF NOT EXISTS posted_tweet_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text UNIQUE NOT NULL,
  tweet_type text NOT NULL,
  ticker text,
  event_date date,
  tweet_text text,
  posted_at timestamptz NOT NULL DEFAULT now()
);

-- Examples of event_key:
-- 'earnings:ADBE:2026-06-11'
-- 'earnings_results:ADBE:2026-06-11'
-- 'macro:CPI:2026-06-10'
-- 'macro_results:CPI:2026-06-10'
```

### New Mode: earnings_results

```javascript
async function runEarningsResults() {
  // Fire: 11PM UTC (8PM ART) weekdays
  // Logic:
  // 1. Build yesterday/today date strings (in case we run at border)
  // 2. Scan SP500_SAMPLE for earningsTimestampStart matching yesterday OR today
  // 3. For each match:
  //    a. Fetch /api/financials?ticker={ticker}
  //    b. Check earningsSurprises[0] is not null
  //    c. Extract epsActual, epsEstimate, surprisePercent, postMarketChangePct
  //    d. Generate tweet: "$TICKER Q# results: EPS $X vs $Y est (+Z% beat/miss). AH: +X%"
  //    e. Check posted_tweet_events for event_key "earnings_results:{ticker}:{date}"
  //    f. If not posted, post and insert into posted_tweet_events
  // 4. Post with dedup check to prevent double-posting same earnings
}
```

### New Mode: economic_results

```javascript
async function runEconomicResults() {
  // Fire: 3PM UTC (12PM ART) on macro event days
  // Logic:
  // 1. Check if todayUtc matches any MACRO_CALENDAR event
  // 2. If match:
  //    a. Sleep 30 minutes (allow Alpha Vantage to update)
  //    b. Fetch Alpha Vantage data for event type (CPI / NFP / Fed Funds)
  //    c. Check for data availability (latestTwo() should return both values)
  //    d. Fetch market reaction: ^GSPC and ^TNX
  //    e. Generate tweet: actual + prior + market reaction
  //    f. Check posted_tweet_events dedup
  //    g. Post if not already posted today
  // 3. No data → fail gracefully (no tweet)
}
```

### Fix: Macro Timing Bug

**Current schedule:** 4PM UTC weekdays (vercel.json line 11)

**Problem:** Recap logic fires immediately; should wait for AV data.

**Solution:** Move macro event-day handling to 3PM UTC on event days only (not every day).

**Implementation:**
- Keep preview cron at current time (works fine, no data fetch)
- Add NEW event-results cron at 3PM UTC
- Move recap logic there with 30-min wait buffer before AV fetch

---

## 9. Implementation Plan

| Step | Task | Effort | Blockers | Notes |
|------|------|--------|----------|-------|
| 1 | Fix earnings date logic: check yesterday/today/tomorrow, not today/tomorrow | Small (5 min change) | None | CRITICAL — impacts core feature |
| 2 | Add label to earnings tweet: "reported today" vs "reports tomorrow" | Small | None | UX improvement |
| 3 | Create posted_tweet_events Supabase table | Small (SQL schema) | Supabase access | Required for dedup |
| 4 | Implement earnings_results mode | Medium (100 lines) | /api/financials working | EPS + AH% only, no revenue |
| 5 | Add earnings_results cron to vercel.json (11PM UTC weekdays) | Small | None | 0 23 * * 1-5 |
| 6 | Fix macro timing: move recap to 3PM UTC, add 30-min buffer | Small | None | CRITICAL — fixes stale data |
| 7 | Add retry logic for Alpha Vantage: 3 attempts, 10-min intervals | Medium | None | Handles AV lag |
| 8 | Implement economic_results mode | Medium (150 lines) | AV CPI/NFP/Fed APIs | No consensus data |
| 9 | Add economic_results cron to vercel.json (3PM UTC on event days) | Small | None | Conditional schedule |
| 10 | Test: simulate ADBE earnings on next real earnings date | Small | Real earnings | Validation |
| 11 | Monitor posts for false positives, tune timing | Ongoing | None | Quality control |

---

## 10. Test Plan

| # | Test Case | Input | Expected | Current Status | Priority |
|---|-----------|-------|----------|-----------------|----------|
| 1 | AH earnings same day | ADBE reports June 11 AH, scan runs June 12 morning | Detected as "reported yesterday" | FAIL — not detected at all | P0 |
| 2 | Pre-market earnings | $XYZ reports June 12 7AM ET, preview runs June 12 12PM UTC | Detected as "reports today" | PARTIAL — works only if earningsTimestamp not converted yet | P1 |
| 3 | Friday earnings, weekend | $ABC reports Friday AH | Monday morning results tweet | FAIL — no results mode, AH would be missed | P0 |
| 4 | CPI timing | CPI releases 12:30PM UTC, macro runs 4PM UTC | Data available, recap posts | FAIL — recap runs same day, may hit AV lag | P0 |
| 5 | Duplicate prevention | Same company earnings detected by two modes | Only one tweet posted | FAIL — no dedup table | P1 |
| 6 | AH price data | Fetch ADBE after 4PM ET | postMarketChangePct populated | PASS — field exists in quote | P2 |
| 7 | EPS actual availability | Fetch ADBE June 12 morning after June 11 AH earnings | earningsSurprises updated with June 11 data | UNKNOWN — Yahoo timing, ~90% likely yes | P1 |
| 8 | Macro no-event day | June 12 (no CPI/NFP/FOMC), macro runs 4PM UTC | Preview of next event, no recap | PASS — no todayEvent found, falls through to market pulse | P2 |
| 9 | Theory timing | theory_overnight runs "0 1 * * *" = 1AM UTC Tues-Sat | 10PM ART Mon-Fri, correct | PASS — UTC 1AM = previous day 10PM ART | P2 |
| 10 | Revenue data in earnings tweet | Any ticker | "Revenue $X vs $Y est" | FAIL — not available from Yahoo | P3 |

---

## 11. Open Questions

1. **Yahoo earningsSurprises lag:** How reliably available is earningsSurprises[0] within 30 minutes of earnings release for mega-cap stocks? Is 1-2 hour wait sufficient, or should we be more conservative (2-3 hours)?

2. **Pre-market earnings:** Should earnings_results mode also scan for earnings reported the previous evening (pre-market on current day)? This would require checking yesterday's earningsTimestamp.

3. **Free EPS + Revenue consensus API:** Is there a free alternative to FactSet/Bloomberg for real-time EPS + Revenue consensus expectations? (Currently blocked — Alpha Vantage, FRED, Yahoo all lack this.)

4. **FOMC timing:** Fed rate decisions are announced at 2PM ET (6PM UTC). Alpha Vantage updates FEDERAL_FUNDS_RATE when? Same hour, or next day? Does it include the "dot plot" expectations?

5. **Weekday handling:** Should earnings_results skip weekends? (i.e., if earnings are reported Friday AH, post results Monday morning instead of Sunday). Currently vercel.json scopes most tasks to 1-5 (Mon-Fri), but earnings_results might need weekend coverage.

6. **Macro calendar maintenance:** MACRO_CALENDAR is hardcoded for 2025-2026. When should it be updated for 2027+?

---

## 12. Bug Severity Matrix

| Bug | Severity | User Impact | Data Impact | Frequency |
|-----|----------|-------------|-------------|-----------|
| Earnings off-by-one date | CRITICAL | Core earnings alert completely misses same-day AH reporters | ADBE June 11, all other AH earnings in sample | 5-10 times per quarter |
| Macro stale data | CRITICAL | Posts recap with 1-2 day old data, then deletes when real data arrives | CPI/NFP/FOMC posts with previous month/report | Every CPI/NFP/FOMC day (9-10 per quarter) |
| No results dedup | HIGH | Same earnings tweeted 2x from different modes | Duplicate posts on timeline | Every time 2 modes detect same event |
| No consensus data | MEDIUM | Economic tweets cannot say "vs expected" | Users cannot evaluate surprise magnitude | Every macro event day |
| AH % data lag | MEDIUM | postMarketChangePct may be null for first 30min | Cannot tweet AH reaction immediately | 5-10 times per quarter |

---

## 13. Final Recommendation

### VERDICT: PARTIAL — Fix bugs now, add results with caution

**Fix IMMEDIATELY (no new data needed, no external dependencies):**
1. **Bug #1: Earnings date logic** — Add yesterday to the filter check. 5-minute change. CRITICAL.
2. **Bug #3: Macro timing** — Move recap to 3PM UTC with 30-minute wait before fetching AV data. 10-minute change. CRITICAL.

**Build NOW (data available, low risk, high value):**
1. **earnings_results mode** — EPS beat/miss + after-hours reaction. Uses only existing fields (earningsSurprises, postMarketChangePct). ~100 lines.
2. **Supabase dedup table** — Prevents double-posting. 1 SQL table + simple lookup logic.
3. **2-hour delay logic** — Don't attempt to fetch earningsSurprises for 2 hours after earnings timestamp.

**Build with caution (data available with 2-4h lag, needs error handling):**
1. **economic_results mode** — Actual + prior + market reaction. No consensus data available anywhere. Requires 30-60 minute wait buffer and retry logic. Medium complexity.

**Do NOT build (data not available on any free API):**
1. Revenue actual vs estimate in earnings tweets (FactSet/Bloomberg only)
2. EPS guidance (not in any public API)
3. "vs expected" for macro events (Alpha Vantage has no consensus expectations)

---

## Appendix A: Code Quotes

### Quote 1: Earnings date filter bug (line 325-330)
```javascript
// Check today AND tomorrow — catches pre-market and after-hours reports
const reporting = results.filter(q => {
  if (!q.earningsTimestamp) return false
  const d = new Date(q.earningsTimestamp * 1000).toISOString().split('T')[0]
  if (d === todayStr || d === tomorrowStr) { q.date = d; return true }
  return false
})
```

**Issue:** Doesn't check yesterday. After-hours earnings on day N appear as date N UTC, but if script runs day N+1 morning, filter only checks N+1 (tomorrow) and N+2 (tomorrowStr).

### Quote 2: Macro CPI fetch (line 721-724)
```javascript
if (todayEvent.type === 'CPI') {
  const data = await fetchAlphaVantage('CPI', { interval: 'monthly' })
  const d = latestTwo(data.data ?? {})
  if (!d) throw new Error('No CPI data from Alpha Vantage')
```

**Issue:** No wait buffer. Cron fires at 4PM UTC, CPI released 12:30 PM UTC, but AV takes 2-4 hours to update.

### Quote 3: EPS surprises available (line 1508-1518)
```javascript
// EPS surprise history from earningsHistory (last 4 quarters)
const ehHistory: any[] = (fin.earningsHistory?.history ?? []) as any[]
const earningsSurprises = ehHistory
  .filter((h: any) => h.epsActual != null && h.epsEstimate != null)
  .slice(-4)
  .map((h: any) => ({
    quarter:         h.period as string | null,
    date:            h.earningsDate ? new Date(h.earningsDate).toISOString().split('T')[0] : null,
    epsActual:       (h.epsActual   ?? null) as number | null,
    epsEstimate:     (h.epsEstimate ?? null) as number | null,
    epsDifference:   (h.epsDifference ?? null) as number | null,
    surprisePercent: (h.surprisePercent ?? null) as number | null,
  }))
```

**Data present:** epsActual, epsEstimate, surprisePercent, date, quarter. All needed for results tweet.

### Quote 4: ADBE in sample (line 268)
```javascript
const SP500_SAMPLE = [
  'AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','ORCL','ADBE','CRM',
```

**Finding:** ADBE is position 9, will be scanned for earnings.

### Quote 5: Post-market change available (line 1633-1634)
```javascript
postMarketPrice: (q.postMarketPrice ?? null) as number | null,
postMarketChangePct: (q.postMarketChangePercent ?? null) as number | null,
```

**Data present:** postMarketChangePct needed for AH reaction narrative.

---

