import { roundPaise } from '../lib/money'

export type PaymentMethod = 'cash' | 'upi' | 'bank' | 'other'
export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'upi', 'bank', 'other']

export interface Payment {
  id: string
  shopId: string
  /** The bill the money was meant for, when the admin named one. */
  invoiceId: string | null
  invoiceNo: string | null
  amount: number
  method: PaymentMethod
  paidOn: string
  note: string
  createdAt: string
}

/** What the admin types in to record a payment. */
export interface PaymentInput {
  shopId: string
  amount: number
  method: PaymentMethod
  /** YYYY-MM-DD, today or earlier. */
  paidOn: string
  invoiceId: string | null
  note: string
}

/** One row of the balances list: what a shop was billed, has paid, and still owes. */
export interface ShopBalance {
  shopId: string
  nameEn: string
  nameTa: string
  invoiced: number
  paid: number
  /** Above 0: the shop owes this. Below 0: the shop has paid in advance. */
  balance: number
  lastPaymentOn: string | null
}

export interface StatementEntry {
  kind: 'bill' | 'payment'
  id: string
  date: string
  /** Bill number, or the payment method. */
  label: string
  /** Bill total, or amount paid. Always above 0: the kind says which way it goes. */
  amount: number
  /** What the shop owes right after this entry. */
  balanceAfter: number
  note: string
  /** For a payment that was meant for one bill. */
  invoiceNo: string | null
  method?: PaymentMethod
}

export interface Statement {
  shopId: string
  invoiced: number
  paid: number
  balance: number
  /** Newest first. */
  entries: StatementEntry[]
}

export interface StatementBill {
  id: string
  invoiceNo: string
  issueDate: string
  grandTotal: number
  createdAt: string
}

/**
 * A shop's bills and payments in one list, with the balance after each line.
 * Same-day entries keep the order they were made in.
 */
export function buildStatement(
  shopId: string,
  bills: StatementBill[],
  payments: Payment[],
): Statement {
  type Raw = { at: string; date: string; entry: Omit<StatementEntry, 'balanceAfter'> }
  const raw: Raw[] = [
    ...bills.map((b) => ({
      at: b.createdAt,
      date: b.issueDate,
      entry: {
        kind: 'bill' as const,
        id: b.id,
        date: b.issueDate,
        label: b.invoiceNo,
        amount: b.grandTotal,
        note: '',
        invoiceNo: null,
      },
    })),
    ...payments.map((p) => ({
      at: p.createdAt,
      date: p.paidOn,
      entry: {
        kind: 'payment' as const,
        id: p.id,
        date: p.paidOn,
        label: p.method,
        amount: p.amount,
        note: p.note,
        invoiceNo: p.invoiceNo,
        method: p.method,
      },
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at))

  let balance = 0
  const entries = raw.map(({ entry }) => {
    balance = roundPaise(balance + (entry.kind === 'bill' ? entry.amount : -entry.amount))
    return { ...entry, balanceAfter: balance }
  })
  const invoiced = roundPaise(bills.reduce((sum, b) => sum + b.grandTotal, 0))
  const paid = roundPaise(payments.reduce((sum, p) => sum + p.amount, 0))
  return {
    shopId,
    invoiced,
    paid,
    balance: roundPaise(invoiced - paid),
    entries: entries.reverse(),
  }
}

/** Checks a payment the way the database function does. Returns an error code, or null if fine. */
export function paymentProblem(
  input: Pick<PaymentInput, 'amount' | 'paidOn'>,
  today: string,
): 'bad_amount' | 'bad_date' | null {
  const { amount, paidOn } = input
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99_999_999.99) return 'bad_amount'
  if (Math.round(amount * 100) / 100 !== amount) return 'bad_amount'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || paidOn > today) return 'bad_date'
  const oldest = new Date(`${today}T00:00:00Z`)
  oldest.setUTCDate(oldest.getUTCDate() - 366)
  if (paidOn < oldest.toISOString().slice(0, 10)) return 'bad_date'
  return null
}
