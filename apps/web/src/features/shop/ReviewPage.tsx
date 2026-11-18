import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { Banner, Empty, Field, Loading, PageHeader } from '../../components/ui'
import { useShopApi } from '../../data/apiContext'
import { todayISO } from '../../lib/dates'
import { formatINR, formatRupees } from '../../lib/money'
import { displayNames } from '../../lib/names'
import { errorText } from '../admin/queries'
import type { Language } from '../auth/types'
import { cartTotal, splitAvailable } from './cart'
import { useCart } from './cartStore'
import { QtyControl } from './QtyControl'
import { shopKeys, useCatalog } from './queries'

/** Last look at the cart before sending: change quantities, add a note, place the order. */
export function ReviewPage() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const api = useShopApi()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const today = todayISO()

  const lines = useCart((s) => s.lines)
  const note = useCart((s) => s.note)
  const setQty = useCart((s) => s.setQty)
  const labels = useCart((s) => s.labels)
  const setNote = useCart((s) => s.setNote)
  const catalog = useCatalog(today)
  const [failure, setFailure] = useState<string | null>(null)

  const byId = useMemo(() => new Map((catalog.data ?? []).map((i) => [i.id, i])), [catalog.data])
  const rates = useMemo(
    () => Object.fromEntries((catalog.data ?? []).map((i) => [i.id, i.rate])),
    [catalog.data],
  )

  const place = useMutation({
    mutationFn: (payload: { productId: string; qty: number }[]) => api.placeOrder(payload, note),
    onSuccess: async ({ orderId }) => {
      useCart.getState().clear()
      await queryClient.invalidateQueries({ queryKey: shopKeys.orders })
      void navigate(`/shop/orders/${orderId}`, { state: { placed: true }, replace: true })
    },
    onError: async (error) => {
      setFailure(errorText(t, error))
      // Rates or items may have changed: reload them so the screen shows the truth.
      await queryClient.invalidateQueries({ queryKey: shopKeys.catalog(today) })
    },
  })

  if (catalog.isPending) return <Loading />
  if (catalog.isError) return <Banner kind="error">{errorText(t, catalog.error)}</Banner>

  const { available, unavailable } = splitAvailable(lines, rates)
  const repeated = Boolean((location.state as { repeated?: boolean } | null)?.repeated)

  if (available.length === 0 && unavailable.length === 0) {
    return (
      <section>
        <PageHeader title={t('shop.review.title')} />
        <Empty>{t('shop.review.empty')}</Empty>
        <Link to="/shop/order" className="btn mt-4 no-underline">
          {t('shop.review.addItems')}
        </Link>
      </section>
    )
  }

  function onPlace() {
    setFailure(null)
    place.mutate(available.map((id) => ({ productId: id, qty: lines[id] })))
  }

  return (
    <section className="max-w-2xl pb-8">
      <PageHeader title={t('shop.review.title')} backTo="/shop/order" />

      {repeated && unavailable.length > 0 && (
        <div className="mb-4">
          <Banner kind="info">{t('shop.review.skipped', { count: unavailable.length })}</Banner>
        </div>
      )}

      {available.length > 0 && (
        <ul className="mb-4 divide-y divide-line rounded-2xl border border-line">
          {available.map((id) => {
            const item = byId.get(id)!
            const names = displayNames(item.nameEn, item.nameTa, language)
            const lineTotal = lines[id] * item.rate
            return (
              <li key={id} className="flex items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{names.primary}</p>
                  <p className="text-sm text-mute">
                    ₹{formatRupees(item.rate)} {t('shop.order.perUnit', { unit: item.unit })}
                  </p>
                  <p className="font-bold">₹{formatINR(lineTotal)}</p>
                </div>
                <QtyControl
                  name={names.primary}
                  qty={lines[id]}
                  onChange={(q) => setQty(id, q, { en: item.nameEn, ta: item.nameTa })}
                />
              </li>
            )
          })}
        </ul>
      )}

      {unavailable.length > 0 && (
        <div className="mb-4 rounded-2xl border-2 border-dashed border-ink p-3">
          <p className="font-semibold">{t('shop.review.unavailableTitle')}</p>
          <p className="text-sm text-mute">{t('shop.review.unavailableBody')}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {unavailable.map((id) => {
              const label = labels[id]
              const name = label ? displayNames(label.en, label.ta, language).primary : id
              return (
                <li key={id} className="flex items-center justify-between gap-3">
                  <span>{name}</span>
                  <button
                    type="button"
                    className="btn btn-outline min-h-9"
                    onClick={() => setQty(id, 0)}
                    aria-label={t('shop.review.remove', { name })}
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="mb-4">
        <Field id="note" label={t('shop.review.note')} hint={t('shop.review.noteHint')}>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            className="field"
          />
        </Field>
      </div>

      <div className="mb-4 flex items-baseline justify-between border-t-2 border-line pt-3">
        <span className="font-semibold">{t('shop.review.total')}</span>
        <span className="font-display text-2xl font-bold">
          ₹{formatINR(cartTotal(lines, rates))}
        </span>
      </div>
      <p className="mb-4 text-sm text-mute">{t('shop.review.totalNote')}</p>

      {failure && (
        <div className="mb-4">
          <Banner kind="error">{failure}</Banner>
        </div>
      )}
      <button
        type="button"
        className="btn w-full"
        onClick={onPlace}
        disabled={place.isPending || available.length === 0}
      >
        {place.isPending ? t('shop.review.placing') : t('shop.review.place')}
      </button>
    </section>
  )
}
