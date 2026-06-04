-- GoTRefs marketplace schema: members, refs, events, offers, bookings, screening.
-- Run on a Supabase project after enabling Auth (email). If you already use legacy
-- `profiles` / `events` from an older migration, keep them; this migration uses NEW
-- table names and does not drop legacy tables.

-- ─── Members (1:1 with auth.users) ───────────────────────────────────────────
create table if not exists public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('ref', 'organizer')),
  display_name text not null,
  phone text,
  home_zip text,
  created_at timestamptz not null default now()
);

create index if not exists members_role_idx on public.members (role);

-- ─── Referee profile ──────────────────────────────────────────────────────────
create table if not exists public.ref_profiles (
  member_id uuid primary key references public.members (id) on delete cascade,
  bio text not null default '',
  primary_sport text not null default 'Basketball',
  certification_level text,
  rate_per_game numeric(10, 2),
  verification_doc_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Third-party screening (e.g. Checkr) — stores status, not raw PII ────────
create table if not exists public.screening_checks (
  id uuid primary key default gen_random_uuid(),
  ref_member_id uuid not null references public.members (id) on delete cascade,
  provider text not null default 'checkr',
  external_candidate_id text,
  external_report_id text,
  status text not null default 'not_started'
    check (status in ('not_started', 'invited', 'pending', 'clear', 'consider', 'canceled', 'error')),
  summary text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ref_member_id)
);

-- ─── Ref availability windows ─────────────────────────────────────────────────
create table if not exists public.ref_availability (
  id uuid primary key default gen_random_uuid(),
  ref_member_id uuid not null references public.members (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  constraint ref_availability_range check (end_at > start_at)
);

create index if not exists ref_availability_ref_time_idx
  on public.ref_availability (ref_member_id, start_at);

-- ─── Organizer events ─────────────────────────────────────────────────────────
create table if not exists public.scheduled_events (
  id uuid primary key default gen_random_uuid(),
  organizer_member_id uuid not null references public.members (id) on delete cascade,
  title text not null default 'Event',
  sport text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  zip_code text not null,
  officials_needed int not null default 1 check (officials_needed > 0),
  pay_offer numeric(10, 2),
  notes text,
  status text not null default 'published'
    check (status in ('draft', 'published', 'canceled')),
  created_at timestamptz not null default now(),
  constraint scheduled_events_range check (ends_at > starts_at)
);

create index if not exists scheduled_events_org_idx on public.scheduled_events (organizer_member_id);
create index if not exists scheduled_events_starts_idx on public.scheduled_events (starts_at);

-- ─── Offers from organizer → ref ──────────────────────────────────────────────
create table if not exists public.assignment_offers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.scheduled_events (id) on delete cascade,
  ref_member_id uuid not null references public.members (id) on delete cascade,
  offered_pay numeric(10, 2),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'canceled', 'expired')),
  message text,
  created_at timestamptz not null default now(),
  unique (event_id, ref_member_id)
);

create index if not exists assignment_offers_ref_idx on public.assignment_offers (ref_member_id);
create index if not exists assignment_offers_event_idx on public.assignment_offers (event_id);

-- ─── Confirmed booking when offer accepted ────────────────────────────────────
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.assignment_offers (id) on delete cascade,
  event_id uuid not null references public.scheduled_events (id) on delete cascade,
  ref_member_id uuid not null references public.members (id) on delete cascade,
  organizer_member_id uuid not null references public.members (id) on delete cascade,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'completed', 'canceled')),
  created_at timestamptz not null default now()
);

-- ─── Auth trigger: create member (+ ref profile + screening row for refs) ────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
  nm text;
begin
  r := coalesce(nullif(trim(new.raw_user_meta_data->>'role'), ''), 'ref');
  if r not in ('ref', 'organizer') then
    r := 'ref';
  end if;

  nm := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1));

  insert into public.members (id, role, display_name)
  values (new.id, r, nm);

  if r = 'ref' then
    insert into public.ref_profiles (member_id) values (new.id);
    insert into public.screening_checks (ref_member_id) values (new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Booking row when offer moves to accepted ─────────────────────────────────
create or replace function public.handle_offer_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    insert into public.bookings (offer_id, event_id, ref_member_id, organizer_member_id)
    select new.id, new.event_id, new.ref_member_id, e.organizer_member_id
    from public.scheduled_events e
    where e.id = new.event_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_offer_accepted on public.assignment_offers;
create trigger trg_offer_accepted
  after update on public.assignment_offers
  for each row execute function public.handle_offer_accepted();

-- ─── Only screened refs may accept offers ─────────────────────────────────────
create or replace function public.enforce_ref_screening_before_accept()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    if not exists (
      select 1 from public.screening_checks sc
      where sc.ref_member_id = new.ref_member_id and sc.status = 'clear'
    ) then
      raise exception 'SCREENING_NOT_CLEAR';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_screening_before_accept on public.assignment_offers;
create trigger trg_screening_before_accept
  before update on public.assignment_offers
  for each row execute function public.enforce_ref_screening_before_accept();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.members enable row level security;
alter table public.ref_profiles enable row level security;
alter table public.screening_checks enable row level security;
alter table public.ref_availability enable row level security;
alter table public.scheduled_events enable row level security;
alter table public.assignment_offers enable row level security;
alter table public.bookings enable row level security;

-- members: self + verified refs for marketplace discovery
drop policy if exists "members_select_self" on public.members;
create policy "members_select_self"
  on public.members for select to authenticated
  using (id = auth.uid());

drop policy if exists "members_select_verified_refs" on public.members;
create policy "members_select_verified_refs"
  on public.members for select to authenticated
  using (
    role = 'ref'
    and exists (
      select 1 from public.screening_checks sc
      where sc.ref_member_id = members.id and sc.status = 'clear'
    )
  );

drop policy if exists "members_update_self" on public.members;
create policy "members_update_self"
  on public.members for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ref_profiles
drop policy if exists "ref_profiles_own_all" on public.ref_profiles;
create policy "ref_profiles_own_all"
  on public.ref_profiles for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());

drop policy if exists "ref_profiles_read_verified" on public.ref_profiles;
create policy "ref_profiles_read_verified"
  on public.ref_profiles for select to authenticated
  using (
    exists (
      select 1 from public.members m
      join public.screening_checks sc on sc.ref_member_id = m.id
      where m.id = ref_profiles.member_id
        and m.role = 'ref'
        and sc.status = 'clear'
    )
  );

-- screening: refs read own row only (updates via service role / Edge Function)
drop policy if exists "screening_select_own_ref" on public.screening_checks;
create policy "screening_select_own_ref"
  on public.screening_checks for select to authenticated
  using (ref_member_id = auth.uid());

-- Organizers (and refs) can see *cleared* screenings to validate marketplace eligibility.
drop policy if exists "screening_select_cleared" on public.screening_checks;
create policy "screening_select_cleared"
  on public.screening_checks for select to authenticated
  using (status = 'clear');

-- availability
drop policy if exists "ref_availability_own" on public.ref_availability;
create policy "ref_availability_own"
  on public.ref_availability for all to authenticated
  using (ref_member_id = auth.uid()) with check (ref_member_id = auth.uid());

-- scheduled events
drop policy if exists "scheduled_events_org" on public.scheduled_events;
create policy "scheduled_events_org"
  on public.scheduled_events for all to authenticated
  using (organizer_member_id = auth.uid())
  with check (organizer_member_id = auth.uid());

-- offers: ref sees own; organizer sees for their events
drop policy if exists "offers_ref_select" on public.assignment_offers;
create policy "offers_ref_select"
  on public.assignment_offers for select to authenticated
  using (ref_member_id = auth.uid());

drop policy if exists "offers_org_select" on public.assignment_offers;
create policy "offers_org_select"
  on public.assignment_offers for select to authenticated
  using (
    exists (
      select 1 from public.scheduled_events e
      where e.id = assignment_offers.event_id and e.organizer_member_id = auth.uid()
    )
  );

drop policy if exists "offers_org_insert" on public.assignment_offers;
create policy "offers_org_insert"
  on public.assignment_offers for insert to authenticated
  with check (
    exists (
      select 1 from public.scheduled_events e
      where e.id = event_id and e.organizer_member_id = auth.uid()
    )
  );

drop policy if exists "offers_ref_update" on public.assignment_offers;
create policy "offers_ref_update"
  on public.assignment_offers for update to authenticated
  using (ref_member_id = auth.uid()) with check (ref_member_id = auth.uid());

drop policy if exists "offers_org_update" on public.assignment_offers;
create policy "offers_org_update"
  on public.assignment_offers for update to authenticated
  using (
    exists (
      select 1 from public.scheduled_events e
      where e.id = assignment_offers.event_id and e.organizer_member_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.scheduled_events e
      where e.id = assignment_offers.event_id and e.organizer_member_id = auth.uid()
    )
  );

-- bookings
drop policy if exists "bookings_participants" on public.bookings;
create policy "bookings_participants"
  on public.bookings for select to authenticated
  using (ref_member_id = auth.uid() or organizer_member_id = auth.uid());

-- ─── Storage bucket (private verification uploads) ───────────────────────────
insert into storage.buckets (id, name, public)
values ('verification_documents', 'verification_documents', false)
on conflict (id) do nothing;

drop policy if exists "Allow verification uploads" on storage.objects;
drop policy if exists "verification_upload_own_folder" on storage.objects;
drop policy if exists "verification_read_own_folder" on storage.objects;
drop policy if exists "verification_update_own_folder" on storage.objects;
drop policy if exists "verification_delete_own_folder" on storage.objects;

create policy "verification_upload_own_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification_documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "verification_read_own_folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification_documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "verification_update_own_folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'verification_documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "verification_delete_own_folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'verification_documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
