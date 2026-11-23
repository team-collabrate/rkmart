import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseAuth } from './supabaseAuth'

const PROFILE = {
  id: 'u1',
  role: 'shop',
  shop_id: 's1',
  full_name: 'Murugan',
  phone: '9100000001',
  language: 'en',
  is_active: true,
}

/** A fake client: `invoke` is the sign-in function; the rest answers just enough for sign in. */
function fakeClient(invoke: () => Promise<unknown>, profile: unknown = PROFILE) {
  const setSession = vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null }))
  const signOut = vi.fn(async () => ({}))
  const client = {
    functions: { invoke: vi.fn(invoke) },
    auth: { setSession, signOut },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }),
      }),
    }),
  } as unknown as SupabaseClient
  return { client, setSession, signOut }
}

const failure = (status: number) => ({ data: null, error: { context: { status } } })

describe('real sign-in', () => {
  it('sends the number and PIN to the sign-in function, never to Supabase directly, and opens the session', async () => {
    const { client, setSession } = fakeClient(async () => ({
      data: { session: { access_token: 'a', refresh_token: 'r' } },
      error: null,
    }))
    const result = await createSupabaseAuth(client).signIn('9100000001', '1234')
    expect(result.ok && result.profile.fullName).toBe('Murugan')
    expect(client.functions.invoke).toHaveBeenCalledWith('sign-in', {
      body: { phone: '9100000001', pin: '1234' },
    })
    expect(setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' })
  })

  it.each([
    [401, 'invalid_credentials'],
    [400, 'invalid_credentials'],
    [403, 'inactive'],
    [429, 'locked'],
    [503, 'unknown'],
  ])('maps a %i answer to %s', async (status, error) => {
    const { client } = fakeClient(async () => failure(status))
    expect(await createSupabaseAuth(client).signIn('9100000001', '1234')).toEqual({
      ok: false,
      error,
    })
  })

  it('says network when the function cannot be reached', async () => {
    const { client } = fakeClient(async () => {
      throw new Error('offline')
    })
    expect(await createSupabaseAuth(client).signIn('9100000001', '1234')).toEqual({
      ok: false,
      error: 'network',
    })
    const noStatus = fakeClient(async () => ({ data: null, error: { message: 'Failed to fetch' } }))
    expect(await createSupabaseAuth(noStatus.client).signIn('9100000001', '1234')).toEqual({
      ok: false,
      error: 'network',
    })
  })

  it('signs out again when the profile is switched off', async () => {
    const { client, signOut } = fakeClient(
      async () => ({ data: { session: { access_token: 'a', refresh_token: 'r' } }, error: null }),
      { ...PROFILE, is_active: false },
    )
    expect(await createSupabaseAuth(client).signIn('9100000001', '1234')).toEqual({
      ok: false,
      error: 'inactive',
    })
    expect(signOut).toHaveBeenCalled()
  })
})
