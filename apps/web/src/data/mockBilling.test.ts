import { describe, expect, it } from 'vitest'
import { invoiceFy } from '../lib/gst'
import { todayISO } from '../lib/dates'
import { createMockAdminApi } from './mockAdminApi'
import { shopBalance } from './mockBilling'
import { createMockShopApi } from './mockShopApi'
import { createMockState } from './mockState'

const today = todayISO()
const fy = invoiceFy(today)

function setup() {
  const state = createMockState({ seedDemo: true })
  const admin = createMockAdminApi({ state })
  const shop = createMockShopApi(state, () => 's1')
  return { state, admin, shop }
}

describe('demo billing', () => {
  it('starts the demo with two old bills and three new orders', async () => {
    const { admin } = setup()
    const orders = await admin.listOrders(today)
    expect(orders.map((o) => [o.shopNameEn, o.status])).toEqual([
      ['Green Leaf', 'placed'],
      ['Annam Hotel', 'placed'],
      ['Lakshmi Stores', 'placed'],
    ])
  })

  it('makes a GST bill with the next number and the right amounts', async () => {
    const { admin } = setup()
    const { invoiceId } = await admin.generateBill('o3') // Lakshmi: 2 x 1350 rice, 15 x 46 sugar
    const detail = await admin.getOrderDetail('o3')
    const inv = detail.invoice!
    expect(inv.id).toBe(invoiceId)
    expect(inv.invoiceNo).toBe(`RK/${fy}/0003`) // the two old demo bills hold 0001 and 0002
    expect(inv).toMatchObject({
      taxableTotal: 3390,
      cgstTotal: 84.75,
      sgstTotal: 84.75,
      igstTotal: 0,
      roundOff: 0.5, // 3559.50 rounds up to 3560
      grandTotal: 3560,
      previousBalance: 0,
      totalDue: 3560,
    })
    expect(inv.lines.map((l) => [l.lineNo, l.nameEn, l.amount])).toEqual([
      [1, 'Ponni rice', 2835],
      [2, 'Sugar', 724.5],
    ])
    expect(detail.status).toBe('billed')
    expect(detail.invoiceNo).toBe(inv.invoiceNo)
  })

  it('numbers bills in a row and refuses a second bill for the same order', async () => {
    const { admin } = setup()
    await admin.generateBill('o3')
    await admin.generateBill('o4')
    expect((await admin.getOrderDetail('o4')).invoiceNo).toBe(`RK/${fy}/0004`)
    await expect(admin.generateBill('o3')).rejects.toMatchObject({ code: 'not_placed' })
    await expect(admin.generateBill('nope')).rejects.toMatchObject({ code: 'not_found' })
  })

  it('carries the shop’s earlier balance onto the next bill', async () => {
    const { admin, shop, state } = setup()
    // Shop 1 already owes its two demo bills.
    const owed = shopBalance(state, 's1')
    expect(owed).toBeGreaterThan(0)

    const { orderId } = await shop.placeOrder([{ productId: 'p7', qty: 10 }], '')
    await admin.generateBill(orderId)
    const inv = (await admin.getOrderDetail(orderId)).invoice!
    expect(inv.previousBalance).toBe(owed)
    expect(inv.totalDue).toBe(Math.round((inv.grandTotal + owed) * 100) / 100)
  })

  it('fixes quantities before billing, keeping the shop’s rate', async () => {
    const { admin } = setup()
    await admin.adjustOrder('o4', [
      { productId: 'p10', qty: 3 },
      { productId: 'p9', qty: 2.5 },
    ]) // p5 removed
    const detail = await admin.getOrderDetail('o4')
    expect(detail.lines.map((l) => [l.productId, l.qty, l.rate])).toEqual([
      ['p10', 3, 780],
      ['p9', 2.5, 380],
    ])
    await admin.generateBill('o4')
    expect((await admin.getOrderDetail('o4')).invoice!.lines.map((l) => l.qty)).toEqual([2.5, 3])
  })

  it('refuses bad adjustments and adjusting a billed order', async () => {
    const { admin } = setup()
    await expect(admin.adjustOrder('o4', [])).rejects.toMatchObject({ code: 'empty_order' })
    await expect(admin.adjustOrder('o4', [{ productId: 'p10', qty: 0 }])).rejects.toMatchObject({
      code: 'bad_quantity',
    })
    await expect(admin.adjustOrder('o4', [{ productId: 'p1', qty: 1 }])).rejects.toMatchObject({
      code: 'not_in_order',
    })
    await admin.generateBill('o4')
    await expect(admin.adjustOrder('o4', [{ productId: 'p10', qty: 1 }])).rejects.toMatchObject({
      code: 'not_placed',
    })
  })

  it('cancels a bill, never reuses its number, and the balance ignores it', async () => {
    const { admin, state } = setup()
    const { invoiceId } = await admin.generateBill('o3')
    const oldNo = (await admin.getOrderDetail('o3')).invoice!.invoiceNo
    const before = shopBalance(state, 's2')
    expect(before).toBe(3560)

    await expect(admin.cancelBill(invoiceId, ' ')).rejects.toMatchObject({
      code: 'reason_required',
    })
    await admin.cancelBill(invoiceId, 'Wrong quantity')
    await expect(admin.cancelBill(invoiceId, 'again')).rejects.toMatchObject({
      code: 'already_cancelled',
    })

    const detail = await admin.getOrderDetail('o3')
    expect(detail.status).toBe('placed')
    expect(detail.invoice).toBe(null)
    expect(shopBalance(state, 's2')).toBe(0)

    await admin.generateBill('o3')
    expect((await admin.getOrderDetail('o3')).invoice!.invoiceNo).not.toBe(oldNo)
  })

  it('will not cancel a bill for a delivered order or one with payments', async () => {
    const { admin, state } = setup()
    const delivered = state.invoices[0] // the old delivered demo bill
    await expect(admin.cancelBill(delivered.id, 'reason')).rejects.toMatchObject({
      code: 'already_delivered',
    })

    const { invoiceId } = await admin.generateBill('o3')
    state.payments.push({
      id: 'pay-test',
      shopId: 's2',
      amount: 100,
      invoiceId,
      method: 'cash',
      paidOn: today,
      note: '',
      createdAt: new Date().toISOString(),
    })
    await expect(admin.cancelBill(invoiceId, 'reason')).rejects.toMatchObject({
      code: 'has_payments',
    })
  })

  it('uses IGST for a shop in another state and takes tax out when rates include GST', async () => {
    const { admin, state } = setup()
    state.shops.find((s) => s.id === 's2')!.stateCode = '27'
    await admin.generateBill('o3')
    expect((await admin.getOrderDetail('o3')).invoice).toMatchObject({
      cgstTotal: 0,
      sgstTotal: 0,
      igstTotal: 169.5,
      grandTotal: 3560,
    })

    state.settings.ratesIncludeGst = true
    await admin.generateBill('o5')
    const inc = (await admin.getOrderDetail('o5')).invoice!
    expect(inc.grandTotal).toBe(4630) // 3 x 1350 + 10 x 58, tax already inside
    expect(inc.taxableTotal).toBeLessThan(inc.grandTotal)
  })

  it('tells listeners when an order arrives or a bill is made', async () => {
    const { admin, shop } = setup()
    let calls = 0
    const stop = admin.onOrdersChanged(() => (calls += 1))
    await shop.placeOrder([{ productId: 'p7', qty: 1 }], '')
    await admin.generateBill('o3')
    expect(calls).toBe(2)
    stop()
    await shop.placeOrder([{ productId: 'p7', qty: 1 }], '')
    expect(calls).toBe(2)
  })

  it('lists orders by day', async () => {
    const { admin } = setup()
    expect(await admin.listOrders('2020-01-01')).toEqual([])
    const old = await admin.listOrders(new Date(Date.now() - 86_400_000).toISOString().slice(0, 10))
    expect(old.length).toBeGreaterThanOrEqual(0)
  })
})
