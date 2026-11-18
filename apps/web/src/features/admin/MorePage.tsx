import { Building2, ChevronRight, Package, Store, UsersRound, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { TopBar } from '../../components/TopBar'
import { AlertsCard } from '../alerts/AlertsCard'
import { useProducts, useShops, useUsers } from './queries'

// Built to stay still: fixed card sizes, one line per label, no animation.

interface Entry {
  to: string
  key: string
  icon: LucideIcon
  tint: string
  count?: number
}

/** The admin's setup area: items, shops, logins and company settings, each as a big icon card. */
export function MorePage() {
  const { t } = useTranslation()
  const products = useProducts()
  const shops = useShops()
  const users = useUsers()

  const entries: Entry[] = [
    {
      to: '/admin/more/items',
      key: 'items',
      icon: Package,
      tint: 'bg-tint-green',
      count: products.data?.filter((p) => p.isActive).length,
    },
    {
      to: '/admin/more/shops',
      key: 'shops',
      icon: Store,
      tint: 'bg-tint-yellow',
      count: shops.data?.filter((s) => s.isActive).length,
    },
    {
      to: '/admin/more/users',
      key: 'users',
      icon: UsersRound,
      tint: 'bg-tint-blue',
      count: users.data?.filter((u) => u.isActive).length,
    },
    { to: '/admin/more/settings', key: 'settings', icon: Building2, tint: 'bg-tint-lilac' },
  ]

  return (
    <section className="-mx-4 -mb-28 -mt-2 min-h-[calc(100dvh-4rem)] bg-page pb-32">
      <div className="rounded-b-[2rem] bg-paper px-5 pb-5 pt-5">
        <TopBar />
        <h1 className="h-10 truncate text-[2rem] leading-10">{t('admin.more.title')}</h1>
      </div>

      <div className="px-4 pt-4">
        <ul className="grid grid-cols-2 gap-3">
          {entries.map(({ to, key, icon: Icon, tint, count }) => (
            <li key={to}>
              <Link
                to={to}
                className="relative flex h-36 flex-col justify-between rounded-[1.75rem] border border-line bg-paper p-4 no-underline active:bg-page"
              >
                <span
                  aria-hidden="true"
                  className={`grid size-12 place-items-center rounded-2xl text-ink ${tint}`}
                >
                  <Icon size={24} />
                </span>
                <span className="block min-w-0">
                  <span className="block h-6 truncate font-semibold leading-6">
                    {t(`admin.more.${key}`)}
                  </span>
                  <span className="sr-only">{t(`admin.more.${key}Hint`)}</span>
                </span>
                {count !== undefined && (
                  <span
                    aria-hidden="true"
                    className="absolute right-4 top-4 font-display text-2xl font-bold leading-8 text-mute"
                  >
                    {count}
                  </span>
                )}
                <ChevronRight
                  size={18}
                  aria-hidden="true"
                  className="absolute bottom-4 right-4 text-mute"
                />
              </Link>
            </li>
          ))}
        </ul>
        <AlertsCard />
      </div>
    </section>
  )
}
