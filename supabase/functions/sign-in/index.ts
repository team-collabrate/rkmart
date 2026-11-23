// Edge function: signs a person in with their mobile number and 4-digit PIN.
//
// Why it exists: a PIN has only 10,000 possibilities. If the app talked to Supabase's own sign-in,
// anyone could try them all. So:
//   1. The stored password is the PIN plus a long secret (PIN_PEPPER) that only the functions know.
//      Guessing against Supabase directly cannot work without the secret.
//   2. This function is the only way in. It counts wrong tries per mobile number and locks the
//      number for 15 minutes after 5 (see the login_lockout migration).
//
// POST body: { "phone": "9876543210", "pin": "1234" }
// Answers:   200 { session: { access_token, refresh_token } }
//            400 bad input, 401 { error: "invalid_credentials" }, 403 { error: "inactive" },
//            429 { error: "locked", retryAfter: seconds }, 5xx { error: "unavailable" }
//
// The same wrong-PIN answer is given for a number that does not exist, so nobody can find out
// which numbers have logins.
//
// Secrets (supabase secrets set PIN_PEPPER=...): PIN_PEPPER, 32 to 60 characters, random, never
// changed once logins exist (changing it means every login needs a new PIN).
// Deploy with: supabase functions deploy sign-in --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2'
import { parseSignIn, pepperOk, phoneToEmail, pinToPassword } from '../_shared/validate.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' })

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const pepper = Deno.env.get('PIN_PEPPER')
  if (!url || !anonKey || !serviceKey || !pepperOk(pepper)) {
    return json(500, { error: 'unavailable' })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Request body must be JSON.' })
  }
  const parsed = parseSignIn(body)
  if (!parsed.ok) return json(400, { error: parsed.error })
  const { phone, pin } = parsed.value

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // 1. Locked out already? Say so without even checking the PIN.
  const lock = await admin.rpc('login_lock_seconds', { p_phone: phone })
  if (lock.error) return json(503, { error: 'unavailable' })
  if (Number(lock.data) > 0) return json(429, { error: 'locked', retryAfter: Number(lock.data) })

  // 2. Check the PIN with Supabase's own sign-in, using the secret.
  const anon = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({
    email: phoneToEmail(phone),
    password: pinToPassword(pin, pepper),
  })

  if (error || !data.session) {
    const message = (error?.message ?? '').toLowerCase()
    if (message.includes('banned')) return json(403, { error: 'inactive' })
    if (error?.status === 400) {
      const locked = await admin.rpc('login_failed', { p_phone: phone })
      const seconds = locked.error ? 0 : Number(locked.data)
      if (seconds > 0) return json(429, { error: 'locked', retryAfter: seconds })
      return json(401, { error: 'invalid_credentials' })
    }
    return json(503, { error: 'unavailable' })
  }

  await admin.rpc('login_succeeded', { p_phone: phone })
  return json(200, {
    session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
  })
})
