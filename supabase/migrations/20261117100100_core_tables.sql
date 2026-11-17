-- Stage 1 / 2 of 5: people, items, daily rates and company settings.

-- Shops (customers).
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name_en text not null check (length(trim(name_en)) > 0),
  name_ta text,
  owner_name text,
  phone text,
  address text,
  -- GST state code. 33 = Tamil Nadu. Decides CGST+SGST (same state) or IGST (other state).
  state_code text not null default '33' check (state_code ~ '^[0-9]{2}$'),
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One row per login. Created only by the admin-users edge function (service role).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  shop_id uuid references public.shops (id),
  full_name text not null check (length(trim(full_name)) > 0),
  phone text not null unique check (phone ~ '^[6-9][0-9]{9}$'),
  language text not null default 'en' check (language in ('en', 'ta')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  -- Shop owners belong to a shop. Admin and distributors do not.
  constraint profiles_shop_matches_role check ((role = 'shop') = (shop_id is not null))
);
create index profiles_shop_id_idx on public.profiles (shop_id);

-- Item master. hsn_code and gst_rate are set by the admin with their accountant.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name_en text not null check (length(trim(name_en)) > 0),
  name_ta text,
  category text,
  unit text not null check (length(trim(unit)) > 0),
  hsn_code text check (hsn_code is null or hsn_code ~ '^[0-9]{4,8}$'),
  gst_rate numeric(5, 2) not null default 0 check (gst_rate >= 0 and gst_rate <= 28),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Today's rate per item. History is kept, one row per item per day.
create table public.daily_rates (
  product_id uuid not null references public.products (id),
  rate_date date not null,
  rate numeric(12, 2) not null check (rate >= 0),
  set_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (product_id, rate_date)
);

-- Company settings: always exactly one row.
create table public.settings (
  id boolean primary key default true check (id),
  company_name text not null default 'RK Agency',
  tagline text,
  address text,
  phone text,
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  state_code text not null default '33' check (state_code ~ '^[0-9]{2}$'),
  bank_details text,
  -- Invoice numbers look like RK/2627/0042 and must stay at 16 characters or fewer.
  invoice_prefix text not null default 'RK' check (length(invoice_prefix) between 1 and 6),
  -- false: rates are before GST and tax is added on the bill.
  rates_include_gst boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.settings default values;

create function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger settings_touch_updated_at
before update on public.settings
for each row execute function public.touch_updated_at();
