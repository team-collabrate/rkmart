-- Stage 4: shop ordering.
--
-- A shop owner places an order with place_order(). It is the ONLY way an order is created:
-- the app has no direct write access to orders (see the privileges migration).
-- The function checks everything on the server, so a modified app cannot cheat:
--   * only an active shop owner of an active shop can order
--   * every item must be active and have a rate for today
--   * the rate saved on the order is the server's rate, not one sent by the app

-- Today's calendar day in India. Rates and orders are per Indian day.
create function public.india_today() returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

grant execute on function public.india_today() to authenticated;

-- p_items: [{"product_id": "<uuid>", "qty": 2.5}, ...]
-- Returns the new order's id. Errors carry a short code the app turns into a message:
--   not_shop, shop_inactive, empty_order, too_many_items, bad_quantity,
--   inactive_item:<product id>, no_rate:<product id>
create function public.place_order(p_items jsonb, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.app_role();
  v_shop uuid := public.app_shop_id();
  v_day date := public.india_today();
  v_order uuid;
  v_line record;
  v_lines integer;
  v_merged jsonb;
begin
  if v_role is distinct from 'shop' or v_shop is null then
    raise exception 'not_shop' using errcode = '42501';
  end if;
  if not exists (select 1 from public.shops s where s.id = v_shop and s.is_active) then
    raise exception 'shop_inactive' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'too_many_items';
  end if;

  -- Same item twice in the list becomes one line with the quantities added up.
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
    if not exists (select 1 from public.products p where p.id = v_line.product_id and p.is_active) then
      raise exception 'inactive_item:%', v_line.product_id;
    end if;
    if not exists (
      select 1 from public.daily_rates r where r.product_id = v_line.product_id and r.rate_date = v_day
    ) then
      raise exception 'no_rate:%', v_line.product_id;
    end if;
  end loop;

  insert into public.orders (shop_id, order_date, status, note, placed_by)
  values (v_shop, v_day, 'placed', nullif(left(btrim(coalesce(p_note, '')), 500), ''), (select auth.uid()))
  returning id into v_order;

  insert into public.order_items (order_id, product_id, qty, rate)
  select v_order, x.product_id, x.qty, r.rate
  from jsonb_to_recordset(v_merged) as x (product_id uuid, qty numeric)
  join public.daily_rates r on r.product_id = x.product_id and r.rate_date = v_day;

  get diagnostics v_lines = row_count;
  perform public.write_audit('order.place', 'order', v_order, jsonb_build_object('lines', v_lines));

  return v_order;
end;
$$;

revoke all on function public.place_order(jsonb, text) from public, anon;
grant execute on function public.place_order(jsonb, text) to authenticated;

-- Let the admin's screen update live when an order arrives (Supabase only; harmless elsewhere).
-- Row level security still decides who receives which row.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
