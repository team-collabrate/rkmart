import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  ChevronLeft,
  MessageSquareText,
  Search,
  ShoppingCart,
  TriangleAlert,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { Banner, Empty } from '../../components/ui'
import { useAdminApi } from '../../data/apiContext'
import { todayISO } from '../../lib/dates'
import { formatINR, formatRupees, roundPaise } from '../../lib/money'
import { displayNames } from '../../lib/names'
import type { Language } from '../auth/types'
import { cartCount } from '../shop/cart'
import { emojiFor, TINT_BG, tintFor } from '../shop/itemVisual'
import { QtyControl } from '../shop/QtyControl'
import { errorText, useProducts, useRates, useShops } from './queries'

// Built to stay still, like the other admin pages: fixed heights, one line per element, no animation.

/**
 * The admin orders for a shop that did not use the app (it phoned or visited). Pick the shop, set
 * the quantities from today's rates, place the order. It then opens like any other order, where the
 * admin can fix quantities, make the bill and mark it delivered.
 */
export function NewOrderPage() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const api = useAdminApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const today = todayISO()
  const shops = useShops()
  const products = useProducts()
  const rates = useRates(today)

  const [shopId, setShopId] = useState<string | null>(null)
  const [shopSearch, setShopSearch] = useState('')
  const [lines, setLines] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loading = shops.isPending || products.isPending || rates.isPending
  const rateMap = useMemo(() => rates.data ?? {}, [rates.data])
  const items = useMemo(
    () =>
      (products.data ?? [])
        .filter((p) => p.isActive && rateMap[p.id] !== undefined)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [products.data, rateMap],
  )
  const withoutRate = (products.data ?? []).filter(
    (p) => p.isActive && rateMap[p.id] === undefined,
  ).length
  const activeShops = (shops.data ?? []).filter((s) => s.isActive)
  const q = shopSearch.trim().toLowerCase()
  const shownShops = activeShops.filter(
    (s) => !q || s.nameEn.toLowerCase().includes(q) || s.nameTa.toLowerCase().includes(q),
  )

  const count = cartCount(lines, rateMap)
  const total = roundPaise(
    Object.entries(lines).reduce((sum, [id, qty]) => sum + qty * (rateMap[id] ?? 0), 0),
  )

  const place = useMutation({
    mutationFn: () =>
      api.placeOrderForShop(
        shopId!,
        Object.entries(lines)
          .filter(([id, qty]) => qty > 0 && rateMap[id] !== undefined)
          .map(([productId, qty]) => ({ productId, qty })),
        note,
      ),
    onSuccess: async ({ orderId }) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      void navigate(`/admin/orders/${orderId}`)
    },
    onError: (e) => setError(errorText(t, e)),
  })

  const ready = shopId !== null && count > 0

  return (
    <section className="-mx-4 -mb-28 -mt-2 min-h-[calc(100dvh-4rem)] bg-page px-4 pb-52 pt-4">
      <div className="mb-4 flex h-11 items-center gap-3">
        <Link
          to="/admin/orders"
          aria-label={t('admin.common.back')}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-paper shadow-[0_1px_2px_rgba(15,26,20,0.08)]"
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[1.75rem] leading-tight">
          {t('admin.newOrder.title')}
        </h1>
      </div>

      {/* 1. Which shop */}
      <h2 className="mb-2 flex h-6 items-center gap-2 text-base leading-6">
        <span className="grid size-6 place-items-center rounded-full bg-brand text-xs text-paper">
          1
        </span>
        {t('admin.newOrder.shop')}
      </h2>
      <div className="mb-5 overflow-hidden rounded-[1.75rem] border border-line bg-paper">
        <label className="flex h-12 items-center gap-2 border-b border-line px-4">
          <Search size={18} aria-hidden="true" className="shrink-0 text-mute" />
          <span className="sr-only">{t('admin.common.search')}</span>
          <input
            type="search"
            value={shopSearch}
            onChange={(e) => setShopSearch(e.target.value)}
            placeholder={t('admin.common.search')}
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <ul
          role="radiogroup"
          aria-label={t('admin.newOrder.shop')}
          className="h-[13.5rem] overflow-y-auto"
        >
          {loading ? (
            [0, 1, 2].map((i) => (
              <li key={i} aria-hidden="true" className="h-[4.5rem] border-b border-line" />
            ))
          ) : shownShops.length === 0 ? (
            <li className="p-4 text-sm text-mute">{t('admin.common.noResults')}</li>
          ) : (
            shownShops.map((s) => {
              const names = displayNames(s.nameEn, s.nameTa, language)
              const on = shopId === s.id
              return (
                <li key={s.id}>
                  <label
                    className={
                      'flex h-[4.5rem] cursor-pointer items-center gap-3 border-b border-line px-4 last:border-b-0 ' +
                      (on ? 'bg-brand-soft' : '')
                    }
                  >
                    <input
                      type="radio"
                      name="new-order-shop"
                      value={s.id}
                      checked={on}
                      onChange={() => {
                        setShopId(s.id)
                        setError(null)
                      }}
                      className="sr-only"
                    />
                    <Avatar name={s.nameEn} />
                    <span className="min-w-0 flex-1">
                      <span className="block h-6 truncate font-semibold leading-6">
                        {names.primary}
                      </span>
                      <span className="block h-5 truncate text-sm leading-5 text-mute">
                        {s.address}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={
                        'grid size-7 shrink-0 place-items-center rounded-full ' +
                        (on ? 'bg-brand text-paper' : 'border border-line')
                      }
                    >
                      {on && <Check size={16} />}
                    </span>
                  </label>
                </li>
              )
            })
          )}
        </ul>
      </div>

      {/* 2. Items */}
      <h2 className="mb-2 flex h-6 items-center gap-2 text-base leading-6">
        <span className="grid size-6 place-items-center rounded-full bg-brand text-xs text-paper">
          2
        </span>
        {t('admin.newOrder.items')}
      </h2>
      {withoutRate > 0 && items.length > 0 && (
        <p className="mb-2 flex h-5 items-center gap-1.5 text-xs text-amber">
          <TriangleAlert size={14} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{t('admin.newOrder.noRate', { count: withoutRate })}</span>
        </p>
      )}
      {!loading && items.length === 0 ? (
        <Empty>{t('admin.newOrder.noRates')}</Empty>
      ) : (
        <ul className="mb-5 divide-y divide-line overflow-hidden rounded-[1.75rem] border border-line bg-paper">
          {loading
            ? [0, 1, 2, 3].map((i) => <li key={i} aria-hidden="true" className="h-[4.75rem]" />)
            : items.map((item) => {
                const names = displayNames(item.nameEn, item.nameTa, language)
                return (
                  <li key={item.id} className="flex h-[4.75rem] items-center gap-3 px-3.5">
                    <span
                      aria-hidden="true"
                      className={`grid size-11 shrink-0 place-items-center rounded-2xl text-xl ${
                        TINT_BG[tintFor(item.category || '—')]
                      }`}
                    >
                      {emojiFor(item.nameEn, item.category)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="h-6 truncate font-semibold leading-6">{names.primary}</p>
                      <p className="h-5 truncate text-sm leading-5 text-mute">
                        ₹{formatRupees(rateMap[item.id])}/{item.unit}
                      </p>
                    </div>
                    <div className="w-[8.5rem] shrink-0">
                      <QtyControl
                        name={names.primary}
                        qty={lines[item.id] ?? 0}
                        onChange={(qty) => {
                          setLines({ ...lines, [item.id]: qty })
                          setError(null)
                        }}
                      />
                    </div>
                  </li>
                )
              })}
        </ul>
      )}

      <label className="mb-4 flex h-12 items-center gap-2 rounded-2xl border border-line bg-paper px-3 focus-within:border-brand">
        <MessageSquareText size={18} aria-hidden="true" className="shrink-0 text-mute" />
        <span className="sr-only">{t('admin.newOrder.note')}</span>
        <input
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('admin.newOrder.note')}
          className="min-w-0 flex-1 bg-transparent outline-none"
        />
      </label>

      {error && (
        <div className="mb-4">
          <Banner kind="error">{error}</Banner>
        </div>
      )}

      <div className="fixed bottom-[6.25rem] left-1/2 z-10 w-full max-w-[30rem] -translate-x-1/2 px-4">
        <button
          type="button"
          className="btn flex h-14 w-full justify-between rounded-full px-5 text-base shadow-[0_8px_30px_rgba(15,26,20,0.18)]"
          disabled={!ready || place.isPending}
          aria-label={t('admin.newOrder.place')}
          onClick={() => {
            setError(null)
            place.mutate()
          }}
        >
          <span className="flex min-w-0 items-center gap-2">
            <ShoppingCart size={20} aria-hidden="true" className="shrink-0" />
            <span className="truncate">
              {count} · ₹{formatINR(total)}
            </span>
          </span>
          <span className="shrink-0">
            {place.isPending ? t('admin.common.saving') : t('admin.newOrder.placeShort')}
          </span>
        </button>
      </div>
    </section>
  )
}
