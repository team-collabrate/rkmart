import { todayISO } from '../lib/dates'
import { roundPaise } from '../lib/money'
import { ApiError } from './adminApi'
import type { DeliveryItem } from './deliveryApi'
import { shopBalance } from './mockBilling'
import type { MockState } from './mockState'
import {
  buildStatement,
  paymentProblem,
  type Payment,
  type PaymentInput,
  type ShopBalance,
  type Statement,
} from './payments'

// Demo versions of the database functions record_payment, void_payment and mark_delivered. They
// follow the same rules, so the demo and the real server behave alike.

function invoiceNo(state: MockState, invoiceId: string | null): string | null {
  return invoiceId ? (state.invoices.find((i) => i.id === invoiceId)?.invoiceNo ?? null) : null
}

export function toPayment(state: MockState, p: MockState['payments'][number]): Payment {
  return {
    id: p.id,
    shopId: p.shopId,
    invoiceId: p.invoiceId,
    invoiceNo: invoiceNo(state, p.invoiceId),
    amount: p.amount,
    method: p.method,
    paidOn: p.paidOn,
    note: p.note,
    createdAt: p.createdAt,
  }
}

export function statementFor(state: MockState, shopId: string): Statement {
  const orderShop = new Map(state.orders.map((o) => [o.id, o.shopId]))
  const bills = state.invoices
    .filter((i) => i.status === 'issued' && orderShop.get(i.orderId) === shopId)
    .map((i) => ({
      id: i.id,
      invoiceNo: i.invoiceNo,
      issueDate: i.issueDate,
      grandTotal: i.grandTotal,
      // The demo has no creation time on bills: invoice number order is the order they were made.
      createdAt: i.invoiceNo,
    }))
  const payments = state.payments.filter((p) => p.shopId === shopId).map((p) => toPayment(state, p))
  return buildStatement(shopId, bills, payments)
}

export function balances(state: MockState): ShopBalance[] {
  return state.shops
    .map((shop) => {
      const s = statementFor(state, shop.id)
      const last = state.payments
        .filter((p) => p.shopId === shop.id)
        .map((p) => p.paidOn)
        .sort()
        .pop()
      return {
        shopId: shop.id,
        nameEn: shop.nameEn,
        nameTa: shop.nameTa,
        invoiced: s.invoiced,
        paid: s.paid,
        balance: shopBalance(state, shop.id),
        lastPaymentOn: last ?? null,
      }
    })
    .sort((a, b) => b.balance - a.balance || a.nameEn.localeCompare(b.nameEn))
}

export function recordPayment(state: MockState, input: PaymentInput): string {
  if (!state.shops.some((s) => s.id === input.shopId)) throw new ApiError('not_found')
  const problem = paymentProblem(input, todayISO())
  if (problem) throw new ApiError(problem)
  if (input.invoiceId) {
    const invoice = state.invoices.find((i) => i.id === input.invoiceId)
    const shopOfInvoice = state.orders.find((o) => o.id === invoice?.orderId)?.shopId
    if (!invoice || invoice.status !== 'issued' || shopOfInvoice !== input.shopId) {
      throw new ApiError('invoice_mismatch')
    }
  }
  const id = `pay${state.nextId++}`
  state.payments.push({
    id,
    shopId: input.shopId,
    amount: input.amount,
    invoiceId: input.invoiceId,
    method: input.method,
    paidOn: input.paidOn,
    note: input.note.trim().slice(0, 300),
    createdAt: new Date().toISOString(),
  })
  return id
}

export function voidPayment(state: MockState, paymentId: string, reason: string): void {
  const index = state.payments.findIndex((p) => p.id === paymentId)
  if (index < 0) throw new ApiError('not_found')
  if (reason.trim().length < 3) throw new ApiError('reason_required')
  state.payments.splice(index, 1)
}

/** Bills out for delivery and ones delivered, over the last 7 days. */
export function deliveries(state: MockState): DeliveryItem[] {
  const oldest = new Date(`${todayISO()}T00:00:00Z`)
  oldest.setUTCDate(oldest.getUTCDate() - 7)
  const cutoff = oldest.toISOString().slice(0, 10)
  const items: DeliveryItem[] = []
  for (const order of state.orders) {
    if ((order.status !== 'billed' && order.status !== 'delivered') || order.orderDate < cutoff) {
      continue
    }
    const invoice = state.invoices.find((i) => i.orderId === order.id && i.status === 'issued')
    const shop = state.shops.find((s) => s.id === order.shopId)
    if (!invoice || !shop) continue
    items.push({
      orderId: order.id,
      status: order.status,
      orderDate: order.orderDate,
      shopNameEn: shop.nameEn,
      shopNameTa: shop.nameTa,
      address: shop.address,
      phone: shop.phone,
      invoiceNo: invoice.invoiceNo,
      amount: roundPaise(invoice.grandTotal),
      deliveredAt: order.deliveredAt ?? null,
    })
  }
  return items.sort((a, b) => a.invoiceNo.localeCompare(b.invoiceNo))
}

export function markDelivered(state: MockState, orderId: string): void {
  const order = state.orders.find((o) => o.id === orderId)
  if (!order) throw new ApiError('not_found')
  if (order.status === 'delivered') throw new ApiError('already_delivered')
  if (order.status !== 'billed') throw new ApiError('not_billed')
  order.status = 'delivered'
  order.deliveredAt = new Date().toISOString()
}
