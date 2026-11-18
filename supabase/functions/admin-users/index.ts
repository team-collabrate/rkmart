// Edge function: the only place logins are created, reset or switched off.
//
// Why it exists: creating a login needs the Supabase service-role key, which must never be inside
// the app (an APK can be unpacked). The app calls this function with the admin's own login token;
// the function checks the caller really is an active admin, then does the work with the key,
// which lives only in the function's environment.
//
// POST body: { "action": "create" | "reset_password" | "set_active", ...fields }
//   create          { phone, password, fullName, role, shopId?, language? }
//   reset_password  { userId, password }
//   set_active      { userId, active }
//
// Status: written in Stage 1, NOT yet run against a live Supabase project (no project exists yet).
// Deploy with: supabase functions deploy admin-users

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  parseCreateUser,
  parseResetPassword,
  pinToPassword,
  parseSetActive,
  phoneToEmail,
} from '../_shared/validate.ts'

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
  if (!url || !anonKey || !serviceKey) return json(500, { error: 'Function is not configured.' })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json(401, { error: 'Sign in first.' })

  // 1. Who is calling? Use their own token, so Postgres access rules apply to them.
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || !userData.user) return json(401, { error: 'Sign in again.' })
  const callerId = userData.user.id

  const { data: profile } = await caller
    .from('profiles')
    .select('role, is_active')
    .eq('id', callerId)
    .maybeSingle()
  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return json(403, { error: 'Only the admin can manage logins.' })
  }

  // 2. Do the work with the service role.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Request body must be JSON.' })
  }

  const audit = (action: string, entityId: string, details: Record<string, unknown> = {}) =>
    admin
      .from('audit_log')
      .insert({ actor: callerId, action, entity: 'profile', entity_id: entityId, details })

  switch (body.action) {
    case 'create': {
      const parsed = parseCreateUser(body)
      if (!parsed.ok) return json(400, { error: parsed.error })
      const input = parsed.value

      if (input.shopId) {
        const { data: shop } = await admin
          .from('shops')
          .select('id')
          .eq('id', input.shopId)
          .maybeSingle()
        if (!shop) return json(400, { error: 'That shop does not exist.' })
      }

      const created = await admin.auth.admin.createUser({
        email: phoneToEmail(input.phone),
        password: pinToPassword(input.password),
        email_confirm: true,
        user_metadata: { full_name: input.fullName },
      })
      if (created.error || !created.data.user) {
        const taken = created.error?.message?.toLowerCase().includes('already')
        return json(taken ? 409 : 400, {
          error: taken ? 'That mobile number already has a login.' : 'Could not create the login.',
        })
      }
      const userId = created.data.user.id

      const inserted = await admin.from('profiles').insert({
        id: userId,
        role: input.role,
        shop_id: input.shopId,
        full_name: input.fullName,
        phone: input.phone,
        language: input.language,
      })
      if (inserted.error) {
        // Do not leave a login without a profile behind.
        await admin.auth.admin.deleteUser(userId)
        return json(400, { error: 'Could not save the profile.' })
      }

      await audit('user.create', userId, { role: input.role, phone: input.phone })
      return json(201, { userId })
    }

    case 'reset_password': {
      const parsed = parseResetPassword(body)
      if (!parsed.ok) return json(400, { error: parsed.error })
      const { error } = await admin.auth.admin.updateUserById(parsed.value.userId, {
        password: pinToPassword(parsed.value.password),
      })
      if (error) return json(400, { error: 'Could not reset the password.' })
      await audit('user.reset_password', parsed.value.userId)
      return json(200, { ok: true })
    }

    case 'set_active': {
      const parsed = parseSetActive(body)
      if (!parsed.ok) return json(400, { error: parsed.error })
      if (parsed.value.userId === callerId && !parsed.value.active) {
        return json(400, { error: 'You cannot switch off your own login.' })
      }
      const updated = await admin
        .from('profiles')
        .update({ is_active: parsed.value.active })
        .eq('id', parsed.value.userId)
      if (updated.error) return json(400, { error: 'Could not update the login.' })
      // Also stop the login from signing in at all.
      await admin.auth.admin.updateUserById(parsed.value.userId, {
        ban_duration: parsed.value.active ? 'none' : '876000h',
      })
      await audit(parsed.value.active ? 'user.activate' : 'user.deactivate', parsed.value.userId)
      return json(200, { ok: true })
    }

    default:
      return json(400, { error: 'Unknown action.' })
  }
})
