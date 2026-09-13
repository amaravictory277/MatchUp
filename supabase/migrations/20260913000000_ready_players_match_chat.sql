-- Real Ready Player matching: persisted availability, requests, notifications and dedicated match chats.
alter table public.profiles add column if not exists ready_player boolean not null default false;
alter table public.profiles add column if not exists ready_player_updated_at timestamptz;
create index if not exists profiles_ready_player_idx on public.profiles(ready_player) where ready_player = true;

create table if not exists public.match_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  match_chat_group_id uuid references public.chat_groups(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> recipient_id)
);
create unique index if not exists match_requests_one_pending_idx on public.match_requests(requester_id,recipient_id) where status='pending';
create index if not exists match_requests_recipient_idx on public.match_requests(recipient_id,status,created_at desc);
create index if not exists match_requests_requester_idx on public.match_requests(requester_id,status,created_at desc);

alter table public.match_requests enable row level security;
drop policy if exists match_requests_select_own on public.match_requests;
create policy match_requests_select_own on public.match_requests for select to authenticated using (requester_id=auth.uid() or recipient_id=auth.uid());
drop policy if exists match_requests_insert_blocked on public.match_requests;
create policy match_requests_insert_blocked on public.match_requests for insert to authenticated with check (false);
drop policy if exists match_requests_update_blocked on public.match_requests;
create policy match_requests_update_blocked on public.match_requests for update to authenticated using (false) with check (false);

create or replace function public.set_ready_player(p_ready boolean) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.profiles set ready_player=p_ready, ready_player_updated_at=now() where id=auth.uid();
  return p_ready;
end;
$$;
grant execute on function public.set_ready_player(boolean) to authenticated;

create or replace function public.create_match_request(p_recipient uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare request_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_recipient=auth.uid() then raise exception 'You cannot challenge yourself'; end if;
  if not exists(select 1 from public.profiles where id=p_recipient and ready_player=true) then raise exception 'This player is not currently ready'; end if;
  if exists(select 1 from public.match_requests where requester_id=auth.uid() and recipient_id=p_recipient and status='pending') then raise exception 'A request is already pending'; end if;
  insert into public.match_requests(requester_id,recipient_id) values(auth.uid(),p_recipient) returning id into request_id;
  insert into public.notifications(recipient_id,kind,payload) values(p_recipient,'match_request',jsonb_build_object('request_id',request_id,'requester_id',auth.uid()));
  return request_id;
end;
$$;
grant execute on function public.create_match_request(uuid) to authenticated;

create or replace function public.respond_match_request(p_request_id uuid,p_accept boolean) returns uuid
language plpgsql security definer set search_path=public as $$
declare req public.match_requests%rowtype; g uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into req from public.match_requests where id=p_request_id and recipient_id=auth.uid() and status='pending' for update;
  if req.id is null then raise exception 'Match request is no longer pending'; end if;
  if not p_accept then
    update public.match_requests set status='declined',responded_at=now() where id=req.id;
    insert into public.notifications(recipient_id,kind,payload) values(req.requester_id,'match_request_declined',jsonb_build_object('request_id',req.id));
    return null;
  end if;
  insert into public.chat_groups(name,created_by,kind,direct_key,locked)
    values('Match Chat',auth.uid(),'match','match:'||req.id::text,false) returning id into g;
  insert into public.chat_group_members(group_id,user_id,last_seen_at) values(g,req.requester_id,now()),(g,req.recipient_id,now()) on conflict do nothing;
  update public.match_requests set status='accepted',match_chat_group_id=g,responded_at=now() where id=req.id;
  insert into public.notifications(recipient_id,kind,payload) values(req.requester_id,'match_request_accepted',jsonb_build_object('request_id',req.id,'group_id',g));
  return g;
end;
$$;
grant execute on function public.respond_match_request(uuid,boolean) to authenticated;

-- Match chats inherit the existing member-based chat access model.
drop policy if exists chat_groups_select_match on public.chat_groups;
create policy chat_groups_select_match on public.chat_groups for select to authenticated using (kind='match' and public.is_chat_group_member(id));
