begin;

drop function if exists public.get_ready_players();

create function public.get_ready_players()
returns table (
  id uuid,
  display_name text,
  username text,
  avatar_path text,
  ready_player_enabled boolean,
  gaming_team_name text,
  player_rating smallint,
  squad_formation text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    p.id,
    p.display_name,
    p.username,
    p.avatar_path,
    p.ready_player_enabled,
    p.gaming_team_name,
    p.player_rating,
    p.squad_formation
  from public.profiles p
  join public.ready_match_presence rp on rp.user_id = p.id
  where rp.ready = true
    and rp.last_heartbeat_at > now() - interval '20 seconds'
    and p.ready_player_enabled = true
    and p.id <> (select auth.uid())
  order by coalesce(p.display_name, p.username, 'MatchUp Player');
$$;

revoke all on function public.get_ready_players() from public, anon;
grant execute on function public.get_ready_players() to authenticated;

commit;
