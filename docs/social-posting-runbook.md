# Social Posting System — Runbook

## How the system works

Every scheduled tweet and LinkedIn post follows this path:

```
GitHub Actions cron (explicit schedule entry)
  → x-post.yml or li-post.yml workflow
    → mode resolution (HOUR:MIN:DOW → mode name)
      → node scripts/x-post.mjs MODE=<mode>
        → startup validation (env vars, format check)
          → post_queue upsert (idempotent, atomic claim)
            → content generation (Yahoo Finance, Alpha Vantage, Finnhub, /api/financials)
              → validatePost() (blocks NaN, blanks, bad prices)
                → Buffer GraphQL API → Twitter/X or LinkedIn
                  → post_queue status → posted
                    → posted_tweet_events backcompat write
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
| `app/api/admin/replay-posts/route.ts` | Safe replay endpoint |
| `app/api/admin/posting-selftest/route.ts` | Self-test endpoint |
| `supabase/migrations/20260629_post_queue.sql` | Durable queue schema |

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

## Queue system (Phase 1)

### How the post_queue table works

The `post_queue` table is the authoritative record of every post the system should send. It replaces the old `posted_tweet_events` dedup-only approach with a full lifecycle: scheduling, claiming, execution, success, failure, and retry.

Each row represents one post attempt for a given mode on a given date. The key concept is that a row's `idempotency_key` is globally unique per mode per day — so you can safely insert the same row multiple times and get exactly one post.

**Columns:**
| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `idempotency_key` | text unique | e.g. `mode:morning_brief:2026-06-29` |
| `mode` | text | Post mode name |
| `platform` | text | `twitter` or `linkedin` |
| `scheduled_for` | timestamptz | When the post should fire |
| `status` | text | Current lifecycle status |
| `attempt_count` | int | How many times we have tried |
| `max_attempts` | int | Hard cap (default 3) |
| `error_code` | text | Last error code if failed |
| `error_message` | text | Last error detail |
| `next_retry_at` | timestamptz | When to retry (null if not retryable) |
| `posted_at` | timestamptz | When the post was confirmed sent |
| `buffer_post_id` | text | Buffer's returned post ID |
| `created_at` | timestamptz | Row creation time |
| `updated_at` | timestamptz | Last update time |

### How idempotency keys prevent duplicates

Before posting, the script does:
```sql
INSERT INTO post_queue (idempotency_key, mode, platform, scheduled_for, status)
VALUES ($1, $2, $3, $4, 'queued')
ON CONFLICT (idempotency_key) DO NOTHING;
```

If the same mode fires twice (e.g. GitHub cron double-fires, or you run manually while scheduled run is in flight), only the first insert succeeds. The second runner sees the existing row and either claims it or backs off, depending on status. This means you can never get two posts for the same mode on the same day from the queue path.

### How atomic claiming prevents race conditions

When a runner picks up a queued row, it uses an atomic update:
```sql
UPDATE post_queue
SET status = 'running', updated_at = NOW()
WHERE idempotency_key = $1
  AND status IN ('queued', 'scheduled')
RETURNING id;
```

If the UPDATE returns zero rows, another runner already claimed it and this runner exits cleanly. This prevents two simultaneous GitHub Actions jobs from both posting the same mode.

### What each status means

| Status | Meaning |
|--------|---------|
| `scheduled` | Row exists, not yet time to run |
| `queued` | Ready to run, waiting for a runner to claim it |
| `running` | A runner has claimed it and is actively posting |
| `posted` | Successfully sent to Buffer and confirmed |
| `failed` | Last attempt failed; `next_retry_at` is set if retryable |
| `skipped` | Post skipped intentionally (holiday redirect, dry-run, dedup match in legacy path) |
| `cancelled` | Max attempts reached, moved to dead letter — will never retry |

### How retries work

On failure, the script sets `status = 'failed'`, increments `attempt_count`, stores the `error_code` and `error_message`, and sets `next_retry_at` based on the error type (see the error code table below).

At `next_retry_at`, the next scheduled GitHub Actions run that overlaps the time window will pick up the row (status `failed`, `next_retry_at <= NOW()`) and attempt again.

When `attempt_count` reaches `max_attempts`, the row transitions to `status = 'cancelled'` (dead letter). No further retries happen. An alert is sent.

### How dead-letter works

A row becomes `cancelled` when:
- `attempt_count >= max_attempts` (default 3), OR
- The error code is non-retryable (see error code table)

Dead-letter rows stay in the table permanently. To inspect them:
```sql
SELECT idempotency_key, error_code, error_message, attempt_count, updated_at
FROM post_queue
WHERE status = 'cancelled'
ORDER BY updated_at DESC;
```

To manually replay a cancelled post, you must reset the row and delete the dedup event (see the Replay section).

### How catchup/backfill works (4-hour window)

GitHub Actions crons can fire up to 30 minutes late. To handle this, each runner checks whether a scheduled post for the past 4 hours is still in `queued` or `failed` (retryable) state. If it finds one and the time window is within 4 hours of `scheduled_for`, it claims and posts it.

This means a post scheduled for 09:00 that didn't fire until 09:45 will still post. A post scheduled for 09:00 that wasn't picked up until 13:30 will be skipped (outside the 4-hour window) and marked `skipped` with `error_code = 'WINDOW_EXPIRED'`.

---

## How retries work

| Code | Meaning | Retryable | Retry delay |
|------|---------|-----------|-------------|
| `AUTH_FAILED` | Buffer auth token rejected | No | — |
| `RATE_LIMITED` | Buffer rate limit hit | Yes | 1 hour |
| `PROVIDER_ERROR` | Buffer 5xx error | Yes | 5 / 10 / 20 min exponential backoff |
| `NETWORK_TIMEOUT` | Network request timed out | Yes | 5 min |
| `DUPLICATE_POST` | Buffer rejected as duplicate content | No (treated as success) | — |
| `CONTENT_INVALID` | Post too long or failed validatePost() | No | — |
| `CONFIG_MISSING` | Required env var absent | No | — |
| `CHANNEL_INVALID` | Buffer channel disconnected or invalid ID | No | — |
| `CONTENT_GENERATION_FAILED` | APIs returned no usable data | Yes | 15 min |
| `WINDOW_EXPIRED` | Catchup window (4 hours) passed | No | — |
| `UNKNOWN` | Unexpected error | Yes | 5 min |

Non-retryable failures immediately set `status = 'cancelled'`. Retryable failures set `status = 'failed'` and `next_retry_at` based on the delay column. After `max_attempts`, any failure transitions to `cancelled`.

---

## Queue state queries

Run these in the Supabase SQL editor (supabase.com → project → SQL editor).

**Today's queue summary:**
```sql
SELECT status, COUNT(*) as count
FROM post_queue
WHERE scheduled_for >= CURRENT_DATE
  AND scheduled_for < CURRENT_DATE + INTERVAL '1 day'
GROUP BY status
ORDER BY status;
```

**Today's full status per mode:**
```sql
SELECT mode, platform, status, attempt_count, error_code, error_message, posted_at, next_retry_at
FROM post_queue
WHERE scheduled_for >= CURRENT_DATE
  AND scheduled_for < CURRENT_DATE + INTERVAL '1 day'
ORDER BY scheduled_for;
```

**Stuck running jobs (running for more than 15 minutes — likely a crashed runner):**
```sql
SELECT idempotency_key, mode, updated_at, attempt_count
FROM post_queue
WHERE status = 'running'
  AND updated_at < NOW() - INTERVAL '15 minutes';
```
If you see rows here, the runner died mid-execution. Reset them:
```sql
UPDATE post_queue
SET status = 'queued', updated_at = NOW()
WHERE status = 'running'
  AND updated_at < NOW() - INTERVAL '15 minutes';
```

**Failed posts with errors:**
```sql
SELECT idempotency_key, mode, platform, error_code, error_message, attempt_count, next_retry_at
FROM post_queue
WHERE status = 'failed'
ORDER BY updated_at DESC;
```

**Permanently failed (dead letter / cancelled):**
```sql
SELECT idempotency_key, mode, platform, error_code, error_message, attempt_count, updated_at
FROM post_queue
WHERE status = 'cancelled'
ORDER BY updated_at DESC;
```

**Posts about to be retried in the next hour:**
```sql
SELECT idempotency_key, mode, platform, error_code, attempt_count, next_retry_at
FROM post_queue
WHERE status = 'failed'
  AND next_retry_at IS NOT NULL
  AND next_retry_at <= NOW() + INTERVAL '1 hour'
ORDER BY next_retry_at;
```

**Legacy: today's posted_tweet_events (backcompat table):**
```sql
SELECT event_key, tweet_type, posted_at
FROM posted_tweet_events
WHERE posted_at >= CURRENT_DATE
ORDER BY posted_at DESC;
```

**Legacy: today's failures:**
```sql
SELECT event_key, tweet_text as error, posted_at
FROM posted_tweet_events
WHERE posted_at >= CURRENT_DATE
  AND event_key LIKE '%:failed';
```

---

## How to check today's status

**Status API** (requires admin login):
```
GET https://insic.app/api/admin/posting-status
```
Returns: posted count, failed count, cancelled count, last successful post per platform, failure details, queue summary.

**Check GitHub Actions runs:**
1. Go to github.com/marcioherlein/dcf-dashboard/actions
2. Filter by workflow "X Auto-Post" or "LinkedIn Auto-Post"
3. Red runs = failures. Click the run, check the "Resolve mode" and "Post to X/LinkedIn" steps.

**Health check endpoint:**
```
GET https://insic.app/api/cron/posting-health
Authorization: Bearer <CRON_SECRET>
```
Returns: healthy/degraded status, counts, failures, whether alert was sent.

---

## Healthy system definition

The system is healthy when `GET /api/admin/posting-status` returns all of the following:

| Field | Healthy value |
|-------|--------------|
| `status` | `"healthy"` |
| `twitter.posted_today` | >= 15 (weekday by 5PM ART), >= 4 (weekend) |
| `linkedin.posted_today` | >= 4 (weekday by 5PM ART), >= 1 (weekend) |
| `twitter.failed_today` | `0` |
| `linkedin.failed_today` | `0` |
| `queue.cancelled` | `0` (or unchanged from yesterday) |
| `queue.running_stuck` | `0` |
| `sentinel_modes` | all present: `morning_brief`, `dcf`, `macro`, `market_close` |

Additionally:
- GitHub Actions: all scheduled runs for today are green
- Health check endpoint: `{ "status": "healthy" }`
- No `:failed` rows in `posted_tweet_events`
- No rows in `post_queue` with `status = 'running'` older than 15 minutes

On a weekend, the sentinel mode check applies only to weekend modes (`sentiment`, `sector_scan`, `etf_pulse`).

---

## How to replay safely

### 1. Check idempotency first

Before replaying, confirm the current state of the row:
```sql
SELECT idempotency_key, status, attempt_count, error_code, posted_at
FROM post_queue
WHERE idempotency_key = 'mode:morning_brief:2026-06-29';
```

- `status = 'posted'` → already sent. Do not replay unless you need a duplicate (unusual).
- `status = 'cancelled'` → dead letter. See below to reset.
- `status = 'failed'` → pending retry. You can wait for auto-retry or force now.
- Row missing → post was never attempted. Call replay endpoint.

### 2. Use the replay API

```
POST https://insic.app/api/admin/replay-posts
Authorization: Bearer <AUTOMATION_API_KEY>
Content-Type: application/json

{
  "mode": "morning_brief",
  "date": "2026-06-29",
  "platform": "twitter",
  "dry_run": false
}
```

The endpoint:
1. Looks up the existing `post_queue` row for that `idempotency_key`
2. If `status = 'posted'` — returns 409 with message "already posted"
3. If `status = 'cancelled'` — resets to `queued`, clears `error_code`, resets `attempt_count` to 0
4. If `status = 'failed'` — resets to `queued`, clears `next_retry_at`
5. If missing — inserts a new `queued` row
6. Runs the post immediately in the same request (not via cron)
7. Returns the result including the new `status` and `buffer_post_id`

### 3. Verify no duplicates

After the replay completes:
```sql
SELECT idempotency_key, status, posted_at, buffer_post_id
FROM post_queue
WHERE idempotency_key = 'mode:morning_brief:2026-06-29';
```
Confirm `status = 'posted'` and `buffer_post_id` is set. There should be exactly one row for this key.

### Replay via GitHub Actions (alternative)

If you prefer the GitHub Actions path:
1. Actions → X Auto-Post → Run workflow
2. Select the mode
3. Set `dry_run: false`
4. Run

To force a replay when the queue row already has `status = 'posted'`, reset it first:
```sql
UPDATE post_queue
SET status = 'queued', attempt_count = 0, error_code = NULL, error_message = NULL, next_retry_at = NULL, posted_at = NULL, buffer_post_id = NULL, updated_at = NOW()
WHERE idempotency_key = 'mode:morning_brief:2026-06-29';
```
Also delete the legacy dedup row if it exists:
```sql
DELETE FROM posted_tweet_events
WHERE event_key = 'mode:morning_brief:2026-06-29';
```

### Replay via local script (if you have local setup)

```bash
MODE=morning_brief DRY_RUN=false node scripts/x-post.mjs
```
This uses the same script but requires all env vars set locally. Use this only when GitHub Actions is unavailable.

---

## What to do if zero posts by 10AM

1. **Check the status API**: `https://insic.app/api/admin/posting-status`
2. **Check GitHub Actions**: Actions → X Auto-Post → look for recent runs
   - No runs? → GitHub cron delayed or skipped. Fire manually (step 4).
   - Red runs? → Click the run, check "Resolve mode" and "Post to X" steps.
3. **Common errors and fixes:**

| Error | Cause | Fix |
|-------|-------|-----|
| `STARTUP FAILURE: missing required env vars` | Secret deleted from GitHub | Re-add secret in Settings → Secrets → Actions |
| `Buffer post failed: Access token is not valid` | Buffer API key expired | Rotate BUFFER_API_KEY (see key rotation section) |
| `LINKEDIN_CHANNEL_ID not configured` | Secret missing | Add `LINKEDIN_CHANNEL_ID` to GH secrets |
| `Dedup check failed (Supabase unreachable)` | Supabase down | See Supabase down section |
| `Already posted (key: mode:X:YYYY-MM-DD)` | Mode ran twice | Not a problem — working as intended |
| `No matching mode for UTC HH:MM DOW=N` | Mode resolution gap | Check the `if/elif` chain in x-post.yml |
| `WINDOW_EXPIRED` | Catchup window passed | Post is skipped for today, post manually if needed |

4. **Manually fire missed posts:**
   - Actions → X Auto-Post → Run workflow
   - Select the mode (e.g. `morning_brief`)
   - Set `dry_run: false`
   - Click Run workflow

---

## What to do when Buffer is down

Buffer outages are rare but possible. Signs:
- GitHub Actions runs succeed but no posts appear on X or LinkedIn
- Buffer API returns 5xx → `error_code = 'PROVIDER_ERROR'` in post_queue
- buffer.com status page shows incident

**Recovery steps:**

1. Check buffer.com/status for active incidents.
2. Check `post_queue` for `PROVIDER_ERROR` rows:
   ```sql
   SELECT idempotency_key, mode, attempt_count, next_retry_at
   FROM post_queue
   WHERE error_code = 'PROVIDER_ERROR'
     AND scheduled_for >= CURRENT_DATE;
   ```
3. If Buffer is back up, the auto-retry system will pick up `failed` rows at `next_retry_at`. No action needed if attempts remain.
4. If rows have reached `status = 'cancelled'` (exhausted retries during the outage):
   - Reset them via the replay API: `POST /api/admin/replay-posts` for each mode
   - Or reset in bulk:
     ```sql
     UPDATE post_queue
     SET status = 'queued', attempt_count = 0, error_code = NULL, error_message = NULL, next_retry_at = NULL, updated_at = NOW()
     WHERE error_code = 'PROVIDER_ERROR'
       AND status = 'cancelled'
       AND scheduled_for >= CURRENT_DATE;
     ```
   - Then trigger a GitHub Actions run to pick up the queued rows.
5. After recovery, run the self-test endpoint to confirm Buffer auth is working:
   ```
   POST https://insic.app/api/admin/posting-selftest
   Authorization: Bearer <AUTOMATION_API_KEY>
   ```

**What Buffer does and does not affect:**
- Buffer down → posts do not go out, but all row states are preserved in Supabase. No data loss.
- Buffer down → health check still fires and sends alert email.
- Buffer down → status API still works.

---

## What to do when GitHub Actions didn't fire

Signs that GitHub Actions missed a scheduled run:
- No run appears in the Actions tab for the expected time
- Status API shows zero posts and no failures (nothing was attempted)
- No queue rows with `status = 'running'` or `status = 'posted'` for today

**How to check:**
1. Go to github.com/marcioherlein/dcf-dashboard/actions
2. Filter by "X Auto-Post" or "LinkedIn Auto-Post"
3. Look at "Scheduled" runs for today. GitHub sometimes delays crons by up to 30 minutes under high load. Crons on inactive repos may not fire if the repo has had no push in 60 days — push a commit if that is the case.

**How to manually trigger:**
1. Actions → X Auto-Post → "Run workflow"
2. Select the missed mode from the dropdown
3. Set `dry_run: false`
4. Click Run workflow
5. Watch the run complete (green = success)
6. Verify in Supabase: `SELECT * FROM post_queue WHERE idempotency_key = 'mode:<mode>:<today>'`

**How to verify catchup works:**
The 4-hour catchup window means if a cron fires late but within 4 hours, it will find the `queued` row (created at scheduled time) and post it. To confirm this happened, look at the queue row's `updated_at` vs `scheduled_for`:
```sql
SELECT idempotency_key, scheduled_for, updated_at, status, posted_at
FROM post_queue
WHERE scheduled_for >= CURRENT_DATE
  AND status = 'posted'
ORDER BY scheduled_for;
```
If `updated_at` is significantly after `scheduled_for` (but within 4 hours), catchup fired successfully.

**If the missed run is outside the 4-hour window:**
The queue row will have `status = 'skipped'` with `error_code = 'WINDOW_EXPIRED'`. The post is permanently skipped for that scheduled time. Manually fire a replay via the GitHub Actions UI or the replay API if the content is still relevant.

---

## What to do when Supabase is down

**Graceful degradation — what still works:**
- GitHub Actions will still attempt to fire the posting script
- The script will log a warning that Supabase is unreachable
- If Supabase is unreachable, the dedup check fails open — the script will proceed and attempt to post
- Buffer will receive the post request and post to X/LinkedIn if the content is valid
- The queue row write will fail silently and be retried when Supabase recovers

**What does not work when Supabase is down:**
- Queue row status updates (rows stay in old state)
- Dedup protection (may get duplicate posts if mode fires twice)
- Health check endpoint (returns degraded status, not healthy)
- Status API (returns error or stale data)
- Alert email (health check cannot query the database)

**Recovery steps:**
1. Wait for Supabase to recover (check supabase.com/status for incidents).
2. After recovery, check for inconsistent queue state:
   ```sql
   -- Rows stuck in 'running' from crashed scripts during the outage
   SELECT idempotency_key, mode, updated_at
   FROM post_queue
   WHERE status = 'running'
     AND updated_at < NOW() - INTERVAL '15 minutes';
   ```
3. Reset stuck running rows:
   ```sql
   UPDATE post_queue
   SET status = 'queued', updated_at = NOW()
   WHERE status = 'running'
     AND updated_at < NOW() - INTERVAL '15 minutes';
   ```
4. Check for missed posts that need to be replayed:
   ```sql
   SELECT idempotency_key, mode, scheduled_for, status
   FROM post_queue
   WHERE scheduled_for >= CURRENT_DATE - INTERVAL '1 day'
     AND status NOT IN ('posted', 'skipped', 'cancelled');
   ```
5. If important modes are unposted and within the 4-hour window, they will auto-retry. Otherwise use the replay API.

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

## External monitoring

### UptimeRobot setup

| Monitor | URL | Type | Interval | Header | Alert on |
|---------|-----|------|----------|--------|----------|
| Posting health | `https://insic.app/api/cron/posting-health` | HTTP keyword | 30 min | `Authorization: Bearer <CRON_SECRET>` | Status not 200, or body does not contain `"healthy"` |
| Status API | `https://insic.app/api/admin/posting-status` | HTTP keyword | 5 min | `Authorization: Bearer <ADMIN_STATUS_KEY>` | Status not 200, or body does not contain `"healthy"` |
| App homepage | `https://insic.app` | HTTP | 5 min | — | Status not 200 |

For each monitor, configure the keyword check to alert when `"healthy"` is **not found** in the response body. This catches cases where the HTTP status is 200 but the system is degraded.

### What it monitors

- **Posting health endpoint** — confirms daily posting ran and sentinel modes are present. Returns `{ "status": "healthy" }` or `{ "status": "degraded", "reason": "..." }`.
- **Status API** — confirms the admin API layer and Supabase connection are both up.
- **App homepage** — confirms Vercel deployment is live.

### How to check UptimeRobot

1. Go to uptimerobot.com → Dashboard
2. Check for any monitors in "Down" or "Seems Down" state
3. Click a monitor to see historical uptime and recent incidents
4. Alert contacts should include `marcioherlein@gmail.com`

If UptimeRobot is not yet configured, set it up at uptimerobot.com (free tier supports up to 50 monitors at 5-minute intervals). Add a new monitor for each row in the table above.

---

## Self-test

### How to run

```
POST https://insic.app/api/admin/posting-selftest
Authorization: Bearer <AUTOMATION_API_KEY>
Content-Type: application/json

{}
```

Or with dry_run mode to avoid sending live posts:
```json
{ "dry_run": true }
```

### What each check means

The self-test runs a series of checks and returns a report:

| Check | What it tests | Pass condition |
|-------|--------------|----------------|
| `supabase_connection` | Can connect to Supabase and query | Returns rows without error |
| `post_queue_table` | post_queue table exists and is queryable | No SQL error on SELECT |
| `buffer_auth` | Buffer API key is valid | GraphQL auth check returns 200 |
| `twitter_channel` | BUFFER_CHANNEL_ID resolves to X channel | Channel object returned by Buffer |
| `linkedin_channel` | LINKEDIN_CHANNEL_ID resolves to LinkedIn channel | Channel object returned by Buffer |
| `alpha_vantage` | Alpha Vantage API key is valid | Returns non-empty data |
| `finnhub` | Finnhub API key is valid | Returns non-empty data |
| `env_vars` | All required env vars are present | No missing keys in list |
| `content_generation` | Can generate post content for a test mode | validatePost() passes on generated content |
| `dry_run_post` | Full end-to-end dry run | Returns DRY RUN output without error |

### How to interpret results

```json
{
  "overall": "pass",
  "checks": {
    "supabase_connection": { "status": "pass", "detail": "Connected, 3 rows today" },
    "buffer_auth": { "status": "pass", "detail": "Auth valid" },
    "twitter_channel": { "status": "pass", "detail": "Channel: @insicapp" },
    "linkedin_channel": { "status": "fail", "detail": "Channel not found for ID: abc123" },
    ...
  }
}
```

- `overall: "pass"` — all checks passed, system is ready to post
- `overall: "fail"` — one or more checks failed; look at `checks` to find the failing check
- Any check with `status: "fail"` should be fixed before the next scheduled post
- A `buffer_auth` failure → rotate BUFFER_API_KEY immediately
- A `linkedin_channel` or `twitter_channel` failure → reconnect in Buffer and update GH secrets
- A `supabase_connection` failure → Supabase may be down or service role key is wrong

Run the self-test after:
- Rotating any API key
- Reconnecting Buffer channels
- Deploying a new version of x-post.mjs
- Any incident resolution

---

## Failure codes in Supabase

**post_queue table** — `error_code` and `error_message` columns contain the failure detail. See the error code table in the "How retries work" section above.

**posted_tweet_events table** (legacy backcompat) — keys with `:failed` suffix:

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
    ↓  post_queue upsert (ON CONFLICT DO NOTHING) → atomic claim via UPDATE
    ↓  catchup check: find queued/failed rows within 4-hour window
    ↓  holiday check: redirect intraday modes on NYSE holidays
    ↓  content generation (Yahoo Finance, Finnhub, AV, insic.app/api/financials)
    ↓  validatePost() — block empty/NaN/garbage
    ↓  Buffer API → Twitter/X or LinkedIn
    ↓  post_queue status → posted (buffer_post_id saved)
    ↓  posted_tweet_events backcompat write
    ↓  exit 0 (success) or exit 1 (failure → red run in GitHub)

Vercel cron (daily 10AM ART, weekdays)
    ↓  /api/cron/posting-health
    ↓  queries post_queue and posted_tweet_events for today
    ↓  if missing sentinel modes or failures/cancelled exist → send alert email
    ↓  UptimeRobot monitors this endpoint every 30 min
```

---

## How alert emails work

A Vercel cron fires daily at **13:00 UTC (10:00 ART)** on weekdays, calling `/api/cron/posting-health`.

It checks whether sentinel modes (`morning_brief`, `dcf`, `macro`, `market_close`) posted today.

If any are missing or there are `:failed` rows or `cancelled` queue rows, it sends an email to `marcioherlein@gmail.com` with:
- How many posted vs failed vs cancelled
- Which modes are missing
- Error messages from failures
- What to do next

You should not need to manually check — if nothing goes out by 10AM, you get an email.

---

## What to do before trusting it

1. Run the Supabase migration: `supabase/migrations/20260629_post_queue.sql`
2. Verify all 8 GitHub Secrets exist: `BUFFER_API_KEY`, `BUFFER_CHANNEL_ID`, `LINKEDIN_CHANNEL_ID`, `ALPHA_VANTAGE_KEY`, `FINNHUB_KEY`, `AUTOMATION_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
3. Run the self-test endpoint: `POST https://insic.app/api/admin/posting-selftest` — confirm `overall: "pass"`
4. Trigger a dry-run: GitHub Actions → X Auto-Post → Run workflow → `dcf` → `dry_run: true`
5. Trigger a live run: same, `dry_run: false`
6. Check `post_queue` in Supabase — confirm a row with `status = 'posted'` and a `buffer_post_id`
7. Check `https://insic.app/api/admin/posting-status` — confirm count shows 1+
8. Configure UptimeRobot monitors (see External monitoring section)
9. Wait until next morning — confirm the health check fires at 10AM (Vercel logs) and no alert email arrives
