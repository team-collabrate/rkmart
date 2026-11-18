import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { gstLine, invoiceFy, invoiceNumber, invoiceTotals } from './gst'

// The same cases the database tests use, so the demo maths and the real maths cannot drift apart.
const cases = JSON.parse(
  readFileSync(
    join(__dirname, '..', '..', '..', '..', 'supabase', 'tests', 'fixtures', 'gst-cases.json'),
    'utf8',
  ),
) as {
  name: string
  qty: number
  rate: number
  gst: number
  inclusive: boolean
  intra: boolean
  expect: { taxable: number; cgst: number; sgst: number; igst: number; amount: number }
}[]

describe('gstLine matches the database cases', () => {
  for (const c of cases) {
    it(c.name, () => {
      expect(
        gstLine({
          qty: c.qty,
          rate: c.rate,
          gstRate: c.gst,
          inclusive: c.inclusive,
          intra: c.intra,
        }),
      ).toEqual(c.expect)
    })
  }

  it('keeps CGST plus SGST equal to the tax', () => {
    for (const c of cases.filter((x) => x.intra)) {
      const l = gstLine({
        qty: c.qty,
        rate: c.rate,
        gstRate: c.gst,
        inclusive: c.inclusive,
        intra: true,
      })
      expect(Math.round((l.cgst + l.sgst) * 100)).toBe(Math.round((l.amount - l.taxable) * 100))
    }
  })
})

describe('invoice totals', () => {
  const line = (qty: number, rate: number, gstRate: number) =>
    gstLine({ qty, rate, gstRate, inclusive: false, intra: true })

  it('adds up the sample bill from the approved sheet', () => {
    const t = invoiceTotals([
      line(4, 1350, 5),
      line(10, 140, 0),
      line(20, 46, 5),
      line(6, 780, 5),
      line(5, 380, 5),
    ])
    expect(t).toEqual({
      taxable: 14300,
      cgst: 322.5,
      sgst: 322.5,
      igst: 0,
      total: 14945,
      grand: 14945,
      roundOff: 0,
    })
  })

  it('rounds to whole rupees and shows the round-off', () => {
    const t = invoiceTotals([line(2.5, 46.5, 5)]) // 122.06
    expect(t).toMatchObject({ total: 122.06, grand: 122, roundOff: -0.06 })
    const up = invoiceTotals([
      gstLine({ qty: 1, rate: 100.5, gstRate: 0, inclusive: false, intra: true }),
    ])
    expect(up).toMatchObject({ total: 100.5, grand: 101, roundOff: 0.5 })
  })
})

describe('invoice numbers', () => {
  it('uses the April to March financial year', () => {
    expect(invoiceFy('2026-04-01')).toBe('2627')
    expect(invoiceFy('2027-03-31')).toBe('2627')
    expect(invoiceFy('2026-03-31')).toBe('2526')
    expect(invoiceFy('2099-12-01')).toBe('9900')
  })

  it('builds the number and stays within 16 characters', () => {
    expect(invoiceNumber('RK', '2026-11-18', 42)).toBe('RK/2627/0042')
    expect(invoiceNumber('ABCDEF', '2026-11-18', 9999).length).toBe(16)
  })
})
