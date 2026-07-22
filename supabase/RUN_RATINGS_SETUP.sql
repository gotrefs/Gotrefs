-- GotREFS ratings + booking accept hardening
-- Paste into Supabase Dashboard → SQL Editor → Run
-- Required for: Leave a review / Publish review, star averages on ref cards,
-- and safe organizer approve after a prior partial booking.

-- ─── Ratings table ───────────────────────────────────────────────────────────
create table if not exists public.ref_ratings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.scheduled_events (id) on delete cascade,
  ref_member_id uuid not null references public.members (id) on delete cascade,
  organizer_member_id uuid not null references public.members (id) on delete cascade,
  score integer check (score between 1 and 5),
  skipped boolean not null default false,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, ref_member_id, organizer_member_id)
);

alter table public.ref_ratings
  add column if not exists comment text;

create index if not exists ref_ratings_ref_idx on public.ref_ratings (ref_member_id);
create index if not exists ref_ratings_event_idx on public.ref_ratings (event_id);

alter table public.ref_ratings enable row level security;

drop policy if exists "ref_ratings_org_manage" on public.ref_ratings;
create policy "ref_ratings_org_manage"
  on public.ref_ratings for all to authenticated
  using (organizer_member_id = auth.uid())
  with check (
    organizer_member_id = auth.uid()
    and exists (
      select 1 from public.scheduled_events e
      where e.id = ref_ratings.event_id
        and e.organizer_member_id = auth.uid()
        and e.ends_at <= now()
    )
  );

drop policy if exists "ref_ratings_ref_read" on public.ref_ratings;
create policy "ref_ratings_ref_read"
  on public.ref_ratings for select to authenticated
  using (ref_member_id = auth.uid());

drop policy if exists "ref_ratings_org_read_applicants" on public.ref_ratings;
create policy "ref_ratings_org_read_applicants"
  on public.ref_ratings for select to authenticated
  using (
    exists (
      select 1
      from public.event_signup_requests esr
      join public.scheduled_events e on e.id = esr.event_id
      where esr.ref_member_id = ref_ratings.ref_member_id
        and e.organizer_member_id = auth.uid()
    )
    or exists (
      select 1
      from public.assignment_offers ao
      join public.scheduled_events e on e.id = ao.event_id
      where ao.ref_member_id = ref_ratings.ref_member_id
        and e.organizer_member_id = auth.uid()
    )
  );

-- ─── Booking accept: do not fail when booking already exists ─────────────────
create unique index if not exists bookings_event_ref_unique_idx
  on public.bookings (event_id, ref_member_id);

create or replace function public.handle_offer_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  needed_count int;
  booked_count int;
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    -- If this offer already has a booking, treat accept as success.
    if exists (select 1 from public.bookings b where b.offer_id = new.id) then
      return new;
    end if;

    -- If this ref is already booked on the event, sync offer and continue.
    if exists (
      select 1 from public.bookings b
      where b.event_id = new.event_id
        and b.ref_member_id = new.ref_member_id
    ) then
      return new;
    end if;

    select e.officials_needed
      into needed_count
      from public.scheduled_events e
      where e.id = new.event_id;

    select count(*)
      into booked_count
      from public.bookings b
      where b.event_id = new.event_id
        and b.status in ('confirmed', 'completed');

    if booked_count >= coalesce(needed_count, 1) then
      raise exception 'This event is already fully staffed.';
    end if;

    insert into public.bookings (offer_id, event_id, ref_member_id, organizer_member_id)
    select new.id, new.event_id, new.ref_member_id, e.organizer_member_id
    from public.scheduled_events e
    where e.id = new.event_id
    on conflict (offer_id) do nothing;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
