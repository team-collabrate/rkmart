import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, FilePlus2, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { LanguageSwitch } from '../../components/LanguageSwitch'
import { Banner, Empty, Loading } from '../../components/ui'
import { useAdminApi } from '../../data/apiContext'
import type { AdminOrderSummary } from '../../data/adminOrders'
import type { OrderStatus } from '../../data/shopApi'
import { formatTime, hourInIndia, todayISO } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { displayNames } from '../../lib/names'
import { useAuth } from '../auth/AuthProvider'
import type { Language } from '../auth/types'
import { OrderStatusPill } from '../shop/OrderStatusPill'
import { DayNav } from './DayNav'
import { errorText, useOrders } from './queries'

type Filter = 'all' | OrderStatus

const FILTER_KEY: Record<Filter, string> = {
  all: 'filterAll',
  placed: 'filterPlaced',
  billed: 'filterBilled',
  delivered: 'filterDelivered',
  cancelled: 'filterCancelled',
}

// The three counters at the top, each tinted like its status. They double as filters.
const TILES: { status: OrderStatus; tint: string }[] = [
  { status: 'placed', tint: 'bg-amber-soft text-amber' },
  { status: 'billed', tint: 'bg-blue-soft text-blue' },
  { status: 'delivered', tint: 'bg-brand-soft text-brand-dark' },
]

function greetingKey(hour: number): 'morning' | 'afternoon' | 'evening' {
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
}

/** The day's orders: counters by status, one big button to bill the new ones, one card per order. */
export function OrdersInbox() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const api = useAdminApi()
  const queryClient = useQueryClient()
  const { profile, signOut } = useAuth()
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
  const label = (f: Filter) => t(`admin.orders.${FILTER_KEY[f]}`)

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

  const firstName = (profile?.fullName ?? '').split(/\s+/)[0] ?? ''
  const extraFilters: Filter[] = count('cancelled') > 0 ? ['all', 'cancelled'] : ['all']

  return (
    // Full width, and grey all the way down to the navigation bar.
    <section className="-mx-4 -mb-28 -mt-2 min-h-[calc(100dvh-4rem)] bg-page pb-28">
      <div className="rounded-b-[2rem] bg-paper px-5 pb-4 pt-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-mute">
              {t(`admin.orders.greeting.${greetingKey(hourInIndia())}`, { name: firstName })}
            </p>
            <h1 className="text-[2rem] leading-tight">{t('admin.orders.title')}</h1>
          </div>
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
        <DayNav date={date} onChange={go} />
      </div>

      <div className="px-4 pt-4">
        <div className="mb-4 grid grid-cols-3 gap-2.5">
          {TILES.map(({ status, tint }) => (
            <button
              key={status}
              type="button"
              aria-pressed={filter === status}
              aria-label={`${label(status)} (${count(status)})`}
              onClick={() => setFilter(filter === status ? 'all' : status)}
              className={`rounded-3xl p-4 text-left transition-transform active:scale-95 ${tint} ${
                filter === status ? 'ring-2 ring-current' : ''
              }`}
            >
              <span className="block font-display text-3xl font-bold leading-none">
                {count(status)}
              </span>
              <span className="mt-2 block text-sm font-medium">{label(status)}</span>
            </button>
          ))}
        </div>

        {notice && (
          <div className="mb-4">
            <Banner kind={notice.kind}>{notice.text}</Banner>
          </div>
        )}

        {newOnes.length > 0 && !asking && (
          <button
            type="button"
            className="btn mb-4 w-full rounded-full py-4 text-base"
            onClick={() => setAsking(true)}
            disabled={working}
          >
            <FilePlus2 size={22} aria-hidden="true" />
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

        <div role="group" aria-label={t('admin.orders.title')} className="mb-3 flex gap-2">
          {extraFilters.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={
                'min-h-9 rounded-full px-4 text-sm font-semibold ' +
                (filter === f ? 'bg-ink text-paper' : 'bg-paper text-ink')
              }
            >
              {label(f)} ({count(f)})
            </button>
          ))}
        </div>

        {orders.isPending ? (
          <Loading />
        ) : orders.isError ? (
          <Banner kind="error">{errorText(t, orders.error)}</Banner>
        ) : shown.length === 0 ? (
          <Empty>
            {all.length === 0 ? t('admin.orders.empty') : t('admin.orders.emptyFilter')}
          </Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((o) => (
              <OrderRow key={o.id} order={o} language={language} />
            ))}
          </ul>
        )}
        <p className="mt-4 text-center text-xs text-mute">{t('admin.orders.refreshed')}</p>
      </div>
    </section>
  )
}

function OrderRow({ order: o, language }: { order: AdminOrderSummary; language: Language }) {
  const { t } = useTranslation()
  const names = displayNames(o.shopNameEn, o.shopNameTa, language)
  const meta = [
    names.secondary,
    formatTime(o.createdAt, language),
    t('admin.orders.items', { count: o.itemCount }),
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <li>
      <Link
        to={`/admin/orders/${o.id}`}
        className="block rounded-[1.75rem] border border-line bg-paper p-4 no-underline"
      >
        <div className="flex items-center gap-3">
          <Avatar name={o.shopNameEn} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{names.primary}</p>
            <p className="truncate text-sm text-mute">{meta}</p>
          </div>
          <OrderStatusPill status={o.status} admin />
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-mute">{t('admin.orders.subtotal')}</p>
            <p className="font-display text-2xl font-bold">₹{formatINR(o.total)}</p>
            {o.invoiceNo && <p className="text-xs font-semibold text-brand-dark">{o.invoiceNo}</p>}
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-4 py-2.5 font-semibold text-brand-dark">
            {t('admin.orders.open')}
            <ChevronRight size={18} aria-hidden="true" />
          </span>
        </div>
      </Link>
    </li>
  )
}
