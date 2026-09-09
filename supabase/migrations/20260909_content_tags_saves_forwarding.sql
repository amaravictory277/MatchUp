create table if not exists public.saved_tournaments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tournament_id)
);
create index if not exists saved_tournaments_tournament_idx on public.saved_tournaments(tournament_id);
alter table public.saved_tournaments enable row level security;
drop policy if exists saved_tournaments_own on public.saved_tournaments;
create policy saved_tournaments_own on public.saved_tournaments for all using (user_id=auth.uid()) with check (user_id=auth.uid());

create table if not exists public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tagged_user_id uuid not null references public.profiles(id) on delete cascade,
  tagged_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, tagged_user_id)
);
create index if not exists post_tags_tagged_user_idx on public.post_tags(tagged_user_id, created_at desc);
alter table public.post_tags enable row level security;
drop policy if exists post_tags_select_private on public.post_tags;
drop policy if exists post_tags_insert_author on public.post_tags;
drop policy if exists post_tags_delete_author on public.post_tags;
create policy post_tags_select_private on public.post_tags for select using (auth.uid()=tagged_user_id or auth.uid()=tagged_by);
create policy post_tags_insert_author on public.post_tags for insert with check (auth.uid()=tagged_by and exists(select 1 from public.posts p where p.id=post_id and p.author_id=auth.uid()) and tagged_user_id<>auth.uid());
create policy post_tags_delete_author on public.post_tags for delete using (auth.uid()=tagged_by and exists(select 1 from public.posts p where p.id=post_id and p.author_id=auth.uid()));

create or replace function public.notify_post_tagged() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(recipient_id,kind,payload)
  values (new.tagged_user_id,'post_tagged',jsonb_build_object('post_id',new.post_id,'tagged_by',new.tagged_by));
  return new;
end; $$;
drop trigger if exists post_tagged_notification on public.post_tags;
create trigger post_tagged_notification after insert on public.post_tags for each row execute function public.notify_post_tagged();

alter table public.chat_messages add column if not exists edited_at timestamptz;
create index if not exists chat_messages_group_created_idx on public.chat_messages(group_id, created_at desc);

notify pgrst, 'reload schema';
