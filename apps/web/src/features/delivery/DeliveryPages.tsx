import { useQuery } from '@tanstack/react-query'
import { MapPin, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../../components/Avatar'
import { PhonePage, SkeletonRows } from '../../components/PhonePage'
import { Banner } from '../../components/ui'
import { useDeliveryApi } from '../../data/apiContext'
import type { DeliveryItem } from '../../data/deliveryApi'
import { formatDay, formatTime, todayISO } from '../../lib/dates'
import { formatINR, formatRupees } from '../../lib/money'
import { displayNames } from '../../lib/names'
import { errorText } from '../admin/queries'
import type { Language } from '../auth/types'
import { MarkDeliveredPanel } from './MarkDeliveredPanel'

// Built to stay still, like the shop and admin pages: fixed heights, one line per element, no
// animation. The cards follow the shop screens' design (white rounded cards on a grey page).

const CARD = 'rounded-[1.75rem] border border-line bg-paper'

function useDeliveries() {
  const api = useDeliveryApi()
  return useQuery({
    queryKey: ['deliveries'],
    queryFn: () => api.listDeliveries(),
    refetchInterval: 30_000,
  })
}

function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-2 flex h-6 items-center justify-between px-1">
      <h2 className="min-w-0 truncate text-lg leading-6">{title}</h2>
      {count !== undefined && <span className="text-sm font-semibold text-mute">{count}</span>}
    </div>
  )
}

/** One bill to deliver: where it goes, how much it is, and the mark-delivered button. */
function DeliveryCard({ item, language }: { item: DeliveryItem; language: Language }) {
  const { t } = useTranslation()
  const names = displayNames(item.shopNameEn, item.shopNameTa, language)
  return (
    <li className={`${CARD} p-4`}>
      <div className="flex h-11 items-center gap-3">
        <Avatar name={item.shopNameEn} />
        <div className="min-w-0 flex-1">
          <p className="h-6 truncate text-[1.0625rem] font-semibold leading-6">{names.primary}</p>
          <p className="h-5 truncate text-sm leading-5 text-mute">
            {t('delivery.bill', { no: item.invoiceNo })}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="sr-only">{t('delivery.amount')}</span>
          <p className="font-display text-xl font-bold">₹{formatINR(item.amount)}</p>
        </div>
      </div>
      <p className="mt-3 flex h-6 items-center gap-2">
        <MapPin size={18} className="shrink-0 text-mute" aria-hidden="true" />
        <span className="truncate">{item.address}</span>
      </p>
      {item.phone ? (
        <a
          href={`tel:${item.phone}`}
          className="mt-2 flex h-10 items-center gap-2 rounded-full bg-page px-4 font-semibold text-brand-dark no-underline"
        >
          <Phone size={18} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{t('delivery.call', { phone: item.phone })}</span>
        </a>
      ) : (
        <div className="mt-2 h-10" aria-hidden="true" />
      )}
      <div className="mt-3">
        <MarkDeliveredPanel orderId={item.orderId} />
      </div>
    </li>
  )
}

function DoneRow({ d, language }: { d: DeliveryItem; language: Language }) {
  const { t } = useTranslation()
  return (
    <li className="flex h-[4.25rem] items-center gap-3 px-5">
      <div className="min-w-0 flex-1">
        <p className="h-6 truncate font-semibold leading-6">
          {displayNames(d.shopNameEn, d.shopNameTa, language).primary}
        </p>
        <p className="h-5 truncate text-sm leading-5 text-mute">
          {d.invoiceNo}
          {d.deliveredAt &&
            ` · ${t('delivery.deliveredAt', { time: formatTime(d.deliveredAt, language) })}`}
        </p>
      </div>
      <p className="shrink-0 font-bold">₹{formatRupees(d.amount)}</p>
    </li>
  )
}

/** The delivery person's start screen: what to take out, and what was already delivered today. */
export function DeliveriesPage() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const list = useDeliveries()

  const todo = (list.data ?? []).filter((d) => d.status === 'billed')
  const today = todayISO()
  const doneToday = (list.data ?? []).filter(
    (d) =>
      d.status === 'delivered' &&
      d.deliveredAt !== null &&
      todayISO(new Date(d.deliveredAt)) === today,
  )

  return (
    <PhonePage title={t('pages.delivery.home')}>
      {list.isPending ? (
        <SkeletonRows count={2} height="h-[13rem]" />
      ) : list.isError ? (
        <Banner kind="error">{errorText(t, list.error)}</Banner>
      ) : (
        <>
          {todo.length === 0 ? (
            <p className={`${CARD} flex h-20 items-center px-5 text-mute`}>
              <span className="truncate">{t('delivery.empty')}</span>
            </p>
          ) : (
            <div>
              <SectionTitle title={t('delivery.toDeliver', { count: todo.length })} />
              <ul className="flex flex-col gap-4">
                {todo.map((d) => (
                  <DeliveryCard key={d.orderId} item={d} language={language} />
                ))}
              </ul>
            </div>
          )}

          {doneToday.length > 0 && (
            <div>
              <SectionTitle title={t('delivery.done', { count: doneToday.length })} />
              <ul className={`${CARD} divide-y divide-line overflow-hidden`}>
                {doneToday.map((d) => (
                  <DoneRow key={d.orderId} d={d} language={language} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </PhonePage>
  )
}

/** Deliveries of the last 7 days, newest day first. */
export function DeliveryHistoryPage() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const list = useDeliveries()

  const delivered = (list.data ?? []).filter((d) => d.status === 'delivered')
  const days = [...new Set(delivered.map((d) => d.orderDate))].sort().reverse()

  return (
    <PhonePage title={t('delivery.historyTitle')}>
      {list.isPending ? (
        <SkeletonRows count={4} />
      ) : list.isError ? (
        <Banner kind="error">{errorText(t, list.error)}</Banner>
      ) : days.length === 0 ? (
        <p className={`${CARD} flex h-20 items-center px-5 text-mute`}>
          <span className="truncate">{t('delivery.historyEmpty')}</span>
        </p>
      ) : (
        days.map((day) => (
          <div key={day}>
            <SectionTitle title={formatDay(day, language)} />
            <ul className={`${CARD} divide-y divide-line overflow-hidden`}>
              {delivered
                .filter((d) => d.orderDate === day)
                .map((d) => (
                  <DoneRow key={d.orderId} d={d} language={language} />
                ))}
            </ul>
          </div>
        ))
      )}
    </PhonePage>
  )
}
