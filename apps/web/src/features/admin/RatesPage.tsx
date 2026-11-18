import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  CircleCheck,
  CopyCheck,
  History,
  Save,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAdminApi } from '../../data/apiContext'
import { Banner } from '../../components/ui'
import { TopBar } from '../../components/TopBar'
import { formatDay, todayISO } from '../../lib/dates'
import { formatINRWhole } from '../../lib/money'
import { displayNames } from '../../lib/names'
import type { Product, RateMap } from '../../data/types'
import type { Language } from '../auth/types'
import { emojiFor, TINT_BG, tintFor } from '../shop/itemVisual'
import { errorText, keys, usePreviousRates, useProducts, useRates } from './queries'
import {
  draftFromRates,
  fillBlanks,
  missingIds,
  parseRate,
  planSave,
  rateDelta,
  type Draft,
} from './rates'

// Built to stay still: fixed heights, one line per element, no animation, grey placeholder rows
// while loading. Sentences are kept as screen-reader text; sighted people get numbers and icons.

type Notice = { kind: 'success' | 'error' | 'info'; text: string } | null

/** The page frame: top bar, title and today's date, then whatever goes in the body. */
function RatesFrame({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  return (
    <section className="-mx-4 -mb-28 -mt-2 min-h-[calc(100dvh-4rem)] bg-page pb-44">
      <div className="rounded-b-[2rem] bg-paper px-5 pb-5 pt-5">
        <TopBar />
        <div className="flex h-10 items-center justify-between gap-3">
          <h1 className="min-w-0 truncate text-[2rem] leading-10">{t('admin.rates.title')}</h1>
          <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-page px-3 text-sm font-semibold">
            <CalendarDays size={16} aria-hidden="true" />
            {formatDay(todayISO(), language)}
          </span>
        </div>
      </div>
      <div className="px-4 pt-4">{children}</div>
    </section>
  )
}

/**
 * Today's rates: one box per item. "Same as yesterday" fills the empty boxes in one tap.
 * Shops only see (and can only order) items that have a rate for today.
 */
export function RatesPage() {
  const { t } = useTranslation()
  const today = todayISO()
  const products = useProducts()
  const saved = useRates(today)
  const previous = usePreviousRates(today)

  const failed = products.isError || saved.isError
  const ready = !products.isPending && !saved.isPending && !previous.isPending

  return (
    <RatesFrame>
      {failed ? (
        <Banner kind="error">{errorText(t, products.error ?? saved.error)}</Banner>
      ) : !ready ? (
        <div aria-hidden="true">
          <div className="mb-4 h-[11rem] rounded-[1.75rem] border border-line bg-paper" />
          <ul className="overflow-hidden rounded-[1.75rem] border border-line bg-paper">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="h-[4.75rem] border-b border-line last:border-b-0" />
            ))}
          </ul>
        </div>
      ) : (
        <RatesEditor
          today={today}
          products={products.data!}
          saved={saved.data!}
          previousRates={previous.data ?? {}}
        />
      )}
    </RatesFrame>
  )
}

/** Mounted only after the data has loaded, so the starting values can be set without an effect. */
function RatesEditor({
  today,
  products,
  saved,
  previousRates,
}: {
  today: string
  products: Product[]
  saved: RateMap
  previousRates: RateMap
}) {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const api = useAdminApi()
  const queryClient = useQueryClient()

  const [draft, setDraft] = useState<Draft>(() => draftFromRates(saved))
  const [invalid, setInvalid] = useState<string[]>([])
  const [notice, setNotice] = useState<Notice>(null)

  const active = useMemo(() => products.filter((p) => p.isActive), [products])
  const ids = useMemo(() => active.map((p) => p.id), [active])

  const save = useMutation({
    mutationFn: (changes: Record<string, number>) => api.saveRates(today, changes),
    onSuccess: async (_data, changes) => {
      await queryClient.invalidateQueries({ queryKey: keys.rates(today) })
      setNotice({
        kind: 'success',
        text: t('admin.rates.saved', { count: Object.keys(changes).length }),
      })
    },
    onError: (error) => setNotice({ kind: 'error', text: errorText(t, error) }),
  })

  const missing = missingIds(draft, ids)
  const priced = ids.length - missing.length
  const percent = ids.length > 0 ? Math.round((priced / ids.length) * 100) : 0

  function setRate(id: string, value: string) {
    setDraft({ ...draft, [id]: value })
    setNotice(null)
    if (invalid.includes(id)) setInvalid(invalid.filter((x) => x !== id))
  }

  function sameAsYesterday() {
    setDraft(fillBlanks(draft, previousRates, ids))
    setNotice(null)
  }

  function onSave() {
    const plan = planSave(draft, saved, ids)
    setInvalid(plan.invalid)
    if (plan.invalid.length > 0) {
      setNotice({ kind: 'error', text: t('admin.rates.invalid') })
      return
    }
    if (Object.keys(plan.changes).length === 0) {
      setNotice({ kind: 'info', text: t('admin.rates.nothingToSave') })
      return
    }
    save.mutate(plan.changes)
  }

  // Group by category, keeping the item order the admin set.
  const groups = new Map<string, typeof active>()
  for (const p of active) {
    const key = p.category || '—'
    groups.set(key, [...(groups.get(key) ?? []), p])
  }

  if (active.length === 0) {
    return (
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
            d="M50 22H30a4 4 0 0 0-4 4v20a4 4 0 0 0 1.2 2.8l22 22a4 4 0 0 0 5.6 0L73 55.6a4 4 0 0 0 0-5.6L52.8 23.2A4 4 0 0 0 50 22z"
            fill="#fff"
            stroke="#16a34a"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="38" cy="34" r="3.5" fill="#16a34a" />
        </svg>
        <p className="text-sm text-mute">{t('admin.rates.noItems')}</p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-4 rounded-[1.75rem] border border-line bg-paper p-4">
        <div className="mb-3 flex h-11 items-center gap-3">
          <span
            aria-hidden="true"
            className={
              'grid size-11 shrink-0 place-items-center rounded-full ' +
              (missing.length > 0 ? 'bg-amber-soft text-amber' : 'bg-brand-soft text-brand-dark')
            }
          >
            {missing.length > 0 ? <TriangleAlert size={22} /> : <CircleCheck size={22} />}
          </span>
          <div className="min-w-0">
            <p
              className={
                'h-6 truncate font-semibold leading-6 ' +
                (missing.length > 0 ? 'text-amber' : 'text-brand-dark')
              }
            >
              {missing.length > 0
                ? t('admin.rates.missingShort', { count: missing.length })
                : t('admin.rates.allSet')}
            </p>
            <p className="h-5 truncate text-sm leading-5 text-mute">
              {t('admin.rates.pricedOf', { done: priced, total: ids.length })}
            </p>
          </div>
          {missing.length > 0 && (
            <span role="status" className="sr-only">
              {t('admin.rates.missing', { count: missing.length })}
            </span>
          )}
        </div>
        <div
          className="mb-4 h-2 overflow-hidden rounded-full bg-page"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
        </div>
        <button type="button" className="btn h-12 w-full rounded-full" onClick={sameAsYesterday}>
          <CopyCheck size={20} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{t('admin.rates.sameAsYesterday')}</span>
        </button>
      </div>

      {notice && (
        <div className="mb-4">
          <Banner kind={notice.kind}>{notice.text}</Banner>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {[...groups.entries()].map(([category, items]) => (
          <div key={category}>
            <h2 className="mb-2 flex h-6 items-center gap-2 text-base leading-6">
              <span
                aria-hidden="true"
                className={`size-2.5 rounded-full ${TINT_BG[tintFor(category)]} ring-1 ring-black/10`}
              />
              <span className="truncate">{category}</span>
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-[1.75rem] border border-line bg-paper">
              {items.map((item) => {
                const names = displayNames(item.nameEn, item.nameTa, language)
                const parsed = parseRate(draft[item.id] ?? '')
                const value = parsed.ok ? parsed.value : null
                const delta = rateDelta(value, previousRates[item.id])
                const isInvalid = invalid.includes(item.id) || !parsed.ok
                const blank = parsed.ok && parsed.value === null
                const before = previousRates[item.id]
                return (
                  <li key={item.id} className="flex h-[4.75rem] items-center gap-3 px-3.5">
                    <span
                      aria-hidden="true"
                      className={`grid size-11 shrink-0 place-items-center rounded-2xl text-xl ${
                        TINT_BG[tintFor(category)]
                      }`}
                    >
                      {emojiFor(item.nameEn, item.category)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="h-6 truncate font-semibold leading-6">{names.primary}</p>
                      <p className="flex h-5 items-center gap-1 text-sm leading-5 text-mute">
                        <span className="shrink-0">{item.unit}</span>
                        {before !== undefined && (
                          <>
                            <span aria-hidden="true">·</span>
                            <History size={13} aria-hidden="true" className="shrink-0" />
                            <span className="truncate">₹{formatINRWhole(before)}</span>
                            <span className="sr-only">
                              {t('admin.rates.yesterday', { rate: formatINRWhole(before) })}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    {delta !== null && (
                      <span
                        className={
                          'flex shrink-0 items-center gap-0.5 text-sm font-bold ' +
                          (delta > 0 ? 'text-amber' : 'text-brand-dark')
                        }
                        aria-label={t('admin.rates.change', { delta })}
                      >
                        {delta > 0 ? (
                          <TrendingUp size={14} aria-hidden="true" />
                        ) : (
                          <TrendingDown size={14} aria-hidden="true" />
                        )}
                        {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
                      </span>
                    )}
                    <div
                      className={
                        'flex h-12 w-[6.5rem] shrink-0 items-center gap-1 rounded-2xl border bg-paper px-3 focus-within:border-brand ' +
                        (isInvalid
                          ? 'border-dashed border-ink'
                          : blank
                            ? 'border-amber'
                            : 'border-line')
                      }
                    >
                      <span aria-hidden="true" className="text-mute">
                        ₹
                      </span>
                      <input
                        inputMode="decimal"
                        value={draft[item.id] ?? ''}
                        onChange={(e) => setRate(item.id, e.target.value)}
                        aria-label={t('admin.rates.rateFor', { name: names.primary })}
                        aria-invalid={isInvalid}
                        className="w-full min-w-0 bg-transparent text-right text-base font-bold outline-none"
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="fixed bottom-[6.25rem] left-1/2 z-10 w-full max-w-[30rem] -translate-x-1/2 px-4">
        <button
          type="button"
          className="btn h-14 w-full rounded-full text-base shadow-[0_8px_30px_rgba(15,26,20,0.18)]"
          aria-label={t('admin.rates.save')}
          onClick={onSave}
          disabled={save.isPending}
        >
          <Save size={20} aria-hidden="true" className="shrink-0" />
          {save.isPending ? t('admin.common.saving') : t('admin.rates.saveShort')}
        </button>
      </div>
    </>
  )
}
