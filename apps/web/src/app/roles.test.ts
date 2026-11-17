import { describe, expect, it } from 'vitest'
import { HOME_PATH, NAV, roleForPath, startPath } from './roles'

describe('roles', () => {
  it('starts each role on its own area', () => {
    expect(startPath('shop')).toBe('/shop')
    expect(startPath('distributor')).toBe('/delivery')
    expect(startPath('admin')).toBe('/admin/orders')
  })

  it('knows which role owns a path', () => {
    expect(roleForPath('/shop')).toBe('shop')
    expect(roleForPath('/shop/orders')).toBe('shop')
    expect(roleForPath('/admin/rates')).toBe('admin')
    expect(roleForPath('/delivery/history')).toBe('distributor')
    expect(roleForPath('/shopping')).toBe(null)
    expect(roleForPath('/login')).toBe(null)
  })

  it('keeps every nav link inside its own role area', () => {
    for (const role of ['shop', 'admin', 'distributor'] as const) {
      for (const item of NAV[role]) {
        expect(roleForPath(item.to)).toBe(role)
      }
      expect(roleForPath(HOME_PATH[role])).toBe(role)
    }
  })

  it('gives every nav item a stage between 3 and 9', () => {
    for (const items of Object.values(NAV)) {
      for (const item of items) {
        expect(item.stage).toBeGreaterThanOrEqual(3)
        expect(item.stage).toBeLessThanOrEqual(9)
      }
    }
  })
})
