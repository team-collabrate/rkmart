-- Found by the security audit test: a few helper and trigger functions could be run by anyone,
-- including signed-out visitors (Postgres lets PUBLIC run a new function by default). None of them
-- exposed data, but there is no reason for the public to run them.
--
-- Pure helpers (dates, money, GST arithmetic): signed-in users keep them, the public loses them.
-- Trigger functions: they only ever run as triggers, so nobody needs to call them.
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('gst_line', 'india_today', 'invoice_fy', 'money_text')
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('notify_delivered', 'notify_new_order', 'notify_payment')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end
$$;
