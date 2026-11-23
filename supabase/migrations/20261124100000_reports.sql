-- Sales reports for the admin: the issued bills of a date range, added up by day, by shop and by
-- item. Cancelled bills are left out (their numbers stay used, but they are not sales).
-- Dues need no new function: the shop_balances view already says what each shop owes.
--
-- Errors: not_admin, bad_range (from is after to, or more than 400 days)
create function public.report_check_range(p_from date, p_to date)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select public.app_role()) is distinct from 'admin' then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 400 then
    raise exception 'bad_range';
  end if;
end;
$$;

create function public.report_sales_by_day(p_from date, p_to date)
returns table (day date, bills bigint, taxable numeric, tax numeric, round_off numeric, total numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.report_check_range(p_from, p_to);
  return query
  select i.issue_date, count(*), sum(i.taxable_total),
         sum(i.cgst_total + i.sgst_total + i.igst_total), sum(i.round_off), sum(i.grand_total)
  from public.invoices i
  where i.status = 'issued' and i.issue_date between p_from and p_to
  group by i.issue_date
  order by i.issue_date;
end;
$$;

create function public.report_sales_by_shop(p_from date, p_to date)
returns table (shop_id uuid, shop_name text, bills bigint, taxable numeric, tax numeric, total numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.report_check_range(p_from, p_to);
  return query
  select i.shop_id, max(i.shop_name), count(*), sum(i.taxable_total),
         sum(i.cgst_total + i.sgst_total + i.igst_total), sum(i.grand_total)
  from public.invoices i
  where i.status = 'issued' and i.issue_date between p_from and p_to
  group by i.shop_id
  order by sum(i.grand_total) desc;
end;
$$;

create function public.report_sales_by_item(p_from date, p_to date)
returns table (name_en text, name_ta text, unit text, qty numeric, taxable numeric, amount numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.report_check_range(p_from, p_to);
  return query
  select max(l.name_en), max(l.name_ta), l.unit, sum(l.qty), sum(l.taxable), sum(l.amount)
  from public.invoice_items l
  join public.invoices i on i.id = l.invoice_id
  where i.status = 'issued' and i.issue_date between p_from and p_to
  group by coalesce(l.product_id::text, l.name_en), l.unit
  order by sum(l.amount) desc;
end;
$$;

revoke all on function public.report_check_range(date, date) from public, anon;
revoke all on function public.report_sales_by_day(date, date) from public, anon;
revoke all on function public.report_sales_by_shop(date, date) from public, anon;
revoke all on function public.report_sales_by_item(date, date) from public, anon;
grant execute on function public.report_sales_by_day(date, date) to authenticated;
grant execute on function public.report_sales_by_shop(date, date) to authenticated;
grant execute on function public.report_sales_by_item(date, date) to authenticated;
