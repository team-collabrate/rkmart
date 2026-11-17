import { describe, expect, it } from 'vitest'
import { formatDay, todayISO } from './dates'

describe('dates', () => {
  it('uses the Indian calendar day, whatever the device time zone', () => {
    // 20:00 UTC on 16 Nov is already 01:30 on 17 Nov in India.
    expect(todayISO(new Date('2026-11-16T20:00:00Z'))).toBe('2026-11-17')
    expect(todayISO(new Date('2026-11-16T10:00:00Z'))).toBe('2026-11-16')
  })

  it('formats a day in English', () => {
    expect(formatDay('2026-11-17', 'en')).toMatch(/17 Nov 2026/)
  })

  it('formats a day in Tamil without throwing', () => {
    expect(formatDay('2026-11-17', 'ta')).toMatch(/2026/)
  })
})
