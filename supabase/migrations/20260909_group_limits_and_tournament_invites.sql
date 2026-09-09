begin;

alter table public.chat_groups add column if not exists member_limit smallint not null default 50;
alter table public.chat_groups drop constraint if exists chat_groups_member_limit_check;
alter table public.chat_groups add constraint chat_groups_member_limit_check check (member_limit between 2 and 50);
create index if not exists chat_groups_member_limit_idx on public.chat_groups(kind, member_limit);

drop function if exists public.create_chat_group(text,uuid[]);
create or replace function public.create_chat_group(p_name text,p_friend_ids uuid[] default '{}',p_member_limit smallint default 50) returns uuid language plpgsql security definer set search_path=public as $$
declare g uuid; invitee uuid;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if char_length(btrim(p_name))<2 or char_length(btrim(p_name))>80 then raise exception 'Group name must be between 2 and 80 characters'; end if;
 if p_member_limit<2 or p_member_limit>50 then raise exception 'Group limit must be between 2 and 50 people'; end if;
 if coalesce(array_length(p_friend_ids,1),0)+1>p_member_limit then raise exception 'Your selected people exceed the group limit'; end if;
 insert into public.chat_groups(name,created_by,kind,locked,member_limit) values(btrim(p_name),auth.uid(),'group',false,p_member_limit) returning id into g;
 insert into public.chat_group_members(group_id,user_id,last_seen_at) values(g,auth.uid(),now());
 foreach invitee in array coalesce(p_friend_ids,'{}') loop
  if invitee<>auth.uid() and exists(select 1 from public.profiles p where p.id=invitee) then insert into public.chat_group_invites(group_id,invited_by,invited_user_id) values(g,auth.uid(),invitee) on conflict do nothing; end if;
 end loop;
 return g;
end; $$;
grant execute on function public.create_chat_group(text,uuid[],smallint) to authenticated;

create or replace function public.invite_chat_group_member(p_group_id uuid,p_user_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare invitation uuid; current_count integer; pending_count integer; lim integer;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 select member_limit into lim from public.chat_groups g where g.id=p_group_id and g.created_by=auth.uid() and g.kind='group' and not g.locked;
 if lim is null then raise exception 'Only the group owner can invite members'; end if;
 if p_user_id=auth.uid() then raise exception 'You cannot invite yourself'; end if;
 if not exists(select 1 from public.profiles p where p.id=p_user_id) then raise exception 'User not found'; end if;
 if exists(select 1 from public.chat_group_members m where m.group_id=p_group_id and m.user_id=p_user_id) then raise exception 'User is already a group member'; end if;
 select count(*) into current_count from public.chat_group_members where group_id=p_group_id;
 select count(*) into pending_count from public.chat_group_invites where group_id=p_group_id and status='pending';
 if current_count+pending_count>=lim then raise exception 'This group is full. Increase the group limit before inviting anyone else.'; end if;
 insert into public.chat_group_invites(group_id,invited_by,invited_user_id,status) values(p_group_id,auth.uid(),p_user_id,'pending') on conflict (group_id,invited_user_id) where status='pending' do nothing returning id into invitation;
 if invitation is null then select id into invitation from public.chat_group_invites where group_id=p_group_id and invited_user_id=p_user_id and status='pending' limit 1; end if;
 return invitation;
end; $$;
grant execute on function public.invite_chat_group_member(uuid,uuid) to authenticated;

create or replace function public.respond_chat_group_invite(p_invite_id uuid,p_accept boolean) returns uuid language plpgsql security definer set search_path=public as $$
declare g uuid; new_status text; current_count integer; lim integer;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 select group_id into g from public.chat_group_invites where id=p_invite_id and invited_user_id=auth.uid() and status='pending' for update;
 if g is null then raise exception 'Invitation is no longer pending'; end if;
 new_status:=case when p_accept then 'accepted' else 'declined' end;
 if p_accept then select member_limit into lim from public.chat_groups where id=g and kind='group' for update; select count(*) into current_count from public.chat_group_members where group_id=g; if current_count>=lim then raise exception 'This group is full. Ask the admin to increase the limit.'; end if; end if;
 update public.chat_group_invites set status=new_status,responded_at=now() where id=p_invite_id;
 if p_accept then insert into public.chat_group_members(group_id,user_id,last_seen_at) values(g,auth.uid(),now()) on conflict do nothing; end if;
 return g;
end; $$;
grant execute on function public.respond_chat_group_invite(uuid,boolean) to authenticated;

create or replace function public.set_chat_group_member_limit(p_group_id uuid,p_member_limit smallint) returns smallint language plpgsql security definer set search_path=public as $$
declare current_count integer;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if p_member_limit<2 or p_member_limit>50 then raise exception 'Group limit must be between 2 and 50 people'; end if;
 if not exists(select 1 from public.chat_groups where id=p_group_id and created_by=auth.uid() and kind='group') then raise exception 'Only the group owner can change the group limit'; end if;
 select count(*) into current_count from public.chat_group_members where group_id=p_group_id;
 if p_member_limit<current_count then raise exception 'The new limit cannot be below the current member count'; end if;
 update public.chat_groups set member_limit=p_member_limit where id=p_group_id;
 return p_member_limit;
end; $$;
grant execute on function public.set_chat_group_member_limit(uuid,smallint) to authenticated;

create table if not exists public.tournament_participants(id uuid primary key default gen_random_uuid(),tournament_id uuid not null references public.tournaments(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,invited_by uuid not null references public.profiles(id) on delete cascade,source_group_id uuid references public.chat_groups(id) on delete set null,status text not null default 'pending' check(status in ('pending','accepted','declined')),created_at timestamptz not null default now(),responded_at timestamptz,unique(tournament_id,user_id));
create index if not exists tournament_participants_user_status_idx on public.tournament_participants(user_id,status,created_at desc);
create index if not exists tournament_participants_tournament_status_idx on public.tournament_participants(tournament_id,status);
alter table public.tournament_participants enable row level security;
drop policy if exists tournament_participants_select on public.tournament_participants;
create policy tournament_participants_select on public.tournament_participants for select to authenticated using(user_id=auth.uid() or invited_by=auth.uid() or exists(select 1 from public.tournaments t where t.id=public.tournament_participants.tournament_id and t.organizer_id=auth.uid()));
drop policy if exists tournament_participants_insert on public.tournament_participants;
create policy tournament_participants_insert on public.tournament_participants for insert to authenticated with check(invited_by=auth.uid() and exists(select 1 from public.tournaments t where t.id=public.tournament_participants.tournament_id and t.organizer_id=auth.uid()));
drop policy if exists tournament_participants_update on public.tournament_participants;
create policy tournament_participants_update on public.tournament_participants for update to authenticated using(user_id=auth.uid() or exists(select 1 from public.tournaments t where t.id=public.tournament_participants.tournament_id and t.organizer_id=auth.uid())) with check(user_id=auth.uid() or exists(select 1 from public.tournaments t where t.id=public.tournament_participants.tournament_id and t.organizer_id=auth.uid()));

create or replace function public.create_group_tournament(p_name text,p_description text,p_format text,p_max_players smallint,p_starts_at timestamptz,p_visibility text,p_entry_information text,p_game_title text,p_prize_pool numeric,p_group_id uuid,p_participant_ids uuid[]) returns uuid language plpgsql security definer set search_path=public as $$
declare t uuid; pid uuid; member_count integer;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if not exists(select 1 from public.chat_groups where id=p_group_id and kind='group' and created_by=auth.uid()) then raise exception 'Only the group owner can create a tournament from this group'; end if;
 if coalesce(array_length(p_participant_ids,1),0)<1 then raise exception 'Select at least one group member'; end if;
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

create or replace function public.respond_tournament_invite(p_participant_id uuid,p_accept boolean) returns uuid language plpgsql security definer set search_path=public as $$
declare t uuid;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 select tournament_id into t from public.tournament_participants where id=p_participant_id and user_id=auth.uid() and status='pending' for update;
 if t is null then raise exception 'Tournament invitation is no longer pending'; end if;
 update public.tournament_participants set status=case when p_accept then 'accepted' else 'declined' end,responded_at=now() where id=p_participant_id;
 return t;
end; $$;
grant execute on function public.respond_tournament_invite(uuid,boolean) to authenticated;

create or replace function public.notify_tournament_participants() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.notifications(recipient_id,kind,payload) values(new.user_id,'tournament_invite',jsonb_build_object('tournament_id',new.tournament_id,'participant_id',new.id,'source_group_id',new.source_group_id));
 return new;
end; $$;
drop trigger if exists tournament_participant_invite_notification on public.tournament_participants;
create trigger tournament_participant_invite_notification after insert on public.tournament_participants for each row execute function public.notify_tournament_participants();

create or replace function public.notify_tournament_response() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status<>old.status and new.status in ('accepted','declined') then
  insert into public.notifications(recipient_id,kind,payload) values((select organizer_id from public.tournaments where id=new.tournament_id),'tournament_invite_response',jsonb_build_object('tournament_id',new.tournament_id,'participant_id',new.id,'user_id',new.user_id,'status',new.status));
 end if;
 return new;
end; $$;
drop trigger if exists tournament_participant_response_notification on public.tournament_participants;
create trigger tournament_participant_response_notification after update on public.tournament_participants for each row execute function public.notify_tournament_response();

commit;
