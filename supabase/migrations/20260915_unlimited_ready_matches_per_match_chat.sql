begin;

-- Each match owns its own conversation. The same conversation must not be reused
-- by another match, but a conversation may only belong to one match through match_id.
alter table public.match_conversations drop constraint if exists match_conversations_conversation_id_key;
drop index if exists public.match_conversations_conversation_id_key;

create or replace function public.get_ready_players()
returns table (
  id uuid,
  display_name text,
  username text,
  avatar_path text,
  ready_player_enabled boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.display_name, p.username, p.avatar_path, p.ready_player_enabled
  from public.profiles p
  join public.ready_match_presence rp on rp.user_id = p.id
  where rp.ready = true
    and rp.last_heartbeat_at > now() - interval '20 seconds'
    and p.ready_player_enabled = true
    and p.id <> auth.uid()
  order by coalesce(p.display_name, p.username, 'MatchUp Player');
$$;

create or replace function public.set_ready_player(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  if p_enabled then
    if not exists (
      select 1 from public.ready_match_presence
      where user_id = auth.uid() and last_heartbeat_at > now() - interval '20 seconds'
    ) then
      raise exception 'Ready Match session is not active';
    end if;
    update public.ready_match_presence
    set ready = true, last_heartbeat_at = now()
    where user_id = auth.uid();
    update public.profiles
    set ready_player_enabled = true, ready_player_updated_at = now()
    where id = auth.uid();
  else
    update public.profiles
    set ready_player_enabled = false, ready_player_updated_at = now()
    where id = auth.uid();
    delete from public.ready_match_presence where user_id = auth.uid();
  end if;

  return p_enabled;
end;
$$;

create or replace function public.send_match_request(p_opponent_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.expire_match_requests();
  perform pg_advisory_xact_lock(817263514);

  if p_opponent_id is null or p_opponent_id = auth.uid() then raise exception 'Choose another ready player'; end if;
  if not exists (
    select 1 from public.ready_match_presence rp
    join public.profiles p on p.id = rp.user_id
    where rp.user_id = p_opponent_id and rp.ready = true
      and rp.last_heartbeat_at > now() - interval '20 seconds'
      and p.ready_player_enabled = true
  ) then raise exception 'That player is no longer available in Ready Match'; end if;
  if not exists (
    select 1 from public.ready_match_presence rp
    where rp.user_id = auth.uid() and rp.ready = true
      and rp.last_heartbeat_at > now() - interval '20 seconds'
  ) then raise exception 'Turn on Ready Player before sending a match request'; end if;

  insert into public.match_requests(requester_id, opponent_id, expires_at)
  values (auth.uid(), p_opponent_id, now() + interval '5 minutes')
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'A match request is already pending in that direction';
end;
$$;

create or replace function public.respond_match_request(p_request_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.match_requests%rowtype;
  v_match uuid;
  v_group uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.expire_match_requests();

  select * into r from public.match_requests
  where id = p_request_id and status = 'pending' and opponent_id = auth.uid()
  for update;
  if not found then raise exception 'This match request is no longer pending'; end if;
  if r.expires_at <= now() then
    update public.match_requests set status = 'expired', responded_at = now() where id = r.id;
    raise exception 'This match request has expired';
  end if;

  if not p_accept then
    update public.match_requests set status = 'declined', responded_at = now() where id = r.id;
    return r.id;
  end if;

  perform pg_advisory_xact_lock(817263514);

  update public.match_requests set status = 'accepted', responded_at = now() where id = r.id;
  update public.match_requests
  set status = 'declined', responded_at = now()
  where requester_id = r.opponent_id
    and opponent_id = r.requester_id
    and status = 'pending'
    and id <> r.id;

  insert into public.matches(match_request_id, player_a_id, player_b_id)
  values(r.id, r.requester_id, r.opponent_id)
  returning id into v_match;

  insert into public.chat_groups(name, created_by, kind, direct_key, locked, member_limit)
  values('1-v-1 Match Chat', auth.uid(), 'match', 'match:' || v_match::text, false, 2)
  returning id into v_group;

  insert into public.chat_group_members(group_id, user_id, last_seen_at)
  values(v_group, r.requester_id, now()), (v_group, r.opponent_id, now())
  on conflict do nothing;

  insert into public.match_conversations(match_id, conversation_id)
  values(v_match, v_group);

  -- Ready state is independent from match history. Both players remain eligible
  -- for Ready Match as long as their presence heartbeat remains fresh.
  return v_match;
end;
$$;

revoke execute on function public.set_ready_player(boolean) from anon, authenticated;
grant execute on function public.set_ready_player(boolean) to authenticated;
revoke execute on function public.send_match_request(uuid) from anon, authenticated;
grant execute on function public.send_match_request(uuid) to authenticated;
revoke execute on function public.respond_match_request(uuid, boolean) from anon, authenticated;
grant execute on function public.respond_match_request(uuid, boolean) to authenticated;

commit;
