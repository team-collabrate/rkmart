import { todayISO } from '../lib/dates'
import { roundPaise } from '../lib/money'
import { ApiError } from './adminApi'
import { notifyOrdersChanged, type MockOrder, type MockState } from './mockState'
import type { OrderDetail, OrderSummary, ShopApi } from './shopApi'

// Demo version of the shop API. It repeats the checks of the real place_order() database
// function, so the demo behaves like the real thing.

function summarize(order: MockOrder): OrderSummary {
  return {
    id: order.id,
    orderDate: order.orderDate,
    status: order.status,
    note: order.note,
    itemCount: order.items.length,
    total: roundPaise(order.items.reduce((sum, i) => sum + i.qty * i.rate, 0)),
    createdAt: order.createdAt,
  }
}

export function createMockShopApi(
  state: MockState,
  /** The shop of the person signed in. Read on every call, because the user can change. */
  getShopId: () => string | null,
  options: { delayMs?: number } = {},
): ShopApi {
  const wait = () =>
    options.delayMs ? new Promise((r) => setTimeout(r, options.delayMs)) : Promise.resolve()

  function requireShop(): string {
    const id = getShopId()
    if (!id) throw new ApiError('forbidden')
    return id
  }

  return {
    async getCatalog(date) {
      await wait()
      requireShop()
      const rates = state.rates[date] ?? {}
      return state.products
        .filter((p) => p.isActive && rates[p.id] !== undefined)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((p) => ({
          id: p.id,
          nameEn: p.nameEn,
          nameTa: p.nameTa,
          category: p.category,
          unit: p.unit,
          rate: rates[p.id],
          sortOrder: p.sortOrder,
        }))
    },

    async placeOrder(lines, note) {
      await wait()
      const shopId = requireShop()
      const shop = state.shops.find((s) => s.id === shopId)
      if (!shop?.isActive) throw new ApiError('shop_inactive')
      if (lines.length === 0) throw new ApiError('empty_order')

      // Same item twice becomes one line.
      const merged = new Map<string, number>()
      for (const line of lines)
        merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.qty)

      const today = todayISO()
      const rates = state.rates[today] ?? {}
      const items: MockOrder['items'] = []
      for (const [productId, qty] of merged) {
        if (!(qty > 0) || qty > 100_000 || Math.round(qty * 1000) / 1000 !== qty) {
          throw new ApiError('bad_quantity')
        }
        const product = state.products.find((p) => p.id === productId)
        if (!product?.isActive) throw new ApiError('inactive_item')
        if (rates[productId] === undefined) throw new ApiError('no_rate')
        // The rate always comes from the "server", never from the caller.
        items.push({ productId, qty, rate: rates[productId] })
      }

      const order: MockOrder = {
        id: `o${state.nextId++}`,
        shopId,
        orderDate: today,
        status: 'placed',
        note: note.trim().slice(0, 500),
        createdAt: new Date().toISOString(),
        items,
      }
      state.orders.push(order)
      notifyOrdersChanged(state)
      return { orderId: order.id }
    },

    async listMyOrders() {
      await wait()
      const shopId = requireShop()
      return state.orders
        .filter((o) => o.shopId === shopId)
        .map(summarize)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },

    async getOrder(id) {
      await wait()
      const shopId = requireShop()
      const order = state.orders.find((o) => o.id === id && o.shopId === shopId)
      if (!order) throw new ApiError('not_found')
      const detail: OrderDetail = {
        ...summarize(order),
        lines: order.items.map((item) => {
          const product = state.products.find((p) => p.id === item.productId)
          return {
            productId: item.productId,
            nameEn: product?.nameEn ?? '',
            nameTa: product?.nameTa ?? '',
            unit: product?.unit ?? '',
            qty: item.qty,
            rate: item.rate,
          }
        }),
      }
      return detail
    },
  }
}
