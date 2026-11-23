import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, freshDb } from './helpers/db'

let db: PGlite
let admin: string
let owner: string
let distributor: string
let shopA: string
let shopB: string
let sugar: string
let oil: string

const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await q<T>(sql, params))[0]

async function addUser(email: string, role: string, phone: string, shopId: string | null) {
  const id = (
    await one<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email])
  ).id
  await db.query(
    `insert into public.profiles (id, role, shop_id, full_name, phone) values ($1, $2, $3, $4, $5)`,
    [id, role, shopId, email, phone],
  )
  return id
}

/** Places an order for a shop as the admin and bills it. Returns the invoice id. */
async function billed(shop: string, items: { product_id: string; qty: number }[]) {
  const orderId = (
    await asUser(db, admin, () =>
      db.query<{ id: string }>(`select public.admin_place_order($1, $2::jsonb, null) as id`, [
        shop,
        JSON.stringify(items),
      ]),
    )
  ).rows[0].id
  return (
    await asUser(db, admin, () =>
      db.query<{ id: string }>(`select public.finalize_bill($1) as id`, [orderId]),
    )
  ).rows[0].id
}

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
const call = (user: string, fn: string, from = day(-3), to = day(3)) =>
  asUser(db, user, () =>
    db.query<Record<string, string | number | null>>(`select * from public.${fn}($1, $2)`, [
      from,
      to,
    ]),
  )

beforeAll(async () => {
  db = await freshDb()
  await db.query(`update public.settings set state_code = '33', invoice_prefix = 'RK'`)
  shopA = (
    await one<{ id: string }>(
      `insert into public.shops (name_en, state_code) values ('Shop A', '33') returning id`,
    )
  ).id
  shopB = (
    await one<{ id: string }>(
      `insert into public.shops (name_en, state_code) values ('Shop B', '33') returning id`,
    )
  ).id
  admin = await addUser('admin@rk.local', 'admin', '9000000001', null)
  distributor = await addUser('dist@rk.local', 'distributor', '9000000002', null)
  owner = await addUser('a@rk.local', 'shop', '9000000003', shopA)
  const product = async (name: string, gst: number) =>
    (
      await one<{ id: string }>(
        `insert into public.products (name_en, unit, hsn_code, gst_rate) values ($1, 'kg', '1701', $2) returning id`,
        [name, gst],
      )
    ).id
  sugar = await product('Sugar', 5)
  oil = await product('Oil', 0)
  await db.query(
    `insert into public.daily_rates (product_id, rate_date, rate) values ($1, public.india_today(), 100), ($2, public.india_today(), 200)`,
    [sugar, oil],
  )
  // Shop A: 10 sugar + 2 oil. Shop B: 4 sugar. Plus one bill that is cancelled again.
  await billed(shopA, [
    { product_id: sugar, qty: 10 },
    { product_id: oil, qty: 2 },
  ])
  await billed(shopB, [{ product_id: sugar, qty: 4 }])
  const cancelled = await billed(shopB, [{ product_id: oil, qty: 100 }])
  await asUser(db, admin, () =>
    db.query(`select public.cancel_bill($1, 'wrong order')`, [cancelled]),
  )
})

afterAll(async () => {
  await db.close()
})

describe('sales reports', () => {
  it('adds up the issued bills of each day, leaving cancelled bills out', async () => {
    const rows = (await call(admin, 'report_sales_by_day')).rows
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].bills)).toBe(2)
    // taxable 1000 + 400 + 400 = 1800; sugar carries 5% GST: 50 + 20
    expect(Number(rows[0].taxable)).toBe(1800)
    expect(Number(rows[0].tax)).toBe(70)
    expect(Number(rows[0].total) + 0).toBeGreaterThan(1860)
  })

  it('ranks the shops by what they bought', async () => {
    const rows = (await call(admin, 'report_sales_by_shop')).rows
    expect(rows.map((r) => r.shop_name)).toEqual(['Shop A', 'Shop B'])
    expect(Number(rows[0].bills)).toBe(1)
    expect(Number(rows[0].taxable)).toBe(1400)
    expect(Number(rows[1].taxable)).toBe(400)
  })

  it('adds up each item over all bills, biggest first', async () => {
    const rows = (await call(admin, 'report_sales_by_item')).rows
    expect(rows.map((r) => [r.name_en, Number(r.qty)])).toEqual([
      ['Sugar', 14],
      ['Oil', 2],
    ])
  })

  it('looks only at the dates asked for', async () => {
    expect(
      (await call(admin, 'report_sales_by_day', '2000-01-01', '2000-01-31')).rows,
    ).toHaveLength(0)
  })

  it('refuses a backwards or huge range', async () => {
    await expect(call(admin, 'report_sales_by_day', '2026-02-01', '2026-01-01')).rejects.toThrow(
      /bad_range/,
    )
    await expect(call(admin, 'report_sales_by_item', '2024-01-01', '2026-01-01')).rejects.toThrow(
      /bad_range/,
    )
  })

  it('is for the admin only', async () => {
    for (const user of [owner, distributor]) {
      for (const fn of ['report_sales_by_day', 'report_sales_by_shop', 'report_sales_by_item']) {
        await expect(call(user, fn)).rejects.toThrow(/not_admin/)
      }
    }
  })
})
