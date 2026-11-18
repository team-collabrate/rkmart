import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Clock, FilePlus2, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { BrandLogo } from '../../components/BrandLogo'
import { LanguageSwitch } from '../../components/LanguageSwitch'
import { Banner, Empty } from '../../components/ui'
import { useAdminApi } from '../../data/apiContext'
import type { AdminOrderSummary } from '../../data/adminOrders'
import type { OrderStatus } from '../../data/shopApi'
import { formatTime, hourInIndia, todayISO } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { displayNames } from '../../lib/names'
import { useAuth } from '../auth/AuthProvider'
import type { Language } from '../auth/types'
import { emojiFor } from '../shop/itemVisual'
import { OrderStatusPill } from '../shop/OrderStatusPill'
import { DayNav } from './DayNav'
import { errorText, useOrders } from './queries'

// This screen is built to stay still: every block has a fixed height, every line of text is one
// line (cut with "…" if it is too long), nothing animates, and a loading screen keeps the same
// shape as the finished one. So switching English and Tamil, or loading, never moves anything.

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

/** The day's orders: counters by status, one button to bill the new ones, one card per order. */
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

  const loading = orders.isPending
  const all = orders.data ?? []
  const count = (f: Filter) => (f === 'all' ? all.length : all.filter((o) => o.status === f).length)
  const shown = filter === 'all' ? all : all.filter((o) => o.status === filter)
  const newOnes = all.filter((o) => o.status === 'placed')
  const label = (f: Filter) => t(`admin.orders.${FILTER_KEY[f]}`)
  const num = (f: Filter) => (loading ? '–' : String(count(f)))

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
        <div className="mb-4 flex h-11 items-center justify-between gap-3">
          <BrandLogo size={44} />
          <div className="flex items-center gap-2">
            <LanguageSwitch compact />
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
        <p className="h-5 truncate text-sm leading-5 text-mute">
          {t(`admin.orders.greeting.${greetingKey(hourInIndia())}`, { name: firstName })}
        </p>
        <h1 className="mb-4 h-10 truncate text-[2rem] leading-10">{t('admin.orders.title')}</h1>
        <DayNav date={date} onChange={go} />
      </div>

      <div className="px-4 pt-4">
        <div className="mb-4 grid grid-cols-3 gap-2.5">
          {TILES.map(({ status, tint }) => (
            <button
              key={status}
              type="button"
              aria-pressed={filter === status}
              aria-label={`${label(status)} (${loading ? 0 : count(status)})`}
              onClick={() => setFilter(filter === status ? 'all' : status)}
              className={`flex h-[5.25rem] flex-col justify-between rounded-3xl p-3.5 text-left ${tint} ${
                filter === status ? 'ring-2 ring-current' : ''
              }`}
            >
              <span className="block h-9 font-display text-3xl font-bold leading-9">
                {num(status)}
              </span>
              <span className="block w-full truncate text-sm font-medium leading-5">
                {label(status)}
              </span>
            </button>
          ))}
        </div>

        {notice && (
          <div className="mb-4">
            <Banner kind={notice.kind}>{notice.text}</Banner>
          </div>
        )}

        {asking ? (
          <div className="mb-4 rounded-3xl border border-brand bg-brand-soft p-4">
            <p className="mb-3 font-medium">
              {t('admin.orders.billAllAsk', { count: newOnes.length })}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn flex-1" onClick={() => void billAll()}>
                {t('admin.orders.billAllConfirm')}
              </button>
              <button
                type="button"
                className="btn btn-outline flex-1"
                onClick={() => setAsking(false)}
              >
                {t('admin.orders.billAllCancel')}
              </button>
            </div>
          </div>
        ) : (
          newOnes.length > 0 && (
            <button
              type="button"
              className="btn mb-4 h-14 w-full rounded-full text-base"
              onClick={() => setAsking(true)}
              disabled={working}
            >
              <FilePlus2 size={22} aria-hidden="true" className="shrink-0" />
              <span className="truncate">
                {working
                  ? t('admin.orders.billAllWorking')
                  : t('admin.orders.billAll', { count: newOnes.length })}
              </span>
            </button>
          )
        )}

        <div role="group" aria-label={t('admin.orders.title')} className="mb-3 flex gap-2">
          {extraFilters.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={
                'h-9 rounded-full px-4 text-sm font-semibold ' +
                (filter === f ? 'bg-ink text-paper' : 'bg-paper text-ink')
              }
            >
              {label(f)} ({loading ? 0 : count(f)})
            </button>
          ))}
        </div>

        {loading ? (
          <ul className="flex flex-col gap-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-[8.25rem] rounded-[1.75rem] border border-line bg-paper" />
            ))}
          </ul>
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
        <p className="mt-4 truncate text-center text-xs text-mute">{t('admin.orders.refreshed')}</p>
      </div>
    </section>
  )
}

/**
 * One order, two lines and no extra words: who and when and its state, then a strip of small
 * pictures of what was ordered, the amount, and an arrow to open it.
 */
function OrderRow({ order: o, language }: { order: AdminOrderSummary; language: Language }) {
  const names = displayNames(o.shopNameEn, o.shopNameTa, language)
  const more = o.itemCount - o.itemNames.length
  return (
    <li>
      <Link
        to={`/admin/orders/${o.id}`}
        className="block h-[8.25rem] rounded-[1.75rem] border border-line bg-paper p-4 no-underline active:bg-page"
      >
        <div className="flex h-11 items-center gap-3">
          <Avatar name={o.shopNameEn} />
          <div className="min-w-0 flex-1">
            <p className="h-6 truncate font-semibold leading-6">{names.primary}</p>
            <p className="flex h-5 items-center gap-1 text-sm leading-5 text-mute">
              <Clock size={13} aria-hidden="true" className="shrink-0" />
              <span className="shrink-0">{formatTime(o.createdAt, language)}</span>
              {o.invoiceNo && (
                <span className="truncate font-semibold text-brand-dark">· {o.invoiceNo}</span>
              )}
            </p>
          </div>
          <OrderStatusPill status={o.status} admin />
        </div>
        <div className="mt-3 flex h-11 items-center gap-3">
          <ul className="flex min-w-0 flex-1 items-center gap-1.5" aria-hidden="true">
            {o.itemNames.map((name) => (
              <li
                key={name}
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-page text-xl"
              >
                {emojiFor(name, '')}
              </li>
            ))}
            {more > 0 && (
              <li className="grid h-10 min-w-10 shrink-0 place-items-center rounded-xl bg-page px-1.5 text-sm font-semibold text-mute">
                +{more}
              </li>
            )}
          </ul>
          <p className="shrink-0 font-display text-xl font-bold leading-7">₹{formatINR(o.total)}</p>
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-dark"
          >
            <ChevronRight size={20} />
          </span>
        </div>
      </Link>
    </li>
  )
}
