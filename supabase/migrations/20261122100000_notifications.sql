-- Stage 8: alerts (push notifications).
-- Every alert is a row in `notifications`, written by the database when something happens. The
-- send-push edge function sends the unsent rows to the person's phones and browsers. The text is
-- written here, in the language of the person who will read it.
--
-- Who gets what:
--   new order placed          -> every active admin
--   order delivered           -> the shop's logins, with what is now due
--   payment recorded          -> the shop's logins, with the balance
--   daily payment reminder    -> the shop's logins, when something is owed (enqueue_payment_reminders)

create table public.notifications (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  -- Where the app goes when the alert is tapped.
  url text not null default '/',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text
);
create index notifications_unsent_idx on public.notifications (id) where sent_at is null;
create index notifications_profile_idx on public.notifications (profile_id, created_at desc);

alter table public.notifications enable row level security;
-- A person can read their own alerts. Nobody writes from the app: only the functions below.
create policy notifications_own on public.notifications for select to authenticated
  using (profile_id = (select auth.uid()));
grant select on public.notifications to authenticated;

-- 1. Writing one alert (internal) ----------------------------------------------------------------
-- Picks English or Tamil from the person's profile. Switched-off logins get nothing.
create function public.notify(
  p_profile uuid,
  p_kind text,
  p_title_en text,
  p_body_en text,
  p_title_ta text,
  p_body_ta text,
  p_url text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_language text;
begin
  select language into v_language from public.profiles where id = p_profile and is_active;
  if not found then return; end if;
  insert into public.notifications (profile_id, kind, title, body, url)
  values (
    p_profile, p_kind,
    case when v_language = 'ta' then p_title_ta else p_title_en end,
    case when v_language = 'ta' then p_body_ta else p_body_en end,
    p_url
  );
end;
$$;
revoke all on function public.notify(uuid, text, text, text, text, text, text) from public;

-- Amounts read as plain rupees: 1250 -> "₹1250", 1250.5 -> "₹1250.50".
create function public.money_text(p_amount numeric) returns text
language sql
immutable
set search_path = ''
as $$
  select '₹' || case when p_amount = trunc(p_amount)
    then to_char(p_amount, 'FM9999999990') else to_char(p_amount, 'FM9999999990.00') end
$$;

-- What a shop owes right now: issued bills minus payments.
create function public.shop_owes(p_shop uuid) returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select sum(grand_total) from public.invoices where shop_id = p_shop and status = 'issued'), 0)
       - coalesce((select sum(amount) from public.payments where shop_id = p_shop), 0)
$$;
revoke all on function public.shop_owes(uuid) from public;

-- 2. New order -> admins -------------------------------------------------------------------------
create function public.notify_new_order() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop text;
  v_admin uuid;
begin
  select name_en into v_shop from public.shops where id = new.shop_id;
  for v_admin in select id from public.profiles where role = 'admin' and is_active loop
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
create trigger orders_notify_new after insert on public.orders
for each row execute function public.notify_new_order();

-- 3. Delivered -> the shop, with what is now due -------------------------------------------------
create function public.notify_delivered() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_no text;
  v_owes numeric;
  v_user uuid;
begin
  if not (old.status is distinct from 'delivered' and new.status = 'delivered') then return new; end if;
  select invoice_no into v_no from public.invoices where order_id = new.id and status = 'issued';
  v_owes := public.shop_owes(new.shop_id);
  for v_user in select id from public.profiles where shop_id = new.shop_id and role = 'shop' and is_active loop
    perform public.notify(
      v_user, 'delivery.done',
      'Order delivered',
      case when v_owes > 0
        then 'Bill ' || coalesce(v_no, '') || ' delivered. Payment due: ' || public.money_text(v_owes) || '.'
        else 'Bill ' || coalesce(v_no, '') || ' delivered. Nothing is due. Thank you!' end,
      'ஆர்டர் டெலிவரி ஆச்சு',
      case when v_owes > 0
        then 'பில் ' || coalesce(v_no, '') || ' டெலிவரி ஆச்சு. கட்ட வேண்டியது: ' || public.money_text(v_owes) || '.'
        else 'பில் ' || coalesce(v_no, '') || ' டெலிவரி ஆச்சு. பாக்கி இல்லை. நன்றி!' end,
      '/shop/payments'
    );
  end loop;
  return new;
end;
$$;
create trigger orders_notify_delivered after update of status on public.orders
for each row execute function public.notify_delivered();

-- 4. Payment recorded -> the shop ----------------------------------------------------------------
create function public.notify_payment() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owes numeric := public.shop_owes(new.shop_id);
  v_user uuid;
begin
  for v_user in select id from public.profiles where shop_id = new.shop_id and role = 'shop' and is_active loop
    perform public.notify(
      v_user, 'payment.received',
      'Payment received',
      'RK received ' || public.money_text(new.amount) || '. ' ||
        case when v_owes > 0 then 'Still due: ' || public.money_text(v_owes) || '.' else 'Nothing is due. Thank you!' end,
      'பணம் கிடைச்சது',
      'RK-க்கு ' || public.money_text(new.amount) || ' கிடைச்சது. ' ||
        case when v_owes > 0 then 'இன்னும் பாக்கி: ' || public.money_text(v_owes) || '.' else 'பாக்கி இல்லை. நன்றி!' end,
      '/shop/payments'
    );
  end loop;
  return new;
end;
$$;
create trigger payments_notify after insert on public.payments
for each row execute function public.notify_payment();

-- 5. Daily payment reminder -----------------------------------------------------------------------
-- One reminder per login that is owed money. A login that already got one in the last 20 hours is
-- skipped, so running it twice in a day sends nothing extra. Returns how many alerts were written.
-- Called by the schedule below, or by an admin through the service key. Not callable from the app.
create function public.enqueue_payment_reminders() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop record;
  v_user uuid;
  v_owes numeric;
  v_count integer := 0;
begin
  for v_shop in select id from public.shops where is_active loop
    v_owes := public.shop_owes(v_shop.id);
    continue when v_owes <= 0;
    for v_user in
      select p.id from public.profiles p
      where p.shop_id = v_shop.id and p.role = 'shop' and p.is_active
        and not exists (
          select 1 from public.notifications n
          where n.profile_id = p.id and n.kind = 'payment.reminder'
            and n.created_at > now() - interval '20 hours'
        )
    loop
      perform public.notify(
        v_user, 'payment.reminder',
        'Payment reminder',
        'Please pay ' || public.money_text(v_owes) || ' to RK.',
        'பணம் நினைவூட்டல்',
        'RK-க்கு ' || public.money_text(v_owes) || ' கட்டுங்க.',
        '/shop/payments'
      );
      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.enqueue_payment_reminders() from public;
revoke all on function public.enqueue_payment_reminders() from anon, authenticated;

-- 6. Schedule (real Supabase project with pg_cron only) -------------------------------------------
-- 18:00 India time every day (12:30 UTC).
do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.schedule('rk-payment-reminders', '30 12 * * *', 'select public.enqueue_payment_reminders()');
  end if;
end
$$;
