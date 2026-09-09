alter table public.tournament_participants add column if not exists team_id uuid references public.tournament_teams(id) on delete set null;

create or replace function public.refresh_group_tournament_fixtures(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  confirmed_count integer;
  participant_count integer;
  i integer;
  j integer;
  round_no integer;
  pos integer;
  a uuid;
  b uuid;
  round_size integer;
  total_rounds integer;
  team_ids uuid[];
begin
  select id, format, max_players into t from public.tournaments where id = p_tournament_id for update;
  if not found then raise exception 'Tournament not found'; end if;
  select count(*) into confirmed_count from public.fixtures where tournament_id = p_tournament_id and status = 'confirmed';
  if confirmed_count > 0 then return; end if;
  select count(*) into participant_count from public.tournament_participants where tournament_id = p_tournament_id and status = 'accepted' and team_id is not null;
  if participant_count < 2 then
    delete from public.fixtures where tournament_id = p_tournament_id and status <> 'confirmed';
    return;
  end if;
  select array_agg(team_id order by seed nulls last, created_at) into team_ids
  from public.tournament_participants p
  join public.tournament_teams tt on tt.id = p.team_id
  where p.tournament_id = p_tournament_id and p.status = 'accepted' and p.team_id is not null;
  delete from public.fixtures where tournament_id = p_tournament_id and status <> 'confirmed';
  if t.format in ('league','round_robin','group_stage') then
    pos := 0;
    for i in 1..coalesce(array_length(team_ids,1),0) loop
      for j in (i+1)..coalesce(array_length(team_ids,1),0) loop
        pos := pos + 1;
        insert into public.fixtures(tournament_id,round_number,position,round_label,home_team_id,away_team_id,status)
        values(p_tournament_id,1,pos,'League Match',team_ids[i],team_ids[j],'pending');
      end loop;
    end loop;
  elsif t.format in ('knockout','single_elimination') then
    round_size := greatest(2, power(2, ceil(log(greatest(2, array_length(team_ids,1))) / log(2)))::integer);
    total_rounds := ceil(log(round_size) / log(2))::integer;
    for i in 1..(round_size/2) loop
      a := case when (2*i-1) <= array_length(team_ids,1) then team_ids[2*i-1] else null end;
      b := case when (2*i) <= array_length(team_ids,1) then team_ids[2*i] else null end;
      insert into public.fixtures(tournament_id,round_number,position,round_label,home_team_id,away_team_id,status)
      values(p_tournament_id,1,i,'Round 1',a,b,'pending');
    end loop;
    for round_no in 2..total_rounds loop
      round_size := round_size / 2;
      for pos in 1..round_size loop
        insert into public.fixtures(tournament_id,round_number,position,round_label,status)
        values(p_tournament_id,round_no,pos,'Round '||round_no,'pending');
      end loop;
    end loop;
  else
    pos := 0;
    for i in 1..coalesce(array_length(team_ids,1),0) loop
      for j in (i+1)..coalesce(array_length(team_ids,1),0) loop
        pos := pos + 1;
        insert into public.fixtures(tournament_id,round_number,position,round_label,home_team_id,away_team_id,status)
        values(p_tournament_id,1,pos,'Matchday',team_ids[i],team_ids[j],'pending');
      end loop;
    end loop;
  end if;
end;
$$;

grant execute on function public.refresh_group_tournament_fixtures(uuid) to authenticated;

drop function if exists public.create_group_tournament(text,text,text,smallint,timestamptz,text,text,text,numeric,uuid,uuid[]);
create or replace function public.create_group_tournament(p_name text,p_description text,p_format text,p_max_players smallint,p_starts_at timestamptz,p_visibility text,p_entry_information text,p_game_title text,p_prize_pool numeric,p_group_id uuid,p_participant_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare t uuid; pid uuid; member_count integer; creator_team_id uuid;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if not exists(select 1 from public.chat_group_members where group_id=p_group_id and user_id=auth.uid()) then raise exception 'You must be a member of this group to create its tournament'; end if;
 if not exists(select 1 from public.chat_groups where id=p_group_id and kind='group') then raise exception 'This is not a valid group'; end if;
 if coalesce(array_length(p_participant_ids,1),0)<1 then raise exception 'Select at least one group member'; end if;
 if auth.uid()=any(p_participant_ids) then raise exception 'Tournament invitees must be other group members'; end if;
 select count(*) into member_count from public.chat_group_members where group_id=p_group_id and user_id=any(p_participant_ids);
 if member_count<>coalesce(array_length(p_participant_ids,1),0) then raise exception 'Every tournament invitee must already be a member of the group'; end if;
 if char_length(btrim(p_name))<3 then raise exception 'Tournament name must be at least 3 characters'; end if;
 if p_max_players<2 or p_max_players>128 then raise exception 'Maximum players must be between 2 and 128'; end if;
 if p_prize_pool is null or p_prize_pool<0 then raise exception 'Prize pool cannot be negative'; end if;
 insert into public.tournaments(organizer_id,name,description,format,max_players,starts_at,visibility,entry_information,game_title,prize_pool)
 values(auth.uid(),btrim(p_name),coalesce(p_description,''),p_format,p_max_players,p_starts_at,p_visibility,coalesce(p_entry_information,''),coalesce(nullif(btrim(p_game_title),''),'Football'),p_prize_pool)
 returning id into t;
 insert into public.tournament_participants(tournament_id,user_id,invited_by,source_group_id,status) values(t,auth.uid(),auth.uid(),p_group_id,'accepted');
 insert into public.tournament_teams(tournament_id,team_name,short_name,country,league,city,seed)
 select t,coalesce(nullif(btrim(display_name),''),username,'MatchUp Player'),left(coalesce(nullif(btrim(username),''),display_name,'PLAYER'),8),'','MatchUp','',1)
 from public.profiles where id=auth.uid() returning id into creator_team_id;
 update public.tournament_participants set team_id=creator_team_id where tournament_id=t and user_id=auth.uid();
 insert into public.tournament_participants(tournament_id,user_id,invited_by,source_group_id,status)
 select t,pid,auth.uid(),p_group_id,'pending' from unnest(p_participant_ids) pid;
 return t;
end;
$$;

grant execute on function public.create_group_tournament(text,text,text,smallint,timestamptz,text,text,text,numeric,uuid,uuid[]) to authenticated;

drop function if exists public.respond_tournament_invite(uuid,boolean);
create or replace function public.respond_tournament_invite(p_participant_id uuid,p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare t uuid; g uuid; new_team_id uuid; next_seed smallint; p_name text; p_username text;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 select tournament_id, source_group_id into t,g from public.tournament_participants where id=p_participant_id and user_id=auth.uid() and status='pending' for update;
 if t is null then raise exception 'Tournament invitation is no longer pending'; end if;
 if not p_accept then
   update public.tournament_participants set status='declined',responded_at=now() where id=p_participant_id;
   perform public.refresh_group_tournament_fixtures(t);
   return t;
 end if;
 select display_name,username into p_name,p_username from public.profiles where id=auth.uid();
 select coalesce(max(seed),0)+1 into next_seed from public.tournament_teams where tournament_id=t;
 insert into public.tournament_teams(tournament_id,team_name,short_name,country,league,city,seed)
 values(t,coalesce(nullif(btrim(p_name),''),p_username,'MatchUp Player'),left(coalesce(nullif(btrim(p_username),''),p_name,'PLAYER'),8),'','MatchUp','',next_seed)
 returning id into new_team_id;
 update public.tournament_participants set status='accepted',responded_at=now(),team_id=new_team_id where id=p_participant_id;
 perform public.refresh_group_tournament_fixtures(t);
 return t;
end;
$$;

grant execute on function public.respond_tournament_invite(uuid,boolean) to authenticated;
