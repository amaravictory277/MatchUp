-- Allow the existing private/match message membership-repair trigger to insert
-- the sender's own membership. The normal invite policy remains unchanged for groups.

CREATE OR REPLACE FUNCTION public.can_auto_join_private_match_chat(
  p_group_id uuid,
  p_user_id uuid
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
  other_id uuid;
  match_id uuid;
begin
  if auth.uid() is null or p_user_id is null or p_user_id <> auth.uid() then
    return false;
  end if;

  select g.kind, g.direct_key
    into group_kind, direct_key
  from public.chat_groups g
  where g.id = p_group_id;

  if group_kind = 'private' then
    if direct_key is null or split_part(direct_key, ':', 1) <> 'private' then
      return false;
    end if;
    begin
      if split_part(direct_key, ':', 2) = p_user_id::text then
        other_id := split_part(direct_key, ':', 3)::uuid;
      elsif split_part(direct_key, ':', 3) = p_user_id::text then
        other_id := split_part(direct_key, ':', 2)::uuid;
      else
        return false;
      end if;
    exception when invalid_text_representation then
      return false;
    end;
    return public.is_chat_friend(p_user_id, other_id)
      or exists (
        select 1 from public.matches m
        where m.status = 'active'
          and ((m.player_a_id = p_user_id and m.player_b_id = other_id)
            or (m.player_a_id = other_id and m.player_b_id = p_user_id))
      );
  end if;

  if group_kind = 'match' then
    select mc.match_id into match_id
    from public.match_conversations mc
    where mc.conversation_id = p_group_id
    limit 1;
    if match_id is null and direct_key like 'match:%' then
      begin match_id := substring(direct_key from 7)::uuid;
      exception when invalid_text_representation then match_id := null;
      end;
    end if;
    return match_id is not null and exists (
      select 1 from public.matches m
      where m.id = match_id and m.status = 'active'
        and (m.player_a_id = p_user_id or m.player_b_id = p_user_id)
    );
  end if;

  return false;
end;
$function$;

REVOKE ALL ON FUNCTION public.can_auto_join_private_match_chat(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_auto_join_private_match_chat(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS chat_members_private_match_repair_insert ON public.chat_group_members;
CREATE POLICY chat_members_private_match_repair_insert
ON public.chat_group_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.can_auto_join_private_match_chat(group_id, user_id)
);
