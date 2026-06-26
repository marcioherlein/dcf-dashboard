create table digest_drafts (
  id uuid primary key default gen_random_uuid(),
  week_label text not null,
  subject_line text not null,
  opening text not null,
  market_section text not null,
  stock_spotlight jsonb not null,
  macro_note text not null,
  status text not null default 'draft',
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  auto_send_at timestamptz not null,
  constraint digest_drafts_week_label_key unique (week_label),
  constraint digest_drafts_status_check check (status in ('draft', 'approved', 'sent'))
);
