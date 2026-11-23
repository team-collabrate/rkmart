import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDb } from './helpers/db'

// A safety net that fails when someone adds a table or function and forgets to lock it down.

let db: PGlite
const q = async <T = Record<string, unknown>>(sql: string) => (await db.query<T>(sql)).rows

beforeAll(async () => {
  db = await freshDb()
})
afterAll(async () => {
  await db.close()
})

describe('security audit of the database', () => {
  it('has row-level security on every table in the public schema', async () => {
    const rows = await q<{ relname: string }>(`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1`)
    expect(rows.map((r) => r.relname)).toEqual([])
  })

  it('gives the signed-out public (anon) no table access at all', async () => {
    const rows = await q<{ table_name: string; privilege_type: string }>(`
      select table_name, privilege_type from information_schema.role_table_grants
      where grantee = 'anon' and table_schema = 'public'`)
    expect(rows).toEqual([])
  })

  it('lets the signed-out public (anon) run no function of ours', async () => {
    const rows = await q<{ proname: string }>(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') order by 1`)
    expect(rows.map((r) => r.proname)).toEqual([])
  })

  it('pins the search path of every function that runs with the owner’s rights', async () => {
    const rows = await q<{ proname: string }>(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
      order by 1`)
    expect(rows.map((r) => r.proname)).toEqual([])
  })

  it('keeps the lockout table and the sign-in helpers to the service role', async () => {
    const rows = await q<{ proname: string }>(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'login\_%'
        and has_function_privilege('authenticated', p.oid, 'execute')`)
    expect(rows).toEqual([])
  })
})
