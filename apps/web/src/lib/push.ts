import { Capacitor } from '@capacitor/core'
import type { PushPlatform } from '../data/pushApi'

// This phone or browser as a place for alerts. Android uses Firebase (FCM) through Capacitor; a
// browser uses Web Push with a service worker. The token is what the server sends alerts to.

export type PushStatus = 'unsupported' | 'not_configured' | 'denied' | 'off' | 'on'

export interface EnableResult {
  status: PushStatus
  platform?: PushPlatform
  token?: string
}

export interface PushDevice {
  platform: PushPlatform | null
  /** Where things stand, without asking the person for anything. */
  status(): Promise<PushStatus>
  /** Asks permission and registers this device. */
  enable(): Promise<EnableResult>
  /** Turns alerts off here. Gives back the token to forget on the server. */
  disable(): Promise<string | null>
  /** The token this device uses, if alerts are on. */
  currentToken(): string | null
}

const TOKEN_KEY = 'rk.push.token'
export const ANDROID_CHANNEL = 'rk-alerts'

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage can be blocked; alerts still work until the app is closed.
  }
}

/** A browser wants the public VAPID key as bytes, but it is written as base64url text. */
export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// --- Android app (Firebase) -----------------------------------------------------------------

function androidDevice(): PushDevice {
  return {
    platform: 'android',
    currentToken: readToken,

    async status() {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const permission = await PushNotifications.checkPermissions()
      if (permission.receive === 'denied') return 'denied'
      return permission.receive === 'granted' && readToken() ? 'on' : 'off'
    },

    async enable() {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const permission = await PushNotifications.requestPermissions()
      if (permission.receive !== 'granted') return { status: 'denied' }

      try {
        await PushNotifications.createChannel({
          id: ANDROID_CHANNEL,
          name: 'RK alerts',
          description: 'New orders, deliveries and payments',
          importance: 4,
        })
        const token = await new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timeout')), 15_000)
          void PushNotifications.addListener('registration', (t) => {
            clearTimeout(timer)
            resolve(t.value)
          })
          void PushNotifications.addListener('registrationError', (e) => {
            clearTimeout(timer)
            reject(new Error(e.error))
          })
          void PushNotifications.register()
        })
        writeToken(token)
        return { status: 'on', platform: 'android', token }
      } catch {
        // No Firebase file in this build, or Google services are unavailable on the phone.
        return { status: 'not_configured' }
      }
    },

    async disable() {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const token = readToken()
      writeToken(null)
      try {
        await PushNotifications.unregister()
      } catch {
        // Already unregistered.
      }
      return token
    },
  }
}

// --- Browser (Web Push) ---------------------------------------------------------------------

function webDevice(): PushDevice {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  // Demo builds have no push server: a made-up device lets the screens be tried end to end.
  const demo = (import.meta.env.DEV || import.meta.env.VITE_MOCK_AUTH === '1') && !key

  const supported = () =>
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  return {
    platform: 'web',
    currentToken: readToken,

    async status() {
      if (demo) return readToken() ? 'on' : 'off'
      if (!supported()) return 'unsupported'
      if (!key) return 'not_configured'
      if (Notification.permission === 'denied') return 'denied'
      if (Notification.permission !== 'granted' || !readToken()) return 'off'
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      return subscription ? 'on' : 'off'
    },

    async enable() {
      if (demo) {
        const token = `demo-device-${Math.random().toString(36).slice(2, 12)}`
        writeToken(token)
        return { status: 'on', platform: 'web', token }
      }
      if (!supported()) return { status: 'unsupported' }
      if (!key) return { status: 'not_configured' }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return { status: 'denied' }
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key),
          }))
        const token = JSON.stringify(subscription.toJSON())
        writeToken(token)
        return { status: 'on', platform: 'web', token }
      } catch {
        return { status: 'not_configured' }
      }
    },

    async disable() {
      const token = readToken()
      writeToken(null)
      if (!demo && supported()) {
        const registration = await navigator.serviceWorker.getRegistration()
        const subscription = await registration?.pushManager.getSubscription()
        await subscription?.unsubscribe()
      }
      return token
    },
  }
}

/** The right kind of device for where the app is running: the Android app, or a browser. */
export function getPushDevice(): PushDevice {
  return Capacitor.isNativePlatform() ? androidDevice() : webDevice()
}

/**
 * Tells the app when an alert arrives while it is open, or when one is tapped (Android app).
 * In a browser the service worker opens the screen itself. Returns a function that stops listening.
 */
export async function listenForAlerts(handlers: {
  onTap: (url: string) => void
  onReceive: () => void
}): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {}
  const { PushNotifications } = await import('@capacitor/push-notifications')
  const tap = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = (action.notification.data as { url?: unknown } | undefined)?.url
    // Only screens inside the app: a link to anywhere else is ignored.
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) handlers.onTap(url)
  })
  const received = await PushNotifications.addListener('pushNotificationReceived', () =>
    handlers.onReceive(),
  )
  return () => {
    void tap.remove()
    void received.remove()
  }
}
