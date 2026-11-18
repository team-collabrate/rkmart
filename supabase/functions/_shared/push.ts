// Pure helpers for the send-push edge function: message shapes, which failures mean a token is dead,
// and what to do with an alert after trying to send it. No network and no Deno APIs here, so the
// tests can run them in Node.

export interface Alert {
  id: number
  profile_id: string
  title: string
  body: string
  url: string
  attempts: number
}

export interface TokenRow {
  id: string
  profile_id: string
  platform: 'android' | 'web'
  token: string
}

export const MAX_ATTEMPTS = 5

/** The Android notification channel the app creates (see lib/push.ts). */
export const ANDROID_CHANNEL = 'rk-alerts'

/** Firebase Cloud Messaging (HTTP v1) message for one Android phone. */
export function fcmMessage(token: string, alert: Alert): { message: Record<string, unknown> } {
  return {
    message: {
      token,
      notification: { title: alert.title, body: alert.body },
      data: { url: alert.url },
      android: { priority: 'HIGH', notification: { channel_id: ANDROID_CHANNEL } },
    },
  }
}

/** What the browser's service worker receives (see public/push-sw.js). */
export function webPayload(alert: Alert): string {
  return JSON.stringify({ title: alert.title, body: alert.body, url: alert.url })
}

export interface WebSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/** A browser's push subscription is stored as JSON text in the token column. */
export function parseWebToken(token: string): WebSubscription | null {
  try {
    const value = JSON.parse(token) as Partial<WebSubscription>
    if (
      typeof value.endpoint === 'string' &&
      value.endpoint.startsWith('https://') &&
      typeof value.keys?.p256dh === 'string' &&
      typeof value.keys?.auth === 'string'
    ) {
      return {
        endpoint: value.endpoint,
        keys: { p256dh: value.keys.p256dh, auth: value.keys.auth },
      }
    }
  } catch {
    // Not JSON: not a browser subscription.
  }
  return null
}

export type Failure = 'dead_token' | 'retry' | 'fatal'

/** FCM says a phone's token is no longer valid with 404 or UNREGISTERED. Busy or broken means try later. */
export function classifyFcmFailure(status: number, bodyText: string): Failure {
  if (status === 404 || /UNREGISTERED/.test(bodyText)) return 'dead_token'
  if (status === 429 || status >= 500) return 'retry'
  if (status === 401 || status === 403) return 'fatal' // our own credentials are wrong
  return 'fatal'
}

/** Browsers answer 404 or 410 when the person removed the subscription. */
export function classifyWebPushFailure(status: number): Failure {
  if (status === 404 || status === 410) return 'dead_token'
  if (status === 429 || status >= 500) return 'retry'
  return 'fatal'
}

export interface SendResult {
  tokenId: string
  ok: boolean
  failure?: Failure
  error?: string
}

export interface Outcome {
  /** True when the alert is finished (sent, or nothing more to try). */
  done: boolean
  error: string | null
  deadTokenIds: string[]
}

/**
 * What to record for an alert after sending it to every token of the person.
 * - No tokens: finished, there is nowhere to send it (the person has not turned alerts on).
 * - At least one phone or browser got it: finished.
 * - Every try failed: try again later, up to MAX_ATTEMPTS, then give up.
 */
export function outcomeFor(alert: Alert, results: SendResult[]): Outcome {
  const deadTokenIds = results.filter((r) => r.failure === 'dead_token').map((r) => r.tokenId)
  if (results.length === 0) return { done: true, error: 'no_tokens', deadTokenIds }
  if (results.some((r) => r.ok)) return { done: true, error: null, deadTokenIds }

  // Only dead tokens: nothing left to send to.
  if (results.every((r) => r.failure === 'dead_token')) {
    return { done: true, error: 'all_tokens_dead', deadTokenIds }
  }
  const error = results.find((r) => !r.ok && r.failure !== 'dead_token')?.error ?? 'failed'
  const retryable = results.some((r) => r.failure === 'retry')
  const giveUp = !retryable || alert.attempts + 1 >= MAX_ATTEMPTS
  return { done: giveUp, error, deadTokenIds }
}

// --- Google sign-in for FCM (the signing itself happens in the function, with Deno's crypto) ----

const encoder = new TextEncoder()

export function base64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export interface ServiceAccount {
  client_email: string
  private_key: string
  project_id: string
}

/** Reads the service account JSON kept in the FCM_SERVICE_ACCOUNT secret. Null if unusable. */
export function parseServiceAccount(text: string | undefined): ServiceAccount | null {
  if (!text) return null
  try {
    const value = JSON.parse(text) as Partial<ServiceAccount>
    if (value.client_email && value.private_key && value.project_id) {
      return {
        client_email: value.client_email,
        private_key: value.private_key,
        project_id: value.project_id,
      }
    }
  } catch {
    // fall through
  }
  return null
}

/** The part of the sign-in token that gets signed: header and claims, both base64url. */
export function jwtSigningInput(account: ServiceAccount, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  )
  return `${header}.${claims}`
}

/** Turns the PEM private key into the raw bytes Deno's crypto wants. */
export function pemToBytes(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const binary = atob(body)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}
