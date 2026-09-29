-- Permanently delete every GoTRefs sample referee.
-- Only removes accounts flagged is_seed AND using the sample email pattern.
-- members, ref_profiles and related rows are removed automatically (cascade).

delete from auth.users u
using public.members m
where m.id = u.id
  and m.is_seed
  and u.email like 'gotrefs-sample-%@example.com';

-- Should show 0:
select count(*) as sample_refs_left from public.members where is_seed;
