begin;

create or replace function public.set_ready_player(p_enabled boolean)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_enabled then
    if exists (
      select 1 from public.matches
      where status = 'active' and (player_a_id = auth.uid() or player_b_id = auth.uid())
    ) then raise exception 'You already have an active match'; end if;
    if not exists (
      select 1 from public.ready_match_presence
      where user_id = auth.uid() and last_heartbeat_at > now() - interval '20 seconds'
    ) then raise exception 'Ready Match session is not active'; end if;
    update public.ready_match_presence set ready = true, last_heartbeat_at = now() where user_id = auth.uid();
    update public.profiles set ready_player_enabled = true, ready_player_updated_at = now() where id = auth.uid();
  else
    update public.profiles set ready_player_enabled = false, ready_player_updated_at = now() where id = auth.uid();
    delete from public.ready_match_presence where user_id = auth.uid();
  end if;
  return p_enabled;
end;
$$;

commit;
