-- RLS on chat_groups can hide a legacy private conversation before the INSERT
-- policy evaluates it. Use one small SECURITY DEFINER authorization helper so
-- private/match message writes can validate the conversation without weakening RLS.

CREATE OR REPLACE FUNCTION public.can_insert_chat_message(
  p_group_id uuid,
  p_sender_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  group_kind text;
  direct_key text;
  group_locked boolean;
  other_id uuid;
  match_id uuid;
begin
  if auth.uid() is null or p_sender_id is null or p_sender_id <> auth.uid() then
    return false;
  end if;

  select g.kind, g.direct_key, g.locked
    into group_kind, direct_key, group_locked
  from public.chat_groups g
  where g.id = p_group_id;

  if group_kind is null then
    return false;
  end if;

  if group_kind = 'general' then
    return not group_locked;
  end if;

  if group_kind = 'group' then
    return not group_locked
      and public.is_chat_group_member(p_group_id, p_sender_id);
  end if;

  if group_kind = 'private' then
    if public.is_chat_group_member(p_group_id, p_sender_id) then
      return true;
    end if;

    if direct_key is null or split_part(direct_key, ':', 1) <> 'private' then
      return false;
    end if;

    begin
      if split_part(direct_key, ':', 2) = p_sender_id::text then
        other_id := split_part(direct_key, ':', 3)::uuid;
      elsif split_part(direct_key, ':', 3) = p_sender_id::text then
        other_id := split_part(direct_key, ':', 2)::uuid;
      else
        return false;
      end if;
    exception when invalid_text_representation then
      return false;
    end;

    return public.is_chat_friend(p_sender_id, other_id)
      or exists (
        select 1
        from public.matches m
        where m.status = 'active'
          and ((m.player_a_id = p_sender_id and m.player_b_id = other_id)
            or (m.player_a_id = other_id and m.player_b_id = p_sender_id))
      );
  end if;

  if group_kind = 'match' then
    if public.is_chat_group_member(p_group_id, p_sender_id) then
      return true;
    end if;

    select mc.match_id
      into match_id
    from public.match_conversations mc
    where mc.conversation_id = p_group_id
    limit 1;

    if match_id is null and direct_key like 'match:%' then
      begin
        match_id := substring(direct_key from 7)::uuid;
      exception when invalid_text_representation then
        match_id := null;
      end;
    end if;

    return match_id is not null
      and exists (
        select 1
        from public.matches m
        where m.id = match_id
          and m.status = 'active'
          and (m.player_a_id = p_sender_id or m.player_b_id = p_sender_id)
      );
  end if;

  return false;
end;
$function$;

REVOKE ALL ON FUNCTION public.can_insert_chat_message(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_insert_chat_message(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;
CREATE POLICY chat_messages_insert
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (public.can_insert_chat_message(group_id, sender_id));
