begin;

create unique index if not exists notifications_event_key_unique
  on public.notifications(recipient_id, ((payload->>'event_key')))
  where payload ? 'event_key';

create or replace function public.chat_message_notification_trigger()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
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
  select kind, name into group_kind, group_name from public.chat_groups where id = new.group_id;
  if group_kind is null or group_kind = 'general' then return new; end if;
  select coalesce(display_name, username, 'MatchUp player') into actor_name from public.profiles where id = new.sender_id;
  event_key := 'chat_message:' || new.id::text;

  for recipient in select user_id from public.chat_group_members where group_id = new.group_id and user_id <> new.sender_id loop
    insert into public.notifications(recipient_id, kind, payload)
    values(recipient, 'message', jsonb_build_object(
      'actor_id', new.sender_id,
      'message', case when group_kind in ('private','match') then actor_name || ' sent you a message' else actor_name || ' sent a message in ' || coalesce(group_name,'your group') end,
      'entity_type', 'group',
      'entity_id', new.group_id::text,
      'message_id', new.id::text,
      'event_key', event_key,
      'href', '/leaderboard?group=' || new.group_id::text
    ))
    on conflict (recipient_id, ((payload->>'event_key'))) do nothing;
  end loop;

  if new.reply_to_id is not null then
    select sender_id into parent_sender from public.chat_messages where id = new.reply_to_id;
    if parent_sender is not null and parent_sender <> new.sender_id then
      event_key := 'chat_reply:' || new.id::text;
      insert into public.notifications(recipient_id, kind, payload)
      values(parent_sender, 'message_reply', jsonb_build_object(
        'actor_id', new.sender_id,
        'message', actor_name || ' replied to your message',
        'entity_type', 'group',
        'entity_id', new.group_id::text,
        'message_id', new.id::text,
        'event_key', event_key,
        'href', '/leaderboard?group=' || new.group_id::text
      ))
      on conflict (recipient_id, ((payload->>'event_key'))) do nothing;
    end if;
  end if;

  for username_text in select p.username from public.profiles p where p.username is not null and p.id <> new.sender_id and strpos(lower(coalesce(new.body,'')), lower('@' || p.username)) > 0 loop
    select id into recipient from public.profiles where username = username_text limit 1;
    if recipient is not null then
      event_key := 'chat_mention:' || new.id::text || ':' || recipient::text;
      insert into public.notifications(recipient_id, kind, payload)
      values(recipient, 'message_mention', jsonb_build_object(
        'actor_id', new.sender_id,
        'message', actor_name || ' mentioned you in chat',
        'entity_type', 'group',
        'entity_id', new.group_id::text,
        'message_id', new.id::text,
        'event_key', event_key,
        'href', '/leaderboard?group=' || new.group_id::text
      ))
      on conflict (recipient_id, ((payload->>'event_key'))) do nothing;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists chat_messages_notifications on public.chat_messages;
create trigger chat_messages_notifications after insert on public.chat_messages for each row execute function public.chat_message_notification_trigger();

commit;
