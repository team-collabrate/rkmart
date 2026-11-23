import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, MessageSquareText, TriangleAlert, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { Banner } from '../../components/ui'
import { useShopApi } from '../../data/apiContext'
import { todayISO } from '../../lib/dates'
import { formatINR, formatRupees } from '../../lib/money'
import { displayNames } from '../../lib/names'
import { errorText } from '../admin/queries'
import type { Language } from '../auth/types'
import { cartCount, cartTotal, splitAvailable } from './cart'
import { useCart } from './cartStore'
import { emojiFor, TINT_BG, tintFor } from './itemVisual'
import { QtyControl } from './QtyControl'
import { shopKeys, useCatalog } from './queries'
import { PhonePage, SkeletonRows } from '../../components/PhonePage'

// Designed in Figma first ("Shop / Review"). Fixed row heights, one line per element, no animation.

const CARD = 'rounded-[1.75rem] border border-line bg-paper'

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

  if (catalog.isPending) {
    return (
      <PhonePage title={t('shop.review.title')} backTo="/shop/order">
        <SkeletonRows count={3} height="h-[4.75rem]" />
      </PhonePage>
    )
  }
  if (catalog.isError) {
    return (
      <PhonePage title={t('shop.review.title')} backTo="/shop/order">
        <Banner kind="error">{errorText(t, catalog.error)}</Banner>
      </PhonePage>
    )
  }

  const { available, unavailable } = splitAvailable(lines, rates)
  const repeated = Boolean((location.state as { repeated?: boolean } | null)?.repeated)

  if (available.length === 0 && unavailable.length === 0) {
    return (
      <PhonePage title={t('shop.review.title')} backTo="/shop/order">
        <p className={`${CARD} flex h-20 items-center px-5 text-mute`}>
          <span className="truncate">{t('shop.review.empty')}</span>
        </p>
        <Link to="/shop/order" className="btn h-[3.25rem] w-full rounded-full no-underline">
          {t('shop.review.addItems')}
        </Link>
      </PhonePage>
    )
  }

  function onPlace() {
    setFailure(null)
    place.mutate(available.map((id) => ({ productId: id, qty: lines[id] })))
  }

  const count = cartCount(lines, rates)

  return (
    <PhonePage title={t('shop.review.title')} backTo="/shop/order" bottomSpace>
      {repeated && unavailable.length > 0 && (
        <Banner kind="info">{t('shop.review.skipped', { count: unavailable.length })}</Banner>
      )}

      {available.length > 0 && (
        <ul className={`${CARD} divide-y divide-line overflow-hidden`}>
          {available.map((id) => {
            const item = byId.get(id)!
            const names = displayNames(item.nameEn, item.nameTa, language)
            const lineTotal = lines[id] * item.rate
            return (
              <li key={id} className="flex h-[4.75rem] items-center gap-3 px-3.5">
                <span
                  aria-hidden="true"
                  className={`grid size-12 shrink-0 place-items-center rounded-2xl text-2xl ${TINT_BG[tintFor(item.category || '—')]}`}
                >
                  {emojiFor(item.nameEn, item.category)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="h-6 truncate font-semibold leading-6">{names.primary}</p>
                  <p className="flex h-5 items-baseline gap-1 text-sm leading-5">
                    <span className="shrink-0 font-bold text-brand-dark">
                      ₹{formatRupees(lineTotal)}
                    </span>
                    <span className="truncate text-mute">
                      · ₹{formatRupees(item.rate)}/{item.unit}
                    </span>
                  </p>
                </div>
                <div className="w-[8.5rem] shrink-0">
                  <QtyControl
                    name={names.primary}
                    qty={lines[id]}
                    onChange={(q) => setQty(id, q, { en: item.nameEn, ta: item.nameTa })}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {unavailable.length > 0 && (
        <div className="rounded-[1.75rem] bg-amber-soft p-4 text-amber">
          <p className="flex h-6 items-center gap-2 font-semibold">
            <TriangleAlert size={18} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{t('shop.review.unavailableTitle')}</span>
          </p>
          <p className="sr-only">{t('shop.review.unavailableBody')}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {unavailable.map((id) => {
              const label = labels[id]
              const name = label ? displayNames(label.en, label.ta, language).primary : id
              return (
                <li key={id} className="flex h-10 items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <button
                    type="button"
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-paper"
                    onClick={() => setQty(id, 0)}
                    aria-label={t('shop.review.remove', { name })}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <label className={`${CARD} flex items-start gap-3 px-4 py-3 focus-within:border-brand`}>
        <MessageSquareText size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-mute" />
        <span className="sr-only">{t('shop.review.note')}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder={t('shop.review.note')}
          aria-describedby="note-hint"
          className="h-12 min-w-0 flex-1 resize-none bg-transparent outline-none"
        />
        <span id="note-hint" className="sr-only">
          {t('shop.review.noteHint')}
        </span>
      </label>

      <div className={`${CARD} flex h-[4.75rem] items-center justify-between gap-3 px-5`}>
        <span className="sr-only">{t('shop.review.total')}</span>
        <span className="font-semibold text-mute" aria-hidden="true">
          {t('shop.review.totalShort')}
        </span>
        <span className="font-display text-[1.75rem] font-bold">
          ₹{formatINR(cartTotal(lines, rates))}
        </span>
      </div>
      <p className="sr-only">{t('shop.review.totalNote')}</p>

      {failure && <Banner kind="error">{failure}</Banner>}

      <div className="fixed bottom-[6.25rem] left-1/2 z-10 w-full max-w-[30rem] -translate-x-1/2 px-4">
        <button
          type="button"
          className="btn flex h-14 w-full justify-between rounded-full px-6 text-base shadow-[0_8px_30px_rgba(15,26,20,0.18)]"
          onClick={onPlace}
          aria-label={place.isPending ? t('shop.review.placing') : t('shop.review.place')}
          disabled={place.isPending || available.length === 0}
        >
          <span className="min-w-0 truncate">{t('shop.order.cartItems', { count })}</span>
          <span className="flex shrink-0 items-center gap-2">
            {place.isPending ? t('shop.review.placing') : t('shop.review.place')}
            <Check size={20} aria-hidden="true" />
          </span>
        </button>
      </div>
    </PhonePage>
  )
}
