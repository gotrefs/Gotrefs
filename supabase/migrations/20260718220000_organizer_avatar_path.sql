-- Face photo for organizer GotREFS ID cards (stored in private verification_documents).

alter table public.organizer_profiles
  add column if not exists avatar_path text;
