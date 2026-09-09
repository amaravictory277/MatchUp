-- Keep the private admin authorization RPC callable only by signed-in users.
-- The trigger function is not an API surface and must not be executable by clients.

revoke execute on function public.is_matchup_admin() from anon;
grant execute on function public.is_matchup_admin() to authenticated;
revoke execute on function public.prevent_client_role_change() from anon;
revoke execute on function public.prevent_client_role_change() from authenticated;
revoke execute on function public.prevent_client_role_change() from public;

notify pgrst, 'reload schema';
