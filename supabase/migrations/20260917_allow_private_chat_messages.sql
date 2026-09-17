-- Private and Ready Match conversations must never be blocked by the group-content guard or group lock state.
-- Keep the existing restrictions for ordinary group/general chat, but make private-message persistence independent of notification side effects.

create or replace function public.enforce_chat_message_content()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  group_kind text;
begin
  select kind into group_kind
  from public.chat_groups
  where id = new.group_id;

  if group_kind in ('private', 'match') then
    return new;
  end if;

  if not public.validate_chat_message_body(new.body) then
    raise exception 'Chat messages may only contain links copied from MatchUp Feeds.' using errcode = 'check_violation';
  end if;

  if new.body ~* '(data:image|javascript:|\\.(png|jpe?g|gif|webp|mp4|mov|webm|m4a|mp3)(\\?|$|[[:space:]])|blob:)' then
    raise exception 'Images, video, audio and file links are not allowed in group chat.' using errcode = 'check_violation';
  end if;

  return new;
end;
$function$;

drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert
on public.chat_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.chat_groups g
    where g.id = chat_messages.group_id
      and (
        g.kind in ('private', 'match')
        or (not g.locked and (g.kind = 'general' or public.is_chat_group_member(g.id)))
      )
  )
);

-- Notifications are secondary work. A notification failure must never roll back the message itself.
create or replace function public.chat_message_notification_trigger()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  group_kind text;
  group_name text;
  actor_name text;
  recipient uuid;
  parent_sender uuid;
  event_key text;
  username_text text;
begin
  if tg_op <> 'INSERT' then return new; end if;

  begin
    select kind, name into group_kind, group_name
    from public.chat_groups
    where id = new.group_id;

    if group_kind is null or group_kind = 'general' then return new; end if;

    select coalesce(display_name, username, 'MatchUp player') into actor_name
    from public.profiles
    where id = new.sender_id;

    event_key := 'chat_message:' || new.id::text;
    for recipient in
      select user_id
      from public.chat_group_members
      where group_id = new.group_id
        and user_id <> new.sender_id
    loop
      insert into public.notifications(recipient_id, kind, payload)
      values(
        recipient,
        'message',
        jsonb_build_object(
          'actor_id', new.sender_id,
          'message', case
            when group_kind in ('private','match') then actor_name || ' sent you a message'
            else actor_name || ' sent a message in ' || coalesce(group_name,'your group')
          end,
          'entity_type', 'group',
          'entity_id', new.group_id::text,
          'message_id', new.id::text,
          'event_key', event_key,
          'href', '/leaderboard?group=' || new.group_id::text
        )
      )
      on conflict (recipient_id, (payload->>'event_key'))
        where (payload ? 'event_key')
      do nothing;
    end loop;

    if new.reply_to_id is not null then
      select sender_id into parent_sender
      from public.chat_messages
      where id = new.reply_to_id;

      if parent_sender is not null and parent_sender <> new.sender_id then
        event_key := 'chat_reply:' || new.id::text;
        insert into public.notifications(recipient_id, kind, payload)
        values(
          parent_sender,
          'message_reply',
          jsonb_build_object(
            'actor_id', new.sender_id,
            'message', actor_name || ' replied to your message',
            'entity_type', 'group',
            'entity_id', new.group_id::text,
            'message_id', new.id::text,
            'event_key', event_key,
            'href', '/leaderboard?group=' || new.group_id::text
          )
        )
        on conflict (recipient_id, (payload->>'event_key'))
          where (payload ? 'event_key')
        do nothing;
      end if;
    end if;

    for username_text in
      select p.username
      from public.profiles p
      where p.username is not null
        and p.id <> new.sender_id
        and strpos(lower(coalesce(new.body,'')), lower('@' || p.username)) > 0
    loop
      select id into recipient
      from public.profiles
      where username = username_text
      limit 1;

      if recipient is not null then
        event_key := 'chat_mention:' || new.id::text || ':' || recipient::text;
        insert into public.notifications(recipient_id, kind, payload)
        values(
          recipient,
          'message_mention',
          jsonb_build_object(
            'actor_id', new.sender_id,
            'message', actor_name || ' mentioned you in chat',
            'entity_type', 'group',
            'entity_id', new.group_id::text,
            'message_id', new.id::text,
            'event_key', event_key,
            'href', '/leaderboard?group=' || new.group_id::text
          )
        )
        on conflict (recipient_id, (payload->>'event_key'))
          where (payload ? 'event_key')
        do nothing;
      end if;
    end loop;
  exception when others then
    raise warning 'chat notification side effect failed for message %: %', new.id, sqlerrm;
  end;

  return new;
end;
$function$;
