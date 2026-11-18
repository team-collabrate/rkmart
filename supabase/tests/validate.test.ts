import { describe, expect, it } from 'vitest'
import {
  isValidPhone,
  normalizePhone,
  parseCreateUser,
  parseResetPassword,
  parseSetActive,
  phoneToEmail,
} from '../functions/_shared/validate.ts'

const SHOP = '3f2b8a1e-5c4d-4e6f-8a7b-9c0d1e2f3a4b'

describe('phone numbers', () => {
  it('normalises common formats to 10 digits', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('9876543210')
    expect(normalizePhone('098765 43210')).toBe('9876543210')
    expect(normalizePhone('9876543210')).toBe('9876543210')
  })

  it('accepts Indian mobile numbers only', () => {
    expect(isValidPhone('9876543210')).toBe(true)
    expect(isValidPhone('5876543210')).toBe(false)
    expect(isValidPhone('98765')).toBe(false)
  })

  it('maps a phone to a fixed login email', () => {
    expect(phoneToEmail('9876543210')).toBe('9876543210@rk.local')
  })
})

describe('parseCreateUser', () => {
  const base = {
    phone: '98765 43210',
    password: '1234',
    fullName: ' Ravi ',
    role: 'shop',
    shopId: SHOP,
  }

  it('accepts a shop owner and cleans the input', () => {
    const r = parseCreateUser(base)
    expect(r).toEqual({
      ok: true,
      value: {
        phone: '9876543210',
        password: '1234',
        fullName: 'Ravi',
        role: 'shop',
        shopId: SHOP,
        language: 'en',
      },
    })
  })

  it('accepts a distributor with no shop and Tamil language', () => {
    const r = parseCreateUser({ ...base, role: 'distributor', shopId: undefined, language: 'ta' })
    expect(r.ok && r.value.shopId).toBe(null)
    expect(r.ok && r.value.language).toBe('ta')
  })

  it('rejects bad input with a readable reason', () => {
    expect(parseCreateUser(null)).toMatchObject({ ok: false })
    expect(parseCreateUser({ ...base, phone: '123' })).toMatchObject({
      ok: false,
      error: expect.stringContaining('10-digit'),
    })
    expect(parseCreateUser({ ...base, password: '12' })).toMatchObject({
      ok: false,
      error: expect.stringContaining('4 digits'),
    })
    expect(parseCreateUser({ ...base, fullName: '  ' })).toMatchObject({ ok: false })
    expect(parseCreateUser({ ...base, role: 'owner' })).toMatchObject({ ok: false })
    expect(parseCreateUser({ ...base, shopId: 'nope' })).toMatchObject({ ok: false })
    expect(parseCreateUser({ ...base, role: 'admin' })).toMatchObject({
      ok: false,
      error: expect.stringContaining('Only shop owners'),
    })
  })
})

describe('other actions', () => {
  it('validates password reset', () => {
    expect(parseResetPassword({ userId: SHOP, password: '4321' })).toMatchObject({ ok: true })
    expect(parseResetPassword({ userId: 'x', password: '4321' })).toMatchObject({ ok: false })
    expect(parseResetPassword({ userId: SHOP, password: 'abc' })).toMatchObject({ ok: false })
  })

  it('validates activate and deactivate', () => {
    expect(parseSetActive({ userId: SHOP, active: false })).toEqual({
      ok: true,
      value: { userId: SHOP, active: false },
    })
    expect(parseSetActive({ userId: SHOP, active: 'no' })).toMatchObject({ ok: false })
  })
})
