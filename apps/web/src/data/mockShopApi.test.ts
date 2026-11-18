import { describe, expect, it } from 'vitest'
import { todayISO } from '../lib/dates'
import { createMockShopApi } from './mockShopApi'
import { createMockState, type MockState } from './mockState'

const today = todayISO()

function setup(shopId: string | null = 's1', withRates = true) {
  const state: MockState = createMockState()
  if (withRates) state.rates[today] = { p1: 1350, p5: 140, p7: 46.5 }
  let current = shopId
  const api = createMockShopApi(state, () => current)
  return { state, api, as: (id: string | null) => (current = id) }
}

describe('demo shop API', () => {
  it('lists only active items that have a rate today', async () => {
    const { api, state } = setup()
    expect((await api.getCatalog(today)).map((i) => i.id)).toEqual(['p1', 'p5', 'p7'])

    state.products.find((p) => p.id === 'p5')!.isActive = false
    expect((await api.getCatalog(today)).map((i) => i.id)).toEqual(['p1', 'p7'])
    expect(await api.getCatalog('2020-01-01')).toEqual([])
  })

  it('places an order at the server rates and adds up repeated items', async () => {
    const { api, state } = setup()
    const { orderId } = await api.placeOrder(
      [
        { productId: 'p1', qty: 2 },
        { productId: 'p1', qty: 1 },
        { productId: 'p7', qty: 10 },
      ],
      '  early please  ',
    )
    const order = state.orders.find((o) => o.id === orderId)!
    expect(order).toMatchObject({
      shopId: 's1',
      status: 'placed',
      note: 'early please',
      orderDate: today,
    })
    expect(order.items).toEqual([
      { productId: 'p1', qty: 3, rate: 1350 },
      { productId: 'p7', qty: 10, rate: 46.5 },
    ])

    const detail = await api.getOrder(orderId)
    expect(detail.total).toBe(4515)
    expect(detail.lines[0]).toMatchObject({ nameEn: 'Ponni rice', unit: 'bag', qty: 3, rate: 1350 })
  })

  it('refuses an empty order, bad quantities, and items without a rate or switched off', async () => {
    const { api, state } = setup()
    await expect(api.placeOrder([], '')).rejects.toMatchObject({ code: 'empty_order' })
    for (const qty of [0, -1, 100001, 1.2345]) {
      await expect(api.placeOrder([{ productId: 'p1', qty }], '')).rejects.toMatchObject({
        code: 'bad_quantity',
      })
    }
    await expect(api.placeOrder([{ productId: 'p3', qty: 1 }], '')).rejects.toMatchObject({
      code: 'no_rate',
    })
    state.products.find((p) => p.id === 'p1')!.isActive = false
    await expect(api.placeOrder([{ productId: 'p1', qty: 1 }], '')).rejects.toMatchObject({
      code: 'inactive_item',
    })
    expect(state.orders).toHaveLength(0)
  })

  it('saves nothing when one line is bad', async () => {
    const { api, state } = setup()
    await expect(
      api.placeOrder(
        [
          { productId: 'p1', qty: 1 },
          { productId: 'p3', qty: 1 },
        ],
        '',
      ),
    ).rejects.toMatchObject({ code: 'no_rate' })
    expect(state.orders).toHaveLength(0)
  })

  it('refuses a switched-off shop and someone who is not a shop owner', async () => {
    const { api, state, as } = setup()
    state.shops.find((s) => s.id === 's1')!.isActive = false
    await expect(api.placeOrder([{ productId: 'p1', qty: 1 }], '')).rejects.toMatchObject({
      code: 'shop_inactive',
    })
    as(null)
    await expect(api.getCatalog(today)).rejects.toMatchObject({ code: 'forbidden' })
    await expect(api.listMyOrders()).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('shows each shop only its own orders, newest first', async () => {
    const { api, as } = setup()
    const first = await api.placeOrder([{ productId: 'p1', qty: 1 }], '')
    await new Promise((r) => setTimeout(r, 5))
    const second = await api.placeOrder([{ productId: 'p5', qty: 1 }], '')
    expect((await api.listMyOrders()).map((o) => o.id)).toEqual([second.orderId, first.orderId])

    as('s2')
    expect(await api.listMyOrders()).toEqual([])
    await expect(api.getOrder(first.orderId)).rejects.toMatchObject({ code: 'not_found' })
  })

  it('has seeded demo orders only when asked', async () => {
    expect(createMockState().orders).toHaveLength(0)
    const demo = createMockState({ seedDemo: true })
    expect(demo.orders.map((o) => o.status)).toEqual([
      'delivered',
      'billed',
      'placed',
      'placed',
      'placed',
    ])
    expect(Object.keys(demo.rates[today]).length).toBe(15)
  })
})
