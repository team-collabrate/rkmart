import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from './adminApi'
import { buildStatement, type Payment, type PaymentMethod, type Statement } from './payments'

interface BillRow {
  id: string
  invoice_no: string
  issue_date: string
  grand_total: number | string
  created_at: string
}
interface PaymentRow {
  id: string
  shop_id: string
  invoice_id: string | null
  amount: number | string
  method: PaymentMethod
  paid_on: string
  note: string | null
  created_at: string
  invoices: { invoice_no: string } | null
}

/**
 * A shop's statement. Row level security limits a shop owner to their own rows, so the admin passes
 * a shop id and a shop owner passes nothing.
 */
export async function loadStatement(client: SupabaseClient, shopId?: string): Promise<Statement> {
  let bills = client
    .from('invoices')
    .select('id, invoice_no, issue_date, grand_total, created_at')
    .eq('status', 'issued')
  let payments = client
    .from('payments')
    .select(
      'id, shop_id, invoice_id, amount, method, paid_on, note, created_at, invoices(invoice_no)',
    )
  if (shopId) {
    bills = bills.eq('shop_id', shopId)
    payments = payments.eq('shop_id', shopId)
  }
  const [b, p] = await Promise.all([bills, payments])
  if (b.error || p.error) {
    const message = (b.error ?? p.error)?.message?.toLowerCase() ?? ''
    throw new ApiError(message.includes('fetch') ? 'network' : 'unknown')
  }
  const paymentList: Payment[] = (p.data as unknown as PaymentRow[]).map((row) => ({
    id: row.id,
    shopId: row.shop_id,
    invoiceId: row.invoice_id,
    invoiceNo: row.invoices?.invoice_no ?? null,
    amount: Number(row.amount),
    method: row.method,
    paidOn: row.paid_on,
    note: row.note ?? '',
    createdAt: row.created_at,
  }))
  return buildStatement(
    shopId ?? '',
    (b.data as unknown as BillRow[]).map((row) => ({
      id: row.id,
      invoiceNo: row.invoice_no,
      issueDate: row.issue_date,
      grandTotal: Number(row.grand_total),
      createdAt: row.created_at,
    })),
    paymentList,
  )
}
