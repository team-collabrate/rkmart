import type { AuthService, Language, Profile } from './types'

// DEMO MODE for development and tests, used only when no Supabase project is configured.
// Never included in a real release: see createAuthService().

export const DEMO_PASSWORD = 'demo-password'

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
    shopId: 'demo-shop-1',
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

  return {
    async getSession() {
      return current
    },

    async signIn(phone, password) {
      await wait()
      const user = DEMO_USERS[phone]
      if (!user || password !== DEMO_PASSWORD) return { ok: false, error: 'invalid_credentials' }
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
