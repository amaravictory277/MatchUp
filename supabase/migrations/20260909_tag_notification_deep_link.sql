create or replace function public.notify_post_tagged() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(recipient_id,kind,payload)
  values (new.tagged_user_id,'post_tagged',jsonb_build_object('post_id',new.post_id,'tagged_by',new.tagged_by,'href',concat('/feeds/post/',new.post_id)));
  return new;
end; $$;
notify pgrst,'reload schema';
