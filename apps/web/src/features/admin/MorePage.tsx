import { Building2, ChevronRight, Package, Store, UsersRound, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PageHeader } from '../../components/ui'
import { AlertsCard } from '../alerts/AlertsCard'

const ITEMS: { to: string; key: string; icon: LucideIcon }[] = [
  { to: '/admin/more/items', key: 'items', icon: Package },
  { to: '/admin/more/shops', key: 'shops', icon: Store },
  { to: '/admin/more/users', key: 'users', icon: UsersRound },
  { to: '/admin/more/settings', key: 'settings', icon: Building2 },
]

/** The admin's setup area: items, shops, logins and company settings. */
export function MorePage() {
  const { t } = useTranslation()
  return (
    <section>
      <PageHeader title={t('admin.more.title')} />
      <ul className="divide-y-2 divide-hair rounded-xl border-2 border-ink">
        {ITEMS.map(({ to, key, icon: Icon }) => (
          <li key={to}>
            <Link to={to} className="flex items-center gap-3 px-3 py-4 no-underline">
              <Icon size={24} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t(`admin.more.${key}`)}</p>
                <p className="text-sm text-mute">{t(`admin.more.${key}Hint`)}</p>
              </div>
              <ChevronRight size={20} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <AlertsCard />
    </section>
  )
}
