-- Lets logged-in refs mark their own screening "clear" for local testing (no Checkr / service role).
-- Run once in Supabase SQL Editor if "Start screening" fails without SUPABASE_SERVICE_ROLE_KEY.

create or replace function public.dev_mark_screening_clear()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.members m where m.id = auth.uid() and m.role = 'ref'
  ) then
    raise exception 'Only referees can complete screening';
  end if;

  update public.screening_checks
  set
    status = 'clear',
    summary = 'Development bypass — not a real background check.',
    updated_at = now()
  where ref_member_id = auth.uid();

  if not found then
    insert into public.screening_checks (ref_member_id, status, summary)
    values (auth.uid(), 'clear', 'Development bypass — not a real background check.');
  end if;
end;
$$;

revoke all on function public.dev_mark_screening_clear() from public;
grant execute on function public.dev_mark_screening_clear() to authenticated;
