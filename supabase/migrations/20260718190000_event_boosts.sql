-- Event boosts: organizers pick pay boosts in the listing wizard, and they are
-- applied to offers so refs earn (and organizers pay) the boosted amount.

alter table public.scheduled_events
  add column if not exists boosts text[] not null default '{}';

alter table public.assignment_offers
  add column if not exists boost_percent integer not null default 0,
  add column if not exists base_pay numeric(10, 2);
