-- Extra certification levels beyond the primary certification_level on ref profiles.

alter table public.ref_profiles
  add column if not exists additional_certification_levels text[] not null default '{}';

comment on column public.ref_profiles.additional_certification_levels is
  'Extra certification levels beyond certification_level (e.g. varsity + college).';
