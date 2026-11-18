-- The admin can place an order for a shop. Some shops do not order through the app (they phone or
-- visit), so the admin enters the order, then bills and delivers it with the same screens as any
-- other order.
--
-- Same checks as place_order(): the shop must be active, every item must be active and have a rate
-- for today, quantities are checked, and the saved rate is the server's rate.
-- Errors: not_admin, shop_not_found, shop_inactive, empty_order, too_many_items, bad_quantity,
--   inactive_item:<id>, no_rate:<id>
create function public.admin_place_order(p_shop uuid, p_items jsonb, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := public.india_today();
  v_order uuid;
  v_line record;
  v_lines integer;
  v_merged jsonb;
begin
  if (select public.app_role()) is distinct from 'admin' then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if not exists (select 1 from public.shops s where s.id = p_shop) then
    raise exception 'shop_not_found';
  end if;
  if not exists (select 1 from public.shops s where s.id = p_shop and s.is_active) then
    raise exception 'shop_inactive';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'too_many_items';
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
  values (p_shop, v_day, 'placed', nullif(left(btrim(coalesce(p_note, '')), 500), ''), (select auth.uid()))
  returning id into v_order;

  insert into public.order_items (order_id, product_id, qty, rate)
  select v_order, x.product_id, x.qty, r.rate
  from jsonb_to_recordset(v_merged) as x (product_id uuid, qty numeric)
  join public.daily_rates r on r.product_id = x.product_id and r.rate_date = v_day;

  get diagnostics v_lines = row_count;
  perform public.write_audit('order.place_admin', 'order', v_order,
    jsonb_build_object('lines', v_lines, 'shop', p_shop));

  return v_order;
end;
$$;

revoke all on function public.admin_place_order(uuid, jsonb, text) from public, anon;
grant execute on function public.admin_place_order(uuid, jsonb, text) to authenticated;

-- The admin who entered the order does not need an alert about it.
create or replace function public.notify_new_order() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop text;
  v_admin uuid;
begin
  select name_en into v_shop from public.shops where id = new.shop_id;
  for v_admin in
    select id from public.profiles
    where role = 'admin' and is_active and id is distinct from new.placed_by
  loop
    perform public.notify(
      v_admin, 'order.new',
      'New order', coalesce(v_shop, 'A shop') || ' placed an order.',
      'புது ஆர்டர்', coalesce(v_shop, 'ஒரு கடை') || ' ஆர்டர் போட்டிருக்காங்க.',
      '/admin/orders/' || new.id
    );
  end loop;
  return new;
end;
$$;
