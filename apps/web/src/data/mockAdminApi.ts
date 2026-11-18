import { ApiError, type AdminApi } from './adminApi'
import type { AdminOrderSummary, DayPdf } from './adminOrders'
import { cancelInvoice, issueInvoice } from './mockBilling'
import { balances, recordPayment, statementFor, voidPayment } from './mockPayments'
import { createMockState, notifyOrdersChanged, type MockOrder, type MockState } from './mockState'
import { roundPaise } from '../lib/money'

function orderSummary(state: MockState, o: MockOrder): AdminOrderSummary {
  const shop = state.shops.find((s) => s.id === o.shopId)
  const invoice = state.invoices.find((i) => i.orderId === o.id && i.status === 'issued')
  return {
    id: o.id,
    shopId: o.shopId,
    shopNameEn: shop?.nameEn ?? '',
    shopNameTa: shop?.nameTa ?? '',
    orderDate: o.orderDate,
    status: o.status,
    itemCount: o.items.length,
    total: roundPaise(o.items.reduce((sum, i) => sum + i.qty * i.rate, 0)),
    createdAt: o.createdAt,
    invoiceNo: invoice?.invoiceNo ?? null,
  }
}
import type { Product, RateMap, Shop, AppUser } from './types'

// In-memory demo version of the admin API, used when no Supabase project is configured
// (development, tests, and demo builds only). Not part of a real release.
// Pass a shared `state` so the shop demo API sees what the admin changes.

export function createMockAdminApi(
  options: { delayMs?: number; state?: MockState } = {},
): AdminApi {
  const { delayMs = 0 } = options
  const wait = () => (delayMs ? new Promise((r) => setTimeout(r, delayMs)) : Promise.resolve())

  const state = options.state ?? createMockState()
  const newId = (prefix: string) => `${prefix}${state.nextId++}`

  return {
    async listProducts() {
      await wait()
      return structuredClone(state.products).sort((a, b) => a.sortOrder - b.sortOrder)
    },

    async saveProduct(input, id) {
      await wait()
      if (id) {
        const found = state.products.find((x) => x.id === id)
        if (!found) throw new ApiError('not_found')
        Object.assign(found, input)
        return structuredClone(found)
      }
      const created: Product = { ...input, id: newId('p'), isActive: true }
      state.products.push(created)
      return structuredClone(created)
    },

    async setProductActive(id, active) {
      await wait()
      const found = state.products.find((x) => x.id === id)
      if (!found) throw new ApiError('not_found')
      found.isActive = active
    },

    async getRates(date) {
      await wait()
      return { ...(state.rates[date] ?? {}) }
    },

    async getPreviousRates(beforeDate) {
      await wait()
      const result: RateMap = {}
      const days = Object.keys(state.rates)
        .filter((d) => d < beforeDate)
        .sort()
      for (const day of days) Object.assign(result, state.rates[day]) // later days overwrite earlier
      return result
    },

    async saveRates(date, rates) {
      await wait()
      for (const rate of Object.values(rates)) {
        if (!Number.isFinite(rate) || rate < 0) throw new ApiError('invalid')
      }
      state.rates[date] = { ...(state.rates[date] ?? {}), ...rates }
    },

    async listShops() {
      await wait()
      return structuredClone(state.shops)
    },

    async saveShop(input, id) {
      await wait()
      if (id) {
        const found = state.shops.find((x) => x.id === id)
        if (!found) throw new ApiError('not_found')
        Object.assign(found, input)
        return structuredClone(found)
      }
      const created: Shop = { ...input, id: newId('s'), isActive: true }
      state.shops.push(created)
      return structuredClone(created)
    },

    async setShopActive(id, active) {
      await wait()
      const found = state.shops.find((x) => x.id === id)
      if (!found) throw new ApiError('not_found')
      found.isActive = active
    },

    async listUsers() {
      await wait()
      return structuredClone(state.users)
    },

    async createUser(input) {
      await wait()
      if (state.users.some((u) => u.phone === input.phone)) throw new ApiError('duplicate_phone')
      const shop = input.shopId ? state.shops.find((x) => x.id === input.shopId) : null
      if (input.role === 'shop' && !shop) throw new ApiError('invalid')
      const user: AppUser = {
        id: newId('u'),
        role: input.role,
        fullName: input.fullName,
        phone: input.phone,
        language: input.language,
        isActive: true,
        shopId: shop?.id ?? null,
        shopName: shop?.nameEn ?? null,
      }
      state.users.push(user)
      return { userId: user.id }
    },

    async resetPassword(userId) {
      await wait()
      if (!state.users.some((u) => u.id === userId)) throw new ApiError('not_found')
    },

    async setUserActive(userId, active) {
      await wait()
      const found = state.users.find((u) => u.id === userId)
      if (!found) throw new ApiError('not_found')
      found.isActive = active
    },

    async listOrders(date) {
      await wait()
      return state.orders
        .filter((o) => o.orderDate === date)
        .map((o) => orderSummary(state, o))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },

    async getOrderDetail(id) {
      await wait()
      const order = state.orders.find((o) => o.id === id)
      if (!order) throw new ApiError('not_found')
      const shop = state.shops.find((s) => s.id === order.shopId)!
      const invoice = state.invoices.find((i) => i.orderId === id && i.status === 'issued') ?? null
      return {
        ...orderSummary(state, order),
        note: order.note,
        shop: {
          nameEn: shop.nameEn,
          nameTa: shop.nameTa,
          ownerName: shop.ownerName,
          phone: shop.phone,
          address: shop.address,
          gstin: shop.gstin,
          stateCode: shop.stateCode,
        },
        lines: order.items.map((item) => {
          const product = state.products.find((p) => p.id === item.productId)!
          return {
            productId: item.productId,
            nameEn: product.nameEn,
            nameTa: product.nameTa,
            unit: product.unit,
            hsnCode: product.hsnCode,
            gstRate: product.gstRate,
            qty: item.qty,
            rate: item.rate,
          }
        }),
        invoice: invoice ? structuredClone(invoice) : null,
      }
    },

    async adjustOrder(orderId, lines) {
      await wait()
      const order = state.orders.find((o) => o.id === orderId)
      if (!order) throw new ApiError('not_found')
      if (order.status !== 'placed') throw new ApiError('not_placed')
      if (lines.length === 0) throw new ApiError('empty_order')

      const merged = new Map<string, number>()
      for (const line of lines)
        merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.qty)
      for (const [productId, qty] of merged) {
        if (!(qty > 0) || qty > 100_000 || Math.round(qty * 1000) / 1000 !== qty) {
          throw new ApiError('bad_quantity')
        }
        if (!order.items.some((i) => i.productId === productId)) throw new ApiError('not_in_order')
      }
      order.items = order.items
        .filter((i) => merged.has(i.productId))
        .map((i) => ({ ...i, qty: merged.get(i.productId)! }))
      notifyOrdersChanged(state)
    },

    async generateBill(orderId) {
      await wait()
      const invoice = issueInvoice(state, orderId)
      notifyOrdersChanged(state)
      return { invoiceId: invoice.id }
    },

    async cancelBill(invoiceId, reason) {
      await wait()
      cancelInvoice(state, invoiceId, reason)
      notifyOrdersChanged(state)
    },

    onOrdersChanged(callback) {
      state.listeners.add(callback)
      return () => {
        state.listeners.delete(callback)
      }
    },

    async listDayInvoices(date) {
      await wait()
      return state.invoices
        .filter((i) => i.status === 'issued' && i.issueDate === date)
        .sort((a, b) => a.invoiceNo.localeCompare(b.invoiceNo))
        .map((i) => structuredClone(i))
    },

    async listDayPdfs(date) {
      await wait()
      return state.dayPdfs
        .filter((p) => p.meta.billDate === date)
        .map((p) => ({ ...p.meta, invoiceIds: [...p.meta.invoiceIds] }))
        .sort((a, b) => a.version - b.version)
    },

    async saveDayPdf(date, pdf, invoiceIds) {
      await wait()
      if (invoiceIds.length === 0) throw new ApiError('invalid')
      const known = new Set(state.invoices.filter((i) => i.status === 'issued').map((i) => i.id))
      if (invoiceIds.some((id) => !known.has(id))) throw new ApiError('not_found')
      const version =
        Math.max(
          0,
          ...state.dayPdfs.filter((p) => p.meta.billDate === date).map((p) => p.meta.version),
        ) + 1
      const meta: DayPdf = {
        id: newId('pdf'),
        billDate: date,
        version,
        billCount: invoiceIds.length,
        invoiceIds: [...invoiceIds],
        createdAt: new Date().toISOString(),
      }
      state.dayPdfs.push({ meta, blob: pdf })
      return { ...meta }
    },

    async getDayPdf(id) {
      await wait()
      const found = state.dayPdfs.find((p) => p.meta.id === id)
      if (!found) throw new ApiError('not_found')
      return found.blob
    },

    async listBalances() {
      await wait()
      return balances(state)
    },

    async getShopStatement(shopId) {
      await wait()
      if (!state.shops.some((s) => s.id === shopId)) throw new ApiError('not_found')
      return statementFor(state, shopId)
    },

    async recordPayment(input) {
      await wait()
      return { paymentId: recordPayment(state, input) }
    },

    async voidPayment(paymentId, reason) {
      await wait()
      voidPayment(state, paymentId, reason)
    },

    async getSettings() {
      await wait()
      return { ...state.settings }
    },

    async saveSettings(input) {
      await wait()
      state.settings = { ...input }
      return { ...state.settings }
    },
  }
}
