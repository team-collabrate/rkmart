import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Banner, CheckField, Loading, PageHeader, TextField } from '../../components/ui'
import { useAdminApi } from '../../data/apiContext'
import type { CompanySettings } from '../../data/types'
import { errorText, keys, useSettings } from './queries'
import { settingsSchema } from './schemas'
import { useForm } from './useForm'

export function SettingsPage() {
  const { t } = useTranslation()
  const settings = useSettings()

  return (
    <section>
      <PageHeader title={t('admin.settings.title')} backTo="/admin/more" />
      {settings.isPending ? (
        <Loading />
      ) : settings.isError ? (
        <Banner kind="error">{errorText(t, settings.error)}</Banner>
      ) : (
        <SettingsForm initial={settings.data} />
      )}
    </section>
  )
}

function SettingsForm({ initial }: { initial: CompanySettings }) {
  const { t } = useTranslation()
  const api = useAdminApi()
  const queryClient = useQueryClient()
  const form = useForm<CompanySettings>(initial)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const save = useMutation({
    mutationFn: (input: CompanySettings) => api.saveSettings(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.settings })
      setNotice({ kind: 'success', text: t('admin.common.saved') })
    },
    onError: (e) => setNotice({ kind: 'error', text: errorText(t, e) }),
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setNotice(null)
    const parsed = form.validate(settingsSchema)
    if (parsed) save.mutate(parsed)
  }

  const { values, set, errors } = form
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-[1.75rem] border border-line bg-paper p-4"
    >
      <TextField
        id="companyName"
        label={t('admin.settings.companyName')}
        value={values.companyName}
        onChange={(x) => set('companyName', x)}
        error={errors.companyName}
      />
      <TextField
        id="tagline"
        label={t('admin.settings.tagline')}
        value={values.tagline}
        onChange={(x) => set('tagline', x)}
      />
      <TextField
        id="address"
        label={t('admin.settings.address')}
        value={values.address}
        onChange={(x) => set('address', x)}
      />
      <TextField
        id="phone"
        label={t('admin.settings.phone')}
        value={values.phone}
        onChange={(x) => set('phone', x)}
        error={errors.phone}
        type="tel"
        inputMode="numeric"
      />
      <TextField
        id="gstin"
        label={t('admin.settings.gstin')}
        value={values.gstin}
        onChange={(x) => set('gstin', x)}
        error={errors.gstin}
        autoCapitalize="characters"
        hint={t('admin.settings.gstinHint')}
      />
      <TextField
        id="stateCode"
        label={t('admin.settings.stateCode')}
        value={values.stateCode}
        onChange={(x) => set('stateCode', x)}
        error={errors.stateCode}
        inputMode="numeric"
        hint={t('admin.shops.stateHint')}
      />
      <TextField
        id="bankDetails"
        label={t('admin.settings.bank')}
        value={values.bankDetails}
        onChange={(x) => set('bankDetails', x)}
        hint={t('admin.settings.bankHint')}
      />
      <TextField
        id="invoicePrefix"
        label={t('admin.settings.prefix')}
        value={values.invoicePrefix}
        onChange={(x) => set('invoicePrefix', x)}
        error={errors.invoicePrefix}
        autoCapitalize="characters"
        hint={t('admin.settings.prefixHint')}
      />
      <CheckField
        id="ratesIncludeGst"
        label={t('admin.settings.includeGst')}
        hint={t('admin.settings.includeGstHint')}
        checked={values.ratesIncludeGst}
        onChange={(x) => set('ratesIncludeGst', x)}
      />

      {notice && <Banner kind={notice.kind}>{notice.text}</Banner>}
      <div>
        <button type="submit" className="btn h-12 w-full rounded-full" disabled={save.isPending}>
          {save.isPending ? t('admin.common.saving') : t('admin.common.save')}
        </button>
      </div>
    </form>
  )
}
