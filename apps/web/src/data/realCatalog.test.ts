import { describe, expect, it } from 'vitest'
import { createMockState } from './mockState'
import { OLD_TO_REAL, REAL_RATES, realProducts } from './realCatalog'

describe('real catalog', () => {
  const products = realProducts()

  it('has the 46 products of the owner’s list, each with a Tamil name, unit and a rate', () => {
    expect(products).toHaveLength(46)
    expect(new Set(products.map((p) => p.id)).size).toBe(46)
    for (const p of products) {
      expect(p.nameTa).not.toBe('')
      expect(p.unit).not.toBe('')
      expect(REAL_RATES[p.id]).toBeGreaterThan(0)
    }
    expect(new Set(products.map((p) => p.category)).size).toBe(7)
  })

  it('keeps the unnamed oil switched off', () => {
    expect(products.filter((p) => !p.isActive).map((p) => p.nameEn)).toEqual([
      'Oil (kind not named)',
    ])
  })

  it('maps every old sample item to a real one', () => {
    const ids = new Set(products.map((p) => p.id))
    for (let n = 1; n <= 15; n++) expect(ids.has(OLD_TO_REAL[`p${n}`])).toBe(true)
  })

  it('fills the demo with real items, orders and bills that all point at real products', () => {
    const state = createMockState({ seedDemo: true, seedHistory: true, realCatalog: true })
    const ids = new Set(state.products.map((p) => p.id))
    expect(state.products).toHaveLength(46)
    expect(state.orders.length).toBeGreaterThan(10)
    for (const o of state.orders) for (const i of o.items) expect(ids.has(i.productId)).toBe(true)
  })
})
