-- MatchUp foundation schema. Run in the Supabase SQL editor.
create extension if not exists pgcrypto;
create type public.tournament_status as enum ('draft','open','full','in_progress','complete','cancelled');
create type public.match_status as enum ('pending','submitted','confirmed','under_review');
create type public.promotion_kind as enum ('boost','pin','featured','promoted','premium_badge');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  player_id text not null unique default ('MU-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  display_name text, avatar_path text, bio text default '', role text not null default 'player' check (role in ('player','admin')),
  created_at timestamptz not null default now()
);
create table public.tournaments (
  id uuid primary key default gen_random_uuid(), tournament_id text not null unique default ('MU-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  organizer_id uuid not null references public.profiles(id), name text not null check (char_length(name) between 3 and 80), description text default '', banner_path text,
  format text not null check (format in ('knockout','groups_knockout','league')), max_players smallint not null check (max_players between 2 and 128),
  rules text default '', starts_at timestamptz, visibility text not null default 'public' check (visibility in ('public','private','invite_only')),
  invite_token uuid not null default gen_random_uuid(), entry_information text default '', prize_information text default '', status public.tournament_status not null default 'open', created_at timestamptz not null default now()
);
create table public.tournament_players (
  tournament_id uuid references public.tournaments(id) on delete cascade, player_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'joined' check (status in ('invited','joined','withdrawn','disqualified')), seed smallint, joined_at timestamptz not null default now(), primary key(tournament_id,player_id)
);
create table public.fixtures (
  id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.tournaments(id) on delete cascade, round_number smallint not null, position smallint not null,
  home_player_id uuid references public.profiles(id), away_player_id uuid references public.profiles(id), winner_id uuid references public.profiles(id), home_score smallint, away_score smallint, status public.match_status not null default 'pending', unique(tournament_id,round_number,position)
);
create table public.result_submissions (
  id uuid primary key default gen_random_uuid(), fixture_id uuid not null references public.fixtures(id) on delete cascade, submitted_by uuid not null references public.profiles(id),
  home_score smallint not null check(home_score >= 0), away_score smallint not null check(away_score >= 0), evidence_path text, confirmation_state text not null default 'awaiting_opponent' check (confirmation_state in ('awaiting_opponent','confirmed','disputed','flagged')), created_at timestamptz not null default now()
);
create table public.posts (id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id), body text not null, media_path text, created_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid not null references public.profiles(id) on delete cascade, kind text not null, payload jsonb not null default '{}', read_at timestamptz, created_at timestamptz not null default now());
create table public.promotion_products (kind public.promotion_kind primary key, price_kobo integer not null check(price_kobo >= 0), duration_hours integer not null check(duration_hours > 0), enabled boolean not null default true, config jsonb not null default '{}');
create table public.payments (id uuid primary key default gen_random_uuid(), reference text not null unique, user_id uuid not null references public.profiles(id), tournament_id uuid references public.tournaments(id), kind public.promotion_kind not null, amount_kobo integer not null, status text not null check(status in ('initialized','verified','failed')), verified_at timestamptz, created_at timestamptz not null default now());
create table public.tournament_promotions (id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.tournaments(id) on delete cascade, payment_id uuid not null unique references public.payments(id), kind public.promotion_kind not null, starts_at timestamptz not null, expires_at timestamptz not null, position smallint);
create table public.pin_battle_settings (id boolean primary key default true, enabled boolean not null default false, starting_bid_kobo integer not null default 50000, minimum_increment_kobo integer not null default 10000, position_count smallint not null default 1, duration_hours integer not null default 24);

alter table public.profiles enable row level security; alter table public.tournaments enable row level security; alter table public.tournament_players enable row level security;
create policy "profiles are visible" on public.profiles for select using (true);
create policy "public tournaments are visible" on public.tournaments for select using (visibility = 'public' or organizer_id = auth.uid());
create policy "organizers create tournaments" on public.tournaments for insert with check (organizer_id = auth.uid());
create policy "organizers update tournaments" on public.tournaments for update using (organizer_id = auth.uid());
create policy "players view membership" on public.tournament_players for select using (true);
create policy "players join themselves" on public.tournament_players for insert with check (player_id = auth.uid());

-- Tournament system extension
alter table public.tournaments drop constraint if exists tournaments_format_check;
alter table public.tournaments add constraint tournaments_format_check check (format in ('league','round_robin','group_stage','knockout','single_elimination','double_elimination','groups_knockout'));
create table if not exists public.football_teams (id text primary key, full_name text not null, short_name text not null, country text not null, league text not null, crest_url text not null, search_keywords text[] not null default '{}', is_builtin boolean not null default true, created_at timestamptz not null default now());
create table if not exists public.tournament_teams (id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.tournaments(id) on delete cascade, builtin_team_id text references public.football_teams(id), team_name text not null, short_name text not null, country text not null default '', league text not null default '', city text not null default '', crest_path text, seed smallint, group_name text, created_at timestamptz not null default now(), unique(tournament_id, team_name), check (builtin_team_id is not null or char_length(team_name) between 2 and 80));
create table if not exists public.venues (id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.tournaments(id) on delete cascade, name text not null, address text not null default '', image_path text, created_at timestamptz not null default now());
create table if not exists public.tournament_admins (tournament_id uuid not null references public.tournaments(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, permission text not null default 'admin' check (permission in ('admin','viewer')), created_at timestamptz not null default now(), primary key(tournament_id,user_id));
alter table public.fixtures add column if not exists home_team_id uuid references public.tournament_teams(id) on delete set null;
alter table public.fixtures add column if not exists away_team_id uuid references public.tournament_teams(id) on delete set null;
alter table public.fixtures add column if not exists winner_team_id uuid references public.tournament_teams(id) on delete set null;
alter table public.fixtures add column if not exists round_label text not null default '';
alter table public.fixtures add column if not exists group_name text;
alter table public.fixtures add column if not exists scheduled_at timestamptz;
alter table public.fixtures add column if not exists venue_id uuid references public.venues(id) on delete set null;
alter table public.fixtures add column if not exists duration_minutes smallint not null default 12;
alter table public.fixtures add column if not exists referee_name text;
alter table public.fixtures add column if not exists home_penalties smallint;
alter table public.fixtures add column if not exists away_penalties smallint;
alter table public.fixtures add column if not exists cancelled boolean not null default false;
create table if not exists public.tournament_players_roster (id uuid primary key default gen_random_uuid(), tournament_team_id uuid not null references public.tournament_teams(id) on delete cascade, name text not null, shirt_number smallint, position text not null default 'Player', photo_path text, profile_id uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now());
create table if not exists public.match_events (id uuid primary key default gen_random_uuid(), fixture_id uuid not null references public.fixtures(id) on delete cascade, tournament_team_id uuid references public.tournament_teams(id) on delete set null, player_id uuid references public.tournament_players_roster(id) on delete set null, secondary_player_id uuid references public.tournament_players_roster(id) on delete set null, event_type text not null check (event_type in ('goal','assist','yellow_card','red_card','substitution','penalty_scored','penalty_missed')), minute smallint not null check (minute between 0 and 150), created_at timestamptz not null default now());
create index if not exists tournament_teams_tournament_idx on public.tournament_teams(tournament_id);
create index if not exists fixtures_tournament_teams_idx on public.fixtures(tournament_id, home_team_id, away_team_id);
create index if not exists match_events_fixture_idx on public.match_events(fixture_id, minute);
create or replace function public.is_tournament_admin(p_tournament_id uuid) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.tournaments t where t.id=p_tournament_id and t.organizer_id=auth.uid()) or exists (select 1 from public.tournament_admins a where a.tournament_id=p_tournament_id and a.user_id=auth.uid() and a.permission='admin'); $$;

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert with check (id=auth.uid());
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());

alter table public.football_teams enable row level security; alter table public.tournament_teams enable row level security; alter table public.venues enable row level security; alter table public.tournament_admins enable row level security; alter table public.fixtures enable row level security; alter table public.tournament_players_roster enable row level security; alter table public.match_events enable row level security;
drop policy if exists "built in teams are public" on public.football_teams; create policy "built in teams are public" on public.football_teams for select using (true);
drop policy if exists "tournament teams are visible" on public.tournament_teams; create policy "tournament teams are visible" on public.tournament_teams for select using (exists (select 1 from public.tournaments t where t.id=tournament_id and (t.visibility='public' or t.organizer_id=auth.uid() or public.is_tournament_admin(t.id))));
drop policy if exists "tournament admins manage teams" on public.tournament_teams; create policy "tournament admins manage teams" on public.tournament_teams for all using (public.is_tournament_admin(tournament_id)) with check (public.is_tournament_admin(tournament_id));
drop policy if exists "venues are visible" on public.venues; create policy "venues are visible" on public.venues for select using (exists (select 1 from public.tournaments t where t.id=tournament_id and (t.visibility='public' or t.organizer_id=auth.uid() or public.is_tournament_admin(t.id))));
drop policy if exists "admins manage venues" on public.venues; create policy "admins manage venues" on public.venues for all using (public.is_tournament_admin(tournament_id)) with check (public.is_tournament_admin(tournament_id));
drop policy if exists "admins visible" on public.tournament_admins; create policy "admins visible" on public.tournament_admins for select using (public.is_tournament_admin(tournament_id) or user_id=auth.uid());
drop policy if exists "owner manages admins" on public.tournament_admins; create policy "owner manages admins" on public.tournament_admins for all using (exists (select 1 from public.tournaments t where t.id=tournament_id and t.organizer_id=auth.uid())) with check (exists (select 1 from public.tournaments t where t.id=tournament_id and t.organizer_id=auth.uid()));
drop policy if exists "fixtures visible" on public.fixtures; create policy "fixtures visible" on public.fixtures for select using (exists (select 1 from public.tournaments t where t.id=tournament_id and (t.visibility='public' or t.organizer_id=auth.uid() or public.is_tournament_admin(t.id))));
drop policy if exists "admins manage fixtures" on public.fixtures; create policy "admins manage fixtures" on public.fixtures for all using (public.is_tournament_admin(tournament_id)) with check (public.is_tournament_admin(tournament_id));
drop policy if exists "roster visible" on public.tournament_players_roster; create policy "roster visible" on public.tournament_players_roster for select using (exists (select 1 from public.tournament_teams tt join public.tournaments t on t.id=tt.tournament_id where tt.id=tournament_team_id and (t.visibility='public' or t.organizer_id=auth.uid() or public.is_tournament_admin(t.id))));
drop policy if exists "admins manage roster" on public.tournament_players_roster; create policy "admins manage roster" on public.tournament_players_roster for all using (exists (select 1 from public.tournament_teams tt where tt.id=tournament_team_id and public.is_tournament_admin(tt.tournament_id))) with check (exists (select 1 from public.tournament_teams tt where tt.id=tournament_team_id and public.is_tournament_admin(tt.tournament_id)));
drop policy if exists "events visible" on public.match_events; create policy "events visible" on public.match_events for select using (exists (select 1 from public.fixtures f join public.tournaments t on t.id=f.tournament_id where f.id=fixture_id and (t.visibility='public' or t.organizer_id=auth.uid() or public.is_tournament_admin(t.id))));
drop policy if exists "admins manage events" on public.match_events; create policy "admins manage events" on public.match_events for all using (exists (select 1 from public.fixtures f where f.id=fixture_id and public.is_tournament_admin(f.tournament_id))) with check (exists (select 1 from public.fixtures f where f.id=fixture_id and public.is_tournament_admin(f.tournament_id)));

insert into storage.buckets (id,name,public) values ('team-logos','team-logos',true) on conflict (id) do nothing;
drop policy if exists "public team logos read" on storage.objects; create policy "public team logos read" on storage.objects for select using (bucket_id='team-logos');
drop policy if exists "authenticated team logo upload" on storage.objects; create policy "authenticated team logo upload" on storage.objects for insert to authenticated with check (bucket_id='team-logos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "authenticated team logo update" on storage.objects; create policy "authenticated team logo update" on storage.objects for update to authenticated using (bucket_id='team-logos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "authenticated team logo delete" on storage.objects; create policy "authenticated team logo delete" on storage.objects for delete to authenticated using (bucket_id='team-logos' and (storage.foldername(name))[1]=auth.uid()::text);
