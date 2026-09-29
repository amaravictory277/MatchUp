begin;

create or replace function public.get_or_create_private_chat(p_friend uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  g uuid;
  k text;
  a text;
  b text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_friend is null or p_friend = auth.uid() then
    raise exception 'Choose another player';
  end if;

  if not exists (select 1 from public.profiles where id = p_friend) then
    raise exception 'Player not found';
  end if;

  if not exists (
    select 1
    from public.friendships
    where status = 'accepted'
      and (
        (user_id = auth.uid() and friend_id = p_friend)
        or
        (user_id = p_friend and friend_id = auth.uid())
      )
  ) then
    raise exception 'You can only message friends';
  end if;

  if auth.uid()::text < p_friend::text then
    a := auth.uid()::text;
    b := p_friend::text;
  else
    a := p_friend::text;
    b := auth.uid()::text;
  end if;

  k := 'private:' || a || ':' || b;

  select id into g
  from public.chat_groups
  where kind = 'private'
    and direct_key = k
  limit 1;

  if g is null then
    begin
      insert into public.chat_groups(name, created_by, kind, direct_key, locked, member_limit)
      values('Private chat', auth.uid(), 'private', k, false, 2)
      returning id into g;
    exception when unique_violation then
      select id into g
      from public.chat_groups
      where kind = 'private'
        and direct_key = k
      limit 1;
    end;
  end if;

  insert into public.chat_group_members(group_id, user_id, last_seen_at)
  values(g, auth.uid(), now()), (g, p_friend, now())
  on conflict do nothing;

  return g;
end;
$function$;

commit;