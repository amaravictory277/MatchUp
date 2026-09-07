-- MatchUp real-time group chat foundation.
-- The same schema was applied to the connected production Supabase project.

create table if not exists public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'accepted' check (status = any (array['pending','accepted','declined','blocked'])),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index if not exists friendships_friend_idx on public.friendships(friend_id, status);
alter table public.friendships enable row level security;
drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships for select to authenticated using (auth.uid() = user_id or auth.uid() = friend_id);
drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists friendships_update on public.friendships;
create policy friendships_update on public.friendships for update to authenticated using (auth.uid() = user_id or auth.uid() = friend_id) with check (auth.uid() = user_id or auth.uid() = friend_id);

create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create table if not exists public.chat_group_members (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz,
  primary key (group_id, user_id)
);
create table if not exists public.chat_group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status = any (array['pending','accepted','declined'])),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create unique index if not exists chat_invite_pending_unique on public.chat_group_invites(group_id, invited_user_id) where status = 'pending';

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  sticker_key text,
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint chat_message_content_check check (char_length(btrim(body)) > 0 or sticker_key is not null)
);
create index if not exists chat_messages_group_created_idx on public.chat_messages(group_id, created_at);
create table if not exists public.chat_message_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create table if not exists public.chat_message_reads (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create or replace function public.is_chat_group_member(p_group_id uuid, p_user_id uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.chat_group_members m where m.group_id = p_group_id and m.user_id = coalesce(p_user_id, auth.uid()));
$$;
create or replace function public.is_chat_friend(p_user_id uuid, p_friend_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.friendships f where f.status = 'accepted' and ((f.user_id = p_user_id and f.friend_id = p_friend_id) or (f.user_id = p_friend_id and f.friend_id = p_user_id)));
$$;
create or replace function public.validate_chat_message_body(p_body text) returns boolean
language plpgsql immutable as $$
declare u text;
begin
  if p_body is null then return false; end if;
  for u in select regexp_matches(p_body, '(https?://[^[:space:]]+|www\.[^[:space:]]+)', 'gi') loop
    if lower(u) not like '%/feeds%' or (lower(u) like '%://%' and lower(u) not like '%://match-up-ten.vercel.app/feeds%') then return false; end if;
  end loop;
  if p_body ~* '(data:image|javascript:|blob:|\.(png|jpe?g|gif|webp|mp4|mov|webm|m4a|mp3)(\?|$|[[:space:]]))' then return false; end if;
  return true;
end;
$$;
create or replace function public.enforce_chat_message_content() returns trigger
language plpgsql as $$
begin
  if not public.validate_chat_message_body(new.body) then raise exception 'Only MatchUp Feeds links can be shared in group chat.' using errcode = 'check_violation'; end if;
  return new;
end;
$$;
drop trigger if exists chat_message_content_guard on public.chat_messages;
create trigger chat_message_content_guard before insert or update on public.chat_messages for each row execute function public.enforce_chat_message_content();

create or replace function public.create_chat_group(p_name text, p_friend_ids uuid[] default '{}') returns uuid
language plpgsql security definer set search_path = public as $$
declare g uuid; f uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.chat_groups(name, created_by) values (btrim(p_name), auth.uid()) returning id into g;
  insert into public.chat_group_members(group_id, user_id) values (g, auth.uid());
  foreach f in array coalesce(p_friend_ids, '{}') loop
    if f <> auth.uid() and public.is_chat_friend(auth.uid(), f) then
      insert into public.chat_group_invites(group_id, invited_by, invited_user_id) values (g, auth.uid(), f) on conflict do nothing;
    end if;
  end loop;
  return g;
end;
$$;
grant execute on function public.create_chat_group(text, uuid[]) to authenticated;
grant execute on function public.is_chat_friend(uuid, uuid) to authenticated;
grant execute on function public.is_chat_group_member(uuid, uuid) to authenticated;

alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.chat_group_invites enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_message_reactions enable row level security;
alter table public.chat_message_reads enable row level security;

create policy chat_groups_select on public.chat_groups for select to authenticated using (created_by = auth.uid() or public.is_chat_group_member(id));
create policy chat_groups_insert on public.chat_groups for insert to authenticated with check (created_by = auth.uid());
create policy chat_groups_update on public.chat_groups for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy chat_members_select on public.chat_group_members for select to authenticated using (user_id = auth.uid() or public.is_chat_group_member(group_id));
create policy chat_members_insert on public.chat_group_members for insert to authenticated with check (user_id = auth.uid() and exists(select 1 from public.chat_group_invites i where i.group_id = chat_group_members.group_id and i.invited_user_id = auth.uid() and i.status = 'accepted'));
create policy chat_members_update on public.chat_group_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy chat_members_delete on public.chat_group_members for delete to authenticated using (user_id = auth.uid() or exists(select 1 from public.chat_groups g where g.id = chat_group_members.group_id and g.created_by = auth.uid()));
create policy chat_invites_select on public.chat_group_invites for select to authenticated using (invited_user_id = auth.uid() or invited_by = auth.uid() or public.is_chat_group_member(group_id));
create policy chat_invites_insert on public.chat_group_invites for insert to authenticated with check (invited_by = auth.uid() and public.is_chat_group_member(group_id) and public.is_chat_friend(auth.uid(), invited_user_id));
create policy chat_invites_update on public.chat_group_invites for update to authenticated using (invited_user_id = auth.uid() or invited_by = auth.uid()) with check (invited_user_id = auth.uid() or invited_by = auth.uid());
create policy chat_messages_select on public.chat_messages for select to authenticated using (public.is_chat_group_member(group_id));
create policy chat_messages_insert on public.chat_messages for insert to authenticated with check (sender_id = auth.uid() and public.is_chat_group_member(group_id) and public.validate_chat_message_body(body));
create policy chat_messages_update on public.chat_messages for update to authenticated using (sender_id = auth.uid() and public.is_chat_group_member(group_id)) with check (sender_id = auth.uid() and public.is_chat_group_member(group_id));
create policy chat_messages_delete on public.chat_messages for delete to authenticated using (sender_id = auth.uid() or exists(select 1 from public.chat_groups g where g.id = chat_messages.group_id and g.created_by = auth.uid()));
create policy chat_reactions_select on public.chat_message_reactions for select to authenticated using (exists(select 1 from public.chat_messages m where m.id = message_id and public.is_chat_group_member(m.group_id)));
create policy chat_reactions_insert on public.chat_message_reactions for insert to authenticated with check (user_id = auth.uid() and exists(select 1 from public.chat_messages m where m.id = message_id and public.is_chat_group_member(m.group_id)));
create policy chat_reactions_delete on public.chat_message_reactions for delete to authenticated using (user_id = auth.uid());
create policy chat_reads_select on public.chat_message_reads for select to authenticated using (user_id = auth.uid() or exists(select 1 from public.chat_messages m where m.id = message_id and public.is_chat_group_member(m.group_id)));
create policy chat_reads_insert on public.chat_message_reads for insert to authenticated with check (user_id = auth.uid() and exists(select 1 from public.chat_messages m where m.id = message_id and public.is_chat_group_member(m.group_id)));
create policy chat_reads_update on public.chat_message_reads for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.chat_groups replica identity full;
alter table public.chat_group_members replica identity full;
alter table public.chat_group_invites replica identity full;
alter table public.chat_messages replica identity full;
alter table public.chat_message_reactions replica identity full;
alter table public.chat_message_reads replica identity full;
do $$ begin alter publication supabase_realtime add table public.chat_groups; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.chat_group_members; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.chat_group_invites; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.chat_messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.chat_message_reactions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.chat_message_reads; exception when duplicate_object then null; end $$;
