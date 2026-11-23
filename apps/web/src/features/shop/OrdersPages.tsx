import { Check, MessageSquareText, Repeat } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router'
import { Banner } from '../../components/ui'
import { formatDay } from '../../lib/dates'
import { formatINR, formatRupees } from '../../lib/money'
import { displayNames } from '../../lib/names'
import { errorText } from '../admin/queries'
import type { Language } from '../auth/types'
import { formatQty } from './cart'
import { emojiFor, TINT_BG, tintFor } from './itemVisual'
import { OrderStatusPill } from './OrderStatusPill'
import { useMyOrders, useOrder } from './queries'
import { ShopPage, SkeletonRows } from './ShopPage'
import { useRepeatOrder } from './useRepeatOrder'

// Designed in Figma first ("Shop / My orders", "Shop / Order detail"). Fixed row heights, one line
// per element, no animation.

const CARD = 'rounded-[1.75rem] border border-line bg-paper'

export function OrdersList() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const orders = useMyOrders()

  return (
    <ShopPage title={t('shop.orders.title')}>
      {orders.isPending ? (
        <SkeletonRows count={5} />
      ) : orders.isError ? (
        <Banner kind="error">{errorText(t, orders.error)}</Banner>
      ) : orders.data.length === 0 ? (
        <p className={`${CARD} flex h-20 items-center px-5 text-mute`}>
          <span className="truncate">{t('shop.orders.empty')}</span>
        </p>
      ) : (
        <ul className={`${CARD} divide-y divide-line overflow-hidden`}>
          {orders.data.map((o) => (
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
                    {t('shop.orders.items', { count: o.itemCount })} · ₹{formatRupees(o.total)}
                  </p>
                </div>
                <OrderStatusPill status={o.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ShopPage>
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

  if (order.isPending) {
    return (
      <ShopPage title="" backTo="/shop/orders">
        <SkeletonRows count={3} height="h-[4.5rem]" />
      </ShopPage>
    )
  }
  if (order.isError) {
    return (
      <ShopPage title="" backTo="/shop/orders">
        <Banner kind="error">{errorText(t, order.error)}</Banner>
      </ShopPage>
    )
  }
  const o = order.data
  const day = formatDay(o.orderDate, language)

  return (
    <ShopPage
      title={
        <>
          <span className="sr-only">{t('shop.orders.detailTitle', { date: day })}</span>
          <span aria-hidden="true">{day}</span>
        </>
      }
      backTo="/shop/orders"
      action={<OrderStatusPill status={o.status} />}
    >
      {justPlaced && (
        <div
          role="status"
          className="flex h-[3.25rem] items-center gap-3 rounded-full bg-brand-soft px-4 font-semibold text-brand-dark"
        >
          <Check size={20} aria-hidden="true" className="shrink-0" />
          <span className="sr-only">{t('shop.orders.placed')}</span>
          <span className="truncate" aria-hidden="true">
            {t('shop.orders.placedShort')}
          </span>
        </div>
      )}

      <ul className={`${CARD} divide-y divide-line overflow-hidden`}>
        {o.lines.map((line) => {
          const names = displayNames(line.nameEn, line.nameTa, language)
          return (
            <li key={line.productId} className="flex h-[4.5rem] items-center gap-3 px-3.5">
              <span
                aria-hidden="true"
                className={`grid size-12 shrink-0 place-items-center rounded-2xl text-2xl ${TINT_BG[tintFor(line.nameEn)]}`}
              >
                {emojiFor(line.nameEn, '')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="h-6 truncate font-semibold leading-6">{names.primary}</p>
                <p className="h-5 truncate text-sm leading-5 text-mute">
                  {t('shop.orders.line', {
                    qty: formatQty(line.qty),
                    unit: line.unit,
                    rate: formatRupees(line.rate),
                  })}
                </p>
              </div>
              <p className="shrink-0 font-bold">₹{formatRupees(line.qty * line.rate)}</p>
            </li>
          )
        })}
      </ul>

      <div className={`${CARD} flex h-[4.75rem] items-center justify-between gap-3 px-5`}>
        <span className="sr-only">{t('shop.orders.total')}</span>
        <span className="font-semibold text-mute" aria-hidden="true">
          {t('shop.review.totalShort')}
        </span>
        <span className="font-display text-[1.75rem] font-bold">₹{formatINR(o.total)}</span>
      </div>

      {o.note && (
        <p className={`${CARD} flex h-[3.25rem] items-center gap-3 px-4`}>
          <MessageSquareText size={20} aria-hidden="true" className="shrink-0 text-mute" />
          <span className="sr-only">{t('shop.orders.note')}: </span>
          <span className="truncate">{o.note}</span>
        </p>
      )}

      <button
        type="button"
        className="btn btn-outline h-[3.25rem] w-full rounded-full"
        onClick={() => repeat(o)}
      >
        <Repeat size={18} aria-hidden="true" className="shrink-0" />
        <span className="truncate">{t('shop.orders.repeatThis')}</span>
      </button>
    </ShopPage>
  )
}
