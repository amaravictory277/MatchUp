-- The live database currently has exactly one relationship from chat_messages to profiles:
-- chat_messages.sender_id -> profiles.id via chat_messages_sender_id_fkey.
-- Reload PostgREST after relationship/schema changes so its relationship cache matches
-- the actual PostgreSQL catalog used by Supabase REST queries.
DO $$
DECLARE
  fk_count integer;
BEGIN
  SELECT count(*) INTO fk_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
   AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = 'chat_messages'
    AND kcu.column_name = 'sender_id'
    AND ccu.table_name = 'profiles'
    AND ccu.column_name = 'id';

  IF fk_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one chat_messages.sender_id -> profiles.id foreign key, found %', fk_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'chat_messages'
      AND constraint_name = 'chat_messages_sender_id_fkey'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    RAISE EXCEPTION 'Expected chat_messages_sender_id_fkey was not found';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
