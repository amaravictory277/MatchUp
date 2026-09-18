-- Fix private/Ready Match message persistence when a legacy conversation is missing
-- the sender's membership row. The BEFORE trigger remains the authorization gate;
-- the RLS policy must not require membership before that trigger can repair it.

DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;

CREATE POLICY chat_messages_insert
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.chat_groups g
    WHERE g.id = chat_messages.group_id
      AND (
        g.kind IN ('private', 'match')
        OR (NOT g.locked AND (g.kind = 'general' OR public.is_chat_group_member(g.id)))
      )
  )
);
