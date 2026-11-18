-- Stage 7: delivery and payments.
-- The app cannot write orders or payments directly. These functions are the only way:
--   mark_delivered(order, proof_path)   admin or distributor
--   record_payment(...)                 admin only
--   void_payment(payment, reason)       admin only (a wrongly entered payment; the audit log keeps it)

alter table public.orders add column delivery_proof_path text;

-- 1. Mark a bill as delivered ------------------------------------------------------------------
-- p_proof: optional storage path of a photo of the signed paper copy.
-- Errors: not_allowed, not_found, not_billed, already_delivered
create function public.mark_delivered(p_order uuid, p_proof text default null) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := (select public.app_role());
  v_order public.orders%rowtype;
begin
  if v_role is null or v_role not in ('admin', 'distributor') then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders where id = p_order for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if v_order.status = 'delivered' then raise exception 'already_delivered' using errcode = 'P0001'; end if;
  if v_order.status <> 'billed' then raise exception 'not_billed' using errcode = 'P0001'; end if;
  -- A distributor works on the same orders they can see (bills out in the last 7 days).
  if v_role = 'distributor' and v_order.order_date < public.india_today() - 7 then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  update public.orders
  set status = 'delivered',
      delivered_at = now(),
      delivered_by = (select auth.uid()),
      delivery_proof_path = nullif(trim(coalesce(p_proof, '')), '')
  where id = p_order;

  perform public.write_audit('order.deliver', 'order', p_order,
    jsonb_build_object('proof', nullif(trim(coalesce(p_proof, '')), '') is not null));
end;
$$;

-- 2. Record a payment ---------------------------------------------------------------------------
-- A payment counts toward the shop's running balance. p_invoice is optional and only says which
-- bill it was meant for.
-- Errors: not_admin, not_found, bad_amount, bad_date, invoice_mismatch
create function public.record_payment(
  p_shop uuid,
  p_amount numeric,
  p_method public.payment_method default 'cash',
  p_paid_on date default null,
  p_invoice uuid default null,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date := coalesce(p_paid_on, public.india_today());
  v_id uuid;
begin
  if (select public.app_role()) is distinct from 'admin' then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.shops where id = p_shop) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 99999999.99 or p_amount <> round(p_amount, 2) then
    raise exception 'bad_amount' using errcode = 'P0001';
  end if;
  if v_date > public.india_today() or v_date < public.india_today() - 366 then
    raise exception 'bad_date' using errcode = 'P0001';
  end if;
  if p_invoice is not null and not exists (
    select 1 from public.invoices where id = p_invoice and shop_id = p_shop and status = 'issued'
  ) then
    raise exception 'invoice_mismatch' using errcode = 'P0001';
  end if;

  insert into public.payments (shop_id, invoice_id, amount, method, paid_on, note, recorded_by)
  values (p_shop, p_invoice, p_amount, p_method, v_date, left(nullif(trim(coalesce(p_note, '')), ''), 300), (select auth.uid()))
  returning id into v_id;

  perform public.write_audit('payment.record', 'payment', v_id,
    jsonb_build_object('shop', p_shop, 'amount', p_amount, 'method', p_method, 'paid_on', v_date));
  return v_id;
end;
$$;

-- 3. Remove a wrongly entered payment -----------------------------------------------------------
-- The row is deleted (so balances are right again) and everything about it goes into the audit log.
-- Errors: not_admin, not_found, reason_required
create function public.void_payment(p_payment uuid, p_reason text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := trim(coalesce(p_reason, ''));
  v_payment public.payments%rowtype;
begin
  if (select public.app_role()) is distinct from 'admin' then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
  select * into v_payment from public.payments where id = p_payment for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if length(v_reason) < 3 then raise exception 'reason_required' using errcode = 'P0001'; end if;

  delete from public.payments where id = p_payment;
  perform public.write_audit('payment.void', 'payment', p_payment,
    jsonb_build_object(
      'shop', v_payment.shop_id, 'amount', v_payment.amount, 'method', v_payment.method,
      'paid_on', v_payment.paid_on, 'invoice', v_payment.invoice_id, 'reason', left(v_reason, 300)));
end;
$$;

revoke all on function public.mark_delivered(uuid, text) from public;
revoke all on function public.record_payment(uuid, numeric, public.payment_method, date, uuid, text) from public;
revoke all on function public.void_payment(uuid, text) from public;
grant execute on function public.mark_delivered(uuid, text) to authenticated;
grant execute on function public.record_payment(uuid, numeric, public.payment_method, date, uuid, text) to authenticated;
grant execute on function public.void_payment(uuid, text) to authenticated;

-- 4. Photos of signed copies: a private bucket (real Supabase project only) ----------------------
-- Admin and distributors can add a photo; only the admin can read them back.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('delivery-proofs', 'delivery-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    execute $p$
      create policy delivery_proofs_add on storage.objects for insert to authenticated
      with check (bucket_id = 'delivery-proofs' and (select public.app_role()) in ('admin', 'distributor'))
    $p$;
    execute $p$
      create policy delivery_proofs_admin_read on storage.objects for select to authenticated
      using (bucket_id = 'delivery-proofs' and (select public.app_role()) = 'admin')
    $p$;
  end if;
end
$$;
