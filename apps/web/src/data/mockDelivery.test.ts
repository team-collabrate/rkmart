import { describe, expect, it } from 'vitest'
import { todayISO } from '../lib/dates'
import { createMockAdminApi } from './mockAdminApi'
import { shopBalance } from './mockBilling'
import { createMockDeliveryApi } from './mockDeliveryApi'
import { createMockShopApi } from './mockShopApi'
import { createMockState } from './mockState'

const today = todayISO()

function setup() {
  const state = createMockState({ seedDemo: true })
  return {
    state,
    admin: createMockAdminApi({ state }),
    delivery: createMockDeliveryApi(state),
    shop: createMockShopApi(state, () => 's1'),
  }
}

describe('demo deliveries', () => {
  it('lists bills out for delivery and delivered ones, never plain orders', async () => {
    const { delivery } = setup()
    const list = await delivery.listDeliveries()
    // The demo has one delivered bill (3 days ago) and one still out (yesterday).
    expect(list.map((d) => [d.shopNameEn, d.status])).toEqual([
      ['Sri Murugan Cafe', 'delivered'],
      ['Sri Murugan Cafe', 'billed'],
    ])
    expect(list[1].invoiceNo).toMatch(/0002$/)
    expect(list[1]).not.toHaveProperty('lines')
  })

  it('marks a bill delivered once, and only a billed one', async () => {
    const { delivery, admin, state } = setup()
    await expect(delivery.markDelivered('o2')).resolves.toBeUndefined()
    expect(state.orders.find((o) => o.id === 'o2')).toMatchObject({ status: 'delivered' })
    expect(state.orders.find((o) => o.id === 'o2')!.deliveredAt).toBeTruthy()
    await expect(delivery.markDelivered('o2')).rejects.toMatchObject({ code: 'already_delivered' })
    await expect(delivery.markDelivered('o3')).rejects.toMatchObject({ code: 'not_billed' })
    await expect(delivery.markDelivered('nope')).rejects.toMatchObject({ code: 'not_found' })

    // A new bill shows up on the list, and a delivered bill cannot be cancelled.
    await admin.generateBill('o3')
    expect((await delivery.listDeliveries()).some((d) => d.orderId === 'o3')).toBe(true)
    const invoice = state.invoices.find((i) => i.orderId === 'o2')!
    await expect(admin.cancelBill(invoice.id, 'a mistake')).rejects.toMatchObject({
      code: 'already_delivered',
    })
  })

  it('tells open screens that something changed', async () => {
    const { delivery, admin } = setup()
    let calls = 0
    const stop = admin.onOrdersChanged(() => (calls += 1))
    await delivery.markDelivered('o2')
    stop()
    expect(calls).toBe(1)
  })
})

describe('demo payments and balances', () => {
  it('starts with one shop owing after a part payment', async () => {
    const { admin, state } = setup()
    const balances = await admin.listBalances()
    expect(balances[0]).toMatchObject({ shopId: 's1', paid: 5000 })
    expect(balances[0].balance).toBe(balances[0].invoiced - 5000)
    expect(balances[0].balance).toBe(shopBalance(state, 's1'))
    expect(balances.slice(1).every((b) => b.balance === 0)).toBe(true)
  })

  it('records a payment and lowers the balance', async () => {
    const { admin, state } = setup()
    const before = shopBalance(state, 's1')
    await admin.recordPayment({
      shopId: 's1',
      amount: 1000,
      method: 'cash',
      paidOn: today,
      invoiceId: null,
      note: ' on the way ',
    })
    expect(shopBalance(state, 's1')).toBe(before - 1000)
    const statement = await admin.getShopStatement('s1')
    expect(statement.entries[0]).toMatchObject({
      kind: 'payment',
      amount: 1000,
      note: 'on the way',
    })
    expect((await admin.listBalances())[0].lastPaymentOn).toBe(today)
  })

  it('refuses what the database refuses', async () => {
    const { admin, state } = setup()
    const base = { shopId: 's1', method: 'cash' as const, paidOn: today, invoiceId: null, note: '' }
    await expect(admin.recordPayment({ ...base, amount: 0 })).rejects.toMatchObject({
      code: 'bad_amount',
    })
    await expect(
      admin.recordPayment({ ...base, amount: 5, paidOn: '2999-01-01' }),
    ).rejects.toMatchObject({
      code: 'bad_date',
    })
    await expect(admin.recordPayment({ ...base, shopId: 'nope', amount: 5 })).rejects.toMatchObject(
      {
        code: 'not_found',
      },
    )
    const otherShopsBill = state.invoices[0].id // belongs to s1
    await expect(
      admin.recordPayment({ ...base, shopId: 's2', amount: 5, invoiceId: otherShopsBill }),
    ).rejects.toMatchObject({ code: 'invoice_mismatch' })
  })

  it('removes a payment with a reason, and a bill with a payment cannot be cancelled', async () => {
    const { admin, state } = setup()
    const id = state.invoices.find((i) => i.invoiceNo.endsWith('0002'))!.id
    const { paymentId } = await admin.recordPayment({
      shopId: 's1',
      amount: 100,
      method: 'upi',
      paidOn: today,
      invoiceId: id,
      note: '',
    })
    await expect(admin.cancelBill(id, 'a mistake')).rejects.toMatchObject({
      code: 'has_payments',
    })
    await expect(admin.voidPayment(paymentId, 'x')).rejects.toMatchObject({
      code: 'reason_required',
    })
    await admin.voidPayment(paymentId, 'entered twice')
    await expect(admin.voidPayment(paymentId, 'entered twice')).rejects.toMatchObject({
      code: 'not_found',
    })
    expect(state.payments.some((p) => p.id === paymentId)).toBe(false)
  })

  it('shows the shop its own statement', async () => {
    const { shop } = setup()
    const statement = await shop.getMyStatement()
    expect(statement.shopId).toBe('s1')
    expect(statement.paid).toBe(5000)
    expect(statement.balance).toBe(statement.invoiced - 5000)
  })
})
