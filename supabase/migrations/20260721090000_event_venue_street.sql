-- Exact venue street for booked refs only (hidden from open browse).

alter table public.scheduled_events
  add column if not exists venue_street text,
  add column if not exists venue_unit text,
  add column if not exists venue_lat double precision,
  add column if not exists venue_lng double precision;

comment on column public.scheduled_events.venue_street is 'Street address revealed to confirmed refs after organizer approval.';
comment on column public.scheduled_events.venue_unit is 'Optional unit/suite for the venue.';
comment on column public.scheduled_events.venue_lat is 'Exact venue latitude from organizer address search (never exposed to refs in browse).';
comment on column public.scheduled_events.venue_lng is 'Exact venue longitude from organizer address search (never exposed to refs in browse).';
