import {
  ClipboardList,
  Ellipsis,
  History,
  House,
  Receipt,
  Scale,
  ShoppingCart,
  Tags,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { HOME_PATH, type NavItem } from '../app/roles'
import type { UserRole } from '../features/auth/types'

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
 * A floating glass pill, inset from the screen edges, with one slot per tab. Modelled on the
 * 21st.dev "Floating Nav", "LumaBar" and "Bottom Nav Bar" designs: the active tab's icon sits in a
 * solid green circle and its label turns green. Every slot is the same width and height in every
 * language and nothing slides or animates, so switching tabs or languages never moves anything.
 */
export function BottomNav({ items, role }: { items: NavItem[]; role: UserRole }) {
  const { t } = useTranslation()
  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-[30rem] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <ul className="pointer-events-auto flex h-[4.25rem] items-stretch rounded-[2rem] border border-line bg-paper/90 px-1.5 shadow-[0_10px_30px_rgba(15,26,20,0.14)] backdrop-blur-xl">
        {items.map((item) => {
          const Icon = ICONS[item.icon]
          return (
            <li key={item.to} className="min-w-0 flex-1">
              <NavLink
                to={item.to}
                end={item.to === HOME_PATH[role]}
                className="flex h-full flex-col items-center justify-center gap-0.5 no-underline"
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden="true"
                      className={
                        'grid size-9 place-items-center rounded-full ' +
                        (isActive ? 'bg-brand text-paper' : 'text-mute')
                      }
                    >
                      <Icon size={20} />
                    </span>
                    <span
                      className={
                        'block h-3 w-full truncate px-0.5 text-center text-[0.6875rem] font-semibold leading-3 ' +
                        (isActive ? 'text-brand-dark' : 'text-mute')
                      }
                    >
                      {t(`nav.${item.labelKey}`)}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
