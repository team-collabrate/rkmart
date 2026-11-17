import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import {
  Banner,
  Empty,
  Loading,
  PageHeader,
  SelectField,
  StatusPill,
  TextField,
} from '../../components/ui'
import { useAdminApi } from '../../data/apiContext'
import { GST_RATES, type Product } from '../../data/types'
import { displayNames } from '../../lib/names'
import type { Language } from '../auth/types'
import { errorText, keys, useProducts } from './queries'
import { productSchema } from './schemas'
import { toNumber, useForm } from './useForm'

const BASE = '/admin/more/items'
const UNITS = ['bag', 'kg', 'can', 'packet', 'litre', 'piece', 'box', 'dozen']

export function ItemsList() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const products = useProducts()
  const [search, setSearch] = useState('')

  const q = search.trim().toLowerCase()
  const shown = (products.data ?? []).filter(
    (p) => !q || p.nameEn.toLowerCase().includes(q) || p.nameTa.toLowerCase().includes(q),
  )

  return (
    <section>
      <PageHeader
        title={t('admin.items.title')}
        backTo="/admin/more"
        action={
          <Link to={`${BASE}/new`} className="btn no-underline">
            <Plus size={18} aria-hidden="true" />
            {t('admin.items.add')}
          </Link>
        }
      />
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
          placeholder={t('admin.common.search')}
          aria-label={t('admin.common.search')}
          className="field pl-10"
        />
      </div>

      {products.isPending ? (
        <Loading />
      ) : products.isError ? (
        <Banner kind="error">{errorText(t, products.error)}</Banner>
      ) : shown.length === 0 ? (
        <Empty>{t('admin.common.noResults')}</Empty>
      ) : (
        <ul className="divide-y-2 divide-hair rounded-xl border-2 border-ink">
          {shown.map((p) => {
            const names = displayNames(p.nameEn, p.nameTa, language)
            const details = [
              names.secondary,
              p.category,
              p.unit,
              p.hsnCode && `HSN ${p.hsnCode}`,
              `GST ${p.gstRate}%`,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <li key={p.id}>
                <Link
                  to={`${BASE}/${p.id}`}
                  className="flex items-center gap-3 px-3 py-3 no-underline"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{names.primary}</p>
                    <p className="truncate text-sm text-mute">{details}</p>
                  </div>
                  <StatusPill active={p.isActive} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Add a new item (no id) or edit an existing one (/items/:id). */
export function ItemForm() {
  const { t } = useTranslation()
  const { id } = useParams()
  const products = useProducts()

  if (products.isPending) return <Loading />
  if (products.isError) return <Banner kind="error">{errorText(t, products.error)}</Banner>

  const all = products.data
  const existing = id ? all.find((p) => p.id === id) : undefined
  if (id && !existing) return <Banner kind="error">{t('admin.apiErrors.not_found')}</Banner>

  const nextOrder = Math.max(0, ...all.map((p) => p.sortOrder)) + 10
  const categories = [...new Set(all.map((p) => p.category).filter(Boolean))].sort()
  return <ItemFormBody existing={existing} nextOrder={nextOrder} categories={categories} />
}

function ItemFormBody({
  existing,
  nextOrder,
  categories,
}: {
  existing?: Product
  nextOrder: number
  categories: string[]
}) {
  const { t } = useTranslation()
  const api = useAdminApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const form = useForm({
    nameEn: existing?.nameEn ?? '',
    nameTa: existing?.nameTa ?? '',
    category: existing?.category ?? '',
    unit: existing?.unit ?? 'kg',
    hsnCode: existing?.hsnCode ?? '',
    gstRate: String(existing?.gstRate ?? 5),
    sortOrder: String(existing?.sortOrder ?? nextOrder),
  })
  const [failure, setFailure] = useState<string | null>(null)

  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: keys.products })
    void navigate(BASE)
  }
  const save = useMutation({
    mutationFn: (input: Parameters<typeof api.saveProduct>[0]) =>
      api.saveProduct(input, existing?.id),
    onSuccess: done,
    onError: (e) => setFailure(errorText(t, e)),
  })
  const toggle = useMutation({
    mutationFn: () => api.setProductActive(existing!.id, !existing!.isActive),
    onSuccess: done,
    onError: (e) => setFailure(errorText(t, e)),
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFailure(null)
    const v = form.values
    const parsed = form.validate(productSchema, {
      ...v,
      gstRate: toNumber(v.gstRate),
      sortOrder: toNumber(v.sortOrder),
    })
    if (parsed) save.mutate(parsed)
  }

  const { values, set, errors } = form
  return (
    <section>
      <PageHeader title={existing ? t('admin.items.edit') : t('admin.items.new')} backTo={BASE} />
      <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-4">
        <TextField
          id="nameEn"
          label={t('admin.items.nameEn')}
          value={values.nameEn}
          onChange={(x) => set('nameEn', x)}
          error={errors.nameEn}
        />
        <TextField
          id="nameTa"
          label={t('admin.items.nameTa')}
          value={values.nameTa}
          onChange={(x) => set('nameTa', x)}
          error={errors.nameTa}
          lang="ta"
        />
        <TextField
          id="category"
          label={t('admin.items.category')}
          value={values.category}
          onChange={(x) => set('category', x)}
          list="category-list"
        />
        <datalist id="category-list">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <TextField
          id="unit"
          label={t('admin.items.unit')}
          value={values.unit}
          onChange={(x) => set('unit', x)}
          error={errors.unit}
          list="unit-list"
          hint={t('admin.items.unitHint')}
        />
        <datalist id="unit-list">
          {UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <TextField
          id="hsnCode"
          label={t('admin.items.hsn')}
          value={values.hsnCode}
          onChange={(x) => set('hsnCode', x)}
          error={errors.hsnCode}
          inputMode="numeric"
          hint={t('admin.items.hsnHint')}
        />
        <SelectField
          id="gstRate"
          label={t('admin.items.gst')}
          value={values.gstRate}
          onChange={(x) => set('gstRate', x)}
          error={errors.gstRate}
          options={GST_RATES.map((r) => ({ value: String(r), label: `${r}%` }))}
          hint={t('admin.items.gstHint')}
        />
        <TextField
          id="sortOrder"
          label={t('admin.items.sortOrder')}
          value={values.sortOrder}
          onChange={(x) => set('sortOrder', x)}
          error={errors.sortOrder}
          inputMode="numeric"
          hint={t('admin.items.sortHint')}
        />

        {failure && <Banner kind="error">{failure}</Banner>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn" disabled={save.isPending}>
            {save.isPending ? t('admin.common.saving') : t('admin.common.save')}
          </button>
          {existing && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => toggle.mutate()}
              disabled={toggle.isPending}
            >
              {existing.isActive ? t('admin.common.switchOff') : t('admin.common.switchOn')}
            </button>
          )}
        </div>
        {existing && !existing.isActive && (
          <p className="text-sm text-mute">{t('admin.items.offNote')}</p>
        )}
      </form>
    </section>
  )
}
