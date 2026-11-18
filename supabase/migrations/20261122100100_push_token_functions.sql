-- Stage 8: a phone or browser belongs to whoever is signed in on it.
-- If two people share a phone, the token must move to the person who signs in. The table's own
-- rules only let a person change their own rows, so the move goes through this function.

-- Errors: invalid
create function public.register_push_token(p_platform text, p_token text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_token text := trim(coalesce(p_token, ''));
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and is_active) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if p_platform not in ('android', 'web') or length(v_token) < 8 or length(v_token) > 4096 then
    raise exception 'invalid' using errcode = 'P0001';
  end if;

  insert into public.push_tokens (profile_id, platform, token)
  values (v_uid, p_platform, v_token)
  on conflict (token) do update
    set profile_id = v_uid, platform = excluded.platform, last_seen = now();
end;
$$;

-- Forgets a token, but only one that belongs to the caller.
create function public.forget_push_token(p_token text) returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens
  where token = trim(coalesce(p_token, '')) and profile_id = (select auth.uid())
$$;

revoke all on function public.register_push_token(text, text) from public;
revoke all on function public.forget_push_token(text) from public;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.forget_push_token(text) to authenticated;
