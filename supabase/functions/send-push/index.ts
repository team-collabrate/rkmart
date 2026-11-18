// Edge function: sends the unsent alerts (rows of `notifications`) to people's phones and browsers.
//
// How it is started (set up once in the Supabase dashboard, see docs/stage-8-notifications.md):
//   - a Database Webhook on INSERT into public.notifications, sending the header
//       x-push-secret: <PUSH_WEBHOOK_SECRET>
//   - a schedule (every 5 minutes) that calls it with the same header, to retry failures.
// Either way it does the same thing: send whatever is still unsent. The request body is ignored.
//
// Secrets it needs (supabase secrets set ...):
//   PUSH_WEBHOOK_SECRET      long random text, also put in the webhook header
//   FCM_SERVICE_ACCOUNT      the Firebase service account JSON (for Android phones)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT   (for browsers, e.g. mailto:owner@example.com)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Status: written in Stage 8, NOT yet run against a live Supabase project or real Firebase project.
// Deploy with: supabase functions deploy send-push --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'
import {
  MAX_ATTEMPTS,
  classifyFcmFailure,
  classifyWebPushFailure,
  fcmMessage,
  jwtSigningInput,
  base64url,
  outcomeFor,
  parseServiceAccount,
  parseWebToken,
  pemToBytes,
  webPayload,
  type Alert,
  type SendResult,
  type ServiceAccount,
  type TokenRow,
} from '../_shared/push.ts'

const BATCH = 50

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Constant-time comparison, so the secret cannot be guessed from response times. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

let cachedToken: { value: string; expires: number } | null = null

async function googleAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expires > now + 60) return cachedToken.value

  const input = jwtSigningInput(account, now)
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input)),
  )
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${input}.${base64url(signature)}`,
    }),
  })
  if (!response.ok) throw new Error(`google_auth_${response.status}`)
  const data = (await response.json()) as { access_token: string; expires_in: number }
  cachedToken = { value: data.access_token, expires: now + data.expires_in }
  return data.access_token
}

async function sendAndroid(
  account: ServiceAccount | null,
  token: TokenRow,
  alert: Alert,
): Promise<SendResult> {
  if (!account)
    return { tokenId: token.id, ok: false, failure: 'fatal', error: 'fcm_not_configured' }
  try {
    const access = await googleAccessToken(account)
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(fcmMessage(token.token, alert)),
      },
    )
    if (response.ok) return { tokenId: token.id, ok: true }
    const text = await response.text()
    return {
      tokenId: token.id,
      ok: false,
      failure: classifyFcmFailure(response.status, text),
      error: `fcm_${response.status}`,
    }
  } catch (error) {
    return { tokenId: token.id, ok: false, failure: 'retry', error: String(error).slice(0, 200) }
  }
}

async function sendWeb(token: TokenRow, alert: Alert): Promise<SendResult> {
  const subscription = parseWebToken(token.token)
  if (!subscription)
    return { tokenId: token.id, ok: false, failure: 'dead_token', error: 'bad_token' }
  try {
    await webpush.sendNotification(subscription, webPayload(alert), { TTL: 60 * 60 * 12 })
    return { tokenId: token.id, ok: true }
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode ?? 0
    return {
      tokenId: token.id,
      ok: false,
      failure: status ? classifyWebPushFailure(status) : 'retry',
      error: `web_${status || 'error'}`,
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' })

  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? ''
  const given = req.headers.get('x-push-secret') ?? ''
  if (!secret || !sameSecret(secret, given)) return json(401, { error: 'Not allowed.' })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
  if (vapidPublic && vapidPrivate) {
    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
      vapidPublic,
      vapidPrivate,
    )
  }
  const account = parseServiceAccount(Deno.env.get('FCM_SERVICE_ACCOUNT'))

  const { data: alerts, error } = await supabase
    .from('notifications')
    .select('id, profile_id, title, body, url, attempts')
    .is('sent_at', null)
    .lt('attempts', MAX_ATTEMPTS)
    .order('id', { ascending: true })
    .limit(BATCH)
  if (error) return json(500, { error: 'Could not read the alerts.' })
  if (!alerts || alerts.length === 0) return json(200, { sent: 0, failed: 0 })

  const profileIds = [...new Set((alerts as Alert[]).map((a) => a.profile_id))]
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('id, profile_id, platform, token')
    .in('profile_id', profileIds)
  const byProfile = new Map<string, TokenRow[]>()
  for (const t of (tokens ?? []) as TokenRow[]) {
    byProfile.set(t.profile_id, [...(byProfile.get(t.profile_id) ?? []), t])
  }

  let sent = 0
  let failed = 0
  const dead = new Set<string>()

  for (const alert of alerts as Alert[]) {
    const results: SendResult[] = []
    for (const token of byProfile.get(alert.profile_id) ?? []) {
      if (dead.has(token.id)) continue
      results.push(
        token.platform === 'android'
          ? await sendAndroid(account, token, alert)
          : await sendWeb(token, alert),
      )
    }
    const outcome = outcomeFor(alert, results)
    outcome.deadTokenIds.forEach((id) => dead.add(id))

    await supabase
      .from('notifications')
      .update({
        sent_at: outcome.done ? new Date().toISOString() : null,
        attempts: alert.attempts + 1,
        last_error: outcome.error,
      })
      .eq('id', alert.id)
    if (outcome.done && !outcome.error) sent += 1
    else if (outcome.error && outcome.error !== 'no_tokens') failed += 1
  }

  // Phones and browsers that said they no longer exist are forgotten.
  if (dead.size > 0)
    await supabase
      .from('push_tokens')
      .delete()
      .in('id', [...dead])

  return json(200, { sent, failed })
})
