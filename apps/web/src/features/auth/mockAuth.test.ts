import { describe, expect, it } from 'vitest'
import { createMockAuth, DEMO_PASSWORD } from './mockAuth'

describe('demo login', () => {
  it('signs in a known user with the demo password', async () => {
    const auth = createMockAuth(0)
    const result = await auth.signIn('9100000001', DEMO_PASSWORD)
    expect(result.ok && result.profile.role).toBe('shop')
    expect((await auth.getSession())?.phone).toBe('9100000001')
  })

  it('rejects a wrong password and an unknown number the same way', async () => {
    const auth = createMockAuth(0)
    expect(await auth.signIn('9100000001', 'nope')).toEqual({
      ok: false,
      error: 'invalid_credentials',
    })
    expect(await auth.signIn('9999999999', DEMO_PASSWORD)).toEqual({
      ok: false,
      error: 'invalid_credentials',
    })
  })

  it('ends the session on sign out and tells listeners', async () => {
    const auth = createMockAuth(0)
    let notified = 0
    auth.onSignedOut(() => (notified += 1))
    await auth.signIn('9000000001', DEMO_PASSWORD)
    await auth.signOut()
    expect(await auth.getSession()).toBe(null)
    expect(notified).toBe(1)
  })

  it('remembers the language on the profile', async () => {
    const auth = createMockAuth(0)
    const result = await auth.signIn('9200000001', DEMO_PASSWORD)
    if (!result.ok) throw new Error('sign in failed')
    await auth.saveLanguage(result.profile.id, 'ta')
    expect((await auth.getSession())?.language).toBe('ta')
  })
})
