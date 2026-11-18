import { describe, expect, it } from 'vitest'
import {
  ANDROID_CHANNEL,
  MAX_ATTEMPTS,
  base64url,
  classifyFcmFailure,
  classifyWebPushFailure,
  fcmMessage,
  jwtSigningInput,
  outcomeFor,
  parseServiceAccount,
  parseWebToken,
  pemToBytes,
  webPayload,
  type Alert,
  type SendResult,
} from '../functions/_shared/push.ts'

const alert: Alert = {
  id: 1,
  profile_id: 'p1',
  title: 'New order',
  body: 'Annam Hotel placed an order.',
  url: '/admin/orders/o1',
  attempts: 0,
}
const ok = (tokenId: string): SendResult => ({ tokenId, ok: true })
const fail = (tokenId: string, failure: SendResult['failure']): SendResult => ({
  tokenId,
  ok: false,
  failure,
  error: `err_${failure}`,
})

describe('message shapes', () => {
  it('makes an FCM message that opens the right screen and uses the app channel', () => {
    const { message } = fcmMessage('tok', alert)
    expect(message).toMatchObject({
      token: 'tok',
      notification: { title: 'New order', body: 'Annam Hotel placed an order.' },
      data: { url: '/admin/orders/o1' },
      android: { priority: 'HIGH', notification: { channel_id: ANDROID_CHANNEL } },
    })
  })

  it('makes the payload the browser service worker reads', () => {
    expect(JSON.parse(webPayload(alert))).toEqual({
      title: 'New order',
      body: 'Annam Hotel placed an order.',
      url: '/admin/orders/o1',
    })
  })

  it('keeps Tamil text intact', () => {
    const tamil = { ...alert, title: 'புது ஆர்டர்', body: 'ஆர்டர் போட்டிருக்காங்க.' }
    expect(JSON.parse(webPayload(tamil)).title).toBe('புது ஆர்டர்')
  })
})

describe('browser subscriptions', () => {
  const good = { endpoint: 'https://push.example/abc', keys: { p256dh: 'k', auth: 'a' } }
  it('reads a stored subscription', () => {
    expect(parseWebToken(JSON.stringify(good))).toEqual(good)
  })
  it('refuses anything else, including a non-https endpoint', () => {
    for (const bad of [
      'not json',
      '{}',
      JSON.stringify({ ...good, endpoint: 'http://push.example/abc' }),
      JSON.stringify({ endpoint: good.endpoint, keys: { p256dh: 'k' } }),
      'android-token-123',
    ]) {
      expect(parseWebToken(bad)).toBeNull()
    }
  })
})

describe('what a failure means', () => {
  it('forgets a phone FCM says is gone, retries when busy, gives up on bad credentials', () => {
    expect(classifyFcmFailure(404, '')).toBe('dead_token')
    expect(classifyFcmFailure(400, '{"error":{"status":"UNREGISTERED"}}')).toBe('dead_token')
    expect(classifyFcmFailure(429, '')).toBe('retry')
    expect(classifyFcmFailure(503, '')).toBe('retry')
    expect(classifyFcmFailure(401, '')).toBe('fatal')
    expect(classifyFcmFailure(400, 'bad request')).toBe('fatal')
  })

  it('forgets a browser that unsubscribed, retries when busy', () => {
    expect(classifyWebPushFailure(410)).toBe('dead_token')
    expect(classifyWebPushFailure(404)).toBe('dead_token')
    expect(classifyWebPushFailure(500)).toBe('retry')
    expect(classifyWebPushFailure(400)).toBe('fatal')
  })
})

describe('what to record after sending', () => {
  it('finishes quietly when the person has no phone or browser registered', () => {
    expect(outcomeFor(alert, [])).toEqual({ done: true, error: 'no_tokens', deadTokenIds: [] })
  })

  it('finishes when at least one device got it, and still forgets the dead ones', () => {
    expect(outcomeFor(alert, [ok('a'), fail('b', 'dead_token')])).toEqual({
      done: true,
      error: null,
      deadTokenIds: ['b'],
    })
  })

  it('finishes when every token is dead', () => {
    const o = outcomeFor(alert, [fail('a', 'dead_token'), fail('b', 'dead_token')])
    expect(o).toMatchObject({ done: true, error: 'all_tokens_dead', deadTokenIds: ['a', 'b'] })
  })

  it('tries again later when a failure may pass, until the attempts run out', () => {
    expect(outcomeFor(alert, [fail('a', 'retry')])).toMatchObject({
      done: false,
      error: 'err_retry',
    })
    const last = { ...alert, attempts: MAX_ATTEMPTS - 1 }
    expect(outcomeFor(last, [fail('a', 'retry')])).toMatchObject({ done: true })
  })

  it('does not keep retrying a failure that will not pass', () => {
    expect(outcomeFor(alert, [fail('a', 'fatal')])).toMatchObject({
      done: true,
      error: 'err_fatal',
    })
  })
})

describe('Google sign-in pieces', () => {
  it('encodes base64url without padding or + and /', () => {
    expect(base64url('subjects?_d')).toBe('c3ViamVjdHM_X2Q')
    expect(base64url(new Uint8Array([251, 255, 254]))).toBe('-__-')
  })

  it('builds the part of the token that gets signed', () => {
    const input = jwtSigningInput(
      { client_email: 'sa@p.iam.gserviceaccount.com', private_key: 'k', project_id: 'p' },
      1_000,
    )
    const [header, claims, extra] = input.split('.')
    expect(extra).toBeUndefined()
    const decode = (s: string) => JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')))
    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(decode(claims)).toMatchObject({
      iss: 'sa@p.iam.gserviceaccount.com',
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      iat: 1_000,
      exp: 4_600,
    })
  })

  it('reads the service account secret, or says it is unusable', () => {
    const text = JSON.stringify({ client_email: 'e', private_key: 'k', project_id: 'p', extra: 1 })
    expect(parseServiceAccount(text)).toEqual({
      client_email: 'e',
      private_key: 'k',
      project_id: 'p',
    })
    expect(parseServiceAccount(undefined)).toBeNull()
    expect(parseServiceAccount('nope')).toBeNull()
    expect(parseServiceAccount('{"client_email":"e"}')).toBeNull()
  })

  it('turns a PEM key into bytes', () => {
    const pem = `-----BEGIN PRIVATE KEY-----\n${btoa('abc')}\n-----END PRIVATE KEY-----\n`
    expect([...pemToBytes(pem)]).toEqual([97, 98, 99])
  })
})
