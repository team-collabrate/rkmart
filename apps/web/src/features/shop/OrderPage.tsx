import { Search, ShoppingCart } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Banner, Empty, Loading } from '../../components/ui'
import type { CatalogItem } from '../../data/shopApi'
import { formatDay, todayISO } from '../../lib/dates'
import { formatINR, formatRupees } from '../../lib/money'
import { displayNames } from '../../lib/names'
import { errorText } from '../admin/queries'
import { useAuth } from '../auth/AuthProvider'
import type { Language } from '../auth/types'
import { cartCount, cartTotal } from './cart'
import { useCart } from './cartStore'
import { ItemArt } from './ItemArt'
import { TINT_BG, tintFor } from './itemVisual'
import { QtyControl } from './QtyControl'
import { useCatalog } from './queries'

const ALL = '__all__'

/** Today's items as soft-coloured cards with their rates. Tap Add, set the quantity, review the order. */
export function OrderPage() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const { profile } = useAuth()
  const lines = useCart((s) => s.lines)
  const setQty = useCart((s) => s.setQty)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(ALL)
  const today = todayISO()
  const catalog = useCatalog(today)

  const profileId = profile?.id
  useEffect(() => {
    if (profileId) useCart.getState().claim(profileId)
  }, [profileId])

  const rates = useMemo(
    () => Object.fromEntries((catalog.data ?? []).map((i) => [i.id, i.rate])),
    [catalog.data],
  )

  if (catalog.isPending) return <Loading />
  if (catalog.isError) return <Banner kind="error">{errorText(t, catalog.error)}</Banner>

  const categories = [...new Set(catalog.data.map((i) => i.category || '—'))]
  const q = search.trim().toLowerCase()
  const shown = catalog.data.filter(
    (i) =>
      (category === ALL || (i.category || '—') === category) &&
      (!q || i.nameEn.toLowerCase().includes(q) || i.nameTa.toLowerCase().includes(q)),
  )
  const groups = new Map<string, CatalogItem[]>()
  for (const item of shown) {
    const key = item.category || '—'
    groups.set(key, [...(groups.get(key) ?? []), item])
  }

  const count = cartCount(lines, rates)
  const total = cartTotal(lines, rates)

  return (
    <section className="-mx-4 -mt-4 pb-28">
      <div className="rounded-b-3xl bg-brand px-4 pb-5 pt-5 text-paper">
        <h1 className="text-2xl">{t('shop.order.title')}</h1>
        <p className="mb-4 text-sm text-white/85">
          {t('shop.order.ratesFor', { date: formatDay(today, language) })}
        </p>
        {catalog.data.length > 0 && (
          <div className="relative">
            <Search
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mute"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('shop.order.search')}
              aria-label={t('shop.order.search')}
              className="field rounded-full border-transparent pl-11 text-ink"
            />
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        {catalog.data.length === 0 ? (
          <Empty>{t('shop.order.noRates')}</Empty>
        ) : (
          <>
            {categories.length > 1 && (
              <div
                role="group"
                aria-label={t('shop.order.title')}
                className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {[ALL, ...categories].map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={category === c}
                    onClick={() => setCategory(c)}
                    className={
                      'min-h-10 shrink-0 rounded-full border-2 px-4 text-sm font-semibold ' +
                      (category === c
                        ? 'border-brand bg-brand text-paper'
                        : 'border-line bg-paper text-ink')
                    }
                  >
                    {c === ALL ? t('shop.order.all') : c}
                  </button>
                ))}
              </div>
            )}

            {shown.length === 0 ? (
              <Empty>{t('shop.order.noMatch')}</Empty>
            ) : (
              <div className="flex flex-col gap-6">
                {[...groups.entries()].map(([cat, items]) => (
                  <div key={cat}>
                    <h2 className="mb-3 text-lg">{cat}</h2>
                    <ul className="grid grid-cols-2 gap-3">
                      {items.map((item) => {
                        const names = displayNames(item.nameEn, item.nameTa, language)
                        return (
                          <li
                            key={item.id}
                            className={`flex flex-col rounded-3xl p-3 ${TINT_BG[tintFor(item.category || '—')]}`}
                          >
                            <ItemArt nameEn={item.nameEn} category={item.category} />
                            <p className="line-clamp-2 font-semibold leading-snug">
                              {names.primary}
                            </p>
                            {names.secondary ? (
                              <p className="truncate text-sm text-mute">{names.secondary}</p>
                            ) : (
                              <span className="h-5" aria-hidden="true" />
                            )}
                            <p className="mb-3 mt-1">
                              <span className="font-display text-lg font-bold">
                                ₹{formatRupees(item.rate)}
                              </span>{' '}
                              <span className="text-sm text-mute">
                                {t('shop.order.perUnit', { unit: item.unit })}
                              </span>
                            </p>
                            <div className="mt-auto">
                              <QtyControl
                                name={names.primary}
                                qty={lines[item.id] ?? 0}
                                onChange={(qty) =>
                                  setQty(item.id, qty, { en: item.nameEn, ta: item.nameTa })
                                }
                              />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {count > 0 && (
        <div className="fixed bottom-[6.25rem] left-1/2 z-10 w-full max-w-[30rem] -translate-x-1/2 px-4">
          <Link
            to="/shop/order/review"
            className="btn flex w-full justify-between rounded-2xl px-5 py-3 text-base no-underline shadow-lg"
          >
            <span>
              <ShoppingCart size={18} aria-hidden="true" className="mr-2 inline" />
              {t('shop.order.cartItems', { count })} · ₹{formatINR(total)}
            </span>
            <span>{t('shop.order.review')}</span>
          </Link>
        </div>
      )}
    </section>
  )
}
