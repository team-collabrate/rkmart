-- Stage 1 / 4 of 5: role helpers, audit helper and guards that protect issued bills.

-- The role of the logged-in user, or null when the user is unknown or deactivated.
-- security definer so the access rules can read profiles without recursion.
create function public.app_role() returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.is_active
$$;

-- The shop of the logged-in shop owner, or null.
create function public.app_shop_id() returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.shop_id from public.profiles p where p.id = (select auth.uid()) and p.is_active
$$;

-- Writes one audit record. Called from database functions, never from the app.
create function public.write_audit(
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_details jsonb default '{}'::jsonb
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor, action, entity, entity_id, details)
  values ((select auth.uid()), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- An issued invoice never changes. The only allowed change is cancelling it (number is kept).
create function public.invoices_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Invoices cannot be deleted. Cancel the invoice instead.';
  end if;

  if (to_jsonb(new) - 'status' - 'cancelled_reason' - 'cancelled_at')
     is distinct from
     (to_jsonb(old) - 'status' - 'cancelled_reason' - 'cancelled_at') then
    raise exception 'An issued invoice cannot be changed. Cancel it and issue a new one.';
  end if;

  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'A cancelled invoice cannot be reopened.';
  end if;

  return new;
end;
$$;

create trigger invoices_guard_trigger
before update or delete on public.invoices
for each row execute function public.invoices_guard();

-- Invoice lines are frozen once written.
create function public.invoice_items_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Invoice lines cannot be changed after the invoice is issued.';
end;
$$;

create trigger invoice_items_guard_trigger
before update or delete on public.invoice_items
for each row execute function public.invoice_items_guard();
