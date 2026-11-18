import { useQueryClient } from '@tanstack/react-query'
import { FilePlus2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Banner, Empty, Loading, PageHeader } from '../../components/ui'
import { useAdminApi } from '../../data/apiContext'
import type { AdminOrderSummary } from '../../data/adminOrders'
import type { OrderStatus } from '../../data/shopApi'
import { formatTime, todayISO } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { displayNames } from '../../lib/names'
import type { Language } from '../auth/types'
import { OrderStatusPill } from '../shop/OrderStatusPill'
import { DayNav } from './DayNav'
import { errorText, useOrders } from './queries'

type Filter = 'all' | OrderStatus
const FILTERS: Filter[] = ['all', 'placed', 'billed', 'delivered', 'cancelled']
const FILTER_KEY: Record<Filter, string> = {
  all: 'filterAll',
  placed: 'filterPlaced',
  billed: 'filterBilled',
  delivered: 'filterDelivered',
  cancelled: 'filterCancelled',
}

/** The day's orders: counts by status, one row per order, and one tap to bill all the new ones. */
export function OrdersInbox() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const api = useAdminApi()
  const queryClient = useQueryClient()
  const today = todayISO()

  const [date, setDate] = useState(today)
  const [filter, setFilter] = useState<Filter>('all')
  const [asking, setAsking] = useState(false)
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const orders = useOrders(date)

  const all = orders.data ?? []
  const count = (f: Filter) => (f === 'all' ? all.length : all.filter((o) => o.status === f).length)
  const shown = filter === 'all' ? all : all.filter((o) => o.status === filter)
  const newOnes = all.filter((o) => o.status === 'placed')

  function go(next: string) {
    setDate(next)
    setAsking(false)
    setNotice(null)
  }

  async function billAll() {
    setWorking(true)
    setAsking(false)
    let done = 0
    let failed = 0
    // One at a time, so the bill numbers follow the order of arrival.
    for (const o of [...newOnes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      try {
        await api.generateBill(o.id)
        done += 1
      } catch {
        failed += 1
      }
    }
    await queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-order'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-day-invoices'] })
    setWorking(false)
    setNotice(
      failed === 0
        ? { kind: 'success', text: t('admin.orders.billAllDone', { count: done }) }
        : { kind: 'error', text: t('admin.orders.billAllPartial', { done, failed }) },
    )
  }

  return (
    <section>
      <PageHeader title={t('admin.orders.title')} />

      <DayNav date={date} onChange={go} />

      <div role="group" aria-label={t('admin.orders.title')} className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={
              'min-h-11 rounded-full border-2 border-line px-3 font-semibold ' +
              (filter === f ? 'bg-brand text-paper' : 'bg-paper text-ink')
            }
          >
            {t(`admin.orders.${FILTER_KEY[f]}`)} ({count(f)})
          </button>
        ))}
      </div>

      {notice && (
        <div className="mb-3">
          <Banner kind={notice.kind}>{notice.text}</Banner>
        </div>
      )}

      {newOnes.length > 0 && !asking && (
        <button
          type="button"
          className="btn mb-3"
          onClick={() => setAsking(true)}
          disabled={working}
        >
          <FilePlus2 size={18} aria-hidden="true" />
          {working
            ? t('admin.orders.billAllWorking')
            : t('admin.orders.billAll', { count: newOnes.length })}
        </button>
      )}
      {asking && (
        <div className="mb-3 rounded-xl border-2 border-dashed border-ink p-3">
          <p className="mb-3 font-medium">
            {t('admin.orders.billAllAsk', { count: newOnes.length })}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={() => void billAll()}>
              {t('admin.orders.billAllConfirm')}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setAsking(false)}>
              {t('admin.orders.billAllCancel')}
            </button>
          </div>
        </div>
      )}

      {orders.isPending ? (
        <Loading />
      ) : orders.isError ? (
        <Banner kind="error">{errorText(t, orders.error)}</Banner>
      ) : shown.length === 0 ? (
        <Empty>{all.length === 0 ? t('admin.orders.empty') : t('admin.orders.emptyFilter')}</Empty>
      ) : (
        <ul className="divide-y-2 divide-hair rounded-xl border-2 border-line">
          {shown.map((o) => (
            <OrderRow key={o.id} order={o} language={language} />
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm text-mute">{t('admin.orders.refreshed')}</p>
    </section>
  )
}

function OrderRow({ order: o, language }: { order: AdminOrderSummary; language: Language }) {
  const { t } = useTranslation()
  const names = displayNames(o.shopNameEn, o.shopNameTa, language)
  return (
    <li>
      <Link to={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-3 py-3 no-underline">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{names.primary}</p>
          <p className="text-sm text-mute">
            {formatTime(o.createdAt, language)} · {t('admin.orders.items', { count: o.itemCount })}{' '}
            · ₹{formatINR(o.total)}
          </p>
          {o.invoiceNo && <p className="text-sm font-semibold">{o.invoiceNo}</p>}
        </div>
        <OrderStatusPill status={o.status} />
      </Link>
    </li>
  )
}
