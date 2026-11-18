import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Banner, Empty, Loading, PageHeader, SelectField, TextField } from '../../components/ui'
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

const useLanguage = (): Language => (useTranslation().i18n.language === 'ta' ? 'ta' : 'en')

/** What each shop owes, biggest first. Tap a shop for its statement and to record a payment. */
export function BalancesPage() {
  const { t } = useTranslation()
  const language = useLanguage()
  const api = useAdminApi()
  const list = useQuery({ queryKey: ['balances'], queryFn: () => api.listBalances() })

  const owed = roundPaise(
    (list.data ?? []).reduce((sum, s) => sum + (s.balance > 0 ? s.balance : 0), 0),
  )

  return (
    <section className="max-w-2xl">
      <PageHeader title={t('admin.pay.title')} />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <Banner kind="error">{errorText(t, list.error)}</Banner>
      ) : list.data.length === 0 ? (
        <Empty>{t('admin.pay.empty')}</Empty>
      ) : (
        <>
          <p className="mb-3 font-display text-xl font-bold">
            {t('admin.pay.totalOwed', { amount: formatINR(owed) })}
          </p>
          <ul className="divide-y-2 divide-hair rounded-xl border-2 border-line">
            {list.data.map((s) => (
              <BalanceRow key={s.shopId} balance={s} language={language} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function BalanceRow({ balance: s, language }: { balance: ShopBalance; language: Language }) {
  const { t } = useTranslation()
  return (
    <li>
      <Link
        to={`/admin/balances/${s.shopId}`}
        className="flex items-center gap-3 px-3 py-3 no-underline"
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{displayNames(s.nameEn, s.nameTa, language).primary}</p>
          <p className="text-sm text-mute">
            {s.lastPaymentOn
              ? t('admin.pay.lastPayment', { date: formatDay(s.lastPaymentOn, language) })
              : t('admin.pay.noPayment')}
          </p>
        </div>
        <p className={'text-right font-bold ' + (s.balance > 0 ? '' : 'text-mute')}>
          {balanceText(t, s.balance)}
        </p>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </li>
  )
}

/** One shop: what it owes, the form to record a payment, and every bill and payment so far. */
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

  if (statement.isPending || shops.isPending) return <Loading />
  if (statement.isError) return <Banner kind="error">{errorText(t, statement.error)}</Banner>
  const shop = shops.data?.find((s) => s.id === shopId)
  const s = statement.data
  const bills = s.entries.filter((e) => e.kind === 'bill')

  return (
    <section className="max-w-2xl">
      <PageHeader
        title={shop ? displayNames(shop.nameEn, shop.nameTa, language).primary : ''}
        backTo="/admin/balances"
      />

      <div className="mb-4 rounded-xl border-2 border-line p-4">
        <p className="text-sm text-mute">{t('admin.pay.balanceNow')}</p>
        <p className="font-display text-3xl font-bold">{balanceText(t, s.balance)}</p>
        <p className="mt-1 text-sm text-mute">
          {t('admin.pay.billed')} ₹{formatINR(s.invoiced)} · {t('admin.pay.paid')} ₹
          {formatINR(s.paid)}
        </p>
      </div>

      {notice && (
        <div className="mb-3">
          <Banner kind={notice.kind}>{notice.text}</Banner>
        </div>
      )}

      <RecordPaymentForm
        shopId={shopId!}
        bills={bills}
        onResult={async (result) => {
          setNotice(result)
          if (result.kind === 'success') await refresh()
        }}
      />

      <h2 className="mb-2 mt-6 text-lg">{t('admin.pay.entries')}</h2>
      {s.entries.length === 0 ? (
        <Empty>{t('admin.pay.noEntries')}</Empty>
      ) : (
        <ul className="divide-y-2 divide-hair rounded-xl border-2 border-line">
          {s.entries.map((e) => (
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
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        <Plus size={18} aria-hidden="true" />
        {t('admin.pay.recordTitle')}
      </button>
    )
  }

  return (
    <form
      className="space-y-3 rounded-xl border-2 border-line p-3"
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
      <h2 className="text-lg">{t('admin.pay.recordTitle')}</h2>
      <TextField
        id="pay-amount"
        label={t('admin.pay.amount')}
        value={amount}
        inputMode="decimal"
        onChange={(v) => {
          setAmount(v)
          setInvalid(false)
        }}
        error={invalid ? 'admin.pay.badAmount' : undefined}
      />
      <SelectField
        id="pay-method"
        label={t('admin.pay.method')}
        value={method}
        onChange={(v) => setMethod(v as PaymentMethod)}
        options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`admin.pay.methods.${m}`) }))}
      />
      <TextField
        id="pay-date"
        label={t('admin.pay.date')}
        type="date"
        max={today}
        value={paidOn}
        onChange={setPaidOn}
      />
      {bills.length > 0 && (
        <SelectField
          id="pay-bill"
          label={t('admin.pay.forBill')}
          value={invoiceId}
          onChange={setInvoiceId}
          options={[
            { value: '', label: t('admin.pay.anyBill') },
            ...bills.map((b) => ({
              value: b.id,
              label: `${b.label} · ₹${formatINR(b.amount)}`,
            })),
          ]}
        />
      )}
      <TextField id="pay-note" label={t('admin.pay.note')} value={note} onChange={setNote} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn" disabled={save.isPending}>
          {save.isPending ? t('admin.pay.saving') : t('admin.pay.save')}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>
          {t('admin.common.back')}
        </button>
      </div>
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
  return (
    <li className="px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            {isPayment
              ? t('admin.pay.entryPayment', { method: t(`admin.pay.methods.${e.method}`) })
              : t('admin.pay.entryBill', { no: e.label })}
          </p>
          <p className="text-sm text-mute">
            {formatDay(e.date, language)}
            {e.invoiceNo && ` · ${t('admin.pay.forInvoice', { no: e.invoiceNo })}`}
            {e.note && ` · ${e.note}`}
          </p>
          <p className="text-sm text-mute">
            {t('admin.pay.balanceAfter', { amount: formatINR(e.balanceAfter) })}
          </p>
        </div>
        <p className="whitespace-nowrap font-bold">
          {isPayment ? '−' : '+'}₹{formatINR(e.amount)}
        </p>
      </div>

      {isPayment && !asking && (
        <button
          type="button"
          className="btn btn-outline mt-2"
          aria-label={`${t('admin.pay.remove')} ₹${formatINR(e.amount)}`}
          onClick={() => setAsking(true)}
        >
          <Trash2 size={16} aria-hidden="true" />
          {t('admin.pay.remove')}
        </button>
      )}
      {isPayment && asking && (
        <div className="mt-2 rounded-xl border-2 border-dashed border-ink p-3">
          <p className="mb-3 font-medium">
            {t('admin.pay.removeAsk', { amount: formatINR(e.amount) })}
          </p>
          <TextField
            id={`void-${e.id}`}
            label={t('admin.pay.reason')}
            value={reason}
            onChange={setReason}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {t('admin.pay.removeConfirm')}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setAsking(false)}>
              {t('admin.pay.keep')}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
