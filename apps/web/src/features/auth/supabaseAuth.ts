import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthService, Language, Profile, SignInResult, UserRole } from './types'

interface ProfileRow {
  id: string
  role: UserRole
  shop_id: string | null
  full_name: string
  phone: string
  language: Language
  is_active: boolean
}

const PROFILE_COLUMNS = 'id, role, shop_id, full_name, phone, language, is_active'

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    role: row.role,
    shopId: row.shop_id,
    fullName: row.full_name,
    phone: row.phone,
    language: row.language,
  }
}

export function createSupabaseAuth(client: SupabaseClient): AuthService {
  async function loadProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await client
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle<ProfileRow>()
    // A deactivated or missing profile means no access (the database hides it from us as well).
    if (error || !data || !data.is_active) return null
    return toProfile(data)
  }

  return {
    async getSession() {
      const { data } = await client.auth.getSession()
      const user = data.session?.user
      return user ? loadProfile(user.id) : null
    },

    async signIn(phone, password): Promise<SignInResult> {
      // The sign-in function checks the PIN, counts wrong tries and locks a number after too many.
      let reply
      try {
        reply = await client.functions.invoke<{
          session?: { access_token: string; refresh_token: string }
        }>('sign-in', { body: { phone, pin: password } })
      } catch {
        return { ok: false, error: 'network' }
      }
      if (reply.error || !reply.data?.session) {
        const status = (reply.error as { context?: { status?: number } } | null)?.context?.status
        if (status === 429) return { ok: false, error: 'locked' }
        if (status === 401) return { ok: false, error: 'invalid_credentials' }
        if (status === 403) return { ok: false, error: 'inactive' }
        if (status === 400) return { ok: false, error: 'invalid_credentials' }
        return { ok: false, error: status === undefined ? 'network' : 'unknown' }
      }
      const { data, error } = await client.auth.setSession(reply.data.session)
      if (error || !data.user) return { ok: false, error: 'unknown' }
      const profile = await loadProfile(data.user.id)
      if (!profile) {
        await client.auth.signOut()
        return { ok: false, error: 'inactive' }
      }
      return { ok: true, profile }
    },

    async signOut() {
      await client.auth.signOut()
    },

    async saveLanguage(profileId, language) {
      await client.from('profiles').update({ language }).eq('id', profileId)
    },

    onSignedOut(callback) {
      const { data } = client.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') callback()
      })
      return () => data.subscription.unsubscribe()
    },
  }
}
