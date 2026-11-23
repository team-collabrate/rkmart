import { useQuery } from '@tanstack/react-query'
import { Download, Percent, Receipt } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../../components/Avatar'
import { TopBar } from '../../components/TopBar'
import { Banner, PageHeader } from '../../components/ui'
import { useAdminApi } from '../../data/apiContext'
import { rangeDates, totalsOf, type RangeKey } from '../../data/reports'
import { toCsv } from '../../lib/csv'
import { formatDay, todayISO } from '../../lib/dates'
import { saveFile } from '../../lib/files'
import { formatQty } from '../shop/cart'
import { formatRupees, roundPaise } from '../../lib/money'
import { displayNames } from '../../lib/names'
import type { Language } from '../auth/types'
import { errorText } from './queries'

// Built to stay still, like the other admin pages: fixed heights, one line per element.

type Tab = 'day' | 'shop' | 'item' | 'dues'
const RANGES: RangeKey[] = ['today', 'week', 'month', 'lastMonth']
const TABS: Tab[] = ['day', 'shop', 'item', 'dues']
const CARD = 'overflow-hidden rounded-[1.75rem] border border-line bg-paper'
const ROW = 'flex h-[4.25rem] items-center gap-3 px-5'

const money = (n: number) => `₹${formatRupees(roundPaise(n))}`

/** Sales by day, by shop and by item for a date range, plus what shops owe. Each list exports to CSV. */
export function ReportsPage() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const api = useAdminApi()
  const today = todayISO()
  const [range, setRange] = useState<RangeKey>('month')
  const [tab, setTab] = useState<Tab>('day')
  const [exportError, setExportError] = useState<string | null>(null)
  const { from, to } = rangeDates(range, today)

  const sales = useQuery({
    queryKey: ['report-sales', from, to],
    queryFn: () => api.getSalesReport(from, to),
  })
  const dues = useQuery({ queryKey: ['balances'], queryFn: () => api.listBalances() })

  const report = sales.data
  const totals = report ? totalsOf(report) : null
  const owing = (dues.data ?? []).filter((b) => b.balance > 0)
  const loading = tab === 'dues' ? dues.isPending : sales.isPending

  const csvRows = (): (string | number)[][] => {
    const R = report
    if (tab === 'dues') {
      return [
        [
          t('admin.reports.col.shop'),
          t('admin.reports.col.billed'),
          t('admin.reports.col.paid'),
          t('admin.reports.col.owes'),
          t('admin.reports.col.lastPaid'),
        ],
        ...owing.map((b) => [b.nameEn, b.invoiced, b.paid, b.balance, b.lastPaymentOn ?? '']),
      ]
    }
    if (!R) return []
    if (tab === 'day') {
      return [
        [
          t('admin.reports.col.date'),
          t('admin.reports.col.bills'),
          t('admin.reports.col.taxable'),
          t('admin.reports.col.gst'),
          t('admin.reports.col.total'),
        ],
        ...R.days.map((d) => [d.day, d.bills, d.taxable, d.tax, d.total]),
      ]
    }
    if (tab === 'shop') {
      return [
        [
          t('admin.reports.col.shop'),
          t('admin.reports.col.bills'),
          t('admin.reports.col.taxable'),
          t('admin.reports.col.gst'),
          t('admin.reports.col.total'),
        ],
        ...R.shops.map((s) => [s.shopName, s.bills, s.taxable, s.tax, s.total]),
      ]
    }
    return [
      [
        t('admin.reports.col.item'),
        t('admin.reports.col.unit'),
        t('admin.reports.col.qty'),
        t('admin.reports.col.taxable'),
        t('admin.reports.col.amount'),
      ],
      ...R.items.map((i) => [i.nameEn, i.unit, i.qty, i.taxable, i.amount]),
    ]
  }

  async function onExport() {
    setExportError(null)
    try {
      const blob = new Blob([toCsv(csvRows())], { type: 'text/csv;charset=utf-8' })
      const name = tab === 'dues' ? `dues_${today}.csv` : `sales-by-${tab}_${from}_to_${to}.csv`
      await saveFile(blob, name, t('admin.reports.title'))
    } catch {
      setExportError(t('admin.reports.exportFailed'))
    }
  }

  const empty = (text: string) => (
    <p className={`${CARD} flex h-20 items-center px-5 text-mute`}>
      <span className="truncate">{text}</span>
    </p>
  )

  return (
    <section className="-mx-4 -mb-28 -mt-2 min-h-[calc(100dvh-4rem)] bg-page pb-32">
      <div className="rounded-b-[2rem] bg-paper px-5 pb-5 pt-5">
        <TopBar />
        <PageHeader title={t('admin.reports.title')} backTo="/admin/more" />
        <div
          role="group"
          aria-label={t('admin.reports.range')}
          className="-mx-5 flex h-10 gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={
                'h-10 shrink-0 whitespace-nowrap rounded-full border-[1.5px] px-4 text-sm font-semibold ' +
                (range === r ? 'border-brand bg-brand text-paper' : 'border-line bg-paper text-ink')
              }
            >
              {t(`admin.reports.range_${r}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4">
        {sales.isError && <Banner kind="error">{errorText(t, sales.error)}</Banner>}

        {/* Totals of the range */}
        <div className="h-[8.5rem] rounded-[1.75rem] bg-brand p-5 text-paper">
          <p className="h-5 truncate text-sm font-medium leading-5 text-white/85">
            {t('admin.reports.sales')}
          </p>
          <p className="h-11 truncate font-display text-[2.25rem] font-bold leading-[2.75rem]">
            {totals ? money(totals.total) : '–'}
          </p>
          <div className="mt-2 flex h-6 items-center gap-5 text-sm font-semibold">
            <span className="flex items-center gap-1.5">
              <Receipt size={16} aria-hidden="true" />
              <span className="sr-only">{t('admin.reports.col.bills')}: </span>
              {totals ? totals.bills : '–'}
            </span>
            <span className="flex items-center gap-1.5">
              <Percent size={16} aria-hidden="true" />
              <span className="sr-only">{t('admin.reports.col.gst')}: </span>
              {totals ? money(totals.tax) : '–'}
            </span>
          </div>
        </div>

        {/* Which list */}
        <div
          role="group"
          aria-label={t('admin.reports.title')}
          className="grid h-12 grid-cols-4 gap-1 rounded-full bg-paper p-1 shadow-[0_1px_2px_rgba(15,26,20,0.08)]"
        >
          {TABS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={tab === k}
              onClick={() => setTab(k)}
              className={
                'min-w-0 truncate rounded-full px-1 text-sm font-semibold ' +
                (tab === k ? 'bg-brand text-paper' : 'text-mute')
              }
            >
              {t(`admin.reports.tab_${k}`)}
            </button>
          ))}
        </div>

        {loading ? (
          <ul className={CARD} aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="h-[4.25rem] border-b border-line last:border-b-0" />
            ))}
          </ul>
        ) : tab === 'day' ? (
          !report || report.days.length === 0 ? (
            empty(t('admin.reports.none'))
          ) : (
            <ul className={`${CARD} divide-y divide-line`}>
              {[...report.days].reverse().map((d) => (
                <li key={d.day} className={ROW}>
                  <div className="min-w-0 flex-1">
                    <p className="h-6 truncate font-semibold leading-6">
                      {formatDay(d.day, language)}
                    </p>
                    <p className="h-5 truncate text-sm leading-5 text-mute">
                      {t('admin.reports.billsCount', { count: d.bills })}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold">{money(d.total)}</p>
                </li>
              ))}
            </ul>
          )
        ) : tab === 'shop' ? (
          !report || report.shops.length === 0 ? (
            empty(t('admin.reports.none'))
          ) : (
            <ul className={`${CARD} divide-y divide-line`}>
              {report.shops.map((s) => (
                <li key={s.shopName} className={ROW}>
                  <Avatar name={s.shopName} />
                  <div className="min-w-0 flex-1">
                    <p className="h-6 truncate font-semibold leading-6">{s.shopName}</p>
                    <p className="h-5 truncate text-sm leading-5 text-mute">
                      {t('admin.reports.billsCount', { count: s.bills })}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold">{money(s.total)}</p>
                </li>
              ))}
            </ul>
          )
        ) : tab === 'item' ? (
          !report || report.items.length === 0 ? (
            empty(t('admin.reports.none'))
          ) : (
            <ul className={`${CARD} divide-y divide-line`}>
              {report.items.map((i) => (
                <li key={`${i.nameEn}|${i.unit}`} className={ROW}>
                  <div className="min-w-0 flex-1">
                    <p className="h-6 truncate font-semibold leading-6">
                      {displayNames(i.nameEn, i.nameTa, language).primary}
                    </p>
                    <p className="h-5 truncate text-sm leading-5 text-mute">
                      {formatQty(i.qty)} {i.unit}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold">{money(i.amount)}</p>
                </li>
              ))}
            </ul>
          )
        ) : owing.length === 0 ? (
          empty(t('admin.reports.noDues'))
        ) : (
          <ul className={`${CARD} divide-y divide-line`}>
            {owing.map((b) => (
              <li key={b.shopId} className={ROW}>
                <Avatar name={b.nameEn} tone="amber" />
                <div className="min-w-0 flex-1">
                  <p className="h-6 truncate font-semibold leading-6">
                    {displayNames(b.nameEn, b.nameTa, language).primary}
                  </p>
                  <p className="h-5 truncate text-sm leading-5 text-mute">
                    {b.lastPaymentOn
                      ? t('admin.reports.lastPaid', { date: formatDay(b.lastPaymentOn, language) })
                      : t('admin.reports.neverPaid')}
                  </p>
                </div>
                <p className="shrink-0 font-bold text-amber">{money(b.balance)}</p>
              </li>
            ))}
          </ul>
        )}

        {exportError && <Banner kind="error">{exportError}</Banner>}
        <button
          type="button"
          className="btn btn-outline h-[3.25rem] w-full rounded-full"
          disabled={loading || (tab === 'dues' ? owing.length === 0 : !report)}
          onClick={() => void onExport()}
        >
          <Download size={18} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{t('admin.reports.export')}</span>
        </button>
      </div>
    </section>
  )
}
