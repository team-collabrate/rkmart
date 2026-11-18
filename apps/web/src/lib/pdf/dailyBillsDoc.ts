import type { Content, ContentText, TDocumentDefinitions } from 'pdfmake/interfaces'
import { formatINR } from '../money'
import { BILL_TOP_PAD, HALF_H, PAGE_BOTTOM_PAD, planPages } from './layout'
import { splitScripts, type PdfFont } from './runs'
import type { Bill, Company } from './types'

export type { Bill, BillLine, Company } from './types'

// A4 portrait in points. Each page holds two half-A4 bills with a dashed cut line between them.
const PAGE_W = 595.28
const MARGIN_X = 28
const CONTENT_W = PAGE_W - MARGIN_X * 2

type Style = Partial<ContentText>

/** Text node whose Latin and Tamil parts each use the font that has their glyphs. */
function rich(text: string, style: Style = {}): ContentText {
  const { fontSize, bold, color, alignment, margin, noWrap } = style
  return {
    text: splitScripts(text).map((run) => ({ text: run.text, font: run.font })),
    fontSize,
    bold,
    color,
    alignment,
    margin,
    noWrap,
  }
}

/** The item cell: English name in bold, the Tamil name after it in grey, on one line when it fits. */
function itemName(nameEn: string, nameTa?: string): ContentText {
  const part = (text: string, bold: boolean, color?: string) =>
    splitScripts(text).map((run: { text: string; font: PdfFont }) => ({
      text: run.text,
      font: run.font,
      bold,
      color,
    }))
  return {
    text: [...part(nameEn, true), ...(nameTa ? part('  ' + nameTa, false, '#333333') : [])],
    fontSize: 8.5,
  }
}

function money(value: number, style: Style = {}): ContentText {
  // Negative amounts read "-₹0.20", not "₹-0.20".
  const sign = value < 0 ? '-' : ''
  return rich(`${sign}₹${formatINR(Math.abs(value))}`, { alignment: 'right', ...style })
}

function line(width: number): Content {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.6, dash: { length: 3 } }],
  }
}

/** One bill, as a stack that is as wide as the page content. */
export function billBlock(company: Company, bill: Bill): Content {
  const headerCell = (text: string, alignment: 'left' | 'right' | 'center' = 'left') =>
    rich(text, { bold: true, fontSize: 7.5, alignment, margin: [0, 2, 0, 2] })

  const lineRows = bill.lines.map((l, index) => [
    rich(String(index + 1), { fontSize: 8, alignment: 'center' }),
    itemName(l.nameEn, l.nameTa),
    rich(l.hsn, { fontSize: 8, alignment: 'center' }),
    rich(String(l.qty), { fontSize: 8.5, alignment: 'right' }),
    rich(l.unit, { fontSize: 8, margin: [4, 0, 0, 0] }),
    rich(formatINR(l.rate), { fontSize: 8.5, alignment: 'right' }),
    rich(formatINR(l.taxable), { fontSize: 8.5, alignment: 'right' }),
    rich(`${l.gstRate}%`, { fontSize: 8, alignment: 'center' }),
    rich(formatINR(l.amount), { fontSize: 8.5, alignment: 'right', bold: true }),
  ])

  const totalsRow = (label: string, value: number, bold = false) => [
    rich(label, { fontSize: 8.5, bold }),
    money(value, { fontSize: 8.5, bold }),
  ]

  const interState = (bill.igst ?? 0) > 0
  const totals: [string, number, boolean?][] = [
    ['Taxable value', bill.taxable],
    ...(interState
      ? ([['IGST', bill.igst ?? 0]] as [string, number][])
      : ([
          ['CGST', bill.cgst],
          ['SGST', bill.sgst],
        ] as [string, number][])),
    ['Round off', bill.roundOff],
    ['Invoice total', bill.total, true],
    ['Previous balance', bill.previousBalance],
    ['Total due', bill.totalDue, true],
  ]
  // Rules above "Invoice total" and "Total due", and below the last row.
  const ruleAfterTotal = totals.findIndex(([label]) => label === 'Invoice total')
  const ruleAfterDue = totals.length - 1

  return {
    stack: [
      {
        columns: [
          {
            width: '*',
            stack: [
              rich(company.name, { fontSize: 14, bold: true }),
              ...(company.tagline
                ? [rich(company.tagline, { fontSize: 8, color: '#333333' })]
                : []),
              rich([company.address, company.phone].filter(Boolean).join(' · '), {
                fontSize: 8,
                color: '#333333',
              }),
              ...(company.gstin
                ? [rich(`GSTIN: ${company.gstin}`, { fontSize: 8, bold: true })]
                : []),
            ],
          },
          {
            width: 'auto',
            stack: [
              rich('TAX INVOICE', { fontSize: 11, bold: true, alignment: 'right' }),
              rich(`Invoice No: ${bill.invoiceNo}`, {
                fontSize: 9,
                bold: true,
                alignment: 'right',
              }),
              rich(`Date: ${bill.date}`, { fontSize: 8.5, alignment: 'right' }),
            ],
          },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 4, x2: CONTENT_W, y2: 4, lineWidth: 0.8 }] },
      {
        margin: [0, 5, 0, 5],
        columns: [
          {
            width: '*',
            stack: [
              rich('Bill to', { fontSize: 7.5, color: '#4a4a4a' }),
              rich(bill.shopName, { fontSize: 10, bold: true }),
              ...(bill.shopAddress ? [rich(bill.shopAddress, { fontSize: 8 })] : []),
              ...(bill.shopGstin ? [rich(`GSTIN: ${bill.shopGstin}`, { fontSize: 8 })] : []),
            ],
          },
          ...(bill.deliveredBy
            ? [
                {
                  width: 'auto',
                  stack: [
                    rich('Delivered by', { fontSize: 7.5, color: '#4a4a4a', alignment: 'right' }),
                    rich(bill.deliveredBy, { fontSize: 9, bold: true, alignment: 'right' }),
                  ],
                } as Content,
              ]
            : []),
        ],
      },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [14, '*', 34, 26, 30, 44, 52, 26, 54],
          body: [
            [
              headerCell('No', 'center'),
              headerCell('Item'),
              headerCell('HSN', 'center'),
              headerCell('Qty', 'right'),
              { ...headerCell('Unit'), margin: [4, 2, 0, 2] },
              headerCell('Rate', 'right'),
              headerCell('Taxable', 'right'),
              headerCell('GST', 'center'),
              headerCell('Amount', 'right'),
            ],
            ...lineRows,
          ],
        },
        layout: {
          hLineWidth: (i, node) =>
            i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.25,
          hLineColor: () => '#000000',
          vLineWidth: () => 0,
          paddingTop: () => 2,
          paddingBottom: () => 2,
          paddingLeft: () => 2,
          paddingRight: () => 2,
        },
      },
      {
        margin: [0, 6, 0, 0],
        unbreakable: true,
        columns: [
          {
            width: '*',
            stack: [
              rich(bill.amountInWords, { fontSize: 8, bold: true }),
              rich(
                bill.ratesIncludeGst
                  ? 'Rate shown includes GST.'
                  : 'Rate shown is before GST. Tax is added on the bill.',
                { fontSize: 7, color: '#4a4a4a', margin: [0, 3, 0, 0] },
              ),
              ...(company.bankDetails
                ? [
                    rich(`Bank: ${company.bankDetails.replace(/\s*\n\s*/g, ' · ')}`, {
                      fontSize: 7,
                      color: '#4a4a4a',
                      margin: [0, 3, 0, 0],
                    }),
                  ]
                : []),
            ],
          },
          {
            width: 170,
            table: {
              widths: ['*', 70],
              body: totals.map(([label, value, bold]) => totalsRow(label, value, bold)),
            },
            layout: {
              hLineWidth: (i, node) =>
                i === ruleAfterTotal || i === ruleAfterDue || i === node.table.body.length
                  ? 0.8
                  : 0,
              vLineWidth: () => 0,
              paddingTop: () => 1,
              paddingBottom: () => 1,
              paddingLeft: () => 0,
              paddingRight: () => 0,
            },
          },
        ],
      },
      {
        margin: [0, 14, 0, 0],
        unbreakable: true,
        columns: [
          { width: 150, stack: [line(150), rich("Receiver's signature", { fontSize: 7.5 })] },
          { width: '*', text: '' },
          { width: 110, stack: [line(110), rich('Distributor', { fontSize: 7.5 })] },
          { width: 14, text: '' },
          {
            width: 130,
            stack: [line(130), rich(`For ${company.name}`, { fontSize: 7.5, alignment: 'right' })],
          },
        ],
      },
    ],
  }
}

const SEPARATOR: Content = { text: '', pageBreak: 'after' }

function cutLine(): Content {
  return {
    canvas: [
      {
        type: 'line',
        x1: 0,
        y1: 0,
        x2: CONTENT_W,
        y2: 0,
        lineWidth: 0.6,
        dash: { length: 4, space: 3 },
      },
    ],
    absolutePosition: { x: MARGIN_X, y: HALF_H },
  }
}

/**
 * Builds the day's bills as one PDF: A4 portrait, two bills per page (top half and bottom half),
 * dashed cut line in the middle. A long bill takes a page of its own (more pages if very long).
 * An odd last bill leaves the bottom half blank.
 */
export function buildDailyBillsDoc(company: Company, bills: Bill[]): TDocumentDefinitions {
  const content: Content[] = []
  const groups = planPages(bills)

  groups.forEach((group, index) => {
    if (group.kind === 'pair') {
      content.push({
        ...(billBlock(company, group.top) as object),
        absolutePosition: { x: MARGIN_X, y: BILL_TOP_PAD },
      } as Content)
      content.push(cutLine())
      if (group.bottom) {
        content.push({
          ...(billBlock(company, group.bottom) as object),
          absolutePosition: { x: MARGIN_X, y: HALF_H + BILL_TOP_PAD },
        } as Content)
      }
    } else {
      // Normal flow, so a very long bill continues onto the next page by itself.
      content.push(billBlock(company, group.bill))
    }

    if (index < groups.length - 1) content.push(SEPARATOR)
    else if (group.kind === 'pair') content.push({ text: ' ', fontSize: 1 })
  })

  return {
    pageSize: 'A4',
    pageMargins: [MARGIN_X, BILL_TOP_PAD, MARGIN_X, PAGE_BOTTOM_PAD],
    defaultStyle: { font: 'Inter', fontSize: 9 },
    info: { title: 'RK Grocery: daily bills' },
    content,
  }
}
