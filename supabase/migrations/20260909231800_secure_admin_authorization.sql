-- MatchUp private administrator authorization hardening.
-- Reuse the existing profiles.role architecture. There is intentionally no
-- client-facing "make yourself admin" path.

create or replace function public.is_matchup_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_matchup_admin() from public;
grant execute on function public.is_matchup_admin() to authenticated;

create or replace function public.prevent_client_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and current_user not in ('postgres', 'service_role') then
    raise exception 'profile role changes are restricted' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_client_role_change on public.profiles;
create trigger profiles_prevent_client_role_change
before update on public.profiles
for each row execute function public.prevent_client_role_change();

revoke all on function public.prevent_client_role_change() from public;

notify pgrst, 'reload schema';
