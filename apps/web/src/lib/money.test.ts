import { describe, expect, it } from 'vitest'
import { formatINR, formatINRWhole, roundPaise } from './money'

describe('money', () => {
  it('groups digits the Indian way with two decimals', () => {
    expect(formatINR(1234567.5)).toBe('12,34,567.50')
    expect(formatINR(14300)).toBe('14,300.00')
    expect(formatINR(0)).toBe('0.00')
  })

  it('formats whole rupees without decimals', () => {
    expect(formatINRWhole(22800)).toBe('22,800')
  })

  it('rounds to paise without floating point drift', () => {
    expect(roundPaise(0.1 + 0.2)).toBe(0.3)
    expect(roundPaise(1.005)).toBe(1.01)
    expect(roundPaise(322.4999)).toBe(322.5)
  })
})
