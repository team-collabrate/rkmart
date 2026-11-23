import { ArrowRight, ChevronRight, LogOut, Repeat, ShoppingCart, Tag, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { BrandLogo } from '../../components/BrandLogo'
import { LanguageSwitch } from '../../components/LanguageSwitch'
import { Banner } from '../../components/ui'
import { useShopApi } from '../../data/apiContext'
import { formatDay, todayISO } from '../../lib/dates'
import { formatINR, formatRupees } from '../../lib/money'
import { errorText } from '../admin/queries'
import { AlertsCard } from '../alerts/AlertsCard'
import { useAuth } from '../auth/AuthProvider'
import type { Language } from '../auth/types'
import { OrderStatusPill } from './OrderStatusPill'
import { useCatalog, useMyOrders } from './queries'
import { useMyStatement } from './statementQuery'
import { useRepeatOrder } from './useRepeatOrder'

// Built to stay still, like the admin pages: fixed heights, one line per element, no animation.
// Designed in Figma first ("Shop / Home v2"). The full sentences are kept as screen-reader text.

const CARD = 'rounded-[1.75rem] border border-line bg-paper'

/** The shop owner's start screen: today's rates, money due, the last order and recent orders. */
export function ShopHome() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const { profile, signOut } = useAuth()
  const api = useShopApi()
  const today = todayISO()
  const catalog = useCatalog(today)
  const orders = useMyOrders()
  const statement = useMyStatement()
  const repeat = useRepeatOrder()

  const name = profile?.fullName ?? ''
  const loading = catalog.isPending || orders.isPending
  const failure = catalog.isError ? catalog.error : orders.isError ? orders.error : null
  const ready = catalog.data?.length ?? 0
  const last = orders.data?.[0]
  const recent = (orders.data ?? []).slice(0, 3)
  const due = statement.data && statement.data.balance > 0 ? statement.data.balance : 0

  return (
    <section className="-mx-4 -mb-28 -mt-2 min-h-[calc(100dvh-4rem)] bg-page pb-40">
      <div className="rounded-b-[2rem] bg-paper px-5 pb-5 pt-5">
        <div className="mb-4 flex h-11 items-center justify-between gap-3">
          <BrandLogo size={44} />
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <button
              type="button"
              onClick={() => void signOut()}
              className="grid size-10 place-items-center rounded-full bg-page"
              aria-label={t('shell.signOut')}
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="flex h-12 items-center gap-3">
          <Avatar name={name || '?'} />
          <h1 className="block h-12 min-w-0 flex-1 truncate text-2xl leading-[3rem]">
            <span className="sr-only">{t('shop.home.greeting', { name })}</span>
            <span aria-hidden="true">{name}</span>
          </h1>
          <span className="w-[6.5rem] shrink-0 truncate rounded-full bg-brand-soft py-1.5 text-center text-sm font-semibold leading-5 text-brand-dark">
            {formatDay(today, language)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4">
        {failure ? (
          <Banner kind="error">{errorText(t, failure)}</Banner>
        ) : loading ? (
          <>
            <div className="h-[10.25rem] rounded-[1.75rem] bg-line" aria-hidden="true" />
            <div className="h-36 rounded-[1.75rem] bg-line" aria-hidden="true" />
          </>
        ) : (
          <>
            {/* Today's rates */}
            {ready > 0 ? (
              <div className="h-[10.25rem] rounded-[1.75rem] bg-brand p-5 text-paper">
                <div className="flex h-12 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-white/20"
                  >
                    <Tag size={22} />
                  </span>
                  <p className="min-w-0 flex-1">
                    <span className="sr-only">{t('shop.home.ratesReady', { count: ready })}</span>
                    <span aria-hidden="true" className="flex items-baseline gap-2">
                      <span className="font-display text-[2.5rem] font-bold leading-none">
                        {ready}
                      </span>
                      <span className="truncate text-sm font-medium text-white/85">
                        {t('shop.home.itemsToday')}
                      </span>
                    </span>
                  </p>
                </div>
                <Link
                  to="/shop/order"
                  aria-label={t('shop.home.orderNow')}
                  className="mt-4 flex h-[3.25rem] items-center justify-center gap-2 rounded-full bg-paper font-semibold text-brand-dark no-underline"
                >
                  <ShoppingCart size={20} aria-hidden="true" />
                  <span aria-hidden="true">{t('shop.home.orderNowShort')}</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <div
                className={`${CARD} flex h-24 items-center gap-3 px-5`}
                role="status"
                aria-label={t('shop.home.ratesMissing')}
              >
                <span
                  aria-hidden="true"
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-page text-mute"
                >
                  <Tag size={22} />
                </span>
                <p className="min-w-0 flex-1 truncate font-semibold text-mute" aria-hidden="true">
                  {t('shop.home.ratesWait')}
                </p>
              </div>
            )}

            {/* Money due */}
            {due > 0 && (
              <Link
                to="/shop/payments"
                aria-label={t('shop.payments.homeCard', { amount: formatINR(due) })}
                className="flex h-[4.5rem] items-center gap-3 rounded-[1.75rem] bg-amber-soft px-4 text-amber no-underline"
              >
                <span
                  aria-hidden="true"
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-paper"
                >
                  <Wallet size={22} />
                </span>
                <span className="min-w-0 flex-1" aria-hidden="true">
                  <span className="block truncate font-display text-[1.375rem] font-bold leading-6">
                    ₹{formatRupees(due)}
                  </span>
                  <span className="block truncate text-sm font-medium leading-5">
                    {t('shop.payments.dueShort')}
                  </span>
                </span>
                <ChevronRight size={20} aria-hidden="true" />
              </Link>
            )}

            {/* Last order */}
            {last && (
              <div className={`${CARD} h-36 p-5`}>
                <div className="flex h-7 items-center justify-between gap-3">
                  <h2 className="min-w-0 flex-1 truncate text-lg leading-7">
                    {t('shop.home.lastShort')}
                  </h2>
                  <OrderStatusPill status={last.status} />
                </div>
                <p className="mt-1 h-6 truncate text-mute">
                  {formatDay(last.orderDate, language)} ·{' '}
                  {t('shop.orders.items', { count: last.itemCount })} · ₹{formatRupees(last.total)}
                </p>
                <button
                  type="button"
                  className="btn btn-outline mt-3 h-11 w-full rounded-full"
                  aria-label={t('shop.home.repeat')}
                  onClick={() => void api.getOrder(last.id).then(repeat)}
                >
                  <Repeat size={18} aria-hidden="true" />
                  <span aria-hidden="true">{t('shop.home.repeatShort')}</span>
                </button>
              </div>
            )}

            {/* Recent orders */}
            <div>
              <div className="mb-2 flex h-6 items-center justify-between px-1">
                <h2 className="min-w-0 truncate text-lg leading-6">{t('shop.home.recent')}</h2>
                {recent.length > 0 && (
                  <Link
                    to="/shop/orders"
                    aria-label={t('shop.home.viewAll')}
                    className="flex items-center gap-0.5 text-sm font-semibold text-brand-dark no-underline"
                  >
                    <span aria-hidden="true">{t('shop.order.all')}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                )}
              </div>
              {recent.length === 0 ? (
                <p className={`${CARD} flex h-20 items-center px-5 text-mute`}>
                  <span className="truncate">{t('shop.home.noOrders')}</span>
                </p>
              ) : (
                <ul className={`${CARD} divide-y divide-line overflow-hidden`}>
                  {recent.map((o) => (
                    <li key={o.id}>
                      <Link
                        to={`/shop/orders/${o.id}`}
                        className="flex h-[4.25rem] items-center gap-3 px-5 no-underline"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="h-6 truncate font-semibold leading-6">
                            {formatDay(o.orderDate, language)}
                          </p>
                          <p className="h-5 truncate text-sm leading-5 text-mute">
                            {t('shop.orders.items', { count: o.itemCount })} · ₹
                            {formatRupees(o.total)}
                          </p>
                        </div>
                        <OrderStatusPill status={o.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <AlertsCard />
          </>
        )}
      </div>
    </section>
  )
}
