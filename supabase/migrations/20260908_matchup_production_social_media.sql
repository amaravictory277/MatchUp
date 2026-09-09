begin;

alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles add constraint profiles_username_check check (username ~ '^[a-zA-Z0-9_-]{3,24}$');
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare base_username text; candidate text; suffix text;
begin
  base_username := regexp_replace(lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, 'player'), '@', 1))), '[^a-z0-9_-]', '', 'g');
  base_username := left(base_username, 24); if char_length(base_username) < 3 then base_username := 'player'; end if;
  candidate := base_username;
  if exists (select 1 from public.profiles where username = candidate) then suffix := substr(replace(new.id::text, '-', ''), 1, 6); candidate := left(base_username, 17) || '_' || suffix; end if;
  insert into public.profiles(id, username, display_name) values(new.id, candidate, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'MatchUp Player'), '@', 1))) on conflict(id) do nothing;
  return new;
end;
$$;

alter table public.tournaments add column if not exists game_title text not null default 'Football';
alter table public.tournaments add column if not exists prize_pool numeric(12,2) not null default 0 check(prize_pool >= 0);
create index if not exists tournaments_public_created_idx on public.tournaments(visibility,created_at desc);
drop policy if exists "organizers delete tournaments" on public.tournaments;
create policy "organizers delete tournaments" on public.tournaments for delete to authenticated using(organizer_id=auth.uid());

alter table public.posts add column if not exists media_kind text not null default 'text' check(media_kind in ('text','image','video'));
alter table public.posts add column if not exists video_duration_seconds numeric(6,2);
alter table public.posts add column if not exists media_count smallint not null default 0 check(media_count between 0 and 10);
create table if not exists public.post_media(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.posts(id) on delete cascade,storage_path text not null,media_type text not null check(media_type in ('image','video')),position smallint not null check(position between 0 and 9),created_at timestamptz not null default now(),unique(post_id,position));
create index if not exists post_media_post_idx on public.post_media(post_id,position);
create table if not exists public.post_likes(post_id uuid not null references public.posts(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,created_at timestamptz not null default now(),primary key(post_id,user_id));
create table if not exists public.post_comments(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.posts(id) on delete cascade,author_id uuid not null references public.profiles(id) on delete cascade,body text not null check(char_length(btrim(body)) between 1 and 1000),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists post_comments_post_created_idx on public.post_comments(post_id,created_at);
create table if not exists public.saved_posts(post_id uuid not null references public.posts(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,created_at timestamptz not null default now(),primary key(post_id,user_id));
create table if not exists public.user_follows(follower_id uuid not null references public.profiles(id) on delete cascade,following_id uuid not null references public.profiles(id) on delete cascade,created_at timestamptz not null default now(),primary key(follower_id,following_id),check(follower_id<>following_id));
create index if not exists profiles_username_lower_idx on public.profiles(lower(username));
create index if not exists posts_created_idx on public.posts(created_at desc);

alter table public.post_media enable row level security; alter table public.post_likes enable row level security; alter table public.post_comments enable row level security; alter table public.saved_posts enable row level security; alter table public.user_follows enable row level security;
drop policy if exists post_media_public_read on public.post_media; create policy post_media_public_read on public.post_media for select using(exists(select 1 from public.posts p where p.id=post_id));
drop policy if exists post_media_owner_write on public.post_media; create policy post_media_owner_write on public.post_media for all to authenticated using(exists(select 1 from public.posts p where p.id=post_id and p.author_id=auth.uid())) with check(exists(select 1 from public.posts p where p.id=post_id and p.author_id=auth.uid()));
drop policy if exists post_likes_select on public.post_likes; create policy post_likes_select on public.post_likes for select using(true);
drop policy if exists post_likes_insert on public.post_likes; create policy post_likes_insert on public.post_likes for insert to authenticated with check(user_id=auth.uid());
drop policy if exists post_likes_delete on public.post_likes; create policy post_likes_delete on public.post_likes for delete to authenticated using(user_id=auth.uid());
drop policy if exists post_comments_select on public.post_comments; create policy post_comments_select on public.post_comments for select using(true);
drop policy if exists post_comments_insert on public.post_comments; create policy post_comments_insert on public.post_comments for insert to authenticated with check(author_id=auth.uid());
drop policy if exists post_comments_update on public.post_comments; create policy post_comments_update on public.post_comments for update to authenticated using(author_id=auth.uid()) with check(author_id=auth.uid());
drop policy if exists post_comments_delete on public.post_comments; create policy post_comments_delete on public.post_comments for delete to authenticated using(author_id=auth.uid());
drop policy if exists saved_posts_own on public.saved_posts; create policy saved_posts_own on public.saved_posts for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists follows_select on public.user_follows; create policy follows_select on public.user_follows for select using(true);
drop policy if exists follows_insert on public.user_follows; create policy follows_insert on public.user_follows for insert to authenticated with check(follower_id=auth.uid());
drop policy if exists follows_delete on public.user_follows; create policy follows_delete on public.user_follows for delete to authenticated using(follower_id=auth.uid());

create or replace function public.send_friend_request(p_target uuid) returns void language plpgsql security definer set search_path=public as $$ begin if auth.uid() is null then raise exception 'Not authenticated'; end if; if p_target=auth.uid() then raise exception 'You cannot add yourself'; end if; if not exists(select 1 from public.profiles where id=p_target) then raise exception 'User not found'; end if; if exists(select 1 from public.friendships where status='accepted' and ((user_id=auth.uid() and friend_id=p_target) or (user_id=p_target and friend_id=auth.uid()))) then raise exception 'Already friends'; end if; insert into public.friendships(user_id,friend_id,status) values(auth.uid(),p_target,'pending') on conflict(user_id,friend_id) do update set status='pending',created_at=now(); end; $$;
create or replace function public.respond_friend_request(p_sender uuid,p_accept boolean) returns void language plpgsql security definer set search_path=public as $$ begin if not exists(select 1 from public.friendships where user_id=p_sender and friend_id=auth.uid() and status='pending') then raise exception 'Friend request not found'; end if; if p_accept then update public.friendships set status='accepted' where user_id=p_sender and friend_id=auth.uid(); insert into public.friendships(user_id,friend_id,status) values(auth.uid(),p_sender,'accepted') on conflict(user_id,friend_id) do update set status='accepted'; else update public.friendships set status='declined' where user_id=p_sender and friend_id=auth.uid(); end if; end; $$;
grant execute on function public.send_friend_request(uuid) to authenticated; grant execute on function public.respond_friend_request(uuid,boolean) to authenticated;

create table if not exists public.muted_conversations(user_id uuid not null references public.profiles(id) on delete cascade,conversation_id uuid not null,created_at timestamptz not null default now(),primary key(user_id,conversation_id));
alter table public.muted_conversations enable row level security; drop policy if exists muted_conversations_own on public.muted_conversations; create policy muted_conversations_own on public.muted_conversations for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

alter table public.chat_groups add column if not exists kind text not null default 'group' check(kind in ('general','private','group'));
alter table public.chat_groups add column if not exists direct_key text;
alter table public.chat_groups add column if not exists image_path text;
alter table public.chat_groups add column if not exists locked boolean not null default false;
create unique index if not exists chat_groups_direct_key_idx on public.chat_groups(direct_key) where direct_key is not null;
create index if not exists chat_groups_kind_idx on public.chat_groups(kind,created_at desc);
drop policy if exists chat_groups_delete on public.chat_groups; create policy chat_groups_delete on public.chat_groups for delete to authenticated using(created_by=auth.uid());
drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages for insert to authenticated with check(sender_id=auth.uid() and public.validate_chat_message_body(body) and (exists(select 1 from public.chat_groups g where g.id=group_id and g.kind='general' and not g.locked) or exists(select 1 from public.chat_groups g where g.id=group_id and g.kind<>'general' and not g.locked and public.is_chat_group_member(g.id))));

create or replace function public.get_or_create_general_chat() returns uuid language plpgsql security definer set search_path=public as $$ declare g uuid; begin select id into g from public.chat_groups where kind='general' order by created_at asc limit 1; if g is null then insert into public.chat_groups(name,created_by,kind) values('General',auth.uid(),'general') returning id into g; end if; return g; end; $$;
create or replace function public.get_or_create_private_chat(p_friend uuid) returns uuid language plpgsql security definer set search_path=public as $$ declare g uuid; k text; a text; b text; begin if not public.is_chat_friend(auth.uid(),p_friend) then raise exception 'You can only message an accepted friend'; end if; if auth.uid()::text<p_friend::text then a:=auth.uid()::text;b:=p_friend::text;else a:=p_friend::text;b:=auth.uid()::text;end if; k:='private:'||a||':'||b; select id into g from public.chat_groups where direct_key=k limit 1; if g is null then insert into public.chat_groups(name,created_by,kind,direct_key) values('Private chat',auth.uid(),'private',k) returning id into g; insert into public.chat_group_members(group_id,user_id) values(g,auth.uid()),(g,p_friend) on conflict do nothing; end if; return g; end; $$;
grant execute on function public.get_or_create_general_chat() to authenticated; grant execute on function public.get_or_create_private_chat(uuid) to authenticated;
create or replace function public.set_chat_group_locked(p_group uuid,p_locked boolean) returns void language plpgsql security definer set search_path=public as $$ begin if not exists(select 1 from public.chat_groups where id=p_group and created_by=auth.uid()) then raise exception 'Not authorized'; end if; update public.chat_groups set locked=p_locked where id=p_group; end; $$;
create or replace function public.delete_chat_group(p_group uuid) returns void language plpgsql security definer set search_path=public as $$ begin if not exists(select 1 from public.chat_groups where id=p_group and created_by=auth.uid()) then raise exception 'Not authorized'; end if; delete from public.chat_groups where id=p_group; end; $$;
grant execute on function public.set_chat_group_locked(uuid,boolean) to authenticated; grant execute on function public.delete_chat_group(uuid) to authenticated;

create or replace function public.tournament_notification_trigger() returns trigger language plpgsql security definer set search_path=public as $$ begin if tg_op='INSERT' then insert into public.notifications(recipient_id,kind,payload) values(new.organizer_id,'tournament_created',jsonb_build_object('message','Tournament created: '||new.name||'.','entity_type','tournament','entity_id',new.id::text)); elsif tg_op='DELETE' then insert into public.notifications(recipient_id,kind,payload) values(old.organizer_id,'tournament_deleted',jsonb_build_object('message','Tournament deleted: '||old.name||'.','entity_type','tournament','entity_id',old.id::text)); end if; return coalesce(new,old); end; $$;
drop trigger if exists tournaments_notifications on public.tournaments; create trigger tournaments_notifications after insert or delete on public.tournaments for each row execute function public.tournament_notification_trigger();

create or replace function public.post_interaction_notification() returns trigger language plpgsql security definer set search_path=public as $$ declare owner uuid; actor_name text; begin select author_id into owner from public.posts where id=new.post_id; select coalesce(display_name,username,'MatchUp player') into actor_name from public.profiles where id=auth.uid(); if owner is not null and owner<>auth.uid() then insert into public.notifications(recipient_id,kind,payload) values(owner,case when tg_table_name='post_likes' then 'post_liked' else 'post_commented' end,jsonb_build_object('actor_id',auth.uid(),'message',actor_name||case when tg_table_name='post_likes' then ' liked your post.' else ' commented on your post.' end,'entity_type','post','entity_id',new.post_id::text)); end if; return new; end; $$;
drop trigger if exists post_likes_notifications on public.post_likes; create trigger post_likes_notifications after insert on public.post_likes for each row execute function public.post_interaction_notification();
drop trigger if exists post_comments_notifications on public.post_comments; create trigger post_comments_notifications after insert on public.post_comments for each row execute function public.post_interaction_notification();

insert into storage.buckets(id,name,public) values('feed-media','feed-media',true) on conflict(id) do nothing;
drop policy if exists feed_media_public_read on storage.objects; create policy feed_media_public_read on storage.objects for select using(bucket_id='feed-media');
drop policy if exists feed_media_owner_insert on storage.objects; create policy feed_media_owner_insert on storage.objects for insert to authenticated with check(bucket_id='feed-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists feed_media_owner_update on storage.objects; create policy feed_media_owner_update on storage.objects for update to authenticated using(bucket_id='feed-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists feed_media_owner_delete on storage.objects; create policy feed_media_owner_delete on storage.objects for delete to authenticated using(bucket_id='feed-media' and (storage.foldername(name))[1]=auth.uid()::text);

alter table public.posts replica identity full; alter table public.post_media replica identity full; alter table public.post_likes replica identity full; alter table public.post_comments replica identity full; alter table public.saved_posts replica identity full; alter table public.notifications replica identity full;
do $$ begin alter publication supabase_realtime add table public.posts; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.post_media; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.post_likes; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.post_comments; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end $$;
commit;
