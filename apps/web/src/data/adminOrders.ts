import type { OrderStatus } from './shopApi'

/** One row in the admin's orders list. */
export interface AdminOrderSummary {
  id: string
  shopId: string
  shopNameEn: string
  shopNameTa: string
  orderDate: string
  status: OrderStatus
  itemCount: number
  /** English names of the first three items, for the small picture strip on a card. */
  itemNames: string[]
  /** Quantity times rate, before tax. The bill has the final amount. */
  total: number
  createdAt: string
  /** The number of the issued bill, once billed. */
  invoiceNo: string | null
}

export interface AdminOrderLine {
  productId: string
  nameEn: string
  nameTa: string
  unit: string
  hsnCode: string
  gstRate: number
  qty: number
  rate: number
}

export interface InvoiceLine {
  lineNo: number
  nameEn: string
  nameTa: string
  hsnCode: string
  unit: string
  qty: number
  rate: number
  taxable: number
  gstRate: number
  cgst: number
  sgst: number
  igst: number
  amount: number
}

export interface Invoice {
  id: string
  orderId: string
  invoiceNo: string
  issueDate: string
  status: 'issued' | 'cancelled'
  cancelledReason: string
  shopName: string
  shopAddress: string
  shopGstin: string
  shopStateCode: string
  taxableTotal: number
  cgstTotal: number
  sgstTotal: number
  igstTotal: number
  roundOff: number
  grandTotal: number
  previousBalance: number
  totalDue: number
  lines: InvoiceLine[]
}

export interface AdminOrderDetail extends AdminOrderSummary {
  note: string
  shop: {
    nameEn: string
    nameTa: string
    ownerName: string
    phone: string
    address: string
    gstin: string
    stateCode: string
  }
  lines: AdminOrderLine[]
  /** The bill that is in force for this order, if any (a cancelled bill is not returned here). */
  invoice: Invoice | null
}

/** One saved export of a day's bills. A later export of the same day gets the next version. */
export interface DayPdf {
  id: string
  billDate: string
  version: number
  billCount: number
  /** The bills this PDF holds. */
  invoiceIds: string[]
  createdAt: string
}
