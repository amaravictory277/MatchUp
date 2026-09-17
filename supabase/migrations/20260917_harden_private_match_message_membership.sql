-- Keep direct and Ready Match message writes tied to actual conversation membership.
-- This runs before RLS so the existing .insert().select() path can safely return the new row
-- even if a legacy conversation was missing the sender's membership row.

create or replace function public.ensure_chat_message_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  group_kind text;
  direct_key text;
  other_id uuid;
  match_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select kind, chat_groups.direct_key
    into group_kind, direct_key
  from public.chat_groups
  where id = new.group_id;

  if group_kind is null then
    raise exception 'Chat no longer exists';
  end if;

  if group_kind = 'private' then
    if public.is_chat_group_member(new.group_id, auth.uid()) then
      return new;
    end if;

    if direct_key is null or split_part(direct_key, ':', 1) <> 'private' then
      raise exception 'Invalid direct conversation';
    end if;

    if split_part(direct_key, ':', 2) = auth.uid()::text then
      other_id := split_part(direct_key, ':', 3)::uuid;
    elsif split_part(direct_key, ':', 3) = auth.uid()::text then
      other_id := split_part(direct_key, ':', 2)::uuid;
    else
      raise exception 'You are not a participant in this conversation';
    end if;

    if not public.is_chat_friend(auth.uid(), other_id)
       and not exists (
         select 1
         from public.matches m
         where m.status = 'active'
           and ((m.player_a_id = auth.uid() and m.player_b_id = other_id)
             or (m.player_a_id = other_id and m.player_b_id = auth.uid()))
       ) then
      raise exception 'You are not authorized to use this conversation';
    end if;

    insert into public.chat_group_members(group_id, user_id, last_seen_at)
    values (new.group_id, auth.uid(), now())
    on conflict (group_id, user_id) do nothing;

    return new;
  end if;

  if group_kind = 'match' then
    if public.is_chat_group_member(new.group_id, auth.uid()) then
      return new;
    end if;

    select mc.match_id
      into match_id
    from public.match_conversations mc
    where mc.conversation_id = new.group_id
    limit 1;

    if match_id is null and direct_key like 'match:%' then
      begin
        match_id := substring(direct_key from 7)::uuid;
      exception when invalid_text_representation then
        match_id := null;
      end;
    end if;

    if match_id is null
       or not exists (
         select 1
         from public.matches m
         where m.id = match_id
           and m.status = 'active'
           and (m.player_a_id = auth.uid() or m.player_b_id = auth.uid())
       ) then
      raise exception 'You are not authorized to use this match conversation';
    end if;

    insert into public.chat_group_members(group_id, user_id, last_seen_at)
    values (new.group_id, auth.uid(), now())
    on conflict (group_id, user_id) do nothing;

    return new;
  end if;

  return new;
end;
$function$;

drop trigger if exists chat_message_membership_guard on public.chat_messages;
create trigger chat_message_membership_guard
before insert on public.chat_messages
for each row execute function public.ensure_chat_message_membership();

drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert
on public.chat_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.chat_groups g
    where g.id = chat_messages.group_id
      and (
        (g.kind in ('private', 'match') and public.is_chat_group_member(g.id))
        or (g.kind = 'general' and not g.locked)
        or (g.kind = 'group' and not g.locked and public.is_chat_group_member(g.id))
      )
  )
);

grant execute on function public.ensure_chat_message_membership() to authenticated;
