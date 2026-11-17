import { getSupabase, isSupabaseConfigured } from '../../lib/supabase'
import { createMockAuth } from './mockAuth'
import { createSupabaseAuth } from './supabaseAuth'
import type { AuthService } from './types'

/** Demo mode runs only in development, or in a build made with VITE_MOCK_AUTH=1. */
export const demoModeAllowed = import.meta.env.DEV || import.meta.env.VITE_MOCK_AUTH === '1'

export function isDemoMode(): boolean {
  return !isSupabaseConfigured() && demoModeAllowed
}

/** A real release with no Supabase configured must not sign anyone in. */
const notConfigured: AuthService = {
  getSession: async () => null,
  signIn: async () => ({ ok: false, error: 'not_configured' }),
  signOut: async () => {},
  saveLanguage: async () => {},
  onSignedOut: () => () => {},
}

export function createAuthService(): AuthService {
  if (isSupabaseConfigured()) return createSupabaseAuth(getSupabase())
  if (demoModeAllowed) return createMockAuth()
  return notConfigured
}
