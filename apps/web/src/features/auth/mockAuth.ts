import type { AuthService, Language, Profile } from './types'

// DEMO MODE for development and tests, used only when no Supabase project is configured.
// Never included in a real release: see createAuthService().

export const DEMO_PIN = '1234'

export const DEMO_USERS: Record<string, Profile> = {
  '9000000001': {
    id: 'demo-admin',
    role: 'admin',
    shopId: null,
    fullName: 'RK Owner (demo)',
    phone: '9000000001',
    language: 'en',
  },
  '9200000001': {
    id: 'demo-dist',
    role: 'distributor',
    shopId: null,
    fullName: 'Distributor One (demo)',
    phone: '9200000001',
    language: 'en',
  },
  '9100000001': {
    id: 'demo-shop',
    role: 'shop',
    shopId: 's1',
    fullName: 'Murugan (demo)',
    phone: '9100000001',
    language: 'en',
  },
}

const STORAGE_KEY = 'rk.demo.session'

function readSession(): Profile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}

function writeSession(profile: Profile | null) {
  try {
    if (profile) localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage can be blocked; the demo session then lasts until reload.
  }
}

export function createMockAuth(delayMs = 250): AuthService {
  const wait = () => new Promise((resolve) => setTimeout(resolve, delayMs))
  const listeners = new Set<() => void>()
  let current: Profile | null = readSession()
  // The demo locks a number after 5 wrong tries, like the real sign-in function does.
  const wrong = new Map<string, number>()
  const lockedUntil = new Map<string, number>()

  return {
    async getSession() {
      return current
    },

    async signIn(phone, password) {
      await wait()
      if ((lockedUntil.get(phone) ?? 0) > Date.now()) return { ok: false, error: 'locked' }
      const user = DEMO_USERS[phone]
      if (!user || password !== DEMO_PIN) {
        const count = (wrong.get(phone) ?? 0) + 1
        wrong.set(phone, count)
        if (count >= 5) {
          wrong.delete(phone)
          lockedUntil.set(phone, Date.now() + 15 * 60_000)
          return { ok: false, error: 'locked' }
        }
        return { ok: false, error: 'invalid_credentials' }
      }
      wrong.delete(phone)
      current = { ...user }
      writeSession(current)
      return { ok: true, profile: current }
    },

    async signOut() {
      current = null
      writeSession(null)
      listeners.forEach((callback) => callback())
    },

    async saveLanguage(_profileId: string, language: Language) {
      if (current) {
        current = { ...current, language }
        writeSession(current)
      }
    },

    onSignedOut(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
  }
}
