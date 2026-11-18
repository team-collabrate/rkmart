import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDb } from './helpers/db'

let db: PGlite

beforeAll(async () => {
  db = await freshDb()
  await db.exec(readFileSync(join(import.meta.dirname, '..', 'seed.sql'), 'utf8'))
})

afterAll(async () => {
  await db.close()
})

const n = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0].n)

describe('seed.sql', () => {
  it('loads onto the real schema', async () => {
    expect(await n('select count(*)::int as n from public.shops')).toBe(7)
    expect(await n('select count(*)::int as n from public.products')).toBe(19)
  })

  it('gives every item a rate for today', async () => {
    expect(
      await n('select count(*)::int as n from public.daily_rates where rate_date = current_date'),
    ).toBe(19)
    expect(
      await n(`select count(*)::int as n from public.products p
               where not exists (select 1 from public.daily_rates r where r.product_id = p.id)`),
    ).toBe(0)
  })

  it('gives every item a Tamil name, a unit and an HSN code', async () => {
    expect(
      await n(`select count(*)::int as n from public.products
               where name_ta is null or unit is null or hsn_code is null`),
    ).toBe(0)
  })

  it('keeps the single settings row', async () => {
    expect(await n('select count(*)::int as n from public.settings')).toBe(1)
    expect(
      await n(`select count(*)::int as n from public.settings where invoice_prefix = 'RK'`),
    ).toBe(1)
  })
})
