-- Event city/state, organizer logo, additional sports for organizers and refs.

alter table public.scheduled_events
  add column if not exists city text,
  add column if not exists state text;

alter table public.organizer_profiles
  add column if not exists logo_path text,
  add column if not exists additional_sports text[] not null default '{}';

alter table public.ref_profiles
  add column if not exists additional_sports text[] not null default '{}';

comment on column public.scheduled_events.city is 'Event city for organizer listings and ref calendar.';
comment on column public.scheduled_events.state is 'Event state (e.g. CA, Texas).';
comment on column public.organizer_profiles.logo_path is 'Organization logo in verification_documents bucket.';
comment on column public.organizer_profiles.additional_sports is 'Extra sports beyond primary_sport (7v7, flag football, etc.).';
