begin;

select cron.schedule('matchup-expire-match-requests', '* * * * * *', $$select public.expire_match_requests();$$);

commit;
