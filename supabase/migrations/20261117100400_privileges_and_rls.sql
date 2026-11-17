-- Stage 1 / 5 of 5: privileges, row level security and the balance view.
--
-- Principle: the app (role "authenticated") gets the least it needs.
--   * Reads are filtered row by row by the policies below.
--   * Almost every write goes through a database function (Stages 4 to 7) or the
--     admin-users edge function, which use elevated rights. The app cannot write orders,
--     invoices or payments directly.
--   * "anon" (not logged in) can do nothing.
-- New tables must grant access explicitly: default privileges are switched off below.

-- 1. Start from nothing -----------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

grant execute on function public.app_role() to authenticated;
grant execute on function public.app_shop_id() to authenticated;

-- 2. What each table allows the app to do (RLS then filters rows) ------------
grant select on
  public.shops, public.profiles, public.products, public.daily_rates, public.settings,
  public.orders, public.order_items, public.invoices, public.invoice_items,
  public.payments, public.daily_bill_pdfs, public.audit_log, public.push_tokens
to authenticated;

-- Admin-managed master data (admin-only by policy).
grant insert, update, delete on public.shops, public.products, public.daily_rates to authenticated;
grant update on public.settings to authenticated;

-- A user may change only their own language. Everything else on profiles is changed
-- through the admin-users edge function.
grant update (language) on public.profiles to authenticated;

-- Each user manages their own push tokens.
grant insert, update, delete on public.push_tokens to authenticated;

-- 3. Turn row level security on everywhere ----------------------------------
alter table public.shops enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.daily_rates enable row level security;
alter table public.settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.invoice_counters enable row level security; -- internal: no policy, no access
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.daily_bill_pdfs enable row level security;
alter table public.push_tokens enable row level security;
alter table public.audit_log enable row level security;

-- 4. Policies ---------------------------------------------------------------

-- profiles: your own row, or everything for the admin.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.app_role()) = 'admin');
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.app_role()) = 'admin')
  with check (id = (select auth.uid()) or (select public.app_role()) = 'admin');

-- shops: admin and distributors see every shop (delivery needs the address); a shop owner sees their own.
create policy shops_select on public.shops for select to authenticated
  using ((select public.app_role()) in ('admin', 'distributor') or id = (select public.app_shop_id()));
create policy shops_admin_write on public.shops for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- products: every signed-in user reads; the admin manages.
create policy products_select on public.products for select to authenticated
  using ((select public.app_role()) is not null);
create policy products_admin_write on public.products for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- daily_rates: shop owners and admin read; the admin sets them. Distributors do not see prices.
create policy daily_rates_select on public.daily_rates for select to authenticated
  using ((select public.app_role()) in ('admin', 'shop'));
create policy daily_rates_admin_write on public.daily_rates for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- settings: admin only (it holds bank details).
create policy settings_admin on public.settings for all to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- orders: admin sees all, a shop sees its own, a distributor sees bills out for delivery (last 7 days).
create policy orders_select on public.orders for select to authenticated
  using (
    (select public.app_role()) = 'admin'
    or shop_id = (select public.app_shop_id())
    or (
      (select public.app_role()) = 'distributor'
      and status in ('billed', 'delivered')
      and order_date >= current_date - 7
    )
  );

-- order_items: admin and shop only (distributors do not see items or prices), and only for orders they can see.
create policy order_items_select on public.order_items for select to authenticated
  using (
    (select public.app_role()) in ('admin', 'shop')
    and exists (select 1 from public.orders o where o.id = order_items.order_id)
  );

-- invoices: admin all, shop its own, distributor the totals of the orders they can see.
create policy invoices_select on public.invoices for select to authenticated
  using (
    (select public.app_role()) = 'admin'
    or shop_id = (select public.app_shop_id())
    or (
      (select public.app_role()) = 'distributor'
      and exists (select 1 from public.orders o where o.id = invoices.order_id)
    )
  );

-- invoice_items: admin and shop only, never distributors.
create policy invoice_items_select on public.invoice_items for select to authenticated
  using (
    (select public.app_role()) in ('admin', 'shop')
    and exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id)
  );

-- payments: admin all, a shop its own.
create policy payments_select on public.payments for select to authenticated
  using ((select public.app_role()) = 'admin' or shop_id = (select public.app_shop_id()));

-- daily_bill_pdfs and audit_log: admin only.
create policy daily_bill_pdfs_admin on public.daily_bill_pdfs for select to authenticated
  using ((select public.app_role()) = 'admin');
create policy audit_log_admin on public.audit_log for select to authenticated
  using ((select public.app_role()) = 'admin');

-- push_tokens: each user manages only their own.
create policy push_tokens_own on public.push_tokens for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- 5. Balance per shop: invoices minus payments. Calculated, never stored. -----
-- security_invoker makes the view obey the policies above, so a shop sees only its own row.
-- Distributors get nothing: they must not see what shops owe.
create view public.shop_balances with (security_invoker = true) as
select
  s.id as shop_id,
  s.name_en,
  s.name_ta,
  coalesce(i.invoiced, 0) as invoiced,
  coalesce(p.paid, 0) as paid,
  coalesce(i.invoiced, 0) - coalesce(p.paid, 0) as balance
from public.shops s
left join (
  select shop_id, sum(grand_total) as invoiced
  from public.invoices
  where status = 'issued'
  group by shop_id
) i on i.shop_id = s.id
left join (
  select shop_id, sum(amount) as paid
  from public.payments
  group by shop_id
) p on p.shop_id = s.id
where (select public.app_role()) in ('admin', 'shop');

grant select on public.shop_balances to authenticated;
