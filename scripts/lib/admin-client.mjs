// Shared helpers for the one-off admin scripts. These use the SERVICE-ROLE key, so they run only
// on a trusted computer, never in the app, and the key is read from the environment, never from a file
// in the repo.
import { createClient } from '@supabase/supabase-js'

export function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing environment variable ${name}. See docs/stage-1-database.md.`)
    process.exit(1)
  }
  return value
}

export function adminClient() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
}

// Must match supabase/functions/_shared/validate.ts
// Logins use a 4-digit PIN stored together with a secret (PIN_PEPPER). Must match supabase/functions/_shared/validate.ts
export const pinToPassword = (pin) => {
  const pepper = process.env.PIN_PEPPER ?? ''
  if (pepper.length < 32 || pepper.length > 60) {
    throw new Error('Set PIN_PEPPER to the same 32 to 60 character secret the functions use')
  }
  return pin + pepper
}
export const phoneToEmail = (phone) => `${phone}@rk.local`

export async function createUser(
  admin,
  { phone, password, fullName, role, shopId = null, language = 'en' },
) {
  if (!/^[6-9][0-9]{9}$/.test(phone)) throw new Error(`Invalid phone: ${phone}`)
  if (!/^[0-9]{4}$/.test(password)) throw new Error('The PIN must be exactly 4 digits')

  const created = await admin.auth.admin.createUser({
    email: phoneToEmail(phone),
    password: pinToPassword(password),
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (created.error)
    throw new Error(`Could not create login for ${phone}: ${created.error.message}`)
  const userId = created.data.user.id

  const inserted = await admin.from('profiles').insert({
    id: userId,
    role,
    shop_id: shopId,
    full_name: fullName,
    phone,
    language,
  })
  if (inserted.error) {
    await admin.auth.admin.deleteUser(userId)
    throw new Error(`Could not save profile for ${phone}: ${inserted.error.message}`)
  }
  return userId
}
