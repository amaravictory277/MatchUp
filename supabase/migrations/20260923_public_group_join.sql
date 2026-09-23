begin;

create or replace function public.join_chat_group(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.chat_groups
    where id=p_group_id and kind='group' and locked=false
  ) then raise exception 'This group is not open to new members'; end if;
  insert into public.chat_group_members(group_id,user_id,last_seen_at)
  values(p_group_id,(select auth.uid()),now())
  on conflict do nothing;
  return p_group_id;
end;
$function$;

revoke all on function public.join_chat_group(uuid) from public, anon;
grant execute on function public.join_chat_group(uuid) to authenticated;

commit;
