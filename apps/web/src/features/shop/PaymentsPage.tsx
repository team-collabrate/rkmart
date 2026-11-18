import { useTranslation } from 'react-i18next'
import { Banner, Empty, Loading, PageHeader } from '../../components/ui'
import { formatDay } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { errorText } from '../admin/queries'
import type { Language } from '../auth/types'
import { useMyStatement } from './statementQuery'

/** The shop owner's view of what they owe, with a payment reminder and every bill and payment. */
export function ShopPaymentsPage() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const statement = useMyStatement()

  if (statement.isPending) return <Loading />
  if (statement.isError) return <Banner kind="error">{errorText(t, statement.error)}</Banner>
  const s = statement.data

  return (
    <section className="max-w-2xl">
      <PageHeader title={t('shop.payments.title')} />

      <div className="mb-4 rounded-xl border-2 border-ink p-4">
        {s.balance > 0 ? (
          <>
            <p className="font-display text-3xl font-bold">
              {t('shop.payments.owe', { amount: formatINR(s.balance) })}
            </p>
            <p className="mt-2 rounded-xl border-2 border-dashed border-ink px-3 py-2 font-medium">
              {t('shop.payments.reminder', { amount: formatINR(s.balance) })}
            </p>
          </>
        ) : s.balance < 0 ? (
          <p className="font-display text-xl font-bold">
            {t('shop.payments.advance', { amount: formatINR(-s.balance) })}
          </p>
        ) : (
          <p className="font-display text-xl font-bold">{t('shop.payments.nothingDue')}</p>
        )}
        <p className="mt-2 text-sm text-mute">
          {t('shop.payments.billed')} ₹{formatINR(s.invoiced)} · {t('shop.payments.paid')} ₹
          {formatINR(s.paid)}
        </p>
        <p className="mt-2 text-sm text-mute">{t('shop.payments.howToPay')}</p>
      </div>

      <h2 className="mb-2 text-lg">{t('shop.payments.entries')}</h2>
      {s.entries.length === 0 ? (
        <Empty>{t('shop.payments.empty')}</Empty>
      ) : (
        <ul className="divide-y-2 divide-hair rounded-xl border-2 border-ink">
          {s.entries.map((e) => (
            <li
              key={`${e.kind}-${e.id}`}
              className="flex items-start justify-between gap-3 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {e.kind === 'payment'
                    ? t('shop.payments.payment', { method: t(`shop.payments.methods.${e.method}`) })
                    : t('shop.payments.bill', { no: e.label })}
                </p>
                <p className="text-sm text-mute">
                  {formatDay(e.date, language)}
                  {e.invoiceNo && ` · ${t('shop.payments.forInvoice', { no: e.invoiceNo })}`}
                </p>
                <p className="text-sm text-mute">
                  {t('shop.payments.balanceAfter', { amount: formatINR(e.balanceAfter) })}
                </p>
              </div>
              <p className="whitespace-nowrap font-bold">
                {e.kind === 'payment' ? '−' : '+'}₹{formatINR(e.amount)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
