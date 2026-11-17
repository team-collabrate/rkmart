import type { SupabaseClient } from '@supabase/supabase-js'
import { roundPaise } from '../lib/money'
import { ApiError, type ApiErrorCode } from './adminApi'
import type { OrderDetail, OrderStatus, OrderSummary, ShopApi } from './shopApi'

// Real version of the shop API. Reads are limited by row level security (a shop sees only its own
// orders). Orders are created only by the place_order() database function, which checks the rates
// and quantities on the server.
//
// Status: written in Stage 4, NOT yet run against a live Supabase project.

interface OrderRow {
  id: string
  order_date: string
  status: OrderStatus
  note: string | null
  created_at: string
  order_items: { qty: number | string; rate: number | string }[]
}
interface OrderDetailRow extends Omit<OrderRow, 'order_items'> {
  order_items: {
    product_id: string
    qty: number | string
    rate: number | string
    products: { name_en: string; name_ta: string | null; unit: string } | null
  }[]
}

function summarize(row: OrderRow): OrderSummary {
  return {
    id: row.id,
    orderDate: row.order_date,
    status: row.status,
    note: row.note ?? '',
    itemCount: row.order_items.length,
    total: roundPaise(row.order_items.reduce((sum, i) => sum + Number(i.qty) * Number(i.rate), 0)),
    createdAt: row.created_at,
  }
}

/** place_order raises short codes like "no_rate:<id>". */
function orderError(error: { message?: string; code?: string } | null): ApiError {
  const message = error?.message ?? ''
  const known: ApiErrorCode[] = [
    'shop_inactive',
    'empty_order',
    'bad_quantity',
    'inactive_item',
    'no_rate',
  ]
  const hit = known.find((code) => message.startsWith(code) || message.includes(`${code}`))
  if (hit) return new ApiError(hit)
  if (message.includes('not_shop') || error?.code === '42501') return new ApiError('forbidden')
  if (message.toLowerCase().includes('fetch')) return new ApiError('network')
  return new ApiError('unknown', message)
}

function fail(error: { message?: string; code?: string }): never {
  if (error.code === '42501') throw new ApiError('forbidden')
  if (error.message?.toLowerCase().includes('fetch')) throw new ApiError('network')
  throw new ApiError('unknown', error.message)
}

export function createSupabaseShopApi(client: SupabaseClient): ShopApi {
  return {
    async getCatalog(date) {
      const [products, rates] = await Promise.all([
        client
          .from('products')
          .select('id, name_en, name_ta, category, unit, sort_order')
          .eq('is_active', true)
          .order('sort_order')
          .order('name_en'),
        client.from('daily_rates').select('product_id, rate').eq('rate_date', date),
      ])
      if (products.error) fail(products.error)
      if (rates.error) fail(rates.error)

      const rateById = new Map(
        (rates.data as { product_id: string; rate: number | string }[]).map((r) => [
          r.product_id,
          Number(r.rate),
        ]),
      )
      return (
        products.data as {
          id: string
          name_en: string
          name_ta: string | null
          category: string | null
          unit: string
          sort_order: number
        }[]
      )
        .filter((p) => rateById.has(p.id))
        .map((p) => ({
          id: p.id,
          nameEn: p.name_en,
          nameTa: p.name_ta ?? '',
          category: p.category ?? '',
          unit: p.unit,
          rate: rateById.get(p.id)!,
          sortOrder: p.sort_order,
        }))
    },

    async placeOrder(lines, note) {
      const { data, error } = await client.rpc('place_order', {
        p_items: lines.map((l) => ({ product_id: l.productId, qty: l.qty })),
        p_note: note.trim() === '' ? null : note.trim(),
      })
      if (error) throw orderError(error)
      return { orderId: String(data) }
    },

    async listMyOrders() {
      const { data, error } = await client
        .from('orders')
        .select('id, order_date, status, note, created_at, order_items(qty, rate)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) fail(error)
      return (data as unknown as OrderRow[]).map(summarize)
    },

    async getOrder(id) {
      const { data, error } = await client
        .from('orders')
        .select(
          'id, order_date, status, note, created_at, order_items(product_id, qty, rate, products(name_en, name_ta, unit))',
        )
        .eq('id', id)
        .maybeSingle()
      if (error) fail(error)
      if (!data) throw new ApiError('not_found')
      const row = data as unknown as OrderDetailRow
      const detail: OrderDetail = {
        ...summarize(row as unknown as OrderRow),
        lines: row.order_items.map((i) => ({
          productId: i.product_id,
          nameEn: i.products?.name_en ?? '',
          nameTa: i.products?.name_ta ?? '',
          unit: i.products?.unit ?? '',
          qty: Number(i.qty),
          rate: Number(i.rate),
        })),
      }
      return detail
    },
  }
}
