-- Optional brand colors for organizer ID cards / profiles.
-- Run in Supabase SQL Editor if you do not use the CLI migrations.

alter table public.organizer_profiles
  add column if not exists brand_hex_primary text,
  add column if not exists brand_hex_secondary text;

comment on column public.organizer_profiles.brand_hex_primary is 'Optional primary brand hex color (e.g. #0D1B2A).';
comment on column public.organizer_profiles.brand_hex_secondary is 'Optional secondary brand hex color.';
