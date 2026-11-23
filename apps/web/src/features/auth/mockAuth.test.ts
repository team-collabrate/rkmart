import { describe, expect, it } from 'vitest'
import { createMockAuth, DEMO_PIN } from './mockAuth'

describe('demo login', () => {
  it('signs in a known user with the demo password', async () => {
    const auth = createMockAuth(0)
    const result = await auth.signIn('9100000001', DEMO_PIN)
    expect(result.ok && result.profile.role).toBe('shop')
    expect((await auth.getSession())?.phone).toBe('9100000001')
  })

  it('rejects a wrong password and an unknown number the same way', async () => {
    const auth = createMockAuth(0)
    expect(await auth.signIn('9100000001', 'nope')).toEqual({
      ok: false,
      error: 'invalid_credentials',
    })
    expect(await auth.signIn('9999999999', DEMO_PIN)).toEqual({
      ok: false,
      error: 'invalid_credentials',
    })
  })

  it('ends the session on sign out and tells listeners', async () => {
    const auth = createMockAuth(0)
    let notified = 0
    auth.onSignedOut(() => (notified += 1))
    await auth.signIn('9000000001', DEMO_PIN)
    await auth.signOut()
    expect(await auth.getSession()).toBe(null)
    expect(notified).toBe(1)
  })

  it('remembers the language on the profile', async () => {
    const auth = createMockAuth(0)
    const result = await auth.signIn('9200000001', DEMO_PIN)
    if (!result.ok) throw new Error('sign in failed')
    await auth.saveLanguage(result.profile.id, 'ta')
    expect((await auth.getSession())?.language).toBe('ta')
  })
})

describe('demo lockout', () => {
  it('locks a number after five wrong PINs, even for the right PIN, and leaves others alone', async () => {
    const auth = createMockAuth(0)
    for (let i = 1; i <= 4; i++) {
      expect(await auth.signIn('9100000001', '0000')).toEqual({
        ok: false,
        error: 'invalid_credentials',
      })
    }
    expect(await auth.signIn('9100000001', '0000')).toEqual({ ok: false, error: 'locked' })
    expect(await auth.signIn('9100000001', DEMO_PIN)).toEqual({ ok: false, error: 'locked' })
    expect((await auth.signIn('9000000001', DEMO_PIN)).ok).toBe(true)
  })

  it('a right PIN clears the wrong tries', async () => {
    const auth = createMockAuth(0)
    for (let i = 1; i <= 4; i++) await auth.signIn('9100000001', '0000')
    expect((await auth.signIn('9100000001', DEMO_PIN)).ok).toBe(true)
    for (let i = 1; i <= 4; i++) {
      expect((await auth.signIn('9100000001', '0000')).ok).toBe(false)
    }
    expect((await auth.signIn('9100000001', DEMO_PIN)).ok).toBe(true)
  })
})
