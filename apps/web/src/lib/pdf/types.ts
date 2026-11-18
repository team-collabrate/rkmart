// What the PDF needs to print a bill. `toPdfBill` (billMapper.ts) builds these from saved invoices.

export interface BillLine {
  nameEn: string
  nameTa?: string
  hsn: string
  qty: number
  unit: string
  rate: number
  taxable: number
  gstRate: number
  amount: number
}

export interface Bill {
  invoiceNo: string
  /** Already formatted for printing, e.g. "17 Nov 2026". */
  date: string
  shopName: string
  shopAddress: string
  shopGstin?: string
  /** Shown only when known (the delivery person is assigned in Stage 7). */
  deliveredBy?: string
  lines: BillLine[]
  taxable: number
  cgst: number
  sgst: number
  /** Shown instead of CGST and SGST when above 0 (a shop in another state). */
  igst?: number
  roundOff: number
  total: number
  previousBalance: number
  totalDue: number
  amountInWords: string
  /** True when the rates already include GST (changes the small note under the amount in words). */
  ratesIncludeGst?: boolean
}

export interface Company {
  name: string
  tagline: string
  address: string
  gstin: string
  phone: string
  bankDetails?: string
}
