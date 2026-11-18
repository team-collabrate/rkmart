import { Repeat, ShoppingCart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Banner, Loading } from '../../components/ui'
import { useShopApi } from '../../data/apiContext'
import { formatDay, todayISO } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { errorText } from '../admin/queries'
import { useAuth } from '../auth/AuthProvider'
import type { Language } from '../auth/types'
import { AlertsCard } from '../alerts/AlertsCard'
import { OrderStatusPill } from './OrderStatusPill'
import { useRepeatOrder } from './useRepeatOrder'
import { useMyStatement } from './statementQuery'
import { useCatalog, useMyOrders } from './queries'

/** The shop owner's start screen: are today's rates ready, the last order, and recent orders. */
export function ShopHome() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const { profile } = useAuth()
  const api = useShopApi()
  const catalog = useCatalog(todayISO())
  const orders = useMyOrders()
  const statement = useMyStatement()
  const repeat = useRepeatOrder()

  if (catalog.isPending || orders.isPending) return <Loading />
  if (catalog.isError || orders.isError) {
    return <Banner kind="error">{errorText(t, catalog.error ?? orders.error)}</Banner>
  }

  const ready = catalog.data.length
  const last = orders.data[0]
  const recent = orders.data.slice(0, 3)

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl">{t('shop.home.greeting', { name: profile?.fullName ?? '' })}</h1>

      {statement.data && statement.data.balance > 0 && (
        <Link
          to="/shop/payments"
          className="mt-4 block rounded-2xl border-2 border-dashed border-ink p-4 no-underline"
        >
          <p className="font-display text-xl font-bold">
            {t('shop.payments.homeCard', { amount: formatINR(statement.data.balance) })}
          </p>
          <p className="text-sm font-semibold underline">{t('shop.payments.homeLink')}</p>
        </Link>
      )}

      <div className="mt-4 rounded-2xl border border-line p-4">
        <p className="font-semibold">
          {ready > 0 ? t('shop.home.ratesReady', { count: ready }) : t('shop.home.ratesMissing')}
        </p>
        {ready > 0 && (
          <Link to="/shop/order" className="btn mt-3 no-underline">
            <ShoppingCart size={18} aria-hidden="true" />
            {t('shop.home.orderNow')}
          </Link>
        )}
      </div>

      {last && (
        <div className="mt-4 rounded-2xl border border-line p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg">{t('shop.home.lastOrder')}</h2>
            <OrderStatusPill status={last.status} />
          </div>
          <p className="mt-1 text-mute">
            {formatDay(last.orderDate, language)} ·{' '}
            {t('shop.orders.items', { count: last.itemCount })} · ₹{formatINR(last.total)}
          </p>
          <button
            type="button"
            className="btn btn-outline mt-3"
            onClick={() => void api.getOrder(last.id).then(repeat)}
          >
            <Repeat size={18} aria-hidden="true" />
            {t('shop.home.repeat')}
          </button>
        </div>
      )}

      <h2 className="mb-2 mt-6 text-lg">{t('shop.home.recent')}</h2>
      {recent.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-ink px-4 py-6 text-mute">
          {t('shop.home.noOrders')}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {recent.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/shop/orders/${o.id}`}
                  className="flex items-center gap-3 px-3 py-3 no-underline"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{formatDay(o.orderDate, language)}</p>
                    <p className="text-sm text-mute">
                      {t('shop.orders.items', { count: o.itemCount })} · ₹{formatINR(o.total)}
                    </p>
                  </div>
                  <OrderStatusPill status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/shop/orders" className="mt-3 inline-block font-semibold">
            {t('shop.home.viewAll')}
          </Link>
        </>
      )}
      <AlertsCard />
    </section>
  )
}
