-- Migration: paywall security hardening
-- Run in the Supabase SQL editor or via: supabase db push
-- Casts both sides of every comparison to text to avoid uuid vs text mismatches.

-- ─── 1. valuations: enable RLS ────────────────────────────────────────────────

alter table if exists valuations enable row level security;

drop policy if exists "Users manage own valuations" on valuations;

create policy "Users manage own valuations"
  on valuations
  for all
  using  (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);


-- ─── 2. stock_views: add month_start column + unique constraint ───────────────

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'stock_views' and column_name = 'month_start'
  ) then
    alter table stock_views add column month_start timestamptz;

    update stock_views
    set month_start = date_trunc('month', first_viewed_at)
    where month_start is null;

    alter table stock_views alter column month_start set not null;
    alter table stock_views alter column month_start set default date_trunc('month', now());
  end if;
end $$;

alter table stock_views
  drop constraint if exists stock_views_user_ticker_month_unique;

alter table stock_views
  add constraint stock_views_user_ticker_month_unique
  unique (user_id, ticker, month_start);


-- ─── 3. promo_redemptions ─────────────────────────────────────────────────────
-- user_id and promo_code_id stored as text to avoid type mismatch with
-- whatever types promo_codes.id and users.id actually use.

create table if not exists promo_redemptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  promo_code_id  text not null,
  redeemed_at    timestamptz not null default now(),
  unique (user_id)
);

alter table if exists promo_redemptions enable row level security;

drop policy if exists "Users read own redemptions" on promo_redemptions;
create policy "Users read own redemptions"
  on promo_redemptions
  for select
  using (user_id::text = auth.uid()::text);


-- ─── 4. promo_codes: add uses_count + max_uses if not present ─────────────────

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
