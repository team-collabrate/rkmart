import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { Banner, Empty, Loading, PageHeader, StatusPill, TextField } from '../../components/ui'
import { Avatar } from '../../components/Avatar'
import { useAdminApi } from '../../data/apiContext'
import type { Shop } from '../../data/types'
import { displayNames } from '../../lib/names'
import type { Language } from '../auth/types'
import { errorText, keys, useShops } from './queries'
import { shopSchema } from './schemas'
import { useForm } from './useForm'

const BASE = '/admin/more/shops'

export function ShopsList() {
  const { t, i18n } = useTranslation()
  const language: Language = i18n.language === 'ta' ? 'ta' : 'en'
  const shops = useShops()

  return (
    <section>
      <PageHeader
        title={t('admin.shops.title')}
        backTo="/admin/more"
        action={
          <Link
            to={`${BASE}/new`}
            aria-label={t('admin.shops.add')}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-paper no-underline"
          >
            <Plus size={22} aria-hidden="true" />
          </Link>
        }
      />
      {shops.isPending ? (
        <Loading />
      ) : shops.isError ? (
        <Banner kind="error">{errorText(t, shops.error)}</Banner>
      ) : shops.data.length === 0 ? (
        <Empty>{t('admin.shops.empty')}</Empty>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[1.75rem] border border-line bg-paper">
          {shops.data.map((s) => {
            const names = displayNames(s.nameEn, s.nameTa, language)
            const details = [names.secondary, s.ownerName, s.phone, s.address]
              .filter(Boolean)
              .join(' · ')
            return (
              <li key={s.id}>
                <Link
                  to={`${BASE}/${s.id}`}
                  className="flex items-center gap-3 px-3.5 py-3 no-underline"
                >
                  <Avatar name={s.nameEn} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{names.primary}</p>
                    <p className="truncate text-sm text-mute">{details}</p>
                  </div>
                  <StatusPill active={s.isActive} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function ShopForm() {
  const { t } = useTranslation()
  const { id } = useParams()
  const shops = useShops()

  if (shops.isPending) return <Loading />
  if (shops.isError) return <Banner kind="error">{errorText(t, shops.error)}</Banner>
  const existing = id ? shops.data.find((s) => s.id === id) : undefined
  if (id && !existing) return <Banner kind="error">{t('admin.apiErrors.not_found')}</Banner>
  return <ShopFormBody existing={existing} />
}

function ShopFormBody({ existing }: { existing?: Shop }) {
  const { t } = useTranslation()
  const api = useAdminApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const form = useForm({
    nameEn: existing?.nameEn ?? '',
    nameTa: '',
    ownerName: existing?.ownerName ?? '',
    phone: existing?.phone ?? '',
    address: existing?.address ?? '',
    stateCode: existing?.stateCode ?? '33',
    gstin: existing?.gstin ?? '',
  })
  const [failure, setFailure] = useState<string | null>(null)

  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: keys.shops })
    void navigate(BASE)
  }
  const save = useMutation({
    mutationFn: (input: Parameters<typeof api.saveShop>[0]) => api.saveShop(input, existing?.id),
    onSuccess: done,
    onError: (e) => setFailure(errorText(t, e)),
  })
  const toggle = useMutation({
    mutationFn: () => api.setShopActive(existing!.id, !existing!.isActive),
    onSuccess: done,
    onError: (e) => setFailure(errorText(t, e)),
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFailure(null)
    const parsed = form.validate(shopSchema)
    if (parsed) save.mutate(parsed)
  }

  const { values, set, errors } = form
  return (
    <section>
      <PageHeader title={existing ? t('admin.shops.edit') : t('admin.shops.new')} backTo={BASE} />
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-4 rounded-[1.75rem] border border-line bg-paper p-4"
      >
        <TextField
          id="nameEn"
          label={t('admin.shops.nameEn')}
          value={values.nameEn}
          onChange={(x) => set('nameEn', x)}
          error={errors.nameEn}
        />
        <TextField
          id="ownerName"
          label={t('admin.shops.owner')}
          value={values.ownerName}
          onChange={(x) => set('ownerName', x)}
        />
        <TextField
          id="phone"
          label={t('admin.shops.phone')}
          value={values.phone}
          onChange={(x) => set('phone', x)}
          error={errors.phone}
          type="tel"
          inputMode="numeric"
        />
        <TextField
          id="address"
          label={t('admin.shops.address')}
          value={values.address}
          onChange={(x) => set('address', x)}
        />
        <TextField
          id="stateCode"
          label={t('admin.shops.stateCode')}
          value={values.stateCode}
          onChange={(x) => set('stateCode', x)}
          error={errors.stateCode}
          inputMode="numeric"
          hint={t('admin.shops.stateHint')}
        />
        <TextField
          id="gstin"
          label={t('admin.shops.gstin')}
          value={values.gstin}
          onChange={(x) => set('gstin', x)}
          error={errors.gstin}
          autoCapitalize="characters"
          hint={t('admin.shops.gstinHint')}
        />

        {failure && <Banner kind="error">{failure}</Banner>}
        <div className="flex flex-col gap-3">
          <button type="submit" className="btn h-12 w-full rounded-full" disabled={save.isPending}>
            {save.isPending ? t('admin.common.saving') : t('admin.common.save')}
          </button>
          {existing && (
            <button
              type="button"
              className="btn btn-outline h-12 w-full rounded-full"
              onClick={() => toggle.mutate()}
              disabled={toggle.isPending}
            >
              {existing.isActive ? t('admin.common.switchOff') : t('admin.common.switchOn')}
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
