import { gstLine, invoiceNumber, invoiceTotals } from '../lib/gst'
import { roundPaise } from '../lib/money'
import { todayISO } from '../lib/dates'
import { ApiError } from './adminApi'
import type { Invoice } from './adminOrders'
import type { MockState } from './mockState'

// Demo version of the database billing functions (finalize_bill, cancel_bill). It follows the
// same rules, so the demo and the real server behave alike.

/** What a shop owes: issued bills minus payments. */
export function shopBalance(state: MockState, shopId: string): number {
  const billed = state.invoices
    .filter(
      (i) =>
        i.status === 'issued' && state.orders.find((o) => o.id === i.orderId)?.shopId === shopId,
    )
    .reduce((sum, i) => sum + i.grandTotal, 0)
  const paid = state.payments
    .filter((p) => p.shopId === shopId)
    .reduce((sum, p) => sum + p.amount, 0)
  return roundPaise(billed - paid)
}

export function issueInvoice(state: MockState, orderId: string, issueDate = todayISO()): Invoice {
  const order = state.orders.find((o) => o.id === orderId)
  if (!order) throw new ApiError('not_found')
  if (order.status !== 'placed') throw new ApiError('not_placed')
  if (order.items.length === 0) throw new ApiError('empty_order')

  const shop = state.shops.find((s) => s.id === order.shopId)!
  const intra = shop.stateCode === state.settings.stateCode
  const previousBalance = shopBalance(state, order.shopId)

  const items = order.items
    .map((item) => ({ item, product: state.products.find((p) => p.id === item.productId)! }))
    .sort(
      (a, b) =>
        a.product.sortOrder - b.product.sortOrder ||
        a.product.nameEn.localeCompare(b.product.nameEn),
    )

  const computed = items.map(({ item, product }) => ({
    item,
    product,
    gst: gstLine({
      qty: item.qty,
      rate: item.rate,
      gstRate: product.gstRate,
      inclusive: state.settings.ratesIncludeGst,
      intra,
    }),
  }))
  const totals = invoiceTotals(computed.map((c) => c.gst))

  const fy = invoiceNumber(state.settings.invoicePrefix, issueDate, 1).split('/')[1]
  const seq = (state.invoiceCounters[fy] ?? 0) + 1
  state.invoiceCounters[fy] = seq

  const invoice: Invoice = {
    id: `inv${state.nextId++}`,
    orderId,
    invoiceNo: invoiceNumber(state.settings.invoicePrefix, issueDate, seq),
    issueDate,
    status: 'issued',
    cancelledReason: '',
    shopName: shop.nameEn,
    shopAddress: shop.address,
    shopGstin: shop.gstin,
    shopStateCode: shop.stateCode,
    taxableTotal: totals.taxable,
    cgstTotal: totals.cgst,
    sgstTotal: totals.sgst,
    igstTotal: totals.igst,
    roundOff: totals.roundOff,
    grandTotal: totals.grand,
    previousBalance,
    totalDue: roundPaise(totals.grand + previousBalance),
    lines: computed.map((c, i) => ({
      lineNo: i + 1,
      nameEn: c.product.nameEn,
      nameTa: c.product.nameTa,
      hsnCode: c.product.hsnCode,
      unit: c.product.unit,
      qty: c.item.qty,
      rate: c.item.rate,
      taxable: c.gst.taxable,
      gstRate: c.product.gstRate,
      cgst: c.gst.cgst,
      sgst: c.gst.sgst,
      igst: c.gst.igst,
      amount: c.gst.amount,
    })),
  }
  state.invoices.push(invoice)
  order.status = 'billed'
  return invoice
}

export function cancelInvoice(state: MockState, invoiceId: string, reason: string): void {
  const invoice = state.invoices.find((i) => i.id === invoiceId)
  if (!invoice) throw new ApiError('not_found')
  if (invoice.status === 'cancelled') throw new ApiError('already_cancelled')
  if (reason.trim().length < 3) throw new ApiError('reason_required')
  const order = state.orders.find((o) => o.id === invoice.orderId)!
  if (order.status === 'delivered') throw new ApiError('already_delivered')
  if (state.payments.some((p) => p.invoiceId === invoiceId)) throw new ApiError('has_payments')

  invoice.status = 'cancelled'
  invoice.cancelledReason = reason.trim().slice(0, 300)
  order.status = 'placed'
}
