import type { Invoice } from '../../data/adminOrders'
import type { CompanySettings } from '../../data/types'
import { formatDay } from '../dates'
import { amountInWords } from '../words'
import type { Bill, Company } from './types'

/** A saved invoice as the PDF prints it. */
export function toPdfBill(invoice: Invoice, settings: CompanySettings): Bill {
  return {
    invoiceNo: invoice.invoiceNo,
    date: formatDay(invoice.issueDate, 'en'),
    shopName: invoice.shopName,
    shopAddress: invoice.shopAddress,
    shopGstin: invoice.shopGstin || undefined,
    lines: invoice.lines.map((l) => ({
      nameEn: l.nameEn,
      nameTa: l.nameTa || undefined,
      hsn: l.hsnCode,
      qty: l.qty,
      unit: l.unit,
      rate: l.rate,
      taxable: l.taxable,
      gstRate: l.gstRate,
      amount: l.amount,
    })),
    taxable: invoice.taxableTotal,
    cgst: invoice.cgstTotal,
    sgst: invoice.sgstTotal,
    igst: invoice.igstTotal,
    roundOff: invoice.roundOff,
    total: invoice.grandTotal,
    previousBalance: invoice.previousBalance,
    totalDue: invoice.totalDue,
    // Words match the invoice total (the legal amount of this bill), not the running balance.
    amountInWords: amountInWords(invoice.grandTotal),
    ratesIncludeGst: settings.ratesIncludeGst,
  }
}

export function toPdfCompany(settings: CompanySettings): Company {
  return {
    name: settings.companyName,
    tagline: settings.tagline,
    address: settings.address,
    gstin: settings.gstin,
    phone: settings.phone,
    bankDetails: settings.bankDetails || undefined,
  }
}
