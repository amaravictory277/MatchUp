create or replace function public.create_group_tournament(p_name text,p_description text,p_format text,p_max_players smallint,p_starts_at timestamptz,p_visibility text,p_entry_information text,p_game_title text,p_prize_pool numeric,p_group_id uuid,p_participant_ids uuid[]) returns uuid language plpgsql security definer set search_path=public as $$
declare t uuid; pid uuid; member_count integer;
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
 insert into public.tournaments(organizer_id,name,description,format,max_players,starts_at,visibility,entry_information,game_title,prize_pool) values(auth.uid(),btrim(p_name),coalesce(p_description,''),p_format,p_max_players,p_starts_at,p_visibility,coalesce(p_entry_information,''),coalesce(nullif(btrim(p_game_title),''),'Football'),p_prize_pool) returning id into t;
 insert into public.tournament_participants(tournament_id,user_id,invited_by,source_group_id) select t,pid,auth.uid(),p_group_id from unnest(p_participant_ids) pid;
 return t;
end; $$;
grant execute on function public.create_group_tournament(text,text,text,smallint,timestamptz,text,text,text,numeric,uuid,uuid[]) to authenticated;
