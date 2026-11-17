import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { setLanguage } from '../../i18n'
import { createAuthService } from './createAuthService'
import type { AuthService, Language, Profile, SignInResult } from './types'

type Status = 'loading' | 'signedOut' | 'signedIn'

interface AuthContextValue {
  status: Status
  profile: Profile | null
  signIn: (phone: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
  /** Changes the language now and remembers it on the profile when signed in. */
  changeLanguage: (language: Language) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  children,
  service,
}: {
  children: ReactNode
  service?: AuthService
}) {
  const auth = useMemo(() => service ?? createAuthService(), [service])
  const [status, setStatus] = useState<Status>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)

  const adopt = useCallback((next: Profile | null) => {
    setProfile(next)
    setStatus(next ? 'signedIn' : 'signedOut')
    // A signed-in user's saved language wins over the device default.
    if (next) setLanguage(next.language)
  }, [])

  useEffect(() => {
    let cancelled = false
    void auth.getSession().then((restored) => {
      if (!cancelled) adopt(restored)
    })
    const unsubscribe = auth.onSignedOut(() => {
      if (!cancelled) adopt(null)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [auth, adopt])

  const signIn = useCallback(
    async (phone: string, password: string) => {
      const result = await auth.signIn(phone, password)
      if (result.ok) adopt(result.profile)
      return result
    },
    [auth, adopt],
  )

  const signOut = useCallback(async () => {
    await auth.signOut()
    adopt(null)
  }, [auth, adopt])

  const changeLanguage = useCallback(
    (language: Language) => {
      setLanguage(language)
      if (profile) {
        setProfile({ ...profile, language })
        void auth.saveLanguage(profile.id, language).catch(() => {})
      }
    },
    [auth, profile],
  )

  const value = useMemo(
    () => ({ status, profile, signIn, signOut, changeLanguage }),
    [status, profile, signIn, signOut, changeLanguage],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
