/** One bill on a delivery person's list. They see where it goes and how much it is, never the items. */
export interface DeliveryItem {
  orderId: string
  status: 'billed' | 'delivered'
  orderDate: string
  shopNameEn: string
  shopNameTa: string
  address: string
  phone: string
  invoiceNo: string
  /** The bill total (before any earlier balance). */
  amount: number
  deliveredAt: string | null
}

/** Deliveries, for distributors and for the admin when they deliver themselves. */
export interface DeliveryApi {
  /** Bills out for delivery, and ones delivered, over the last 7 days. */
  listDeliveries(): Promise<DeliveryItem[]>
  /** Marks a bill delivered. The photo is the signed paper copy, and is optional. */
  markDelivered(orderId: string, photo?: Blob): Promise<void>
}
