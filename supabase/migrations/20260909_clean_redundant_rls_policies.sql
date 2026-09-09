begin;

-- Remove superseded duplicate policies; retain the canonical authenticated policies.
drop policy if exists "friendships_insert_own" on public.friendships;
drop policy if exists "friendships_select_own" on public.friendships;
drop policy if exists "friendships_update_recipient" on public.friendships;

drop policy if exists "users view their own notifications" on public.notifications;
drop policy if exists "users mark their own notifications read" on public.notifications;

drop policy if exists "users delete their own posts" on public.posts;
drop policy if exists "users insert their own posts" on public.posts;
drop policy if exists "users update their own posts" on public.posts;
drop policy if exists "posts are publicly viewable" on public.posts;

commit;
