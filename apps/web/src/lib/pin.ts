// Logins are a mobile number and a 4-digit PIN. Supabase insists on a longer password, so the PIN
// is stored with a fixed suffix. The suffix is not a secret; it only satisfies the length rule.
// MUST match supabase/functions/_shared/validate.ts and scripts/lib/admin-client.mjs.

const PIN_SUFFIX = 'rk-pin-v1'

export function isPin(value: string): boolean {
  return /^[0-9]{4}$/.test(value)
}

/** What Supabase stores and checks as the password for this PIN. */
export function pinToPassword(pin: string): string {
  return pin + PIN_SUFFIX
}
