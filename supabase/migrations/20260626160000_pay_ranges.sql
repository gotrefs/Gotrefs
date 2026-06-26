-- Optional pay ranges for refs, organizer defaults, and posted events.

alter table public.ref_profiles
  add column if not exists rate_type text not null default 'exact'
    check (rate_type in ('exact', 'range')),
  add column if not exists rate_min numeric(10, 2),
  add column if not exists rate_max numeric(10, 2);

alter table public.organizer_profiles
  add column if not exists rate_type text not null default 'exact'
    check (rate_type in ('exact', 'range')),
  add column if not exists rate_min numeric(10, 2),
  add column if not exists rate_max numeric(10, 2);

alter table public.scheduled_events
  add column if not exists pay_type text not null default 'exact'
    check (pay_type in ('exact', 'range')),
  add column if not exists pay_min numeric(10, 2),
  add column if not exists pay_max numeric(10, 2);
