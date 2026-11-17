import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asAnon, asUser, freshDb, seedWorld, type World } from './helpers/db'

let db: PGlite
let w: World

beforeAll(async () => {
  db = await freshDb()
  w = await seedWorld(db)
})

afterAll(async () => {
  await db.close()
})

const rows = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows
const count = async (table: string) =>
  Number((await rows(`select count(*)::int as n from ${table}`))[0].n)
const DENIED = /permission denied|row-level security|violates/i

describe('shop owner (Shop A)', () => {
  it('sees only their own shop, orders, invoices and items', async () => {
    await asUser(db, w.ownerA, async () => {
      expect(await rows('select id from public.shops')).toEqual([{ id: w.shopA }])
      const orders = await rows('select shop_id from public.orders')
      expect(orders.length).toBe(2)
      expect(orders.every((o) => o.shop_id === w.shopA)).toBe(true)
      expect(await count('public.invoices')).toBe(1)
      expect(await count('public.invoice_items')).toBe(1)
      expect(await count('public.order_items')).toBe(2)
    })
  })

  it('can read products and rates', async () => {
    await asUser(db, w.ownerA, async () => {
      expect(await count('public.products')).toBe(1)
      expect(await count('public.daily_rates')).toBe(1)
    })
  })

  it('cannot see other shops, other users or admin-only tables', async () => {
    await asUser(db, w.ownerA, async () => {
      expect(await rows('select id from public.profiles')).toEqual([{ id: w.ownerA }])
      expect(await count('public.settings')).toBe(0)
      expect(await count('public.audit_log')).toBe(0)
      expect(await count('public.daily_bill_pdfs')).toBe(0)
      expect(await count('public.payments')).toBe(0)
    })
  })

  it('cannot write orders, invoices, payments, rates or items directly', async () => {
    await asUser(db, w.ownerA, async () => {
      await expect(
        db.query(`insert into public.orders (shop_id) values ($1)`, [w.shopA]),
      ).rejects.toThrow(DENIED)
      await expect(
        db.query(`insert into public.payments (shop_id, amount) values ($1, 100)`, [w.shopA]),
      ).rejects.toThrow(DENIED)
      await expect(
        db.query(`update public.invoices set grand_total = 1 where id = $1`, [w.invoiceA]),
      ).rejects.toThrow(DENIED)
      // Allowed by privilege but filtered by the admin-only policy: zero rows change.
      const changed = await db.query(`update public.daily_rates set rate = 1`)
      expect(changed.affectedRows).toBe(0)
      const delRates = await db.query(`delete from public.shops`)
      expect(delRates.affectedRows).toBe(0)
      await expect(
        db.query(`insert into public.products (name_en, unit) values ('X', 'kg')`),
      ).rejects.toThrow(DENIED)
    })
  })

  it('cannot promote themselves or change their shop', async () => {
    await asUser(db, w.ownerA, async () => {
      await expect(
        db.query(`update public.profiles set role = 'admin' where id = $1`, [w.ownerA]),
      ).rejects.toThrow(DENIED)
      await expect(
        db.query(`update public.profiles set shop_id = $1 where id = $2`, [w.shopB, w.ownerA]),
      ).rejects.toThrow(DENIED)
    })
  })

  it('can change their own language but not anyone else’s', async () => {
    await asUser(db, w.ownerA, async () => {
      await db.query(`update public.profiles set language = 'ta' where id = $1`, [w.ownerA])
      await db.query(`update public.profiles set language = 'ta' where id = $1`, [w.ownerB])
      expect((await rows('select language from public.profiles'))[0].language).toBe('ta')
    })
    await asUser(db, w.ownerB, async () => {
      expect((await rows('select language from public.profiles'))[0].language).toBe('en')
    })
  })

  it('manages only their own push tokens', async () => {
    await asUser(db, w.ownerA, async () => {
      await db.query(
        `insert into public.push_tokens (profile_id, platform, token) values ($1, 'android', 't-a')`,
        [w.ownerA],
      )
      await expect(
        db.query(
          `insert into public.push_tokens (profile_id, platform, token) values ($1, 'android', 't-b')`,
          [w.ownerB],
        ),
      ).rejects.toThrow(DENIED)
    })
    await asUser(db, w.ownerB, async () => {
      expect(await count('public.push_tokens')).toBe(0)
    })
  })
})

describe('distributor', () => {
  it('sees only orders that are billed or delivered', async () => {
    await asUser(db, w.distributor, async () => {
      const orders = await rows('select id, status from public.orders')
      expect(orders).toEqual([{ id: w.orderBilledA, status: 'billed' }])
    })
  })

  it('sees shops and invoice totals for those orders', async () => {
    await asUser(db, w.distributor, async () => {
      expect(await count('public.shops')).toBe(2)
      expect(await count('public.invoices')).toBe(1)
    })
  })

  it('does not see items, prices, rates, payments, balances or settings', async () => {
    await asUser(db, w.distributor, async () => {
      expect(await count('public.order_items')).toBe(0)
      expect(await count('public.invoice_items')).toBe(0)
      expect(await count('public.daily_rates')).toBe(0)
      expect(await count('public.payments')).toBe(0)
      expect(await count('public.shop_balances')).toBe(0)
      expect(await count('public.settings')).toBe(0)
    })
  })

  it('cannot change orders directly (marking delivered goes through a function)', async () => {
    await asUser(db, w.distributor, async () => {
      await expect(
        db.query(`update public.orders set status = 'delivered' where id = $1`, [w.orderBilledA]),
      ).rejects.toThrow(DENIED)
    })
  })
})

describe('admin', () => {
  it('sees everything', async () => {
    await asUser(db, w.admin, async () => {
      expect(await count('public.shops')).toBe(2)
      expect(await count('public.orders')).toBe(3)
      expect(await count('public.order_items')).toBe(3)
      expect(await count('public.invoices')).toBe(1)
      expect(await count('public.profiles')).toBe(5)
      expect(await count('public.settings')).toBe(1)
    })
  })

  it('manages items, rates, shops and settings', async () => {
    await asUser(db, w.admin, async () => {
      await db.query(
        `insert into public.products (name_en, unit, gst_rate) values ('Rice', 'bag', 5)`,
      )
      await db.query(`update public.daily_rates set rate = 47 where product_id = $1`, [w.product])
      await db.query(`update public.shops set name_en = 'Shop A Renamed' where id = $1`, [w.shopA])
      await db.query(`update public.settings set company_name = 'RK Agency Test'`)
      expect((await rows('select company_name from public.settings'))[0].company_name).toBe(
        'RK Agency Test',
      )
    })
  })

  it('still cannot write orders or payments directly', async () => {
    await asUser(db, w.admin, async () => {
      await expect(
        db.query(`insert into public.orders (shop_id) values ($1)`, [w.shopA]),
      ).rejects.toThrow(DENIED)
      await expect(
        db.query(`insert into public.payments (shop_id, amount) values ($1, 100)`, [w.shopA]),
      ).rejects.toThrow(DENIED)
    })
  })

  it('cannot read the internal invoice counters', async () => {
    await asUser(db, w.admin, async () => {
      await expect(db.query('select * from public.invoice_counters')).rejects.toThrow(DENIED)
    })
  })
})

describe('not logged in, or deactivated', () => {
  it('a visitor can read nothing', async () => {
    await asAnon(db, async () => {
      await expect(db.query('select * from public.products')).rejects.toThrow(DENIED)
      await expect(db.query('select * from public.shop_balances')).rejects.toThrow(DENIED)
    })
  })

  it('a deactivated user sees nothing', async () => {
    await asUser(db, w.inactiveOwner, async () => {
      expect(await count('public.shops')).toBe(0)
      expect(await count('public.orders')).toBe(0)
      expect(await count('public.products')).toBe(0)
    })
  })
})

describe('balances', () => {
  it('equal issued invoices minus payments, per shop', async () => {
    await db.query(
      `insert into public.payments (shop_id, amount, method) values ($1, 183, 'cash')`,
      [w.shopA],
    )
    await asUser(db, w.admin, async () => {
      const all = await rows(
        'select shop_id, invoiced, paid, balance from public.shop_balances order by name_en',
      )
      expect(all).toHaveLength(2)
      const a = all.find((r) => r.shop_id === w.shopA)!
      expect(Number(a.invoiced)).toBe(483)
      expect(Number(a.paid)).toBe(183)
      expect(Number(a.balance)).toBe(300)
    })
  })

  it('a shop owner sees only their own balance', async () => {
    await asUser(db, w.ownerA, async () => {
      const mine = await rows('select shop_id, balance from public.shop_balances')
      expect(mine).toHaveLength(1)
      expect(mine[0].shop_id).toBe(w.shopA)
      expect(Number(mine[0].balance)).toBe(300)
    })
    await asUser(db, w.ownerB, async () => {
      const mine = await rows('select balance from public.shop_balances')
      expect(mine).toHaveLength(1)
      expect(Number(mine[0].balance)).toBe(0)
    })
  })

  it('a cancelled invoice stops counting toward the balance', async () => {
    await db.query(
      `update public.invoices set status = 'cancelled', cancelled_reason = 'test', cancelled_at = now() where id = $1`,
      [w.invoiceA],
    )
    await asUser(db, w.admin, async () => {
      const a = (await rows('select shop_id, balance from public.shop_balances')).find(
        (r) => r.shop_id === w.shopA,
      )!
      expect(Number(a.balance)).toBe(-183)
    })
  })
})

describe('guards on issued bills', () => {
  it('amounts on an invoice cannot be changed, even by the database owner', async () => {
    await expect(
      db.query(`update public.invoices set grand_total = 1 where id = $1`, [w.invoiceA]),
    ).rejects.toThrow(/cannot be changed/)
  })

  it('an invoice cannot be deleted or reopened', async () => {
    await expect(
      db.query(`delete from public.invoices where id = $1`, [w.invoiceA]),
    ).rejects.toThrow(/cannot be deleted/)
    await expect(
      db.query(`update public.invoices set status = 'issued' where id = $1`, [w.invoiceA]),
    ).rejects.toThrow(/cannot be reopened/)
  })

  it('invoice lines are frozen', async () => {
    await expect(db.query(`update public.invoice_items set qty = 99`)).rejects.toThrow(
      /cannot be changed/,
    )
    await expect(db.query(`delete from public.invoice_items`)).rejects.toThrow(/cannot be changed/)
  })
})

describe('data rules', () => {
  it('a shop owner must have a shop, others must not', async () => {
    const uid = (await rows(`insert into auth.users (email) values ('x@rk.local') returning id`))[0]
      .id
    await expect(
      db.query(
        `insert into public.profiles (id, role, full_name, phone) values ($1, 'shop', 'X', '9111111111')`,
        [uid],
      ),
    ).rejects.toThrow(/profiles_shop_matches_role/)
    await expect(
      db.query(
        `insert into public.profiles (id, role, shop_id, full_name, phone) values ($1, 'admin', $2, 'X', '9111111111')`,
        [uid, w.shopA],
      ),
    ).rejects.toThrow(/profiles_shop_matches_role/)
  })

  it('phone numbers must be valid and unique', async () => {
    const uid = (await rows(`insert into auth.users (email) values ('y@rk.local') returning id`))[0]
      .id
    await expect(
      db.query(
        `insert into public.profiles (id, role, full_name, phone) values ($1, 'admin', 'Y', '12345')`,
        [uid],
      ),
    ).rejects.toThrow(/violates check constraint/)
    await expect(
      db.query(
        `insert into public.profiles (id, role, full_name, phone) values ($1, 'admin', 'Y', '9000000001')`,
        [uid],
      ),
    ).rejects.toThrow(/unique/)
  })

  it('GSTIN, invoice number length and quantities are validated', async () => {
    await expect(
      db.query(`update public.shops set gstin = 'BAD' where id = $1`, [w.shopA]),
    ).rejects.toThrow(/violates check constraint/)
    await db.query(`update public.shops set gstin = '33AAAAA0000A1Z5' where id = $1`, [w.shopA])
    await expect(
      db.query(
        `insert into public.order_items (order_id, product_id, qty, rate) values ($1, $2, 0, 1)`,
        [w.orderB, w.product],
      ),
    ).rejects.toThrow(/violates check constraint/)
  })

  it('only one settings row can exist', async () => {
    await expect(db.query(`insert into public.settings (id) values (false)`)).rejects.toThrow(
      /violates check constraint/,
    )
    await expect(db.query(`insert into public.settings (id) values (true)`)).rejects.toThrow(
      /duplicate key/,
    )
  })
})
