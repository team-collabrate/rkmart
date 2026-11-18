import { useQuery } from '@tanstack/react-query'
import { MapPin, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Banner, Empty, Loading, PageHeader } from '../../components/ui'
import { useDeliveryApi } from '../../data/apiContext'
import type { DeliveryItem } from '../../data/deliveryApi'
import { formatDay, formatTime, todayISO } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { displayNames } from '../../lib/names'
import { errorText } from '../admin/queries'
import type { Language } from '../auth/types'
import { MarkDeliveredPanel } from './MarkDeliveredPanel'

function useDeliveries() {
  const api = useDeliveryApi()
  return useQuery({
    queryKey: ['deliveries'],
    queryFn: () => api.listDeliveries(),
    refetchInterval: 30_000,
  })
}

/** One bill to deliver: where it goes, how much it is, and the mark-delivered button. */
function DeliveryCard({ item, language }: { item: DeliveryItem; language: Language }) {
  const { t } = useTranslation()
  const names = displayNames(item.shopNameEn, item.shopNameTa, language)
  return (
    <li className="rounded-xl border-2 border-line p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold">{names.primary}</p>
          <p className="text-sm text-mute">{t('delivery.bill', { no: item.invoiceNo })}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-mute">{t('delivery.amount')}</p>
          <p className="font-display text-xl font-bold">₹{formatINR(item.amount)}</p>
        </div>
      </div>
      {item.address && (
        <p className="mt-2 flex items-start gap-2">
          <MapPin size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{item.address}</span>
        </p>
      )}
      {item.phone && (
        <a
          href={`tel:${item.phone}`}
          className="mt-2 inline-flex min-h-11 items-center gap-2 font-semibold"
        >
          <Phone size={18} aria-hidden="true" />
          {t('delivery.call', { phone: item.phone })}
        </a>
      )}
      <div className="mt-3">
        <MarkDeliveredPanel orderId={item.orderId} />
      </div>
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
    <section className="max-w-2xl">
      <PageHeader title={t('pages.delivery.home')} />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <Banner kind="error">{errorText(t, list.error)}</Banner>
      ) : (
        <>
          {todo.length === 0 ? (
            <Empty>{t('delivery.empty')}</Empty>
          ) : (
            <>
              <h2 className="mb-2 text-lg">{t('delivery.toDeliver', { count: todo.length })}</h2>
              <ul className="space-y-3">
                {todo.map((d) => (
                  <DeliveryCard key={d.orderId} item={d} language={language} />
                ))}
              </ul>
            </>
          )}

          {doneToday.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 text-lg">
                {t('delivery.done', { count: doneToday.length })}
              </h2>
              <ul className="divide-y-2 divide-hair rounded-xl border-2 border-line">
                {doneToday.map((d) => (
                  <li key={d.orderId} className="flex items-center justify-between gap-3 px-3 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {displayNames(d.shopNameEn, d.shopNameTa, language).primary}
                      </p>
                      <p className="text-sm text-mute">
                        {d.invoiceNo}
                        {d.deliveredAt &&
                          ` · ${t('delivery.deliveredAt', { time: formatTime(d.deliveredAt, language) })}`}
                      </p>
                    </div>
                    <p className="font-bold">₹{formatINR(d.amount)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
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
    <section className="max-w-2xl">
      <PageHeader title={t('delivery.historyTitle')} />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <Banner kind="error">{errorText(t, list.error)}</Banner>
      ) : days.length === 0 ? (
        <Empty>{t('delivery.historyEmpty')}</Empty>
      ) : (
        days.map((day) => (
          <div key={day} className="mb-5">
            <h2 className="mb-2 text-lg">{formatDay(day, language)}</h2>
            <ul className="divide-y-2 divide-hair rounded-xl border-2 border-line">
              {delivered
                .filter((d) => d.orderDate === day)
                .map((d) => (
                  <li key={d.orderId} className="flex items-center justify-between gap-3 px-3 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {displayNames(d.shopNameEn, d.shopNameTa, language).primary}
                      </p>
                      <p className="text-sm text-mute">
                        {d.invoiceNo}
                        {d.deliveredAt &&
                          ` · ${t('delivery.deliveredAt', { time: formatTime(d.deliveredAt, language) })}`}
                      </p>
                    </div>
                    <p className="font-bold">₹{formatINR(d.amount)}</p>
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
