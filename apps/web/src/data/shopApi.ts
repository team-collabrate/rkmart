import type { Statement } from './payments'

export type OrderStatus = 'placed' | 'billed' | 'delivered' | 'cancelled'

/** An item a shop can order today: active, with a rate set for today. */
export interface CatalogItem {
  id: string
  nameEn: string
  nameTa: string
  category: string
  unit: string
  /** Today's rate in rupees. */
  rate: number
  sortOrder: number
}

export interface OrderLine {
  productId: string
  nameEn: string
  nameTa: string
  unit: string
  qty: number
  /** The rate that applied when the order was placed. */
  rate: number
}

export interface OrderSummary {
  id: string
  orderDate: string
  status: OrderStatus
  note: string
  itemCount: number
  /** Sum of quantity times rate, before any tax. The bill has the final amount. */
  total: number
  createdAt: string
}

export interface OrderDetail extends OrderSummary {
  lines: OrderLine[]
}

export interface CartLine {
  productId: string
  qty: number
}

/** Everything the shop owner's screens need. Implemented by Supabase and by the demo backend. */
export interface ShopApi {
  getCatalog(date: string): Promise<CatalogItem[]>
  placeOrder(lines: CartLine[], note: string): Promise<{ orderId: string }>
  listMyOrders(): Promise<OrderSummary[]>
  getOrder(id: string): Promise<OrderDetail>
  /** This shop's bills and payments, and what it owes now. */
  getMyStatement(): Promise<Statement>
}
