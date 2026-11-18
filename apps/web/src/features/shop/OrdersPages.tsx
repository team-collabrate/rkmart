import { Repeat } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router'
import { Banner, Empty, Loading, PageHeader } from '../../components/ui'
import { formatDay } from '../../lib/dates'
import { formatINR, formatRupees } from '../../lib/money'
import { displayNames } from '../../lib/names'
import { errorText } from '../admin/queries'
import type { Language } from '../auth/types'
import { formatQty } from './cart'
import { OrderStatusPill } from './OrderStatusPill'
import { useMyOrders, useOrder } from './queries'
import { useRepeatOrder } from './useRepeatOrder'

export function OrdersList() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const orders = useMyOrders()

  return (
    <section>
      <PageHeader title={t('shop.orders.title')} />
      {orders.isPending ? (
        <Loading />
      ) : orders.isError ? (
        <Banner kind="error">{errorText(t, orders.error)}</Banner>
      ) : orders.data.length === 0 ? (
        <Empty>{t('shop.orders.empty')}</Empty>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {orders.data.map((o) => (
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
      )}
    </section>
  )
}

export function OrderDetailPage() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const { id } = useParams()
  const location = useLocation()
  const order = useOrder(id)
  const repeat = useRepeatOrder()
  const justPlaced = Boolean((location.state as { placed?: boolean } | null)?.placed)

  if (order.isPending) return <Loading />
  if (order.isError) return <Banner kind="error">{errorText(t, order.error)}</Banner>
  const o = order.data

  return (
    <section className="max-w-2xl">
      <PageHeader
        title={t('shop.orders.detailTitle', { date: formatDay(o.orderDate, language) })}
        backTo="/shop/orders"
        action={<OrderStatusPill status={o.status} />}
      />

      {justPlaced && (
        <div className="mb-4">
          <Banner kind="success">{t('shop.orders.placed')}</Banner>
        </div>
      )}

      <ul className="mb-4 divide-y divide-line rounded-2xl border border-line">
        {o.lines.map((line) => {
          const names = displayNames(line.nameEn, line.nameTa, language)
          return (
            <li key={line.productId} className="flex items-start justify-between gap-3 px-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold">{names.primary}</p>
                <p className="text-sm text-mute">
                  {t('shop.orders.line', {
                    qty: formatQty(line.qty),
                    unit: line.unit,
                    rate: formatRupees(line.rate),
                  })}
                </p>
              </div>
              <p className="whitespace-nowrap font-bold">₹{formatINR(line.qty * line.rate)}</p>
            </li>
          )
        })}
      </ul>

      <div className="mb-4 flex items-baseline justify-between border-t-2 border-line pt-3">
        <span className="font-semibold">{t('shop.orders.total')}</span>
        <span className="font-display text-2xl font-bold">₹{formatINR(o.total)}</span>
      </div>
      <p className="mb-4 text-sm text-mute">{t('shop.review.totalNote')}</p>

      {o.note && (
        <p className="mb-4 rounded-2xl border-2 border-dashed border-ink px-3 py-2">
          <span className="font-semibold">{t('shop.orders.note')}: </span>
          {o.note}
        </p>
      )}

      <button type="button" className="btn btn-outline" onClick={() => repeat(o)}>
        <Repeat size={18} aria-hidden="true" />
        {t('shop.orders.repeatThis')}
      </button>
    </section>
  )
}
