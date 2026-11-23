export type UserRole = 'admin' | 'distributor' | 'shop'
export type Language = 'en' | 'ta'

export interface Profile {
  id: string
  role: UserRole
  shopId: string | null
  fullName: string
  phone: string
  language: Language
}

export type SignInError =
  'invalid_credentials' | 'inactive' | 'locked' | 'network' | 'not_configured' | 'unknown'

export type SignInResult = { ok: true; profile: Profile } | { ok: false; error: SignInError }

/** Everything the app needs from login. Implemented by Supabase, and by a demo mode for development. */
export interface AuthService {
  /** The signed-in profile restored from storage, or null. */
  getSession(): Promise<Profile | null>
  signIn(phone: string, password: string): Promise<SignInResult>
  signOut(): Promise<void>
  /** Saves the user's language choice to their profile. Failures are ignored (the switch still works). */
  saveLanguage(profileId: string, language: Language): Promise<void>
  /** Called when the session ends elsewhere (expired, signed out in another tab). Returns an unsubscribe function. */
  onSignedOut(callback: () => void): () => void
}
