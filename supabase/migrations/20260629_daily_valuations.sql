-- daily_valuations: stores one blended cockpit valuation per ticker per day.
-- The valuation-batch cron runs nightly and upserts into this table.
-- The Ideas API reads from this table to show real cockpit fair values.

create table if not exists daily_valuations (
  id              bigserial primary key,
  ticker          text        not null,
  date            date        not null,
  -- Core cockpit outputs
  price           numeric     not null,
  fair_value      numeric,                -- blended fair value (null if cockpit failed)
  upside_pct      numeric,                -- (fair_value - price) / price
  verdict         text,                   -- 'Undervalued' | 'Fairly Valued' | 'Overvalued' | 'Insufficient Data'
  -- Individual method outputs (for transparency)
  dcf_fv          numeric,
  forward_pe_fv   numeric,
  ev_ebitda_fv    numeric,
  rev_multiple_fv numeric,
  -- Cockpit metadata
  method_count    smallint,               -- number of methods with valid output
  confidence      text,                   -- 'high' | 'medium' | 'low'
  wacc            numeric,
  cagr            numeric,
  -- Extra signals stored alongside (from Yahoo, no extra cost)
  analyst_target  numeric,
  analyst_rating  numeric,
  market_cap      numeric,
  sector          text,
  -- Batch run metadata
  run_at          timestamptz not null default now(),
  data_source     text        not null default 'cockpit_v1',
  error           text,                   -- populated if cockpit threw; fair_value stays null

  unique (ticker, date)
);

-- Efficient lookups by date (bulk reads for Ideas API)
create index if not exists daily_valuations_date_idx on daily_valuations (date desc);
-- Efficient lookups by ticker (historical chart per stock)
create index if not exists daily_valuations_ticker_date_idx on daily_valuations (ticker, date desc);

-- Row-level security: readable by anon, writable only by service role
alter table daily_valuations enable row level security;

create policy "daily_valuations_read"
  on daily_valuations for select
  to anon, authenticated
  using (true);
