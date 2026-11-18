import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import { NAV, startPath } from '../app/roles'
import { useAuth } from '../features/auth/AuthProvider'
import { BottomNav } from './BottomNav'
import { LanguageSwitch } from './LanguageSwitch'
import { OfflineBanner } from './OfflineBanner'
import { RoleChip } from './RoleChip'

/**
 * Frame around every signed-in screen: a slim top bar (who is signed in, language, sign out) and the
 * role's floating navigation pill at the bottom.
 */
export function AppShell() {
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  if (!profile) return null
  // The admin order screens have their own headers (logo, back button, title).
  const ownHeader = ['/admin/orders', '/admin/balances', '/admin/bills'].some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )
  const items = NAV[profile.role]

  return (
    <div className="flex min-h-dvh flex-col">
      {!ownHeader && (
        <header className="sticky top-0 z-10 bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <NavLink
              to={startPath(profile.role)}
              className="flex min-w-0 flex-1 items-center gap-2.5 no-underline"
            >
              <img src="/logo.svg" alt="" width={36} height={36} className="rounded-2xl" />
              <span className="min-w-0 leading-tight">
                <span className="block truncate font-display text-base font-bold">
                  {t('app.name')}
                </span>
                <span className="block truncate text-xs text-mute">{profile.fullName}</span>
              </span>
            </NavLink>
            <div className="flex shrink-0 items-center gap-2">
              <RoleChip role={profile.role} />
              <LanguageSwitch />
              <button
                type="button"
                onClick={() => void signOut()}
                className="grid size-10 place-items-center rounded-full border border-line bg-paper"
                aria-label={t('shell.signOut')}
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
          <OfflineBanner />
        </header>
      )}

      <main className="flex-1 px-4 pb-28 pt-2">
        <Outlet />
      </main>

      <BottomNav items={items} role={profile.role} />
    </div>
  )
}
