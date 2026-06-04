-- Organizer-specific profile: ID, bio, rate, bulk events list upload path.

create table if not exists public.organizer_profiles (
  member_id uuid primary key references public.members (id) on delete cascade,
  bio text not null default '',
  primary_sport text not null default 'Basketball',
  rate_per_official numeric(10, 2),
  id_document_path text,
  events_list_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizer_profiles enable row level security;

drop policy if exists "organizer_profiles_own" on public.organizer_profiles;
create policy "organizer_profiles_own"
  on public.organizer_profiles for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());

-- Create organizer profile row on signup
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
  else
    insert into public.organizer_profiles (member_id) values (new.id);
  end if;

  return new;
end;
$$;

-- Backfill organizer profiles for existing organizers
insert into public.organizer_profiles (member_id)
select m.id from public.members m
where m.role = 'organizer'
  and not exists (select 1 from public.organizer_profiles op where op.member_id = m.id);
