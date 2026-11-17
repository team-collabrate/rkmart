import { describe, expect, it } from 'vitest'
import {
  draftFromRates,
  fillBlanks,
  formatRateInput,
  missingIds,
  parseRate,
  planSave,
  rateDelta,
} from './rates'

describe('parseRate', () => {
  it('reads plain and formatted numbers', () => {
    expect(parseRate('1350')).toEqual({ ok: true, value: 1350 })
    expect(parseRate('₹ 1,350.50')).toEqual({ ok: true, value: 1350.5 })
    expect(parseRate('0')).toEqual({ ok: true, value: 0 })
  })

  it('treats empty as not set', () => {
    expect(parseRate('')).toEqual({ ok: true, value: null })
    expect(parseRate('   ')).toEqual({ ok: true, value: null })
  })

  it('rejects text, negatives and too many decimals', () => {
    expect(parseRate('abc')).toEqual({ ok: false })
    expect(parseRate('-5')).toEqual({ ok: false })
    expect(parseRate('1.234')).toEqual({ ok: false })
    expect(parseRate('1..2')).toEqual({ ok: false })
  })
})

describe('rate changes', () => {
  it('shows the change against the previous rate', () => {
    expect(rateDelta(1350, 1330)).toBe(20)
    expect(rateDelta(780, 790)).toBe(-10)
    expect(rateDelta(46, 46)).toBe(null)
    expect(rateDelta(46, undefined)).toBe(null)
    expect(rateDelta(null, 46)).toBe(null)
  })

  it('formats saved rates for the input box', () => {
    expect(formatRateInput(1350)).toBe('1350')
    expect(formatRateInput(46.5)).toBe('46.5')
  })
})

describe('same as yesterday', () => {
  const previous = { a: 100, b: 200, c: 300 }

  it('fills only the blanks and keeps typed values', () => {
    const draft = { a: '105', b: '' }
    expect(fillBlanks(draft, previous, ['a', 'b', 'c'])).toEqual({ a: '105', b: '200', c: '300' })
  })

  it('leaves items with no previous rate empty', () => {
    expect(fillBlanks({}, { a: 100 }, ['a', 'z'])).toEqual({ a: '100' })
  })
})

describe('saving', () => {
  const ids = ['a', 'b', 'c', 'd']

  it('writes only rates that are valid and changed', () => {
    const saved = { a: 100, b: 200 }
    const draft = { a: '100', b: '210', c: '50', d: '' }
    expect(planSave(draft, saved, ids)).toEqual({ changes: { b: 210, c: 50 }, invalid: [] })
  })

  it('reports invalid entries and does not write them', () => {
    const plan = planSave({ a: 'x', b: '10' }, {}, ids)
    expect(plan.invalid).toEqual(['a'])
    expect(plan.changes).toEqual({ b: 10 })
  })

  it('lists items a shop cannot order yet', () => {
    expect(missingIds({ a: '1', b: '', c: 'oops' }, ids)).toEqual(['b', 'c', 'd'])
  })

  it('starts from the saved rates', () => {
    expect(draftFromRates({ a: 1350, b: 46.5 })).toEqual({ a: '1350', b: '46.5' })
  })
})
