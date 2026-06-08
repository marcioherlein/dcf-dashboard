-- Migration: paywall security hardening
-- Run in the Supabase SQL editor or via: supabase db push

-- ─── 1. valuations: enable RLS ────────────────────────────────────────────────
-- The anon key is exposed in the client bundle (NEXT_PUBLIC_*).
-- Without RLS, anyone with the anon key can INSERT/SELECT unlimited rows,
-- bypassing the FREE_SAVE_LIMIT=3 check in /api/valuations entirely.

alter table if exists valuations enable row level security;

-- Drop any existing policies first (idempotent re-run safety)
drop policy if exists "Users manage own valuations" on valuations;

-- Users can only read and write their own rows.
-- user_id is stored as text (UUID string) matching auth.uid()::text
create policy "Users manage own valuations"
  on valuations
  for all
  using  (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);


-- ─── 2. stock_views: add month_start column + unique constraint ───────────────
-- The route inserts { user_id, ticker, month_start } and relies on a unique
-- constraint to make the insert atomic (ON CONFLICT = already viewed this month).
-- Without this constraint the TOCTOU race allows concurrent requests to each
-- read count=2, pass the limit check, and both insert — exceeding FREE_LIMIT=3.

-- Add month_start column if it doesn't exist yet
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'stock_views' and column_name = 'month_start'
  ) then
    alter table stock_views add column month_start timestamptz;

    -- Back-fill existing rows: derive month_start from first_viewed_at
    update stock_views
    set month_start = date_trunc('month', first_viewed_at)
    where month_start is null;

    -- Make it non-nullable after back-fill
    alter table stock_views alter column month_start set not null;
    alter table stock_views alter column month_start set default date_trunc('month', now());
  end if;
end $$;

-- Add unique constraint that enforces one row per (user, ticker, month)
-- This is the atomic lock the application code relies on for race-safety.
alter table stock_views
  drop constraint if exists stock_views_user_ticker_month_unique;

alter table stock_views
  add constraint stock_views_user_ticker_month_unique
  unique (user_id, ticker, month_start);


-- ─── 3. promo_redemptions: track who redeemed which code ─────────────────────
-- Prevents a single promo code from being reused across unlimited accounts
-- and allows per-user redemption deduplication.

create table if not exists promo_redemptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  promo_code_id  uuid not null references promo_codes(id) on delete cascade,
  redeemed_at    timestamptz not null default now(),
  -- One redemption per user (across all codes)
  unique (user_id)
);

alter table if exists promo_redemptions enable row level security;

drop policy if exists "Users read own redemptions" on promo_redemptions;
create policy "Users read own redemptions"
  on promo_redemptions
  for select
  using (user_id = auth.uid());

-- Add uses_count + max_uses to promo_codes if not present
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'promo_codes' and column_name = 'uses_count'
  ) then
    alter table promo_codes add column uses_count integer not null default 0;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'promo_codes' and column_name = 'max_uses'
  ) then
    alter table promo_codes add column max_uses integer;
  end if;
end $$;
