begin;

-- Realtime publication coverage for user-visible state changes.
do $$ begin alter publication supabase_realtime add table public.friendships; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.match_requests; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.tournaments; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.tournament_players; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.fixtures; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.match_events; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.post_likes; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.post_comments; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.post_media; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.user_follows; exception when duplicate_object then null; end $$;

alter table public.friendships replica identity full;
alter table public.match_requests replica identity full;
alter table public.notifications replica identity full;

create or replace function public.friendship_realtime_notification() returns trigger
language plpgsql security definer set search_path=public as $$
declare actor_name text; target_name text;
begin
  if tg_op='INSERT' and new.status='pending' then
    select coalesce(display_name,username,'MatchUp player') into actor_name from public.profiles where id=new.user_id;
    insert into public.notifications(recipient_id,kind,payload)
    values(new.friend_id,'friend_request',jsonb_build_object('actor_id',new.user_id,'message',actor_name||' wants to add you as a friend.','entity_type','profile','entity_id',new.user_id::text));
  elsif tg_op='UPDATE' and old.status='pending' and new.status in ('accepted','declined') then
    select coalesce(display_name,username,'MatchUp player') into target_name from public.profiles where id=new.friend_id;
    insert into public.notifications(recipient_id,kind,payload)
    values(new.user_id,case when new.status='accepted' then 'friend_request_accepted' else 'friend_request_declined' end,jsonb_build_object('actor_id',new.friend_id,'message',target_name||case when new.status='accepted' then ' accepted your friend request.' else ' declined your friend request.' end,'entity_type','profile','entity_id',new.friend_id::text));
  elsif tg_op='UPDATE' and old.status<>'pending' and new.status='pending' then
    select coalesce(display_name,username,'MatchUp player') into actor_name from public.profiles where id=new.user_id;
    insert into public.notifications(recipient_id,kind,payload)
    values(new.friend_id,'friend_request',jsonb_build_object('actor_id',new.user_id,'message',actor_name||' sent you a new friend request.','entity_type','profile','entity_id',new.user_id::text));
  end if;
  return new;
end;
$$;
drop trigger if exists friendships_realtime_notifications on public.friendships;
create trigger friendships_realtime_notifications after insert or update on public.friendships for each row execute function public.friendship_realtime_notification();

do $$ begin
  create or replace function public.match_request_realtime_notification() returns trigger
  language plpgsql security definer set search_path=public as $$
  declare actor_name text;
  begin
    if tg_op='INSERT' and new.status='pending' then
      select coalesce(display_name,username,'MatchUp player') into actor_name from public.profiles where id=new.requester_id;
      insert into public.notifications(recipient_id,kind,payload)
      values(new.opponent_id,'match_request',jsonb_build_object('actor_id',new.requester_id,'message',actor_name||' challenged you to a match.','entity_type','match_request','entity_id',new.id::text));
    elsif tg_op='UPDATE' and old.status='pending' and new.status in ('accepted','declined') then
      select coalesce(display_name,username,'MatchUp player') into actor_name from public.profiles where id=new.opponent_id;
      insert into public.notifications(recipient_id,kind,payload)
      values(new.requester_id,case when new.status='accepted' then 'match_request_accepted' else 'match_request_declined' end,jsonb_build_object('actor_id',new.opponent_id,'message',actor_name||case when new.status='accepted' then ' accepted your match challenge.' else ' declined your match challenge.' end,'entity_type','match_request','entity_id',new.id::text));
    elsif tg_op='UPDATE' and old.status<>'pending' and new.status='pending' then
      select coalesce(display_name,username,'MatchUp player') into actor_name from public.profiles where id=new.requester_id;
      insert into public.notifications(recipient_id,kind,payload)
      values(new.opponent_id,'match_request',jsonb_build_object('actor_id',new.requester_id,'message',actor_name||' sent you a new match challenge.','entity_type','match_request','entity_id',new.id::text));
    end if;
    return new;
  end;
  $$;
exception when duplicate_object then null;
end $$;
drop trigger if exists match_requests_realtime_notifications on public.match_requests;
create trigger match_requests_realtime_notifications after insert or update on public.match_requests for each row execute function public.match_request_realtime_notification();

commit;
