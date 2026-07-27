-- Enable live dashboard updates when admin changes verification status.
do $$
begin
  alter publication supabase_realtime add table public.ref_verification_submissions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
