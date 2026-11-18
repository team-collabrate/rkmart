import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, FileText, Printer } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Banner, Empty, Loading, PageHeader } from '../../components/ui'
import { useAdminApi } from '../../data/apiContext'
import type { DayPdf, Invoice } from '../../data/adminOrders'
import { formatTime, todayISO } from '../../lib/dates'
import { openForPrint, saveFile } from '../../lib/files'
import { formatINR, roundPaise } from '../../lib/money'
import type { Language } from '../auth/types'
import { DayNav } from './DayNav'
import { errorText, keys, useDayInvoices, useDayPdfs, useSettings } from './queries'

const fileName = (date: string, version: number) => `rk-bills-${date}-v${version}.pdf`

/** A PDF that was just made, kept so it can be downloaded or printed straight away. */
interface Made {
  pdf: DayPdf
  blob: Blob
}

/**
 * Today's bills: every bill of the day, and one tap to make them into a single PDF (two bills per
 * A4 page, ready to print and cut). Each PDF is saved with a version number. If a bill is made after
 * a PDF, "only the new bills" makes a small PDF with just those.
 */
export function BillsPage() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const api = useAdminApi()
  const queryClient = useQueryClient()

  const [date, setDate] = useState(todayISO())
  const [made, setMade] = useState<Made | null>(null)
  const [error, setError] = useState<string | null>(null)
  const invoices = useDayInvoices(date)
  const pdfs = useDayPdfs(date)
  const settings = useSettings()

  const all = invoices.data ?? []
  const saved = pdfs.data ?? []
  const covered = new Set(saved.flatMap((p) => p.invoiceIds))
  const fresh = all.filter((i) => !covered.has(i.id))
  const versionOf = (invoiceId: string) =>
    saved.filter((p) => p.invoiceIds.includes(invoiceId)).map((p) => p.version)
  const total = roundPaise(all.reduce((sum, i) => sum + i.grandTotal, 0))

  function go(next: string) {
    setDate(next)
    setMade(null)
    setError(null)
  }

  const make = useMutation({
    mutationFn: async (which: Invoice[]) => {
      if (!settings.data) throw new Error('settings')
      // Loaded now, not at start-up: the PDF library and fonts are large.
      const { makeDayPdf } = await import('../../lib/pdf/makeDayPdf')
      const blob = await makeDayPdf(settings.data, which)
      const pdf = await api.saveDayPdf(
        date,
        blob,
        which.map((i) => i.id),
      )
      return { pdf, blob }
    },
    onSuccess: async (result) => {
      setMade(result)
      setError(null)
      await queryClient.invalidateQueries({ queryKey: keys.dayPdfs(date) })
    },
    onError: (e) => {
      setMade(null)
      setError(
        e instanceof Error && e.message === 'settings'
          ? t('admin.bills.pdfFailed')
          : errorText(t, e),
      )
    },
  })

  const deliver = useMutation({
    mutationFn: async (job: { kind: 'save' | 'print'; pdf: DayPdf; blob?: Blob }) => {
      const blob = job.blob ?? (await api.getDayPdf(job.pdf.id))
      const name = fileName(job.pdf.billDate, job.pdf.version)
      const title = t('admin.bills.fileTitle', { date: job.pdf.billDate, version: job.pdf.version })
      if (job.kind === 'print') await openForPrint(blob, name, title)
      else await saveFile(blob, name, title)
    },
    onError: (e) => setError(errorText(t, e)),
  })

  const busy = make.isPending || deliver.isPending
  const run = (which: Invoice[]) => {
    setError(null)
    make.mutate(which)
  }

  const pdfLabel = (p: DayPdf) =>
    t('admin.bills.pdfRow', {
      version: p.version,
      count: p.billCount,
      time: formatTime(p.createdAt, language),
    })

  return (
    <section>
      <PageHeader title={t('admin.bills.title')} />
      <DayNav date={date} onChange={go} />

      {settings.data && !settings.data.gstin.trim() && (
        <div className="mb-3">
          <Banner kind="error">
            {t('admin.bill.missingGstin')}{' '}
            <Link to="/admin/more/settings" className="font-semibold underline">
              {t('admin.bill.openSettings')}
            </Link>
          </Banner>
        </div>
      )}

      {invoices.isPending || pdfs.isPending ? (
        <Loading />
      ) : invoices.isError || pdfs.isError ? (
        <Banner kind="error">{errorText(t, invoices.error ?? pdfs.error)}</Banner>
      ) : all.length === 0 ? (
        <Empty>{t('admin.bills.empty')}</Empty>
      ) : (
        <>
          <p className="mb-3 font-semibold">
            {t('admin.bills.summary', { count: all.length, total: formatINR(total) })}
          </p>

          <div className="mb-3 flex flex-wrap gap-2">
            {saved.length === 0 ? (
              <button type="button" className="btn" disabled={busy} onClick={() => run(all)}>
                <FileText size={18} aria-hidden="true" />
                {make.isPending
                  ? t('admin.bills.making')
                  : t('admin.bills.makeAll', { count: all.length })}
              </button>
            ) : (
              <>
                {fresh.length > 0 && (
                  <button type="button" className="btn" disabled={busy} onClick={() => run(fresh)}>
                    <FileText size={18} aria-hidden="true" />
                    {make.isPending
                      ? t('admin.bills.making')
                      : t('admin.bills.makeNew', { count: fresh.length })}
                  </button>
                )}
                <button
                  type="button"
                  className={fresh.length > 0 ? 'btn btn-outline' : 'btn'}
                  disabled={busy}
                  onClick={() => run(all)}
                >
                  <FileText size={18} aria-hidden="true" />
                  {make.isPending && fresh.length === 0
                    ? t('admin.bills.making')
                    : t('admin.bills.makeAgain', { count: all.length })}
                </button>
              </>
            )}
          </div>
          {saved.length > 0 && fresh.length === 0 && (
            <p className="mb-3 text-sm text-mute">{t('admin.bills.allInPdf')}</p>
          )}
          {fresh.length > 0 && saved.length > 0 && (
            <p className="mb-3 text-sm text-mute">
              {t('admin.bills.newAfterPdf', { count: fresh.length })}
            </p>
          )}

          {error && (
            <div className="mb-3">
              <Banner kind="error">{error}</Banner>
            </div>
          )}

          {made && (
            <div className="mb-4 rounded-xl border-2 border-line p-3">
              <p className="mb-3 font-semibold">
                {t('admin.bills.made', { version: made.pdf.version, count: made.pdf.billCount })}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => deliver.mutate({ kind: 'print', pdf: made.pdf, blob: made.blob })}
                >
                  <Printer size={18} aria-hidden="true" />
                  {t('admin.bills.print')}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busy}
                  onClick={() => deliver.mutate({ kind: 'save', pdf: made.pdf, blob: made.blob })}
                >
                  <Download size={18} aria-hidden="true" />
                  {t('admin.bills.download')}
                </button>
              </div>
              <p className="mt-3 text-sm text-mute">{t('admin.bills.printHint')}</p>
            </div>
          )}

          <h2 className="mb-2 text-lg">{t('admin.bills.billsHeading')}</h2>
          <ul className="mb-5 divide-y-2 divide-hair rounded-xl border-2 border-line">
            {all.map((i) => {
              const versions = versionOf(i.id)
              return (
                <li key={i.id}>
                  <Link
                    to={`/admin/orders/${i.orderId}/bill`}
                    className="flex items-center gap-3 px-3 py-3 no-underline"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{i.shopName}</p>
                      <p className="text-sm text-mute">{i.invoiceNo}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{formatINR(i.grandTotal)}</p>
                      <p className="text-xs font-semibold">
                        {versions.length > 0
                          ? t('admin.bills.inPdf', {
                              versions: versions.map((v) => `v${v}`).join(', '),
                            })
                          : t('admin.bills.notInPdf')}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {saved.length > 0 && (
        <>
          <h2 className="mb-2 text-lg">{t('admin.bills.savedHeading')}</h2>
          <ul className="divide-y-2 divide-hair rounded-xl border-2 border-line">
            {saved.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-3"
              >
                <span className="font-semibold">{pdfLabel(p)}</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={busy}
                    aria-label={t('admin.bills.printVersion', { version: p.version })}
                    onClick={() => deliver.mutate({ kind: 'print', pdf: p })}
                  >
                    <Printer size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={busy}
                    aria-label={t('admin.bills.downloadVersion', { version: p.version })}
                    onClick={() => deliver.mutate({ kind: 'save', pdf: p })}
                  >
                    <Download size={16} aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
