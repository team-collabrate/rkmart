import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  CircleCheck,
  Clock,
  Coins,
  Download,
  FileCheck,
  FilePlus2,
  FileText,
  Printer,
  Receipt,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { Banner } from '../../components/ui'
import { TopBar } from '../../components/TopBar'
import { useAdminApi } from '../../data/apiContext'
import type { DayPdf, Invoice } from '../../data/adminOrders'
import { formatTime, todayISO } from '../../lib/dates'
import { openForPrint, saveFile } from '../../lib/files'
import { formatINR, roundPaise } from '../../lib/money'
import type { Language } from '../auth/types'
import { DayNav } from './DayNav'
import { errorText, keys, useDayInvoices, useDayPdfs, useSettings } from './queries'

// Built to stay still: fixed heights, one line per element, no animation, grey placeholders in the
// same shape while loading. Icons carry the meaning; full sentences stay as screen-reader text.

const fileName = (date: string, version: number) => `rk-bills-${date}-v${version}.pdf`

/** A PDF that was just made, kept so it can be downloaded or printed straight away. */
interface Made {
  pdf: DayPdf
  blob: Blob
}

/**
 * The day's bills, and one tap to make them into a single PDF (two bills per A4 page, ready to print
 * and cut). Each PDF is saved with a version number. If a bill is made after a PDF, "New" makes a
 * small PDF with just those.
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

  const loading = invoices.isPending || pdfs.isPending
  const all = invoices.data ?? []
  const saved = pdfs.data ?? []
  const covered = new Set(saved.flatMap((p) => p.invoiceIds))
  const fresh = all.filter((i) => !covered.has(i.id))
  const versionsOf = (invoiceId: string) =>
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

  const BIG = 'btn h-14 rounded-full text-base'

  return (
    <section className="-mx-4 -mb-28 -mt-2 min-h-[calc(100dvh-4rem)] bg-page pb-28">
      <div className="rounded-b-[2rem] bg-paper px-5 pb-4 pt-5">
        <TopBar />
        <h1 className="mb-4 h-10 truncate text-[2rem] leading-10">{t('admin.bills.title')}</h1>
        <DayNav date={date} onChange={go} />
      </div>

      <div className="px-4 pt-4">
        {settings.data && !settings.data.gstin.trim() && (
          <Link
            to="/admin/more/settings"
            className="mb-4 flex h-12 items-center gap-3 rounded-2xl bg-amber-soft px-4 text-amber no-underline"
          >
            <TriangleAlert size={20} aria-hidden="true" className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {t('admin.bills.noGstin')}
            </span>
            <ArrowRight size={18} aria-hidden="true" className="shrink-0" />
            <span className="sr-only">{t('admin.bill.missingGstin')}</span>
          </Link>
        )}

        {invoices.isError || pdfs.isError ? (
          <Banner kind="error">{errorText(t, invoices.error ?? pdfs.error)}</Banner>
        ) : !loading && all.length === 0 ? (
          <div className="flex flex-col items-center rounded-[1.75rem] border border-line bg-paper px-6 py-8 text-center">
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 96 96"
              className="mb-3 size-24"
              fill="none"
            >
              <circle cx="48" cy="48" r="44" fill="#e8f7ec" />
              <path
                d="M30 20v56l6-3 6 3 6-3 6 3 6-3 6 3V20l-6 3-6-3-6 3-6-3-6 3z"
                fill="#fff"
                stroke="#16a34a"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <path
                d="M38 38h20M38 48h20M38 58h12"
                stroke="#16a34a"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <p className="text-sm text-mute">{t('admin.bills.empty')}</p>
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2.5">
              <div className="flex h-[4.5rem] items-center gap-3 rounded-3xl bg-brand-soft px-4 text-brand-dark">
                <Receipt size={24} aria-hidden="true" className="shrink-0" />
                <span className="font-display text-2xl font-bold">
                  {loading ? '–' : all.length}
                </span>
              </div>
              <div className="flex h-[4.5rem] items-center gap-3 rounded-3xl bg-blue-soft px-4 text-blue">
                <Coins size={24} aria-hidden="true" className="shrink-0" />
                <span className="truncate font-display text-2xl font-bold">
                  {loading ? '–' : `₹${formatINR(total)}`}
                </span>
              </div>
              {!loading && (
                <span className="sr-only">
                  {t('admin.bills.summary', { count: all.length, total: formatINR(total) })}
                </span>
              )}
            </div>

            {error && (
              <div className="mb-4">
                <Banner kind="error">{error}</Banner>
              </div>
            )}

            {!loading &&
              (saved.length === 0 ? (
                <button
                  type="button"
                  className={`${BIG} mb-4 w-full`}
                  disabled={busy}
                  aria-label={t('admin.bills.makeAll', { count: all.length })}
                  onClick={() => run(all)}
                >
                  <FileText size={22} aria-hidden="true" className="shrink-0" />
                  <span className="truncate">
                    {make.isPending
                      ? t('admin.bills.making')
                      : t('admin.bills.pdfShort', { count: all.length })}
                  </span>
                </button>
              ) : (
                <>
                  <div className="mb-3 flex gap-2.5">
                    {fresh.length > 0 && (
                      <button
                        type="button"
                        className={`${BIG} min-w-0 flex-1`}
                        disabled={busy}
                        aria-label={t('admin.bills.makeNew', { count: fresh.length })}
                        onClick={() => run(fresh)}
                      >
                        <FilePlus2 size={22} aria-hidden="true" className="shrink-0" />
                        <span className="truncate">
                          {t('admin.bills.newShort', { count: fresh.length })}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${BIG} min-w-0 flex-1 ${fresh.length > 0 ? 'btn-outline' : ''}`}
                      disabled={busy}
                      aria-label={t('admin.bills.makeAgain', { count: all.length })}
                      onClick={() => run(all)}
                    >
                      <RefreshCw size={20} aria-hidden="true" className="shrink-0" />
                      <span className="truncate">
                        {t('admin.bills.allShort', { count: all.length })}
                      </span>
                    </button>
                  </div>
                  <p className="mb-4 flex h-5 items-center gap-1.5 text-xs text-mute">
                    {fresh.length === 0 ? (
                      <>
                        <CircleCheck size={14} aria-hidden="true" className="shrink-0 text-brand" />
                        <span className="truncate">{t('admin.bills.allInPdf')}</span>
                      </>
                    ) : (
                      <>
                        <TriangleAlert
                          size={14}
                          aria-hidden="true"
                          className="shrink-0 text-amber"
                        />
                        <span className="truncate">
                          {t('admin.bills.newAfterPdf', { count: fresh.length })}
                        </span>
                      </>
                    )}
                  </p>
                </>
              ))}

            {made && (
              <div className="mb-4 rounded-[1.75rem] border border-line bg-paper p-4">
                <span className="sr-only">
                  {t('admin.bills.made', { version: made.pdf.version, count: made.pdf.billCount })}
                </span>
                <div className="mb-3 flex h-11 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-dark"
                  >
                    <FileCheck size={22} />
                  </span>
                  <div className="min-w-0">
                    <p className="h-6 font-display text-lg font-bold leading-6">
                      v{made.pdf.version}
                    </p>
                    <p className="flex h-5 items-center gap-1 text-sm leading-5 text-mute">
                      <Receipt size={13} aria-hidden="true" />
                      {made.pdf.billCount}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    className="btn h-12 min-w-0 flex-1 rounded-2xl"
                    disabled={busy}
                    onClick={() =>
                      deliver.mutate({ kind: 'print', pdf: made.pdf, blob: made.blob })
                    }
                  >
                    <Printer size={20} aria-hidden="true" className="shrink-0" />
                    <span className="truncate">{t('admin.bills.print')}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline h-12 min-w-0 flex-1 rounded-2xl"
                    disabled={busy}
                    onClick={() => deliver.mutate({ kind: 'save', pdf: made.pdf, blob: made.blob })}
                  >
                    <Download size={20} aria-hidden="true" className="shrink-0" />
                    <span className="truncate">{t('admin.bills.download')}</span>
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <ul className="flex flex-col gap-2.5" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="h-[4.5rem] rounded-3xl border border-line bg-paper" />
                ))}
              </ul>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {all.map((i) => {
                  const versions = versionsOf(i.id)
                  return (
                    <li key={i.id}>
                      <Link
                        to={`/admin/orders/${i.orderId}/bill`}
                        className="flex h-[4.5rem] items-center gap-3 rounded-3xl border border-line bg-paper px-3.5 no-underline active:bg-page"
                      >
                        <Avatar name={i.shopName} />
                        <div className="min-w-0 flex-1">
                          <p className="h-6 truncate font-semibold leading-6">{i.shopName}</p>
                          <p className="h-5 truncate text-sm leading-5 text-mute">{i.invoiceNo}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end">
                          <p className="h-6 font-display text-base font-bold leading-6">
                            ₹{formatINR(i.grandTotal)}
                          </p>
                          <span
                            aria-hidden="true"
                            className={
                              'inline-flex h-5 items-center gap-1 rounded-full px-2 text-[0.6875rem] font-semibold ' +
                              (versions.length > 0
                                ? 'bg-brand-soft text-brand-dark'
                                : 'bg-page text-mute')
                            }
                          >
                            {versions.length > 0 ? (
                              <>
                                <FileCheck size={12} />
                                {versions.map((v) => `v${v}`).join(' ')}
                              </>
                            ) : (
                              '—'
                            )}
                          </span>
                          <span className="sr-only">
                            {versions.length > 0
                              ? t('admin.bills.inPdf', {
                                  versions: versions.map((v) => `v${v}`).join(', '),
                                })
                              : t('admin.bills.notInPdf')}
                          </span>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}

        {saved.length > 0 && (
          <>
            <h2 className="mb-2 mt-5 h-6 text-base leading-6">{t('admin.bills.savedHeading')}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-[1.75rem] border border-line bg-paper">
              {saved.map((p) => (
                <li key={p.id} className="flex h-[4.5rem] items-center gap-3 px-3.5">
                  <span
                    aria-hidden="true"
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-dark"
                  >
                    <FileCheck size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="h-6 font-semibold leading-6">v{p.version}</p>
                    <p className="flex h-5 items-center gap-2 text-sm leading-5 text-mute">
                      <span className="flex items-center gap-1">
                        <Receipt size={13} aria-hidden="true" />
                        {p.billCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={13} aria-hidden="true" />
                        {formatTime(p.createdAt, language)}
                      </span>
                    </p>
                    <span className="sr-only">
                      {t('admin.bills.pdfRow', {
                        version: p.version,
                        count: p.billCount,
                        time: formatTime(p.createdAt, language),
                      })}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-page"
                    disabled={busy}
                    aria-label={t('admin.bills.printVersion', { version: p.version })}
                    onClick={() => deliver.mutate({ kind: 'print', pdf: p })}
                  >
                    <Printer size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-page"
                    disabled={busy}
                    aria-label={t('admin.bills.downloadVersion', { version: p.version })}
                    onClick={() => deliver.mutate({ kind: 'save', pdf: p })}
                  >
                    <Download size={18} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
