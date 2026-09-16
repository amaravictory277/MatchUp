begin;

create extension if not exists pg_cron;

alter table public.match_requests
  add column if not exists expires_at timestamptz;

update public.match_requests
set expires_at = created_at + interval '5 minutes'
where expires_at is null;

alter table public.match_requests
  alter column expires_at set default (now() + interval '5 minutes'),
  alter column expires_at set not null;

create index if not exists match_requests_pending_expiry_idx
  on public.match_requests (expires_at)
  where status = 'pending';

create table if not exists public.ready_match_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  session_id uuid not null,
  ready boolean not null default false,
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now()
);

create index if not exists ready_match_presence_heartbeat_idx
  on public.ready_match_presence (last_heartbeat_at desc)
  where ready = true;

alter table public.ready_match_presence enable row level security;
alter table public.ready_match_presence replica identity full;

revoke all on table public.ready_match_presence from anon, authenticated;
grant select on table public.ready_match_presence to authenticated;

drop policy if exists ready_match_presence_select on public.ready_match_presence;
create policy ready_match_presence_select
  on public.ready_match_presence
  for select
  to authenticated
  using (true);

do $$ begin
  alter publication supabase_realtime add table public.ready_match_presence;
exception when duplicate_object then null;
end $$;

create or replace function public.start_ready_match_presence()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  insert into public.ready_match_presence(user_id, session_id, ready, started_at, last_heartbeat_at)
  values (auth.uid(), v_session, false, now(), now())
  on conflict (user_id) do update
    set session_id = excluded.session_id,
        ready = false,
        started_at = excluded.started_at,
        last_heartbeat_at = excluded.last_heartbeat_at;

  update public.profiles
  set ready_player_enabled = false, ready_player_updated_at = now()
  where id = auth.uid();

  return v_session;
end;
$$;

create or replace function public.heartbeat_ready_match_presence(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.ready_match_presence
  set last_heartbeat_at = now()
  where user_id = auth.uid() and session_id = p_session_id;
  return found;
end;
$$;

create or replace function public.stop_ready_match_presence(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from public.ready_match_presence
  where user_id = auth.uid() and session_id = p_session_id;
  update public.profiles
  set ready_player_enabled = false, ready_player_updated_at = now()
  where id = auth.uid();
end;
$$;

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
    and not exists (
      select 1 from public.matches m
      where m.status = 'active' and (m.player_a_id = p.id or m.player_b_id = p.id)
    )
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

create or replace function public.expire_match_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.match_requests
  set status = 'expired', responded_at = now()
  where status = 'pending' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
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
  if exists (
    select 1 from public.matches
    where status = 'active' and (player_a_id = auth.uid() or player_b_id = auth.uid())
  ) then raise exception 'You already have an active match'; end if;
  if exists (
    select 1 from public.matches
    where status = 'active' and (player_a_id = p_opponent_id or player_b_id = p_opponent_id)
  ) then raise exception 'That player is already in an active match'; end if;

  insert into public.match_requests(requester_id, opponent_id, expires_at)
  values (auth.uid(), p_opponent_id, now() + interval '5 minutes')
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'A match request is already pending between you';
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
  a text;
  b text;
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
  if exists (
    select 1 from public.matches
    where status = 'active'
      and (player_a_id in (auth.uid(), r.requester_id) or player_b_id in (auth.uid(), r.requester_id))
  ) then raise exception 'You or the requester already has an active match'; end if;
  if auth.uid() = r.requester_id then raise exception 'Invalid match request'; end if;

  update public.match_requests set status = 'accepted', responded_at = now() where id = r.id;
  insert into public.matches(match_request_id, player_a_id, player_b_id)
  values(r.id, r.requester_id, r.opponent_id)
  returning id into v_match;

  if r.requester_id::text < r.opponent_id::text then
    a := r.requester_id::text; b := r.opponent_id::text;
  else
    a := r.opponent_id::text; b := r.requester_id::text;
  end if;

  select id into v_group from public.chat_groups
  where kind = 'private' and direct_key = 'private:' || a || ':' || b limit 1;
  if v_group is null then
    insert into public.chat_groups(name, created_by, kind, direct_key, locked, member_limit)
    values('Private chat', auth.uid(), 'private', 'private:' || a || ':' || b, false, 2)
    returning id into v_group;
  end if;

  insert into public.chat_group_members(group_id, user_id, last_seen_at)
  values(v_group, r.requester_id, now()), (v_group, r.opponent_id, now())
  on conflict do nothing;

  insert into public.match_conversations(match_id, conversation_id)
  values(v_match, v_group)
  on conflict (match_id) do update set conversation_id = excluded.conversation_id;

  update public.profiles set ready_player_enabled = false, ready_player_updated_at = now()
  where id in (r.requester_id, r.opponent_id);
  delete from public.ready_match_presence where user_id in (r.requester_id, r.opponent_id);

  return v_match;
end;
$$;

create or replace function public.get_or_create_private_chat(p_friend uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare g uuid; k text; a text; b text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_friend is null or p_friend = auth.uid() then raise exception 'Choose another player'; end if;
  if not public.is_chat_friend(auth.uid(), p_friend)
     and not exists (
       select 1 from public.matches m
       where m.status = 'active'
         and ((m.player_a_id = auth.uid() and m.player_b_id = p_friend)
           or (m.player_a_id = p_friend and m.player_b_id = auth.uid()))
     ) then
    raise exception 'You can only message an accepted friend or active match opponent';
  end if;

  if auth.uid()::text < p_friend::text then a := auth.uid()::text; b := p_friend::text;
  else a := p_friend::text; b := auth.uid()::text; end if;
  k := 'private:' || a || ':' || b;

  select id into g from public.chat_groups where kind = 'private' and direct_key = k limit 1;
  if g is null then
    begin
      insert into public.chat_groups(name, created_by, kind, direct_key, locked, member_limit)
      values('Private chat', auth.uid(), 'private', k, false, 2)
      returning id into g;
    exception when unique_violation then
      select id into g from public.chat_groups where kind = 'private' and direct_key = k limit 1;
    end;
  end if;

  insert into public.chat_group_members(group_id, user_id, last_seen_at)
  values(g, auth.uid(), now()), (g, p_friend, now()) on conflict do nothing;
  return g;
end;
$$;

create or replace function public.match_request_realtime_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare actor_name text;
begin
  if tg_op='INSERT' and new.status='pending' then
    select coalesce(display_name,username,'MatchUp player') into actor_name from public.profiles where id=new.requester_id;
    insert into public.notifications(recipient_id,kind,payload)
    values(new.opponent_id,'match_request',jsonb_build_object(
      'actor_id',new.requester_id,
      'message',actor_name||' challenged you to a match.',
      'entity_type','match_request','entity_id',new.id::text,'request_id',new.id,
      'event_key','match_request:'||new.id||':pending'))
    on conflict do nothing;
  elsif tg_op='UPDATE' and old.status='pending' and new.status in ('accepted','declined','expired') then
    select coalesce(display_name,username,'MatchUp player') into actor_name from public.profiles where id=new.opponent_id;
    insert into public.notifications(recipient_id,kind,payload)
    values(new.requester_id,
      case when new.status='accepted' then 'match_request_accepted' when new.status='expired' then 'match_request_expired' else 'match_request_declined' end,
      jsonb_build_object(
        'actor_id',new.opponent_id,
        'message',actor_name||case when new.status='accepted' then ' accepted your match challenge.' when new.status='expired' then 's match challenge expired.' else ' declined your match challenge.' end,
        'entity_type','match_request','entity_id',new.id::text,'request_id',new.id,
        'event_key','match_request:'||new.id||':'||new.status))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists match_requests_realtime_notifications on public.match_requests;
create trigger match_requests_realtime_notifications after insert or update on public.match_requests
for each row execute function public.match_request_realtime_notification();

revoke execute on function public.start_ready_match_presence() from anon, authenticated;
revoke execute on function public.heartbeat_ready_match_presence(uuid) from anon, authenticated;
revoke execute on function public.stop_ready_match_presence(uuid) from anon, authenticated;
revoke execute on function public.get_ready_players() from anon;
grant execute on function public.start_ready_match_presence() to authenticated;
grant execute on function public.heartbeat_ready_match_presence(uuid) to authenticated;
grant execute on function public.stop_ready_match_presence(uuid) to authenticated;
grant execute on function public.get_ready_players() to authenticated;

revoke execute on function public.set_ready_player(boolean) from anon, authenticated;
grant execute on function public.set_ready_player(boolean) to authenticated;
revoke execute on function public.send_match_request(uuid) from anon, authenticated;
grant execute on function public.send_match_request(uuid) to authenticated;
revoke execute on function public.respond_match_request(uuid, boolean) from anon, authenticated;
grant execute on function public.respond_match_request(uuid, boolean) to authenticated;
revoke execute on function public.get_or_create_private_chat(uuid) from anon, authenticated;
grant execute on function public.get_or_create_private_chat(uuid) to authenticated;

select cron.schedule('matchup-expire-match-requests', '*/10 * * * * *', $$select public.expire_match_requests();$$);

commit;
