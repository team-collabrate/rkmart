import { ArrowRight, Search, ShoppingCart } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BrandLogo } from '../../components/BrandLogo'
import { LanguageSwitch } from '../../components/LanguageSwitch'
import { Banner, Empty } from '../../components/ui'
import type { CatalogItem } from '../../data/shopApi'
import { formatDay, todayISO } from '../../lib/dates'
import { formatINR, formatRupees } from '../../lib/money'
import { displayNames } from '../../lib/names'
import { errorText } from '../admin/queries'
import { useAuth } from '../auth/AuthProvider'
import type { Language } from '../auth/types'
import { cartCount, cartTotal } from './cart'
import { useCart } from './cartStore'
import { emojiFor, TINT_BG, tintFor } from './itemVisual'
import { QtyControl } from './QtyControl'
import { useCatalog } from './queries'
import { LogOut } from 'lucide-react'

// Built to stay still, like the admin pages: fixed row heights, one line per element, no animation.
// Designed in Figma first ("Shop / Order v2").

const ALL = '__all__'
const ROW = 'flex h-[4.75rem] items-center gap-3 px-3.5'

/** Today's items as a list: category chips and search on top, one fixed-height row per item. */
export function OrderPage() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const { profile, signOut } = useAuth()
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

  const items = catalog.data ?? []
  const categories = [...new Set(items.map((i) => i.category || '—'))]
  const q = search.trim().toLowerCase()
  const shown = items.filter(
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
    <section className="-mx-4 -mb-28 -mt-2 min-h-[calc(100dvh-4rem)] bg-page pb-40">
      <div className="rounded-b-[2rem] bg-paper px-5 pb-5 pt-5">
        <div className="mb-4 flex h-11 items-center justify-between gap-3">
          <BrandLogo size={44} />
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <button
              type="button"
              onClick={() => void signOut()}
              className="grid size-10 place-items-center rounded-full bg-page"
              aria-label={t('shell.signOut')}
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="mb-4 flex h-10 items-center justify-between gap-3">
          <h1 className="min-w-0 flex-1 truncate text-[1.75rem] leading-10">
            {t('shop.order.heading')}
          </h1>
          <span className="w-[6.5rem] shrink-0 truncate rounded-full bg-brand-soft py-1.5 text-center text-sm font-semibold leading-5 text-brand-dark">
            {formatDay(today, language)}
          </span>
        </div>
        <label className="flex h-12 items-center gap-2 rounded-full bg-page px-4">
          <Search size={18} aria-hidden="true" className="shrink-0 text-mute" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('shop.order.search')}
            aria-label={t('shop.order.search')}
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        </label>
      </div>

      <div className="px-4 pt-4">
        {catalog.isError ? (
          <Banner kind="error">{errorText(t, catalog.error)}</Banner>
        ) : catalog.isPending ? (
          <>
            <div className="mb-4 h-10" aria-hidden="true" />
            <ul className="overflow-hidden rounded-[1.75rem] border border-line bg-paper">
              {[0, 1, 2, 3, 4].map((i) => (
                <li key={i} aria-hidden="true" className="h-[4.75rem] border-b border-line" />
              ))}
            </ul>
          </>
        ) : items.length === 0 ? (
          <Empty>{t('shop.order.noRates')}</Empty>
        ) : (
          <>
            {categories.length > 1 && (
              <div
                role="group"
                aria-label={t('shop.order.title')}
                className="-mx-4 mb-4 flex h-10 gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {[ALL, ...categories].map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={category === c}
                    onClick={() => setCategory(c)}
                    className={
                      'h-10 shrink-0 whitespace-nowrap rounded-full border-[1.5px] px-4 text-sm font-semibold ' +
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
              <div className="flex flex-col gap-5">
                {[...groups.entries()].map(([cat, list]) => (
                  <div key={cat}>
                    <div className="mb-2 flex h-6 items-center justify-between px-1">
                      <h2 className="min-w-0 truncate text-lg leading-6">{cat}</h2>
                      <span className="text-sm font-semibold text-mute">{list.length}</span>
                    </div>
                    <ul className="divide-y divide-line overflow-hidden rounded-[1.75rem] border border-line bg-paper">
                      {list.map((item) => {
                        const names = displayNames(item.nameEn, item.nameTa, language)
                        return (
                          <li key={item.id} className={ROW}>
                            <span
                              aria-hidden="true"
                              className={`grid size-12 shrink-0 place-items-center rounded-2xl text-2xl ${
                                TINT_BG[tintFor(item.category || '—')]
                              }`}
                            >
                              {emojiFor(item.nameEn, item.category)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="h-6 truncate font-semibold leading-6">
                                {names.primary}
                              </p>
                              <p className="flex h-5 items-baseline gap-1 text-sm leading-5 text-mute">
                                <span>₹{formatRupees(item.rate)}</span>
                                <span className="truncate">
                                  {t('shop.order.perUnit', { unit: item.unit })}
                                </span>
                              </p>
                            </div>
                            <div className="w-[8.5rem] shrink-0">
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
            aria-label={t('shop.order.review')}
            className="btn flex h-14 w-full justify-between rounded-full px-5 text-base no-underline shadow-[0_8px_30px_rgba(15,26,20,0.18)]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <ShoppingCart size={20} aria-hidden="true" className="shrink-0" />
              <span className="truncate">
                <span className="sr-only">
                  {t('shop.order.cartItems', { count })} · ₹{formatINR(total)}
                </span>
                <span aria-hidden="true">
                  {count} · ₹{formatINR(total)}
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2" aria-hidden="true">
              {t('shop.order.reviewShort')}
              <ArrowRight size={18} />
            </span>
          </Link>
        </div>
      )}
    </section>
  )
}
