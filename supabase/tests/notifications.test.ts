import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, freshDb } from './helpers/db'

let db: PGlite
let admin: string
let admin2: string
let distributor: string
let ownerA: string
let ownerA2: string // a second login of shop A, reading Tamil
let ownerB: string
let shopA: string
let shopB: string
let product: string

const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await q<T>(sql, params))[0]

async function addUser(
  email: string,
  role: string,
  phone: string,
  shop: string | null,
  language = 'en',
) {
  const id = (
    await one<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email])
  ).id
  await db.query(
    `insert into public.profiles (id, role, shop_id, full_name, phone, language) values ($1, $2, $3, $4, $5, $6)`,
    [id, role, shop, email, phone, language],
  )
  return id
}

const alertsFor = (profile: string, kind?: string) =>
  q<{ kind: string; title: string; body: string; url: string }>(
    `select kind, title, body, url from public.notifications where profile_id = $1 ${kind ? `and kind = '${kind}'` : ''} order by id`,
    [profile],
  )

async function order(shop: string) {
  const id = (
    await one<{ id: string }>(
      `insert into public.orders (shop_id, order_date) values ($1, public.india_today()) returning id`,
      [shop],
    )
  ).id
  await db.query(
    `insert into public.order_items (order_id, product_id, qty, rate) values ($1, $2, 10, 46)`,
    [id, product],
  )
  return id
}
const bill = async (orderId: string) =>
  (
    await asUser(db, admin, () =>
      one<{ finalize_bill: string }>(`select public.finalize_bill($1) as finalize_bill`, [orderId]),
    )
  ).finalize_bill

beforeAll(async () => {
  db = await freshDb()
  shopA = (
    await one<{ id: string }>(
      `insert into public.shops (name_en, state_code) values ('Sri Murugan Cafe', '33') returning id`,
    )
  ).id
  shopB = (
    await one<{ id: string }>(
      `insert into public.shops (name_en, state_code) values ('Annam Hotel', '33') returning id`,
    )
  ).id
  admin = await addUser('admin@rk.local', 'admin', '9000000001', null)
  admin2 = await addUser('admin2@rk.local', 'admin', '9000000009', null)
  distributor = await addUser('dist@rk.local', 'distributor', '9000000002', null)
  ownerA = await addUser('a@rk.local', 'shop', '9000000003', shopA)
  ownerA2 = await addUser('a2@rk.local', 'shop', '9000000004', shopA, 'ta')
  ownerB = await addUser('b@rk.local', 'shop', '9000000005', shopB)
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

describe('new order', () => {
  it('alerts every active admin, naming the shop and linking to the order', async () => {
    const id = await order(shopA)
    for (const a of [admin, admin2]) {
      const alerts = await alertsFor(a, 'order.new')
      expect(alerts).toHaveLength(1)
      expect(alerts[0]).toEqual({
        kind: 'order.new',
        title: 'New order',
        body: 'Sri Murugan Cafe placed an order.',
        url: `/admin/orders/${id}`,
      })
    }
  })

  it('does not alert distributors or shop owners, and skips a switched-off admin', async () => {
    await db.query(`update public.profiles set is_active = false where id = $1`, [admin2])
    const before = (await alertsFor(admin2)).length
    await order(shopB)
    expect((await alertsFor(admin2)).length).toBe(before)
    expect(await alertsFor(distributor)).toEqual([])
    expect(await alertsFor(ownerA, 'order.new')).toEqual([])
    await db.query(`update public.profiles set is_active = true where id = $1`, [admin2])
  })
})

describe('delivered', () => {
  it('tells the shop its logins, each in their own language, what is now due', async () => {
    const id = await order(shopA)
    await bill(id) // 10 x 46 + 5% = 483
    await asUser(db, distributor, () => db.query(`select public.mark_delivered($1)`, [id]))

    const english = (await alertsFor(ownerA, 'delivery.done'))[0]
    expect(english.title).toBe('Order delivered')
    expect(english.body).toMatch(/delivered\. Payment due: ₹\d+\.$/)
    expect(english.url).toBe('/shop/payments')

    const tamil = (await alertsFor(ownerA2, 'delivery.done'))[0]
    expect(tamil.title).toBe('ஆர்டர் டெலிவரி ஆச்சு')
    expect(tamil.body).toContain('கட்ட வேண்டியது')

    // The other shop is not told.
    expect(await alertsFor(ownerB, 'delivery.done')).toEqual([])
  })

  it('says nothing is due when the shop is paid up', async () => {
    const id = await order(shopB)
    await bill(id)
    await asUser(db, admin, () =>
      db.query(`select public.record_payment($1, 1000000, 'cash')`, [shopB]),
    )
    await asUser(db, admin, () => db.query(`select public.mark_delivered($1)`, [id]))
    const alert = (await alertsFor(ownerB, 'delivery.done'))[0]
    expect(alert.body).toMatch(/Nothing is due/)
  })

  it('does not alert when an order merely changes status in another way', async () => {
    const id = await order(shopA)
    const before = (await alertsFor(ownerA)).length
    const invoice = await bill(id)
    await asUser(db, admin, () => db.query(`select public.cancel_bill($1, 'a mistake')`, [invoice]))
    expect((await alertsFor(ownerA)).length).toBe(before)
  })
})

describe('payment received', () => {
  it('tells the shop how much arrived and what is still due', async () => {
    const owes = Number(
      (await one<{ o: string }>(`select public.shop_owes($1)::text as o`, [shopA])).o,
    )
    expect(owes).toBeGreaterThan(100)
    await asUser(db, admin, () => db.query(`select public.record_payment($1, 100, 'upi')`, [shopA]))
    const alert = (await alertsFor(ownerA, 'payment.received')).at(-1)!
    expect(alert.title).toBe('Payment received')
    expect(alert.body).toMatch(/^RK received ₹100\. Still due: ₹\d+\.$/)
    expect((await alertsFor(ownerA2, 'payment.received')).at(-1)!.title).toBe('பணம் கிடைச்சது')
  })
})

describe('payment reminders', () => {
  it('goes to logins of shops that owe money, once a day, and only the right people', async () => {
    const sent = await one<{ n: number }>(`select public.enqueue_payment_reminders() as n`)
    // Shop A owes money (two logins). Shop B is paid up.
    expect(sent.n).toBe(2)
    const a = (await alertsFor(ownerA, 'payment.reminder'))[0]
    expect(a.title).toBe('Payment reminder')
    expect(a.body).toMatch(/^Please pay ₹\d+ to RK\.$/)
    expect((await alertsFor(ownerA2, 'payment.reminder'))[0].title).toBe('பணம் நினைவூட்டல்')
    expect(await alertsFor(ownerB, 'payment.reminder')).toEqual([])
    expect(await alertsFor(admin, 'payment.reminder')).toEqual([])

    // Running it again the same day adds nothing.
    expect((await one<{ n: number }>(`select public.enqueue_payment_reminders() as n`)).n).toBe(0)
  })

  it('sends again the next day', async () => {
    await db.query(
      `update public.notifications set created_at = now() - interval '21 hours' where kind = 'payment.reminder'`,
    )
    expect((await one<{ n: number }>(`select public.enqueue_payment_reminders() as n`)).n).toBe(2)
  })

  it('cannot be started from the app', async () => {
    for (const user of [admin, ownerA, distributor]) {
      await expect(
        asUser(db, user, () => db.query(`select public.enqueue_payment_reminders()`)),
      ).rejects.toThrow()
    }
  })
})

describe('who can read and write alerts', () => {
  it('lets each person read only their own', async () => {
    const own = await asUser(db, ownerA, () =>
      q<{ profile_id: string }>(`select profile_id from public.notifications`),
    )
    expect(own.length).toBeGreaterThan(0)
    expect(own.every((r) => r.profile_id === ownerA)).toBe(true)
    const distributorSees = await asUser(db, distributor, () =>
      q(`select * from public.notifications`),
    )
    expect(distributorSees).toEqual([])
  })

  it('cannot be written, changed or deleted by the app', async () => {
    await expect(
      asUser(db, admin, () =>
        db.query(
          `insert into public.notifications (profile_id, kind, title, body) values ($1, 'x', 'x', 'x')`,
          [ownerA],
        ),
      ),
    ).rejects.toThrow()
    await expect(
      asUser(db, ownerA, () => db.query(`update public.notifications set title = 'x'`)),
    ).rejects.toThrow()
    await expect(
      asUser(db, ownerA, () => db.query(`delete from public.notifications`)),
    ).rejects.toThrow()
    await expect(
      asUser(db, admin, () =>
        db.query(`select public.notify($1, 'x', 'a', 'b', 'c', 'd', '/')`, [ownerA]),
      ),
    ).rejects.toThrow()
  })

  it('moves a shared phone’s token to whoever signs in, and refuses bad input', async () => {
    const register = (user: string, platform: string, token: string) =>
      asUser(db, user, () =>
        db.query(`select public.register_push_token($1, $2)`, [platform, token]),
      )
    const owner = async (token: string) =>
      (
        await q<{ profile_id: string }>(
          `select profile_id from public.push_tokens where token = $1`,
          [token],
        )
      )[0]?.profile_id

    await register(ownerA, 'android', 'shared-phone-token')
    expect(await owner('shared-phone-token')).toBe(ownerA)
    await register(ownerB, 'android', 'shared-phone-token')
    expect(await owner('shared-phone-token')).toBe(ownerB)
    expect(
      (await q(`select 1 from public.push_tokens where token = 'shared-phone-token'`)).length,
    ).toBe(1)

    await expect(register(ownerA, 'ios', 'abcdefghij')).rejects.toThrow(/invalid/)
    await expect(register(ownerA, 'android', 'short')).rejects.toThrow(/invalid/)
    await db.query(`update public.profiles set is_active = false where id = $1`, [ownerA2])
    await expect(register(ownerA2, 'android', 'abcdefghij')).rejects.toThrow(/not_allowed/)
    await db.query(`update public.profiles set is_active = true where id = $1`, [ownerA2])
  })

  it('forgets only the caller’s own token', async () => {
    await asUser(db, ownerA, () =>
      db.query(`select public.forget_push_token('shared-phone-token')`),
    )
    expect(
      (await q(`select 1 from public.push_tokens where token = 'shared-phone-token'`)).length,
    ).toBe(1) // ownerB's
    await asUser(db, ownerB, () =>
      db.query(`select public.forget_push_token('shared-phone-token')`),
    )
    expect(
      (await q(`select 1 from public.push_tokens where token = 'shared-phone-token'`)).length,
    ).toBe(0)
  })

  it('keeps each person’s own push tokens private', async () => {
    await asUser(db, ownerA, () =>
      db.query(
        `insert into public.push_tokens (profile_id, platform, token) values ($1, 'android', 't-a')`,
        [ownerA],
      ),
    )
    const seenByB = await asUser(db, ownerB, () => q(`select * from public.push_tokens`))
    expect(seenByB).toEqual([])
    await expect(
      asUser(db, ownerB, () =>
        db.query(
          `insert into public.push_tokens (profile_id, platform, token) values ($1, 'android', 't-x')`,
          [ownerA],
        ),
      ),
    ).rejects.toThrow()
  })
})
