-- Migration: posted_tweet_events — prevents duplicate result tweets
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS posted_tweet_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key    text UNIQUE NOT NULL,
  tweet_type   text NOT NULL,
  ticker       text,
  event_date   date,
  tweet_text   text,
  posted_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_posted_tweet_events_key ON posted_tweet_events (event_key);

-- Examples of event_key values:
-- 'earnings_results:ADBE:2026-06-11'
-- 'economic_results:CPI:2026-06-10'
-- 'economic_results:NFP:2026-06-05'
