-- Stage 5: GST billing.
--
-- finalize_bill() turns a placed order into a GST invoice in one safe step: it takes the next
-- invoice number, copies item and shop details onto the invoice, works out the GST for every line,
-- saves the shop's previous balance, and locks the bill. Corrections go through cancel_bill()
-- (the number stays used) and a new bill. adjust_order() lets the admin fix quantities after
-- packing, before the bill is made.
--
-- NOTE FOR THE ACCOUNTANT: the rules here (invoice number format, rounding, how a bill is
-- corrected) must be confirmed before real use. See docs/stage-5-billing.md.

-- 1. Pure helpers (also used by the tests) ------------------------------------------------

-- Financial year code for a date. 1 Apr 2026 to 31 Mar 2027 is '2627'.
create function public.invoice_fy(p_date date) returns text
language sql
immutable
set search_path = ''
as $$
  select lpad((y % 100)::text, 2, '0') || lpad(((y + 1) % 100)::text, 2, '0')
  from (
    select extract(year from p_date)::int - (case when extract(month from p_date) < 4 then 1 else 0 end) as y
  ) s
$$;

-- GST for one line. Amounts are in rupees, rounded half up to paise.
--   p_inclusive = false: the rate is before tax and tax is added.
--   p_inclusive = true:  the rate already contains tax, which is taken out.
--   p_intra = true: tax splits into CGST and SGST (same state). false: all IGST.
-- CGST is half the tax rounded, SGST is the rest, so CGST + SGST always equals the tax exactly.
create function public.gst_line(
  p_qty numeric,
  p_rate numeric,
  p_gst numeric,
  p_inclusive boolean,
  p_intra boolean
) returns table (taxable numeric, cgst numeric, sgst numeric, igst numeric, amount numeric)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_gross numeric := round(p_qty * p_rate, 2);
  v_taxable numeric;
  v_tax numeric;
  v_amount numeric;
  v_cgst numeric := 0;
  v_sgst numeric := 0;
  v_igst numeric := 0;
begin
  if p_inclusive then
    v_amount := v_gross;
    v_taxable := round(v_gross * 100 / (100 + p_gst), 2);
    v_tax := v_amount - v_taxable;
  else
    v_taxable := v_gross;
    v_tax := round(v_taxable * p_gst / 100, 2);
    v_amount := v_taxable + v_tax;
  end if;

  if p_intra then
    v_cgst := round(v_tax / 2, 2);
    v_sgst := v_tax - v_cgst;
  else
    v_igst := v_tax;
  end if;
  return query select v_taxable, v_cgst, v_sgst, v_igst, v_amount;
end;
$$;

grant execute on function public.invoice_fy(date) to authenticated;
grant execute on function public.gst_line(numeric, numeric, numeric, boolean, boolean) to authenticated;

-- 2. A cancelled bill must not block a new one for the same order -------------------------
alter table public.invoices drop constraint invoices_order_id_key;
create unique index invoices_one_issued_per_order on public.invoices (order_id) where status = 'issued';

-- 3. Make the bill ----------------------------------------------------------------------------
-- Errors: not_admin, not_found, not_placed, empty_order
create function public.finalize_bill(p_order uuid) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_shop public.shops%rowtype;
  v_set public.settings%rowtype;
  v_day date := public.india_today();
  v_fy text := public.invoice_fy(public.india_today());
  v_seq integer;
  v_invoice uuid;
  v_intra boolean;
  v_prev numeric;
  v_taxable numeric;
  v_cgst numeric;
  v_sgst numeric;
  v_igst numeric;
  v_total numeric;
  v_grand numeric;
  v_lines integer;
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order for update;
  if not found then raise exception 'not_found'; end if;
  if v_order.status <> 'placed' then raise exception 'not_placed'; end if;
  if not exists (select 1 from public.order_items where order_id = p_order) then
    raise exception 'empty_order';
  end if;

  select * into v_shop from public.shops where id = v_order.shop_id;
  select * into v_set from public.settings;
  v_intra := v_shop.state_code = v_set.state_code;

  -- What the shop owed before this bill: issued bills minus payments.
  select
    coalesce((select sum(i.grand_total) from public.invoices i where i.shop_id = v_order.shop_id and i.status = 'issued'), 0)
    - coalesce((select sum(p.amount) from public.payments p where p.shop_id = v_order.shop_id), 0)
  into v_prev;

  -- Totals first: an issued invoice cannot be edited afterwards.
  select
    coalesce(sum(g.taxable), 0), coalesce(sum(g.cgst), 0), coalesce(sum(g.sgst), 0),
    coalesce(sum(g.igst), 0), coalesce(sum(g.amount), 0)
  into v_taxable, v_cgst, v_sgst, v_igst, v_total
  from public.order_items oi
  join public.products p on p.id = oi.product_id
  cross join lateral public.gst_line(oi.qty, oi.rate, p.gst_rate, v_set.rates_include_gst, v_intra) g
  where oi.order_id = p_order;

  v_grand := round(v_total, 0);

  -- Next number for this financial year. If anything below fails, the number is given back.
  insert into public.invoice_counters (fy, last_seq) values (v_fy, 1)
  on conflict (fy) do update set last_seq = public.invoice_counters.last_seq + 1
  returning last_seq into v_seq;

  insert into public.invoices (
    order_id, shop_id, invoice_no, fy, seq, issue_date,
    shop_name, shop_address, shop_gstin, shop_state_code,
    taxable_total, cgst_total, sgst_total, igst_total, round_off, grand_total,
    previous_balance, total_due, status, created_by
  ) values (
    p_order, v_order.shop_id, v_set.invoice_prefix || '/' || v_fy || '/' || lpad(v_seq::text, 4, '0'), v_fy, v_seq, v_day,
    v_shop.name_en, v_shop.address, v_shop.gstin, v_shop.state_code,
    v_taxable, v_cgst, v_sgst, v_igst, v_grand - v_total, v_grand,
    v_prev, v_grand + v_prev, 'issued', (select auth.uid())
  ) returning id into v_invoice;

  insert into public.invoice_items (
    invoice_id, line_no, product_id, name_en, name_ta, hsn_code, unit,
    qty, rate, taxable, gst_rate, cgst, sgst, igst, amount
  )
  select
    v_invoice, row_number() over (order by p.sort_order, p.name_en), p.id, p.name_en, p.name_ta, p.hsn_code, p.unit,
    oi.qty, oi.rate, g.taxable, p.gst_rate, g.cgst, g.sgst, g.igst, g.amount
  from public.order_items oi
  join public.products p on p.id = oi.product_id
  cross join lateral public.gst_line(oi.qty, oi.rate, p.gst_rate, v_set.rates_include_gst, v_intra) g
  where oi.order_id = p_order;

  get diagnostics v_lines = row_count;
  update public.orders set status = 'billed' where id = p_order;
  perform public.write_audit('bill.issue', 'invoice', v_invoice,
    jsonb_build_object('invoice_no', v_set.invoice_prefix || '/' || v_fy || '/' || lpad(v_seq::text, 4, '0'),
                       'lines', v_lines, 'grand_total', v_grand));
  return v_invoice;
end;
$$;

-- 4. Cancel a bill (the number stays used) --------------------------------------------------
-- The order goes back to "placed" so a corrected bill can be made with a new number.
-- Errors: not_admin, not_found, already_cancelled, reason_required, already_delivered, has_payments
create function public.cancel_bill(p_invoice uuid, p_reason text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_order_status public.order_status;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select * into v_invoice from public.invoices where id = p_invoice for update;
  if not found then raise exception 'not_found'; end if;
  if v_invoice.status = 'cancelled' then raise exception 'already_cancelled'; end if;
  if length(v_reason) < 3 then raise exception 'reason_required'; end if;

  select status into v_order_status from public.orders where id = v_invoice.order_id for update;
  if v_order_status = 'delivered' then raise exception 'already_delivered'; end if;
  if exists (select 1 from public.payments where invoice_id = p_invoice) then
    raise exception 'has_payments';
  end if;

  update public.invoices
  set status = 'cancelled', cancelled_reason = left(v_reason, 300), cancelled_at = now()
  where id = p_invoice;
  update public.orders set status = 'placed' where id = v_invoice.order_id;
  perform public.write_audit('bill.cancel', 'invoice', p_invoice,
    jsonb_build_object('invoice_no', v_invoice.invoice_no, 'reason', left(v_reason, 300)));
end;
$$;

-- 5. Fix quantities after packing, before billing ---------------------------------------------
-- p_items: [{"product_id": "<uuid>", "qty": 2}, ...] for lines already on the order.
-- Lines left out of the list are removed. The rate stays the one the shop was shown.
-- Errors: not_admin, not_found, not_placed, empty_order, bad_quantity, not_in_order
create function public.adjust_order(p_order uuid, p_items jsonb) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.order_status;
  v_merged jsonb;
  v_line record;
  v_before integer;
  v_after integer;
begin
  if public.app_role() is distinct from 'admin' then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select status into v_status from public.orders where id = p_order for update;
  if not found then raise exception 'not_found'; end if;
  if v_status <> 'placed' then raise exception 'not_placed'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('product_id', m.product_id, 'qty', m.qty)), '[]'::jsonb)
  into v_merged
  from (
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'qty')::numeric) as qty
    from jsonb_array_elements(p_items) as e
    group by 1
  ) m;

  for v_line in
    select x.product_id, x.qty from jsonb_to_recordset(v_merged) as x (product_id uuid, qty numeric)
  loop
    if v_line.qty <= 0 or v_line.qty > 100000 or v_line.qty <> round(v_line.qty, 3) then
      raise exception 'bad_quantity';
    end if;
    if not exists (select 1 from public.order_items oi where oi.order_id = p_order and oi.product_id = v_line.product_id) then
      raise exception 'not_in_order';
    end if;
  end loop;

  select count(*) into v_before from public.order_items where order_id = p_order;

  delete from public.order_items oi
  where oi.order_id = p_order
    and oi.product_id not in (select x.product_id from jsonb_to_recordset(v_merged) as x (product_id uuid, qty numeric));

  update public.order_items oi
  set qty = x.qty
  from jsonb_to_recordset(v_merged) as x (product_id uuid, qty numeric)
  where oi.order_id = p_order and oi.product_id = x.product_id;

  select count(*) into v_after from public.order_items where order_id = p_order;
  perform public.write_audit('order.adjust', 'order', p_order,
    jsonb_build_object('lines_before', v_before, 'lines_after', v_after));
end;
$$;

revoke all on function public.finalize_bill(uuid) from public, anon;
revoke all on function public.cancel_bill(uuid, text) from public, anon;
revoke all on function public.adjust_order(uuid, jsonb) from public, anon;
grant execute on function public.finalize_bill(uuid) to authenticated;
grant execute on function public.cancel_bill(uuid, text) to authenticated;
grant execute on function public.adjust_order(uuid, jsonb) to authenticated;
