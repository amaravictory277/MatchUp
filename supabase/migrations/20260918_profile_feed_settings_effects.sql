alter table public.profiles
  add column if not exists country text not null default '',
  add column if not exists supported_game text,
  add column if not exists is_verified boolean not null default false,
  add column if not exists theme_preference text not null default 'dark',
  add column if not exists active_effect_id text,
  add column if not exists effect_expires_at timestamptz;

do $$
begin
  alter table public.profiles add constraint profiles_supported_game_check
    check (supported_game is null or supported_game in ('eFootball','FIFA'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles add constraint profiles_theme_preference_check
    check (theme_preference in ('light','dark','system'));
exception when duplicate_object then null;
end $$;

create table if not exists public.profile_effects (
  id text primary key,
  name text not null,
  description text not null default '',
  duration_hours integer not null check (duration_hours > 0),
  unlock_method text not null check (unlock_method in ('ad','subscription')),
  preview_url text,
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.user_profile_effects (
  user_id uuid not null references public.profiles(id) on delete cascade,
  effect_id text not null references public.profile_effects(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  expires_at timestamptz,
  active boolean not null default false,
  primary key (user_id, effect_id)
);

alter table public.profile_effects enable row level security;
alter table public.user_profile_effects enable row level security;

drop policy if exists profile_effects_public_read on public.profile_effects;
create policy profile_effects_public_read on public.profile_effects for select using (true);

drop policy if exists user_profile_effects_own on public.user_profile_effects;
create policy user_profile_effects_own on public.user_profile_effects
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

insert into public.profile_effects (id,name,description,duration_hours,unlock_method,preview_url,is_premium)
values
  ('neon','Neon Effect','Add a glowing neon frame to your MatchUp profile.',3,'ad','https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',false),
  ('fire','Fire Effect','Add a fiery profile frame to your MatchUp profile.',3,'ad','https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',false),
  ('premium','Premium Effect','Exclusive premium profile effect with unique animations.',720,'subscription','https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',true)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  duration_hours = excluded.duration_hours,
  unlock_method = excluded.unlock_method,
  preview_url = excluded.preview_url,
  is_premium = excluded.is_premium;

insert into storage.buckets (id,name,public)
values ('profile-media','profile-media',true)
on conflict (id) do nothing;

drop policy if exists profile_media_public_read on storage.objects;
create policy profile_media_public_read on storage.objects
  for select using (bucket_id = 'profile-media');

drop policy if exists profile_media_authenticated_upload on storage.objects;
create policy profile_media_authenticated_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists profile_media_authenticated_update on storage.objects;
create policy profile_media_authenticated_update on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists profile_media_authenticated_delete on storage.objects;
create policy profile_media_authenticated_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
