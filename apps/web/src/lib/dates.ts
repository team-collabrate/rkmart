const TIME_ZONE = 'Asia/Kolkata'

/**
 * The calendar day in India as YYYY-MM-DD. Rates and orders are per Indian day, so a phone set to
 * another time zone still agrees with the shop.
 */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** "2026-11-17" -> "17 Nov 2026" (month name in the chosen language). */
export function formatDay(iso: string, language: 'en' | 'ta'): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat(language === 'ta' ? 'ta-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}
