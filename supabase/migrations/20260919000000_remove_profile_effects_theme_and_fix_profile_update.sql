-- Remove abandoned Profile Effects / Theme functionality and allow users to update their own profile.
create policy "profiles users can update own profile" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop table if exists public.user_profile_effects;
drop table if exists public.profile_effects;

alter table public.profiles
  drop constraint if exists profiles_theme_preference_check,
  drop column if exists theme_preference,
  drop column if exists active_effect_id,
  drop column if exists effect_expires_at;
