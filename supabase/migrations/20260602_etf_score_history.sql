create table if not exists etf_score_history (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  score integer not null,
  pe_ratio numeric,
  pb_ratio numeric,
  yield_val numeric,
  expense_ratio numeric,
  ts timestamptz default now()
);

create index if not exists etf_score_history_ticker_ts_idx on etf_score_history(ticker, ts desc);
