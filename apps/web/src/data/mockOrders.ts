import { todayISO } from '../lib/dates'
import { ApiError } from './adminApi'
import { notifyOrdersChanged, type MockOrder, type MockState } from './mockState'
import type { CartLine } from './shopApi'

/**
 * Demo version of the database's order creation, used by the shop's "place order" and by the
 * admin's "order for a shop". The checks are the same: active shop, at least one item, sensible
 * quantities, active items with a rate for today, and the rate always comes from the "server".
 */
export function createMockOrder(
  state: MockState,
  shopId: string,
  lines: CartLine[],
  note: string,
): string {
  const shop = state.shops.find((s) => s.id === shopId)
  if (!shop) throw new ApiError('not_found')
  if (!shop.isActive) throw new ApiError('shop_inactive')
  if (lines.length === 0) throw new ApiError('empty_order')

  // Same item twice becomes one line.
  const merged = new Map<string, number>()
  for (const line of lines) merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.qty)

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
  return order.id
}
