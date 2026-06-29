CREATE TABLE IF NOT EXISTS post_queue (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform          text        NOT NULL CHECK (platform IN ('x', 'linkedin')),
  mode              text        NOT NULL,
  ticker            text,
  scheduled_for     timestamptz NOT NULL,
  timezone_label    text        NOT NULL DEFAULT 'UTC',
  status            text        NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','queued','running','posted','failed','skipped','cancelled')),
  content           text,
  media_url         text,
  attempts          int         NOT NULL DEFAULT 0,
  max_attempts      int         NOT NULL DEFAULT 3,
  next_attempt_at   timestamptz,
  last_attempt_at   timestamptz,
  posted_at         timestamptz,
  provider          text        NOT NULL DEFAULT 'buffer',
  provider_post_id  text,
  provider_response jsonb,
  error_code        text,
  error_message     text,
  idempotency_key   text        NOT NULL UNIQUE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_queue_due
  ON post_queue (scheduled_for, status)
  WHERE status IN ('scheduled','queued','failed');

CREATE INDEX IF NOT EXISTS idx_post_queue_platform
  ON post_queue (platform, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_post_queue_stuck
  ON post_queue (status, last_attempt_at)
  WHERE status = 'running';

CREATE OR REPLACE FUNCTION update_post_queue_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_post_queue_updated_at ON post_queue;
CREATE TRIGGER trg_post_queue_updated_at
  BEFORE UPDATE ON post_queue
  FOR EACH ROW EXECUTE FUNCTION update_post_queue_updated_at();

CREATE OR REPLACE FUNCTION claim_post(p_idempotency_key text, p_worker_id text)
RETURNS SETOF post_queue LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT id FROM post_queue
    WHERE (status IN ('scheduled','queued')
      OR (status = 'failed' AND attempts < max_attempts AND next_attempt_at <= now()))
    AND scheduled_for <= now()
    AND (p_idempotency_key IS NULL OR idempotency_key = p_idempotency_key)
    ORDER BY scheduled_for LIMIT 1 FOR UPDATE SKIP LOCKED
  )
  UPDATE post_queue pq
  SET status='running', last_attempt_at=now(), attempts=attempts+1, updated_at=now()
  FROM candidate WHERE pq.id=candidate.id RETURNING pq.*;
END; $$;

CREATE OR REPLACE FUNCTION mark_posted(p_id uuid, p_provider_post_id text, p_provider_response jsonb)
RETURNS SETOF post_queue LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY UPDATE post_queue
  SET status='posted', posted_at=now(), provider_post_id=p_provider_post_id,
      provider_response=p_provider_response, error_code=NULL, error_message=NULL, updated_at=now()
  WHERE id=p_id RETURNING *;
END; $$;

CREATE OR REPLACE FUNCTION mark_failed(p_id uuid, p_error_code text, p_error_message text, p_retryable bool, p_next_attempt_at timestamptz)
RETURNS SETOF post_queue LANGUAGE plpgsql AS $$
DECLARE v_attempts int; v_max int;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max FROM post_queue WHERE id=p_id;
  IF p_retryable AND v_attempts < v_max THEN
    RETURN QUERY UPDATE post_queue
    SET status='failed', error_code=p_error_code, error_message=p_error_message,
        next_attempt_at=p_next_attempt_at, updated_at=now()
    WHERE id=p_id RETURNING *;
  ELSE
    RETURN QUERY UPDATE post_queue
    SET status='cancelled', error_code=p_error_code, error_message=p_error_message,
        next_attempt_at=NULL, updated_at=now()
    WHERE id=p_id RETURNING *;
  END IF;
END; $$;

CREATE OR REPLACE VIEW stuck_jobs AS
  SELECT * FROM post_queue
  WHERE status='running' AND last_attempt_at < now() - INTERVAL '30 minutes';
