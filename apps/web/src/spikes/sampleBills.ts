// SAMPLE DATA for the Stage 0 PDF spike only. Tax rates here are illustrative, not tax advice.
// Real GST maths is built and tested in Stage 5.
import type { Bill, BillLine, Company } from '../lib/pdf/dailyBillsDoc'
import { roundPaise } from '../lib/money'
import { amountInWords } from '../lib/words'

export const sampleCompany: Company = {
  name: 'RK Agency',
  tagline: 'Wholesale grocery distributor · மளிகை மொத்த வியாபாரம்',
  address: 'Sample address, Tamil Nadu',
  gstin: '33AAAAA0000A1Z5 (sample)',
  phone: '98765 43210',
}

function line(
  nameEn: string,
  nameTa: string,
  hsn: string,
  qty: number,
  unit: string,
  rate: number,
  gstRate: number,
): BillLine {
  const taxable = roundPaise(qty * rate)
  const amount = roundPaise(taxable * (1 + gstRate / 100))
  return { nameEn, nameTa, hsn, qty, unit, rate, taxable, gstRate, amount }
}

function bill(
  invoiceNo: string,
  shopName: string,
  shopAddress: string,
  previousBalance: number,
  lines: BillLine[],
): Bill {
  const taxable = roundPaise(lines.reduce((sum, l) => sum + l.taxable, 0))
  const tax = roundPaise(lines.reduce((sum, l) => sum + (l.amount - l.taxable), 0))
  const cgst = roundPaise(tax / 2)
  const sgst = roundPaise(tax - cgst)
  const exact = taxable + cgst + sgst
  const total = Math.round(exact)
  return {
    invoiceNo,
    date: '16 Nov 2026',
    shopName,
    shopAddress,
    deliveredBy: 'Distributor name',
    lines,
    taxable,
    cgst,
    sgst,
    roundOff: roundPaise(total - exact),
    total,
    previousBalance,
    totalDue: total + previousBalance,
    amountInWords: amountInWords(total),
  }
}

const rice = () => line('Ponni rice', 'பொன்னி அரிசி', '1006', 4, 'bag', 1350, 5)
const dal = () => line('Toor dal', 'துவரம் பருப்பு', '0713', 10, 'kg', 140, 0)
const sugar = () => line('Sugar', 'சர்க்கரை', '1701', 20, 'kg', 46, 5)
const oil = () => line('Sunflower oil', 'சூரியகாந்தி எண்ணெய்', '1512', 6, 'can', 780, 5)
const tea = () => line('Tea powder', 'டீ தூள்', '0902', 5, 'kg', 380, 5)
const rava = () => line('Rava', 'ரவை', '1103', 8, 'kg', 58, 5)
const salt = () => line('Salt', 'உப்பு', '2501', 12, 'kg', 22, 0)

export const sampleBills: Bill[] = [
  bill('RK/2627/0041', 'Lakshmi Stores', 'லட்சுமி ஸ்டோர்ஸ், Gandhi Road', 0, [
    rice(),
    dal(),
    sugar(),
    rava(),
    salt(),
  ]),
  bill('RK/2627/0042', 'Sri Murugan Cafe', 'ஸ்ரீ முருகன் கஃபே, Town Hall', 8500, [
    rice(),
    dal(),
    sugar(),
    oil(),
    tea(),
  ]),
  bill('RK/2627/0043', 'Annam Hotel', 'அன்னம் ஹோட்டல், Market Street', 7500, [
    oil(),
    sugar(),
    tea(),
    rava(),
    salt(),
    dal(),
    rice(),
  ]),
  bill('RK/2627/0044', 'Kavi Tiffin Centre', 'கவி டிபன் சென்டர், Bus Stand', 0, [
    dal(),
    rava(),
    salt(),
  ]),
  bill('RK/2627/0045', 'Green Leaf', 'கிரீன் லீஃப், Station Road', 4500, [
    rice(),
    oil(),
    tea(),
    sugar(),
  ]),
]
