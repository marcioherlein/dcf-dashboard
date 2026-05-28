-- ETF Tracker: watchlist table
-- Run this in the Supabase SQL editor or via supabase db push

create table if not exists etf_watchlist (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  ticker        text not null,
  name          text,
  value_score   integer,
  expense_ratio numeric,
  yield         numeric,
  pe_ratio      numeric,
  pb_ratio      numeric,
  total_assets  numeric,
  added_at      timestamptz not null default now(),
  unique (user_id, ticker)
);

-- Row-level security: users can only read/write their own rows
alter table etf_watchlist enable row level security;

create policy "Users manage own ETF watchlist"
  on etf_watchlist
  for all
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);
