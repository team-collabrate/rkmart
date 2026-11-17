import { roundPaise } from '../../lib/money'

// Pure cart logic: reading quantities and adding up the total.

export const MAX_QTY = 100_000

export type ParsedQty = { ok: true; value: number | null } | { ok: false }

/** "2", "2.5", "1,5" -> numbers. Empty means "none yet". Zero, negative, text or 4+ decimals are invalid. */
export function parseQty(input: string): ParsedQty {
  const cleaned = input.trim().replace(',', '.')
  if (cleaned === '') return { ok: true, value: null }
  if (!/^\d+(\.\d{1,3})?$/.test(cleaned)) return { ok: false }
  const value = Number(cleaned)
  if (!(value > 0) || value > MAX_QTY) return { ok: false }
  return { ok: true, value }
}

/** 2 -> "2", 2.5 -> "2.5", 0.125 -> "0.125". */
export function formatQty(value: number): string {
  return String(Math.round(value * 1000) / 1000)
}

export type CartLines = Record<string, number>

/** Total of the lines that have a rate today. Items without a rate are left out. */
export function cartTotal(lines: CartLines, rates: Record<string, number>): number {
  let total = 0
  for (const [id, qty] of Object.entries(lines)) {
    if (rates[id] !== undefined) total += qty * rates[id]
  }
  return roundPaise(total)
}

/** How many different items are in the cart (only those available today). */
export function cartCount(lines: CartLines, rates: Record<string, number>): number {
  return Object.keys(lines).filter((id) => rates[id] !== undefined).length
}

/** Splits cart lines into those with a rate today and those without. */
export function splitAvailable(
  lines: CartLines,
  rates: Record<string, number>,
): { available: string[]; unavailable: string[] } {
  const available: string[] = []
  const unavailable: string[] = []
  for (const id of Object.keys(lines)) (rates[id] !== undefined ? available : unavailable).push(id)
  return { available, unavailable }
}

/** A quantity one step up or down. Steps are whole units, and never go below zero. */
export function stepQty(current: number, direction: 1 | -1): number {
  const next = Math.round((current + direction) * 1000) / 1000
  return next > 0 ? next : 0
}
