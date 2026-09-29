begin;

create or replace function public.get_unread_chat_message_count()
returns bigint
language sql
security definer
set search_path = public
as $function$
  select count(*)::bigint
  from public.chat_messages m
  join public.chat_group_members gm on gm.group_id = m.group_id
  where gm.user_id = auth.uid()
    and m.sender_id <> auth.uid()
    and m.deleted_at is null
    and not exists (
      select 1
      from public.chat_message_reads r
      where r.message_id = m.id
        and r.user_id = auth.uid()
    );
$function$;

revoke all on function public.get_unread_chat_message_count() from public, anon;
grant execute on function public.get_unread_chat_message_count() to authenticated;

commit;