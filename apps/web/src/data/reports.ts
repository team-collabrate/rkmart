import { addDays } from '../lib/dates'
import { roundPaise } from '../lib/money'
import type { Invoice } from './adminOrders'

// Sales reports: the issued bills of a date range, added up by day, by shop and by item.
// Cancelled bills are left out. The database does the same sums (report_sales_by_* functions).

export type RangeKey = 'today' | 'week' | 'month' | 'lastMonth'

export interface SalesDay {
  day: string
  bills: number
  taxable: number
  tax: number
  total: number
}
export interface SalesShop {
  shopName: string
  bills: number
  taxable: number
  tax: number
  total: number
}
export interface SalesItem {
  nameEn: string
  nameTa: string
  unit: string
  qty: number
  taxable: number
  amount: number
}
export interface SalesReport {
  from: string
  to: string
  days: SalesDay[]
  shops: SalesShop[]
  items: SalesItem[]
}

export interface SalesTotals {
  bills: number
  taxable: number
  tax: number
  total: number
}

export function totalsOf(report: SalesReport): SalesTotals {
  const sum = (pick: (d: SalesDay) => number) =>
    roundPaise(report.days.reduce((acc, d) => acc + pick(d), 0))
  return {
    bills: report.days.reduce((acc, d) => acc + d.bills, 0),
    taxable: sum((d) => d.taxable),
    tax: sum((d) => d.tax),
    total: sum((d) => d.total),
  }
}

/** The same sums the database makes, for the demo. */
export function buildSalesReport(invoices: Invoice[], from: string, to: string): SalesReport {
  const issued = invoices.filter(
    (i) => i.status === 'issued' && i.issueDate >= from && i.issueDate <= to,
  )
  const tax = (i: Invoice) => i.cgstTotal + i.sgstTotal + i.igstTotal

  const days = new Map<string, SalesDay>()
  const shops = new Map<string, SalesShop>()
  const items = new Map<string, SalesItem>()
  for (const i of issued) {
    const d = days.get(i.issueDate) ?? { day: i.issueDate, bills: 0, taxable: 0, tax: 0, total: 0 }
    d.bills += 1
    d.taxable += i.taxableTotal
    d.tax += tax(i)
    d.total += i.grandTotal
    days.set(i.issueDate, d)

    const s = shops.get(i.shopName) ?? {
      shopName: i.shopName,
      bills: 0,
      taxable: 0,
      tax: 0,
      total: 0,
    }
    s.bills += 1
    s.taxable += i.taxableTotal
    s.tax += tax(i)
    s.total += i.grandTotal
    shops.set(i.shopName, s)

    for (const l of i.lines) {
      const key = `${l.nameEn}|${l.unit}`
      const it = items.get(key) ?? {
        nameEn: l.nameEn,
        nameTa: l.nameTa,
        unit: l.unit,
        qty: 0,
        taxable: 0,
        amount: 0,
      }
      it.qty += l.qty
      it.taxable += l.taxable
      it.amount += l.amount
      items.set(key, it)
    }
  }
  const money = <T extends object>(row: T, keys: (keyof T)[]): T => {
    const out = { ...row }
    for (const k of keys) (out[k] as number) = roundPaise(out[k] as number)
    return out
  }
  return {
    from,
    to,
    days: [...days.values()]
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((r) => money(r, ['taxable', 'tax', 'total'])),
    shops: [...shops.values()]
      .sort((a, b) => b.total - a.total)
      .map((r) => money(r, ['taxable', 'tax', 'total'])),
    items: [...items.values()]
      .sort((a, b) => b.amount - a.amount)
      .map((r) => money(r, ['qty', 'taxable', 'amount'])),
  }
}

/** The first and last day of the range the person picked (never past today). */
export function rangeDates(key: RangeKey, today: string): { from: string; to: string } {
  const monthStart = today.slice(0, 8) + '01'
  if (key === 'today') return { from: today, to: today }
  if (key === 'week') return { from: addDays(today, -6), to: today }
  if (key === 'month') return { from: monthStart, to: today }
  const lastEnd = addDays(monthStart, -1)
  return { from: lastEnd.slice(0, 8) + '01', to: lastEnd }
}
