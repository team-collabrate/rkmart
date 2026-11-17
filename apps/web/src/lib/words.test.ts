import { describe, expect, it } from 'vitest'
import { amountInWords } from './words'

describe('amountInWords', () => {
  it('writes ordinary amounts', () => {
    expect(amountInWords(14945)).toBe('Rupees Fourteen Thousand Nine Hundred Forty-Five Only')
    expect(amountInWords(22800)).toBe('Rupees Twenty-Two Thousand Eight Hundred Only')
  })

  it('uses lakh and crore', () => {
    expect(amountInWords(100000)).toBe('Rupees One Lakh Only')
    expect(amountInWords(12345678)).toBe(
      'Rupees One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight Only',
    )
  })

  it('handles paise', () => {
    expect(amountInWords(322.5)).toBe('Rupees Three Hundred Twenty-Two and Fifty Paise Only')
  })

  it('handles zero', () => {
    expect(amountInWords(0)).toBe('Rupees Zero Only')
  })
})
