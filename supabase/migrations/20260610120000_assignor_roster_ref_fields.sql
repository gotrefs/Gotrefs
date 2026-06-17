-- Assignor roster entries: rate, certification, availability (same detail as platform refs).

alter table public.assignor_roster_entries
  add column if not exists rate_per_game numeric(10, 2),
  add column if not exists certification_level text,
  add column if not exists availability jsonb not null default '[]'::jsonb;

comment on column public.assignor_roster_entries.availability is
  'JSON array of {start_at, end_at} ISO timestamps for when this ref is available.';
