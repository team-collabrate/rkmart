import { describe, expect, it } from 'vitest'
import { isValidPhone, normalizePhone, phoneToEmail } from './phone'

describe('phone', () => {
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

  it('maps to the same login email the server uses', () => {
    expect(phoneToEmail('9876543210')).toBe('9876543210@rk.local')
  })
})
