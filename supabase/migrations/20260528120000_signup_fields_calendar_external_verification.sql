-- Signup fields, external ref verification, ref event signup requests, published event calendar access.

-- ─── Members: first / last name + organizer organization ───────────────────────
alter table public.members
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists organization_name text;

-- ─── Ref external verification (another company) ─────────────────────────────
alter table public.ref_profiles
  add column if not exists verification_method text not null default 'checkr'
    check (verification_method in ('checkr', 'external')),
  add column if not exists external_verifier_name text,
  add column if not exists external_verification_proof_path text;

comment on column public.ref_profiles.verification_method is 'checkr = platform screening; external = verified elsewhere with uploaded proof.';
comment on column public.ref_profiles.external_verification_proof_path is 'Receipt or screenshot path in verification_documents bucket.';

-- ─── Refs request to work published events (calendar signup) ─────────────────
create table if not exists public.event_signup_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.scheduled_events (id) on delete cascade,
  ref_member_id uuid not null references public.members (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'withdrawn', 'accepted', 'declined')),
  message text,
  created_at timestamptz not null default now(),
  unique (event_id, ref_member_id)
);

create index if not exists event_signup_requests_event_idx on public.event_signup_requests (event_id);
create index if not exists event_signup_requests_ref_idx on public.event_signup_requests (ref_member_id);

alter table public.event_signup_requests enable row level security;

drop policy if exists "event_signup_requests_ref_insert" on public.event_signup_requests;
create policy "event_signup_requests_ref_insert"
  on public.event_signup_requests for insert to authenticated
  with check (
    ref_member_id = auth.uid()
    and exists (select 1 from public.members m where m.id = auth.uid() and m.role = 'ref')
  );

drop policy if exists "event_signup_requests_ref_select" on public.event_signup_requests;
create policy "event_signup_requests_ref_select"
  on public.event_signup_requests for select to authenticated
  using (ref_member_id = auth.uid());

drop policy if exists "event_signup_requests_ref_update" on public.event_signup_requests;
create policy "event_signup_requests_ref_update"
  on public.event_signup_requests for update to authenticated
  using (ref_member_id = auth.uid()) with check (ref_member_id = auth.uid());

drop policy if exists "event_signup_requests_org_select" on public.event_signup_requests;
create policy "event_signup_requests_org_select"
  on public.event_signup_requests for select to authenticated
  using (
    exists (
      select 1 from public.scheduled_events e
      where e.id = event_signup_requests.event_id and e.organizer_member_id = auth.uid()
    )
  );

-- Refs browse published events for the calendar
drop policy if exists "scheduled_events_ref_read_published" on public.scheduled_events;
create policy "scheduled_events_ref_read_published"
  on public.scheduled_events for select to authenticated
  using (
    status = 'published'
    and exists (select 1 from public.members m where m.id = auth.uid() and m.role = 'ref')
  );

-- ─── Auth trigger: first/last name + organization ────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
  fn text;
  ln text;
  org text;
  dn text;
begin
  r := coalesce(nullif(trim(new.raw_user_meta_data->>'role'), ''), 'ref');
  if r not in ('ref', 'organizer') then
    r := 'ref';
  end if;

  fn := coalesce(nullif(trim(new.raw_user_meta_data->>'first_name'), ''), '');
  ln := coalesce(nullif(trim(new.raw_user_meta_data->>'last_name'), ''), '');
  org := coalesce(nullif(trim(new.raw_user_meta_data->>'organization_name'), ''), null);

  dn := trim(fn || ' ' || ln);
  if dn = '' then
    dn := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1));
  end if;

  insert into public.members (id, role, display_name, first_name, last_name, organization_name)
  values (
    new.id,
    r,
    dn,
    nullif(fn, ''),
    nullif(ln, ''),
    case when r = 'organizer' then org else null end
  );

  if r = 'ref' then
    insert into public.ref_profiles (member_id) values (new.id);
    insert into public.screening_checks (ref_member_id) values (new.id);
  end if;

  return new;
end;
$$;

-- ─── Accept offers when Checkr clear OR external proof on file ─────────────────
create or replace function public.enforce_ref_screening_before_accept()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    if not exists (
      select 1 from public.screening_checks sc
      where sc.ref_member_id = new.ref_member_id and sc.status = 'clear'
    )
    and not exists (
      select 1 from public.ref_profiles rp
      where rp.member_id = new.ref_member_id
        and rp.verification_method = 'external'
        and rp.external_verification_proof_path is not null
    ) then
      raise exception 'SCREENING_NOT_CLEAR';
    end if;
  end if;
  return new;
end;
$$;

drop policy if exists "screening_update_own_ref" on public.screening_checks;
create policy "screening_update_own_ref"
  on public.screening_checks for update to authenticated
  using (ref_member_id = auth.uid()) with check (ref_member_id = auth.uid());

drop policy if exists "members_select_verified_refs" on public.members;
create policy "members_select_verified_refs"
  on public.members for select to authenticated
  using (
    role = 'ref'
    and (
      exists (
        select 1 from public.screening_checks sc
        where sc.ref_member_id = members.id and sc.status = 'clear'
      )
      or exists (
        select 1 from public.ref_profiles rp
        where rp.member_id = members.id
          and rp.verification_method = 'external'
          and rp.external_verification_proof_path is not null
      )
    )
  );

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
    or (
      ref_profiles.verification_method = 'external'
      and ref_profiles.external_verification_proof_path is not null
      and exists (
        select 1 from public.members m
        where m.id = ref_profiles.member_id and m.role = 'ref'
      )
    )
  );
