import { describe, expect, it } from 'vitest'
import { ApiError } from './adminApi'
import { createMockAdminApi } from './mockAdminApi'

describe('demo admin API', () => {
  it('lists the sample items in order', async () => {
    const api = createMockAdminApi()
    const items = await api.listProducts()
    expect(items).toHaveLength(15)
    expect(items.map((i) => i.sortOrder)).toEqual(
      [...items.map((i) => i.sortOrder)].sort((a, b) => a - b),
    )
  })

  it('adds, edits and switches off an item', async () => {
    const api = createMockAdminApi()
    const created = await api.saveProduct({
      nameEn: 'Jaggery',
      nameTa: 'வெல்லம்',
      category: 'Staples',
      unit: 'kg',
      hsnCode: '1701',
      gstRate: 5,
      sortOrder: 999,
    })
    expect(created.isActive).toBe(true)
    await api.saveProduct({ ...created, nameEn: 'Jaggery block' }, created.id)
    await api.setProductActive(created.id, false)
    const found = (await api.listProducts()).find((p) => p.id === created.id)
    expect(found).toMatchObject({ nameEn: 'Jaggery block', isActive: false })
  })

  it('saves rates per day and finds the latest earlier rate', async () => {
    const api = createMockAdminApi()
    await api.saveRates('2026-11-10', { p1: 1300, p2: 1200 })
    await api.saveRates('2026-11-12', { p1: 1310 })
    expect(await api.getRates('2026-11-12')).toEqual({ p1: 1310 })
    expect(await api.getRates('2026-11-13')).toEqual({})

    const previous = await api.getPreviousRates('2026-11-13')
    expect(previous.p1).toBe(1310) // latest earlier day wins
    expect(previous.p2).toBe(1200) // falls back to an older day
    expect(previous.p3).toBe(58) // and to the sample "yesterday" for the rest
  })

  it('merges rates saved later on the same day', async () => {
    const api = createMockAdminApi()
    await api.saveRates('2026-11-12', { p1: 1 })
    await api.saveRates('2026-11-12', { p2: 2 })
    expect(await api.getRates('2026-11-12')).toEqual({ p1: 1, p2: 2 })
  })

  it('refuses a negative rate', async () => {
    const api = createMockAdminApi()
    await expect(api.saveRates('2026-11-12', { p1: -1 })).rejects.toMatchObject({ code: 'invalid' })
  })

  it('creates a login and refuses a duplicate phone number', async () => {
    const api = createMockAdminApi()
    const input = {
      phone: '9876543210',
      password: 'goodpass1',
      fullName: 'Ravi',
      role: 'shop' as const,
      shopId: 's2',
      language: 'ta' as const,
    }
    await api.createUser(input)
    const users = await api.listUsers()
    expect(users.find((u) => u.phone === '9876543210')).toMatchObject({
      role: 'shop',
      shopName: 'Lakshmi Stores',
      isActive: true,
    })
    await expect(api.createUser(input)).rejects.toBeInstanceOf(ApiError)
    await expect(api.createUser(input)).rejects.toMatchObject({ code: 'duplicate_phone' })
  })

  it('needs a real shop for a shop owner', async () => {
    const api = createMockAdminApi()
    await expect(
      api.createUser({
        phone: '9876543211',
        password: 'goodpass1',
        fullName: 'X',
        role: 'shop',
        shopId: 'nope',
        language: 'en',
      }),
    ).rejects.toMatchObject({ code: 'invalid' })
  })

  it('switches a login off and keeps the settings', async () => {
    const api = createMockAdminApi()
    await api.setUserActive('demo-dist', false)
    expect((await api.listUsers()).find((u) => u.id === 'demo-dist')?.isActive).toBe(false)

    const settings = await api.getSettings()
    await api.saveSettings({ ...settings, invoicePrefix: 'RKA' })
    expect((await api.getSettings()).invoicePrefix).toBe('RKA')
  })
})
