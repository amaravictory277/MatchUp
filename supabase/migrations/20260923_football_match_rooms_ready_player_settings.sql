begin;

alter table public.profiles
  add column if not exists gaming_team_name text,
  add column if not exists player_rating smallint,
  add column if not exists squad_formation text;

do $$
begin
  alter table public.profiles add constraint profiles_player_rating_check
    check (player_rating is null or player_rating between 1 and 99);
exception when duplicate_object then null;
end $$;

create table if not exists public.football_fixture_cache (
  fixture_id text primary key,
  provider text not null default 'api-football',
  payload jsonb not null,
  starts_at timestamptz,
  status_code text,
  league_name text,
  home_team_name text,
  away_team_name text,
  home_score integer,
  away_score integer,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists football_fixture_cache_starts_at_idx
  on public.football_fixture_cache (starts_at);
create index if not exists football_fixture_cache_status_idx
  on public.football_fixture_cache (status_code);

create table if not exists public.football_match_rooms (
  id uuid primary key default gen_random_uuid(),
  fixture_id text not null unique references public.football_fixture_cache(fixture_id) on delete cascade,
  canonical_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.football_match_room_members (
  room_id uuid not null references public.football_match_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists football_match_room_members_user_idx
  on public.football_match_room_members (user_id);

create table if not exists public.football_match_room_settings (
  room_id uuid not null references public.football_match_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  custom_name text,
  primary key (room_id, user_id)
);

create table if not exists public.football_match_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.football_match_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  reply_to_id uuid references public.football_match_messages(id) on delete set null,
  body text not null check (
    char_length(trim(body)) between 1 and 2000
    and body !~* '(https?://|www\\.|[a-z0-9.-]+\\.(com|net|org|io|co|ng)(/|\\s|$))'
  ),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists football_match_messages_room_created_idx
  on public.football_match_messages (room_id, created_at desc);

create table if not exists public.football_match_message_reactions (
  message_id uuid not null references public.football_match_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('❤️','😂','🔥','👏','😡','⚽')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table if not exists public.football_match_votes (
  fixture_id text not null references public.football_fixture_cache(fixture_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  team text not null check (team in ('home','away')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (fixture_id, user_id)
);

create index if not exists football_match_votes_fixture_idx
  on public.football_match_votes (fixture_id);

alter table public.football_fixture_cache enable row level security;
alter table public.football_match_rooms enable row level security;
alter table public.football_match_room_members enable row level security;
alter table public.football_match_room_settings enable row level security;
alter table public.football_match_messages enable row level security;
alter table public.football_match_message_reactions enable row level security;
alter table public.football_match_votes enable row level security;

drop policy if exists football_fixture_cache_public_read on public.football_fixture_cache;
create policy football_fixture_cache_public_read
  on public.football_fixture_cache for select
  to anon, authenticated
  using (true);

drop policy if exists football_match_rooms_public_read on public.football_match_rooms;
create policy football_match_rooms_public_read
  on public.football_match_rooms for select
  to authenticated
  using (true);

drop policy if exists football_match_room_members_own_read on public.football_match_room_members;
create policy football_match_room_members_own_read
  on public.football_match_room_members for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists football_match_room_settings_own_read on public.football_match_room_settings;
create policy football_match_room_settings_own_read
  on public.football_match_room_settings for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists football_match_room_settings_own_insert on public.football_match_room_settings;
create policy football_match_room_settings_own_insert
  on public.football_match_room_settings for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists football_match_room_settings_own_update on public.football_match_room_settings;
create policy football_match_room_settings_own_update
  on public.football_match_room_settings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists football_match_messages_member_read on public.football_match_messages;
create policy football_match_messages_member_read
  on public.football_match_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.football_match_room_members m
      where m.room_id = football_match_messages.room_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists football_match_messages_member_insert on public.football_match_messages;
create policy football_match_messages_member_insert
  on public.football_match_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.football_match_room_members m
      where m.room_id = football_match_messages.room_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists football_match_messages_own_update on public.football_match_messages;
create policy football_match_messages_own_update
  on public.football_match_messages for update
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

drop policy if exists football_match_messages_own_delete on public.football_match_messages;
create policy football_match_messages_own_delete
  on public.football_match_messages for delete
  to authenticated
  using (sender_id = auth.uid());

drop policy if exists football_match_message_reactions_member_read on public.football_match_message_reactions;
create policy football_match_message_reactions_member_read
  on public.football_match_message_reactions for select
  to authenticated
  using (
    exists (
      select 1
      from public.football_match_messages msg
      join public.football_match_room_members m on m.room_id = msg.room_id
      where msg.id = football_match_message_reactions.message_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists football_match_message_reactions_own_insert on public.football_match_message_reactions;
create policy football_match_message_reactions_own_insert
  on public.football_match_message_reactions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists football_match_message_reactions_own_delete on public.football_match_message_reactions;
create policy football_match_message_reactions_own_delete
  on public.football_match_message_reactions for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists football_match_votes_public_read on public.football_match_votes;
create policy football_match_votes_public_read
  on public.football_match_votes for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.football_fixture_cache from anon, authenticated;
revoke insert, update, delete on public.football_match_rooms from anon, authenticated;
revoke insert, update, delete on public.football_match_room_members from anon, authenticated;
revoke insert, update, delete on public.football_match_votes from anon, authenticated;

create or replace function public.get_or_create_match_room(p_fixture_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_room uuid;
  v_name text;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(home_team_name,'Home') || ' vs ' || coalesce(away_team_name,'Away')
    into v_name
  from public.football_fixture_cache
  where fixture_id = p_fixture_id;

  if v_name is null then
    raise exception 'Fixture is not available';
  end if;

  select id into v_room
  from public.football_match_rooms
  where fixture_id = p_fixture_id
  limit 1;

  if v_room is null then
    insert into public.football_match_rooms(fixture_id, canonical_name)
    values (p_fixture_id, v_name)
    returning id into v_room;
  end if;

  insert into public.football_match_room_members(room_id, user_id)
  values (v_room, (select auth.uid()))
  on conflict (room_id, user_id) do nothing;

  return v_room;
end;
$function$;

create or replace function public.cast_match_vote(p_fixture_id text, p_team text)
returns table (
  home_votes bigint,
  away_votes bigint,
  total_votes bigint,
  home_percent numeric,
  away_percent numeric,
  my_vote text
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;
  if p_team not in ('home','away') then
    raise exception 'Invalid team vote';
  end if;
  if not exists (
    select 1 from public.football_fixture_cache
    where fixture_id = p_fixture_id
  ) then
    raise exception 'Fixture is not available';
  end if;

  insert into public.football_match_votes(fixture_id,user_id,team)
  values (p_fixture_id,(select auth.uid()),p_team)
  on conflict (fixture_id,user_id)
  do update set team=excluded.team, updated_at=now();

  return query
  with counts as (
    select
      count(*) filter (where team='home') as home_votes,
      count(*) filter (where team='away') as away_votes,
      count(*) as total_votes
    from public.football_match_votes
    where fixture_id=p_fixture_id
  )
  select
    home_votes,
    away_votes,
    total_votes,
    case when total_votes=0 then 0 else round(home_votes::numeric*100/total_votes,1) end,
    case when total_votes=0 then 0 else round(away_votes::numeric*100/total_votes,1) end,
    p_team;
end;
$function$;

create or replace function public.leave_match_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  delete from public.football_match_room_members
  where room_id=p_room_id and user_id=(select auth.uid());
  return found;
end;
$function$;

create or replace function public.set_match_room_mute(p_room_id uuid, p_muted boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  update public.football_match_room_members
  set muted=p_muted
  where room_id=p_room_id and user_id=(select auth.uid());
  return found;
end;
$function$;

create or replace function public.set_match_room_name(p_room_id uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare v_name text;
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  v_name := nullif(trim(p_name),'');
  if v_name is null then
    delete from public.football_match_room_settings
    where room_id=p_room_id and user_id=(select auth.uid());
    return null;
  end if;
  if char_length(v_name)>80 then raise exception 'Room name is too long'; end if;
  if not exists (
    select 1 from public.football_match_room_members
    where room_id=p_room_id and user_id=(select auth.uid())
  ) then raise exception 'Join the match room first'; end if;
  insert into public.football_match_room_settings(room_id,user_id,custom_name)
  values(p_room_id,(select auth.uid()),v_name)
  on conflict (room_id,user_id) do update set custom_name=excluded.custom_name;
  return v_name;
end;
$function$;

revoke all on function public.get_or_create_match_room(text) from public, anon;
revoke all on function public.cast_match_vote(text,text) from public, anon;
revoke all on function public.leave_match_room(uuid) from public, anon;
revoke all on function public.set_match_room_mute(uuid,boolean) from public, anon;
revoke all on function public.set_match_room_name(uuid,text) from public, anon;
grant execute on function public.get_or_create_match_room(text) to authenticated;
grant execute on function public.cast_match_vote(text,text) to authenticated;
grant execute on function public.leave_match_room(uuid) to authenticated;
grant execute on function public.set_match_room_mute(uuid,boolean) to authenticated;
grant execute on function public.set_match_room_name(uuid,text) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.football_match_messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.football_match_message_reactions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.football_match_votes;
exception when duplicate_object then null; end $$;

commit;
