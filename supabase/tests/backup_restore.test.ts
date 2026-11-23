import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDb, seedWorld, type World } from './helpers/db'

// A restore rehearsal in miniature: copy the whole database as a backup file, bring it back as a
// new database, and check that the money, the bill numbers and the access rules all survived. A
// real Supabase backup is tested the same way on a test project (see docs/backup-restore.md); this
// proves the data model itself restores cleanly and nothing depends on state outside the dump.

let original: PGlite
let restored: PGlite
let world: World

const rows = async <T = Record<string, unknown>>(db: PGlite, sql: string) =>
  (await db.query<T>(sql)).rows

async function snapshot(db: PGlite) {
  const tables = await rows<{ relname: string }>(
    db,
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' order by 1`,
  )
  const counts: Record<string, number> = {}
  for (const t of tables) {
    counts[t.relname] = Number(
      (await rows<{ n: number }>(db, `select count(*)::int as n from public.${t.relname}`))[0].n,
    )
  }
  const money = await rows(
    db,
    `select i.invoice_no, i.grand_total::text, i.taxable_total::text, i.status::text
     from public.invoices i order by i.invoice_no`,
  )
  const balances = await rows(
    db,
    `select s.name_en,
            coalesce((select sum(grand_total) from public.invoices
                      where shop_id = s.id and status = 'issued'), 0)::text as invoiced,
            coalesce((select sum(amount) from public.payments where shop_id = s.id), 0)::text as paid
     from public.shops s order by s.name_en`,
  )
  return { counts, money, balances }
}

beforeAll(async () => {
  original = await freshDb()
  world = await seedWorld(original)
  await original.query(
    `insert into public.payments (shop_id, amount, method, paid_on, recorded_by)
     values ($1, 250.00, 'cash', current_date, $2)`,
    [world.shopA, world.admin],
  )
  const backup = await original.dumpDataDir('none')
  restored = await PGlite.create({ loadDataDir: backup })
})

afterAll(async () => {
  await original.close()
  await restored.close()
})

describe('restore rehearsal', () => {
  it('brings back every table with the same number of rows, and the same money', async () => {
    const before = await snapshot(original)
    const after = await snapshot(restored)
    expect(after.counts).toEqual(before.counts)
    expect(after.money).toEqual(before.money)
    expect(after.balances).toEqual(before.balances)
    expect(before.money.length).toBeGreaterThan(0) // the test is not comparing empty with empty
    expect(Object.values(before.counts).some((n) => n > 0)).toBe(true)
  })

  it('keeps the payment against the shop’s balance', async () => {
    const [row] = await rows<{ paid: string }>(
      restored,
      `select coalesce(sum(amount), 0)::text as paid from public.payments where shop_id = '${world.shopA}'`,
    )
    expect(Number(row.paid)).toBe(250)
  })

  it('keeps the access rules: row-level security and the policies are still there', async () => {
    const off = await rows(
      restored,
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    )
    expect(off).toEqual([])
    const policies = async (db: PGlite) =>
      Number(
        (
          await rows<{ n: number }>(
            db,
            `select count(*)::int as n from pg_policies where schemaname = 'public'`,
          )
        )[0].n,
      )
    expect(await policies(restored)).toBe(await policies(original))
    expect(await policies(restored)).toBeGreaterThan(10)
  })

  it('keeps counting bill numbers from where it left off', async () => {
    const last = (db: PGlite) =>
      rows<{ seq: number }>(db, `select max(seq)::int as seq from public.invoices`)
    expect((await last(restored))[0].seq).toBe((await last(original))[0].seq)
    // The counter inside the restored database carries on, never reusing a number.
    const counters = await rows(restored, `select * from public.invoice_counters`)
    expect(counters).toEqual(await rows(original, `select * from public.invoice_counters`))
  })
})
