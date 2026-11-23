-- Lockout for the 4-digit PIN. A PIN has only 10,000 possibilities, so guessing must be slowed
-- right down: after 5 wrong tries on one mobile number, that number is locked for 15 minutes.
--
-- The sign-in edge function (supabase/functions/sign-in) is the only caller. It uses the service
-- role, so none of this is reachable from the app or from a signed-in user.
create table public.login_attempts (
  phone text primary key check (phone ~ '^[6-9][0-9]{9}$'),
  failures integer not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz
);
alter table public.login_attempts enable row level security;
-- No policies and no grants: only the service role (which bypasses RLS) can touch it.
revoke all on public.login_attempts from public, anon, authenticated;

-- Seconds the number is still locked for (0 when it may try).
create function public.login_lock_seconds(p_phone text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select greatest(0, ceil(extract(epoch from (a.locked_until - now())))::integer)
     from public.login_attempts a where a.phone = p_phone and a.locked_until is not null),
    0)
$$;

-- Records a wrong try. Returns the seconds the number is locked for after this try (0 if not locked).
create function public.login_failed(p_phone text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max constant integer := 5;
  v_window constant interval := interval '15 minutes';
  v_lock constant interval := interval '15 minutes';
begin
  insert into public.login_attempts as a (phone, failures, window_start, locked_until)
  values (p_phone, 1, now(), null)
  on conflict (phone) do update
  set failures = case when a.window_start < now() - v_window or a.locked_until < now()
                      then 1 else a.failures + 1 end,
      window_start = case when a.window_start < now() - v_window or a.locked_until < now()
                          then now() else a.window_start end,
      locked_until = case when a.window_start < now() - v_window or a.locked_until < now()
                          then null else a.locked_until end;

  update public.login_attempts a
  set locked_until = now() + v_lock
  where a.phone = p_phone and a.failures >= v_max and (a.locked_until is null or a.locked_until < now());

  return public.login_lock_seconds(p_phone);
end;
$$;

-- A correct PIN clears the count.
create function public.login_succeeded(p_phone text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.login_attempts where phone = p_phone
$$;

revoke all on function public.login_lock_seconds(text) from public, anon, authenticated;
revoke all on function public.login_failed(text) from public, anon, authenticated;
revoke all on function public.login_succeeded(text) from public, anon, authenticated;
grant execute on function public.login_lock_seconds(text) to service_role;
grant execute on function public.login_failed(text) to service_role;
grant execute on function public.login_succeeded(text) to service_role;
