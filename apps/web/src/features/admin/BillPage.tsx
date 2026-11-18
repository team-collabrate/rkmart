import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Ban,
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  Hash,
  Landmark,
  PenLine,
  Plus,
  Store,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { CardGlow, ReceiptEdge } from '../../components/ReceiptEdge'
import { Banner, Loading, TextField } from '../../components/ui'
import { useAdminApi } from '../../data/apiContext'
import type { Invoice } from '../../data/adminOrders'
import type { CompanySettings } from '../../data/types'
import { formatDay } from '../../lib/dates'
import { formatINR, formatRupees } from '../../lib/money'
import { displayNames } from '../../lib/names'
import { amountInWords } from '../../lib/words'
import type { Language } from '../auth/types'
import { formatQty } from '../shop/cart'
import { OrderStatusPill } from '../shop/OrderStatusPill'
import { errorText, useOrderDetail, useSettings } from './queries'

const BACK =
  'grid size-11 place-items-center rounded-full bg-paper shadow-[0_1px_2px_rgba(15,26,20,0.08)]'

/** The bill as the shop will get it: company, shop, lines, tax split, previous balance, total due. */
export function BillPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const order = useOrderDetail(id)
  const settings = useSettings()

  if (order.isPending || settings.isPending) return <Loading />
  if (order.isError || settings.isError) {
    return <Banner kind="error">{errorText(t, order.error ?? settings.error)}</Banner>
  }
  const { invoice } = order.data
  if (!invoice) {
    return (
      <section>
        <Link
          to={`/admin/orders/${order.data.id}`}
          aria-label={t('admin.common.back')}
          className={BACK}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </Link>
        <h1 className="mt-3 text-[1.75rem]">{t('admin.bill.title')}</h1>
        <div className="mt-3">
          <Banner kind="info">{t('admin.orders.generate')}</Banner>
        </div>
      </section>
    )
  }
  return (
    <BillView
      invoice={invoice}
      company={settings.data}
      orderId={order.data.id}
      status={order.data.status}
    />
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
      <span className="text-mute">{label}</span>
      <span className="whitespace-nowrap font-medium">{value}</span>
    </div>
  )
}

/** A small labelled tile with an icon: who the bill is for, its number, its date. */
function Tile({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl bg-page p-3">
      <p className="mb-1 flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-mute">
        {icon}
        {label}
      </p>
      {children}
    </div>
  )
}

function BillView({
  invoice,
  company,
  orderId,
  status,
}: {
  invoice: Invoice
  company: CompanySettings
  orderId: string
  status: 'placed' | 'billed' | 'delivered' | 'cancelled'
}) {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const api = useAdminApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const delivered = status === 'delivered'

  const cancel = useMutation({
    mutationFn: () => api.cancelBill(invoice.id, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-order'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-day-invoices'] })
      void navigate(`/admin/orders/${orderId}`, { state: { cancelled: true } })
    },
    onError: (e) => setError(errorText(t, e)),
  })

  const intra = invoice.igstTotal === 0 && invoice.cgstTotal + invoice.sgstTotal > 0
  const money = (n: number) => `₹${formatINR(n)}`

  return (
    <section className="-mx-4 -mb-28 -mt-2 min-h-[calc(100dvh-4rem)] bg-page px-4 pb-32 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <Link to={`/admin/orders/${orderId}`} aria-label={t('admin.common.back')} className={BACK}>
          <ChevronLeft size={22} aria-hidden="true" />
        </Link>
        <OrderStatusPill status={status} admin />
      </div>
      <h1 className="mb-4 text-[1.75rem]">{t('admin.orders.billNo', { no: invoice.invoiceNo })}</h1>

      {!company.gstin.trim() && (
        <Link
          to="/admin/more/settings"
          className="mb-4 flex items-center gap-3 rounded-3xl bg-amber-soft p-4 text-amber no-underline"
        >
          <TriangleAlert size={22} aria-hidden="true" className="shrink-0" />
          <span className="flex-1 text-sm font-medium">{t('admin.bill.missingGstin')}</span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold">
            {t('admin.bill.openSettings')}
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        </Link>
      )}

      <div className="drop-shadow-[0_2px_6px_rgba(15,26,20,0.06)]">
        <article className="rounded-t-[1.75rem] bg-paper p-5">
          <header className="mb-4 flex items-start gap-3">
            <span
              aria-hidden="true"
              className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-paper"
            >
              <Store size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-xl font-bold">{company.companyName}</h2>
              {company.tagline && <p className="truncate text-sm text-mute">{company.tagline}</p>}
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[0.6875rem] font-bold text-brand-dark">
              <BadgeCheck size={14} aria-hidden="true" />
              {t('admin.bill.taxInvoice')}
            </span>
          </header>
          {(company.address || company.phone || company.gstin) && (
            <p className="mb-4 text-xs text-mute">
              {[
                company.address,
                company.phone,
                company.gstin && `${t('admin.bill.gstin')} ${company.gstin}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          <div className="mb-4 flex gap-2.5">
            <Tile icon={<Store size={13} aria-hidden="true" />} label={t('admin.bill.billTo')}>
              <p className="truncate font-semibold">{invoice.shopName}</p>
              <p className="truncate text-sm text-mute">{invoice.shopAddress}</p>
            </Tile>
            <Tile icon={<Hash size={13} aria-hidden="true" />} label={t('admin.bill.billNo')}>
              <p className="truncate font-semibold">{invoice.invoiceNo}</p>
              <p className="flex items-center gap-1 text-sm text-mute">
                <CalendarDays size={13} aria-hidden="true" className="shrink-0" />
                {formatDay(invoice.issueDate, language)}
              </p>
            </Tile>
          </div>

          <ol className="mb-4 divide-y divide-line border-y border-line">
            {invoice.lines.map((l) => {
              const names = displayNames(l.nameEn, l.nameTa, language)
              const gstAmount = l.cgst + l.sgst + l.igst
              return (
                <li key={l.lineNo} className="flex items-start gap-3 py-3">
                  <span className="grid min-w-14 place-items-center rounded-xl bg-page px-2 py-1.5 text-center text-xs font-bold leading-tight">
                    {formatQty(l.qty)}
                    <span className="font-medium text-mute">{l.unit}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{names.primary}</p>
                    <p className="text-xs text-mute">
                      ₹{formatRupees(l.rate)} · {t('admin.bill.hsn')} {l.hsnCode}
                    </p>
                    <p className="text-xs text-mute">
                      {t('admin.bill.taxable')} {money(l.taxable)} · {t('admin.bill.gst')}{' '}
                      {l.gstRate}% ({money(gstAmount)})
                    </p>
                  </div>
                  <p className="whitespace-nowrap font-display text-base font-bold">
                    {money(l.amount)}
                  </p>
                </li>
              )
            })}
          </ol>

          <div className="mb-4 space-y-2">
            <Row label={t('admin.bill.taxableTotal')} value={money(invoice.taxableTotal)} />
            {intra ? (
              <>
                <Row label={t('admin.bill.cgst')} value={money(invoice.cgstTotal)} />
                <Row label={t('admin.bill.sgst')} value={money(invoice.sgstTotal)} />
              </>
            ) : (
              <Row label={t('admin.bill.igst')} value={money(invoice.igstTotal)} />
            )}
            {invoice.roundOff !== 0 && (
              <Row
                label={t('admin.bill.roundOff')}
                value={`${invoice.roundOff > 0 ? '+' : '−'}${money(Math.abs(invoice.roundOff))}`}
              />
            )}
          </div>

          <div className="relative mb-4 overflow-hidden rounded-3xl bg-brand p-5 text-paper">
            <CardGlow />
            <div className="relative space-y-1.5 text-sm text-white/85">
              <div className="flex justify-between">
                <span>{t('admin.bill.grandTotal')}</span>
                <span className="font-medium">{money(invoice.grandTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <Plus size={14} aria-hidden="true" />
                  {t('admin.bill.previousBalance')}
                </span>
                <span className="font-medium">{money(invoice.previousBalance)}</span>
              </div>
            </div>
            <div className="relative mt-3 flex items-center justify-between gap-3 border-t border-white/25 pt-3">
              <span className="flex items-center gap-2 font-semibold">
                <Wallet size={22} aria-hidden="true" />
                {t('admin.bill.totalDue')}
              </span>
              <span className="font-display text-[1.75rem] font-bold">
                {money(invoice.totalDue)}
              </span>
            </div>
          </div>

          <p className="flex items-start gap-2 text-xs font-medium text-mute">
            <PenLine size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>{amountInWords(invoice.grandTotal)}</span>
          </p>
          {company.bankDetails && (
            <p className="mt-3 flex items-start gap-2 whitespace-pre-line text-xs text-mute">
              <Landmark size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>{company.bankDetails}</span>
            </p>
          )}
        </article>
        <ReceiptEdge />
      </div>

      <div className="mt-5">
        {delivered ? (
          <p className="text-center text-sm text-mute">{t('admin.bill.deliveredLocked')}</p>
        ) : asking ? (
          <div className="rounded-3xl border border-red bg-paper p-4">
            <p className="mb-3 flex items-start gap-2 font-medium">
              <TriangleAlert size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-red" />
              {t('admin.bill.cancelAsk', { no: invoice.invoiceNo })}
            </p>
            <TextField
              id="cancel-reason"
              label={t('admin.bill.reason')}
              value={reason}
              onChange={(v) => {
                setReason(v)
                setError(null)
              }}
            />
            {error && (
              <div className="mt-3">
                <Banner kind="error">{error}</Banner>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn !border-red !bg-red"
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
              >
                {t('admin.bill.cancelConfirm')}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(false)}>
                {t('admin.bill.keep')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-outline w-full !text-red"
            onClick={() => setAsking(true)}
          >
            <Ban size={18} aria-hidden="true" />
            {t('admin.bill.cancel')}
          </button>
        )}
      </div>
    </section>
  )
}
