import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import type { UserRole } from '../features/auth/types'
import { startPath } from './roles'

export function FullPageLoading() {
  const { t } = useTranslation()
  return (
    <div role="status" className="grid min-h-dvh place-items-center text-mute">
      {t('common.loading')}
    </div>
  )
}

/** Only the given role may see the children. Others are sent to login, or to their own area. */
export function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const { status, profile } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoading />
  if (!profile) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (profile.role !== role) return <Navigate to={startPath(profile.role)} replace />
  return <>{children}</>
}

/** The home address "/": login when signed out, otherwise the user's own starting screen. */
export function RootRedirect() {
  const { status, profile } = useAuth()
  if (status === 'loading') return <FullPageLoading />
  return <Navigate to={profile ? startPath(profile.role) : '/login'} replace />
}
