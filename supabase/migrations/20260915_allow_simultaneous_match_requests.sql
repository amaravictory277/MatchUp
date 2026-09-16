begin;

drop index if exists public.match_requests_one_pending_pair;
create unique index if not exists match_requests_one_pending_direction
  on public.match_requests (requester_id, opponent_id)
  where status = 'pending';

create or replace function public.send_match_request(p_opponent_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.expire_match_requests();
  perform pg_advisory_xact_lock(817263514);
  if p_opponent_id is null or p_opponent_id = auth.uid() then raise exception 'Choose another ready player'; end if;
  if not exists (
    select 1 from public.ready_match_presence rp join public.profiles p on p.id = rp.user_id
    where rp.user_id = p_opponent_id and rp.ready = true
      and rp.last_heartbeat_at > now() - interval '20 seconds' and p.ready_player_enabled = true
  ) then raise exception 'That player is no longer available in Ready Match'; end if;
  if not exists (
    select 1 from public.ready_match_presence rp
    where rp.user_id = auth.uid() and rp.ready = true and rp.last_heartbeat_at > now() - interval '20 seconds'
  ) then raise exception 'Turn on Ready Player before sending a match request'; end if;
  if exists (select 1 from public.matches where status = 'active' and (player_a_id = auth.uid() or player_b_id = auth.uid())) then raise exception 'You already have an active match'; end if;
  if exists (select 1 from public.matches where status = 'active' and (player_a_id = p_opponent_id or player_b_id = p_opponent_id)) then raise exception 'That player is already in an active match'; end if;
  insert into public.match_requests(requester_id, opponent_id, expires_at)
  values (auth.uid(), p_opponent_id, now() + interval '5 minutes') returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'A match request is already pending in that direction';
end;
$$;

create or replace function public.respond_match_request(p_request_id uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = public
as $$
declare r public.match_requests%rowtype; v_match uuid; v_group uuid; a text; b text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.expire_match_requests();
  select * into r from public.match_requests
  where id = p_request_id and status = 'pending' and opponent_id = auth.uid() for update;
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
  if exists (
    select 1 from public.matches
    where status = 'active'
      and (player_a_id in (auth.uid(), r.requester_id) or player_b_id in (auth.uid(), r.requester_id))
  ) then raise exception 'You or the requester already has an active match'; end if;

  update public.match_requests set status = 'accepted', responded_at = now() where id = r.id;
  update public.match_requests
  set status = 'declined', responded_at = now()
  where requester_id = r.opponent_id and opponent_id = r.requester_id and status = 'pending' and id <> r.id;

  insert into public.matches(match_request_id, player_a_id, player_b_id)
  values(r.id, r.requester_id, r.opponent_id) returning id into v_match;

  if r.requester_id::text < r.opponent_id::text then a := r.requester_id::text; b := r.opponent_id::text;
  else a := r.opponent_id::text; b := r.requester_id::text; end if;
  select id into v_group from public.chat_groups where kind = 'private' and direct_key = 'private:' || a || ':' || b limit 1;
  if v_group is null then
    insert into public.chat_groups(name, created_by, kind, direct_key, locked, member_limit)
    values('Private chat', auth.uid(), 'private', 'private:' || a || ':' || b, false, 2) returning id into v_group;
  end if;
  insert into public.chat_group_members(group_id, user_id, last_seen_at)
  values(v_group, r.requester_id, now()), (v_group, r.opponent_id, now()) on conflict do nothing;
  insert into public.match_conversations(match_id, conversation_id)
  values(v_match, v_group) on conflict (match_id) do update set conversation_id = excluded.conversation_id;
  update public.profiles set ready_player_enabled = false, ready_player_updated_at = now()
  where id in (r.requester_id, r.opponent_id);
  delete from public.ready_match_presence where user_id in (r.requester_id, r.opponent_id);
  return v_match;
end;
$$;

commit;
