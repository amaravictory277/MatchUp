-- Production chat/group completion: public General, persisted private chats,
-- secure group administration/invitations, message-read/search support,
-- per-user mute state, and owner-controlled group media.

alter table public.chat_groups add column if not exists kind text not null default 'group';
alter table public.chat_groups add column if not exists direct_key text;
alter table public.chat_groups add column if not exists image_path text;
alter table public.chat_groups add column if not exists locked boolean not null default false;

create index if not exists chat_groups_kind_idx on public.chat_groups(kind);
create unique index if not exists chat_groups_private_direct_key_idx on public.chat_groups(direct_key) where kind='private' and direct_key is not null;
create index if not exists chat_group_members_user_idx on public.chat_group_members(user_id, group_id);
create index if not exists chat_group_invites_user_status_idx on public.chat_group_invites(invited_user_id, status, created_at desc);
create index if not exists chat_messages_group_created_desc_idx on public.chat_messages(group_id, created_at desc);

create or replace function public.get_or_create_general_chat() returns uuid
language plpgsql security definer set search_path=public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into g from public.chat_groups where kind='general' order by created_at asc limit 1;
  if g is null then
    insert into public.chat_groups(name,created_by,kind,locked) values('General',auth.uid(),'general',false) returning id into g;
  end if;
  insert into public.chat_group_members(group_id,user_id,last_seen_at) values(g,auth.uid(),now()) on conflict do nothing;
  return g;
end;
$$;
grant execute on function public.get_or_create_general_chat() to authenticated;

create or replace function public.get_or_create_private_chat(p_friend uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare g uuid; k text; a text; b text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_chat_friend(auth.uid(),p_friend) then raise exception 'You can only message an accepted friend'; end if;
  if auth.uid()::text<p_friend::text then a:=auth.uid()::text; b:=p_friend::text; else a:=p_friend::text; b:=auth.uid()::text; end if;
  k:='private:'||a||':'||b;
  select id into g from public.chat_groups where kind='private' and direct_key=k limit 1;
  if g is null then
    insert into public.chat_groups(name,created_by,kind,direct_key,locked) values('Private chat',auth.uid(),'private',k,false) returning id into g;
  end if;
  insert into public.chat_group_members(group_id,user_id,last_seen_at) values(g,auth.uid(),now()),(g,p_friend,now()) on conflict do nothing;
  return g;
end;
$$;
grant execute on function public.get_or_create_private_chat(uuid) to authenticated;

create or replace function public.create_chat_group(p_name text, p_friend_ids uuid[] default '{}') returns uuid
language plpgsql security definer set search_path=public as $$
declare g uuid; invitee uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if char_length(btrim(p_name)) < 2 or char_length(btrim(p_name)) > 80 then raise exception 'Group name must be between 2 and 80 characters'; end if;
  if coalesce(array_length(p_friend_ids,1),0) > 50 then raise exception 'A group can have at most 50 invited people'; end if;
  insert into public.chat_groups(name,created_by,kind,locked) values(btrim(p_name),auth.uid(),'group',false) returning id into g;
  insert into public.chat_group_members(group_id,user_id,last_seen_at) values(g,auth.uid(),now());
  foreach invitee in array coalesce(p_friend_ids, '{}') loop
    if invitee <> auth.uid() and exists(select 1 from public.profiles p where p.id=invitee) then
      insert into public.chat_group_invites(group_id,invited_by,invited_user_id) values(g,auth.uid(),invitee) on conflict do nothing;
    end if;
  end loop;
  return g;
end;
$$;
grant execute on function public.create_chat_group(text,uuid[]) to authenticated;

create or replace function public.invite_chat_group_member(p_group_id uuid,p_user_id uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare invitation uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from public.chat_groups g where g.id=p_group_id and g.created_by=auth.uid() and g.kind='group' and not g.locked) then raise exception 'Only the group owner can invite members'; end if;
  if p_user_id=auth.uid() then raise exception 'You cannot invite yourself'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_user_id) then raise exception 'User not found'; end if;
  if exists(select 1 from public.chat_group_members m where m.group_id=p_group_id and m.user_id=p_user_id) then raise exception 'User is already a group member'; end if;
  insert into public.chat_group_invites(group_id,invited_by,invited_user_id,status) values(p_group_id,auth.uid(),p_user_id,'pending') on conflict (group_id,invited_user_id) where status='pending' do nothing returning id into invitation;
  if invitation is null then select id into invitation from public.chat_group_invites where group_id=p_group_id and invited_user_id=p_user_id and status='pending' limit 1; end if;
  return invitation;
end;
$$;
grant execute on function public.invite_chat_group_member(uuid,uuid) to authenticated;

create or replace function public.respond_chat_group_invite(p_invite_id uuid,p_accept boolean) returns uuid
language plpgsql security definer set search_path=public as $$
declare g uuid; new_status text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select group_id into g from public.chat_group_invites where id=p_invite_id and invited_user_id=auth.uid() and status='pending' for update;
  if g is null then raise exception 'Invitation is no longer pending'; end if;
  new_status:=case when p_accept then 'accepted' else 'declined' end;
  update public.chat_group_invites set status=new_status,responded_at=now() where id=p_invite_id;
  if p_accept then insert into public.chat_group_members(group_id,user_id,last_seen_at) values(g,auth.uid(),now()) on conflict do nothing; end if;
  return g;
end;
$$;
grant execute on function public.respond_chat_group_invite(uuid,boolean) to authenticated;

drop policy if exists chat_groups_select on public.chat_groups;
create policy chat_groups_select on public.chat_groups for select to authenticated using (kind='general' or created_by=auth.uid() or public.is_chat_group_member(id));

drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages for select to authenticated using (exists(select 1 from public.chat_groups g where g.id=chat_messages.group_id and (g.kind='general' or public.is_chat_group_member(g.id))));

drop policy if exists chat_invites_insert on public.chat_group_invites;
create policy chat_invites_insert on public.chat_group_invites for insert to authenticated with check (false);

drop policy if exists chat_members_insert on public.chat_group_members;
create policy chat_members_insert on public.chat_group_members for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.chat_group_invites i where i.group_id=chat_group_members.group_id and i.invited_user_id=auth.uid() and i.status='accepted'));

drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages for insert to authenticated with check (sender_id=auth.uid() and validate_chat_message_body(body) and exists(select 1 from public.chat_groups g where g.id=chat_messages.group_id and not g.locked and (g.kind='general' or public.is_chat_group_member(g.id))));

create index if not exists muted_conversations_conversation_idx on public.muted_conversations(conversation_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-media','chat-media',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists chat_media_public_select on storage.objects;
create policy chat_media_public_select on storage.objects for select to public using (bucket_id='chat-media');
drop policy if exists chat_media_owner_insert on storage.objects;
create policy chat_media_owner_insert on storage.objects for insert to authenticated with check (bucket_id='chat-media' and exists(select 1 from public.chat_groups g where g.id=((storage.foldername(name))[1])::uuid and g.created_by=auth.uid() and g.kind='group'));
drop policy if exists chat_media_owner_update on storage.objects;
create policy chat_media_owner_update on storage.objects for update to authenticated using (bucket_id='chat-media' and owner_id=(select auth.uid()::text)) with check (bucket_id='chat-media' and owner_id=(select auth.uid()::text));
drop policy if exists chat_media_owner_delete on storage.objects;
create policy chat_media_owner_delete on storage.objects for delete to authenticated using (bucket_id='chat-media' and owner_id=(select auth.uid()::text));
