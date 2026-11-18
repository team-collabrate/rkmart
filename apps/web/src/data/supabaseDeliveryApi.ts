import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from './adminApi'
import type { DeliveryApi, DeliveryItem } from './deliveryApi'
import { billingError } from './supabaseAdminApi'

// Real version of the delivery API. A distributor can read only bills that are out for delivery
// (row level security), and mark one delivered through the mark_delivered() database function.
//
// Status: written in Stage 7, NOT yet run against a live Supabase project.

interface DeliveryRow {
  id: string
  status: 'billed' | 'delivered'
  order_date: string
  delivered_at: string | null
  shops: {
    name_en: string
    name_ta: string | null
    address: string | null
    phone: string | null
  } | null
  invoices: { invoice_no: string; grand_total: number | string; status: string }[]
}

function toItem(row: DeliveryRow): DeliveryItem | null {
  const invoice = row.invoices.find((i) => i.status === 'issued')
  if (!invoice) return null
  return {
    orderId: row.id,
    status: row.status,
    orderDate: row.order_date,
    shopNameEn: row.shops?.name_en ?? '',
    shopNameTa: row.shops?.name_ta ?? '',
    address: row.shops?.address ?? '',
    phone: row.shops?.phone ?? '',
    invoiceNo: invoice.invoice_no,
    amount: Number(invoice.grand_total),
    deliveredAt: row.delivered_at,
  }
}

export function createSupabaseDeliveryApi(client: SupabaseClient): DeliveryApi {
  return {
    async listDeliveries() {
      const oldest = new Date()
      oldest.setDate(oldest.getDate() - 7)
      const { data, error } = await client
        .from('orders')
        .select(
          'id, status, order_date, delivered_at, shops(name_en, name_ta, address, phone), invoices(invoice_no, grand_total, status)',
        )
        .in('status', ['billed', 'delivered'])
        .gte('order_date', oldest.toISOString().slice(0, 10))
      if (error) throw billingError(error)
      return (data as unknown as DeliveryRow[])
        .map(toItem)
        .filter((i): i is DeliveryItem => i !== null)
        .sort((a, b) => a.invoiceNo.localeCompare(b.invoiceNo))
    },

    async markDelivered(orderId, photo) {
      let proof: string | null = null
      if (photo) {
        // A failed photo upload must not stop the delivery from being recorded.
        const path = `${orderId}/${crypto.randomUUID()}.jpg`
        const upload = await client.storage
          .from('delivery-proofs')
          .upload(path, photo, { contentType: photo.type || 'image/jpeg' })
        if (!upload.error) proof = path
      }
      const { error } = await client.rpc('mark_delivered', { p_order: orderId, p_proof: proof })
      if (error) {
        throw error.message?.toLowerCase().includes('fetch')
          ? new ApiError('network')
          : billingError(error)
      }
    },
  }
}
