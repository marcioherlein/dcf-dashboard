-- post_queue: durable, retryable, observable social post queue
-- Replaces the stateless cron-fires-and-prays model with a persistent job queue.

CREATE TABLE IF NOT EXISTS post_queue (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mode            text        NOT NULL,
  platform        text        NOT NULL CHECK (platform IN ('x', 'linkedin')),
  ticker          text,
  scheduled_for   timestamptz NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','done','failed','skipped','cancelled')),
  attempts        int         NOT NULL DEFAULT 0,
  max_attempts    int         NOT NULL DEFAULT 3,
  next_attempt_at timestamptz,
  content_draft   text,
  posted_at       timestamptz,
  buffer_post_id  text,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Fast poll: find pending due posts
CREATE INDEX IF NOT EXISTS idx_post_queue_due
  ON post_queue (scheduled_for, status)
  WHERE status IN ('pending','running');

-- Admin queries: status by day
CREATE INDEX IF NOT EXISTS idx_post_queue_day_status
  ON post_queue (date_trunc('day', scheduled_for), status);

-- Observability: recent failures
CREATE INDEX IF NOT EXISTS idx_post_queue_failed
  ON post_queue (updated_at DESC)
  WHERE status = 'failed';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_post_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_queue_updated_at ON post_queue;
CREATE TRIGGER trg_post_queue_updated_at
  BEFORE UPDATE ON post_queue
  FOR EACH ROW EXECUTE FUNCTION update_post_queue_updated_at();

-- Atomic claim: prevents two workers posting same job
-- Returns the claimed row or null if already claimed
CREATE OR REPLACE FUNCTION claim_post_queue_item(p_id uuid)
RETURNS SETOF post_queue AS $$
BEGIN
  RETURN QUERY
  UPDATE post_queue
  SET status = 'running',
      attempts = attempts + 1,
      updated_at = now()
  WHERE id = p_id
    AND status = 'pending'
    AND (next_attempt_at IS NULL OR next_attempt_at <= now())
  RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- Unique constraint: only one pending/running row per mode+platform+day
-- Done/failed rows accumulate for audit — they don't block re-queueing
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_queue_unique_active
  ON post_queue (mode, platform, date_trunc('day', scheduled_for AT TIME ZONE 'UTC'))
  WHERE status IN ('pending', 'running');
