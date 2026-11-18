import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, freshDb } from './helpers/db'

const cases = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures', 'gst-cases.json'), 'utf8'),
) as {
  name: string
  qty: number
  rate: number
  gst: number
  inclusive: boolean
  intra: boolean
  expect: Record<'taxable' | 'cgst' | 'sgst' | 'igst' | 'amount', number>
}[]

let db: PGlite
let admin: string
let distributor: string
let ownerA: string
let shopA: string // Tamil Nadu (same state as RK)
let shopB: string // another state
const products: Record<string, string> = {}

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

/** A placed order for a shop with the given [product, qty, rate] lines (as the superuser). */
async function placedOrder(shop: string, lines: [string, number, number][]) {
  const id = (
    await one<{ id: string }>(
      `insert into public.orders (shop_id, order_date) values ($1, public.india_today()) returning id`,
      [shop],
    )
  ).id
  for (const [name, qty, rate] of lines) {
    await db.query(
      `insert into public.order_items (order_id, product_id, qty, rate) values ($1, $2, $3, $4)`,
      [id, products[name], qty, rate],
    )
  }
  return id
}

const SAMPLE: [string, number, number][] = [
  ['Ponni rice', 4, 1350],
  ['Toor dal', 10, 140],
  ['Sugar', 20, 46],
  ['Sunflower oil', 6, 780],
  ['Tea powder', 5, 380],
]

const bill = (orderId: string) =>
  db.query<{ finalize_bill: string }>(`select public.finalize_bill($1) as finalize_bill`, [orderId])

beforeAll(async () => {
  db = await freshDb()
  shopA = (
    await one<{ id: string }>(
      `insert into public.shops (name_en, address, state_code, gstin) values ('Shop A', 'Town Hall', '33', '33AAAAA0000A1Z5') returning id`,
    )
  ).id
  shopB = (
    await one<{ id: string }>(
      `insert into public.shops (name_en, state_code) values ('Shop B', '27') returning id`,
    )
  ).id
  admin = await addUser('admin@rk.local', 'admin', '9000000001', null)
  distributor = await addUser('dist@rk.local', 'distributor', '9000000002', null)
  ownerA = await addUser('a@rk.local', 'shop', '9000000003', shopA)

  const add = async (name: string, hsn: string, gst: number, order: number) => {
    products[name] = (
      await one<{ id: string }>(
        `insert into public.products (name_en, name_ta, unit, hsn_code, gst_rate, sort_order) values ($1, $1, 'kg', $2, $3, $4) returning id`,
        [name, hsn, gst, order],
      )
    ).id
  }
  await add('Ponni rice', '1006', 5, 10)
  await add('Toor dal', '0713', 0, 20)
  await add('Sugar', '1701', 5, 30)
  await add('Sunflower oil', '1512', 5, 40)
  await add('Tea powder', '0902', 5, 50)
  await add('Odd item', '9999', 5, 60)
  await db.query(
    `update public.settings set gstin = '33AAAAA0000A1Z5', state_code = '33', invoice_prefix = 'RK'`,
  )
})

afterAll(async () => {
  await db.close()
})

describe('GST maths (shared cases)', () => {
  for (const c of cases) {
    it(c.name, async () => {
      const row = await one<Record<string, string>>(
        `select taxable::float, cgst::float, sgst::float, igst::float, amount::float from public.gst_line($1, $2, $3, $4, $5)`,
        [c.qty, c.rate, c.gst, c.inclusive, c.intra],
      )
      expect(row).toEqual(c.expect)
    })
  }

  it('CGST plus SGST always equals the tax', async () => {
    for (const c of cases.filter((x) => x.intra)) {
      const r = await one<{ ok: boolean }>(
        `select (cgst + sgst = amount - taxable) as ok from public.gst_line($1, $2, $3, $4, true)`,
        [c.qty, c.rate, c.gst, c.inclusive],
      )
      expect(r.ok).toBe(true)
    }
  })
})

describe('financial year', () => {
  it('runs from April to March', async () => {
    const fy = async (d: string) =>
      (await one<{ f: string }>(`select public.invoice_fy($1::date) as f`, [d])).f
    expect(await fy('2026-04-01')).toBe('2627')
    expect(await fy('2027-03-31')).toBe('2627')
    expect(await fy('2026-03-31')).toBe('2526')
    expect(await fy('2026-11-18')).toBe('2627')
    expect(await fy('2099-12-01')).toBe('9900')
  })
})

describe('finalize_bill', () => {
  let first: string

  it('makes a GST invoice with the right totals and the first number', async () => {
    const order = await placedOrder(shopA, SAMPLE)
    first = await asUser(db, admin, async () => (await bill(order)).rows[0].finalize_bill)

    const fy = (await one<{ f: string }>(`select public.invoice_fy(public.india_today()) as f`)).f
    const inv = await one<Record<string, unknown>>(
      `select invoice_no, status, shop_name, shop_gstin, shop_state_code, taxable_total::float, cgst_total::float,
              sgst_total::float, igst_total::float, round_off::float, grand_total::float, previous_balance::float, total_due::float
       from public.invoices where id = $1`,
      [first],
    )
    expect(inv).toEqual({
      invoice_no: `RK/${fy}/0001`,
      status: 'issued',
      shop_name: 'Shop A',
      shop_gstin: '33AAAAA0000A1Z5',
      shop_state_code: '33',
      taxable_total: 14300,
      cgst_total: 322.5,
      sgst_total: 322.5,
      igst_total: 0,
      round_off: 0,
      grand_total: 14945,
      previous_balance: 0,
      total_due: 14945,
    })
    expect(
      (await one<{ status: string }>(`select status from public.orders where id = $1`, [order]))
        .status,
    ).toBe('billed')
  })

  it('copies item details onto numbered lines', async () => {
    const lines = await q<{
      line_no: number
      name_en: string
      hsn_code: string
      gst_rate: number
      amount: number
    }>(
      `select line_no, name_en, hsn_code, gst_rate::float, amount::float from public.invoice_items where invoice_id = $1 order by line_no`,
      [first],
    )
    expect(lines.map((l) => [l.line_no, l.name_en, l.hsn_code, l.gst_rate, l.amount])).toEqual([
      [1, 'Ponni rice', '1006', 5, 5670],
      [2, 'Toor dal', '0713', 0, 1400],
      [3, 'Sugar', '1701', 5, 966],
      [4, 'Sunflower oil', '1512', 5, 4914],
      [5, 'Tea powder', '0902', 5, 1995],
    ])
  })

  it('later item changes do not alter the issued bill', async () => {
    await db.query(
      `update public.products set name_en = 'Ponni rice NEW', gst_rate = 12 where id = $1`,
      [products['Ponni rice']],
    )
    expect(
      (
        await one<{ n: string }>(
          `select name_en as n from public.invoice_items where invoice_id = $1 and line_no = 1`,
          [first],
        )
      ).n,
    ).toBe('Ponni rice')
    await db.query(
      `update public.products set name_en = 'Ponni rice', gst_rate = 5 where id = $1`,
      [products['Ponni rice']],
    )
  })

  it('numbers bills in order without gaps and carries the previous balance', async () => {
    await db.query(
      `insert into public.payments (shop_id, amount, method) values ($1, 5000, 'cash')`,
      [shopA],
    )
    const order = await placedOrder(shopA, [['Sugar', 10, 46]])
    const id = await asUser(db, admin, async () => (await bill(order)).rows[0].finalize_bill)
    const inv = await one<{
      invoice_no: string
      grand_total: number
      previous_balance: number
      total_due: number
    }>(
      `select invoice_no, grand_total::float, previous_balance::float, total_due::float from public.invoices where id = $1`,
      [id],
    )
    expect(inv.invoice_no.endsWith('/0002')).toBe(true)
    expect(inv.grand_total).toBe(483) // 460 + 23 tax
    expect(inv.previous_balance).toBe(9945) // 14945 owed, 5000 paid
    expect(inv.total_due).toBe(10428)
  })

  it('rounds the invoice to whole rupees and shows the round-off', async () => {
    const order = await placedOrder(shopA, [['Odd item', 2.5, 46.5]]) // 122.06 with tax
    const id = await asUser(db, admin, async () => (await bill(order)).rows[0].finalize_bill)
    const inv = await one<{ round_off: number; grand_total: number }>(
      `select round_off::float, grand_total::float from public.invoices where id = $1`,
      [id],
    )
    expect(inv).toEqual({ round_off: -0.06, grand_total: 122 })
  })

  it('uses IGST for a shop in another state', async () => {
    const order = await placedOrder(shopB, [['Ponni rice', 1, 1000]])
    const id = await asUser(db, admin, async () => (await bill(order)).rows[0].finalize_bill)
    const inv = await one<{
      cgst_total: number
      sgst_total: number
      igst_total: number
      grand_total: number
    }>(
      `select cgst_total::float, sgst_total::float, igst_total::float, grand_total::float from public.invoices where id = $1`,
      [id],
    )
    expect(inv).toEqual({ cgst_total: 0, sgst_total: 0, igst_total: 50, grand_total: 1050 })
  })

  it('takes tax out when rates include GST', async () => {
    await db.query(`update public.settings set rates_include_gst = true`)
    const order = await placedOrder(shopA, [['Ponni rice', 1, 105]])
    const id = await asUser(db, admin, async () => (await bill(order)).rows[0].finalize_bill)
    const inv = await one<{ taxable_total: number; cgst_total: number; grand_total: number }>(
      `select taxable_total::float, cgst_total::float, grand_total::float from public.invoices where id = $1`,
      [id],
    )
    expect(inv).toEqual({ taxable_total: 100, cgst_total: 2.5, grand_total: 105 })
    await db.query(`update public.settings set rates_include_gst = false`)
  })

  it('refuses a shop owner, a distributor, a second bill, and an empty order', async () => {
    const order = await placedOrder(shopA, [['Sugar', 1, 46]])
    for (const user of [ownerA, distributor]) {
      await asUser(db, user, async () => {
        await expect(bill(order)).rejects.toThrow(/not_admin/)
      })
    }
    await asUser(db, admin, async () => {
      await bill(order)
      await expect(bill(order)).rejects.toThrow(/not_placed/)
    })
    const empty = (
      await one<{ id: string }>(`insert into public.orders (shop_id) values ($1) returning id`, [
        shopA,
      ])
    ).id
    await asUser(db, admin, async () => {
      await expect(bill(empty)).rejects.toThrow(/empty_order/)
      await expect(bill('00000000-0000-0000-0000-000000000000')).rejects.toThrow(/not_found/)
    })
  })

  it('writes audit records', async () => {
    const n = (
      await one<{ n: number }>(
        `select count(*)::int as n from public.audit_log where action = 'bill.issue'`,
      )
    ).n
    expect(n).toBeGreaterThanOrEqual(5)
  })
})

describe('cancel_bill', () => {
  it('needs a reason, cancels the bill, and lets the order be billed again with a new number', async () => {
    const order = await placedOrder(shopA, [['Sugar', 2, 46]])
    const id = await asUser(db, admin, async () => (await bill(order)).rows[0].finalize_bill)
    const oldNo = (
      await one<{ invoice_no: string }>(`select invoice_no from public.invoices where id = $1`, [
        id,
      ])
    ).invoice_no

    await asUser(db, admin, async () => {
      await expect(db.query(`select public.cancel_bill($1, '  ')`, [id])).rejects.toThrow(
        /reason_required/,
      )
      await db.query(`select public.cancel_bill($1, 'Wrong quantity')`, [id])
      await expect(db.query(`select public.cancel_bill($1, 'again')`, [id])).rejects.toThrow(
        /already_cancelled/,
      )
    })
    expect(
      await one(`select status, cancelled_reason from public.invoices where id = $1`, [id]),
    ).toEqual({ status: 'cancelled', cancelled_reason: 'Wrong quantity' })
    expect(
      (await one<{ status: string }>(`select status from public.orders where id = $1`, [order]))
        .status,
    ).toBe('placed')

    const again = await asUser(db, admin, async () => (await bill(order)).rows[0].finalize_bill)
    const newNo = (
      await one<{ invoice_no: string }>(`select invoice_no from public.invoices where id = $1`, [
        again,
      ])
    ).invoice_no
    expect(newNo).not.toBe(oldNo) // the cancelled number is never reused
  })

  it('a cancelled bill no longer counts toward the balance', async () => {
    const expected = await one<{ invoiced: number }>(
      `select coalesce(sum(grand_total), 0)::float as invoiced from public.invoices where shop_id = $1 and status = 'issued'`,
      [shopA],
    )
    const cancelled = await one<{ n: number }>(
      `select count(*)::int as n from public.invoices where shop_id = $1 and status = 'cancelled'`,
      [shopA],
    )
    expect(cancelled.n).toBeGreaterThan(0)
    await asUser(db, admin, async () => {
      const row = await one<{ invoiced: number }>(
        `select invoiced::float as invoiced from public.shop_balances where shop_id = $1`,
        [shopA],
      )
      expect(row.invoiced).toBe(expected.invoiced)
    })
  })

  it('refuses a shop owner, a delivered order, and a bill with payments', async () => {
    const order = await placedOrder(shopA, [['Sugar', 1, 46]])
    const id = await asUser(db, admin, async () => (await bill(order)).rows[0].finalize_bill)

    await asUser(db, ownerA, async () => {
      await expect(db.query(`select public.cancel_bill($1, 'reason')`, [id])).rejects.toThrow(
        /not_admin/,
      )
    })

    await db.query(
      `insert into public.payments (shop_id, invoice_id, amount) values ($1, $2, 10)`,
      [shopA, id],
    )
    await asUser(db, admin, async () => {
      await expect(db.query(`select public.cancel_bill($1, 'reason')`, [id])).rejects.toThrow(
        /has_payments/,
      )
    })

    const order2 = await placedOrder(shopA, [['Sugar', 1, 46]])
    const id2 = await asUser(db, admin, async () => (await bill(order2)).rows[0].finalize_bill)
    await db.query(`update public.orders set status = 'delivered' where id = $1`, [order2])
    await asUser(db, admin, async () => {
      await expect(db.query(`select public.cancel_bill($1, 'reason')`, [id2])).rejects.toThrow(
        /already_delivered/,
      )
    })
  })

  it('issued bills still cannot be edited directly', async () => {
    const id = (
      await one<{ id: string }>(`select id from public.invoices where status = 'issued' limit 1`)
    ).id
    await expect(
      db.query(`update public.invoices set grand_total = 1 where id = $1`, [id]),
    ).rejects.toThrow(/cannot be changed/)
  })
})

describe('adjust_order', () => {
  const adjust = (order: string, items: unknown) =>
    db.query(`select public.adjust_order($1, $2::jsonb)`, [order, JSON.stringify(items)])

  it('changes quantities and removes lines, keeping the shop’s rate', async () => {
    const order = await placedOrder(shopA, [
      ['Ponni rice', 4, 1350],
      ['Sugar', 10, 46],
      ['Tea powder', 5, 380],
    ])
    await asUser(db, admin, async () => {
      await adjust(order, [
        { product_id: products['Ponni rice'], qty: 3.5 },
        { product_id: products['Sugar'], qty: 8 },
      ])
    })
    const lines = await q<{ product_id: string; qty: number; rate: number }>(
      `select product_id, qty::float, rate::float from public.order_items where order_id = $1 order by qty`,
      [order],
    )
    expect(lines).toEqual([
      { product_id: products['Ponni rice'], qty: 3.5, rate: 1350 },
      { product_id: products['Sugar'], qty: 8, rate: 46 },
    ])
  })

  it('refuses bad input and the wrong people', async () => {
    const order = await placedOrder(shopA, [['Sugar', 10, 46]])
    await asUser(db, admin, async () => {
      await expect(adjust(order, [])).rejects.toThrow(/empty_order/)
      await expect(adjust(order, [{ product_id: products['Sugar'], qty: 0 }])).rejects.toThrow(
        /bad_quantity/,
      )
      await expect(adjust(order, [{ product_id: products['Sugar'], qty: 1.2345 }])).rejects.toThrow(
        /bad_quantity/,
      )
      await expect(adjust(order, [{ product_id: products['Tea powder'], qty: 1 }])).rejects.toThrow(
        /not_in_order/,
      )
    })
    for (const user of [ownerA, distributor]) {
      await asUser(db, user, async () => {
        await expect(adjust(order, [{ product_id: products['Sugar'], qty: 1 }])).rejects.toThrow(
          /not_admin/,
        )
      })
    }
  })

  it('cannot change an order that is already billed', async () => {
    const order = await placedOrder(shopA, [['Sugar', 10, 46]])
    await asUser(db, admin, async () => {
      await bill(order)
      await expect(adjust(order, [{ product_id: products['Sugar'], qty: 1 }])).rejects.toThrow(
        /not_placed/,
      )
    })
  })

  it('the bill uses the adjusted quantities', async () => {
    const order = await placedOrder(shopA, [['Sugar', 10, 46]])
    await asUser(db, admin, async () => {
      await adjust(order, [{ product_id: products['Sugar'], qty: 5 }])
      const id = (await bill(order)).rows[0].finalize_bill
      const inv = await one<{ taxable_total: number }>(
        `select taxable_total::float from public.invoices where id = $1`,
        [id],
      )
      expect(inv.taxable_total).toBe(230)
    })
  })
})

describe('access', () => {
  it('a visitor who is not logged in cannot make bills', async () => {
    await db.exec(`set role anon`)
    try {
      await expect(bill('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        /permission denied/,
      )
    } finally {
      await db.exec(`reset role`)
    }
  })
})
