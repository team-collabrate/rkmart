import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CopyCheck, Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAdminApi } from '../../data/apiContext'
import { Banner, Empty, Loading, PageHeader } from '../../components/ui'
import { formatDay, todayISO } from '../../lib/dates'
import { formatINRWhole } from '../../lib/money'
import { displayNames } from '../../lib/names'
import type { Product, RateMap } from '../../data/types'
import type { Language } from '../auth/types'
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

type Notice = { kind: 'success' | 'error' | 'info'; text: string } | null

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

  if (products.isError || saved.isError) {
    return <Banner kind="error">{errorText(t, products.error ?? saved.error)}</Banner>
  }
  if (products.isPending || saved.isPending || previous.isPending) return <Loading />
  return (
    <RatesEditor
      today={today}
      products={products.data}
      saved={saved.data}
      previousRates={previous.data ?? {}}
    />
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

  const currentDraft = draft
  const missing = missingIds(currentDraft, ids)

  function setRate(id: string, value: string) {
    setDraft({ ...currentDraft, [id]: value })
    setNotice(null)
    if (invalid.includes(id)) setInvalid(invalid.filter((x) => x !== id))
  }

  function sameAsYesterday() {
    setDraft(fillBlanks(currentDraft, previousRates, ids))
    setNotice(null)
  }

  function onSave() {
    const plan = planSave(currentDraft, saved, ids)
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

  return (
    <section className="pb-24">
      <PageHeader title={t('admin.rates.title')} />
      <p className="-mt-2 mb-4 text-mute">{formatDay(today, language)}</p>

      {active.length === 0 ? (
        <Empty>{t('admin.rates.noItems')}</Empty>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-outline" onClick={sameAsYesterday}>
              <CopyCheck size={18} aria-hidden="true" />
              {t('admin.rates.sameAsYesterday')}
            </button>
            {missing.length > 0 && (
              <p className="font-semibold" role="status">
                {t('admin.rates.missing', { count: missing.length })}
              </p>
            )}
          </div>

          {notice && (
            <div className="mb-4">
              <Banner kind={notice.kind}>{notice.text}</Banner>
            </div>
          )}

          <div className="flex flex-col gap-6">
            {[...groups.entries()].map(([category, items]) => (
              <div key={category}>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-mute">
                  {category}
                </h2>
                <ul className="divide-y-2 divide-hair rounded-xl border-2 border-ink">
                  {items.map((item) => {
                    const names = displayNames(item.nameEn, item.nameTa, language)
                    const parsed = parseRate(currentDraft[item.id] ?? '')
                    const value = parsed.ok ? parsed.value : null
                    const delta = rateDelta(value, previousRates[item.id])
                    const isInvalid = invalid.includes(item.id) || !parsed.ok
                    return (
                      <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{names.primary}</p>
                          {names.secondary && (
                            <p className="truncate text-sm text-mute">{names.secondary}</p>
                          )}
                          <p className="text-sm text-mute">
                            {t('admin.rates.perUnit', { unit: item.unit })}
                            {previousRates[item.id] !== undefined &&
                              ` · ${t('admin.rates.yesterday', { rate: formatINRWhole(previousRates[item.id]) })}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {delta !== null && (
                            <span
                              className="whitespace-nowrap text-sm font-bold"
                              aria-label={t('admin.rates.change', { delta })}
                            >
                              {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
                            </span>
                          )}
                          <div className="relative w-28">
                            <span
                              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold"
                              aria-hidden="true"
                            >
                              ₹
                            </span>
                            <input
                              inputMode="decimal"
                              value={currentDraft[item.id] ?? ''}
                              onChange={(e) => setRate(item.id, e.target.value)}
                              aria-label={t('admin.rates.rateFor', { name: names.primary })}
                              aria-invalid={isInvalid}
                              className="field pl-7 text-right"
                            />
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="sticky bottom-16 mt-6 flex justify-end border-t-2 border-ink bg-paper py-3 md:bottom-0">
            <button type="button" className="btn" onClick={onSave} disabled={save.isPending}>
              <Save size={18} aria-hidden="true" />
              {save.isPending ? t('admin.common.saving') : t('admin.rates.save')}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
