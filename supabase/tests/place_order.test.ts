import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, freshDb, seedWorld, type World } from './helpers/db'

let db: PGlite
let w: World
let sugar: string
let rice: string
let jaggery: string // active, no rate today
let retired: string // switched off

beforeAll(async () => {
  db = await freshDb()
  w = await seedWorld(db)
  sugar = w.product
  const add = async (name: string, active: boolean) =>
    (
      await db.query<{ id: string }>(
        `insert into public.products (name_en, unit, gst_rate, is_active) values ($1, 'kg', 5, $2) returning id`,
        [name, active],
      )
    ).rows[0].id
  rice = await add('Rice', true)
  jaggery = await add('Jaggery', true)
  retired = await add('Old item', false)
  // Rates for TODAY IN INDIA (the seed uses the server date, which can differ late in the UTC day).
  await db.query(
    `insert into public.daily_rates (product_id, rate_date, rate) values
       ($1, public.india_today(), 46.5), ($2, public.india_today(), 1350), ($3, public.india_today(), 10)
     on conflict (product_id, rate_date) do update set rate = excluded.rate`,
    [sugar, rice, retired],
  )
})

afterAll(async () => {
  await db.close()
})

const place = (items: unknown, note: string | null = null) =>
  db.query<{ place_order: string }>(`select public.place_order($1::jsonb, $2) as place_order`, [
    JSON.stringify(items),
    note,
  ])

const orderCount = async () =>
  Number((await db.query<{ n: number }>(`select count(*)::int as n from public.orders`)).rows[0].n)

describe('place_order', () => {
  it('creates an order for the shop owner’s own shop at the server’s rates', async () => {
    const id = await asUser(db, w.ownerA, async () => {
      const r = await place(
        [
          { product_id: sugar, qty: 10 },
          { product_id: rice, qty: 2.5 },
        ],
        '  early please ',
      )
      return r.rows[0].place_order
    })

    const order = (
      await db.query(
        `select shop_id, status, note, placed_by, order_date = public.india_today() as today from public.orders where id = $1`,
        [id],
      )
    ).rows[0] as Record<string, unknown>
    expect(order).toMatchObject({
      shop_id: w.shopA,
      status: 'placed',
      note: 'early please',
      placed_by: w.ownerA,
      today: true,
    })

    const items = (
      await db.query(
        `select product_id, qty::float, rate::float from public.order_items where order_id = $1 order by qty`,
        [id],
      )
    ).rows as { product_id: string; qty: number; rate: number }[]
    expect(items).toEqual([
      { product_id: rice, qty: 2.5, rate: 1350 },
      { product_id: sugar, qty: 10, rate: 46.5 },
    ])
  })

  it('adds up the same item listed twice', async () => {
    const id = await asUser(
      db,
      w.ownerA,
      async () =>
        (
          await place([
            { product_id: sugar, qty: 3 },
            { product_id: sugar, qty: 4 },
          ])
        ).rows[0].place_order,
    )
    const rows = (
      await db.query(`select qty::float from public.order_items where order_id = $1`, [id])
    ).rows
    expect(rows).toEqual([{ qty: 7 }])
  })

  it('shows the new order to its shop and the admin, not to another shop', async () => {
    await asUser(db, w.ownerB, async () => {
      expect(
        Number(
          (
            await db.query(`select count(*)::int as n from public.orders where shop_id = $1`, [
              w.shopA,
            ])
          ).rows[0].n,
        ),
      ).toBe(0)
    })
    await asUser(db, w.admin, async () => {
      expect(
        Number(
          (
            await db.query(
              `select count(*)::int as n from public.orders where shop_id = $1 and status = 'placed'`,
              [w.shopA],
            )
          ).rows[0].n,
        ),
      ).toBeGreaterThanOrEqual(3)
    })
  })

  it('writes an audit record', async () => {
    const n = Number(
      (
        await db.query(
          `select count(*)::int as n from public.audit_log where action = 'order.place'`,
        )
      ).rows[0].n,
    )
    expect(n).toBeGreaterThanOrEqual(2)
  })

  it('refuses the admin, a distributor and a deactivated shop owner', async () => {
    const before = await orderCount()
    for (const user of [w.admin, w.distributor, w.inactiveOwner]) {
      await asUser(db, user, async () => {
        await expect(place([{ product_id: sugar, qty: 1 }])).rejects.toThrow(/not_shop/)
      })
    }
    expect(await orderCount()).toBe(before)
  })

  it('refuses a switched-off shop', async () => {
    await db.query(`update public.shops set is_active = false where id = $1`, [w.shopB])
    await asUser(db, w.ownerB, async () => {
      await expect(place([{ product_id: sugar, qty: 1 }])).rejects.toThrow(/shop_inactive/)
    })
    await db.query(`update public.shops set is_active = true where id = $1`, [w.shopB])
  })

  it('refuses an empty or malformed order', async () => {
    await asUser(db, w.ownerA, async () => {
      await expect(place([])).rejects.toThrow(/empty_order/)
      await expect(place({ product_id: sugar })).rejects.toThrow(/empty_order/)
    })
  })

  it('refuses zero, negative, huge and over-precise quantities', async () => {
    await asUser(db, w.ownerA, async () => {
      for (const qty of [0, -1, 100001, 1.2345]) {
        await expect(place([{ product_id: sugar, qty }])).rejects.toThrow(/bad_quantity/)
      }
    })
  })

  it('refuses an item with no rate today, and a switched-off item', async () => {
    await asUser(db, w.ownerA, async () => {
      await expect(place([{ product_id: jaggery, qty: 1 }])).rejects.toThrow(/no_rate/)
      await expect(place([{ product_id: retired, qty: 1 }])).rejects.toThrow(/inactive_item/)
    })
  })

  it('saves nothing when one line is bad', async () => {
    const before = await orderCount()
    await asUser(db, w.ownerA, async () => {
      await expect(
        place([
          { product_id: sugar, qty: 1 },
          { product_id: jaggery, qty: 1 },
        ]),
      ).rejects.toThrow(/no_rate/)
    })
    expect(await orderCount()).toBe(before)
  })

  it('ignores a rate sent by the app: only product and quantity are read', async () => {
    const id = await asUser(
      db,
      w.ownerA,
      async () => (await place([{ product_id: sugar, qty: 1, rate: 0.01 }])).rows[0].place_order,
    )
    const rate = (
      await db.query<{ rate: number }>(
        `select rate::float from public.order_items where order_id = $1`,
        [id],
      )
    ).rows[0].rate
    expect(rate).toBe(46.5)
  })

  it('cannot be called when not logged in', async () => {
    await db.exec(`set role anon`)
    try {
      await expect(place([{ product_id: sugar, qty: 1 }])).rejects.toThrow(/permission denied/)
    } finally {
      await db.exec(`reset role`)
    }
  })
})
