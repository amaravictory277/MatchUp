-- MatchUp authentication/security hardening.
-- Run this migration in the Supabase SQL editor.

-- Create a profile automatically for every newly authenticated user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
  safe_username text;
begin
  base_username := coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, 'player'), '@', 1));
  safe_username := regexp_replace(lower(base_username), '[^a-z0-9_]', '', 'g');
  safe_username := left(safe_username, 20);
  if char_length(safe_username) < 3 then safe_username := 'player'; end if;
  safe_username := left(safe_username || '_' || substr(replace(new.id::text, '-', ''), 1, 6), 24);
  insert into public.profiles(id, username, display_name)
  values (new.id, safe_username, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'MatchUp Player'), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.notifications enable row level security;
drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications for select to authenticated using (recipient_id = auth.uid());
drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications" on public.notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
-- Notifications should be created by trusted server-side workflows, not arbitrary clients.
drop policy if exists "users insert own notifications" on public.notifications;

alter table public.posts enable row level security;
drop policy if exists "public posts are visible" on public.posts;
create policy "public posts are visible" on public.posts for select using (true);
drop policy if exists "users create own posts" on public.posts;
create policy "users create own posts" on public.posts for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "users update own posts" on public.posts;
create policy "users update own posts" on public.posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "users delete own posts" on public.posts;
create policy "users delete own posts" on public.posts for delete to authenticated using (author_id = auth.uid());
