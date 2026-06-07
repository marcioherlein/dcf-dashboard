# insic Alert System Design Document

**Version 1.0 — June 2026**

---

## 1. Executive Summary

insic should build a **valuation-intelligence alert system** — not a price-alert system. Every competitor already does price alerts. What insic can uniquely do is alert users when *their own DCF assumptions are stressed by market reality*, when a stock crosses their computed fair value threshold, when quality-score deterioration signals emerging risk, or when their saved model needs a refresh because macro conditions have shifted.

The recommendation is a three-channel system (email, in-app notification center, optional web push), delivered through Vercel Cron + Supabase row-state tracking + Resend, built in three phases over approximately four months.

**The core positioning:** While Yahoo Finance alerts you that a stock moved 5%, insic alerts you that the stock is now 31% below *your* fair value — or that your WACC assumption is now mathematically below the risk-free rate and your model is overstating value.

Email is the primary channel. Financial decisions are high-consideration; users want to act on them at a desktop, not react to a push buzz. Email open rates in finance average 31% (Mailchimp 2026) — meaningfully above the 20% SaaS average. An in-app notification center is table stakes for retention. Web push is Phase 3 and optional.

The free tier gets one alert type (price crosses into "Attractive" zone for any saved valuation). Pro gets the full catalog.

---

## 2. Competitive Landscape

### What Competitors Actually Build

**Finviz Elite ($25–$40/month)**
Alert engine is screener-centric: users save a filter and get notified when new stocks match. Also supports per-ticker alerts on price movement, news, insider transactions, ratings changes, and SEC filings. Delivery: email + push. No valuation context — alerts are purely market-data driven. Gap: no fair value relationship, no assumption stress-testing, no quality score alerts.

**Simply Wall St (~$25/month)**
The closest competitor in philosophy. Sends "Narrative Update" alerts when fundamental changes occur — valuation shifts, earnings results, insider transactions. Alerts on Snowflake score changes. Sends "Buy Or Sell Opportunity" push when stocks move significantly vs their fair value estimate. Daily email digest + push. Key difference: their fair value is a black-box consensus estimate; insic users can own their own DCF assumptions. insic can alert on *user-specific model drift*, which Simply Wall St cannot.

**Seeking Alpha (~$19–$35/month)**
Alert-rich system covering earnings transcripts, dividend changes, author articles on followed tickers, quant rating changes, price target changes from Wall Street analysts. Strength is breadth of news/event triggers. Daily digest or real-time emails. No DCF or intrinsic-value logic — purely market-event driven.

**TipRanks (~$30/month)**
Alerts on analyst consensus changes, insider transactions, hedge fund activity, price targets. Strong on Wall Street sentiment signals. Delivery: email + push. No valuation model.

**Yahoo Finance**
Basic price alerts (above/below absolute price level), earnings date reminders, breaking news on followed tickers. Mobile push-first. No valuation logic. Free but unsegmented.

**Morningstar Investor (~$35/month)**
Professional tier: alerts when analysts change their star rating, fair value estimate, moat rating, or uncertainty. Benchmark for quality-signal alerting. Limitation: only covers ~1,500 Morningstar-covered stocks; insic covers all NYSE/NASDAQ.

**Koyfin (~$25–$50/month)**
Price alerts with percentage-threshold triggers. Some earnings/economic calendar alerts. Limited fundamental alerting depth.

**Stock Analysis (stockanalysis.com)**
Primarily data-access, minimal alert infrastructure. Some earnings calendar notifications. No systematic alert engine.

### Competitive Gaps insic Can Own

| Gap | Competitor weakness | insic opportunity |
|-----|--------------------|--------------------|
| User-owned assumption drift | No competitor alerts on *user's own inputs* | "Your WACC is now below risk-free rate" |
| DCF threshold crossings | Price-relative only | Alert when price crosses user's computed fair value |
| Multi-method blend shifts | Single-model competitors | Alert when bull/bear spread widens significantly |
| Quality score deterioration | Mostly static or periodic | Alert when Beneish M-Score crosses into Warning |
| Altman Z distress signal | Rarely surfaced proactively | "This holding entered the Grey/Distress zone" |
| Piotroski trend decline | Not tracked over time | "Piotroski F-Score dropped 2 points since your last analysis" |
| Portfolio-level WACC vs rate | Not done anywhere | "3 of your 5 saved valuations have WACC below current 2Y yield" |
| Scenario spread widening | Unique to scenario builders | "Bull/Bear spread on AAPL widened 40% — model uncertainty increased" |

---

## 3. Alert Types Catalog

### Tier 1: Valuation/DCF Alerts (insic-unique, highest value)

**V-1: Price Crosses Into Attractive Zone**
- Trigger: Current stock price drops to >= 25% upside vs user's saved `fair_value`
- Free: YES (1 active per user on their most recent saved valuation)
- Pro: YES (all saved valuations, configurable threshold)
- Priority: MUST-HAVE
- Value: The core insic value prop — acts as "buy the dip" signal backed by user's own DCF work
- Technical: Compare live price (Yahoo Finance) vs stored `fair_value` in `valuations` table

**V-2: Price Exits Fair Value Zone (Expensive Signal)**
- Trigger: Current price rises such that upside < 5% (user's fair_value nearly reached or passed)
- Free: NO
- Pro: YES
- Priority: MUST-HAVE
- Value: "Your thesis is playing out — consider trimming or updating model"

**V-3: Price Crosses Fair Value (100%)**
- Trigger: Current price crosses above stored `fair_value`
- Free: NO
- Pro: YES
- Priority: MUST-HAVE
- Value: "Time to reassess — stock trading at or above your intrinsic estimate"

**V-4: WACC Assumption Stressed by Market**
- Trigger: User's stored `wacc` is now below (current 2Y treasury yield - 1.5pp)
- Free: NO
- Pro: YES
- Priority: MUST-HAVE
- Technical: Already computed in `computeModelAlerts()` in `/lib/market-context/scoring.ts` — wire directly to email pipeline
- Value: "Your discount rate assumption is now below the risk-free rate — your fair value is overstated"

**V-5: Terminal Growth Rate Violates Gordon Growth**
- Trigger: User's stored `terminal_g` >= current 10Y treasury yield
- Free: NO
- Pro: YES
- Priority: MUST-HAVE
- Technical: Also computed in `computeModelAlerts()` — same reuse opportunity
- Value: "Your terminal growth assumption now exceeds the 10Y yield — DCF math breaks down"

**V-6: Revenue CAGR Assumption Now Aggressive**
- Trigger: User's stored `cagr` > 25% AND VIX > 25
- Free: NO
- Pro: YES
- Priority: SHOULD-HAVE

**V-7: Bull/Bear Scenario Spread Widening**
- Trigger: `(bull_value - bear_value) / base_value` exceeds threshold (e.g. > 50%)
- Free: NO
- Pro: YES
- Priority: SHOULD-HAVE
- Value: "High uncertainty on this stock — model outputs diverge widely under different assumptions"

**V-8: Stale Model Alert**
- Trigger: Saved valuation is >90 days old AND stock has moved >15% since save date
- Free: NO
- Pro: YES
- Priority: MUST-HAVE
- Value: "Your model is 3 months old and the stock has moved 18% — consider refreshing"

### Tier 2: Quality Score Alerts (insic-unique)

**Q-1: Beneish M-Score Crosses Into Warning/Manipulator Zone**
- Trigger: Fresh Beneish produces `Warning` or `Manipulator` when last analysis showed `Clean`
- Free: NO
- Pro: YES
- Priority: MUST-HAVE
- Value: Forensic accounting alert no retail-facing competitor provides. Extremely high signal-to-noise.
- Technical: `calculateBeneish()` exists in `/lib/dcf/calculateScores.ts`

**Q-2: Altman Z-Score Enters Distress Zone**
- Trigger: Fresh Altman produces `Distress` when user's saved analysis was `Safe` or `Grey`
- Free: NO
- Pro: YES
- Priority: MUST-HAVE
- Value: Bankruptcy-risk signal typically missed by retail investors.

**Q-3: Piotroski F-Score Significant Decline**
- Trigger: Re-calculated Piotroski drops >= 2 points vs user's last saved score
- Free: NO
- Pro: YES
- Priority: SHOULD-HAVE

**Q-4: ROIC vs WACC Spread Inverted**
- Trigger: Fresh ROIC calculation shows ROIC < WACC
- Free: NO
- Pro: YES
- Priority: SHOULD-HAVE
- Value: "This company is now destroying economic value — ROIC has fallen below cost of capital"

### Tier 3: Price-Based Alerts (competitive parity)

**P-1: Price Move Alert (percentage threshold)**
- Trigger: Stock price moves +/-X% in one day (configurable: 5%, 10%, 15%)
- Free: NO
- Pro: YES (limited to 5 stocks)
- Priority: SHOULD-HAVE

**P-2: 52-Week High/Low Crossed**
- Trigger: Stock hits new 52-week high or low
- Free: NO
- Pro: YES
- Priority: SHOULD-HAVE

**P-3: Earnings Date Reminder (T-3 days)**
- Trigger: 3 days before earnings for any saved/watched stock
- Free: YES (for saved valuations)
- Pro: YES (ETF watchlist + all saved)
- Priority: MUST-HAVE
- Value: Allows user to review their model before the print. Drives engagement.

### Tier 4: Portfolio-Level Alerts (Pro-exclusive)

**PF-1: Weekly Portfolio Fair Value Digest**
- Trigger: Every Monday 7:30am ET
- Content: Each saved valuation — current price, fair value, upside %, zone (Attractive/Fair/Expensive), model flags
- Free: NO
- Pro: YES
- Priority: MUST-HAVE

**PF-2: Portfolio-Level Macro Stress Alert**
- Trigger: >= 2 of user's saved valuations have WACC or terminal_g stressed by current macro
- Free: NO
- Pro: YES
- Priority: SHOULD-HAVE

**PF-3: Concentration Risk Alert**
- Trigger: Portfolio exceeds 30% weight in a single stock
- Free: NO
- Pro: YES
- Priority: NICE-TO-HAVE

### Tier 5: Market/Macro Alerts (Pro-exclusive)

**M-1: Rate Regime Change Alert**
- Trigger: 2Y Treasury yield moves >25bps in a week
- Free: NO
- Pro: YES
- Priority: SHOULD-HAVE

**M-2: VIX Regime Alert**
- Trigger: VIX crosses 25, 30, or drops below 15
- Free: NO
- Pro: YES
- Priority: SHOULD-HAVE

**M-3: ETF Watchlist Score Change**
- Trigger: ETF `value_score` changes >= 10 points between weekly checks
- Free: NO
- Pro: YES
- Priority: SHOULD-HAVE

---

## 4. Delivery Strategy

### Channel Priority

**Primary: Email (via Resend — already integrated)**
Finance email benchmark: 31% average open rate (Mailchimp 2026), above the 20% SaaS average. Resend is already integrated. Free tier: 3,000/month; Pro: 50,000/month.

**Secondary: In-App Notification Center (new build)**
Bell icon in navigation with badge count. Last 30 alerts with read/unread state. Supabase Realtime subscription for instant badge updates.

**Tertiary: Web Push (Phase 3, Pro-only)**
Opt-in rates 5–15% for web-first apps. Requires service worker + VAPID keys. Defer to Phase 3.

**Not recommended: SMS/WhatsApp**
Twilio costs add up, regulatory surface is large, use case doesn't demand immediacy.

### Email Timing

| Alert | Timing |
|-------|--------|
| Weekly Digest (PF-1) | Monday 7:30am ET |
| Instant Alerts (V-1, V-2, V-3, Q-1, Q-2) | Within 15 min of trigger. Hourly cron 9am–5pm ET weekdays |
| Stale Model (V-8) | Sunday 8am ET |
| Earnings Reminder (P-3) | Day of 7am ET, plus T-3 |
| Macro Alerts (M-1, M-2) | Same-day 9am ET |

### Anti-Fatigue Rules

1. **Per-ticker cooldown:** 72-hour cooldown per ticker+alert_type combination
2. **Daily cap:** Max 3 individual alerts per user per day; excess batched into next digest
3. **Digest consolidation:** All batched alerts included in Monday digest
4. **Frequency preference:** Instant / Digest / Hybrid (critical alerts always instant)
5. **Snooze:** One-click "Snooze 2 weeks" via tokenized URL in every email
6. **Auto-suppression:** If user hasn't opened last 5 alert emails (tracked via Resend webhooks), switch to digest-only

---

## 5. Database Schema

### `alert_rules` table

```sql
create table alert_rules (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null references users(id) on delete cascade,
  alert_type      text not null,
  -- 'PRICE_ATTRACTIVE' | 'PRICE_EXPENSIVE' | 'PRICE_AT_FAIR_VALUE' |
  -- 'WACC_STRESSED' | 'TERMINAL_G_VIOLATION' | 'CAGR_AGGRESSIVE' |
  -- 'BENEISH_WARNING' | 'ALTMAN_DISTRESS' | 'PIOTROSKI_DECLINE' |
  -- 'ROIC_WACC_INVERSION' | 'PRICE_MOVE_PCT' | 'EARNINGS_REMINDER' |
  -- 'STALE_MODEL' | 'WEEKLY_DIGEST' | 'RATE_REGIME_CHANGE' | 'VIX_REGIME'
  ticker          text,
  valuation_id    uuid,
  is_active       boolean not null default true,
  threshold_value numeric,
  channel         text[] not null default array['email'],
  frequency_pref  text not null default 'instant',
  cooldown_hours  integer not null default 72,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table alert_rules enable row level security;
create policy "Users manage own alert rules"
  on alert_rules for all
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

create index idx_alert_rules_user_active on alert_rules(user_id, is_active);
create index idx_alert_rules_type on alert_rules(alert_type);
```

### `alert_events` table

```sql
create table alert_events (
  id              uuid primary key default gen_random_uuid(),
  rule_id         uuid references alert_rules(id) on delete cascade,
  user_id         text not null references users(id) on delete cascade,
  alert_type      text not null,
  ticker          text,
  valuation_id    uuid,
  title           text not null,
  body            text not null,
  context_data    jsonb,
  -- { fair_value, current_price, upside_pct, wacc, terminal_g, etc. }
  severity        text not null default 'info',
  -- 'critical' | 'high' | 'medium' | 'info'
  status          text not null default 'pending',
  -- 'pending' | 'sent' | 'read' | 'snoozed' | 'suppressed' | 'batched'
  channel         text not null default 'email',
  sent_at         timestamptz,
  read_at         timestamptz,
  snooze_until    timestamptz,
  email_resend_id text,
  dedup_key       text unique,
  -- e.g. 'user_123:BENEISH_WARNING:AAPL:2026-W22'
  created_at      timestamptz not null default now()
);

alter table alert_events enable row level security;
create policy "Users read own alert events"
  on alert_events for select
  using (user_id = auth.uid()::text);

create index idx_alert_events_user_status on alert_events(user_id, status, created_at desc);
create index idx_alert_events_dedup on alert_events(dedup_key);
create index idx_alert_events_pending on alert_events(status, channel) where status = 'pending';
```

### `alert_preferences` table

```sql
create table alert_preferences (
  user_id               text primary key references users(id) on delete cascade,
  email_enabled         boolean not null default true,
  in_app_enabled        boolean not null default true,
  push_enabled          boolean not null default false,
  push_subscription     jsonb,
  global_frequency      text not null default 'hybrid',
  daily_cap             integer not null default 3,
  snooze_all_until      timestamptz,
  digest_day            text not null default 'Monday',
  digest_time_utc       time not null default '12:30',
  consecutive_unopened  integer not null default 0,
  last_email_opened_at  timestamptz,
  updated_at            timestamptz not null default now()
);

alter table alert_preferences enable row level security;
create policy "Users manage own preferences"
  on alert_preferences for all
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);
```

### `alert_check_state` table

```sql
create table alert_check_state (
  id                    uuid primary key default gen_random_uuid(),
  user_id               text not null references users(id) on delete cascade,
  valuation_id          uuid,
  ticker                text not null,
  last_price            numeric,
  last_upside_pct       numeric,
  last_piotroski        integer,
  last_altman_zone      text,
  last_beneish_flag     text,
  last_wacc_flag        boolean not null default false,
  last_terminal_g_flag  boolean not null default false,
  last_checked_at       timestamptz,
  unique (user_id, ticker, valuation_id)
);
```

### `vercel.json` Cron Schedule

```json
{
  "crons": [
    { "path": "/api/alerts/cron/price-check",   "schedule": "0 9-17 * * 1-5" },
    { "path": "/api/alerts/cron/quality-check", "schedule": "0 8 * * 1" },
    { "path": "/api/alerts/cron/weekly-digest", "schedule": "30 12 * * 1" },
    { "path": "/api/alerts/cron/macro-check",   "schedule": "0 14 * * 1-5" },
    { "path": "/api/alerts/cron/stale-check",   "schedule": "0 13 * * 0" }
  ]
}
```

> **Note:** Vercel Pro plan required for sub-daily cron frequency.

---

## 6. Implementation Roadmap

### Phase 1 — Foundation (Weeks 1–4)

**Goal:** Email alerts working for the two highest-value triggers.

**Sprint 1 (Weeks 1–2):**
1. Create 4 database tables
2. `/api/alerts/cron/price-check` with cron auth validation
3. Price-check logic: fetch current price, compare vs `fair_value`, write `alert_events` rows
4. Dedup key pattern: `{user_id}:{alert_type}:{ticker}:{ISO-week}`
5. `AlertEmail` React Email template (reuse insic brand styles)
6. Resend sending: read `pending` rows, send, update to `sent`, store `email_resend_id`

**Sprint 2 (Weeks 3–4):**
7. V-1 (Price Attractive) — free tier
8. V-3 (Price At/Above Fair Value) — Pro only
9. V-8 (Stale Model Alert) — Pro only, Sunday cron
10. P-3 (Earnings Reminder) — Free + Pro, pull from FMP
11. User preference page at `/account/alerts`
12. One-click snooze via tokenized URL

### Phase 2 — In-App + Quality Alerts (Weeks 5–10)

**Goal:** Quality-score alerts (insic's true differentiator). In-app notification center. Weekly digest.

**Sprint 3 (Weeks 5–6):**
1. Bell icon with unread count badge in navigation
2. Notification drawer with last 30 events
3. Read state toggling
4. Supabase Realtime subscription on `alert_events` for instant badge updates

**Sprint 4 (Weeks 7–8):**
5. `/api/alerts/cron/quality-check` — Monday 8am ET
6. Re-fetch financial statements, run `calculateBeneish()`, `calculateAltman()`, `calculatePiotroski()`
7. Compare against `alert_check_state`, generate events on deterioration
8. Q-1 (Beneish Warning), Q-2 (Altman Distress) — severity: `critical`, always instant

**Sprint 5 (Weeks 9–10):**
9. V-4 (WACC Stressed), V-5 (Gordon Growth Violation) — reuse `computeModelAlerts()`
10. PF-1 (Weekly Digest) — Monday 7:30am ET, React Email table layout with zone color coding

### Phase 3 — Advanced + Web Push (Weeks 11–16)

**Goal:** Portfolio intelligence, web push, alert analytics.

**Sprint 6 (Weeks 11–12):**
1. PF-2 (Portfolio Macro Stress), PF-3 (Concentration Risk)
2. M-1 (Rate Regime Change), M-2 (VIX Regime)
3. M-3 (ETF Watchlist Score Change)

**Sprint 7 (Weeks 13–14):**
4. Service worker (`/public/sw.js`)
5. VAPID keys, `push_subscription` stored in `alert_preferences`
6. Web push sending via `web-push` npm package
7. Gate on Pro plan

**Sprint 8 (Weeks 15–16):**
8. Admin dashboard: delivery rates, open rates, alert type distribution
9. Resend webhook `/api/alerts/webhooks/resend` — track opens, clicks, bounces
10. Auto-suppression logic
11. A/B test subject line variants for weekly digest

---

## 7. Unique Differentiators

These alert types are technically impossible for any competitor without user-owned DCF inputs:

### 7.1 Your-Model-Specific Assumption Drift
No competitor alerts you that *your specific model inputs* conflict with market reality. When rates rise 100bps, insic can alert: "Your WACC of 8.2% for MSFT is now 1.8pp below the 2Y yield — your fair value estimate is likely overstated."
- **Already built:** Wire `computeModelAlerts()` in `/lib/market-context/scoring.ts` directly to email pipeline

### 7.2 Beneish M-Score Deterioration Alert
No retail-facing platform proactively alerts on Beneish M-Score changes. This forensic accounting signal has historically preceded earnings restatements. Early warning weeks before price action builds cult-level user loyalty.
- **Already built:** `calculateBeneish()` in `/lib/dcf/calculateScores.ts`

### 7.3 Altman Z Distress Entry
Altman Z-Score crossing into Distress is a bankruptcy-risk signal typically missed by retail investors.
- **Already built:** `calculateAltman()` in `/lib/dcf/calculateScores.ts`

### 7.4 Bull/Bear Scenario Spread Widening
Monitor `(bull_value - bear_value) / base_value` over time. Widening = increasing uncertainty = model revisit warranted.
- **Already stored:** `scenarios: { bull, base, bear }` in `valuations` table

### 7.5 Gordon Growth Constraint Violation
No other retail platform asks for terminal growth assumptions, so no other platform can detect this violation. Already detected in `computeModelAlerts()`.

### 7.6 ROIC < WACC (Economic Value Destruction)
The Warren Buffett moat test, made proactive. `calculateROIC()` exists in `/lib/dcf/calculateScores.ts`.

### 7.7 Weekly Digest with User's Own Numbers
While competitors send consensus-estimate digests, insic's digest shows each user's portfolio through the lens of *their own DCF assumptions*. Fundamentally different product. High retention driver.

---

## 8. Monetization Logic

### Free Tier (drives awareness, creates upgrade pressure)
- V-1: Price Crosses Into Attractive Zone — most recent 1 saved valuation only
- P-3: Earnings Date Reminder — saved valuations only
- In-app notification center — visible, limited to above types

The Attractive Zone alert is the best free-tier hook: fires when a stock is 25%+ below the user's own fair value — when it matters most. Creates a direct "insic saved me money" moment.

### Pro Tier (all of the above, plus)
- All V-series, Q-series, PF-series, M-series, P-series alerts
- Weekly Digest email
- Configurable thresholds and frequency preferences
- Snooze controls
- Web push (Phase 3)

### The Emotional Sell
Alerts are a *qualitative* upgrade — they change the user's relationship with investments from passive to monitored. "Never miss when your thesis plays out — or breaks down."

---

## 9. Technical Notes

### Vercel Cron Authentication
```typescript
const userAgent = req.headers.get('user-agent') ?? ''
const isVercelCron = userAgent.includes('vercel-cron')
const cronHeader = req.headers.get('x-vercel-cron-schedule')
if (!isVercelCron && !cronHeader) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

### Yahoo Finance Rate Limits
Batch price requests with 100ms delays between tickers. For bulk cron jobs, consider FMP as the fallback (clearer rate limits, already integrated).

### Resend Batching
For the Monday digest (all Pro users at once), use Resend's batch API. Send in batches of 50 with 200ms delays.

### Deduplication
`dedup_key` format: `{user_id}:{alert_type}:{ticker}:{ISO-week}` prevents re-firing within the same week.
For quarterly alerts (V-8 Stale Model), use monthly suffix.

### Supabase pg_cron for Cleanup
```sql
select cron.schedule(
  'archive-old-alert-events',
  '0 3 * * *',
  $$delete from alert_events
    where created_at < now() - interval '90 days'
    and status in ('read', 'suppressed')$$
);
```

### Existing Code Reuse (zero net-new logic required)
| Existing function | Location | Alert it powers |
|---|---|---|
| `computeModelAlerts()` | `/lib/market-context/scoring.ts` | V-4, V-5 |
| `calculateBeneish()` | `/lib/dcf/calculateScores.ts` | Q-1 |
| `calculateAltman()` | `/lib/dcf/calculateScores.ts` | Q-2 |
| `calculatePiotroski()` | `/lib/dcf/calculateScores.ts` | Q-3 |
| `calculateROIC()` | `/lib/dcf/calculateScores.ts` | Q-4 |

---

## 10. Alert Email Template Requirements

Each alert email should include:
1. **Header:** insic brand mark, dark navy background
2. **Alert badge:** Severity-colored pill (red=critical, amber=high, blue=info)
3. **Core signal:** Ticker, company name, trigger in plain English
4. **Your model context:** User's own inputs — "Your fair value: $142 / Current price: $107 / Upside: 33%"
5. **Action CTA:** "Review your model →" deep-linking to `/analyze?ticker=AAPL`
6. **Alert rationale:** 2–3 sentences explaining trigger and why it matters
7. **Footer:** Unsubscribe link, Snooze 2-week link, Alert preferences link

The contextual "Your model says X / Market says Y" design is the key differentiator. Other platforms show market data. insic shows *the gap between your thesis and reality*.
