begin;

-- Keep one canonical notification producer for friend requests/acceptance.
drop trigger if exists friendship_notification on public.friendships;

-- Keep the newer group-invite producer, which also handles accept/decline responses.
drop trigger if exists group_invite_notification on public.chat_group_invites;

-- Remove exact duplicate notification rows left by overlapping producers.
with ranked as (
  select id,
         row_number() over (
           partition by recipient_id,
             coalesce(payload->>'entity_type',''),
             coalesce(payload->>'entity_id',''),
             coalesce(payload->>'actor_id',''),
             kind,
             coalesce(payload->>'message','')
           order by created_at asc, id asc
         ) as rn
  from public.notifications
  where payload ? 'entity_id'
)
delete from public.notifications n
using ranked r
where n.id=r.id and r.rn>1;

-- Remove obsolete semantic variants created by the superseded producers.
delete from public.notifications
where kind='friend_request_accepted'
  and payload->>'entity_type'='profile';

delete from public.notifications
where kind='group_invitation'
  and payload->>'entity_type'='group';

commit;

notify pgrst, 'reload schema';
