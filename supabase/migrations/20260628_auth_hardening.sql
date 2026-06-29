-- Migration: auth hardening — welcome email idempotency + OTP brute-force protection
-- Run in Supabase SQL editor or via: supabase db push

-- ── 1. users table: welcome email idempotency (BUG-04) ───────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;

-- ── 2. auth_tokens table: failed_attempts counter (BUG-11) ───────────────────
-- Add failed_attempts column if the table exists; no-op if column already present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'auth_tokens'
  ) THEN
    ALTER TABLE auth_tokens
      ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ── 3. Create auth_tokens if it does not yet exist ────────────────────────────
CREATE TABLE IF NOT EXISTS auth_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  token           text UNIQUE NOT NULL,
  type            text NOT NULL CHECK (type IN ('verify_email', 'reset_password')),
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  failed_attempts integer NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_tokens_email_type ON auth_tokens(email, type);
CREATE INDEX IF NOT EXISTS auth_tokens_token ON auth_tokens(token);

-- ── 4. users: ensure all required auth columns exist ─────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash      text,
  ADD COLUMN IF NOT EXISTS email_verified_at  timestamptz,
  ADD COLUMN IF NOT EXISTS auth_method        text DEFAULT 'google',
  ADD COLUMN IF NOT EXISTS terms_accepted_at  timestamptz;

-- ── 5. Cleanup: delete expired tokens older than 7 days (manual run or cron) ─
-- DELETE FROM auth_tokens WHERE expires_at < now() - interval '7 days';
