import type { RateMap } from '../../data/types'

// Pure logic behind the "Today's rates" screen, kept apart so it can be tested without the screen.

export type ParsedRate = { ok: true; value: number | null } | { ok: false }

/** "1,350", "₹ 46.5" -> numbers. Empty means "not set". Negative, text or 3+ decimals are invalid. */
export function parseRate(input: string): ParsedRate {
  const cleaned = input.replace(/[₹,\s]/g, '')
  if (cleaned === '') return { ok: true, value: null }
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { ok: false }
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value > 10_000_000) return { ok: false }
  return { ok: true, value }
}

/** 1350 -> "1350", 46.5 -> "46.5": how a saved rate appears in the input. */
export function formatRateInput(value: number): string {
  return String(Math.round(value * 100) / 100)
}

/** Change against the previous rate, or null when there is nothing to compare. */
export function rateDelta(current: number | null, previous: number | undefined): number | null {
  if (current === null || previous === undefined) return null
  const delta = Math.round((current - previous) * 100) / 100
  return delta === 0 ? null : delta
}

export type Draft = Record<string, string>

/** Starting values for the screen: today's saved rates. */
export function draftFromRates(rates: RateMap): Draft {
  const draft: Draft = {}
  for (const [id, rate] of Object.entries(rates)) draft[id] = formatRateInput(rate)
  return draft
}

/** "Same as yesterday": fills only the empty fields from the previous rate. Typed values are kept. */
export function fillBlanks(draft: Draft, previous: RateMap, productIds: string[]): Draft {
  const next: Draft = { ...draft }
  for (const id of productIds) {
    const current = parseRate(next[id] ?? '')
    const isBlank = current.ok && current.value === null
    if (isBlank && previous[id] !== undefined) next[id] = formatRateInput(previous[id])
  }
  return next
}

export interface SavePlan {
  /** Rates to write: valid, and different from what is already saved. */
  changes: RateMap
  /** Items whose text is not a valid rate. */
  invalid: string[]
}

export function planSave(draft: Draft, saved: RateMap, productIds: string[]): SavePlan {
  const changes: RateMap = {}
  const invalid: string[] = []
  for (const id of productIds) {
    const parsed = parseRate(draft[id] ?? '')
    if (!parsed.ok) invalid.push(id)
    else if (parsed.value !== null && parsed.value !== saved[id]) changes[id] = parsed.value
  }
  return { changes, invalid }
}

/** Items with no usable rate: a shop cannot order them today. */
export function missingIds(draft: Draft, productIds: string[]): string[] {
  return productIds.filter((id) => {
    const parsed = parseRate(draft[id] ?? '')
    return !parsed.ok || parsed.value === null
  })
}
