import { roundPaise } from '../lib/money'
import { ApiError } from './adminApi'
import { createMockOrder } from './mockOrders'
import { statementFor } from './mockPayments'
import type { MockOrder, MockState } from './mockState'
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
      return { orderId: createMockOrder(state, requireShop(), lines, note) }
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

    async getMyStatement() {
      await wait()
      return statementFor(state, requireShop())
    },
  }
}
