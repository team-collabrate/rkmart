import { describe, expect, it } from 'vitest'
import { createMockAdminApi } from './mockAdminApi'
import { createMockState } from './mockState'
import { totalsOf } from './reports'
import { addDays, todayISO } from '../lib/dates'

describe('sales report (demo)', () => {
  it('adds up the issued bills by day, shop and item', async () => {
    const state = createMockState({ seedDemo: true })
    const api = createMockAdminApi({ state })
    const report = await api.getSalesReport(addDays(todayISO(), -300), todayISO())
    const issued = state.invoices.filter((i) => i.status === 'issued')
    expect(totalsOf(report).bills).toBe(issued.length)
    expect(totalsOf(report).total).toBeCloseTo(
      issued.reduce((s, i) => s + i.grandTotal, 0),
      2,
    )
    expect(report.shops.reduce((s, r) => s + r.total, 0)).toBeCloseTo(totalsOf(report).total, 2)
    expect(report.items.reduce((s, r) => s + r.amount, 0)).toBeGreaterThan(0)
    // biggest first
    const totals = report.shops.map((s) => s.total)
    expect(totals).toEqual([...totals].sort((a, b) => b - a))
  })

  it('leaves cancelled bills and other dates out, and refuses a huge range', async () => {
    const state = createMockState({ seedDemo: true })
    const api = createMockAdminApi({ state })
    state.invoices[0].status = 'cancelled'
    const all = await api.getSalesReport(addDays(todayISO(), -300), todayISO())
    expect(totalsOf(all).bills).toBe(state.invoices.length - 1)
    expect((await api.getSalesReport('2000-01-01', '2000-01-02')).days).toHaveLength(0)
    await expect(api.getSalesReport('2020-01-01', '2026-01-01')).rejects.toMatchObject({
      code: 'bad_range',
    })
  })
})
