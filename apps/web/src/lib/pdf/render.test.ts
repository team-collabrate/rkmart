import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { sampleBillsLong, sampleCompany } from '../../spikes/sampleBills'
import { buildDailyBillsDoc } from './dailyBillsDoc'

// Makes the real PDF in Node (same pdfmake and the same fonts as the app) and checks the page count.
const require = createRequire(import.meta.url)
const pdfmake = require('pdfmake') as {
  addFonts(fonts: object): void
  createPdf(doc: object): { getBuffer(): Promise<Uint8Array> }
}
const fontFile = (name: string) => require.resolve(name)

pdfmake.addFonts({
  Inter: {
    normal: fontFile('@fontsource/inter/files/inter-latin-400-normal.woff'),
    bold: fontFile('@fontsource/inter/files/inter-latin-700-normal.woff'),
    italics: fontFile('@fontsource/inter/files/inter-latin-400-normal.woff'),
    bolditalics: fontFile('@fontsource/inter/files/inter-latin-700-normal.woff'),
  },
  NotoTamil: {
    normal: fontFile('@fontsource/noto-sans-tamil/files/noto-sans-tamil-tamil-400-normal.woff'),
    bold: fontFile('@fontsource/noto-sans-tamil/files/noto-sans-tamil-tamil-700-normal.woff'),
    italics: fontFile('@fontsource/noto-sans-tamil/files/noto-sans-tamil-tamil-400-normal.woff'),
    bolditalics: fontFile(
      '@fontsource/noto-sans-tamil/files/noto-sans-tamil-tamil-700-normal.woff',
    ),
  },
})

function pageCount(pdf: Uint8Array): number {
  return (
    Buffer.from(pdf)
      .toString('latin1')
      .match(/\/Type \/Page\b/g) ?? []
  ).length
}

describe('day PDF in Node', () => {
  it('makes a PDF with the right number of pages', async () => {
    const doc = buildDailyBillsDoc(sampleCompany, sampleBillsLong)
    const pdf = await pdfmake.createPdf(doc).getBuffer()
    if (process.env.PDF_OUT) (await import('node:fs')).writeFileSync(process.env.PDF_OUT, pdf)
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe('%PDF-')
    // 5 short bills + 1 half-page bill + IGST bill share pages; the long bill has its own page.
    expect(pageCount(pdf)).toBeGreaterThanOrEqual(4)
  }, 30_000)
})
