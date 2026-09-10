create or replace function public.get_admin_users(p_search text default '', p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  result jsonb;
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  term text := btrim(coalesce(p_search, ''));
begin
  if not public.is_matchup_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'users', coalesce((select jsonb_agg(to_jsonb(u) order by u.created_at desc) from (
      select p.id, p.display_name, p.username, p.avatar_path, p.created_at, p.last_seen_at,
             coalesce(u.raw_app_meta_data->>'provider', 'email') as auth_provider,
             (u.email_confirmed_at is not null) as email_verified, u.last_sign_in_at
      from public.profiles p join auth.users u on u.id=p.id
      where term='' or p.username ilike '%'||term||'%' or coalesce(p.display_name,'') ilike '%'||term||'%'
      order by p.created_at desc limit safe_limit offset safe_offset
    ) u), '[]'::jsonb),
    'total', (select count(*) from public.profiles p where term='' or p.username ilike '%'||term||'%' or coalesce(p.display_name,'') ilike '%'||term||'%'),
    'activeToday', (select count(*) from public.profiles where last_seen_at >= date_trunc('day', now()))
  ) into result;
  return result;
end;
$$;

create or replace function public.get_admin_dashboard_data()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare result jsonb;
begin
  if not public.is_matchup_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select jsonb_build_object(
    'overview', jsonb_build_object(
      'totalUsers',(select count(*) from public.profiles),
      'activeToday',(select count(*) from public.profiles where last_seen_at >= date_trunc('day',now())),
      'newUsersToday',(select count(*) from public.profiles where created_at >= date_trunc('day',now())),
      'newUsersThisWeek',(select count(*) from public.profiles where created_at >= date_trunc('week',now())),
      'newUsersThisMonth',(select count(*) from public.profiles where created_at >= date_trunc('month',now())),
      'posts',(select count(*) from public.posts),'comments',(select count(*) from public.post_comments),'likes',(select count(*) from public.post_likes),
      'follows',(select count(*) from public.user_follows),'friendRequests',(select count(*) from public.friendships),
      'messages',(select count(*) from public.chat_messages where deleted_at is null),'chats',(select count(*) from public.chat_groups),
      'groups',(select count(*) from public.chat_groups where kind='group'),'tournaments',(select count(*) from public.tournaments),
      'tournamentParticipants',(select count(*) from public.tournament_participants),'videoPosts',(select count(*) from public.posts where media_kind='video'),
      'imagePosts',(select count(*) from public.posts where media_kind='image'),'notifications',(select count(*) from public.notifications)
    ),
    'analytics', jsonb_build_object(
      'dau',(select count(*) from public.profiles where last_seen_at >= date_trunc('day',now())),
      'wau',(select count(*) from public.profiles where last_seen_at >= now()-interval '7 days'),
      'mau',(select count(*) from public.profiles where last_seen_at >= now()-interval '30 days'),
      'newAccounts30d',(select count(*) from public.profiles where created_at >= now()-interval '30 days'),
      'posts30d',(select count(*) from public.posts where created_at >= now()-interval '30 days'),
      'comments30d',(select count(*) from public.post_comments where created_at >= now()-interval '30 days'),
      'likes30d',(select count(*) from public.post_likes where created_at >= now()-interval '30 days'),
      'follows30d',(select count(*) from public.user_follows where created_at >= now()-interval '30 days'),
      'friendRequests30d',(select count(*) from public.friendships where created_at >= now()-interval '30 days'),
      'messages30d',(select count(*) from public.chat_messages where created_at >= now()-interval '30 days' and deleted_at is null),
      'groups30d',(select count(*) from public.chat_groups where kind='group' and created_at >= now()-interval '30 days'),
      'tournaments30d',(select count(*) from public.tournaments where created_at >= now()-interval '30 days'),
      'tournamentParticipation30d',(select count(*) from public.tournament_participants where created_at >= now()-interval '30 days'),
      'videoPosts30d',(select count(*) from public.posts where media_kind='video' and created_at >= now()-interval '30 days'),
      'imagePosts30d',(select count(*) from public.posts where media_kind='image' and created_at >= now()-interval '30 days')
    ),
    'recentUsers',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select p.id,p.display_name,p.username,p.avatar_path,p.created_at,p.last_seen_at,coalesce(u.raw_app_meta_data->>'provider','email') as auth_provider,(u.email_confirmed_at is not null) as email_verified,u.last_sign_in_at
      from public.profiles p join auth.users u on u.id=p.id order by p.created_at desc limit 8) x),'[]'::jsonb),
    'recentPosts',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select p.id,p.author_id,p.body,p.media_path,p.media_kind,p.video_duration_seconds,p.media_count,p.created_at,pr.display_name as author_display_name,pr.username as author_username,pr.avatar_path as author_avatar,
      (select count(*) from public.post_likes l where l.post_id=p.id) as likes,(select count(*) from public.post_comments c where c.post_id=p.id) as comments
      from public.posts p join public.profiles pr on pr.id=p.author_id order by p.created_at desc limit 10) x),'[]'::jsonb),
    'recentComments',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select c.id,c.post_id,c.author_id,c.body,c.created_at,pr.display_name as author_display_name,pr.username as author_username,pr.avatar_path as author_avatar
      from public.post_comments c join public.profiles pr on pr.id=c.author_id order by c.created_at desc limit 10) x),'[]'::jsonb),
    'recentTournaments',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select t.id,t.tournament_id,t.name,t.organizer_id,t.starts_at,t.status,t.max_players,t.visibility,t.created_at,t.game_title,t.prize_pool,p.display_name as organizer_display_name,p.username as organizer_username,
      (select count(*) from public.tournament_participants tp where tp.tournament_id=t.id and tp.status='accepted') as participant_count,
      (select count(*) from public.tournament_participants tp where tp.tournament_id=t.id) as invited_count,
      (select count(*) from public.tournament_participants tp where tp.tournament_id=t.id and tp.source_group_id is not null) as group_participant_count
      from public.tournaments t join public.profiles p on p.id=t.organizer_id order by t.created_at desc limit 10) x),'[]'::jsonb),
    'recentGroups',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select g.id,g.name,g.created_by,g.created_at,g.archived_at,g.kind,g.locked,g.member_limit,p.display_name as owner_display_name,p.username as owner_username,
      (select count(*) from public.chat_group_members gm where gm.group_id=g.id) as member_count,
      (select count(*) from public.chat_messages m where m.group_id=g.id and m.created_at >= now()-interval '7 days' and m.deleted_at is null) as messages_7d,
      (select max(m.created_at) from public.chat_messages m where m.group_id=g.id and m.deleted_at is null) as last_message_at
      from public.chat_groups g join public.profiles p on p.id=g.created_by where g.kind='group' order by g.created_at desc limit 10) x),'[]'::jsonb),
    'notificationStats',jsonb_build_object(
      'total',(select count(*) from public.notifications),'last30d',(select count(*) from public.notifications where created_at >= now()-interval '30 days'),'unread',(select count(*) from public.notifications where read_at is null),
      'duplicateClusters',(select count(*) from (select recipient_id,kind,payload::text,date_trunc('minute',created_at) bucket from public.notifications group by recipient_id,kind,payload::text,date_trunc('minute',created_at) having count(*)>1) d)
    )
  ) into result;
  return result;
end;
$$;

create or replace function public.get_admin_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare result jsonb;
begin
  if not public.is_matchup_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then return null; end if;
  select jsonb_build_object(
    'profile',(select to_jsonb(x) from (select p.id,p.display_name,p.username,p.avatar_path,p.bio,p.role,p.created_at,p.last_seen_at,coalesce(u.raw_app_meta_data->>'provider','email') as auth_provider,(u.email_confirmed_at is not null) as email_verified,u.last_sign_in_at from public.profiles p join auth.users u on u.id=p.id where p.id=p_user_id) x),
    'counts',jsonb_build_object('posts',(select count(*) from public.posts where author_id=p_user_id),'comments',(select count(*) from public.post_comments where author_id=p_user_id),'tournamentsCreated',(select count(*) from public.tournaments where organizer_id=p_user_id),'tournamentsJoined',(select count(*) from public.tournament_participants where user_id=p_user_id and status='accepted'),'followers',(select count(*) from public.user_follows where following_id=p_user_id),'following',(select count(*) from public.user_follows where follower_id=p_user_id),'friends',(select count(*) from public.friendships where (user_id=p_user_id or friend_id=p_user_id) and status='accepted'),'groups',(select count(*) from public.chat_group_members where user_id=p_user_id),'messages',(select count(*) from public.chat_messages where sender_id=p_user_id and deleted_at is null)),
    'posts',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select p.id,p.body,p.media_path,p.media_kind,p.video_duration_seconds,p.created_at,(select count(*) from public.post_likes l where l.post_id=p.id) as likes,(select count(*) from public.post_comments c where c.post_id=p.id) as comments from public.posts p where p.author_id=p_user_id order by p.created_at desc limit 10) x),'[]'::jsonb),
    'friends',coalesce((select jsonb_agg(to_jsonb(x) order by x.display_name nulls last,x.username) from (select p.id,p.display_name,p.username,p.avatar_path from public.friendships f join public.profiles p on p.id=case when f.user_id=p_user_id then f.friend_id else f.user_id end where (f.user_id=p_user_id or f.friend_id=p_user_id) and f.status='accepted' limit 50) x),'[]'::jsonb),
    'groups',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select g.id,g.name,g.kind,g.member_limit,g.created_at,g.archived_at from public.chat_group_members gm join public.chat_groups g on g.id=gm.group_id where gm.user_id=p_user_id order by g.created_at desc limit 50) x),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_admin_users(text,integer,integer) from public,anon;
grant execute on function public.get_admin_users(text,integer,integer) to authenticated;
revoke all on function public.get_admin_dashboard_data() from public,anon;
grant execute on function public.get_admin_dashboard_data() to authenticated;
revoke all on function public.get_admin_user_detail(uuid) from public,anon;
grant execute on function public.get_admin_user_detail(uuid) to authenticated;
revoke execute on function public.touch_last_seen() from anon;
