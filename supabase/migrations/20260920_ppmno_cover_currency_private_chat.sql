alter table public.profiles
  add column if not exists cover_media_path text,
  add column if not exists cover_media_type text,
  add column if not exists currency_code text;

update public.profiles
set currency_code = case
  when lower(coalesce(country,'')) = 'nigeria' then 'NGN'
  when lower(coalesce(country,'')) = 'ghana' then 'GHS'
  when lower(coalesce(country,'')) = 'kenya' then 'KES'
  when lower(coalesce(country,'')) = 'south africa' then 'ZAR'
  when lower(coalesce(country,'')) = 'united kingdom' then 'GBP'
  when lower(coalesce(country,'')) = 'united states' then 'USD'
  else coalesce(currency_code,'USD')
end
where currency_code is null;

alter table public.profiles
  drop constraint if exists profiles_cover_media_type_check;

alter table public.profiles
  add constraint profiles_cover_media_type_check
  check (cover_media_type is null or cover_media_type in ('image','video'));

create or replace function public.get_or_create_private_chat(p_friend uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  g uuid;
  k text;
  a text;
  b text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_friend is null or p_friend = auth.uid() then
    raise exception 'Choose another player';
  end if;

  if not exists (select 1 from public.profiles where id = p_friend) then
    raise exception 'Player not found';
  end if;

  if auth.uid()::text < p_friend::text then
    a := auth.uid()::text;
    b := p_friend::text;
  else
    a := p_friend::text;
    b := auth.uid()::text;
  end if;

  k := 'private:' || a || ':' || b;

  select id into g from public.chat_groups
  where kind = 'private' and direct_key = k limit 1;

  if g is null then
    begin
      insert into public.chat_groups(name, created_by, kind, direct_key, locked, member_limit)
      values('Private chat', auth.uid(), 'private', k, false, 2)
      returning id into g;
    exception when unique_violation then
      select id into g from public.chat_groups
      where kind = 'private' and direct_key = k limit 1;
    end;
  end if;

  insert into public.chat_group_members(group_id, user_id, last_seen_at)
  values(g, auth.uid(), now()), (g, p_friend, now())
  on conflict do nothing;

  return g;
end;
$function$;

revoke all on function public.get_or_create_private_chat(uuid) from public;
grant execute on function public.get_or_create_private_chat(uuid) to authenticated;
