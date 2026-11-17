// Logins are mobile numbers. Supabase wants an email, so each phone maps to a fixed fake one.
// MUST match supabase/functions/_shared/validate.ts (the server side that creates the logins).

/** "+91 98765-43210", "098765 43210" and "9876543210" all become "9876543210". */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

export function isValidPhone(phone: string): boolean {
  return /^[6-9][0-9]{9}$/.test(phone)
}

export function phoneToEmail(phone: string): string {
  return `${phone}@rk.local`
}
