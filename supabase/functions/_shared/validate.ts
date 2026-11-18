// Input checks for the admin-users edge function. Plain TypeScript with no Deno or Supabase
// imports, so it is unit tested with Vitest.

export type UserRole = 'admin' | 'distributor' | 'shop'
export type Language = 'en' | 'ta'

// Logins use a 4-digit PIN. Supabase needs a longer password, so the PIN gets a fixed suffix.
// MUST match apps/web/src/lib/pin.ts and scripts/lib/admin-client.mjs.
const PIN_SUFFIX = 'rk-pin-v1'
export const pinToPassword = (pin: string): string => pin + PIN_SUFFIX
const ROLES: readonly UserRole[] = ['admin', 'distributor', 'shop']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface CreateUserInput {
  phone: string
  password: string
  fullName: string
  role: UserRole
  shopId: string | null
  language: Language
}

export interface ResetPasswordInput {
  userId: string
  password: string
}

export interface SetActiveInput {
  userId: string
  active: boolean
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

/** "+91 98765-43210", "098765 43210" and "9876543210" all become "9876543210". */
export function normalizePhone(input: unknown): string {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

export function isValidPhone(phone: string): boolean {
  return /^[6-9][0-9]{9}$/.test(phone)
}

/** Logins are phone numbers. Supabase wants an email, so each phone maps to a fixed fake one. */
export function phoneToEmail(phone: string): string {
  return `${phone}@rk.local`
}

function asObject(body: unknown): Record<string, unknown> | null {
  return body !== null && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null
}

function checkPassword(password: unknown): string | null {
  if (typeof password !== 'string' || !/^[0-9]{4}$/.test(password)) {
    return 'The PIN must be exactly 4 digits.'
  }
  return null
}

export function parseCreateUser(body: unknown): Parsed<CreateUserInput> {
  const o = asObject(body)
  if (!o) return { ok: false, error: 'Request body must be a JSON object.' }

  const phone = normalizePhone(o.phone)
  if (!isValidPhone(phone)) return { ok: false, error: 'Enter a valid 10-digit mobile number.' }

  const passwordError = checkPassword(o.password)
  if (passwordError) return { ok: false, error: passwordError }

  const fullName = typeof o.fullName === 'string' ? o.fullName.trim() : ''
  if (!fullName) return { ok: false, error: 'Name is required.' }

  if (typeof o.role !== 'string' || !ROLES.includes(o.role as UserRole)) {
    return { ok: false, error: 'Role must be admin, distributor or shop.' }
  }
  const role = o.role as UserRole

  let shopId: string | null = null
  if (role === 'shop') {
    if (typeof o.shopId !== 'string' || !UUID.test(o.shopId)) {
      return { ok: false, error: 'A shop owner must be linked to a shop.' }
    }
    shopId = o.shopId
  } else if (o.shopId !== undefined && o.shopId !== null) {
    return { ok: false, error: 'Only shop owners are linked to a shop.' }
  }

  const language: Language = o.language === 'ta' ? 'ta' : 'en'

  return {
    ok: true,
    value: { phone, password: o.password as string, fullName, role, shopId, language },
  }
}

export function parseResetPassword(body: unknown): Parsed<ResetPasswordInput> {
  const o = asObject(body)
  if (!o) return { ok: false, error: 'Request body must be a JSON object.' }
  if (typeof o.userId !== 'string' || !UUID.test(o.userId))
    return { ok: false, error: 'userId is required.' }
  const passwordError = checkPassword(o.password)
  if (passwordError) return { ok: false, error: passwordError }
  return { ok: true, value: { userId: o.userId, password: o.password as string } }
}

export function parseSetActive(body: unknown): Parsed<SetActiveInput> {
  const o = asObject(body)
  if (!o) return { ok: false, error: 'Request body must be a JSON object.' }
  if (typeof o.userId !== 'string' || !UUID.test(o.userId))
    return { ok: false, error: 'userId is required.' }
  if (typeof o.active !== 'boolean') return { ok: false, error: 'active must be true or false.' }
  return { ok: true, value: { userId: o.userId, active: o.active } }
}
