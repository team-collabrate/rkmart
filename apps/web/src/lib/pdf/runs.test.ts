import { describe, expect, it } from 'vitest'
import { splitScripts } from './runs'

describe('splitScripts', () => {
  it('keeps plain English in one Inter run', () => {
    expect(splitScripts('Ponni rice 25 kg')).toEqual([{ text: 'Ponni rice 25 kg', font: 'Inter' }])
  })

  it('keeps a Tamil phrase, including spaces, in one Tamil run', () => {
    expect(splitScripts('ஸ்ரீ முருகன் கஃபே')).toEqual([{ text: 'ஸ்ரீ முருகன் கஃபே', font: 'NotoTamil' }])
  })

  it('switches fonts between Tamil words and digits', () => {
    expect(splitScripts('RK-0042 டெலிவரி ஆச்சு')).toEqual([
      { text: 'RK-0042 ', font: 'Inter' },
      { text: 'டெலிவரி ஆச்சு', font: 'NotoTamil' },
    ])
  })

  it('sends the rupee sign to the Tamil font, which has it, and digits to Inter', () => {
    expect(splitScripts('₹14,300')).toEqual([
      { text: '₹', font: 'NotoTamil' },
      { text: '14,300', font: 'Inter' },
    ])
  })

  it('returns no runs for an empty string', () => {
    expect(splitScripts('')).toEqual([])
  })
})
