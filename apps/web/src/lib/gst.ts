// GST maths for one bill line. It does exactly what the database function public.gst_line does
// (see supabase/migrations/20261119100000_billing.sql) and is tested against the same cases.
// The real bill is always made by the database; this copy runs the demo backend.
//
// Everything is worked in whole paise (integers) so there is no floating point drift,
// and rounded half up, like the database.

export interface GstLineInput {
  qty: number
  rate: number
  /** GST percent, for example 5 or 0.25. */
  gstRate: number
  /** true: the rate already contains tax. false: tax is added on top. */
  inclusive: boolean
  /** true: CGST + SGST (same state). false: IGST. */
  intra: boolean
}

export interface GstLine {
  taxable: number
  cgst: number
  sgst: number
  igst: number
  amount: number
}

const rupees = (paise: bigint): number => Number(paise) / 100

/** Integer division of positive numbers, rounded half up. */
function divRound(n: bigint, d: bigint): bigint {
  return (2n * n + d) / (2n * d)
}

export function gstLine(input: GstLineInput): GstLine {
  const qtyMilli = BigInt(Math.round(input.qty * 1000))
  const ratePaise = BigInt(Math.round(input.rate * 100))
  const gstHundredths = BigInt(Math.round(input.gstRate * 100)) // 5% -> 500, 0.25% -> 25

  const gross = divRound(qtyMilli * ratePaise, 1000n)

  let taxable: bigint
  let tax: bigint
  let amount: bigint
  if (input.inclusive) {
    amount = gross
    taxable = divRound(gross * 10_000n, 10_000n + gstHundredths)
    tax = amount - taxable
  } else {
    taxable = gross
    tax = divRound(taxable * gstHundredths, 10_000n)
    amount = taxable + tax
  }

  let cgst = 0n
  let sgst = 0n
  let igst = 0n
  if (input.intra) {
    cgst = divRound(tax, 2n)
    sgst = tax - cgst
  } else {
    igst = tax
  }
  return {
    taxable: rupees(taxable),
    cgst: rupees(cgst),
    sgst: rupees(sgst),
    igst: rupees(igst),
    amount: rupees(amount),
  }
}

export interface InvoiceTotals {
  taxable: number
  cgst: number
  sgst: number
  igst: number
  /** Sum of the lines, with paise. */
  total: number
  /** The invoice amount in whole rupees. */
  grand: number
  /** grand - total. Can be negative. */
  roundOff: number
}

const paiseOf = (rupeeAmount: number): bigint => BigInt(Math.round(rupeeAmount * 100))

export function invoiceTotals(lines: GstLine[]): InvoiceTotals {
  const sum = (pick: (l: GstLine) => number): bigint =>
    lines.reduce((acc, l) => acc + paiseOf(pick(l)), 0n)
  const total = sum((l) => l.amount)
  const grand = divRound(total, 100n) * 100n
  return {
    taxable: rupees(sum((l) => l.taxable)),
    cgst: rupees(sum((l) => l.cgst)),
    sgst: rupees(sum((l) => l.sgst)),
    igst: rupees(sum((l) => l.igst)),
    total: rupees(total),
    grand: rupees(grand),
    roundOff: rupees(grand - total),
  }
}

/** Financial year code: 1 Apr 2026 to 31 Mar 2027 is "2627". */
export function invoiceFy(isoDate: string): string {
  const [year, month] = isoDate.split('-').map(Number)
  const start = month < 4 ? year - 1 : year
  const two = (n: number) => String(n % 100).padStart(2, '0')
  return two(start) + two(start + 1)
}

/** "RK" + 2026-11-18 + 42 -> "RK/2627/0042". */
export function invoiceNumber(prefix: string, isoDate: string, seq: number): string {
  return `${prefix}/${invoiceFy(isoDate)}/${String(seq).padStart(4, '0')}`
}
