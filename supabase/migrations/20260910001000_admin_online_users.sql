create or replace function public.get_admin_online_users(p_user_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
begin
  if not public.is_matchup_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.display_name nulls last,x.username) from (
    select p.id,p.display_name,p.username,p.avatar_path,p.created_at,p.last_seen_at,
           coalesce(u.raw_app_meta_data->>'provider','email') as auth_provider,
           (u.email_confirmed_at is not null) as email_verified,u.last_sign_in_at
    from public.profiles p join auth.users u on u.id=p.id
    where p.id = any(coalesce(p_user_ids,'{}'::uuid[]))
  ) x),'[]'::jsonb);
end;
$$;
revoke all on function public.get_admin_online_users(uuid[]) from public,anon;
grant execute on function public.get_admin_online_users(uuid[]) to authenticated;
