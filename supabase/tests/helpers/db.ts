import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Runs the real migrations in an in-process Postgres (PGlite), so access rules and guards can
// be tested without Docker. Supabase's own pieces (the three API roles and auth.users / auth.uid)
// are recreated here as minimal stand-ins.

const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'migrations')

export type Role = 'admin' | 'distributor' | 'shop'

export async function freshDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;

    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    grant usage on schema public to anon, authenticated, service_role;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `)

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  }
  return db
}

/** Runs queries as a logged-in user (Postgres role "authenticated") with the given user id. */
export async function asUser<T>(db: PGlite, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(
    `select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated;`,
  )
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}

/** Runs queries as a visitor who is not logged in (Postgres role "anon"). */
export async function asAnon<T>(db: PGlite, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role anon;`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role;`)
  }
}

export interface World {
  shopA: string
  shopB: string
  admin: string
  distributor: string
  ownerA: string
  ownerB: string
  inactiveOwner: string
  product: string
  orderA: string
  orderB: string
  orderBilledA: string
  invoiceA: string
}

/** Builds a small world as the superuser: two shops, one user per role, orders and an invoice. */
export async function seedWorld(db: PGlite): Promise<World> {
  const id = async (sql: string, params: unknown[] = []) =>
    (await db.query<{ id: string }>(sql, params)).rows[0].id

  const shopA = await id(
    `insert into public.shops (name_en, state_code) values ('Shop A', '33') returning id`,
  )
  const shopB = await id(
    `insert into public.shops (name_en, state_code) values ('Shop B', '33') returning id`,
  )

  const user = async (
    email: string,
    role: Role,
    phone: string,
    shopId: string | null,
    active = true,
  ) => {
    const uid = await id(`insert into auth.users (email) values ($1) returning id`, [email])
    await db.query(
      `insert into public.profiles (id, role, shop_id, full_name, phone, is_active) values ($1, $2, $3, $4, $5, $6)`,
      [uid, role, shopId, email, phone, active],
    )
    return uid
  }
  const admin = await user('admin@rk.local', 'admin', '9000000001', null)
  const distributor = await user('dist@rk.local', 'distributor', '9000000002', null)
  const ownerA = await user('a@rk.local', 'shop', '9000000003', shopA)
  const ownerB = await user('b@rk.local', 'shop', '9000000004', shopB)
  const inactiveOwner = await user('gone@rk.local', 'shop', '9000000005', shopA, false)

  const product = await id(
    `insert into public.products (name_en, unit, hsn_code, gst_rate) values ('Sugar', 'kg', '1701', 5) returning id`,
  )
  await db.query(
    `insert into public.daily_rates (product_id, rate_date, rate) values ($1, current_date, 46)`,
    [product],
  )

  const order = (shop: string, status: string) =>
    id(`insert into public.orders (shop_id, status) values ($1, $2) returning id`, [shop, status])
  const orderA = await order(shopA, 'placed')
  const orderB = await order(shopB, 'placed')
  const orderBilledA = await order(shopA, 'billed')

  for (const o of [orderA, orderB, orderBilledA]) {
    await db.query(
      `insert into public.order_items (order_id, product_id, qty, rate) values ($1, $2, 10, 46)`,
      [o, product],
    )
  }

  const invoiceA = await id(
    `insert into public.invoices
       (order_id, shop_id, invoice_no, fy, seq, shop_name, shop_state_code,
        taxable_total, cgst_total, sgst_total, grand_total, total_due)
     values ($1, $2, 'RK/2627/0001', '2627', 1, 'Shop A', '33', 460, 11.5, 11.5, 483, 483)
     returning id`,
    [orderBilledA, shopA],
  )
  await db.query(
    `insert into public.invoice_items (invoice_id, line_no, product_id, name_en, unit, qty, rate, taxable, gst_rate, cgst, sgst, amount)
     values ($1, 1, $2, 'Sugar', 'kg', 10, 46, 460, 5, 11.5, 11.5, 483)`,
    [invoiceA, product],
  )

  return {
    shopA,
    shopB,
    admin,
    distributor,
    ownerA,
    ownerB,
    inactiveOwner,
    product,
    orderA,
    orderB,
    orderBilledA,
    invoiceA,
  }
}
