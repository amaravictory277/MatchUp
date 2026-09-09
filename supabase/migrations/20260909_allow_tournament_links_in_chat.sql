create or replace function public.validate_chat_message_body(p_body text) returns boolean language plpgsql immutable set search_path=public as $$
declare url_match text;
begin
  if p_body is null then return false; end if;
  for url_match in select regexp_matches(p_body, '(https?://[^[:space:]]+|www\\.[^[:space:]]+)', 'gi') loop
    if lower(url_match) not like '%/feeds%' and lower(url_match) not like '%/tournaments%' then return false; end if;
    if lower(url_match) like '%://%' and lower(url_match) not like '%match-up-ten.vercel.app/feeds%' and lower(url_match) not like '%match-up-ten.vercel.app/tournaments%' then return false; end if;
  end loop;
  return true;
end; $$;
notify pgrst,'reload schema';
