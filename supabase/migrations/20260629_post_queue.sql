-- post_queue: durable, retryable, observable social post queue
-- Replaces the stateless cron-fires-and-prays model with a persistent job queue.
-- Migration is idempotent: safe to run multiple times.

-- ---------------------------------------------------------------------------
-- 1. Drop legacy objects from previous iteration (no-op if they don't exist)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_post_queue_due;
DROP INDEX IF EXISTS idx_post_queue_day_status;
DROP INDEX IF EXISTS idx_post_queue_failed;
DROP INDEX IF EXISTS idx_post_queue_unique_active;
DROP TRIGGER IF EXISTS trg_post_queue_updated_at ON post_queue;
DROP FUNCTION IF EXISTS claim_post_queue_item(uuid);
DROP FUNCTION IF EXISTS update_post_queue_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_queue (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- scheduling
  platform          text        NOT NULL CHECK (platform IN ('x', 'linkedin')),
  mode              text        NOT NULL,
  ticker            text,
  scheduled_for     timestamptz NOT NULL,
  timezone_label    text        NOT NULL DEFAULT 'UTC',

  -- lifecycle
  status            text        NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','queued','running','posted','failed','skipped','cancelled')),

  -- content
  content           text,
  media_url         text,

  -- retry bookkeeping
  attempts          int         NOT NULL DEFAULT 0,
  max_attempts      int         NOT NULL DEFAULT 3,
  next_attempt_at   timestamptz,
  last_attempt_at   timestamptz,

  -- outcome
  posted_at         timestamptz,
  provider          text        NOT NULL DEFAULT 'buffer',
  provider_post_id  text,
  provider_response jsonb,

  -- error detail
  error_code        text,
  error_message     text,

  -- idempotency
  idempotency_key   text        NOT NULL UNIQUE,

  -- audit
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

-- Fast poll: due posts ready to be claimed
CREATE INDEX IF NOT EXISTS idx_post_queue_due
  ON post_queue (scheduled_for, status)
  WHERE status IN ('scheduled','queued','failed');

-- Platform + day queries (admin dashboards, daily caps)
CREATE INDEX IF NOT EXISTS idx_post_queue_platform_day
  ON post_queue (platform, date_trunc('day', scheduled_for));

-- Stuck-job detection: running jobs that have not progressed
CREATE INDEX IF NOT EXISTS idx_post_queue_stuck
  ON post_queue (status, last_attempt_at)
  WHERE status = 'running';

-- idempotency_key is already covered by the UNIQUE constraint above,
-- but an explicit named index makes intent clear and supports EXPLAIN output.
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_queue_idempotency
  ON post_queue (idempotency_key);

-- ---------------------------------------------------------------------------
-- 4. updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_post_queue_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_queue_updated_at ON post_queue;
CREATE TRIGGER trg_post_queue_updated_at
  BEFORE UPDATE ON post_queue
  FOR EACH ROW EXECUTE FUNCTION update_post_queue_updated_at();

-- ---------------------------------------------------------------------------
-- 5. claim_post — atomic worker claim, prevents double-processing
-- ---------------------------------------------------------------------------
-- Finds the first due post eligible for processing, marks it running, and
-- returns it. Returns no rows when nothing is claimable.
-- Race safety: FOR UPDATE SKIP LOCKED means concurrent workers never collide.
CREATE OR REPLACE FUNCTION claim_post(
  p_idempotency_key text,   -- idempotency key of a specific job (pass NULL to claim any due job)
  p_worker_id       text    -- opaque worker identifier for audit purposes (stored in error_message temporarily)
)
RETURNS SETOF post_queue
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT id
    FROM post_queue
    WHERE
      -- eligible statuses
      (
        status IN ('scheduled', 'queued')
        OR (
          status = 'failed'
          AND attempts < max_attempts
          AND next_attempt_at IS NOT NULL
          AND next_attempt_at <= now()
        )
      )
      -- past schedule time
      AND scheduled_for <= now()
      -- optional: target a specific job by idempotency key
      AND (p_idempotency_key IS NULL OR idempotency_key = p_idempotency_key)
    ORDER BY scheduled_for
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE post_queue pq
  SET
    status          = 'running',
    last_attempt_at = now(),
    attempts        = attempts + 1,
    updated_at      = now()
  FROM candidate
  WHERE pq.id = candidate.id
  RETURNING pq.*;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. mark_posted — record successful delivery
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_posted(
  p_id                 uuid,
  p_provider_post_id   text,
  p_provider_response  jsonb
)
RETURNS SETOF post_queue
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  UPDATE post_queue
  SET
    status              = 'posted',
    posted_at           = now(),
    provider_post_id    = p_provider_post_id,
    provider_response   = p_provider_response,
    error_code          = NULL,
    error_message       = NULL,
    updated_at          = now()
  WHERE id = p_id
  RETURNING *;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. mark_failed — record a delivery failure; retry or dead-letter
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_failed(
  p_id               uuid,
  p_error_code       text,
  p_error_message    text,
  p_retryable        bool,
  p_next_attempt_at  timestamptz   -- caller controls backoff schedule
)
RETURNS SETOF post_queue
LANGUAGE plpgsql AS $$
DECLARE
  v_attempts     int;
  v_max_attempts int;
BEGIN
  SELECT attempts, max_attempts
  INTO v_attempts, v_max_attempts
  FROM post_queue
  WHERE id = p_id;

  IF p_retryable AND v_attempts < v_max_attempts THEN
    RETURN QUERY
    UPDATE post_queue
    SET
      status          = 'failed',
      error_code      = p_error_code,
      error_message   = p_error_message,
      next_attempt_at = p_next_attempt_at,
      updated_at      = now()
    WHERE id = p_id
    RETURNING *;
  ELSE
    -- Permanent failure — move to dead letter (cancelled)
    RETURN QUERY
    UPDATE post_queue
    SET
      status          = 'cancelled',
      error_code      = p_error_code,
      error_message   = p_error_message,
      next_attempt_at = NULL,
      updated_at      = now()
    WHERE id = p_id
    RETURNING *;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Hardcoded weekly schedule table
--    Each row defines one post slot per week (day-of-week + time + platform).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_schedule (
  id           serial      PRIMARY KEY,
  platform     text        NOT NULL CHECK (platform IN ('x', 'linkedin')),
  mode         text        NOT NULL,
  ticker       text,
  -- 0=Sunday … 6=Saturday (ISO: 1=Monday … 7=Sunday)
  -- We use PostgreSQL's DOW: 0=Sunday, 1=Monday, …, 6=Saturday
  day_of_week  int         NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  post_time    time        NOT NULL,  -- local time in timezone_label
  timezone_label text      NOT NULL DEFAULT 'UTC',
  provider     text        NOT NULL DEFAULT 'buffer',
  max_attempts int         NOT NULL DEFAULT 3,
  enabled      bool        NOT NULL DEFAULT true
);

-- ---------------------------------------------------------------------------
-- 9. seed_queue_for_week — populate post_queue for a given Mon-Sun week
-- ---------------------------------------------------------------------------
-- p_week_start must be the Monday of the target week (any date is accepted;
-- the function normalises to the preceding Monday automatically).
CREATE OR REPLACE FUNCTION seed_queue_for_week(p_week_start date)
RETURNS int        -- number of rows inserted
LANGUAGE plpgsql AS $$
DECLARE
  v_monday     date;
  v_sched      RECORD;
  v_target_day date;
  v_sched_ts   timestamptz;
  v_idem_key   text;
  v_inserted   int := 0;
BEGIN
  -- Normalise to Monday (ISO week start)
  v_monday := date_trunc('week', p_week_start::timestamptz)::date;

  FOR v_sched IN
    SELECT * FROM post_schedule WHERE enabled = true
  LOOP
    -- Map PostgreSQL DOW (0=Sun) to ISO offset from Monday
    -- DOW 1=Mon→+0, 2=Tue→+1, …, 6=Sat→+5, 0=Sun→+6
    v_target_day := v_monday + CASE v_sched.day_of_week
                                 WHEN 0 THEN 6  -- Sunday
                                 ELSE v_sched.day_of_week - 1
                               END;

    v_sched_ts := (v_target_day::text || ' ' || v_sched.post_time::text)::timestamptz
                  AT TIME ZONE v_sched.timezone_label;

    -- Deterministic idempotency key: schedule_id + ISO day string
    v_idem_key := 'sched-' || v_sched.id::text || '-' || v_target_day::text;

    INSERT INTO post_queue (
      platform,
      mode,
      ticker,
      scheduled_for,
      timezone_label,
      status,
      provider,
      max_attempts,
      idempotency_key
    )
    VALUES (
      v_sched.platform,
      v_sched.mode,
      v_sched.ticker,
      v_sched_ts,
      v_sched.timezone_label,
      'scheduled',
      v_sched.provider,
      v_sched.max_attempts,
      v_idem_key
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    IF FOUND THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. stuck_jobs view — running jobs that have not progressed in 30 minutes
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS stuck_jobs;
CREATE VIEW stuck_jobs AS
  SELECT *
  FROM post_queue
  WHERE status = 'running'
    AND last_attempt_at < now() - INTERVAL '30 minutes';
