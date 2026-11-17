import type { Content, ContentText, TDocumentDefinitions } from 'pdfmake/interfaces'
import { formatINR } from '../money'
import { splitScripts } from './runs'

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
  date: string
  shopName: string
  shopAddress: string
  shopGstin?: string
  deliveredBy: string
  lines: BillLine[]
  taxable: number
  cgst: number
  sgst: number
  roundOff: number
  total: number
  previousBalance: number
  totalDue: number
  amountInWords: string
}

export interface Company {
  name: string
  tagline: string
  address: string
  gstin: string
  phone: string
}

// A4 portrait in points. Each page holds two half-A4 bills with a dashed cut line between them.
const PAGE_W = 595.28
const MARGIN_X = 28
const HALF_H = 421
const BILL_TOP_PAD = 22
const CONTENT_W = PAGE_W - MARGIN_X * 2

/** Text node whose Latin and Tamil parts each use the font that has their glyphs. */
function rich(text: string, style: Partial<ContentText> = {}): ContentText {
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

function money(value: number, style: Partial<ContentText> = {}): ContentText {
  // Negative amounts read "-₹0.20", not "₹-0.20".
  const sign = value < 0 ? '-' : ''
  return rich(`${sign}₹${formatINR(Math.abs(value))}`, { alignment: 'right', ...style })
}

function billBlock(company: Company, bill: Bill): Content {
  const headerCell = (text: string, alignment: 'left' | 'right' | 'center' = 'left') =>
    rich(text, { bold: true, fontSize: 7.5, alignment, margin: [0, 2, 0, 2] })

  const lineRows = bill.lines.map((line, index) => [
    rich(String(index + 1), { fontSize: 8, alignment: 'center' }),
    {
      stack: [
        rich(line.nameEn, { fontSize: 8.5, bold: true }),
        ...(line.nameTa ? [rich(line.nameTa, { fontSize: 8, color: '#333333' })] : []),
      ],
    },
    rich(line.hsn, { fontSize: 8, alignment: 'center' }),
    rich(String(line.qty), { fontSize: 8.5, alignment: 'right' }),
    rich(line.unit, { fontSize: 8, margin: [4, 0, 0, 0] }),
    rich(formatINR(line.rate), { fontSize: 8.5, alignment: 'right' }),
    rich(formatINR(line.taxable), { fontSize: 8.5, alignment: 'right' }),
    rich(`${line.gstRate}%`, { fontSize: 8, alignment: 'center' }),
    rich(formatINR(line.amount), { fontSize: 8.5, alignment: 'right', bold: true }),
  ])

  const totalsRow = (label: string, value: number, bold = false) => [
    rich(label, { fontSize: 8.5, bold }),
    money(value, { fontSize: 8.5, bold }),
  ]

  return {
    stack: [
      {
        columns: [
          {
            width: '*',
            stack: [
              rich(company.name, { fontSize: 14, bold: true }),
              rich(company.tagline, { fontSize: 8, color: '#333333' }),
              rich(`${company.address} · ${company.phone}`, { fontSize: 8, color: '#333333' }),
              rich(`GSTIN: ${company.gstin}`, { fontSize: 8, bold: true }),
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
              rich(bill.shopAddress, { fontSize: 8 }),
              ...(bill.shopGstin ? [rich(`GSTIN: ${bill.shopGstin}`, { fontSize: 8 })] : []),
            ],
          },
          {
            width: 'auto',
            stack: [
              rich('Delivered by', { fontSize: 7.5, color: '#4a4a4a', alignment: 'right' }),
              rich(bill.deliveredBy, { fontSize: 9, bold: true, alignment: 'right' }),
            ],
          },
        ],
      },
      {
        table: {
          headerRows: 1,
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
        columns: [
          {
            width: '*',
            stack: [
              rich(bill.amountInWords, { fontSize: 8, bold: true }),
              rich('Rate shown is before GST. Tax is added on the bill.', {
                fontSize: 7,
                color: '#4a4a4a',
                margin: [0, 3, 0, 0],
              }),
            ],
          },
          {
            width: 170,
            table: {
              widths: ['*', 70],
              body: [
                totalsRow('Taxable value', bill.taxable),
                totalsRow('CGST', bill.cgst),
                totalsRow('SGST', bill.sgst),
                totalsRow('Round off', bill.roundOff),
                totalsRow('Invoice total', bill.total, true),
                totalsRow('Previous balance', bill.previousBalance),
                totalsRow('Total due', bill.totalDue, true),
              ],
            },
            layout: {
              hLineWidth: (i, node) =>
                i === 4 || i === 6 || i === node.table.body.length ? 0.8 : 0,
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
        margin: [0, 22, 0, 0],
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

function line(width: number): Content {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.6, dash: { length: 3 } }],
  }
}

/**
 * Builds the day's bills as one PDF: A4 portrait, two bills per page (top half and bottom half),
 * dashed cut line in the middle. An odd last bill leaves the bottom half blank.
 */
export function buildDailyBillsDoc(company: Company, bills: Bill[]): TDocumentDefinitions {
  const content: Content[] = []

  for (let i = 0; i < bills.length; i += 2) {
    const top = bills[i]
    const bottom = bills[i + 1]

    content.push({
      ...(billBlock(company, top) as object),
      absolutePosition: { x: MARGIN_X, y: BILL_TOP_PAD },
    } as Content)

    content.push({
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
    })

    if (bottom) {
      content.push({
        ...(billBlock(company, bottom) as object),
        absolutePosition: { x: MARGIN_X, y: HALF_H + BILL_TOP_PAD },
      } as Content)
    }

    if (i + 2 < bills.length) {
      content.push({ text: '', pageBreak: 'after' })
    } else {
      content.push({ text: ' ', fontSize: 1 })
    }
  }

  return {
    pageSize: 'A4',
    pageMargins: [MARGIN_X, 0, MARGIN_X, 0],
    defaultStyle: { font: 'Inter', fontSize: 9 },
    info: { title: 'RK Grocery: daily bills' },
    content,
  }
}
