// pdfmake does not fall back between fonts, so every piece of text is split into runs and each run
// is given the font that has its glyphs: Inter for Latin letters and digits, Noto Sans Tamil for
// Tamil letters and the rupee sign.

export type PdfFont = 'Inter' | 'NotoTamil'

export interface Run {
  text: string
  font: PdfFont
}

const TAMIL_OR_RUPEE = /[஀-௿₹]/
const WHITESPACE = /\s/

export function splitScripts(input: string): Run[] {
  const runs: Run[] = []
  for (const ch of input) {
    const last = runs[runs.length - 1]
    // Spaces stay with the previous run so words do not fragment into many tiny runs.
    const font: PdfFont =
      WHITESPACE.test(ch) && last ? last.font : TAMIL_OR_RUPEE.test(ch) ? 'NotoTamil' : 'Inter'
    if (last && last.font === font) {
      last.text += ch
    } else {
      runs.push({ text: ch, font })
    }
  }
  return runs
}
