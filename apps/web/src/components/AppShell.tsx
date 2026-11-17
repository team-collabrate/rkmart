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
import { NavLink, Outlet } from 'react-router'
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
 * Frame around every signed-in screen: header, language switch, sign out, and the role's navigation.
 * Navigation sits at the bottom on a phone and on the left on a laptop.
 */
export function AppShell() {
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()
  if (!profile) return null
  const items = NAV[profile.role]

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b-2 border-ink bg-paper pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between gap-3 px-4 py-2">
            <NavLink to={startPath(profile.role)} className="flex items-center gap-2 no-underline">
              <img src="/logo.svg" alt="" width={32} height={32} className="rounded-lg" />
              <span className="hidden whitespace-nowrap font-display text-lg font-bold min-[430px]:inline">
                {t('app.name')}
              </span>
            </NavLink>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline">
                <RoleChip role={profile.role} />
              </span>
              <LanguageSwitch />
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex min-h-9 items-center gap-1.5 rounded-full border-2 border-ink px-3 text-sm font-semibold"
                aria-label={t('shell.signOut')}
              >
                <LogOut size={16} aria-hidden="true" />
                <span className="hidden md:inline">{t('shell.signOut')}</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-hair px-4 py-1 text-sm text-mute sm:hidden">
            <RoleChip role={profile.role} />
            <span className="truncate">{profile.fullName}</span>
          </div>
        </header>

        <OfflineBanner />

        <main className="flex-1 p-4 pb-28 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t-2 border-ink bg-paper pb-[env(safe-area-inset-bottom)] md:static md:order-first md:w-56 md:flex-none md:flex-col md:gap-1 md:border-r-2 md:border-t-0 md:p-3 md:pb-3"
      >
        {items.map((item) => {
          const Icon = ICONS[item.icon]
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === HOME_PATH[profile.role]}
              className={({ isActive }) =>
                'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs font-semibold no-underline md:min-h-11 md:flex-none md:flex-row md:justify-start md:gap-3 md:rounded-xl md:px-3 md:text-base ' +
                (isActive ? 'bg-ink text-paper' : 'text-ink')
              }
            >
              <Icon size={22} aria-hidden="true" />
              <span>{t(`nav.${item.labelKey}`)}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
