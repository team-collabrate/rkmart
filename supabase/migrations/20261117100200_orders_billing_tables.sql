-- Stage 1 / 3 of 5: orders, GST invoices, payments, PDFs, push tokens and audit log.
-- Rows in these tables are written by database functions added in Stages 4 to 7,
-- never directly by the app (see the privileges migration).

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  order_date date not null default current_date,
  status public.order_status not null default 'placed',
  note text,
  placed_by uuid references public.profiles (id),
  delivered_at timestamptz,
  delivered_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index orders_shop_date_idx on public.orders (shop_id, order_date desc);
create index orders_status_date_idx on public.orders (status, order_date desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  qty numeric(12, 3) not null check (qty > 0),
  -- Rate shown to the shop when the order was placed. Later rate changes never alter it.
  rate numeric(12, 2) not null check (rate >= 0),
  unique (order_id, product_id)
);

-- Invoice numbers are allocated per financial year, with no gaps (done in Stage 5).
create table public.invoice_counters (
  fy text primary key check (fy ~ '^[0-9]{4}$'),
  last_seq integer not null default 0 check (last_seq >= 0)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id),
  shop_id uuid not null references public.shops (id),
  invoice_no text not null unique check (length(invoice_no) <= 16),
  fy text not null check (fy ~ '^[0-9]{4}$'),
  seq integer not null check (seq > 0),
  issue_date date not null default current_date,
  -- Snapshot of the shop at the time of billing.
  shop_name text not null,
  shop_address text,
  shop_gstin text,
  shop_state_code text not null,
  taxable_total numeric(14, 2) not null,
  cgst_total numeric(14, 2) not null default 0,
  sgst_total numeric(14, 2) not null default 0,
  igst_total numeric(14, 2) not null default 0,
  round_off numeric(6, 2) not null default 0,
  grand_total numeric(14, 2) not null check (grand_total >= 0),
  -- Shop balance just before this bill, kept so a reprint is identical.
  previous_balance numeric(14, 2) not null default 0,
  total_due numeric(14, 2) not null,
  status public.invoice_status not null default 'issued',
  cancelled_reason text,
  cancelled_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (fy, seq)
);
create index invoices_shop_date_idx on public.invoices (shop_id, issue_date desc);
create index invoices_issue_date_idx on public.invoices (issue_date desc);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  line_no integer not null check (line_no > 0),
  product_id uuid references public.products (id),
  -- Snapshot of the item at the time of billing.
  name_en text not null,
  name_ta text,
  hsn_code text,
  unit text not null,
  qty numeric(12, 3) not null check (qty > 0),
  rate numeric(12, 2) not null check (rate >= 0),
  taxable numeric(14, 2) not null,
  gst_rate numeric(5, 2) not null,
  cgst numeric(14, 2) not null default 0,
  sgst numeric(14, 2) not null default 0,
  igst numeric(14, 2) not null default 0,
  amount numeric(14, 2) not null,
  unique (invoice_id, line_no)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  -- Empty when the money is a general payment toward the running balance.
  invoice_id uuid references public.invoices (id),
  amount numeric(14, 2) not null check (amount > 0),
  method public.payment_method not null default 'cash',
  paid_on date not null default current_date,
  note text,
  recorded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index payments_shop_date_idx on public.payments (shop_id, paid_on desc);

-- Each export of "the day's bills" as one PDF. Re-exports get a new version.
create table public.daily_bill_pdfs (
  id uuid primary key default gen_random_uuid(),
  bill_date date not null,
  version integer not null default 1 check (version > 0),
  file_path text not null,
  bill_count integer not null check (bill_count >= 0),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (bill_date, version)
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'web')),
  token text not null unique,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index push_tokens_profile_idx on public.push_tokens (profile_id);

-- Who did what on money records.
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create index audit_log_at_idx on public.audit_log (at desc);
