-- Migration: legal compliance columns
-- Adds newsletter opt-in tracking and ToS acceptance timestamp to the users table.
-- Run in the Supabase SQL editor or via: supabase db push

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'users' and column_name = 'newsletter_opt_in'
  ) then
    alter table users add column newsletter_opt_in boolean not null default false;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'users' and column_name = 'terms_accepted_at'
  ) then
    alter table users add column terms_accepted_at timestamptz;
  end if;
end $$;
