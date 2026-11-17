import { Search, ShoppingCart } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Banner, Empty, Loading, PageHeader } from '../../components/ui'
import { todayISO } from '../../lib/dates'
import { formatINR, formatRupees } from '../../lib/money'
import { displayNames } from '../../lib/names'
import { errorText } from '../admin/queries'
import { useAuth } from '../auth/AuthProvider'
import type { Language } from '../auth/types'
import { cartCount, cartTotal } from './cart'
import { useCart } from './cartStore'
import { QtyControl } from './QtyControl'
import { useCatalog } from './queries'

/** Today's items with their rates. Tap Add, change the quantity, then review the order. */
export function OrderPage() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const { profile } = useAuth()
  const lines = useCart((s) => s.lines)
  const setQty = useCart((s) => s.setQty)
  const [search, setSearch] = useState('')
  const catalog = useCatalog(todayISO())

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

  const q = search.trim().toLowerCase()
  const shown = catalog.data.filter(
    (i) => !q || i.nameEn.toLowerCase().includes(q) || i.nameTa.toLowerCase().includes(q),
  )
  const groups = new Map<string, typeof shown>()
  for (const item of shown) {
    const key = item.category || '—'
    groups.set(key, [...(groups.get(key) ?? []), item])
  }

  const count = cartCount(lines, rates)
  const total = cartTotal(lines, rates)

  return (
    <section className="pb-28">
      <PageHeader title={t('shop.order.title')} />

      {catalog.data.length === 0 ? (
        <Empty>{t('shop.order.noRates')}</Empty>
      ) : (
        <>
          <div className="relative mb-4">
            <Search
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('shop.order.search')}
              aria-label={t('shop.order.search')}
              className="field pl-10"
            />
          </div>

          {shown.length === 0 ? (
            <Empty>{t('shop.order.noMatch')}</Empty>
          ) : (
            <div className="flex flex-col gap-6">
              {[...groups.entries()].map(([category, items]) => (
                <div key={category}>
                  <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-mute">
                    {category}
                  </h2>
                  <ul className="divide-y-2 divide-hair rounded-xl border-2 border-ink">
                    {items.map((item) => {
                      const names = displayNames(item.nameEn, item.nameTa, language)
                      return (
                        <li key={item.id} className="flex items-center gap-3 px-3 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{names.primary}</p>
                            {names.secondary && (
                              <p className="truncate text-sm text-mute">{names.secondary}</p>
                            )}
                            <p className="text-sm">
                              <span className="font-bold">₹{formatRupees(item.rate)}</span>{' '}
                              <span className="text-mute">
                                {t('shop.order.perUnit', { unit: item.unit })}
                              </span>
                            </p>
                          </div>
                          <QtyControl
                            name={names.primary}
                            qty={lines[item.id] ?? 0}
                            onChange={(qty) =>
                              setQty(item.id, qty, { en: item.nameEn, ta: item.nameTa })
                            }
                          />
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {count > 0 && (
            <div className="sticky bottom-16 mt-6 flex items-center justify-between gap-3 border-t-2 border-ink bg-paper py-3 md:bottom-0">
              <p className="font-semibold">
                <ShoppingCart size={18} aria-hidden="true" className="mr-1.5 inline" />
                {t('shop.order.cartItems', { count })} · ₹{formatINR(total)}
              </p>
              <Link to="/shop/order/review" className="btn no-underline">
                {t('shop.order.review')}
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  )
}
