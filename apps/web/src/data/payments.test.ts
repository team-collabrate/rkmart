import { describe, expect, it } from 'vitest'
import { buildStatement, paymentProblem, type Payment } from './payments'

const pay = (id: string, paidOn: string, amount: number, createdAt: string): Payment => ({
  id,
  shopId: 's1',
  invoiceId: null,
  invoiceNo: null,
  amount,
  method: 'cash',
  paidOn,
  note: '',
  createdAt,
})
const bill = (id: string, issueDate: string, grandTotal: number, createdAt: string) => ({
  id,
  invoiceNo: `RK/2627/${id}`,
  issueDate,
  grandTotal,
  createdAt,
})

describe('statement', () => {
  it('lists bills and payments with the balance after each, newest first', () => {
    const s = buildStatement(
      's1',
      [bill('0001', '2026-11-10', 1000, 'a'), bill('0002', '2026-11-12', 500, 'b')],
      [pay('p1', '2026-11-11', 400, 'c')],
    )
    expect(s.entries.map((e) => [e.label, e.kind, e.balanceAfter])).toEqual([
      ['RK/2627/0002', 'bill', 1100],
      ['cash', 'payment', 600],
      ['RK/2627/0001', 'bill', 1000],
    ])
    expect(s).toMatchObject({ invoiced: 1500, paid: 400, balance: 1100 })
  })

  it('keeps entries of the same day in the order they were made', () => {
    const s = buildStatement(
      's1',
      [bill('0001', '2026-11-10', 100, '2026-11-10T05:00')],
      [pay('p1', '2026-11-10', 100, '2026-11-10T06:00')],
    )
    // Oldest first would be bill then payment, so newest first is payment then bill.
    expect(s.entries.map((e) => e.kind)).toEqual(['payment', 'bill'])
    expect(s.entries[0].balanceAfter).toBe(0)
  })

  it('shows a balance below zero for an advance payment, and adds paise without drift', () => {
    const advance = buildStatement('s1', [], [pay('p1', '2026-11-10', 250, 'a')])
    expect(advance.balance).toBe(-250)
    const paise = buildStatement(
      's1',
      [bill('0001', '2026-11-10', 0.1, 'a'), bill('0002', '2026-11-10', 0.2, 'b')],
      [],
    )
    expect(paise.balance).toBe(0.3)
  })

  it('is empty for a shop with nothing yet', () => {
    expect(buildStatement('s1', [], [])).toEqual({
      shopId: 's1',
      invoiced: 0,
      paid: 0,
      balance: 0,
      entries: [],
    })
  })
})

describe('payment checks', () => {
  const today = '2026-11-20'
  it('accepts a normal payment, today or earlier', () => {
    expect(paymentProblem({ amount: 1500.5, paidOn: today }, today)).toBeNull()
    expect(paymentProblem({ amount: 0.01, paidOn: '2026-01-05' }, today)).toBeNull()
  })

  it('refuses bad amounts', () => {
    for (const amount of [0, -1, 1.234, Number.NaN, Infinity, 100_000_000]) {
      expect(paymentProblem({ amount, paidOn: today }, today)).toBe('bad_amount')
    }
  })

  it('refuses future, very old and malformed dates', () => {
    for (const paidOn of ['2026-11-21', '2025-11-01', '20/11/2026', '']) {
      expect(paymentProblem({ amount: 10, paidOn }, today)).toBe('bad_date')
    }
  })
})
