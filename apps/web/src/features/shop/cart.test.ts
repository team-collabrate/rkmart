import { describe, expect, it } from 'vitest'
import { cartCount, cartTotal, formatQty, parseQty, splitAvailable, stepQty } from './cart'

describe('parseQty', () => {
  it('reads whole and decimal quantities', () => {
    expect(parseQty('2')).toEqual({ ok: true, value: 2 })
    expect(parseQty('2.5')).toEqual({ ok: true, value: 2.5 })
    expect(parseQty('1,5')).toEqual({ ok: true, value: 1.5 })
    expect(parseQty('0.125')).toEqual({ ok: true, value: 0.125 })
  })

  it('treats empty as none yet', () => {
    expect(parseQty('')).toEqual({ ok: true, value: null })
    expect(parseQty('  ')).toEqual({ ok: true, value: null })
  })

  it('rejects zero, negatives, text, too many decimals and huge numbers', () => {
    for (const bad of ['0', '-1', 'abc', '1.2345', '1..2', '100001', '2 kg']) {
      expect(parseQty(bad)).toEqual({ ok: false })
    }
  })
})

describe('cart maths', () => {
  const rates = { a: 1350, b: 46.5, c: 140 }

  it('adds up quantity times rate without floating point drift', () => {
    expect(cartTotal({ a: 4, b: 10 }, rates)).toBe(5865)
    expect(cartTotal({ b: 0.1, c: 0.2 }, rates)).toBe(32.65)
  })

  it('leaves out items that have no rate today', () => {
    expect(cartTotal({ a: 1, z: 5 }, rates)).toBe(1350)
    expect(cartCount({ a: 1, z: 5 }, rates)).toBe(1)
    expect(splitAvailable({ a: 1, z: 5 }, rates)).toEqual({ available: ['a'], unavailable: ['z'] })
  })

  it('steps by one and stops at zero', () => {
    expect(stepQty(2, 1)).toBe(3)
    expect(stepQty(2.5, -1)).toBe(1.5)
    expect(stepQty(0.5, -1)).toBe(0)
    expect(stepQty(0, -1)).toBe(0)
  })

  it('formats quantities without trailing zeros', () => {
    expect(formatQty(2)).toBe('2')
    expect(formatQty(2.5)).toBe('2.5')
    expect(formatQty(0.1 + 0.2)).toBe('0.3')
  })
})
