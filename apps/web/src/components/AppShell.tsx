import {
  ClipboardList,
  Ellipsis,
  History,
  House,
  LogOut,
  Receipt,
  Scale,
  ShoppingCart,
  Tags,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import { HOME_PATH, NAV, startPath, type NavItem } from '../app/roles'
import { useAuth } from '../features/auth/AuthProvider'
import { LanguageSwitch } from './LanguageSwitch'
import { OfflineBanner } from './OfflineBanner'
import { RoleChip } from './RoleChip'

const ICONS: Record<NavItem['icon'], LucideIcon> = {
  home: House,
  cart: ShoppingCart,
  list: ClipboardList,
  wallet: Wallet,
  tags: Tags,
  receipt: Receipt,
  scale: Scale,
  more: Ellipsis,
  truck: Truck,
  history: History,
}

/**
 * Frame around every signed-in screen: a slim top bar (who is signed in, language, sign out) and the
 * role's navigation at the bottom. The active tab opens into a green pill with its name; the others
 * show an icon, and still carry their name for screen readers.
 */
export function AppShell() {
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  if (!profile) return null
  // The admin order screens have their own headers (greeting, back button, status).
  const ownHeader = pathname === '/admin/orders' || pathname.startsWith('/admin/orders/')
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

      <nav
        aria-label="Main"
        className="fixed bottom-0 left-1/2 z-10 flex w-full max-w-[30rem] -translate-x-1/2 items-center justify-between gap-1 border-t border-line bg-paper px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-6px_20px_rgba(15,26,20,0.05)]"
      >
        {items.map((item) => {
          const Icon = ICONS[item.icon]
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === HOME_PATH[profile.role]}
              className={({ isActive }) =>
                'flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold no-underline ' +
                (isActive ? 'flex-[2.2] bg-brand-soft text-brand-dark' : 'flex-1 text-mute')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} aria-hidden="true" />
                  <span className={isActive ? 'truncate' : 'sr-only'}>
                    {t(`nav.${item.labelKey}`)}
                  </span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
