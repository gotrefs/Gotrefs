-- Organizer ratings for referees after completed games.

create table if not exists public.ref_ratings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.scheduled_events (id) on delete cascade,
  ref_member_id uuid not null references public.members (id) on delete cascade,
  organizer_member_id uuid not null references public.members (id) on delete cascade,
  score integer check (score between 1 and 5),
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, ref_member_id, organizer_member_id)
);

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
