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
-- Reserved architecture for the future fixed-position bidding feature; no escrow/refund workflow is implemented.
create table public.pin_battle_settings (id boolean primary key default true, enabled boolean not null default false, starting_bid_kobo integer not null default 50000, minimum_increment_kobo integer not null default 10000, position_count smallint not null default 1, duration_hours integer not null default 24);

alter table public.profiles enable row level security; alter table public.tournaments enable row level security; alter table public.tournament_players enable row level security;
create policy "profiles are visible" on public.profiles for select using (true);
create policy "public tournaments are visible" on public.tournaments for select using (visibility = 'public' or organizer_id = auth.uid());
create policy "organizers create tournaments" on public.tournaments for insert with check (organizer_id = auth.uid());
create policy "organizers update tournaments" on public.tournaments for update using (organizer_id = auth.uid());
create policy "players view membership" on public.tournament_players for select using (true);
create policy "players join themselves" on public.tournament_players for insert with check (player_id = auth.uid());
