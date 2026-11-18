import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, FilePlus2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
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

      <div
        role="group"
        aria-label={t('admin.orders.title')}
        className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={
              'min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold ' +
              (filter === f ? 'border-brand bg-brand text-paper' : 'border-line bg-paper text-ink')
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
          className="btn mb-4 w-full"
          onClick={() => setAsking(true)}
          disabled={working}
        >
          <FilePlus2 size={20} aria-hidden="true" />
          {working
            ? t('admin.orders.billAllWorking')
            : t('admin.orders.billAll', { count: newOnes.length })}
        </button>
      )}
      {asking && (
        <div className="mb-4 rounded-3xl border border-brand bg-brand-soft p-4">
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
        <ul className="flex flex-col gap-3">
          {shown.map((o) => (
            <OrderRow key={o.id} order={o} language={language} />
          ))}
        </ul>
      )}
      <p className="mt-4 text-center text-sm text-mute">{t('admin.orders.refreshed')}</p>
    </section>
  )
}

function OrderRow({ order: o, language }: { order: AdminOrderSummary; language: Language }) {
  const { t } = useTranslation()
  const names = displayNames(o.shopNameEn, o.shopNameTa, language)
  return (
    <li>
      <Link
        to={`/admin/orders/${o.id}`}
        className="block rounded-3xl border border-line bg-paper p-4 no-underline shadow-[0_1px_2px_rgba(15,26,20,0.04)]"
      >
        <div className="flex items-center gap-3">
          <Avatar name={o.shopNameEn} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{names.primary}</p>
            {names.secondary && <p className="truncate text-sm text-mute">{names.secondary}</p>}
          </div>
          <OrderStatusPill status={o.status} />
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-mute">
              {formatTime(o.createdAt, language)} ·{' '}
              {t('admin.orders.items', { count: o.itemCount })}
            </p>
            <p className="font-display text-xl font-bold">₹{formatINR(o.total)}</p>
            {o.invoiceNo && <p className="text-xs font-semibold text-brand-dark">{o.invoiceNo}</p>}
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-3.5 py-2 text-sm font-semibold text-brand-dark">
            {t('admin.orders.open')}
            <ChevronRight size={16} aria-hidden="true" />
          </span>
        </div>
      </Link>
    </li>
  )
}
