import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('starts with a byte-order mark so Excel reads Tamil correctly, and uses Windows line ends', () => {
    const text = toCsv([
      ['பொருள்', 'Qty'],
      ['Sugar', 2.5],
    ])
    expect(text.startsWith('﻿')).toBe(true)
    expect(text).toBe('﻿பொருள்,Qty\r\nSugar,2.5\r\n')
  })

  it('quotes commas, quotes and new lines', () => {
    expect(toCsv([['a,b', 'say "hi"', 'x\ny']])).toBe(
      '﻿"a,b","say ""hi""","x\ny"\r\n'.replace('x\ny', 'x\ny'),
    )
  })

  it('does not let a typed name run as a formula', () => {
    const line = toCsv([['=HYPERLINK("http://x")', '+1', '-2', '@A1', 'safe']]).split('\r\n')[0]
    expect(line).toContain('"\t=HYPERLINK(""http://x"")"')
    expect(line).toContain('\t+1')
    expect(line).toContain('\t@A1')
    expect(line.endsWith(',safe')).toBe(true)
  })

  it('leaves numbers alone, even negative ones', () => {
    expect(toCsv([[-5, 0]])).toBe('﻿-5,0\r\n')
  })
})
