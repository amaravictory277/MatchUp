begin;

insert into public.tournament_players(tournament_id, player_id, status)
select t.id, t.organizer_id, 'joined'
from public.tournaments t
on conflict (tournament_id, player_id) do update
set status = 'joined', joined_at = now();

create or replace function public.create_tournament_atomic(p_name text,p_description text,p_format text,p_max_players smallint,p_starts_at timestamptz,p_visibility text,p_entry_information text,p_game_title text,p_prize_pool numeric,p_teams jsonb,p_fixtures jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare t uuid; g uuid; row jsonb; f jsonb; home_id uuid; away_id uuid; builtin_id text;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Your MatchUp profile is not ready yet. Please refresh and try again.'; end if;
 if char_length(btrim(p_name))<3 then raise exception 'Tournament name must be at least 3 characters.'; end if;
 if p_format not in ('league','round_robin','group_stage','knockout','single_elimination','double_elimination','groups_knockout') then raise exception 'Unsupported tournament format.'; end if;
 if p_visibility not in ('public','private','invite_only') then raise exception 'Unsupported tournament visibility.'; end if;
 if p_max_players<2 or p_max_players>128 then raise exception 'Maximum teams must be between 2 and 128.'; end if;
 if p_prize_pool is null or p_prize_pool<0 then raise exception 'Prize pool cannot be negative.'; end if;
 if jsonb_array_length(coalesce(p_teams,'[]'::jsonb))<2 or jsonb_array_length(p_teams)>128 then raise exception 'Tournament must have between 2 and 128 teams.'; end if;
 insert into public.tournaments(organizer_id,name,description,format,max_players,starts_at,visibility,entry_information,game_title,prize_pool) values(auth.uid(),btrim(p_name),coalesce(p_description,''),p_format,p_max_players,p_starts_at,p_visibility,coalesce(p_entry_information,''),coalesce(nullif(btrim(p_game_title),''),'Football'),p_prize_pool) returning id into t;
 insert into public.tournament_players(tournament_id,player_id,status) values(t,auth.uid(),'joined');
 insert into public.chat_groups(name,created_by,kind,locked,member_limit,tournament_id) values(btrim(p_name),auth.uid(),'tournament',false,p_max_players,t) returning id into g;
 update public.tournaments set tournament_group_id=g where id=t;
 insert into public.chat_group_members(group_id,user_id,last_seen_at) values(g,auth.uid(),now()) on conflict do nothing;
 for row in select value from jsonb_array_elements(p_teams) loop
  builtin_id:=nullif(row->>'builtin_team_id','');
  if builtin_id is not null and not exists(select 1 from public.football_teams ft where ft.id=builtin_id) then builtin_id:=null; end if;
  insert into public.tournament_teams(tournament_id,builtin_team_id,team_name,short_name,country,league,city,crest_path,seed) values(t,builtin_id,btrim(row->>'team_name'),btrim(row->>'short_name'),coalesce(row->>'country',''),coalesce(row->>'league',''),coalesce(row->>'city',''),nullif(row->>'crest_path',''),(row->>'seed')::smallint);
 end loop;
 for f in select value from jsonb_array_elements(coalesce(p_fixtures,'[]'::jsonb)) loop
  select id into home_id from public.tournament_teams where tournament_id=t and seed=(f->>'home_seed')::smallint limit 1;
  select id into away_id from public.tournament_teams where tournament_id=t and seed=(f->>'away_seed')::smallint limit 1;
  if home_id is null or away_id is null then continue; end if;
  insert into public.fixtures(tournament_id,round_number,position,round_label,group_name,home_team_id,away_team_id,status) values(t,(f->>'round_number')::smallint,(f->>'position')::smallint,coalesce(f->>'round_label',''),nullif(f->>'group_name',''),home_id,away_id,'pending');
 end loop;
 return t;
end; $$;

revoke execute on function public.create_tournament_atomic(text,text,text,smallint,timestamptz,text,text,text,numeric,jsonb,jsonb) from public, anon;
grant execute on function public.create_tournament_atomic(text,text,text,smallint,timestamptz,text,text,text,numeric,jsonb,jsonb) to authenticated;

create or replace function public.is_tournament_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.chat_group_members m
    join public.chat_groups g on g.id = m.group_id
    join public.tournament_players tp on tp.tournament_id = g.tournament_id
    where m.group_id = p_group_id
      and m.user_id = (select auth.uid())
      and g.kind = 'tournament'
      and tp.player_id = (select auth.uid())
      and tp.status = 'joined'
  );
$$;

revoke execute on function public.is_tournament_group_member(uuid) from public, anon;
grant execute on function public.is_tournament_group_member(uuid) to authenticated;

drop policy if exists tournament_chat_group_select on public.chat_groups;
create policy tournament_chat_group_select
on public.chat_groups
for select to authenticated
using (
  kind <> 'tournament'
  or (select public.is_tournament_group_member(id))
);

drop policy if exists tournament_chat_member_select on public.chat_group_members;
create policy tournament_chat_member_select
on public.chat_group_members
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.chat_groups g
    where g.id = chat_group_members.group_id and g.kind <> 'tournament'
  )
  or (select public.is_tournament_group_member(group_id))
);

drop policy if exists tournament_chat_member_insert on public.chat_group_members;
create policy tournament_chat_member_insert
on public.chat_group_members
for insert to authenticated
with check (
  exists (
    select 1 from public.chat_groups g
    where g.id = chat_group_members.group_id
      and (
        g.kind <> 'tournament'
        or (
          user_id = (select auth.uid())
          and (select public.is_tournament_group_member(group_id))
        )
      )
  )
);

drop policy if exists tournament_chat_member_delete on public.chat_group_members;
create policy tournament_chat_member_delete
on public.chat_group_members
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.chat_groups g
    where g.id = chat_group_members.group_id
      and (
        g.kind <> 'tournament'
        or (
          g.created_by = (select auth.uid())
          and (select public.is_tournament_group_member(g.id))
        )
      )
  )
);

drop policy if exists tournament_chat_message_select on public.chat_messages;
create policy tournament_chat_message_select
on public.chat_messages
for select to authenticated
using (
  exists (
    select 1 from public.chat_groups g
    where g.id = chat_messages.group_id
      and (
        g.kind <> 'tournament'
        or (select public.is_tournament_group_member(g.id))
      )
  )
);

drop policy if exists tournament_chat_message_insert on public.chat_messages;
create policy tournament_chat_message_insert
on public.chat_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.chat_group_members m
    where m.group_id = chat_messages.group_id
      and m.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.chat_groups g
    where g.id = chat_messages.group_id
      and (
        g.kind <> 'tournament'
        or (select public.is_tournament_group_member(g.id))
      )
  )
);

commit;
