import type { TFunction } from 'i18next'
import { formatINR } from '../../lib/money'

/** "Owes ₹x", "Paid ₹x in advance" or "Nothing due". */
export function balanceText(t: TFunction, balance: number): string {
  if (balance > 0) return t('admin.pay.owes', { amount: formatINR(balance) })
  if (balance < 0) return t('admin.pay.credit', { amount: formatINR(-balance) })
  return t('admin.pay.clear')
}

/** Accepts "1500", "1,500" or "1500.50". Returns null for anything else. */
export function parseMoney(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const value = Number(cleaned)
  return value > 0 ? value : null
}
