import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Ellipsis,
  Landmark,
  MessageSquareText,
  Plus,
  Receipt,
  Smartphone,
  Trash2,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { Banner, Empty, TextField } from '../../components/ui'
import { TopBar } from '../../components/TopBar'
import { useAdminApi } from '../../data/apiContext'
import {
  PAYMENT_METHODS,
  type PaymentMethod,
  type ShopBalance,
  type StatementEntry,
} from '../../data/payments'
import { formatDay, todayISO } from '../../lib/dates'
import { formatINR, roundPaise } from '../../lib/money'
import { displayNames } from '../../lib/names'
import type { Language } from '../auth/types'
import { balanceText, parseMoney } from './balanceText'
import { errorText } from './queries'

// These screens are built to stay still: fixed heights, one line per element, no animation, grey
// placeholders in the same shape while loading. Words are kept for what needs them; the rest is icons.

const useLanguage = (): Language => (useTranslation().i18n.language === 'ta' ? 'ta' : 'en')

const METHOD_ICON: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  upi: Smartphone,
  bank: Landmark,
  other: Ellipsis,
}

/** A thin bar showing how much of what was billed has been paid. Not animated. */
function PaidBar({ billed, paid }: { billed: number; paid: number }) {
  const percent = billed > 0 ? Math.max(0, Math.min(100, Math.round((paid / billed) * 100))) : 0
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-white/25"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div className="h-full rounded-full bg-paper" style={{ width: `${percent}%` }} />
    </div>
  )
}

/** "Billed ₹x" and "Paid ₹y", each with a small arrow icon. */
function Totals({ billed, paid, light }: { billed: number; paid: number; light?: boolean }) {
  const { t } = useTranslation()
  const tone = light ? 'text-white/85' : 'text-mute'
  const strong = light ? 'font-semibold text-paper' : 'font-semibold text-ink'
  return (
    <div className="flex h-5 items-center justify-between text-sm">
      <span className={`flex min-w-0 items-center gap-1.5 whitespace-nowrap ${tone}`}>
        <ArrowUpRight size={16} aria-hidden="true" />
        {t('admin.pay.billed')} <span className={strong}>₹{formatINR(billed)}</span>
      </span>
      <span className={`flex min-w-0 items-center gap-1.5 whitespace-nowrap ${tone}`}>
        <ArrowDownLeft size={16} aria-hidden="true" />
        {t('admin.pay.paid')} <span className={strong}>₹{formatINR(paid)}</span>
      </span>
    </div>
  )
}

/** What each shop owes, biggest first. Tap a shop for its statement and to record a payment. */
export function BalancesPage() {
  const { t } = useTranslation()
  const language = useLanguage()
  const api = useAdminApi()
  const list = useQuery({ queryKey: ['balances'], queryFn: () => api.listBalances() })

  const data = list.data ?? []
  const owed = roundPaise(data.reduce((sum, s) => sum + (s.balance > 0 ? s.balance : 0), 0))
  const billed = roundPaise(data.reduce((sum, s) => sum + s.invoiced, 0))
  const paid = roundPaise(data.reduce((sum, s) => sum + s.paid, 0))
  const loading = list.isPending

  return (
    <section className="-mx-4 -mb-28 -mt-2 min-h-[calc(100dvh-4rem)] bg-page pb-28">
      <div className="rounded-b-[2rem] bg-paper px-5 pb-5 pt-5">
        <TopBar />
        <h1 className="h-10 truncate text-[2rem] leading-10">{t('admin.pay.title')}</h1>
      </div>

      <div className="px-4 pt-4">
        {list.isError ? (
          <Banner kind="error">{errorText(t, list.error)}</Banner>
        ) : !loading && data.length === 0 ? (
          <Empty>{t('admin.pay.empty')}</Empty>
        ) : (
          <>
            <div className="mb-4 rounded-[1.75rem] bg-brand p-5 text-paper">
              <div className="mb-3 flex h-14 items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="h-5 truncate text-sm leading-5 text-white/85">
                    {t('admin.pay.toCollect')}
                  </p>
                  <p className="h-9 truncate font-display text-[2rem] font-bold leading-9">
                    {loading ? '–' : `₹${formatINR(owed)}`}
                  </p>
                  {!loading && (
                    <span className="sr-only">
                      {t('admin.pay.totalOwed', { amount: formatINR(owed) })}
                    </span>
                  )}
                </div>
                <span
                  aria-hidden="true"
                  className="grid size-14 shrink-0 place-items-center rounded-3xl bg-white/20"
                >
                  <Wallet size={28} />
                </span>
              </div>
              <PaidBar billed={billed} paid={paid} />
              <div className="mt-3">
                <Totals billed={billed} paid={paid} light />
              </div>
            </div>

            {loading ? (
              <ul className="flex flex-col gap-2.5" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i} className="h-[4.5rem] rounded-3xl border border-line bg-paper" />
                ))}
              </ul>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {data.map((s) => (
                  <BalanceRow key={s.shopId} balance={s} language={language} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function BalanceRow({ balance: s, language }: { balance: ShopBalance; language: Language }) {
  const { t } = useTranslation()
  const names = displayNames(s.nameEn, s.nameTa, language)
  return (
    <li>
      <Link
        to={`/admin/balances/${s.shopId}`}
        className="flex h-[4.5rem] items-center gap-3 rounded-3xl border border-line bg-paper px-3.5 no-underline active:bg-page"
      >
        <Avatar name={s.nameEn} tone={s.balance > 0 ? 'amber' : 'green'} />
        <div className="min-w-0 flex-1">
          <p className="h-6 truncate font-semibold leading-6">{names.primary}</p>
          <p className="flex h-5 items-center gap-1 text-sm leading-5 text-mute">
            <CalendarCheck size={13} aria-hidden="true" className="shrink-0" />
            <span className="truncate">
              {s.lastPaymentOn ? formatDay(s.lastPaymentOn, language) : '—'}
            </span>
          </p>
        </div>
        {/* The words are for screen readers; sighted people get the amount or a tick. */}
        <span className="sr-only">{balanceText(t, s.balance)}</span>
        {s.balance > 0 ? (
          <span aria-hidden="true" className="shrink-0 font-display text-lg font-bold text-amber">
            ₹{formatINR(s.balance)}
          </span>
        ) : s.balance < 0 ? (
          <span
            aria-hidden="true"
            className="shrink-0 font-display text-lg font-bold text-brand-dark"
          >
            ₹{formatINR(-s.balance)}
          </span>
        ) : (
          <CircleCheck size={24} aria-hidden="true" className="shrink-0 text-brand" />
        )}
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-page text-mute"
        >
          <ChevronRight size={18} />
        </span>
      </Link>
    </li>
  )
}

/** One shop: what it owes, a payment button and form, and every bill and payment so far. */
export function ShopStatementPage() {
  const { t } = useTranslation()
  const language = useLanguage()
  const { shopId } = useParams()
  const api = useAdminApi()
  const queryClient = useQueryClient()
  const shops = useQuery({ queryKey: ['shops'], queryFn: () => api.listShops() })
  const statement = useQuery({
    queryKey: ['statement', shopId],
    queryFn: () => api.getShopStatement(shopId!),
    enabled: Boolean(shopId),
  })

  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['statement', shopId] })
    await queryClient.invalidateQueries({ queryKey: ['balances'] })
  }

  const shop = shops.data?.find((s) => s.id === shopId)
  const names = shop ? displayNames(shop.nameEn, shop.nameTa, language) : null
  const s = statement.data
  const loading = statement.isPending || shops.isPending
  const bills = (s?.entries ?? []).filter((e) => e.kind === 'bill')

  return (
    <section className="-mx-4 -mb-28 -mt-2 min-h-[calc(100dvh-4rem)] bg-page px-4 pb-32 pt-4">
      <div className="mb-4 flex h-11 items-center justify-between gap-3">
        <Link
          to="/admin/balances"
          aria-label={t('admin.common.back')}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-paper shadow-[0_1px_2px_rgba(15,26,20,0.08)]"
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-right text-lg leading-7">
          {names?.primary ?? ''}
        </h1>
        {shop && <Avatar name={shop.nameEn} tone={s && s.balance > 0 ? 'amber' : 'green'} />}
      </div>

      {statement.isError ? (
        <Banner kind="error">{errorText(t, statement.error)}</Banner>
      ) : (
        <>
          <div className="mb-4 rounded-[1.75rem] border border-line bg-paper p-5">
            <p className="h-5 text-sm leading-5 text-mute">{t('admin.pay.balanceNow')}</p>
            <p
              className={
                'mb-3 h-10 truncate font-display text-4xl font-bold leading-10 ' +
                (s && s.balance > 0 ? 'text-amber' : 'text-brand-dark')
              }
            >
              {s ? `₹${formatINR(Math.abs(s.balance))}` : '–'}
            </p>
            {s && <span className="sr-only">{balanceText(t, s.balance)}</span>}
            <Totals billed={s?.invoiced ?? 0} paid={s?.paid ?? 0} />
          </div>

          {notice && (
            <div className="mb-4">
              <Banner kind={notice.kind}>{notice.text}</Banner>
            </div>
          )}

          {shopId && (
            <RecordPaymentForm
              shopId={shopId}
              bills={bills}
              onResult={async (result) => {
                setNotice(result)
                if (result.kind === 'success') await refresh()
              }}
            />
          )}

          <h2 className="mb-2 mt-5 h-6 text-base leading-6">{t('admin.pay.entries')}</h2>
          {loading ? (
            <ul
              className="overflow-hidden rounded-[1.75rem] border border-line bg-paper"
              aria-hidden="true"
            >
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-[4.5rem] border-b border-line last:border-b-0" />
              ))}
            </ul>
          ) : s && s.entries.length === 0 ? (
            <Empty>{t('admin.pay.noEntries')}</Empty>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-[1.75rem] border border-line bg-paper">
              {s?.entries.map((e) => (
                <EntryRow
                  key={`${e.kind}-${e.id}`}
                  entry={e}
                  language={language}
                  onResult={async (result) => {
                    setNotice(result)
                    if (result.kind === 'success') await refresh()
                  }}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

type Result = { kind: 'success' | 'error'; text: string }

function RecordPaymentForm({
  shopId,
  bills,
  onResult,
}: {
  shopId: string
  bills: StatementEntry[]
  onResult: (result: Result) => void | Promise<void>
}) {
  const { t } = useTranslation()
  const api = useAdminApi()
  const today = todayISO()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [paidOn, setPaidOn] = useState(today)
  const [invoiceId, setInvoiceId] = useState('')
  const [note, setNote] = useState('')
  const [invalid, setInvalid] = useState(false)

  const save = useMutation({
    mutationFn: (value: number) =>
      api.recordPayment({
        shopId,
        amount: value,
        method,
        paidOn,
        invoiceId: invoiceId || null,
        note,
      }),
    onSuccess: async (_data, value) => {
      setAmount('')
      setNote('')
      setInvoiceId('')
      setPaidOn(today)
      setOpen(false)
      await onResult({ kind: 'success', text: t('admin.pay.saved', { amount: formatINR(value) }) })
    },
    onError: (e) => void onResult({ kind: 'error', text: errorText(t, e) }),
  })

  if (!open) {
    return (
      <button
        type="button"
        className="btn h-14 w-full rounded-full text-base"
        aria-label={t('admin.pay.recordTitle')}
        onClick={() => setOpen(true)}
      >
        <Plus size={22} aria-hidden="true" />
        {t('admin.pay.recordShort')}
      </button>
    )
  }

  const FIELD =
    'flex h-12 items-center gap-2 rounded-2xl border border-line bg-paper px-3 focus-within:border-brand'

  return (
    <form
      className="rounded-[1.75rem] border border-line bg-paper p-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const value = parseMoney(amount)
        if (value === null) {
          setInvalid(true)
          return
        }
        setInvalid(false)
        save.mutate(value)
      }}
    >
      <div className="mb-3 flex h-10 items-center justify-between">
        <h2 className="text-base">{t('admin.pay.recordTitle')}</h2>
        <button
          type="button"
          className="grid size-10 place-items-center rounded-full bg-page"
          aria-label={t('admin.common.back')}
          onClick={() => setOpen(false)}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="mb-3">
        <div className={`${FIELD} h-16`}>
          <span aria-hidden="true" className="font-display text-2xl font-bold text-mute">
            ₹
          </span>
          <input
            inputMode="decimal"
            aria-label={t('admin.pay.amount')}
            placeholder="0"
            value={amount}
            aria-invalid={invalid}
            onChange={(e) => {
              setAmount(e.target.value)
              setInvalid(false)
            }}
            className="min-w-0 flex-1 bg-transparent font-display text-2xl font-bold outline-none"
          />
        </div>
        {invalid && (
          <p role="alert" className="mt-1 text-sm font-semibold">
            {t('admin.pay.badAmount')}
          </p>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label={t('admin.pay.method')}
        className="mb-3 grid grid-cols-4 gap-2"
      >
        {PAYMENT_METHODS.map((m) => {
          const Icon = METHOD_ICON[m]
          const on = method === m
          return (
            <label
              key={m}
              className={
                'flex h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-semibold ' +
                (on ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line text-mute')
              }
            >
              <input
                type="radio"
                name="pay-method"
                value={m}
                checked={on}
                onChange={() => setMethod(m)}
                className="sr-only"
              />
              <Icon size={20} aria-hidden="true" />
              <span className="w-full truncate text-center">{t(`admin.pay.methods.${m}`)}</span>
            </label>
          )
        })}
      </div>

      <div className="mb-3 flex flex-col gap-2">
        <label className={FIELD}>
          <CalendarDays size={18} aria-hidden="true" className="shrink-0 text-mute" />
          <span className="sr-only">{t('admin.pay.date')}</span>
          <input
            type="date"
            max={today}
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        {bills.length > 0 && (
          <label className={FIELD}>
            <Receipt size={18} aria-hidden="true" className="shrink-0 text-mute" />
            <span className="sr-only">{t('admin.pay.forBill')}</span>
            <select
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              className="min-w-0 flex-1 bg-transparent outline-none"
            >
              <option value="">{t('admin.pay.anyBill')}</option>
              {bills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label} · ₹{formatINR(b.amount)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={FIELD}>
          <MessageSquareText size={18} aria-hidden="true" className="shrink-0 text-mute" />
          <span className="sr-only">{t('admin.pay.note')}</span>
          <input
            value={note}
            maxLength={300}
            placeholder={t('admin.pay.note')}
            onChange={(e) => setNote(e.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
      </div>

      <button
        type="submit"
        className="btn h-14 w-full rounded-full text-base"
        disabled={save.isPending}
      >
        {save.isPending ? t('admin.pay.saving') : t('admin.pay.save')}
      </button>
    </form>
  )
}

function EntryRow({
  entry: e,
  language,
  onResult,
}: {
  entry: StatementEntry
  language: Language
  onResult: (result: Result) => void | Promise<void>
}) {
  const { t } = useTranslation()
  const api = useAdminApi()
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')

  const remove = useMutation({
    mutationFn: () => api.voidPayment(e.id, reason),
    onSuccess: async () => {
      setAsking(false)
      setReason('')
      await onResult({ kind: 'success', text: t('admin.pay.removed') })
    },
    onError: (err) => void onResult({ kind: 'error', text: errorText(t, err) }),
  })

  const isPayment = e.kind === 'payment'
  const Icon = isPayment && e.method ? METHOD_ICON[e.method] : Receipt
  const title = isPayment && e.method ? t(`admin.pay.methods.${e.method}`) : e.label
  const sub = [formatDay(e.date, language), e.invoiceNo, e.note].filter(Boolean).join(' · ')

  return (
    <li className="px-3.5">
      <div className="flex h-[4.5rem] items-center gap-3">
        <span
          aria-hidden="true"
          className={
            'grid size-11 shrink-0 place-items-center rounded-full ' +
            (isPayment ? 'bg-brand-soft text-brand-dark' : 'bg-page text-mute')
          }
        >
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="h-6 truncate font-semibold leading-6">{title}</p>
          <p className="h-5 truncate text-sm leading-5 text-mute">{sub}</p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={
              'h-6 font-display text-base font-bold leading-6 ' +
              (isPayment ? 'text-brand-dark' : 'text-ink')
            }
          >
            {isPayment ? '−' : '+'}₹{formatINR(e.amount)}
          </p>
          <p className="h-5 text-xs leading-5 text-mute">₹{formatINR(e.balanceAfter)}</p>
        </div>
        {isPayment && (
          <button
            type="button"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-red-soft text-red"
            aria-label={`${t('admin.pay.remove')} ₹${formatINR(e.amount)}`}
            onClick={() => setAsking((v) => !v)}
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {isPayment && asking && (
        <div className="mb-3 rounded-3xl border border-red p-3">
          <p className="mb-3 text-sm font-medium">
            {t('admin.pay.removeAsk', { amount: formatINR(e.amount) })}
          </p>
          <TextField
            id={`void-${e.id}`}
            label={t('admin.pay.reason')}
            value={reason}
            onChange={setReason}
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn flex-1 !border-red !bg-red"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {t('admin.pay.removeConfirm')}
            </button>
            <button
              type="button"
              className="btn btn-outline flex-1"
              onClick={() => setAsking(false)}
            >
              {t('admin.pay.keep')}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
