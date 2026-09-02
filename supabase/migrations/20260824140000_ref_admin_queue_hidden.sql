-- Admin can hide referees from the verification queue without deleting their account.

alter table public.ref_profiles
  add column if not exists admin_queue_hidden_at timestamptz;

create index if not exists ref_profiles_admin_queue_hidden_idx
  on public.ref_profiles (admin_queue_hidden_at)
  where admin_queue_hidden_at is not null;

comment on column public.ref_profiles.admin_queue_hidden_at is
  'When set, this referee is hidden from the default admin verification queue.';
