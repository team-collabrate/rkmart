import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { Banner, Loading, PageHeader, TextField } from '../../components/ui'
import { useAdminApi } from '../../data/apiContext'
import type { Invoice } from '../../data/adminOrders'
import type { CompanySettings } from '../../data/types'
import { formatDay } from '../../lib/dates'
import { formatINR, formatRupees } from '../../lib/money'
import { displayNames } from '../../lib/names'
import { amountInWords } from '../../lib/words'
import type { Language } from '../auth/types'
import { formatQty } from '../shop/cart'
import { errorText, useOrderDetail, useSettings } from './queries'

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
        <PageHeader title={t('admin.bill.title')} backTo={`/admin/orders/${order.data.id}`} />
        <Banner kind="info">{t('admin.orders.generate')}</Banner>
      </section>
    )
  }
  return (
    <BillView
      invoice={invoice}
      company={settings.data}
      orderId={order.data.id}
      delivered={order.data.status === 'delivered'}
    />
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={'flex items-baseline justify-between gap-3 ' + (strong ? 'font-bold' : '')}>
      <span>{label}</span>
      <span className="whitespace-nowrap">{value}</span>
    </div>
  )
}

function BillView({
  invoice,
  company,
  orderId,
  delivered,
}: {
  invoice: Invoice
  company: CompanySettings
  orderId: string
  delivered: boolean
}) {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const api = useAdminApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cancel = useMutation({
    mutationFn: () => api.cancelBill(invoice.id, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-order'] })
      void navigate(`/admin/orders/${orderId}`, { state: { cancelled: true } })
    },
    onError: (e) => setError(errorText(t, e)),
  })

  const intra = invoice.igstTotal === 0 && invoice.cgstTotal + invoice.sgstTotal > 0
  const money = (n: number) => `₹${formatINR(n)}`

  return (
    <section className="max-w-2xl">
      <PageHeader
        title={t('admin.orders.billNo', { no: invoice.invoiceNo })}
        backTo={`/admin/orders/${orderId}`}
      />

      {!company.gstin.trim() && (
        <div className="mb-4">
          <Banner kind="error">
            {t('admin.bill.missingGstin')}{' '}
            <Link to="/admin/more/settings" className="font-semibold underline">
              {t('admin.bill.openSettings')}
            </Link>
          </Banner>
        </div>
      )}

      <article className="rounded-xl border-2 border-ink p-4">
        <header className="mb-3 border-b-2 border-ink pb-3 text-center">
          <p className="text-xs font-bold tracking-wide">{t('admin.bill.taxInvoice')}</p>
          <h2 className="font-display text-xl font-bold">{company.companyName}</h2>
          {company.tagline && <p className="text-sm text-mute">{company.tagline}</p>}
          <p className="text-sm">{company.address}</p>
          <p className="text-sm">
            {company.phone}
            {company.gstin && ` · ${t('admin.bill.gstin')}: ${company.gstin}`}
          </p>
        </header>

        <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="font-semibold">{t('admin.bill.billTo')}</p>
            <p className="font-bold">{invoice.shopName}</p>
            <p>{invoice.shopAddress}</p>
            {invoice.shopGstin && (
              <p>
                {t('admin.bill.gstin')}: {invoice.shopGstin}
              </p>
            )}
            <p>
              {t('admin.bill.stateCode')}: {invoice.shopStateCode}
            </p>
          </div>
          <div className="text-right">
            <p>
              <span className="font-semibold">{t('admin.bill.billNo')}</span> {invoice.invoiceNo}
            </p>
            <p>
              <span className="font-semibold">{t('admin.bill.date')}</span>{' '}
              {formatDay(invoice.issueDate, language)}
            </p>
          </div>
        </div>

        <ol className="mb-3 divide-y-2 divide-hair border-y-2 border-ink">
          {invoice.lines.map((l) => {
            const names = displayNames(l.nameEn, l.nameTa, language)
            const gstAmount = l.cgst + l.sgst + l.igst
            return (
              <li key={l.lineNo} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">
                    {l.lineNo}. {names.primary}
                  </p>
                  <p className="text-mute">
                    {t('admin.bill.hsn')} {l.hsnCode} · {formatQty(l.qty)} {l.unit} × ₹
                    {formatRupees(l.rate)}
                  </p>
                  <p className="text-mute">
                    {t('admin.bill.taxable')} {money(l.taxable)} · {t('admin.bill.gst')} {l.gstRate}
                    % ({money(gstAmount)})
                  </p>
                </div>
                <p className="whitespace-nowrap font-bold">{money(l.amount)}</p>
              </li>
            )
          })}
        </ol>

        <div className="mb-3 space-y-1">
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
          <div className="border-t-2 border-ink pt-1">
            <Row label={t('admin.bill.grandTotal')} value={money(invoice.grandTotal)} strong />
          </div>
          <Row label={t('admin.bill.previousBalance')} value={money(invoice.previousBalance)} />
          <div className="border-t-2 border-ink pt-1 text-lg">
            <Row label={t('admin.bill.totalDue')} value={money(invoice.totalDue)} strong />
          </div>
        </div>

        <p className="mb-3 text-sm">
          <span className="font-semibold">{t('admin.bill.inWords')}: </span>
          {amountInWords(invoice.totalDue)}
        </p>
        {company.bankDetails && (
          <p className="whitespace-pre-line text-sm">
            <span className="font-semibold">{t('admin.bill.bank')}: </span>
            {company.bankDetails}
          </p>
        )}
      </article>

      <div className="mt-4">
        {delivered ? (
          <p className="text-sm text-mute">{t('admin.bill.deliveredLocked')}</p>
        ) : asking ? (
          <div className="rounded-xl border-2 border-dashed border-ink p-3">
            <p className="mb-3 font-medium">
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
                className="btn"
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
          <button type="button" className="btn btn-outline" onClick={() => setAsking(true)}>
            <Ban size={18} aria-hidden="true" />
            {t('admin.bill.cancel')}
          </button>
        )}
      </div>
    </section>
  )
}
