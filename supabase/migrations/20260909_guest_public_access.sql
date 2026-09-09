drop policy if exists chat_groups_public_general_read on public.chat_groups;
create policy chat_groups_public_general_read on public.chat_groups
for select to public
using (kind = 'general');

drop policy if exists chat_messages_public_general_read on public.chat_messages;
create policy chat_messages_public_general_read on public.chat_messages
for select to public
using (exists (select 1 from public.chat_groups g where g.id = chat_messages.group_id and g.kind = 'general'));

comment on policy chat_groups_public_general_read on public.chat_groups is 'Guests may discover the public General chat room; private and group rooms remain authenticated/member-only.';
comment on policy chat_messages_public_general_read on public.chat_messages is 'Guests may read General chat messages; sending, reactions, reads and all private/group messages remain authenticated-only.';
