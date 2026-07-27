-- Refs may only create game requests after GotREFS approval (or equivalent eligible path).
-- Service-role apply API still enforces the same rule; this blocks client-side inserts.

drop policy if exists "event_signup_requests_ref_insert" on public.event_signup_requests;
create policy "event_signup_requests_ref_insert"
  on public.event_signup_requests for insert to authenticated
  with check (
    ref_member_id = auth.uid()
    and exists (select 1 from public.members m where m.id = auth.uid() and m.role = 'ref')
    and public.ref_is_offer_eligible(auth.uid())
  );

comment on policy "event_signup_requests_ref_insert" on public.event_signup_requests is
  'Refs can insert signup requests only when fully offer-eligible (approved verification, external proof, or clear screening).';
