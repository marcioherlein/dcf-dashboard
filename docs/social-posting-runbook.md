# Social Posting System — Runbook

## How the system works

Every scheduled tweet and LinkedIn post follows this path:

```
GitHub Actions cron (explicit schedule entry)
  → x-post.yml or li-post.yml workflow
    → mode resolution (HOUR:MIN:DOW → mode name)
      → node scripts/x-post.mjs MODE=<mode>
        → startup validation (env vars, format check)
          → dedup check (Supabase posted_tweet_events)
            → content generation (Yahoo Finance, Alpha Vantage, Finnhub, /api/financials)
              → validatePost() (blocks NaN, blanks, bad prices)
                → Buffer GraphQL API → Twitter/X or LinkedIn
                  → markPostedEvent() (records success in Supabase)
```

**Two separate workflows:**
- `x-post.yml` — Twitter/X, 48 explicit cron entries (Mon-Sun)
- `li-post.yml` — LinkedIn, single `*/15` cron with case-based routing

**Key files:**
| File | Purpose |
|------|---------|
| `.github/workflows/x-post.yml` | X/Twitter schedule + mode resolution |
| `.github/workflows/li-post.yml` | LinkedIn schedule + mode resolution |
| `scripts/x-post.mjs` | Main posting script (~8000 lines) |
| `app/api/cron/posting-health/route.ts` | Daily health check + alert |
| `app/api/admin/posting-status/route.ts` | Status API endpoint |
| `supabase/migrations/20260629_post_queue.sql` | Durable queue schema (future) |

---

## Where schedules live

**Twitter/X** — `.github/workflows/x-post.yml` → `schedule:` section
- 48 explicit cron entries, one per mode
- All times in UTC (ART = UTC-3)
- Mode names: `morning_brief`, `dcf`, `earnings`, etc.

**LinkedIn** — `.github/workflows/li-post.yml` → `schedule:` section
- Single `*/15 * * * *` cron (every 15 min)
- Mode resolved by `case "${HOUR}:${DOW}"` in the shell script

To change a post time: edit the `cron:` line in the relevant workflow file.
To add a mode: add to `MODES` map in `x-post.mjs`, add to `VALID_MODES` in `route.ts`, add to workflow options, add a cron entry.

---

## How to check today's status

**Status API** (requires admin login):
```
GET https://insic.app/api/admin/posting-status
```
Returns: posted count, failed count, last successful post per platform, failure details.

**Check GitHub Actions runs:**
1. Go to github.com/marcioherlein/dcf-dashboard/actions
2. Filter by workflow "X Auto-Post" or "LinkedIn Auto-Post"
3. Red runs = failures. Check the run log for the error.

**Check Supabase directly:**
```sql
-- Today's posts
SELECT event_key, tweet_type, posted_at
FROM posted_tweet_events
WHERE posted_at >= CURRENT_DATE
ORDER BY posted_at DESC;

-- Today's failures
SELECT event_key, tweet_text as error, posted_at
FROM posted_tweet_events
WHERE posted_at >= CURRENT_DATE
  AND event_key LIKE '%:failed';
```

**Health check endpoint:**
```
GET https://insic.app/api/cron/posting-health
Authorization: Bearer <CRON_SECRET>
```
Returns: healthy/degraded status, counts, failures, whether alert was sent.

---

## What "healthy" looks like

On a normal weekday by 5PM ART:
- 15+ posts in `posted_tweet_events` for today
- 4+ LinkedIn posts
- No rows with `:failed` suffix
- GitHub Actions: all runs green
- Health check: `{ "status": "healthy" }`

On a weekend:
- 4-6 posts (sentiment, sector_scan, etf_pulse, etc.)
- Same failure indicators

---

## What to do if zero posts by 10AM

1. **Check the status API**: `https://insic.app/api/admin/posting-status`
2. **Check GitHub Actions**: Go to Actions → X Auto-Post → look for recent runs
   - No runs? → GitHub cron hasn't fired yet or was delayed. Fire manually (step 4).
   - Red runs? → Click the run, check the "Resolve mode" and "Post to X" steps.
3. **Common errors and fixes:**

| Error | Cause | Fix |
|-------|-------|-----|
| `STARTUP FAILURE: missing required env vars` | Secret deleted from GitHub | Re-add secret in Settings → Secrets → Actions |
| `Buffer post failed: Access token is not valid` | Buffer API key expired | Go to Buffer → Settings → Developers → regenerate token → update GH secret `BUFFER_API_KEY` |
| `LINKEDIN_CHANNEL_ID not configured` | Secret missing | Add `LINKEDIN_CHANNEL_ID` to GH secrets |
| `Dedup check failed (Supabase unreachable)` | Supabase down | Wait for Supabase recovery — posts will resume automatically |
| `Already posted (key: mode:X:YYYY-MM-DD)` | Mode ran twice | Not a problem — working as intended |
| `No matching mode for UTC HH:MM DOW=N` | Mode resolution gap | Check the `if/elif` chain in x-post.yml for the time that fired |

4. **Manually fire missed posts:**
   - GitHub Actions → X Auto-Post → Run workflow
   - Select the mode (e.g. `morning_brief`)
   - Set `dry_run: false`
   - Click Run workflow

---

## How to replay failed posts

**Option A — GitHub Actions UI:**
1. Go to Actions → X Auto-Post → Run workflow
2. Select the mode that failed
3. Set `dry_run: false`
4. Run

The dedup system will skip if it already posted today. To force a replay on a day that already posted, you need to delete the event row from Supabase:
```sql
DELETE FROM posted_tweet_events
WHERE event_key = 'mode:morning_brief:2026-06-29';
```
Then run the workflow manually.

**Option B — Direct script call (if you have local setup):**
```bash
MODE=morning_brief DRY_RUN=false node scripts/x-post.mjs
```

---

## How to check Buffer connection

1. Go to buffer.com → Your profile → Connected channels
2. Verify X (@insicapp) and LinkedIn (insic) are connected and active
3. If disconnected: reconnect in Buffer → will generate new channel IDs
4. Update `BUFFER_CHANNEL_ID` and `LINKEDIN_CHANNEL_ID` in GitHub Secrets

Test Buffer auth:
```bash
# In scripts/ dir
MODE=dcf DRY_RUN=true BUFFER_API_KEY=<key> BUFFER_CHANNEL_ID=<id> APP_URL=https://insic.app node x-post.mjs
```
Should output `--- DRY RUN ---` with post content. If it outputs `STARTUP FAILURE` → key is wrong.

---

## How to rotate API keys

**Buffer API Key:**
1. buffer.com → Settings → Developers → Revoke + Create new token
2. GitHub → Settings → Secrets → Actions → update `BUFFER_API_KEY`

**Alpha Vantage:**
1. alphavantage.co → Your account → API Key
2. Update `ALPHA_VANTAGE_KEY` in GitHub Secrets

**Finnhub:**
1. finnhub.io → Dashboard → API Key
2. Update `FINNHUB_KEY` in GitHub Secrets

**Supabase:**
1. supabase.com → Project Settings → API → Service Role Key
2. Update `SUPABASE_SERVICE_ROLE_KEY` in both Vercel and GitHub Secrets

After rotating any key: trigger a dry-run to confirm it works before the next scheduled post.

---

## Failure codes in Supabase

Keys in `posted_tweet_events` with `:failed` suffix contain the error:

| Key pattern | Meaning |
|-------------|---------|
| `mode:dcf:2026-06-29` | DCF mode posted successfully on June 29 |
| `mode:dcf:2026-06-29:failed` | DCF mode failed on June 29 (check `tweet_text` for error) |
| `earnings_results:AAPL:2026-06-29` | AAPL earnings result posted |
| `economic_results:CPI:2026-06-29` | CPI result posted |

The `tweet_text` column on failure rows contains: `FAILED at <timestamp>: <error message>`

---

## Architecture diagram

```
GitHub Actions (48 cron entries per x-post.yml)
    ↓  fires at exact scheduled time
Mode resolution (if/elif chain on HOUR:MIN:DOW)
    ↓  resolves to mode name
scripts/x-post.mjs
    ↓  startup: check all env vars
    ↓  dedup: check posted_tweet_events (skip if already ran today)
    ↓  holiday check: redirect intraday modes on NYSE holidays
    ↓  content generation (Yahoo Finance, Finnhub, AV, insic.app/api/financials)
    ↓  validatePost() — block empty/NaN/garbage
    ↓  Buffer API → Twitter/X or LinkedIn
    ↓  markPostedEvent() — write success to Supabase
    ↓  exit 0 (success) or exit 1 (failure → red run in GitHub)

Vercel cron (daily 10AM ART, weekdays)
    ↓  /api/cron/posting-health
    ↓  queries posted_tweet_events for today
    ↓  if missing sentinel modes or failures exist → send alert email
```

---

## How alert emails work

A Vercel cron fires daily at **13:00 UTC (10:00 ART)** on weekdays, calling `/api/cron/posting-health`.

It checks whether sentinel modes (`morning_brief`, `dcf`, `macro`, `market_close`) posted today.

If any are missing or there are `:failed` rows, it sends an email to `marcioherlein@gmail.com` with:
- How many posted vs failed
- Which modes are missing
- Error messages from failures
- What to do next

**You should not need to manually check** — if nothing goes out by 10AM, you get an email.

---

## What to do before trusting it

1. Run the Supabase migration: `supabase/migrations/20260629_post_queue.sql`
2. Verify GitHub Secrets all exist: `BUFFER_API_KEY`, `BUFFER_CHANNEL_ID`, `LINKEDIN_CHANNEL_ID`, `ALPHA_VANTAGE_KEY`, `FINNHUB_KEY`, `AUTOMATION_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
3. Trigger a dry-run: GitHub Actions → X Auto-Post → Run workflow → `dcf` → `dry_run: true`
4. Trigger a live run: same, `dry_run: false`
5. Check `posted_tweet_events` in Supabase — confirm a row with `mode:dcf:TODAY` was written
6. Check `https://insic.app/api/admin/posting-status` — confirm count shows 1+
7. Wait until next morning — confirm the health check fires at 10AM (Vercel logs)
