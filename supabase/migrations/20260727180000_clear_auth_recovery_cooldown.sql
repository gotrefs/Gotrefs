-- Allow password-reset requests without the default 60s Auth mailer cooldown.
-- Called only from the service-role forgot-password API before /recover.

create or replace function public.clear_auth_recovery_cooldown(target_email text)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if target_email is null or length(trim(target_email)) = 0 then
    return;
  end if;

  update auth.users
  set recovery_sent_at = null
  where lower(email) = lower(trim(target_email));
end;
$$;

revoke all on function public.clear_auth_recovery_cooldown(text) from public;
revoke all on function public.clear_auth_recovery_cooldown(text) from anon;
revoke all on function public.clear_auth_recovery_cooldown(text) from authenticated;
grant execute on function public.clear_auth_recovery_cooldown(text) to service_role;

comment on function public.clear_auth_recovery_cooldown(text) is
  'Clears auth.users.recovery_sent_at so password reset can be requested immediately.';
