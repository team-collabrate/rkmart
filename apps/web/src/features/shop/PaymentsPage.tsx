import { Check, Receipt, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Banner } from '../../components/ui'
import { formatDay } from '../../lib/dates'
import { formatINR, formatRupees } from '../../lib/money'
import { errorText } from '../admin/queries'
import type { Language } from '../auth/types'
import { ShopPage, SkeletonRows } from './ShopPage'
import { useMyStatement } from './statementQuery'

// Designed in Figma first ("Shop / Payments"). Fixed row heights, one line per element, no animation.

const CARD = 'rounded-[1.75rem] border border-line bg-paper'

/** The shop owner's view of what they owe, with every bill and payment. */
export function ShopPaymentsPage() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const statement = useMyStatement()

  if (statement.isPending) {
    return (
      <ShopPage title={t('shop.payments.title')}>
        <div className="h-[8.25rem] rounded-[1.75rem] bg-line" aria-hidden="true" />
        <SkeletonRows count={3} height="h-[4.75rem]" />
      </ShopPage>
    )
  }
  if (statement.isError) {
    return (
      <ShopPage title={t('shop.payments.title')}>
        <Banner kind="error">{errorText(t, statement.error)}</Banner>
      </ShopPage>
    )
  }
  const s = statement.data
  const owes = s.balance > 0
  const advance = s.balance < 0

  return (
    <ShopPage title={t('shop.payments.title')}>
      <div
        className={`h-[8.25rem] rounded-[1.75rem] p-5 ${owes ? 'bg-amber-soft text-amber' : 'bg-brand-soft text-brand-dark'}`}
      >
        {/* The full sentences stay for screen readers. */}
        {owes ? (
          <>
            <p className="sr-only">{t('shop.payments.owe', { amount: formatINR(s.balance) })}</p>
            <p className="sr-only">
              {t('shop.payments.reminder', { amount: formatINR(s.balance) })}
            </p>
          </>
        ) : advance ? (
          <p className="sr-only">{t('shop.payments.advance', { amount: formatINR(-s.balance) })}</p>
        ) : (
          <p className="sr-only">{t('shop.payments.nothingDue')}</p>
        )}
        <div className="flex h-12 items-center gap-3" aria-hidden="true">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-paper">
            {owes || advance ? <Wallet size={22} /> : <Check size={22} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-[1.75rem] font-bold leading-7">
              ₹{formatRupees(Math.abs(s.balance))}
            </span>
            <span className="block truncate text-sm font-medium leading-5">
              {owes
                ? t('shop.payments.dueShort')
                : advance
                  ? t('shop.payments.advanceShort')
                  : t('shop.payments.clearShort')}
            </span>
          </span>
        </div>
        <p className="mt-2 h-5 truncate text-sm font-medium leading-5" aria-hidden="true">
          {t('shop.payments.billed')} ₹{formatRupees(s.invoiced)} · {t('shop.payments.paid')} ₹
          {formatRupees(s.paid)}
        </p>
        <p className="h-5 truncate text-sm leading-5 opacity-90">{t('shop.payments.howToPay')}</p>
      </div>

      <div>
        <h2 className="mb-2 h-6 px-1 text-lg leading-6">{t('shop.payments.entries')}</h2>
        {s.entries.length === 0 ? (
          <p className={`${CARD} flex h-20 items-center px-5 text-mute`}>
            <span className="truncate">{t('shop.payments.empty')}</span>
          </p>
        ) : (
          <ul className={`${CARD} divide-y divide-line overflow-hidden`}>
            {s.entries.map((e) => {
              const bill = e.kind !== 'payment'
              return (
                <li
                  key={`${e.kind}-${e.id}`}
                  className="flex h-[4.75rem] items-center gap-3 px-3.5"
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-11 shrink-0 place-items-center rounded-full ${bill ? 'bg-blue-soft text-blue' : 'bg-brand-soft text-brand-dark'}`}
                  >
                    {bill ? <Receipt size={22} /> : <Wallet size={22} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="h-6 truncate font-semibold leading-6">
                      {e.kind === 'payment'
                        ? t('shop.payments.payment', {
                            method: t(`shop.payments.methods.${e.method}`),
                          })
                        : t('shop.payments.bill', { no: e.label })}
                    </p>
                    <p className="h-5 truncate text-sm leading-5 text-mute">
                      {formatDay(e.date, language)}
                      {e.invoiceNo && ` · ${t('shop.payments.forInvoice', { no: e.invoiceNo })}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`h-6 font-bold leading-6 ${bill ? '' : 'text-brand-dark'}`}>
                      {bill ? '+' : '−'}₹{formatRupees(e.amount)}
                    </p>
                    <p className="h-5 text-sm leading-5 text-mute">
                      {t('shop.payments.balanceAfter', { amount: formatRupees(e.balanceAfter) })}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </ShopPage>
  )
}
