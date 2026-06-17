-- Assignor roster (refs an assignor manages), ref contact inquiries, assignor flag.

alter table public.ref_profiles
  add column if not exists is_assignor boolean not null default false;

create table if not exists public.assignor_roster_entries (
  id uuid primary key default gen_random_uuid(),
  assignor_member_id uuid not null references public.members (id) on delete cascade,
  display_name text not null,
  primary_sport text not null default 'Basketball',
  additional_sports text[] not null default '{}',
  notes text,
  contact_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assignor_roster_assignor_idx
  on public.assignor_roster_entries (assignor_member_id);

create table if not exists public.ref_inquiries (
  id uuid primary key default gen_random_uuid(),
  ref_member_id uuid not null references public.members (id) on delete cascade,
  organizer_member_id uuid not null references public.members (id) on delete cascade,
  subject text not null default 'Availability inquiry',
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists ref_inquiries_ref_idx on public.ref_inquiries (ref_member_id);
create index if not exists ref_inquiries_org_idx on public.ref_inquiries (organizer_member_id);

alter table public.assignor_roster_entries enable row level security;
alter table public.ref_inquiries enable row level security;

drop policy if exists "assignor_roster_own" on public.assignor_roster_entries;
create policy "assignor_roster_own"
  on public.assignor_roster_entries for all to authenticated
  using (assignor_member_id = auth.uid())
  with check (assignor_member_id = auth.uid());

drop policy if exists "ref_inquiries_ref_read" on public.ref_inquiries;
create policy "ref_inquiries_ref_read"
  on public.ref_inquiries for select to authenticated
  using (ref_member_id = auth.uid());

drop policy if exists "ref_inquiries_org_read" on public.ref_inquiries;
create policy "ref_inquiries_org_read"
  on public.ref_inquiries for select to authenticated
  using (organizer_member_id = auth.uid());

-- Inserts only via service role API (organizer membership verified server-side).

drop policy if exists "members_read_inquiry_counterparties" on public.members;
create policy "members_read_inquiry_counterparties"
  on public.members for select to authenticated
  using (
    exists (
      select 1 from public.ref_inquiries ri
      where (ri.ref_member_id = auth.uid() and ri.organizer_member_id = members.id)
         or (ri.organizer_member_id = auth.uid() and ri.ref_member_id = members.id)
    )
  );
