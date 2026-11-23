import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { asUser, freshDb } from './helpers/db'

let db: PGlite
const PHONE = '9100000001'

const lockSeconds = async (phone = PHONE) =>
  Number(
    (await db.query<{ s: number }>(`select public.login_lock_seconds($1) as s`, [phone])).rows[0].s,
  )
const fail = async (phone = PHONE) =>
  Number((await db.query<{ s: number }>(`select public.login_failed($1) as s`, [phone])).rows[0].s)

beforeAll(async () => {
  db = await freshDb()
})
afterAll(async () => {
  await db.close()
})

describe('PIN lockout', () => {
  it('lets a number try four times, locks it on the fifth wrong try', async () => {
    expect(await lockSeconds()).toBe(0)
    for (let i = 1; i <= 4; i++) expect(await fail()).toBe(0)
    const locked = await fail()
    expect(locked).toBeGreaterThan(14 * 60)
    expect(locked).toBeLessThanOrEqual(15 * 60)
    expect(await lockSeconds()).toBeGreaterThan(14 * 60)
  })

  it('keeps other numbers free', async () => {
    expect(await lockSeconds('9100000002')).toBe(0)
    expect(await fail('9100000002')).toBe(0)
  })

  it('a correct PIN clears the count', async () => {
    await db.query(`select public.login_succeeded($1)`, ['9100000002'])
    for (let i = 1; i <= 4; i++) expect(await fail('9100000002')).toBe(0)
    await db.query(`select public.login_succeeded($1)`, ['9100000002'])
    // four more tries are fine again, so the earlier four were forgotten
    for (let i = 1; i <= 4; i++) expect(await fail('9100000002')).toBe(0)
  })

  it('lets the number try again once the lock has run out', async () => {
    await db.query(
      `update public.login_attempts set locked_until = now() - interval '1 second', window_start = now() - interval '20 minutes' where phone = $1`,
      [PHONE],
    )
    expect(await lockSeconds()).toBe(0)
    expect(await fail()).toBe(0) // a fresh count of 1
    const row = (
      await db.query<{ failures: number }>(
        `select failures from public.login_attempts where phone = $1`,
        [PHONE],
      )
    ).rows[0]
    expect(row.failures).toBe(1)
  })

  it('forgets old tries after 15 minutes', async () => {
    await db.query(`select public.login_succeeded($1)`, [PHONE])
    for (let i = 1; i <= 3; i++) await fail()
    await db.query(
      `update public.login_attempts set window_start = now() - interval '16 minutes' where phone = $1`,
      [PHONE],
    )
    for (let i = 1; i <= 4; i++) expect(await fail()).toBe(0) // the 3 old ones no longer count
  })

  it('cannot be reached by a signed-in user or the public', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      await expect(db.query(`select public.login_lock_seconds($1)`, [PHONE])).rejects.toThrow(
        /permission denied/,
      )
      await expect(db.query(`select * from public.login_attempts`)).rejects.toThrow(
        /permission denied/,
      )
      await db.exec('reset role')
    }
    void asUser
  })

  it('only accepts a real mobile number', async () => {
    await expect(fail('12345')).rejects.toThrow()
  })
})
