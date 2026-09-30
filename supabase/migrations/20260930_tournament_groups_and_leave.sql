begin;

alter table public.chat_groups drop constraint if exists chat_groups_kind_check;
alter table public.chat_groups add constraint chat_groups_kind_check check (kind in ('general','private','group','match','tournament'));
alter table public.chat_groups add column if not exists tournament_id uuid references public.tournaments(id) on delete cascade;
create unique index if not exists chat_groups_tournament_unique on public.chat_groups(tournament_id) where kind='tournament' and tournament_id is not null;
create index if not exists chat_groups_tournament_idx on public.chat_groups(tournament_id);

alter table public.tournaments add column if not exists tournament_group_id uuid references public.chat_groups(id) on delete set null;
create unique index if not exists tournaments_group_unique on public.tournaments(tournament_group_id) where tournament_group_id is not null;

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
 insert into public.chat_groups(name,created_by,kind,locked,member_limit,tournament_id) values(btrim(p_name),auth.uid(),'tournament',false,128,t) returning id into g;
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
grant execute on function public.create_tournament_atomic(text,text,text,smallint,timestamptz,text,text,text,numeric,jsonb,jsonb) to authenticated;

create or replace function public.leave_tournament(p_tournament uuid) returns uuid language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 update public.tournament_players set status='withdrawn' where tournament_id=p_tournament and player_id=auth.uid() and status='joined';
 if not found then raise exception 'You are not a joined participant in this tournament'; end if;
 delete from public.chat_group_members where group_id=(select tournament_group_id from public.tournaments where id=p_tournament) and user_id=auth.uid();
 update public.tournaments set status='open' where id=p_tournament and status='full' and (select count(*) from public.tournament_players tp where tp.tournament_id=p_tournament and tp.status='joined') < max_players;
 return p_tournament;
end; $$;
grant execute on function public.leave_tournament(uuid) to authenticated;

create or replace function public.join_tournament(p_tournament uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare t public.tournaments%rowtype; joined_count integer; group_id uuid;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 select * into t from public.tournaments where id=p_tournament for update;
 if not found then raise exception 'Tournament not found'; end if;
 if t.visibility <> 'public' then raise exception 'This tournament is not open for public joining'; end if;
 if t.status not in ('open','full') then raise exception 'This tournament is not accepting players'; end if;
 if exists(select 1 from public.tournament_players where tournament_id=p_tournament and player_id=auth.uid() and status='joined') then
  group_id:=t.tournament_group_id;
  if group_id is not null then insert into public.chat_group_members(group_id,user_id,last_seen_at) values(group_id,auth.uid(),now()) on conflict do nothing; end if;
  return p_tournament;
 end if;
 select count(*) into joined_count from public.tournament_players where tournament_id=p_tournament and status='joined';
 if joined_count >= t.max_players then update public.tournaments set status='full' where id=p_tournament and status='open'; raise exception 'Tournament is full'; end if;
 insert into public.tournament_players(tournament_id,player_id,status) values(p_tournament,auth.uid(),'joined') on conflict (tournament_id,player_id) do update set status='joined',joined_at=now();
 group_id:=t.tournament_group_id;
 if group_id is not null then insert into public.chat_group_members(group_id,user_id,last_seen_at) values(group_id,auth.uid(),now()) on conflict do nothing; end if;
 if joined_count + 1 >= t.max_players then update public.tournaments set status='full' where id=p_tournament; end if;
 return p_tournament;
end; $$;
grant execute on function public.join_tournament(uuid) to authenticated;

create or replace function public.get_tournament_group(p_tournament uuid) returns uuid language sql security definer set search_path=public as $$ select t.tournament_group_id from public.tournaments t where t.id=p_tournament and exists(select 1 from public.tournament_players tp where tp.tournament_id=t.id and tp.player_id=auth.uid() and tp.status='joined'); $$;
grant execute on function public.get_tournament_group(uuid) to authenticated;

create or replace function public.get_tournament_group_info(p_tournament uuid) returns table(group_id uuid,tournament_id uuid,tournament_name text,participant_count integer) language sql security definer set search_path=public as $$ select t.tournament_group_id,t.id,t.name,(select count(*)::integer from public.tournament_players tp where tp.tournament_id=t.id and tp.status='joined') from public.tournaments t where t.id=p_tournament and exists(select 1 from public.tournament_players tp where tp.tournament_id=t.id and tp.player_id=auth.uid() and tp.status='joined'); $$;
grant execute on function public.get_tournament_group_info(uuid) to authenticated;


drop policy if exists tournament_chat_group_select on public.chat_groups;
create policy tournament_chat_group_select on public.chat_groups for select to authenticated using (
  kind <> 'tournament'
  or created_by=auth.uid()
  or exists(select 1 from public.tournament_players tp where tp.tournament_id=chat_groups.tournament_id and tp.player_id=auth.uid() and tp.status='joined')
);

drop policy if exists tournament_chat_member_select on public.chat_group_members;
create policy tournament_chat_member_select on public.chat_group_members for select to authenticated using (
  user_id=auth.uid()
  or exists(select 1 from public.chat_groups g where g.id=chat_group_members.group_id and (
    g.kind <> 'tournament'
    or exists(select 1 from public.tournament_players tp where tp.tournament_id=g.tournament_id and tp.player_id=auth.uid() and tp.status='joined')
  ))
);

drop policy if exists tournament_chat_member_insert on public.chat_group_members;
create policy tournament_chat_member_insert on public.chat_group_members for insert to authenticated with check (
  exists(select 1 from public.chat_groups g where g.id=chat_group_members.group_id and (
    g.kind <> 'tournament'
    or exists(select 1 from public.tournament_players tp where tp.tournament_id=g.tournament_id and tp.player_id=auth.uid() and tp.status='joined')
  ))
);

drop policy if exists tournament_chat_member_delete on public.chat_group_members;
create policy tournament_chat_member_delete on public.chat_group_members for delete to authenticated using (
  user_id=auth.uid() or exists(select 1 from public.chat_groups g where g.id=chat_group_members.group_id and g.created_by=auth.uid())
);

drop policy if exists tournament_chat_message_select on public.chat_messages;
create policy tournament_chat_message_select on public.chat_messages for select to authenticated using (
  exists(select 1 from public.chat_groups g where g.id=chat_messages.group_id and (
    g.kind <> 'tournament'
    or exists(select 1 from public.tournament_players tp where tp.tournament_id=g.tournament_id and tp.player_id=auth.uid() and tp.status='joined')
  ))
);

drop policy if exists tournament_chat_message_insert on public.chat_messages;
create policy tournament_chat_message_insert on public.chat_messages for insert to authenticated with check (
  sender_id=auth.uid()
  and exists(select 1 from public.chat_group_members m where m.group_id=chat_messages.group_id and m.user_id=auth.uid())
  and exists(select 1 from public.chat_groups g where g.id=chat_messages.group_id and (
    g.kind <> 'tournament'
    or exists(select 1 from public.tournament_players tp where tp.tournament_id=g.tournament_id and tp.player_id=auth.uid() and tp.status='joined')
  ))
);

commit;
