const inr = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const inrWhole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/** 1234567.5 -> "12,34,567.50" (Indian digit grouping, always two decimals). */
export function formatINR(value: number): string {
  return inr.format(value)
}

/** 14300 -> "14,300" (no decimals, for whole-rupee rates in lists). */
export function formatINRWhole(value: number): string {
  return inrWhole.format(value)
}

/** Rounds to paise without floating point drift, e.g. 0.1 + 0.2 -> 0.3. */
export function roundPaise(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
