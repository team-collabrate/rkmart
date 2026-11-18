import type { Bill } from './types'

// Page planning for the day's PDF. A4 holds two half-A4 bills. A bill with too many lines for half
// a page gets a page of its own (and keeps flowing onto more pages if it is very long), so nothing
// is ever cut off at the cut line.

/** Points. A4 is 595 x 842. */
export const PAGE_H = 841.89
export const HALF_H = 421
export const BILL_TOP_PAD = 22

// Heights measured from real renders (see docs/stage-6-day-pdf.md). Kept slightly high on purpose.
const FIXED_HEIGHT = 246 // everything on a bill except the item rows (measured about 236, plus a safety margin)
const ROW_HEIGHT = 14 // one single-line item row
export const PAGE_BOTTOM_PAD = 14 // about 5 mm: printers cannot print closer to the edge

/** Width of the item column in points, and rough glyph widths, to guess when a name wraps. */
const ITEM_COLUMN = 240
const LATIN_GLYPH = 4.9
const TAMIL_GLYPH = 5.6

const TAMIL = /[஀-௿]/g

/** How many text lines an item row takes (1, or 2 when the English and Tamil names do not fit). */
export function itemRows(nameEn: string, nameTa?: string): number {
  const ta = nameTa ?? ''
  const tamilChars = (ta.match(TAMIL) ?? []).length
  const width =
    nameEn.length * LATIN_GLYPH +
    (ta ? 6 + tamilChars * TAMIL_GLYPH + (ta.length - tamilChars) * LATIN_GLYPH : 0)
  return Math.max(1, Math.ceil(width / ITEM_COLUMN))
}

export function estimateBillHeight(bill: Bill): number {
  const rows = bill.lines.reduce((sum, l) => sum + itemRows(l.nameEn, l.nameTa), 0)
  return FIXED_HEIGHT + rows * ROW_HEIGHT
}

/** The bottom half is the tight one: it starts lower and must end above the page's bottom margin. */
const HALF_ROOM = PAGE_H - PAGE_BOTTOM_PAD - (HALF_H + BILL_TOP_PAD)

export function fitsHalfPage(bill: Bill): boolean {
  return estimateBillHeight(bill) <= HALF_ROOM
}

export type PageGroup = { kind: 'pair'; top: Bill; bottom?: Bill } | { kind: 'full'; bill: Bill }

/**
 * Bills stay in invoice order. Two short bills share a page. A long bill is never squeezed:
 * it starts a new page, and the next short bill starts a new pair after it.
 */
export function planPages(bills: Bill[]): PageGroup[] {
  const groups: PageGroup[] = []
  let waiting: Bill | null = null
  for (const bill of bills) {
    if (!fitsHalfPage(bill)) {
      if (waiting) {
        groups.push({ kind: 'pair', top: waiting })
        waiting = null
      }
      groups.push({ kind: 'full', bill })
    } else if (waiting) {
      groups.push({ kind: 'pair', top: waiting, bottom: bill })
      waiting = null
    } else {
      waiting = bill
    }
  }
  if (waiting) groups.push({ kind: 'pair', top: waiting })
  return groups
}
