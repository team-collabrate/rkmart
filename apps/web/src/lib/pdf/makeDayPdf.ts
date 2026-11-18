import pdfMake from 'pdfmake/build/pdfmake'
import type { Invoice } from '../../data/adminOrders'
import type { CompanySettings } from '../../data/types'
import { toPdfBill, toPdfCompany } from './billMapper'
import { buildDailyBillsDoc } from './dailyBillsDoc'
import { ensurePdfFonts } from './fonts'

/**
 * Makes one PDF from saved invoices (two bills per A4 page). Loaded on demand, because the PDF
 * library and fonts are large and most visits never need them.
 */
export async function makeDayPdf(settings: CompanySettings, invoices: Invoice[]): Promise<Blob> {
  await ensurePdfFonts()
  const doc = buildDailyBillsDoc(
    toPdfCompany(settings),
    invoices.map((i) => toPdfBill(i, settings)),
  )
  return pdfMake.createPdf(doc).getBlob()
}
