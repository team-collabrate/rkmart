import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, freshDb } from './helpers/db'

let db: PGlite
let admin: string
let distributor: string
let owner: string
const invoices: string[] = []

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

const record = (date: string, path: string, ids: string[]) =>
  db.query<{ record_daily_pdf: number }>(
    `select public.record_daily_pdf($1::date, $2, $3::uuid[]) as record_daily_pdf`,
    [date, path, ids],
  )

beforeAll(async () => {
  db = await freshDb()
  const shop = (
    await one<{ id: string }>(
      `insert into public.shops (name_en, state_code) values ('Shop A', '33') returning id`,
    )
  ).id
  admin = await addUser('admin@rk.local', 'admin', '9000000001', null)
  distributor = await addUser('dist@rk.local', 'distributor', '9000000002', null)
  owner = await addUser('a@rk.local', 'shop', '9000000003', shop)
  const product = (
    await one<{ id: string }>(
      `insert into public.products (name_en, unit, hsn_code, gst_rate) values ('Sugar', 'kg', '1701', 5) returning id`,
    )
  ).id
  await db.query(`update public.settings set state_code = '33', invoice_prefix = 'RK'`)

  for (let i = 0; i < 3; i++) {
    const order = (
      await one<{ id: string }>(
        `insert into public.orders (shop_id, order_date) values ($1, public.india_today()) returning id`,
        [shop],
      )
    ).id
    await db.query(
      `insert into public.order_items (order_id, product_id, qty, rate) values ($1, $2, 10, 46)`,
      [order, product],
    )
    const id = await asUser(db, admin, async () =>
      one<{ finalize_bill: string }>(`select public.finalize_bill($1) as finalize_bill`, [order]),
    )
    invoices.push(id.finalize_bill)
  }
})

afterAll(async () => {
  await db.close()
})

describe('record_daily_pdf', () => {
  it('gives each export of a day the next version and remembers its bills', async () => {
    const first = await asUser(db, admin, () =>
      record('2026-11-20', 'a/1.pdf', invoices.slice(0, 2)),
    )
    expect(first.rows[0].record_daily_pdf).toBe(1)
    const second = await asUser(db, admin, () => record('2026-11-20', 'a/2.pdf', [invoices[2]]))
    expect(second.rows[0].record_daily_pdf).toBe(2)
    const other = await asUser(db, admin, () => record('2026-11-21', 'b/1.pdf', [invoices[0]]))
    expect(other.rows[0].record_daily_pdf).toBe(1)

    const rows = await asUser(db, admin, () =>
      q<{ version: number; bill_count: number; invoice_ids: string[] }>(
        `select version, bill_count, invoice_ids from public.daily_bill_pdfs where bill_date = '2026-11-20' order by version`,
      ),
    )
    expect(rows.map((r) => [r.version, r.bill_count])).toEqual([
      [1, 2],
      [2, 1],
    ])
    expect(rows[1].invoice_ids).toEqual([invoices[2]])
  })

  it('writes an audit record', async () => {
    const row = await one<{ n: string }>(
      `select count(*)::text as n from public.audit_log where action = 'pdf.export'`,
    )
    expect(Number(row.n)).toBeGreaterThanOrEqual(3)
  })

  it('refuses a shop owner and a distributor, and shows them nothing', async () => {
    for (const user of [owner, distributor]) {
      await expect(
        asUser(db, user, () => record('2026-11-22', 'x.pdf', [invoices[0]])),
      ).rejects.toThrow(/not_admin/)
      const rows = await asUser(db, user, () => q(`select * from public.daily_bill_pdfs`))
      expect(rows).toEqual([])
    }
  })

  it('refuses an empty list, a blank path, and a bill that does not exist or is cancelled', async () => {
    await expect(asUser(db, admin, () => record('2026-11-22', 'x.pdf', []))).rejects.toThrow(
      /invalid/,
    )
    await expect(
      asUser(db, admin, () => record('2026-11-22', '  ', [invoices[0]])),
    ).rejects.toThrow(/invalid/)
    await expect(
      asUser(db, admin, () =>
        record('2026-11-22', 'x.pdf', ['00000000-0000-0000-0000-000000000000']),
      ),
    ).rejects.toThrow(/not_found/)

    await asUser(db, admin, () =>
      db.query(`select public.cancel_bill($1, 'test reason')`, [invoices[2]]),
    )
    await expect(
      asUser(db, admin, () => record('2026-11-22', 'x.pdf', [invoices[2]])),
    ).rejects.toThrow(/not_found/)
  })

  it('cannot be written to directly by the app', async () => {
    await expect(
      asUser(db, admin, () =>
        db.query(
          `insert into public.daily_bill_pdfs (bill_date, file_path, bill_count) values ('2026-11-23', 'x', 1)`,
        ),
      ),
    ).rejects.toThrow()
  })
})
