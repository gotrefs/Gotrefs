-- Lock down admin verification queue view so anon/authenticated cannot read it via the API.
-- App admin queue uses service-role queries on base tables, not this view.

revoke all on table public.ref_verification_review_queue from public;
revoke all on table public.ref_verification_review_queue from anon;
revoke all on table public.ref_verification_review_queue from authenticated;

-- Only the service role may select this view (dashboard SQL editor / service key).
grant select on table public.ref_verification_review_queue to postgres;
grant select on table public.ref_verification_review_queue to service_role;

-- If privileges are ever re-granted, evaluate as the calling role so underlying RLS still applies.
alter view public.ref_verification_review_queue set (security_invoker = on);

comment on view public.ref_verification_review_queue is
  'Admin-only referee verification queue. Not granted to anon/authenticated; service_role only.';
