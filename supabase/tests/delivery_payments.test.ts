import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, freshDb } from './helpers/db'

let db: PGlite
let admin: string
let distributor: string
let ownerA: string
let shopA: string
let shopB: string
let product: string

const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await q<T>(sql, params))[0]

async function addUser(email: string, role: string, phone: string, shop: string | null) {
  const id = (
    await one<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email])
  ).id
  await db.query(
    `insert into public.profiles (id, role, shop_id, full_name, phone) values ($1, $2, $3, $4, $5)`,
    [id, role, shop, email, phone],
  )
  return id
}

/** A placed order (10 x 46 = 460 before GST, 483 with 5% GST) for a shop. */
async function placedOrder(shop: string, orderDate = 'public.india_today()') {
  const id = (
    await one<{ id: string }>(
      `insert into public.orders (shop_id, order_date) values ($1, ${orderDate}) returning id`,
      [shop],
    )
  ).id
  await db.query(
    `insert into public.order_items (order_id, product_id, qty, rate) values ($1, $2, 10, 46)`,
    [id, product],
  )
  return id
}

/** Bills an order as the admin; returns the invoice id. */
const bill = async (order: string) =>
  (
    await asUser(db, admin, () =>
      one<{ finalize_bill: string }>(`select public.finalize_bill($1) as finalize_bill`, [order]),
    )
  ).finalize_bill

const deliver = (user: string, order: string, proof: string | null = null) =>
  asUser(db, user, () => db.query(`select public.mark_delivered($1, $2)`, [order, proof]))

const pay = (
  user: string,
  shop: string,
  amount: number | null,
  extra: { method?: string; date?: string | null; invoice?: string | null; note?: string } = {},
) =>
  asUser(db, user, () =>
    db.query<{ record_payment: string }>(
      `select public.record_payment($1, $2, $3::public.payment_method, $4::date, $5, $6) as record_payment`,
      [
        shop,
        amount,
        extra.method ?? 'cash',
        extra.date ?? null,
        extra.invoice ?? null,
        extra.note ?? null,
      ],
    ),
  )

const balanceOf = async (shop: string) =>
  Number(
    (
      await asUser(db, admin, () =>
        one<{ balance: string }>(
          `select balance::text from public.shop_balances where shop_id = $1`,
          [shop],
        ),
      )
    ).balance,
  )

beforeAll(async () => {
  db = await freshDb()
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
  ownerA = await addUser('a@rk.local', 'shop', '9000000003', shopA)
  product = (
    await one<{ id: string }>(
      `insert into public.products (name_en, unit, hsn_code, gst_rate) values ('Sugar', 'kg', '1701', 5) returning id`,
    )
  ).id
  await db.query(`update public.settings set state_code = '33', invoice_prefix = 'RK'`)
})

afterAll(async () => {
  await db.close()
})

describe('mark_delivered', () => {
  it('lets a distributor deliver a bill, and records who, when and the photo', async () => {
    const order = await placedOrder(shopA)
    await bill(order)
    await deliver(distributor, order, 'proofs/a.jpg')
    const row = await one<Record<string, unknown>>(
      `select status, delivered_by, delivered_at is not null as has_time, delivery_proof_path from public.orders where id = $1`,
      [order],
    )
    expect(row).toMatchObject({
      status: 'delivered',
      delivered_by: distributor,
      has_time: true,
      delivery_proof_path: 'proofs/a.jpg',
    })
    expect(
      (
        await one<{ n: string }>(
          `select count(*)::text n from public.audit_log where action = 'order.deliver'`,
        )
      ).n,
    ).toBe('1')
  })

  it('lets the admin deliver too, with no photo', async () => {
    const order = await placedOrder(shopA)
    await bill(order)
    await deliver(admin, order, '  ')
    const row = await one<{ delivery_proof_path: string | null; delivered_by: string }>(
      `select delivery_proof_path, delivered_by from public.orders where id = $1`,
      [order],
    )
    expect(row).toEqual({ delivery_proof_path: null, delivered_by: admin })
  })

  it('refuses a second time, an order with no bill, and a missing order', async () => {
    const billed = await placedOrder(shopA)
    await bill(billed)
    await deliver(distributor, billed)
    await expect(deliver(distributor, billed)).rejects.toThrow(/already_delivered/)

    const unbilled = await placedOrder(shopA)
    await expect(deliver(distributor, unbilled)).rejects.toThrow(/not_billed/)
    await expect(deliver(admin, '00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      /not_found/,
    )
  })

  it('refuses a shop owner', async () => {
    const order = await placedOrder(shopA)
    await bill(order)
    await expect(deliver(ownerA, order)).rejects.toThrow(/not_allowed/)
    expect(
      (await one<{ status: string }>(`select status from public.orders where id = $1`, [order]))
        .status,
    ).toBe('billed')
  })

  it('stops a distributor from delivering a bill older than the 7 days they can see', async () => {
    const order = await placedOrder(shopA, 'public.india_today() - 10')
    await bill(order)
    await expect(deliver(distributor, order)).rejects.toThrow(/not_found/)
    await deliver(admin, order) // the admin still can
  })

  it('locks the bill: a delivered order cannot be cancelled', async () => {
    const order = await placedOrder(shopA)
    const invoice = await bill(order)
    await deliver(distributor, order)
    await expect(
      asUser(db, admin, () => db.query(`select public.cancel_bill($1, 'a mistake')`, [invoice])),
    ).rejects.toThrow(/already_delivered/)
  })
})

describe('record_payment', () => {
  it('records a payment, lowers the balance, and shows it to that shop only', async () => {
    const before = await balanceOf(shopB)
    const order = await placedOrder(shopB)
    await bill(order) // 483.00
    expect(await balanceOf(shopB)).toBe(before + 483)

    const id = (await pay(admin, shopB, 200, { method: 'upi', note: ' part payment ' })).rows[0]
      .record_payment
    expect(await balanceOf(shopB)).toBe(before + 283)

    const row = await one<Record<string, unknown>>(
      `select amount::float, method, note, recorded_by from public.payments where id = $1`,
      [id],
    )
    expect(row).toEqual({ amount: 200, method: 'upi', note: 'part payment', recorded_by: admin })

    const ownA = await asUser(db, ownerA, () => q(`select id from public.payments`))
    expect(ownA.map((r) => (r as { id: string }).id)).not.toContain(id)
  })

  it('puts the balance on the next bill as the previous balance', async () => {
    const owed = await balanceOf(shopA)
    await pay(admin, shopA, 100)
    const next = await placedOrder(shopA)
    const invoice = await bill(next)
    const row = await one<{ previous_balance: string }>(
      `select previous_balance::text from public.invoices where id = $1`,
      [invoice],
    )
    expect(Number(row.previous_balance)).toBe(owed - 100)
  })

  it('can name the bill it pays, and that bill then cannot be cancelled', async () => {
    const order = await placedOrder(shopB)
    const invoice = await bill(order)
    await pay(admin, shopB, 50, { invoice })
    await expect(
      asUser(db, admin, () => db.query(`select public.cancel_bill($1, 'a mistake')`, [invoice])),
    ).rejects.toThrow(/has_payments/)
  })

  it('refuses a shop owner and a distributor', async () => {
    for (const user of [ownerA, distributor]) {
      await expect(pay(user, shopA, 10)).rejects.toThrow(/not_admin/)
    }
  })

  it('refuses bad amounts, dates, shops and bills', async () => {
    for (const amount of [0, -5, 10.123, 100000000, null]) {
      await expect(pay(admin, shopA, amount)).rejects.toThrow(/bad_amount/)
    }
    await expect(pay(admin, shopA, 10, { date: '2999-01-01' })).rejects.toThrow(/bad_date/)
    await expect(pay(admin, shopA, 10, { date: '2001-01-01' })).rejects.toThrow(/bad_date/)
    await expect(pay(admin, '00000000-0000-0000-0000-000000000000', 10)).rejects.toThrow(
      /not_found/,
    )

    const otherShops = await placedOrder(shopB)
    const invoiceB = await bill(otherShops)
    await expect(pay(admin, shopA, 10, { invoice: invoiceB })).rejects.toThrow(/invoice_mismatch/)

    const cancelled = await bill(await placedOrder(shopA))
    await asUser(db, admin, () =>
      db.query(`select public.cancel_bill($1, 'a mistake')`, [cancelled]),
    )
    await expect(pay(admin, shopA, 10, { invoice: cancelled })).rejects.toThrow(/invoice_mismatch/)
  })

  it('accepts an advance payment (the balance goes below zero)', async () => {
    const owed = await balanceOf(shopA)
    await pay(admin, shopA, owed + 1000)
    expect(await balanceOf(shopA)).toBe(-1000)
  })
})

describe('void_payment', () => {
  it('removes a payment, restores the balance, and keeps the details in the audit log', async () => {
    const before = await balanceOf(shopB)
    const id = (await pay(admin, shopB, 75)).rows[0].record_payment
    expect(await balanceOf(shopB)).toBe(before - 75)

    await asUser(db, admin, () => db.query(`select public.void_payment($1, ' typed twice ')`, [id]))
    expect(await balanceOf(shopB)).toBe(before)
    expect(await q(`select 1 from public.payments where id = $1`, [id])).toEqual([])

    const audit = await one<{ details: { reason: string; amount: number } }>(
      `select details from public.audit_log where action = 'payment.void' and entity_id = $1`,
      [id],
    )
    expect(audit.details).toMatchObject({ reason: 'typed twice', amount: 75 })
  })

  it('needs a reason, an existing payment, and the admin', async () => {
    const id = (await pay(admin, shopB, 5)).rows[0].record_payment
    await expect(
      asUser(db, admin, () => db.query(`select public.void_payment($1, 'x')`, [id])),
    ).rejects.toThrow(/reason_required/)
    await expect(
      asUser(db, admin, () =>
        db.query(`select public.void_payment('00000000-0000-0000-0000-000000000000', 'a mistake')`),
      ),
    ).rejects.toThrow(/not_found/)
    for (const user of [ownerA, distributor]) {
      await expect(
        asUser(db, user, () => db.query(`select public.void_payment($1, 'a mistake')`, [id])),
      ).rejects.toThrow(/not_admin/)
    }
  })

  it('cannot be bypassed: the app cannot delete or change payments directly', async () => {
    const id = (await pay(admin, shopB, 5)).rows[0].record_payment
    await expect(
      asUser(db, admin, () => db.query(`delete from public.payments where id = $1`, [id])),
    ).rejects.toThrow()
    await expect(
      asUser(db, admin, () =>
        db.query(`update public.payments set amount = 1 where id = $1`, [id]),
      ),
    ).rejects.toThrow()
  })
})
