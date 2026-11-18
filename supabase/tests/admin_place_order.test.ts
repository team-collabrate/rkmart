import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, freshDb } from './helpers/db'

let db: PGlite
let admin: string
let admin2: string
let distributor: string
let owner: string
let shop: string
let inactiveShop: string
let sugar: string
let oil: string
let noRate: string

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

const place = (user: string, shopId: string, items: unknown, note: string | null = null) =>
  asUser(db, user, () =>
    db.query<{ admin_place_order: string }>(
      `select public.admin_place_order($1, $2::jsonb, $3) as admin_place_order`,
      [shopId, JSON.stringify(items), note],
    ),
  )

beforeAll(async () => {
  db = await freshDb()
  shop = (
    await one<{ id: string }>(
      `insert into public.shops (name_en, state_code) values ('Walk-in Shop', '33') returning id`,
    )
  ).id
  inactiveShop = (
    await one<{ id: string }>(
      `insert into public.shops (name_en, state_code, is_active) values ('Closed Shop', '33', false) returning id`,
    )
  ).id
  admin = await addUser('admin@rk.local', 'admin', '9000000001', null)
  admin2 = await addUser('admin2@rk.local', 'admin', '9000000009', null)
  distributor = await addUser('dist@rk.local', 'distributor', '9000000002', null)
  owner = await addUser('a@rk.local', 'shop', '9000000003', shop)
  const product = async (name: string, active = true) =>
    (
      await one<{ id: string }>(
        `insert into public.products (name_en, unit, hsn_code, gst_rate, is_active) values ($1, 'kg', '1701', 5, $2) returning id`,
        [name, active],
      )
    ).id
  sugar = await product('Sugar')
  oil = await product('Oil')
  noRate = await product('No rate item')
  await db.query(
    `insert into public.daily_rates (product_id, rate_date, rate) values ($1, public.india_today(), 46), ($2, public.india_today(), 780)`,
    [sugar, oil],
  )
  await db.query(`update public.settings set state_code = '33', invoice_prefix = 'RK'`)
})

afterAll(async () => {
  await db.close()
})

describe('admin_place_order', () => {
  it('places an order for a shop at the server rates, and merges repeated items', async () => {
    const id = (
      await place(
        admin,
        shop,
        [
          { product_id: sugar, qty: 10 },
          { product_id: sugar, qty: 5 },
          { product_id: oil, qty: 2 },
        ],
        '  phoned in  ',
      )
    ).rows[0].admin_place_order
    const order = await one<Record<string, unknown>>(
      `select shop_id, status, note, placed_by, order_date = public.india_today() as today from public.orders where id = $1`,
      [id],
    )
    expect(order).toEqual({
      shop_id: shop,
      status: 'placed',
      note: 'phoned in',
      placed_by: admin,
      today: true,
    })
    const items = await q<{ product_id: string; qty: string; rate: string }>(
      `select product_id, qty::text, rate::text from public.order_items where order_id = $1 order by rate`,
      [id],
    )
    expect(items.map((i) => [i.product_id, Number(i.qty), Number(i.rate)])).toEqual([
      [sugar, 15, 46],
      [oil, 2, 780],
    ])
  })

  it('can then be billed and delivered like any other order', async () => {
    const id = (await place(admin, shop, [{ product_id: sugar, qty: 4 }])).rows[0].admin_place_order
    const invoice = (
      await asUser(db, admin, () =>
        one<{ finalize_bill: string }>(`select public.finalize_bill($1) as finalize_bill`, [id]),
      )
    ).finalize_bill
    expect(invoice).toBeTruthy()
    await asUser(db, admin, () => db.query(`select public.mark_delivered($1)`, [id]))
    expect(
      (await one<{ status: string }>(`select status from public.orders where id = $1`, [id]))
        .status,
    ).toBe('delivered')
  })

  it('refuses anyone who is not the admin', async () => {
    for (const user of [owner, distributor]) {
      await expect(place(user, shop, [{ product_id: sugar, qty: 1 }])).rejects.toThrow(/not_admin/)
    }
  })

  it('refuses an unknown or switched-off shop', async () => {
    await expect(
      place(admin, '00000000-0000-0000-0000-000000000000', [{ product_id: sugar, qty: 1 }]),
    ).rejects.toThrow(/shop_not_found/)
    await expect(place(admin, inactiveShop, [{ product_id: sugar, qty: 1 }])).rejects.toThrow(
      /shop_inactive/,
    )
  })

  it('refuses an empty order, bad quantities, and items with no rate or switched off', async () => {
    await expect(place(admin, shop, [])).rejects.toThrow(/empty_order/)
    for (const qty of [0, -1, 100001, 1.2345]) {
      await expect(place(admin, shop, [{ product_id: sugar, qty }])).rejects.toThrow(/bad_quantity/)
    }
    await expect(place(admin, shop, [{ product_id: noRate, qty: 1 }])).rejects.toThrow(/no_rate/)
    await db.query(`update public.products set is_active = false where id = $1`, [oil])
    await expect(place(admin, shop, [{ product_id: oil, qty: 1 }])).rejects.toThrow(/inactive_item/)
    await db.query(`update public.products set is_active = true where id = $1`, [oil])
  })

  it('saves nothing when one line is bad, and writes an audit record', async () => {
    const before = Number(
      (await one<{ n: string }>(`select count(*)::text n from public.orders`)).n,
    )
    await expect(
      place(admin, shop, [
        { product_id: sugar, qty: 1 },
        { product_id: noRate, qty: 1 },
      ]),
    ).rejects.toThrow(/no_rate/)
    expect(Number((await one<{ n: string }>(`select count(*)::text n from public.orders`)).n)).toBe(
      before,
    )
    expect(
      Number(
        (
          await one<{ n: string }>(
            `select count(*)::text n from public.audit_log where action = 'order.place_admin'`,
          )
        ).n,
      ),
    ).toBeGreaterThanOrEqual(2)
  })

  it('does not alert the admin who entered it, but alerts the other admin', async () => {
    const id = (await place(admin, shop, [{ product_id: sugar, qty: 1 }])).rows[0].admin_place_order
    const url = `/admin/orders/${id}`
    expect(
      await q(`select 1 from public.notifications where profile_id = $1 and url = $2`, [
        admin,
        url,
      ]),
    ).toEqual([])
    expect(
      (
        await q(`select 1 from public.notifications where profile_id = $1 and url = $2`, [
          admin2,
          url,
        ])
      ).length,
    ).toBe(1)
  })
})
