import { describe, expect, it } from 'vitest'
import { buildDailyBillsDoc } from './dailyBillsDoc'
import { fitsHalfPage, itemRows, planPages } from './layout'
import type { Bill, Company } from './types'

const company: Company = {
  name: 'RK Agency',
  tagline: '',
  address: 'Town Hall',
  gstin: '33AAAAA0000A1Z5',
  phone: '9000000000',
}

function bill(no: number, lineCount: number, extra: Partial<Bill> = {}): Bill {
  return {
    invoiceNo: `RK/2627/${String(no).padStart(4, '0')}`,
    date: '18 Nov 2026',
    shopName: `Shop ${no}`,
    shopAddress: 'Main Road',
    lines: Array.from({ length: lineCount }, (_, i) => ({
      nameEn: `Item ${i + 1}`,
      nameTa: 'பொன்னி அரிசி',
      hsn: '1006',
      qty: 1,
      unit: 'kg',
      rate: 100,
      taxable: 100,
      gstRate: 5,
      amount: 105,
    })),
    taxable: 100,
    cgst: 2.5,
    sgst: 2.5,
    roundOff: 0,
    total: 105,
    previousBalance: 0,
    totalDue: 105,
    amountInWords: 'Rupees One Hundred Five Only',
    ...extra,
  }
}

describe('what fits on half an A4 page', () => {
  it('fits nine lines, not ten (measured on real renders)', () => {
    expect(fitsHalfPage(bill(1, 9))).toBe(true)
    expect(fitsHalfPage(bill(1, 10))).toBe(false)
  })

  it('counts a long name as two lines', () => {
    expect(itemRows('Rava', 'ரவை')).toBe(1)
    expect(
      itemRows('Premium aged basmati rice extra long grain', 'பிரீமியம் பழைய பாஸ்மதி அரிசி'),
    ).toBe(2)
    // An item with no Tamil name is just the English name.
    expect(itemRows('Salt')).toBe(1)
  })

  it('counts long item names against the page', () => {
    const long = bill(1, 9)
    long.lines[0].nameEn = 'Premium aged basmati rice extra long grain'
    long.lines[0].nameTa = 'பிரீமியம் பழைய பாஸ்மதி அரிசி'
    expect(fitsHalfPage(long)).toBe(false)
  })
})

describe('planning the pages', () => {
  it('puts short bills two to a page, in order, with an odd one alone', () => {
    const groups = planPages([bill(1, 3), bill(2, 3), bill(3, 3)])
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      kind: 'pair',
      top: { shopName: 'Shop 1' },
      bottom: { shopName: 'Shop 2' },
    })
    expect(groups[1]).toMatchObject({ kind: 'pair', top: { shopName: 'Shop 3' } })
    expect(groups[1]).not.toHaveProperty('bottom')
  })

  it('gives a long bill its own page and starts a new pair after it', () => {
    const groups = planPages([bill(1, 3), bill(2, 14), bill(3, 3), bill(4, 3)])
    expect(groups.map((g) => g.kind)).toEqual(['pair', 'full', 'pair'])
    expect(groups[0]).not.toHaveProperty('bottom') // bill 1 waits alone: bill 2 does not fit beside it
    expect(groups[2]).toMatchObject({ top: { shopName: 'Shop 3' }, bottom: { shopName: 'Shop 4' } })
  })

  it('has no pages for no bills', () => {
    expect(planPages([])).toEqual([])
  })
})

describe('the document definition', () => {
  const text = (doc: unknown) => JSON.stringify(doc)

  it('shows CGST and SGST for a shop in the same state, IGST for another state', () => {
    expect(text(buildDailyBillsDoc(company, [bill(1, 2)]))).toContain('"CGST"')
    const inter = text(buildDailyBillsDoc(company, [bill(1, 2, { cgst: 0, sgst: 0, igst: 5 })]))
    expect(inter).toContain('"IGST"')
    expect(inter).not.toContain('"CGST"')
  })

  it('says whether the rates include GST', () => {
    expect(text(buildDailyBillsDoc(company, [bill(1, 2)]))).toContain('before GST')
    expect(text(buildDailyBillsDoc(company, [bill(1, 2, { ratesIncludeGst: true })]))).toContain(
      'includes GST',
    )
  })

  it('leaves out the delivered-by name, GSTIN and bank lines when there is nothing to show', () => {
    const doc = text(buildDailyBillsDoc({ ...company, gstin: '' }, [bill(1, 2)]))
    expect(doc).not.toContain('Delivered by')
    expect(doc).not.toContain('GSTIN')
    expect(doc).not.toContain('Bank:')
    const withAll = text(
      buildDailyBillsDoc({ ...company, bankDetails: 'SBI\n12345' }, [
        bill(1, 2, { deliveredBy: 'Ravi', shopGstin: '33BBBBB1111B1Z5' }),
      ]),
    )
    expect(withAll).toContain('Delivered by')
    expect(withAll).toContain('Ravi')
    expect(withAll).toContain('33BBBBB1111B1Z5')
    expect(withAll).toContain('SBI · 12345')
  })

  it('breaks the page between groups, and only between them', () => {
    const doc = buildDailyBillsDoc(company, [bill(1, 2), bill(2, 2), bill(3, 2)])
    const breaks = (doc.content as { pageBreak?: string }[]).filter((c) => c.pageBreak)
    expect(breaks).toHaveLength(1)
  })
})
