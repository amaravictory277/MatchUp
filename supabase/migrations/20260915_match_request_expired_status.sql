begin;

alter table public.match_requests drop constraint if exists match_requests_status_check;
alter table public.match_requests add constraint match_requests_status_check
  check (status = any (array['pending'::text,'accepted'::text,'declined'::text,'cancelled'::text,'expired'::text]));

commit;
