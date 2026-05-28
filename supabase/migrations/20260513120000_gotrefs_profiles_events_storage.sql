-- GoTRefs: referee onboarding -> public.profiles (role = ref)
--          organizer requests -> public.events
-- Anonymous inserts allowed via RLS using the Supabase anon key from the static site.

-- ─── Profiles (referee sign-ups) ───────────────────────────────────────────
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  role text not null default 'ref' check (role = 'ref'),
  full_name text not null,
  email text not null,
  phone text,
  zip_code text not null,
  sport text not null,
  certification_level text not null,
  availability text not null default '',
  rate_per_game numeric(10, 2),
  verification_document_storage_path text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Referee profiles captured from the marketing site (role ref only for this flow).';
comment on column public.profiles.availability is 'Comma-separated weekday labels from the onboarding form.';
comment on column public.profiles.verification_document_storage_path is 'Object path in the verification_documents storage bucket.';

create index profiles_email_idx on public.profiles (lower(email));
create index profiles_created_at_idx on public.profiles (created_at desc);

-- ─── Events (organizer / event requests) ─────────────────────────────────────
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_name text not null,
  organizer_email text not null,
  organizer_phone text,
  organization text not null,
  sport text not null,
  officials_needed text not null,
  event_date date not null,
  zip_code text not null,
  certification_required text not null default 'any',
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.events is 'Event and organizer contact details submitted from the marketing site.';

create index events_organizer_email_idx on public.events (lower(organizer_email));
create index events_event_date_idx on public.events (event_date);
create index events_created_at_idx on public.events (created_at desc);

-- ─── Row Level Security ─────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.events enable row level security;

-- Inserts from the static site use the anon (or authenticated) key.
create policy "Allow referee profile signups"
  on public.profiles
  for insert
  to anon, authenticated
  with check (role = 'ref');

create policy "Allow organizer event submissions"
  on public.events
  for insert
  to anon, authenticated
  with check (true);

-- No select/update/delete policies for anon -> reads happen in the Supabase dashboard with the service role.

-- ─── Storage: verification documents ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('verification_documents', 'verification_documents', false)
on conflict (id) do nothing;

create policy "Allow verification uploads"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'verification_documents');

-- Referees only need to upload; no public read on this bucket.
