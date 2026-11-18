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

/** The hour of the day (0 to 23) on the Indian clock, for "good morning" style greetings. */
export function hourInIndia(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: TIME_ZONE })
      .format(now)
      .slice(0, 2),
  )
}

/** "2026-11-17" plus 1 -> "2026-11-18" (works across month and year ends). */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** An ISO timestamp as the Indian clock time, e.g. "2:30 pm". */
export function formatTime(iso: string, language: 'en' | 'ta'): string {
  return new Intl.DateTimeFormat(language === 'ta' ? 'ta-IN' : 'en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: TIME_ZONE,
  }).format(new Date(iso))
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
